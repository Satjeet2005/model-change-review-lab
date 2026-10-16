import copy
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import desc, select
from sqlalchemy.orm import Session, selectinload

from app.domain.operations import apply_operations, derive_operation_metadata
from app.domain.proposal_generator import generate_preset_operations
from app.errors import AppException
from app.models import DemoSession, ProposalVariant, ProposalWorkspace
from app.schemas import GenerateProposalResponse, ProposalWorkspaceSchema
from app.services.idempotency import (
    check_idempotency_replay,
    compute_request_hash,
    record_idempotency,
)
from app.services.session_service import serialize_workspace


def get_locked_session(db: Session, session_id: uuid.UUID) -> DemoSession:
    stmt = (
        select(DemoSession)
        .where(DemoSession.id == session_id)
        .execution_options(populate_existing=True)
        .with_for_update()
    )
    session = db.scalar(stmt)
    if not session:
        raise AppException(
            code="invalid_workspace_token",
            message="Session not found",
            status_code=401,
        )
    return session


def generate_proposal_workspace(
    db: Session,
    session_id: uuid.UUID,
    template_id: str,
    expected_revision: int,
    idempotency_key: str,
    method: str,
    path: str,
    request_data: Any,
) -> GenerateProposalResponse:
    session = get_locked_session(db, session_id)

    request_hash = compute_request_hash(request_data)
    replay = check_idempotency_replay(db, session_id, idempotency_key, method, path, request_hash)
    if replay:
        status_code, body = replay
        return GenerateProposalResponse.model_validate(body)

    if session.revision != expected_revision:
        raise AppException(
            code="revision_conflict",
            message="The model changed since proposal was requested.",
            status_code=409,
            details={"expectedRevision": expected_revision, "currentRevision": session.revision},
        )

    # Check for existing active workspace
    active_stmt = select(ProposalWorkspace.id).where(
        ProposalWorkspace.session_id == session.id,
        ProposalWorkspace.status == "active",
    )
    if db.scalar(active_stmt) is not None:
        raise AppException(
            code="active_workspace_exists",
            message="An active proposal workspace already exists in this session.",
            status_code=409,
        )

    # Generate preset operations
    title, desc_text, operations = generate_preset_operations(
        template_id, session.working_assumptions
    )

    now = datetime.now(timezone.utc)
    ws_id = uuid.uuid4()
    variant_id = uuid.uuid4()

    variant = ProposalVariant(
        id=variant_id,
        workspace_id=ws_id,
        label="Original proposal",
        source_template_id=template_id,
        duplicated_from_variant_id=None,
        operations=operations,
        reset_snapshot_operations=copy.deepcopy(operations),
        created_at=now,
        updated_at=now,
        is_original=True,
    )

    workspace = ProposalWorkspace(
        id=ws_id,
        session_id=session.id,
        source_template_id=template_id,
        title=title,
        description=desc_text,
        base_revision=session.revision,
        base_assumptions=copy.deepcopy(session.working_assumptions),
        status="active",
        selected_variant_id=variant_id,
        comparison_variant_ids=[str(variant_id)],
        accepted_variant_id=None,
        created_at=now,
        updated_at=now,
        closed_at=None,
    )
    workspace.variants.append(variant)

    session.state_version += 1
    session.updated_at = now
    db.add(workspace)

    ws_dto = serialize_workspace(workspace, session.revision, session.state_version)
    resp = GenerateProposalResponse(workspace=ws_dto, revision=session.revision)
    resp_dict = resp.model_dump(by_alias=True)

    record_idempotency(db, session_id, idempotency_key, method, path, request_hash, 200, resp_dict)
    db.commit()

    return resp


def get_active_workspace(db: Session, session: DemoSession) -> ProposalWorkspaceSchema | None:
    stmt = (
        select(ProposalWorkspace)
        .options(selectinload(ProposalWorkspace.variants))
        .where(
            ProposalWorkspace.session_id == session.id,
            ProposalWorkspace.status == "active",
        )
    )
    ws = db.scalar(stmt)
    if not ws:
        return None
    return serialize_workspace(ws, session.revision, session.state_version)


