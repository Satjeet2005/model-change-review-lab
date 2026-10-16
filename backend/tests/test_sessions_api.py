import hashlib
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import DemoSession
from tests.conftest import make_test_token


def test_health_check(client: TestClient):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok", "database": "ok"}


def test_session_init_requires_token(client: TestClient):
    res = client.post("/api/v1/session")
    assert res.status_code == 401
    data = res.json()
    assert "error" in data
    assert data["error"]["code"] == "invalid_workspace_token"

    res_short = client.post("/api/v1/session", headers={"X-Workspace-Token": "too-short"})
    assert res_short.status_code == 401
    assert res_short.json()["error"]["code"] == "invalid_workspace_token"


def test_session_create_and_resume(client: TestClient, db_session: Session):
    token = make_test_token("session-create-and-resume-12345")
    t_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()

    # Create session
    res = client.post("/api/v1/session", headers={"X-Workspace-Token": token})
    assert res.status_code == 200
    data = res.json()
    assert data["revision"] == 1
    assert data["sessionResetBecauseExpired"] is False
    assert len(data["baselineAssumptions"]["months"]) == 24
    assert len(data["workingAssumptions"]["months"]) == 24
    session_id = data["sessionId"]

    # Verify database has hash, NOT raw token
    row = db_session.scalar(select(DemoSession).where(DemoSession.token_hash == t_hash))
    assert row is not None
    assert str(row.id) == session_id
    assert row.token_hash == t_hash

    # Resume session with same token
    res2 = client.post("/api/v1/session", headers={"X-Workspace-Token": token})
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["sessionId"] == session_id
    assert data2["sessionResetBecauseExpired"] is False

    # GET /api/v1/session
    res3 = client.get("/api/v1/session", headers={"X-Workspace-Token": token})
    assert res3.status_code == 200
    data3 = res3.json()
    assert data3["sessionId"] == session_id
    assert "sessionResetBecauseExpired" not in data3 or data3["sessionResetBecauseExpired"] is None


def test_session_isolation(client: TestClient):
    token1 = make_test_token("session-isolation-user-1-12345")
    token2 = make_test_token("session-isolation-user-2-67890")

    res1 = client.post("/api/v1/session", headers={"X-Workspace-Token": token1})
    res2 = client.post("/api/v1/session", headers={"X-Workspace-Token": token2})

    assert res1.status_code == 200
    assert res2.status_code == 200
    assert res1.json()["sessionId"] != res2.json()["sessionId"]


def test_session_expired_resets(client: TestClient, db_session: Session):
    token = make_test_token("session-expired-user-9999-12345")
    t_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()

    res = client.post("/api/v1/session", headers={"X-Workspace-Token": token})
    assert res.status_code == 200
    first_session_id = res.json()["sessionId"]

    # Manually age session by 35 days
    session_row = db_session.scalar(select(DemoSession).where(DemoSession.token_hash == t_hash))
    assert session_row is not None
    session_row.last_seen_at = datetime.now(timezone.utc) - timedelta(days=35)
    db_session.commit()

    # Next init should expire and reseed
    res2 = client.post("/api/v1/session", headers={"X-Workspace-Token": token})
    assert res2.status_code == 200
    data2 = res2.json()
    assert data2["sessionId"] != first_session_id
    assert data2["sessionResetBecauseExpired"] is True


def test_authenticated_get_advances_last_seen_at(client: TestClient, db_session: Session):
    token = make_test_token("liveness-check-user-1234567890")
    t_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()

    res = client.post("/api/v1/session", headers={"X-Workspace-Token": token})
    assert res.status_code == 200

    # Age last_seen_at by 5 days (well within 30-day TTL)
    row = db_session.scalar(select(DemoSession).where(DemoSession.token_hash == t_hash))
    assert row is not None
    aged_time = datetime.now(timezone.utc) - timedelta(days=5)
    row.last_seen_at = aged_time
    db_session.commit()

    # Perform authenticated GET
    get_res = client.get("/api/v1/session", headers={"X-Workspace-Token": token})
    assert get_res.status_code == 200

    # Query fresh from database (expiring cache)
    db_session.expire_all()
    updated_row = db_session.scalar(select(DemoSession).where(DemoSession.token_hash == t_hash))
    assert updated_row is not None
    assert updated_row.last_seen_at > aged_time
    delta = abs((datetime.now(timezone.utc) - updated_row.last_seen_at).total_seconds())
    assert delta < 10.0


