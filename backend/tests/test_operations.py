import copy

import pytest

from app.domain.operations import (
    apply_operations,
    derive_operation_metadata,
)
from app.domain.proposal_generator import generate_preset_operations
from app.errors import AppException
from app.services.session_service import load_seed_assumptions


def test_derive_operation_metadata():
    seed = load_seed_assumptions()
    op = derive_operation_metadata("assumption:engineeringFte:M07", 16, seed)
    assert op["targetKey"] == "engineeringFte"
    assert op["targetPeriod"] == 7
    assert op["targetCellId"] == "assumption:engineeringFte:M07"
    assert op["previousValue"] == 14  # seed M07 FTE is 14
    assert op["proposedValue"] == 16
    assert op["displayUnit"] == "fte"
    assert op["changeLabel"] == "Engineering FTE (M07)"


def test_apply_operations_pure_immutability():
    seed = load_seed_assumptions()
    seed_copy = copy.deepcopy(seed)

    ops = [
        {"targetCellId": "assumption:engineeringFte:M07", "proposedValue": 20},
        {"targetCellId": "assumption:engineeringFte:M08", "proposedValue": 22},
    ]

    res = apply_operations(seed, ops)
    # Check that original seed was NOT mutated
    assert seed == seed_copy
    # Check that res contains the new values
    assert res["months"][6]["engineeringFte"] == 20
    assert res["months"][7]["engineeringFte"] == 22


def test_apply_operations_rejects_empty():
    seed = load_seed_assumptions()
    with pytest.raises(AppException) as exc:
        apply_operations(seed, [], allow_empty=False)
    assert exc.value.code == "validation_error"


def test_apply_operations_rejects_duplicate_targets():
    seed = load_seed_assumptions()
    ops = [
        {"targetCellId": "assumption:engineeringFte:M07", "proposedValue": 20},
        {"targetCellId": "assumption:engineeringFte:M07", "proposedValue": 22},
    ]
    with pytest.raises(AppException) as exc:
        apply_operations(seed, ops)
    assert exc.value.code == "validation_error"
    assert "Duplicate operation target" in exc.value.message


def test_apply_operations_fails_cleanly_on_invalid():
    seed = load_seed_assumptions()
    seed_copy = copy.deepcopy(seed)

    ops = [
        {"targetCellId": "assumption:engineeringFte:M07", "proposedValue": 20},
        {"targetCellId": "assumption:engineeringFte:M08", "proposedValue": 99999},  # Out of range!
    ]

    with pytest.raises(AppException):
        apply_operations(seed, ops)

    assert seed == seed_copy


def test_preset_generator_counts_and_targets():
    seed = load_seed_assumptions()

    # 1. hire-engineers-from-q3: 18 ops (M07..M24), +2 FTE
    title1, desc1, ops1 = generate_preset_operations("hire-engineers-from-q3", seed)
    assert len(ops1) == 18
    assert ops1[0]["targetCellId"] == "assumption:engineeringFte:M07"
    assert ops1[-1]["targetCellId"] == "assumption:engineeringFte:M24"
    assert ops1[0]["proposedValue"] == ops1[0]["previousValue"] + 2

    # 2. increase-growth-from-q3: 18 ops (M07..M24), +0.01
    title2, desc2, ops2 = generate_preset_operations("increase-growth-from-q3", seed)
    assert len(ops2) == 18
    assert ops2[0]["targetCellId"] == "assumption:revenueGrowthRate:M07"
    assert ops2[-1]["targetCellId"] == "assumption:revenueGrowthRate:M24"
    assert ops2[0]["proposedValue"] == round(ops2[0]["previousValue"] + 0.01, 4)

    # 3. reduce-opex-from-m04: 21 ops (M04..M24), 92% of base
    title3, desc3, ops3 = generate_preset_operations("reduce-opex-from-m04", seed)
    assert len(ops3) == 21
    assert ops3[0]["targetCellId"] == "assumption:otherOperatingExpenseUsd:M04"
    assert ops3[-1]["targetCellId"] == "assumption:otherOperatingExpenseUsd:M24"
    assert ops3[0]["proposedValue"] == round(ops3[0]["previousValue"] * 0.92, 2)
