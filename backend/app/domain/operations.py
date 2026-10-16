import copy
from typing import Any

from app.domain.model_validation import (
    VALIDATION_RANGES,
    parse_cell_id,
    validate_field_value,
    validate_model_assumptions,
)
from app.errors import AppException

FIELD_DISPLAY_NAMES = {
    "startingRevenueUsd": "Starting Revenue",
    "startingCashUsd": "Starting Cash",
    "revenueGrowthRate": "Revenue Growth Rate",
    "engineeringFte": "Engineering FTE",
    "otherFte": "Other FTE",
    "loadedMonthlyCostPerFteUsd": "Loaded Monthly Cost / FTE",
    "otherOperatingExpenseUsd": "Other OpEx",
}


def get_field_value(
    assumptions: dict[str, Any],
    target_type: str,
    target_key: str,
    period: int | None,
) -> float:
    if target_type == "setting":
        val = assumptions.get(target_key)
        if val is None:
            raise AppException(
                code="validation_error",
                message=f"Setting key {target_key} not found in assumptions",
                status_code=422,
            )
        return float(val)

    months = assumptions.get("months", [])
    if not period or period < 1 or period > len(months):
        raise AppException(
            code="validation_error",
            message=f"Invalid period index {period}",
            status_code=422,
        )
    month_data = months[period - 1]
    val = month_data.get(target_key)
    if val is None:
        raise AppException(
            code="validation_error",
            message=f"Assumption key {target_key} not found for period M{period:02d}",
            status_code=422,
        )
    return float(val)


def set_field_value(
    assumptions: dict[str, Any],
    target_type: str,
    target_key: str,
    period: int | None,
    value: float,
) -> None:
    if target_type == "setting":
        assumptions[target_key] = value
    else:
        if period is None or period < 1 or period > len(assumptions.get("months", [])):
            raise AppException(
                code="validation_error",
                message=f"Invalid period {period}",
                status_code=422,
            )
        assumptions["months"][period - 1][target_key] = value


def derive_operation_metadata(
    target_cell_id: str,
    proposed_value: float,
    base_assumptions: dict[str, Any],
) -> dict[str, Any]:
    target_type, target_key, period = parse_cell_id(target_cell_id)
    validated_val = validate_field_value(target_key, proposed_value, period=period)
    prev_val = get_field_value(base_assumptions, target_type, target_key, period)

    _, _, unit = VALIDATION_RANGES[target_key]
    base_label = FIELD_DISPLAY_NAMES.get(target_key, target_key)
    if period:
        change_label = f"{base_label} (M{period:02d})"
    else:
        change_label = base_label

    return {
        "targetKey": target_key,
        "targetPeriod": period,
        "targetCellId": target_cell_id,
        "previousValue": prev_val,
        "proposedValue": validated_val,
        "displayUnit": unit,
        "changeLabel": change_label,
    }


def apply_operations(
    assumptions: dict[str, Any],
    operations: list[dict[str, Any]],
    allow_empty: bool = False,
) -> dict[str, Any]:
    if not operations and not allow_empty:
        raise AppException(
            code="validation_error",
            message="Operation list cannot be empty for commit",
            status_code=422,
        )

    # Check for duplicate targets
    seen_cells: set[str] = set()
    for op in operations:
        cell_id = op.get("targetCellId")
        if not cell_id:
            raise AppException(
                code="validation_error",
                message="Operation missing targetCellId",
                status_code=422,
            )
        if cell_id in seen_cells:
            raise AppException(
                code="validation_error",
                message=f"Duplicate operation target detected: {cell_id}",
                status_code=422,
            )
        seen_cells.add(cell_id)

    # Deep copy before modifying
    updated = copy.deepcopy(assumptions)

    for op in operations:
        cell_id = op["targetCellId"]
        target_type, target_key, period = parse_cell_id(cell_id)
        raw_val = op.get("proposedValue")
        val = validate_field_value(target_key, raw_val, period=period)
        set_field_value(updated, target_type, target_key, period, val)

    # Validate complete resulting assumptions
    validate_model_assumptions(updated)

    return updated
