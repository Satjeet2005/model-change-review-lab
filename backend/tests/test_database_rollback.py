from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ChangeTransaction, DemoSession, IdempotencyRequest
from tests.conftest import make_test_token


def test_stale_proposal_acceptance_fails_closed(client: TestClient):
    token = make_test_token("stale-acceptance-rollback")
    client.post("/api/v1/session", headers={"X-Workspace-Token": token})

    # 1. Generate proposal at revision 1
    gen = client.post(
        "/api/v1/proposals",
        headers={"X-Workspace-Token": token, "Idempotency-Key": "req-gen-stale"},
        json={"templateId": "hire-engineers-from-q3", "expectedRevision": 1},
    )
    ws_id = gen.json()["workspace"]["id"]
    var_id = gen.json()["workspace"]["variants"][0]["id"]

    # 2. Advance revision with a direct edit (rev 1 -> 2)
    edit = client.patch(
        "/api/v1/model/assumptions",
        headers={"X-Workspace-Token": token, "Idempotency-Key": "req-edit-stale-adv"},
        json={
            "expectedRevision": 1,
            "targetCellId": "setting:startingRevenueUsd",
            "proposedValue": 920000,
        },
    )
    assert edit.status_code == 200
    assert edit.json()["revision"] == 2

    # 3. Attempt to accept the stale proposal (even if passing expectedRevision: 2)
    acc = client.post(
        f"/api/v1/proposals/{ws_id}/accept",
        headers={"X-Workspace-Token": token, "Idempotency-Key": "req-acc-stale-try"},
        json={"variantId": var_id, "expectedRevision": 2},
    )
    assert acc.status_code == 409
    assert acc.json()["error"]["code"] == "stale_proposal"

    # Verify model is completely unchanged by failed acceptance
    model = client.get("/api/v1/model", headers={"X-Workspace-Token": token}).json()
    assert model["revision"] == 2
    # Engineering FTE at M07 must NOT have changed to 16
    assert model["workingAssumptions"]["months"][6]["engineeringFte"] == 14
    # Starting revenue must remain 920000
    assert model["workingAssumptions"]["startingRevenueUsd"] == 920000

    # History has only the one manual-edit
    history = client.get("/api/v1/history", headers={"X-Workspace-Token": token}).json()
    assert history["total"] == 1
    assert history["items"][0]["kind"] == "manual-edit"


def test_forced_db_failure_rolls_back_entirely(db_session: Session):
    from app.main import app

    token = make_test_token("forced-failure-rollback")
    unhandled_client = TestClient(app, raise_server_exceptions=False)
    unhandled_client.post("/api/v1/session", headers={"X-Workspace-Token": token})

    # Force failure during record_idempotency in direct_edit
    with patch(
        "app.services.model_service.record_idempotency",
        side_effect=RuntimeError("Simulated database failure before commit"),
    ):
        res = unhandled_client.patch(
            "/api/v1/model/assumptions",
            headers={"X-Workspace-Token": token, "Idempotency-Key": "req-fail-tx"},
            json={
                "expectedRevision": 1,
                "targetCellId": "setting:startingRevenueUsd",
                "proposedValue": 999999,
            },
        )
        assert res.status_code == 500

    # Check database state directly: revision, model, transactions, idempotency
    sess = db_session.scalar(select(DemoSession).where(DemoSession.token_hash == sess_hash(token)))
    assert sess.revision == 1
    assert sess.working_assumptions["startingRevenueUsd"] == 750000

    tx_count = len(
        db_session.scalars(
            select(ChangeTransaction).where(ChangeTransaction.session_id == sess.id)
        ).all()
    )
    assert tx_count == 0

    idem_count = len(
        db_session.scalars(
            select(IdempotencyRequest).where(IdempotencyRequest.session_id == sess.id)
        ).all()
    )
    assert idem_count == 0


def sess_hash(raw_token: str) -> str:
    import hashlib

    return hashlib.sha256(raw_token.strip().encode("utf-8")).hexdigest()
