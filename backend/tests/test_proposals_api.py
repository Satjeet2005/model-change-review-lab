from fastapi.testclient import TestClient

from tests.conftest import make_test_token


def test_proposal_lifecycle_api(client: TestClient):
    token = make_test_token("proposal-api-user-123456789")

    # Initialize session

    init_res = client.post("/api/v1/session", headers={"X-Workspace-Token": token})
    assert init_res.status_code == 200
    assert init_res.json()["revision"] == 1

    # 1. Generate proposal workspace
    gen_res = client.post(
        "/api/v1/proposals",
        headers={"X-Workspace-Token": token, "Idempotency-Key": "req-key-gen-prop-1"},
        json={"templateId": "hire-engineers-from-q3", "expectedRevision": 1},
    )
    assert gen_res.status_code == 200
    gen_data = gen_res.json()
    assert gen_data["revision"] == 1
    ws = gen_data["workspace"]
    ws_id = ws["id"]
    assert ws["status"] == "active"
    assert ws["isStale"] is False
    assert len(ws["variants"]) == 1
    orig_variant = ws["variants"][0]
    orig_variant_id = orig_variant["id"]
    assert orig_variant["label"] == "Original proposal"
    assert len(orig_variant["operations"]) == 18

    # 2. Cannot create a second active workspace (409 active_workspace_exists)
    gen2 = client.post(
        "/api/v1/proposals",
        headers={"X-Workspace-Token": token, "Idempotency-Key": "req-key-gen-prop-2"},
        json={"templateId": "increase-growth-from-q3", "expectedRevision": 1},
    )
    assert gen2.status_code == 409
    assert gen2.json()["error"]["code"] == "active_workspace_exists"

    # 3. GET active proposal
    active_res = client.get("/api/v1/proposals/active", headers={"X-Workspace-Token": token})
    assert active_res.status_code == 200
    assert active_res.json()["id"] == ws_id

    # 4. Duplicate variant
    dup_res = client.post(
        f"/api/v1/proposals/{ws_id}/variants",
        headers={"X-Workspace-Token": token, "Idempotency-Key": "req-key-dup-var-1"},
        json={"sourceVariantId": orig_variant_id, "label": "Variant 2"},
    )
    assert dup_res.status_code == 200
    ws2 = dup_res.json()
    assert len(ws2["variants"]) == 2
    var2 = ws2["variants"][1]
    var2_id = var2["id"]
    assert var2["label"] == "Variant 2"
    assert ws2["selectedVariantId"] == var2_id

    # 5. Edit variant 2 operation value
    target_cell = "assumption:engineeringFte:M07"
    edit_res = client.patch(
        f"/api/v1/proposals/{ws_id}/variants/{var2_id}",
        headers={"X-Workspace-Token": token, "Idempotency-Key": "req-key-edit-var-1"},
        json={"targetCellId": target_cell, "proposedValue": 25},
    )
    assert edit_res.status_code == 200
    ws3 = edit_res.json()
    # Confirm variant 2 has 25, while original variant still has 16 (14+2)
    v2_updated = next(v for v in ws3["variants"] if v["id"] == var2_id)
    v1_untouched = next(v for v in ws3["variants"] if v["id"] == orig_variant_id)
    v2_op = next(op for op in v2_updated["operations"] if op["targetCellId"] == target_cell)
    v1_op = next(op for op in v1_untouched["operations"] if op["targetCellId"] == target_cell)
    assert v2_op["proposedValue"] == 25
    assert v1_op["proposedValue"] == 16

    # 6. Reset variant 2 restores reset snapshot (16)
    reset_res = client.post(
        f"/api/v1/proposals/{ws_id}/variants/{var2_id}/reset",
        headers={"X-Workspace-Token": token, "Idempotency-Key": "req-key-reset-var-1"},
    )
    assert reset_res.status_code == 200
    ws4 = reset_res.json()
    v2_reset = next(v for v in ws4["variants"] if v["id"] == var2_id)
    v2_op_reset = next(op for op in v2_reset["operations"] if op["targetCellId"] == target_cell)
    assert v2_op_reset["proposedValue"] == 16

    # 7. Original variant cannot be deleted (409 original_variant_required)
    del_orig = client.delete(
        f"/api/v1/proposals/{ws_id}/variants/{orig_variant_id}",
        headers={"X-Workspace-Token": token, "Idempotency-Key": "req-key-del-orig"},
    )
    assert del_orig.status_code == 409
    assert del_orig.json()["error"]["code"] == "original_variant_required"

    # 8. Duplicate up to 3 variants, then 4th is rejected
    dup_res3 = client.post(
        f"/api/v1/proposals/{ws_id}/variants",
        headers={"X-Workspace-Token": token, "Idempotency-Key": "req-key-dup-var-3"},
        json={"sourceVariantId": orig_variant_id, "label": "Variant 3"},
    )
    assert dup_res3.status_code == 200
    assert len(dup_res3.json()["variants"]) == 3

    dup_res4 = client.post(
        f"/api/v1/proposals/{ws_id}/variants",
        headers={"X-Workspace-Token": token, "Idempotency-Key": "req-key-dup-var-4"},
        json={"sourceVariantId": orig_variant_id, "label": "Variant 4"},
    )
    assert dup_res4.status_code == 409
    assert dup_res4.json()["error"]["code"] == "variant_limit_reached"

    # 9. Update selection and comparison
    var3_id = dup_res3.json()["variants"][2]["id"]
    sel_res = client.patch(
        f"/api/v1/proposals/{ws_id}/selection",
        headers={"X-Workspace-Token": token, "Idempotency-Key": "req-key-sel-1"},
        json={
            "selectedVariantId": orig_variant_id,
            "comparisonVariantIds": [orig_variant_id, var3_id],
        },
    )
    assert sel_res.status_code == 200
    ws_sel = sel_res.json()
    assert ws_sel["selectedVariantId"] == orig_variant_id
    assert ws_sel["comparisonVariantIds"] == [orig_variant_id, var3_id]

    # 10. Reject workspace closes workspace
    rej_res = client.post(
        f"/api/v1/proposals/{ws_id}/reject",
        headers={"X-Workspace-Token": token, "Idempotency-Key": "req-key-rej-1"},
    )
    assert rej_res.status_code == 200
    assert rej_res.json()["status"] == "rejected"

    # Check active workspace is now None
    active_after = client.get("/api/v1/proposals/active", headers={"X-Workspace-Token": token})
    assert active_after.json() is None
