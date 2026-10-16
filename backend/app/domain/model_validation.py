import math
from typing import Any

from app.errors import AppException

ALLOWED_SETTING_KEYS = {
    "startingRevenueUsd",
    "startingCashUsd",
}

ALLOWED_ASSUMPTION_KEYS = {
    "revenueGrowthRate",
    "engineeringFte",
    "otherFte",
    "loadedMonthlyCostPerFteUsd",
    "otherOperatingExpenseUsd",
}

VALIDATION_RANGES = {
    "startingRevenueUsd": (0, 1_000_000_000, "usd"),
    "startingCashUsd": (0, 1_000_000_000, "usd"),
    "revenueGrowthRate": (-0.5, 0.5, "percent"),
    "engineeringFte": (0, 1000, "fte"),
    "otherFte": (0, 1000, "fte"),
    "loadedMonthlyCostPerFteUsd": (1, 100_000, "usd"),
    "otherOperatingExpenseUsd": (0, 1_000_000_000, "usd"),
}


def parse_cell_id(cell_id: str) -> tuple[str, str, int | None]:
    """
    Parses and validates a cell ID string against the whitelist.
    Returns: (target_type, target_key, period_index)
    Where target_type is 'setting' or 'assumption'.
    Raises AppException on invalid syntax, unknown keys, or calculated rows.
    """
    if not isinstance(cell_id, str):
        raise AppException(
            code="validation_error",
            message=f"Cell ID must be a string, got {type(cell_id).__name__}",
            status_code=422,
        )

    parts = cell_id.split(":")
    if parts[0] == "setting":
        if len(parts) != 2:
            raise AppException(
                code="validation_error",
                message=f"Malformed setting cell ID: {cell_id}",
                status_code=422,
            )
        key = parts[1]
        if key not in ALLOWED_SETTING_KEYS:
            raise AppException(
                code="validation_error",
                message=f"Unknown setting target key: {key}",
                status_code=422,
            )
        return "setting", key, None

    if parts[0] == "assumption":
        if len(parts) != 3:
            raise AppException(
                code="validation_error",
                message=f"Malformed assumption cell ID: {cell_id}",
                status_code=422,
            )
        key = parts[1]
        if key not in ALLOWED_ASSUMPTION_KEYS:
            raise AppException(
                code="validation_error",
                message=f"Unknown assumption target key: {key}",
                status_code=422,
            )
        month_str = parts[2]
        if not month_str.startswith("M") or len(month_str) != 3:
            raise AppException(
                code="validation_error",
                message=f"Period must be strictly zero-padded M01..M24, got: {month_str}",
                status_code=422,
            )
        try:
            period = int(month_str[1:])
        except ValueError:
            raise AppException(
                code="validation_error",
                message=f"Invalid month index in cell ID: {cell_id}",
                status_code=422,
            )
        if period < 1 or period > 24:
            raise AppException(
                code="validation_error",
                message=f"Period index must be between 1 and 24, got: {period}",
                status_code=422,
            )
        return "assumption", key, period

    if parts[0] == "calculated":
        raise AppException(
            code="validation_error",
            message=f"Calculated cells are derived and cannot be targeted for mutation: {cell_id}",
            status_code=422,
        )

    raise AppException(
        code="validation_error",
        message=f"Unsupported cell ID prefix: {parts[0]}",
        status_code=422,
    )


def validate_field_value(field_key: str, value: Any, period: int | None = None) -> float:
    """
    Validates that a numeric value is within the allowed bounds for field_key.
    Rejects booleans, None, NaN, infinities, and non-integer FTE values.
    Returns the validated value as float (or int for FTE).
    """
    # Reject boolean explicitly (in Python bool is a subclass of int)
    if isinstance(value, bool):
        raise AppException(
            code="validation_error",
            message=f"Boolean values are not allowed for numeric field {field_key}",
            status_code=422,
            details={"field": field_key, "period": period, "rejectedValue": value},
        )

    if not isinstance(value, (int, float)):
        raise AppException(
            code="validation_error",
            message=f"Field {field_key} must be a number, got {type(value).__name__}",
            status_code=422,
            details={"field": field_key, "period": period, "rejectedValue": value},
        )

    if math.isnan(value) or math.isinf(value):
        raise AppException(
            code="validation_error",
            message=f"Field {field_key} cannot be NaN or infinity",
            status_code=422,
            details={"field": field_key, "period": period, "rejectedValue": str(value)},
        )

    if field_key not in VALIDATION_RANGES:
        raise AppException(
            code="validation_error",
            message=f"Unknown field key: {field_key}",
            status_code=422,
        )

    min_val, max_val, unit = VALIDATION_RANGES[field_key]

    if unit == "fte":
        if isinstance(value, float) and not value.is_integer():
            raise AppException(
                code="validation_error",
                message=f"Field {field_key} must be an integer, got fractional: {value}",
                status_code=422,
                details={"field": field_key, "period": period, "rejectedValue": value},
            )
        value = int(value)

    if value < min_val or value > max_val:
        raise AppException(
            code="validation_error",
            message=f"Field {field_key} value {value} is out of bounds [{min_val}, {max_val}]",
            status_code=422,
            details={"field": field_key, "period": period, "rejectedValue": value},
        )

    return float(value) if unit != "fte" else int(value)


def validate_model_assumptions(assumptions: dict[str, Any]) -> None:
    """
    Validates a complete ModelAssumptions dictionary.
    Ensures starting settings and exactly 24 ordered months with valid fields.
    """
    if not isinstance(assumptions, dict):
        raise AppException(
            code="validation_error",
            message="Model assumptions must be a dictionary",
            status_code=422,
        )

    for setting_key in ALLOWED_SETTING_KEYS:
        if setting_key not in assumptions:
            raise AppException(
                code="validation_error",
                message=f"Missing required setting: {setting_key}",
                status_code=422,
            )
        validate_field_value(setting_key, assumptions[setting_key])

    months = assumptions.get("months")
    if not isinstance(months, list) or len(months) != 24:
        found_len = len(months) if isinstance(months, list) else 0
        raise AppException(
            code="validation_error",
            message=f"Model assumptions must contain exactly 24 months, found {found_len}",
            status_code=422,
        )

    for idx, month in enumerate(months):
        expected_period = idx + 1
        if not isinstance(month, dict):
            raise AppException(
                code="validation_error",
                message=f"Month at index {idx} must be a dictionary",
                status_code=422,
            )
        period_val = month.get("period")
        if period_val != expected_period:
            raise AppException(
                code="validation_error",
                message=f"Month at index {idx} has period {period_val}, expected {expected_period}",
                status_code=422,
            )
        for key in ALLOWED_ASSUMPTION_KEYS:
            if key not in month:
                raise AppException(
                    code="validation_error",
                    message=f"Month {expected_period} missing required key: {key}",
                    status_code=422,
                )
            validate_field_value(key, month[key], period=expected_period)
