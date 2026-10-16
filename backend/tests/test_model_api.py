from fastapi.testclient import TestClient

from tests.conftest import make_test_token


def test_model_api_lifecycle(client: TestClient):
    token = make_test_token("model-api-user-987654321")
    headers = {"X-Workspace-Token": token}

    # Initialize session
    init_res = client.post("/api/v1/session", headers=headers)
    assert init_res.status_code == 200
    assert init_res.json()["revision"] == 1

    # 1. Read model
    read_res = client.get("/api/v1/model", headers=headers)
    assert read_res.status_code == 200
    model_data = read_res.json()
    assert model_data["revision"] == 1
    assert model_data["workingAssumptions"]["startingRevenueUsd"] == 750000

    # 2. Direct edit valid setting
    edit_res = client.patch(
        "/api/v1/model/assumptions",
        headers={"X-Workspace-Token": token, "Idempotency-Key": "req-key-edit-setting-1"},
        json={
            "expectedRevision": 1,
            "targetCellId": "setting:startingRevenueUsd",
            "proposedValue": 800000,
        },
    )
    assert edit_res.status_code == 200
    snap1 = edit_res.json()
    assert snap1["revision"] == 2
    assert snap1["changed"] is True
    assert snap1["workingAssumptions"]["startingRevenueUsd"] == 800000
    assert len(snap1["changeHistory"]) == 1
    assert snap1["changeHistory"][0]["kind"] == "manual-edit"
    assert snap1["canUndo"] is True

    # 3. Direct edit same value is no-op (no revision change, changed: false)
    noop_res = client.patch(
        "/api/v1/model/assumptions",
        headers={"X-Workspace-Token": token, "Idempotency-Key": "req-key-edit-noop-1"},
        json={
            "expectedRevision": 2,
            "targetCellId": "setting:startingRevenueUsd",
            "proposedValue": 800000,
        },
    )
    assert noop_res.status_code == 200
    assert noop_res.json()["revision"] == 2
    assert noop_res.json()["changed"] is False
    assert len(noop_res.json()["changeHistory"]) == 1

    # 4. Direct edit with stale expectedRevision returns 409
    stale_res = client.patch(
        "/api/v1/model/assumptions",
        headers={"X-Workspace-Token": token, "Idempotency-Key": "req-key-edit-stale-1"},
        json={
            "expectedRevision": 1,
            "targetCellId": "setting:startingRevenueUsd",
            "proposedValue": 900000,
        },
    )
    assert stale_res.status_code == 409
    assert stale_res.json()["error"]["code"] == "revision_conflict"

    # 5. Direct edit invalid target returns 422
    inv_target = client.patch(
        "/api/v1/model/assumptions",
        headers={"X-Workspace-Token": token, "Idempotency-Key": "req-key-edit-inv-target"},
        json={
            "expectedRevision": 2,
            "targetCellId": "calculated:revenue:M01",
            "proposedValue": 900000,
        },
    )
    assert inv_target.status_code == 422
    assert inv_target.json()["error"]["code"] == "validation_error"

    # 6. Reset to baseline restores baseline and advances revision (changed: true)
    reset_res = client.post(
        "/api/v1/model/reset",
        headers={"X-Workspace-Token": token, "Idempotency-Key": "req-key-reset-1"},
        json={"expectedRevision": 2},
    )
    assert reset_res.status_code == 200
    snap_reset = reset_res.json()
    assert snap_reset["revision"] == 3
    assert snap_reset["changed"] is True
    assert snap_reset["workingAssumptions"]["startingRevenueUsd"] == 750000
    assert snap_reset["changeHistory"][0]["kind"] == "reset-to-baseline"

    # 7. Reset while already at baseline is no-op (changed: false)
    reset_noop = client.post(
        "/api/v1/model/reset",
        headers={"X-Workspace-Token": token, "Idempotency-Key": "req-key-reset-noop"},
        json={"expectedRevision": 3},
    )
    assert reset_noop.status_code == 200
    assert reset_noop.json()["revision"] == 3
    assert reset_noop.json()["changed"] is False


