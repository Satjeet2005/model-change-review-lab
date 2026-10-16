from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from app.domain.model_validation import validate_field_value
from app.errors import AppException


def round_money(val: float) -> float:
    # Half-up rounding for non-negative values matching JS Math.round / roundMoney
    d = Decimal(str(val))
    return float(d.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


PRESET_METADATA = {
    "hire-engineers-from-q3": {
        "title": "Hire 2 Engineers from Q3",
        "description": (
            "Increase engineering headcount by 2 FTE starting in month 7 through month 24."
        ),
    },
    "increase-growth-from-q3": {
        "title": "Accelerate Revenue Growth from Q3",
        "description": "Boost monthly revenue growth rate by +1.0% from month 7 through month 24.",
    },
    "reduce-opex-from-m04": {
        "title": "Reduce Other Operating Expense from M04",
        "description": (
            "Reduce non-payroll operating expenses by 8% starting in month 4 through month 24."
        ),
    },
}


def generate_preset_operations(
    template_id: str,
    base_assumptions: dict[str, Any],
) -> tuple[str, str, list[dict[str, Any]]]:
    if template_id not in PRESET_METADATA:
        raise AppException(
            code="validation_error",
            message=f"Unknown proposal template ID: {template_id}",
            status_code=422,
        )

    meta = PRESET_METADATA[template_id]
    title = meta["title"]
    description = meta["description"]
    months = base_assumptions.get("months", [])
    if len(months) != 24:
        raise AppException(
            code="validation_error",
            message="Base assumptions must contain 24 months to generate proposals",
            status_code=422,
        )

    operations: list[dict[str, Any]] = []

    if template_id == "hire-engineers-from-q3":
        for p in range(7, 25):
            month_data = months[p - 1]
            prev_val = month_data["engineeringFte"]
            proposed_val = prev_val + 2
            m_str = f"M{p:02d}"
            cell_id = f"assumption:engineeringFte:{m_str}"
            try:
                val = validate_field_value("engineeringFte", proposed_val, period=p)
            except AppException as e:
                msg = (
                    f"Preset {template_id} generated invalid FTE value {proposed_val} "
                    f"for {m_str}: {e.message}"
                )
                raise AppException(
                    code="proposal_generation_invalid",
                    message=msg,
                    status_code=422,
                ) from e

            operations.append(
                {
                    "targetKey": "engineeringFte",
                    "targetPeriod": p,
                    "targetCellId": cell_id,
                    "previousValue": float(prev_val),
                    "proposedValue": float(val),
                    "displayUnit": "fte",
                    "changeLabel": f"+2 Engineering FTE ({m_str})",
                }
            )

    elif template_id == "increase-growth-from-q3":
        for p in range(7, 25):
            month_data = months[p - 1]
            prev_val = month_data["revenueGrowthRate"]
            proposed_val = round(prev_val + 0.01, 4)
            m_str = f"M{p:02d}"
            cell_id = f"assumption:revenueGrowthRate:{m_str}"
            try:
                val = validate_field_value("revenueGrowthRate", proposed_val, period=p)
            except AppException as e:
                msg = (
                    f"Preset {template_id} generated invalid growth rate {proposed_val} "
                    f"for {m_str}: {e.message}"
                )
                raise AppException(
                    code="proposal_generation_invalid",
                    message=msg,
                    status_code=422,
                ) from e

            operations.append(
                {
                    "targetKey": "revenueGrowthRate",
                    "targetPeriod": p,
                    "targetCellId": cell_id,
                    "previousValue": float(prev_val),
                    "proposedValue": float(val),
                    "displayUnit": "percent",
                    "changeLabel": f"+1.0% Revenue Growth ({m_str})",
                }
            )

    elif template_id == "reduce-opex-from-m04":
        for p in range(4, 25):
            month_data = months[p - 1]
            prev_val = month_data["otherOperatingExpenseUsd"]
            proposed_val = round_money(prev_val * 0.92)
            m_str = f"M{p:02d}"
            cell_id = f"assumption:otherOperatingExpenseUsd:{m_str}"
            try:
                val = validate_field_value("otherOperatingExpenseUsd", proposed_val, period=p)
            except AppException as e:
                msg = (
                    f"Preset {template_id} generated invalid OpEx {proposed_val} "
                    f"for {m_str}: {e.message}"
                )
                raise AppException(
                    code="proposal_generation_invalid",
                    message=msg,
                    status_code=422,
                ) from e

            operations.append(
                {
                    "targetKey": "otherOperatingExpenseUsd",
                    "targetPeriod": p,
                    "targetCellId": cell_id,
                    "previousValue": float(prev_val),
                    "proposedValue": float(val),
                    "displayUnit": "usd",
                    "changeLabel": f"-8% Other OpEx ({m_str})",
                }
            )

    return title, description, operations
