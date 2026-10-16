import concurrent.futures

from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import make_test_token


def test_idempotency_replay_identical(client: TestClient):
    token = make_test_token("idempotency-123456789012")
    client.post("/api/v1/session", headers={"X-Workspace-Token": token})

    key = "idem-key-edit-test-12345"
    payload = {
        "expectedRevision": 1,
        "targetCellId": "setting:startingRevenueUsd",
        "proposedValue": 999000,
    }

    # First request
    res1 = client.patch(
        "/api/v1/model/assumptions",
        headers={"X-Workspace-Token": token, "Idempotency-Key": key},
        json=payload,
    )
    assert res1.status_code == 200
    assert res1.json()["revision"] == 2

    # Second request with identical key & payload
    res2 = client.patch(
        "/api/v1/model/assumptions",
        headers={"X-Workspace-Token": token, "Idempotency-Key": key},
        json=payload,
    )
    assert res2.status_code == 200
    assert res2.json()["revision"] == 2
    # Check that revision did NOT advance to 3
    assert res2.json()["revision"] == res1.json()["revision"]

    # History should have only ONE transaction
    h = client.get("/api/v1/history", headers={"X-Workspace-Token": token})
    assert h.json()["total"] == 1


def test_idempotency_conflict_on_different_payload(client: TestClient):
    token = make_test_token("idempotency-conflict-12345")
    client.post("/api/v1/session", headers={"X-Workspace-Token": token})

    key = "idem-key-conflict-test-999"
    payload1 = {
        "expectedRevision": 1,
        "targetCellId": "setting:startingRevenueUsd",
        "proposedValue": 888000,
    }
    payload2 = {
        "expectedRevision": 1,
        "targetCellId": "setting:startingRevenueUsd",
        "proposedValue": 777000,
    }

    res1 = client.patch(
        "/api/v1/model/assumptions",
        headers={"X-Workspace-Token": token, "Idempotency-Key": key},
        json=payload1,
    )
    assert res1.status_code == 200

    # Same key, different body -> 409 idempotency_key_reused
    res2 = client.patch(
        "/api/v1/model/assumptions",
        headers={"X-Workspace-Token": token, "Idempotency-Key": key},
        json=payload2,
    )
    assert res2.status_code == 409
    assert res2.json()["error"]["code"] == "idempotency_key_reused"


def test_duplicate_acceptance_rejected(client: TestClient):
    token = make_test_token("dup-accept-user-12345")
    client.post("/api/v1/session", headers={"X-Workspace-Token": token})

    # Generate workspace
    gen = client.post(
        "/api/v1/proposals",
        headers={"X-Workspace-Token": token, "Idempotency-Key": "req-gen-dup-acc"},
        json={"templateId": "hire-engineers-from-q3", "expectedRevision": 1},
    )
    ws_id = gen.json()["workspace"]["id"]
    var_id = gen.json()["workspace"]["variants"][0]["id"]

    # Accept once
    acc1 = client.post(
        f"/api/v1/proposals/{ws_id}/accept",
        headers={"X-Workspace-Token": token, "Idempotency-Key": "req-acc-key-1"},
        json={"variantId": var_id, "expectedRevision": 1},
    )
    assert acc1.status_code == 200
    assert acc1.json()["sessionSnapshot"]["revision"] == 2

    # Accept again with a different key -> 409 duplicate_acceptance
    acc2 = client.post(
        f"/api/v1/proposals/{ws_id}/accept",
        headers={"X-Workspace-Token": token, "Idempotency-Key": "req-acc-key-2"},
        json={"variantId": var_id, "expectedRevision": 2},
    )
    assert acc2.status_code == 409
    assert acc2.json()["error"]["code"] == "duplicate_acceptance"


def test_concurrent_edits_conflict(client: TestClient):
    token = make_test_token("concurrent-edit-user-8888")
    client.post("/api/v1/session", headers={"X-Workspace-Token": token})

    def run_edit(val: int, key: str):
        with TestClient(app) as local_client:
            return local_client.patch(
                "/api/v1/model/assumptions",
                headers={"X-Workspace-Token": token, "Idempotency-Key": key},
                json={
                    "expectedRevision": 1,
                    "targetCellId": "setting:startingRevenueUsd",
                    "proposedValue": val,
                },
            )

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(run_edit, 810000, "req-conc-1")
        f2 = executor.submit(run_edit, 820000, "req-conc-2")
        res1 = f1.result()
        res2 = f2.result()

    statuses = {res1.status_code, res2.status_code}
    # Exactly one must succeed with 200, the other must fail with 409 revision_conflict
    assert statuses == {200, 409}
    failed_res = res1 if res1.status_code == 409 else res2
    assert failed_res.json()["error"]["code"] == "revision_conflict"


def test_concurrent_identical_requests_replay_idempotency():
    token = make_test_token("conc-identical-12345")
    with TestClient(app) as init_client:
        init_client.post("/api/v1/session", headers={"X-Workspace-Token": token})

    key = "idem-concurrent-identical-key"
    payload = {
        "expectedRevision": 1,
        "targetCellId": "setting:startingRevenueUsd",
        "proposedValue": 850000,
    }

    import threading

    barrier = threading.Barrier(2)

    def run_edit():
        barrier.wait()
        with TestClient(app) as local_client:
            return local_client.patch(
                "/api/v1/model/assumptions",
                headers={"X-Workspace-Token": token, "Idempotency-Key": key},
                json=payload,
            )

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(run_edit)
        f2 = executor.submit(run_edit)
        res1 = f1.result()
        res2 = f2.result()

    # Both must succeed with 200 (one executes, the other replays from idempotency record)
    assert res1.status_code == 200
    assert res2.status_code == 200
    assert res1.json()["revision"] == 2
    assert res2.json()["revision"] == 2

    with TestClient(app) as check_client:
        h = check_client.get("/api/v1/history", headers={"X-Workspace-Token": token})
        assert h.json()["total"] == 1


def test_concurrent_reused_key_different_payload_conflict():
    token = make_test_token("conc-conflict-key-12345")
    with TestClient(app) as init_client:
        init_client.post("/api/v1/session", headers={"X-Workspace-Token": token})

    key = "idem-concurrent-conflict-key"
    payload1 = {
        "expectedRevision": 1,
        "targetCellId": "setting:startingRevenueUsd",
        "proposedValue": 710000,
    }
    payload2 = {
        "expectedRevision": 1,
        "targetCellId": "setting:startingRevenueUsd",
        "proposedValue": 720000,
    }

    import threading

    barrier = threading.Barrier(2)

    def run_edit(payload):
        barrier.wait()
        with TestClient(app) as local_client:
            return local_client.patch(
                "/api/v1/model/assumptions",
                headers={"X-Workspace-Token": token, "Idempotency-Key": key},
                json=payload,
            )

    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(run_edit, payload1)
        f2 = executor.submit(run_edit, payload2)
        res1 = f1.result()
        res2 = f2.result()

    statuses = {res1.status_code, res2.status_code}
    assert statuses == {200, 409}
    failed_res = res1 if res1.status_code == 409 else res2
    assert failed_res.json()["error"]["code"] == "idempotency_key_reused"
