from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel
from pydantic.functional_validators import BeforeValidator


def validate_strict_number(v: Any) -> float:
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        raise ValueError(
            "Value must be a numeric JSON number (int or float), not boolean or string"
        )
    return float(v)


def validate_strict_integer(v: Any) -> int:
    if isinstance(v, bool) or not isinstance(v, int):
        raise ValueError("Value must be a JSON integer, not boolean, float, or string")
    return v


StrictNumber = Annotated[float, BeforeValidator(validate_strict_number)]
StrictInteger = Annotated[int, BeforeValidator(validate_strict_integer)]

TemplateIdType = Literal[
    "hire-engineers-from-q3",
    "increase-growth-from-q3",
    "reduce-opex-from-m04",
]

WorkspaceStatusType = Literal[
    "active",
    "accepted",
    "rejected",
    "archived",
    "dismissed",
]

TransactionKindType = Literal[
    "manual-edit",
    "proposal-accepted",
    "reset-to-baseline",
    "undo",
]


class BaseCamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class MonthAssumptionsSchema(BaseCamelModel):
    period: StrictInteger = Field(ge=1, le=24)
    revenue_growth_rate: StrictNumber
    engineering_fte: StrictInteger
    other_fte: StrictInteger
    loaded_monthly_cost_per_fte_usd: StrictNumber
    other_operating_expense_usd: StrictNumber


class ModelAssumptionsSchema(BaseCamelModel):
    starting_revenue_usd: StrictNumber
    starting_cash_usd: StrictNumber
    months: list[MonthAssumptionsSchema]


class ProposalOperationSchema(BaseCamelModel):
    target_key: str
    target_period: StrictInteger | None = None
    target_cell_id: str
    previous_value: StrictNumber
    proposed_value: StrictNumber
    display_unit: Literal["usd", "fte", "percent"]
    change_label: str


class ProposalVariantSchema(BaseCamelModel):
    id: str
    label: str
    source_template_id: TemplateIdType
    duplicated_from_variant_id: str | None = None
    operations: list[ProposalOperationSchema]
    reset_snapshot_operations: list[ProposalOperationSchema]
    created_at: str


class ProposalWorkspaceSchema(BaseCamelModel):
    id: str
    base_revision: int
    base_assumptions: ModelAssumptionsSchema
    source_template_id: TemplateIdType
    title: str
    description: str
    variants: list[ProposalVariantSchema]
    selected_variant_id: str
    comparison_variant_ids: list[str]
    created_at: str
    status: WorkspaceStatusType
    is_stale: bool
    state_version: int = 1


class TransactionProvenanceSchema(BaseCamelModel):
    proposal_workspace_id: str
    variant_id: str
    variant_label: str
    source_template_id: TemplateIdType
    base_revision: int


class TransactionRecordSchema(BaseCamelModel):
    id: str
    timestamp: str
    kind: TransactionKindType
    description: str
    affected_cell_ids: list[str]
    previous_assumptions: ModelAssumptionsSchema
    new_assumptions: ModelAssumptionsSchema
    resulting_revision: int
    provenance: TransactionProvenanceSchema | None = None
    undoes_transaction_id: str | None = None
    undone_by_transaction_id: str | None = None


class SessionSnapshotResponse(BaseCamelModel):
    session_id: str
    session_reset_because_expired: bool | None = None
    baseline_assumptions: ModelAssumptionsSchema
    working_assumptions: ModelAssumptionsSchema
    revision: int
    state_version: int = 1
    active_workspace: ProposalWorkspaceSchema | None = None
    archived_workspaces: list[ProposalWorkspaceSchema] = Field(default_factory=list)
    change_history: list[TransactionRecordSchema] = Field(default_factory=list)
    can_undo: bool = False
    changed: bool | None = None


class ModelResponse(BaseCamelModel):
    baseline_assumptions: ModelAssumptionsSchema
    working_assumptions: ModelAssumptionsSchema
    revision: int


class DirectEditRequest(BaseCamelModel):
    expected_revision: StrictInteger
    target_cell_id: str
    proposed_value: StrictNumber


class ResetModelRequest(BaseCamelModel):
    expected_revision: StrictInteger


class GenerateProposalRequest(BaseCamelModel):
    template_id: TemplateIdType
    expected_revision: StrictInteger


class GenerateProposalResponse(BaseCamelModel):
    workspace: ProposalWorkspaceSchema
    revision: int


class DuplicateVariantRequest(BaseCamelModel):
    source_variant_id: str
    label: str = Field(min_length=1, max_length=40)


class EditVariantOperationRequest(BaseCamelModel):
    target_cell_id: str
    proposed_value: StrictNumber


class UpdateSelectionRequest(BaseCamelModel):
    selected_variant_id: str
    comparison_variant_ids: list[str]


class AcceptProposalRequest(BaseCamelModel):
    variant_id: str
    expected_revision: StrictInteger


class AcceptProposalResponse(BaseCamelModel):
    session_snapshot: SessionSnapshotResponse
    accepted_workspace_id: str
    accepted_variant_id: str


class UndoRequest(BaseCamelModel):
    expected_revision: StrictInteger


class HistoryResponse(BaseCamelModel):
    items: list[TransactionRecordSchema]
    limit: int
    offset: int
    total: int
    can_undo: bool


class CloseWorkspaceResponse(BaseCamelModel):
    status: str
    workspace_id: str
    state_version: int