def list_archived_workspaces(
    db: Session, session: DemoSession, limit: int = 20
) -> list[ProposalWorkspaceSchema]:
    if limit < 1 or limit > 100:
        raise AppException(
            code="invalid_request",
            message="Limit must be between 1 and 100",
            status_code=400,
        )
    stmt = (
        select(ProposalWorkspace)
        .options(selectinload(ProposalWorkspace.variants))
        .where(
            ProposalWorkspace.session_id == session.id,
            ProposalWorkspace.status == "archived",
        )
        .order_by(desc(ProposalWorkspace.created_at))
        .limit(limit)
    )
    workspaces = db.scalars(stmt).unique().all()
    return [serialize_workspace(ws, session.revision, session.state_version) for ws in workspaces]


def get_workspace_by_id(
    db: Session, session: DemoSession, workspace_id: uuid.UUID
) -> ProposalWorkspaceSchema:
    stmt = (
        select(ProposalWorkspace)
        .options(selectinload(ProposalWorkspace.variants))
        .where(
            ProposalWorkspace.id == workspace_id,
            ProposalWorkspace.session_id == session.id,
        )
    )
    ws = db.scalar(stmt)
    if not ws:
        raise AppException(
            code="resource_not_found",
            message=f"Workspace {workspace_id} not found",
            status_code=404,
        )
    return serialize_workspace(ws, session.revision, session.state_version)


def duplicate_variant(
    db: Session,
    session_id: uuid.UUID,
    workspace_id: uuid.UUID,
    source_variant_id: uuid.UUID,
    label: str,
    idempotency_key: str,
    method: str,
    path: str,
    request_data: Any,
) -> ProposalWorkspaceSchema:
    session = get_locked_session(db, session_id)

    request_hash = compute_request_hash(request_data)
    replay = check_idempotency_replay(db, session_id, idempotency_key, method, path, request_hash)
    if replay:
        status_code, body = replay
        return ProposalWorkspaceSchema.model_validate(body)

    ws_stmt = (
        select(ProposalWorkspace)
        .options(selectinload(ProposalWorkspace.variants))
        .where(
            ProposalWorkspace.id == workspace_id,
            ProposalWorkspace.session_id == session.id,
        )
        .with_for_update()
    )
    workspace = db.scalar(ws_stmt)
    if not workspace:
        raise AppException(
            code="resource_not_found",
            message=f"Workspace {workspace_id} not found",
            status_code=404,
        )
    if workspace.status != "active":
        raise AppException(
            code="workspace_not_active",
            message="Workspace is not active",
            status_code=409,
        )
    if workspace.base_revision != session.revision:
        raise AppException(
            code="stale_proposal",
            message="Cannot mutate a variant on a stale proposal workspace.",
            status_code=409,
        )

    if len(workspace.variants) >= 3:
        raise AppException(
            code="variant_limit_reached",
            message="Maximum of 3 variants allowed per workspace.",
            status_code=409,
        )

    source_variant = next((v for v in workspace.variants if v.id == source_variant_id), None)
    if not source_variant:
        raise AppException(
            code="resource_not_found",
            message=f"Source variant {source_variant_id} not found in workspace",
            status_code=404,
        )

    cleaned_label = label.strip()
    if not cleaned_label or len(cleaned_label) > 40:
        raise AppException(
            code="validation_error",
            message="Variant label must be 1 to 40 characters.",
            status_code=422,
        )

    if any(v.label.lower() == cleaned_label.lower() for v in workspace.variants):
        raise AppException(
            code="validation_error",
            message=f"Variant label '{cleaned_label}' is already used in this workspace.",
            status_code=422,
        )

    now = datetime.now(timezone.utc)
    new_variant_id = uuid.uuid4()
    new_ops = copy.deepcopy(source_variant.operations)

    new_variant = ProposalVariant(
        id=new_variant_id,
        workspace_id=workspace.id,
        label=cleaned_label,
        source_template_id=workspace.source_template_id,
        duplicated_from_variant_id=source_variant.id,
        operations=new_ops,
        reset_snapshot_operations=copy.deepcopy(new_ops),
        created_at=now,
        updated_at=now,
        is_original=False,
    )

    workspace.variants.append(new_variant)
    workspace.selected_variant_id = new_variant_id
    workspace.updated_at = now
    session.state_version += 1
    session.updated_at = now

    dto = serialize_workspace(workspace, session.revision, session.state_version)
    resp_dict = dto.model_dump(by_alias=True)

    record_idempotency(db, session_id, idempotency_key, method, path, request_hash, 200, resp_dict)
    db.commit()

    return dto


