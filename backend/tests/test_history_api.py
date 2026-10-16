from fastapi.testclient import TestClient

from tests.conftest import make_test_token


def test_history_and_undo_lifecycle(client: TestClient):
    token = make_test_token("history-user-1122334455")
    headers = {"X-Workspace-Token": token}

    client.post("/api/v1/session", headers=headers)

    # 1. Initially no history
    h0 = client.get("/api/v1/history", headers=headers)
    assert h0.status_code == 200
    assert h0.json()["total"] == 0
    assert h0.json()["canUndo"] is False

    # 2. Undo when nothing to undo returns 409
    u0 = client.post(
        "/api/v1/undo",
        headers={"X-Workspace-Token": token, "Idempotency-Key": "req-key-undo-empty"},
        json={"expectedRevision": 1},
    )
    assert u0.status_code == 409
    assert u0.json()["error"]["code"] == "nothing_to_undo"

    # 3. Create mutation 1: direct edit (rev 1 -> 2)
    client.patch(
        "/api/v1/model/assumptions",
        headers={"X-Workspace-Token": token, "Idempotency-Key": "req-key-tx-1"},
        json={
            "expectedRevision": 1,
            "targetCellId": "setting:startingRevenueUsd",
            "proposedValue": 850000,
        },
    )

    # 4. Create mutation 2: proposal accept (rev 2 -> 3)
    gen = client.post(
        "/api/v1/proposals",
        headers={"X-Workspace-Token": token, "Idempotency-Key": "req-key-gen-tx-2"},
        json={"templateId": "hire-engineers-from-q3", "expectedRevision": 2},
    )
    ws_id = gen.json()["workspace"]["id"]
    var_id = gen.json()["workspace"]["variants"][0]["id"]

    acc = client.post(
        f"/api/v1/proposals/{ws_id}/accept",
        headers={"X-Workspace-Token": token, "Idempotency-Key": "req-key-acc-tx-2"},
        json={"variantId": var_id, "expectedRevision": 2},
    )
    assert acc.status_code == 200
    assert acc.json()["sessionSnapshot"]["revision"] == 3

    # 5. Check history list
    h1 = client.get("/api/v1/history?limit=10", headers=headers)
    assert h1.status_code == 200
    data = h1.json()
    assert data["total"] == 2
    assert data["canUndo"] is True
    assert len(data["items"]) == 2
    # Newest first
    assert data["items"][0]["resultingRevision"] == 3
    assert data["items"][0]["kind"] == "proposal-accepted"
    assert data["items"][0]["provenance"]["proposalWorkspaceId"] == ws_id
    assert data["items"][1]["resultingRevision"] == 2
    assert data["items"][1]["kind"] == "manual-edit"

    # 6. Undo mutation 2 (rev 3 -> 4)
    u1 = client.post(
        "/api/v1/undo",
        headers={"X-Workspace-Token": token, "Idempotency-Key": "req-key-undo-1"},
        json={"expectedRevision": 3},
    )
    assert u1.status_code == 200
    snap_u1 = u1.json()
    assert snap_u1["revision"] == 4
    # Working assumptions should restore engineeringFte M07 to 14 (pre-proposal)
    assert snap_u1["workingAssumptions"]["months"][6]["engineeringFte"] == 14
    # But starting revenue should still be 850000 (from mutation 1)
    assert snap_u1["workingAssumptions"]["startingRevenueUsd"] == 850000

    # 7. Check history after undo
    h2 = client.get("/api/v1/history", headers=headers)
    assert h2.json()["total"] == 3
    assert h2.json()["items"][0]["kind"] == "undo"
    # Target transaction (proposal accept) should now have undoneByTransactionId set
    assert h2.json()["items"][1]["undoneByTransactionId"] == h2.json()["items"][0]["id"]
    # Still can undo mutation 1!
    assert h2.json()["canUndo"] is True

    # 8. Undo mutation 1 (rev 4 -> 5)
    u2 = client.post(
        "/api/v1/undo",
        headers={"X-Workspace-Token": token, "Idempotency-Key": "req-key-undo-2"},
        json={"expectedRevision": 4},
    )
    assert u2.status_code == 200
    snap_u2 = u2.json()
    assert snap_u2["revision"] == 5
    assert snap_u2["workingAssumptions"]["startingRevenueUsd"] == 750000

    # 9. No more forward transactions to undo
    h3 = client.get("/api/v1/history", headers=headers)
    assert h3.json()["canUndo"] is False