def test_session_expiration_boundary_and_401(client: TestClient, db_session: Session):
    token = make_test_token("boundary-check-user-123456789")
    t_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()

    client.post("/api/v1/session", headers={"X-Workspace-Token": token})

    # Age to 29 days (valid)
    row = db_session.scalar(select(DemoSession).where(DemoSession.token_hash == t_hash))
    assert row is not None
    row.last_seen_at = datetime.now(timezone.utc) - timedelta(days=29)
    db_session.commit()

    # Authenticated GET should succeed
    res_valid = client.get("/api/v1/session", headers={"X-Workspace-Token": token})
    assert res_valid.status_code == 200

    # Now age to 31 days (expired)
    db_session.expire_all()
    row = db_session.scalar(select(DemoSession).where(DemoSession.token_hash == t_hash))
    assert row is not None
    row.last_seen_at = datetime.now(timezone.utc) - timedelta(days=31)
    db_session.commit()

    # Authenticated GET must return 401 invalid_workspace_token
    res_expired = client.get("/api/v1/session", headers={"X-Workspace-Token": token})
    assert res_expired.status_code == 401
    assert res_expired.json()["error"]["code"] == "invalid_workspace_token"
    assert "reinitialize" in res_expired.json()["error"]["message"].lower()

    # POST /api/v1/session recovers by reinitializing
    res_reinit = client.post("/api/v1/session", headers={"X-Workspace-Token": token})
    assert res_reinit.status_code == 200
    assert res_reinit.json()["sessionResetBecauseExpired"] is True


def test_cors_preflight_headers(client: TestClient):
    headers = {
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "PATCH",
        "Access-Control-Request-Headers": "X-Workspace-Token, Idempotency-Key, Content-Type",
    }
    res = client.options("/api/v1/model/assumptions", headers=headers)
    assert res.status_code == 200
    assert res.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert "PATCH" in res.headers.get("access-control-allow-methods", "")


def test_concurrent_expired_session_init(db_session: Session):
    import concurrent.futures
    import threading

    from app.main import app

    token = make_test_token("concurrent-expired-token-12345")
    t_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()

    # Create initial session
    with TestClient(app) as client:
        res = client.post("/api/v1/session", headers={"X-Workspace-Token": token})
        assert res.status_code == 200
        old_session_id = res.json()["sessionId"]

    # Manually age session by 35 days (expired)
    session_row = db_session.scalar(select(DemoSession).where(DemoSession.token_hash == t_hash))
    assert session_row is not None
    session_row.last_seen_at = datetime.now(timezone.utc) - timedelta(days=35)
    db_session.commit()

    barrier = threading.Barrier(2)

    def init_call():
        barrier.wait()
        with TestClient(app) as local_client:
            return local_client.post("/api/v1/session", headers={"X-Workspace-Token": token})

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(init_call)
        f2 = executor.submit(init_call)
        res1 = f1.result()
        res2 = f2.result()

    assert res1.status_code == 200
    assert res2.status_code == 200
    data1 = res1.json()
    data2 = res2.json()

    # Both must converge on the exact same winning session
    assert data1["sessionId"] == data2["sessionId"]
    assert data1["sessionId"] != old_session_id
    # Both must report sessionResetBecauseExpired: True
    assert data1["sessionResetBecauseExpired"] is True
    assert data2["sessionResetBecauseExpired"] is True


def test_post_session_snapshot_assembly_racing_with_concurrent_mutation():
    import concurrent.futures
    import threading

    from app.main import app

    token = make_test_token("race-post-init-mut-987654321")

    # Initial session creation
    with TestClient(app) as init_client:
        init_res = init_client.post("/api/v1/session", headers={"X-Workspace-Token": token})
        assert init_res.status_code == 200
        assert init_res.json()["revision"] == 1
        assert init_res.json()["workingAssumptions"]["startingRevenueUsd"] == 750000.0

    barrier = threading.Barrier(2)

    def run_post_init():
        barrier.wait()
        with TestClient(app) as client:
            return client.post("/api/v1/session", headers={"X-Workspace-Token": token})

    def run_direct_edit():
        barrier.wait()
        with TestClient(app) as client:
            return client.patch(
                "/api/v1/model/assumptions",
                headers={
                    "X-Workspace-Token": token,
                    "Idempotency-Key": "key-post-init-race-mut-1",
                },
                json={
                    "expectedRevision": 1,
                    "targetCellId": "setting:startingRevenueUsd",
                    "proposedValue": 999999,
                },
            )

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        f_init = executor.submit(run_post_init)
        f_edit = executor.submit(run_direct_edit)
        res_init = f_init.result()
        res_edit = f_edit.result()

    assert res_init.status_code == 200
    assert res_edit.status_code == 200

    snap = res_init.json()
    # The session snapshot assembly held the row lock, guaranteeing a coherent snapshot:
    # It must either observe pre-mutation state (rev 1, startingRevenue 750000.0)
    # OR post-mutation state (rev 2, startingRevenue 999999).
    # It can NEVER see a torn or inconsistent state.
    if snap["revision"] == 1:
        assert snap["workingAssumptions"]["startingRevenueUsd"] == 750000.0
        assert snap["stateVersion"] == 1
    elif snap["revision"] == 2:
        assert snap["workingAssumptions"]["startingRevenueUsd"] == 999999
        assert snap["stateVersion"] == 2
    else:
        raise AssertionError(f"Unexpected snapshot revision: {snap['revision']}")