def edit_variant_operation(
    db: Session,
    session_id: uuid.UUID,
    workspace_id: uuid.UUID,
    variant_id: uuid.UUID,
    target_cell_id: str,
    proposed_value: float,
    idempotency_key: str,
    method: str,
    path: str,
    request_data: Any,
) -> ProposalWorkspaceSchema:
    session = get_locked_session(db, session_id)

    request_hash = compute_request_hash(request_data)
    replay = check_idempotency_replay(db, session_id, idempotency_key, method, path, request_hash)
    if replay:
        status_code, body = replay
        return ProposalWorkspaceSchema.model_validate(body)

    ws_stmt = (
        select(ProposalWorkspace)
        .options(selectinload(ProposalWorkspace.variants))
        .where(
            ProposalWorkspace.id == workspace_id,
            ProposalWorkspace.session_id == session.id,
        )
        .with_for_update()
    )
    workspace = db.scalar(ws_stmt)
    if not workspace:
        raise AppException(
            code="resource_not_found",
            message=f"Workspace {workspace_id} not found",
            status_code=404,
        )
    if workspace.status != "active":
        raise AppException(
            code="workspace_not_active",
            message="Workspace is not active",
            status_code=409,
        )
    if workspace.base_revision != session.revision:
        raise AppException(
            code="stale_proposal",
            message="Cannot edit variant operations on a stale proposal workspace.",
            status_code=409,
        )

    variant = next((v for v in workspace.variants if v.id == variant_id), None)
    if not variant:
        raise AppException(
            code="resource_not_found",
            message=f"Variant {variant_id} not found in workspace",
            status_code=404,
        )

    op_idx = next(
        (i for i, op in enumerate(variant.operations) if op.get("targetCellId") == target_cell_id),
        None,
    )
    if op_idx is None:
        raise AppException(
            code="validation_error",
            message=f"Target cell {target_cell_id} is not part of this proposal variant.",
            status_code=422,
        )

    # Derive canonical metadata from workspace base assumptions
    updated_op = derive_operation_metadata(
        target_cell_id, proposed_value, workspace.base_assumptions
    )

    new_ops = copy.deepcopy(variant.operations)
    new_ops[op_idx] = updated_op

    # Validate resulting model by applying ops to base assumptions copy
    apply_operations(workspace.base_assumptions, new_ops)

    variant.operations = new_ops
    variant.updated_at = datetime.now(timezone.utc)
    workspace.updated_at = datetime.now(timezone.utc)
    session.state_version += 1
    session.updated_at = datetime.now(timezone.utc)

    dto = serialize_workspace(workspace, session.revision, session.state_version)
    resp_dict = dto.model_dump(by_alias=True)

    record_idempotency(db, session_id, idempotency_key, method, path, request_hash, 200, resp_dict)
    db.commit()

    return dto


def reset_variant(
    db: Session,
    session_id: uuid.UUID,
    workspace_id: uuid.UUID,
    variant_id: uuid.UUID,
    idempotency_key: str,
    method: str,
    path: str,
    request_data: Any,
) -> ProposalWorkspaceSchema:
    session = get_locked_session(db, session_id)

    request_hash = compute_request_hash(request_data)
    replay = check_idempotency_replay(db, session_id, idempotency_key, method, path, request_hash)
    if replay:
        status_code, body = replay
        return ProposalWorkspaceSchema.model_validate(body)

    ws_stmt = (
        select(ProposalWorkspace)
        .options(selectinload(ProposalWorkspace.variants))
        .where(
            ProposalWorkspace.id == workspace_id,
            ProposalWorkspace.session_id == session.id,
        )
        .with_for_update()
    )
    workspace = db.scalar(ws_stmt)
    if not workspace:
        raise AppException(
            code="resource_not_found",
            message=f"Workspace {workspace_id} not found",
            status_code=404,
        )
    if workspace.status != "active":
        raise AppException(
            code="workspace_not_active",
            message="Workspace is not active",
            status_code=409,
        )
    if workspace.base_revision != session.revision:
        raise AppException(
            code="stale_proposal",
            message="Cannot reset variant on a stale proposal workspace.",
            status_code=409,
        )

    variant = next((v for v in workspace.variants if v.id == variant_id), None)
    if not variant:
        raise AppException(
            code="resource_not_found",
            message=f"Variant {variant_id} not found in workspace",
            status_code=404,
        )

    variant.operations = copy.deepcopy(variant.reset_snapshot_operations)
    variant.updated_at = datetime.now(timezone.utc)
    workspace.updated_at = datetime.now(timezone.utc)
    session.state_version += 1
    session.updated_at = datetime.now(timezone.utc)

    dto = serialize_workspace(workspace, session.revision, session.state_version)
    resp_dict = dto.model_dump(by_alias=True)

    record_idempotency(db, session_id, idempotency_key, method, path, request_hash, 200, resp_dict)
    db.commit()

    return dto