def test_reject_booleans_in_numeric_fields(client: TestClient):
    token = make_test_token("boolean-rejection-user")
    client.post("/api/v1/session", headers={"X-Workspace-Token": token})

    # 1. Direct edit with boolean proposedValue
    res_bool_val = client.patch(
        "/api/v1/model/assumptions",
        headers={"X-Workspace-Token": token, "Idempotency-Key": "bool-val-key"},
        json={
            "expectedRevision": 1,
            "targetCellId": "setting:startingRevenueUsd",
            "proposedValue": True,
        },
    )
    assert res_bool_val.status_code == 422
    assert "error" in res_bool_val.json()

    # 2. Direct edit with boolean expectedRevision
    res_bool_rev = client.patch(
        "/api/v1/model/assumptions",
        headers={"X-Workspace-Token": token, "Idempotency-Key": "bool-rev-key"},
        json={
            "expectedRevision": True,
            "targetCellId": "setting:startingRevenueUsd",
            "proposedValue": 800000,
        },
    )
    assert res_bool_rev.status_code == 422

    # 3. Reset with boolean expectedRevision
    res_reset_bool = client.post(
        "/api/v1/model/reset",
        headers={"X-Workspace-Token": token, "Idempotency-Key": "reset-bool-key"},
        json={"expectedRevision": False},
    )
    assert res_reset_bool.status_code == 422


def test_mutation_origin_validation(client: TestClient):
    token = make_test_token("origin-val-user")
    client.post("/api/v1/session", headers={"X-Workspace-Token": token})

    # 1. Allowed origin on mutation
    res_allowed = client.patch(
        "/api/v1/model/assumptions",
        headers={
            "X-Workspace-Token": token,
            "Idempotency-Key": "orig-allowed-key",
            "Origin": "http://localhost:5173",
        },
        json={
            "expectedRevision": 1,
            "targetCellId": "setting:startingRevenueUsd",
            "proposedValue": 850000,
        },
    )
    assert res_allowed.status_code == 200

    # 2. Disallowed origin on mutation -> 403 forbidden_origin
    res_disallowed = client.patch(
        "/api/v1/model/assumptions",
        headers={
            "X-Workspace-Token": token,
            "Idempotency-Key": "orig-disallowed-key",
            "Origin": "http://evil-tracker.example.com",
        },
        json={
            "expectedRevision": 2,
            "targetCellId": "setting:startingRevenueUsd",
            "proposedValue": 860000,
        },
    )
    assert res_disallowed.status_code == 403
    assert res_disallowed.json()["error"]["code"] == "forbidden_origin"

    # 3. Absent origin on mutation -> 200 allowed
    res_absent = client.patch(
        "/api/v1/model/assumptions",
        headers={
            "X-Workspace-Token": token,
            "Idempotency-Key": "orig-absent-key",
        },
        json={
            "expectedRevision": 2,
            "targetCellId": "setting:startingRevenueUsd",
            "proposedValue": 860000,
        },
    )
    assert res_absent.status_code == 200


def test_reject_strings_in_numeric_fields(client: TestClient):
    token = make_test_token("string-rejection-user")
    client.post("/api/v1/session", headers={"X-Workspace-Token": token})

    # 1. Direct edit with numeric string proposedValue -> 422
    res_str_val = client.patch(
        "/api/v1/model/assumptions",
        headers={"X-Workspace-Token": token, "Idempotency-Key": "str-val-key"},
        json={
            "expectedRevision": 1,
            "targetCellId": "setting:startingRevenueUsd",
            "proposedValue": "820000",
        },
    )
    assert res_str_val.status_code == 422
    assert "error" in res_str_val.json()

    # 2. Direct edit with numeric string expectedRevision -> 422
    res_str_rev = client.patch(
        "/api/v1/model/assumptions",
        headers={"X-Workspace-Token": token, "Idempotency-Key": "str-rev-key"},
        json={
            "expectedRevision": "1",
            "targetCellId": "setting:startingRevenueUsd",
            "proposedValue": 820000,
        },
    )
    assert res_str_rev.status_code == 422

    # 3. Reset with numeric string expectedRevision -> 422
    res_reset_str = client.post(
        "/api/v1/model/reset",
        headers={"X-Workspace-Token": token, "Idempotency-Key": "reset-str-key"},
        json={"expectedRevision": "1"},
    )
    assert res_reset_str.status_code == 422


