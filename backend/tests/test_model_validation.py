import pytest

from app.domain.model_validation import (
    parse_cell_id,
    validate_field_value,
    validate_model_assumptions,
)
from app.errors import AppException
from app.services.session_service import load_seed_assumptions


def test_parse_cell_id_valid_settings():
    assert parse_cell_id("setting:startingRevenueUsd") == ("setting", "startingRevenueUsd", None)
    assert parse_cell_id("setting:startingCashUsd") == ("setting", "startingCashUsd", None)


def test_parse_cell_id_valid_assumptions():
    for p in range(1, 25):
        m_str = f"M{p:02d}"
        assert parse_cell_id(f"assumption:engineeringFte:{m_str}") == (
            "assumption",
            "engineeringFte",
            p,
        )
        assert parse_cell_id(f"assumption:revenueGrowthRate:{m_str}") == (
            "assumption",
            "revenueGrowthRate",
            p,
        )
        assert parse_cell_id(f"assumption:otherFte:{m_str}") == ("assumption", "otherFte", p)

        assert parse_cell_id(f"assumption:loadedMonthlyCostPerFteUsd:{m_str}") == (
            "assumption",
            "loadedMonthlyCostPerFteUsd",
            p,
        )
        assert parse_cell_id(f"assumption:otherOperatingExpenseUsd:{m_str}") == (
            "assumption",
            "otherOperatingExpenseUsd",
            p,
        )


def test_parse_cell_id_rejects_invalid():
    # Calculated cells rejected
    with pytest.raises(AppException) as exc:
        parse_cell_id("calculated:revenue:M01")
    assert exc.value.code == "validation_error"

    # Malformed / out of range periods
    with pytest.raises(AppException):
        parse_cell_id("assumption:engineeringFte:M00")
    with pytest.raises(AppException):
        parse_cell_id("assumption:engineeringFte:M25")
    with pytest.raises(AppException):
        parse_cell_id("assumption:engineeringFte:M7")  # non-zero-padded
    with pytest.raises(AppException):
        parse_cell_id("setting:startingRevenueUsd:extra")
    with pytest.raises(AppException):
        parse_cell_id("unknown:startingRevenueUsd")


def test_validate_field_boundaries():
    # startingRevenueUsd in [0, 1_000_000_000]
    assert validate_field_value("startingRevenueUsd", 0) == 0.0
    assert validate_field_value("startingRevenueUsd", 1_000_000_000) == 1_000_000_000.0
    with pytest.raises(AppException):
        validate_field_value("startingRevenueUsd", -1)
    with pytest.raises(AppException):
        validate_field_value("startingRevenueUsd", 1_000_000_001)

    # revenueGrowthRate in [-0.5, 0.5]
    assert validate_field_value("revenueGrowthRate", -0.5) == -0.5
    assert validate_field_value("revenueGrowthRate", 0.5) == 0.5
    with pytest.raises(AppException):
        validate_field_value("revenueGrowthRate", -0.5001)
    with pytest.raises(AppException):
        validate_field_value("revenueGrowthRate", 0.5001)

    # engineeringFte integer in [0, 1000]
    assert validate_field_value("engineeringFte", 0) == 0
    assert validate_field_value("engineeringFte", 1000) == 1000
    with pytest.raises(AppException):
        validate_field_value("engineeringFte", 12.5)  # reject fractional
    with pytest.raises(AppException):
        validate_field_value("engineeringFte", -1)
    with pytest.raises(AppException):
        validate_field_value("engineeringFte", 1001)

    # loadedMonthlyCostPerFteUsd in [1, 100_000]
    assert validate_field_value("loadedMonthlyCostPerFteUsd", 1) == 1.0
    assert validate_field_value("loadedMonthlyCostPerFteUsd", 100_000) == 100_000.0
    with pytest.raises(AppException):
        validate_field_value("loadedMonthlyCostPerFteUsd", 0)
    with pytest.raises(AppException):
        validate_field_value("loadedMonthlyCostPerFteUsd", 100_001)


def test_validate_field_rejects_booleans_nan_inf():
    # In Python, isinstance(True, int) is True, but booleans must be strictly rejected
    with pytest.raises(AppException):
        validate_field_value("startingRevenueUsd", True)
    with pytest.raises(AppException):
        validate_field_value("engineeringFte", False)
    with pytest.raises(AppException):
        validate_field_value("revenueGrowthRate", float("nan"))
    with pytest.raises(AppException):
        validate_field_value("revenueGrowthRate", float("inf"))
    with pytest.raises(AppException):
        validate_field_value("revenueGrowthRate", float("-inf"))
    with pytest.raises(AppException):
        validate_field_value("revenueGrowthRate", None)


def test_validate_model_assumptions_seed_is_valid():
    seed = load_seed_assumptions()
    # Must not raise
    validate_model_assumptions(seed)


def test_validate_model_assumptions_rejects_invalid():
    seed = load_seed_assumptions()

    # Reject missing months
    bad_months = list(seed["months"][:-1])
    with pytest.raises(AppException):
        validate_model_assumptions({**seed, "months": bad_months})

    # Reject out of order months
    reversed_months = list(reversed(seed["months"]))
    with pytest.raises(AppException):
        validate_model_assumptions({**seed, "months": reversed_months})

    # Reject missing setting
    no_rev = dict(seed)
    del no_rev["startingRevenueUsd"]
    with pytest.raises(AppException):
        validate_model_assumptions(no_rev)