def remove_variant(
    db: Session,
    session_id: uuid.UUID,
    workspace_id: uuid.UUID,
    variant_id: uuid.UUID,
    idempotency_key: str,
    method: str,
    path: str,
    request_data: Any,
) -> ProposalWorkspaceSchema:
    session = get_locked_session(db, session_id)

    request_hash = compute_request_hash(request_data)
    replay = check_idempotency_replay(db, session_id, idempotency_key, method, path, request_hash)
    if replay:
        status_code, body = replay
        return ProposalWorkspaceSchema.model_validate(body)

    ws_stmt = (
        select(ProposalWorkspace)
        .options(selectinload(ProposalWorkspace.variants))
        .where(
            ProposalWorkspace.id == workspace_id,
            ProposalWorkspace.session_id == session.id,
        )
        .with_for_update()
    )
    workspace = db.scalar(ws_stmt)
    if not workspace:
        raise AppException(
            code="resource_not_found",
            message=f"Workspace {workspace_id} not found",
            status_code=404,
        )
    if workspace.status != "active":
        raise AppException(
            code="workspace_not_active",
            message="Workspace is not active",
            status_code=409,
        )
    if workspace.base_revision != session.revision:
        raise AppException(
            code="stale_proposal",
            message="Cannot remove variant on a stale proposal workspace.",
            status_code=409,
        )

    if len(workspace.variants) <= 1:
        raise AppException(
            code="last_variant_required",
            message="A workspace must contain at least one variant.",
            status_code=409,
        )

    variant = next((v for v in workspace.variants if v.id == variant_id), None)
    if not variant:
        raise AppException(
            code="resource_not_found",
            message=f"Variant {variant_id} not found in workspace",
            status_code=404,
        )
    if variant.is_original:
        raise AppException(
            code="original_variant_required",
            message="The original proposal variant cannot be removed.",
            status_code=409,
        )

    db.delete(variant)
    workspace.variants.remove(variant)

    # Adjust selected variant if deleted
    if workspace.selected_variant_id == variant_id:
        workspace.selected_variant_id = workspace.variants[0].id

    # Adjust comparison variants
    str_var_id = str(variant_id)
    comp_ids = [vid for vid in workspace.comparison_variant_ids if vid != str_var_id]
    if not comp_ids:
        comp_ids = [str(workspace.selected_variant_id)]
    workspace.comparison_variant_ids = comp_ids
    workspace.updated_at = datetime.now(timezone.utc)
    session.state_version += 1
    session.updated_at = datetime.now(timezone.utc)

    dto = serialize_workspace(workspace, session.revision, session.state_version)
    resp_dict = dto.model_dump(by_alias=True)

    record_idempotency(db, session_id, idempotency_key, method, path, request_hash, 200, resp_dict)
    db.commit()

    return dto