def test_changed_indicator_contract(client: TestClient):
    token = make_test_token("changed-contract-user")

    # 1. POST /api/v1/session init -> changed is None
    init_res = client.post("/api/v1/session", headers={"X-Workspace-Token": token})
    assert init_res.status_code == 200
    assert init_res.json()["changed"] is None

    # 2. GET /api/v1/session read -> changed is None
    get_res = client.get("/api/v1/session", headers={"X-Workspace-Token": token})
    assert get_res.status_code == 200
    assert get_res.json()["changed"] is None

    # 3. Direct edit modifying state -> changed is True
    edit_res = client.patch(
        "/api/v1/model/assumptions",
        headers={"X-Workspace-Token": token, "Idempotency-Key": "edit-changed-key"},
        json={
            "expectedRevision": 1,
            "targetCellId": "setting:startingRevenueUsd",
            "proposedValue": 850000,
        },
    )
    assert edit_res.status_code == 200
    assert edit_res.json()["changed"] is True

    # 4. Direct edit with identical value (no-op) -> changed is False
    noop_res = client.patch(
        "/api/v1/model/assumptions",
        headers={"X-Workspace-Token": token, "Idempotency-Key": "edit-noop-key"},
        json={
            "expectedRevision": 2,
            "targetCellId": "setting:startingRevenueUsd",
            "proposedValue": 850000,
        },
    )
    assert noop_res.status_code == 200
    assert noop_res.json()["changed"] is False


def test_state_version_monotonic_advancement(client: TestClient):
    token = make_test_token("state-version-user")

    # 1. Session init -> stateVersion is 1, revision is 1
    init_res = client.post("/api/v1/session", headers={"X-Workspace-Token": token})
    assert init_res.status_code == 200
    data = init_res.json()
    assert data["stateVersion"] == 1
    assert data["revision"] == 1

    # 2. Workspace generation -> stateVersion advances to 2, revision remains 1
    gen_res = client.post(
        "/api/v1/proposals",
        headers={"X-Workspace-Token": token, "Idempotency-Key": "gen-sv-key"},
        json={"templateId": "hire-engineers-from-q3", "expectedRevision": 1},
    )
    assert gen_res.status_code == 200
    gen_data = gen_res.json()
    assert gen_data["workspace"]["stateVersion"] == 2
    assert gen_data["revision"] == 1
    ws_id = gen_data["workspace"]["id"]
    orig_var_id = gen_data["workspace"]["selectedVariantId"]

    # 3. Duplicate variant -> stateVersion advances to 3, revision remains 1
    dup_res = client.post(
        f"/api/v1/proposals/{ws_id}/variants",
        headers={"X-Workspace-Token": token, "Idempotency-Key": "dup-sv-key"},
        json={"sourceVariantId": orig_var_id, "label": "Variant 2"},
    )
    assert dup_res.status_code == 200
    dup_data = dup_res.json()
    assert dup_data["stateVersion"] == 3
    var2_id = dup_data["selectedVariantId"]

    # 4. Edit variant operation -> stateVersion advances to 4, revision remains 1
    edit_var_res = client.patch(
        f"/api/v1/proposals/{ws_id}/variants/{var2_id}",
        headers={"X-Workspace-Token": token, "Idempotency-Key": "edit-var-sv-key"},
        json={"targetCellId": "assumption:engineeringFte:M07", "proposedValue": 18},
    )
    assert edit_var_res.status_code == 200
    assert edit_var_res.json()["stateVersion"] == 4

    # 5. Update selection -> stateVersion advances to 5, revision remains 1
    sel_res = client.patch(
        f"/api/v1/proposals/{ws_id}/selection",
        headers={"X-Workspace-Token": token, "Idempotency-Key": "sel-sv-key"},
        json={"selectedVariantId": orig_var_id, "comparisonVariantIds": [orig_var_id, var2_id]},
    )
    assert sel_res.status_code == 200
    assert sel_res.json()["stateVersion"] == 5

    # 6. Accept proposal -> stateVersion advances to 6, revision advances to 2
    accept_res = client.post(
        f"/api/v1/proposals/{ws_id}/accept",
        headers={"X-Workspace-Token": token, "Idempotency-Key": "acc-sv-key"},
        json={"variantId": orig_var_id, "expectedRevision": 1},
    )
    assert accept_res.status_code == 200
    accept_data = accept_res.json()
    assert accept_data["sessionSnapshot"]["stateVersion"] == 6
    assert accept_data["sessionSnapshot"]["revision"] == 2

    # 7. GET /api/v1/session -> returns current stateVersion 6 and revision 2
    snap_res = client.get("/api/v1/session", headers={"X-Workspace-Token": token})
    assert snap_res.status_code == 200
    snap_data = snap_res.json()
    assert snap_data["stateVersion"] == 6
    assert snap_data["revision"] == 2