def update_selection(
    db: Session,
    session_id: uuid.UUID,
    workspace_id: uuid.UUID,
    selected_variant_id: str,
    comparison_variant_ids: list[str],
    idempotency_key: str,
    method: str,
    path: str,
    request_data: Any,
) -> ProposalWorkspaceSchema:
    session = get_locked_session(db, session_id)

    request_hash = compute_request_hash(request_data)
    replay = check_idempotency_replay(db, session_id, idempotency_key, method, path, request_hash)
    if replay:
        status_code, body = replay
        return ProposalWorkspaceSchema.model_validate(body)

    ws_stmt = (
        select(ProposalWorkspace)
        .options(selectinload(ProposalWorkspace.variants))
        .where(
            ProposalWorkspace.id == workspace_id,
            ProposalWorkspace.session_id == session.id,
        )
        .with_for_update()
    )
    workspace = db.scalar(ws_stmt)
    if not workspace:
        raise AppException(
            code="resource_not_found",
            message=f"Workspace {workspace_id} not found",
            status_code=404,
        )
    if workspace.status != "active":
        raise AppException(
            code="workspace_not_active",
            message="Workspace is not active",
            status_code=409,
        )

    variant_ids = {str(v.id) for v in workspace.variants}
    if selected_variant_id not in variant_ids:
        raise AppException(
            code="validation_error",
            message=f"Selected variant {selected_variant_id} does not belong to workspace",
            status_code=422,
        )

    if not (1 <= len(comparison_variant_ids) <= 2):
        raise AppException(
            code="validation_error",
            message="Comparison variant IDs must contain 1 or 2 variant IDs",
            status_code=422,
        )

    if len(set(comparison_variant_ids)) != len(comparison_variant_ids):
        raise AppException(
            code="validation_error",
            message="Comparison variant IDs must be distinct",
            status_code=422,
        )

    for vid in comparison_variant_ids:
        if vid not in variant_ids:
            raise AppException(
                code="validation_error",
                message=f"Comparison variant {vid} does not belong to workspace",
                status_code=422,
            )

    workspace.selected_variant_id = uuid.UUID(selected_variant_id)
    workspace.comparison_variant_ids = comparison_variant_ids
    workspace.updated_at = datetime.now(timezone.utc)
    session.state_version += 1
    session.updated_at = datetime.now(timezone.utc)

    dto = serialize_workspace(workspace, session.revision, session.state_version)
    resp_dict = dto.model_dump(by_alias=True)

    record_idempotency(db, session_id, idempotency_key, method, path, request_hash, 200, resp_dict)
    db.commit()

    return dto


def close_workspace(
    db: Session,
    session_id: uuid.UUID,
    workspace_id: uuid.UUID,
    target_status: str,
    idempotency_key: str,
    method: str,
    path: str,
    request_data: Any,
) -> dict[str, Any]:
    session = get_locked_session(db, session_id)

    request_hash = compute_request_hash(request_data)
    replay = check_idempotency_replay(db, session_id, idempotency_key, method, path, request_hash)
    if replay:
        status_code, body = replay
        return body

    ws_stmt = (
        select(ProposalWorkspace)
        .where(
            ProposalWorkspace.id == workspace_id,
            ProposalWorkspace.session_id == session.id,
        )
        .with_for_update()
    )
    workspace = db.scalar(ws_stmt)
    if not workspace:
        raise AppException(
            code="resource_not_found",
            message=f"Workspace {workspace_id} not found",
            status_code=404,
        )
    if workspace.status != "active":
        raise AppException(
            code="workspace_not_active",
            message="Workspace is not active",
            status_code=409,
        )

    is_stale = workspace.base_revision != session.revision

    if target_status == "rejected":
        if is_stale:
            raise AppException(
                code="stale_proposal",
                message=(
                    "Stale proposal workspaces cannot be rejected; "
                    "they must be archived or dismissed."
                ),
                status_code=409,
            )
    elif target_status in ("archived", "dismissed"):
        if not is_stale:
            raise AppException(
                code="validation_error",
                message=f"Only stale workspaces can be {target_status}.",
                status_code=409,
            )

    now = datetime.now(timezone.utc)
    workspace.status = target_status
    workspace.closed_at = now
    workspace.updated_at = now
    session.state_version += 1
    session.updated_at = now
    resp_dict = {
        "status": target_status,
        "workspaceId": str(workspace.id),
        "stateVersion": session.state_version,
    }

    record_idempotency(db, session_id, idempotency_key, method, path, request_hash, 200, resp_dict)
    db.commit()

    return resp_dict
