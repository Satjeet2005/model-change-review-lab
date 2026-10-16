import copy
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.domain.model_validation import (
    parse_cell_id,
    validate_field_value,
    validate_model_assumptions,
)
from app.domain.operations import (
    apply_operations,
    derive_operation_metadata,
    get_field_value,
    set_field_value,
)
from app.errors import AppException
from app.models import ChangeTransaction, DemoSession, ProposalWorkspace
from app.schemas import (
    AcceptProposalResponse,
    ModelResponse,
    SessionSnapshotResponse,
)
from app.services.idempotency import (
    check_idempotency_replay,
    compute_request_hash,
    record_idempotency,
)
from app.services.proposal_service import get_locked_session
from app.services.session_service import build_session_snapshot


def compute_affected_cell_ids(
    old_assumptions: dict[str, Any], new_assumptions: dict[str, Any]
) -> list[str]:
    affected = []
    for setting in ("startingRevenueUsd", "startingCashUsd"):
        if old_assumptions.get(setting) != new_assumptions.get(setting):
            affected.append(f"setting:{setting}")

    old_months = old_assumptions.get("months", [])
    new_months = new_assumptions.get("months", [])
    for p in range(1, 25):
        m_str = f"M{p:02d}"
        om = old_months[p - 1] if p - 1 < len(old_months) else {}
        nm = new_months[p - 1] if p - 1 < len(new_months) else {}
        for key in (
            "revenueGrowthRate",
            "engineeringFte",
            "otherFte",
            "loadedMonthlyCostPerFteUsd",
            "otherOperatingExpenseUsd",
        ):
            if om.get(key) != nm.get(key):
                affected.append(f"assumption:{key}:{m_str}")
    return affected


def get_model(session: DemoSession) -> ModelResponse:
    return ModelResponse(
        baseline_assumptions=session.baseline_assumptions,
        working_assumptions=session.working_assumptions,
        revision=session.revision,
    )


def direct_edit(
    db: Session,
    session_id: uuid.UUID,
    expected_revision: int,
    target_cell_id: str,
    proposed_value: float,
    idempotency_key: str,
    method: str,
    path: str,
    request_data: Any,
) -> SessionSnapshotResponse:
    session = get_locked_session(db, session_id)

    request_hash = compute_request_hash(request_data)
    replay = check_idempotency_replay(db, session_id, idempotency_key, method, path, request_hash)
    if replay:
        status_code, body = replay
        return SessionSnapshotResponse.model_validate(body)

    if session.revision != expected_revision:
        raise AppException(
            code="revision_conflict",
            message="The model changed since this action was prepared.",
            status_code=409,
            details={"expectedRevision": expected_revision, "currentRevision": session.revision},
        )

    target_type, target_key, period = parse_cell_id(target_cell_id)
    validated_val = validate_field_value(target_key, proposed_value, period=period)
    curr_val = get_field_value(session.working_assumptions, target_type, target_key, period)

    # If value is unchanged, it is an idempotent no-op (PRD §7.1 & §8.6)
    if curr_val == validated_val:
        snapshot = build_session_snapshot(db, session, changed=False)
        snapshot_dict = snapshot.model_dump(by_alias=True)
        record_idempotency(
            db, session_id, idempotency_key, method, path, request_hash, 200, snapshot_dict
        )
        db.commit()
        return snapshot

    try:
        old_assumptions = copy.deepcopy(session.working_assumptions)
        new_assumptions = copy.deepcopy(session.working_assumptions)
        set_field_value(new_assumptions, target_type, target_key, period, validated_val)
        validate_model_assumptions(new_assumptions)

        now = datetime.now(timezone.utc)
        session.working_assumptions = new_assumptions
        session.revision += 1
        session.state_version += 1
        session.updated_at = now

        tx_id = uuid.uuid4()
        desc_text = f"Manual edit to {target_cell_id}"

        tx = ChangeTransaction(
            id=tx_id,
            session_id=session.id,
            resulting_revision=session.revision,
            kind="manual-edit",
            description=desc_text,
            affected_cell_ids=[target_cell_id],
            previous_assumptions=old_assumptions,
            new_assumptions=new_assumptions,
            provenance=None,
            undoes_transaction_id=None,
            undone_by_transaction_id=None,
            created_at=now,
        )
        db.add(tx)
        db.flush()

        snapshot = build_session_snapshot(db, session, changed=True)
        snapshot_dict = snapshot.model_dump(by_alias=True)

        record_idempotency(
            db, session_id, idempotency_key, method, path, request_hash, 200, snapshot_dict
        )
        db.commit()
        return snapshot
    except IntegrityError as e:
        db.rollback()
        raise AppException(
            code="revision_conflict",
            message="A conflicting model change was committed concurrently.",
            status_code=409,
        ) from e
    except Exception:
        db.rollback()
        raise


def reset_to_baseline(
    db: Session,
    session_id: uuid.UUID,
    expected_revision: int,
    idempotency_key: str,
    method: str,
    path: str,
    request_data: Any,
) -> SessionSnapshotResponse:
    session = get_locked_session(db, session_id)

    request_hash = compute_request_hash(request_data)
    replay = check_idempotency_replay(db, session_id, idempotency_key, method, path, request_hash)
    if replay:
        status_code, body = replay
        return SessionSnapshotResponse.model_validate(body)

    if session.revision != expected_revision:
        raise AppException(
            code="revision_conflict",
            message="The model changed since reset was prepared.",
            status_code=409,
            details={"expectedRevision": expected_revision, "currentRevision": session.revision},
        )

    # Check if already at baseline (PRD §7.1 & §8.7)
    if session.working_assumptions == session.baseline_assumptions:
        snapshot = build_session_snapshot(db, session, changed=False)
        snapshot_dict = snapshot.model_dump(by_alias=True)
        record_idempotency(
            db, session_id, idempotency_key, method, path, request_hash, 200, snapshot_dict
        )
        db.commit()
        return snapshot

    try:
        old_assumptions = copy.deepcopy(session.working_assumptions)
        new_assumptions = copy.deepcopy(session.baseline_assumptions)
        affected_cells = compute_affected_cell_ids(old_assumptions, new_assumptions)

        now = datetime.now(timezone.utc)
        session.working_assumptions = new_assumptions
        session.revision += 1
        session.state_version += 1
        session.updated_at = now

        tx_id = uuid.uuid4()
        tx = ChangeTransaction(
            id=tx_id,
            session_id=session.id,
            resulting_revision=session.revision,
            kind="reset-to-baseline",
            description="Reset model to deterministic baseline assumptions",
            affected_cell_ids=affected_cells,
            previous_assumptions=old_assumptions,
            new_assumptions=new_assumptions,
            provenance=None,
            undoes_transaction_id=None,
            undone_by_transaction_id=None,
            created_at=now,
        )
        db.add(tx)
        db.flush()

        snapshot = build_session_snapshot(db, session, changed=True)
        snapshot_dict = snapshot.model_dump(by_alias=True)

        record_idempotency(
            db, session_id, idempotency_key, method, path, request_hash, 200, snapshot_dict
        )
        db.commit()
        return snapshot
    except IntegrityError as e:
        db.rollback()
        raise AppException(
            code="revision_conflict",
            message="A conflicting model change was committed concurrently.",
            status_code=409,
        ) from e
    except Exception:
        db.rollback()
        raise


def accept_proposal(
    db: Session,
    session_id: uuid.UUID,
    workspace_id: uuid.UUID,
    variant_id: uuid.UUID,
    expected_revision: int,
    idempotency_key: str,
    method: str,
    path: str,
    request_data: Any,
) -> AcceptProposalResponse:
    session = get_locked_session(db, session_id)

    request_hash = compute_request_hash(request_data)
    replay = check_idempotency_replay(db, session_id, idempotency_key, method, path, request_hash)
    if replay:
        status_code, body = replay
        return AcceptProposalResponse.model_validate(body)

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

    if workspace.status == "accepted":
        raise AppException(
            code="duplicate_acceptance",
            message="Workspace has already been accepted and cannot be reapplied.",
            status_code=409,
        )

    if workspace.status != "active":
        raise AppException(
            code="workspace_not_active",
            message="Workspace is not active",
            status_code=409,
        )

    # Revision checks: must match session revision
    if workspace.base_revision != session.revision:
        raise AppException(
            code="stale_proposal",
            message="Proposal is stale because canonical model revision has changed.",
            status_code=409,
            details={
                "baseRevision": workspace.base_revision,
                "currentRevision": session.revision,
            },
        )

    if expected_revision != session.revision:
        raise AppException(
            code="revision_conflict",
            message="The model changed since proposal was prepared.",
            status_code=409,
            details={
                "expectedRevision": expected_revision,
                "currentRevision": session.revision,
            },
        )

    variant = next((v for v in workspace.variants if v.id == variant_id), None)
    if not variant:
        raise AppException(
            code="resource_not_found",
            message=f"Variant {variant_id} not found in workspace",
            status_code=404,
        )

    try:
        # Regenerate/validate operations against stored base assumptions
        validated_ops = []
        for op in variant.operations:
            cell_id = op["targetCellId"]
            prop_val = op["proposedValue"]
            canonical_op = derive_operation_metadata(cell_id, prop_val, workspace.base_assumptions)
            curr_val = get_field_value(
                session.working_assumptions,
                *parse_cell_id(cell_id),
            )
            if canonical_op["previousValue"] != curr_val:
                raise AppException(
                    code="stale_proposal",
                    message="Base assumptions value differs from current canonical value.",
                    status_code=409,
                )
            validated_ops.append(canonical_op)

        old_assumptions = copy.deepcopy(session.working_assumptions)
        new_assumptions = apply_operations(old_assumptions, validated_ops)

        now = datetime.now(timezone.utc)
        session.working_assumptions = new_assumptions
        session.revision += 1
        session.state_version += 1
        session.updated_at = now

        workspace.status = "accepted"
        workspace.accepted_variant_id = variant.id
        workspace.closed_at = now
        workspace.updated_at = now

        tx_id = uuid.uuid4()
        provenance = {
            "proposalWorkspaceId": str(workspace.id),
            "variantId": str(variant.id),
            "variantLabel": variant.label,
            "sourceTemplateId": workspace.source_template_id,
            "baseRevision": workspace.base_revision,
        }

        tx = ChangeTransaction(
            id=tx_id,
            session_id=session.id,
            resulting_revision=session.revision,
            kind="proposal-accepted",
            description=f"Accepted proposal: {workspace.title} ({variant.label})",
            affected_cell_ids=[op["targetCellId"] for op in validated_ops],
            previous_assumptions=old_assumptions,
            new_assumptions=new_assumptions,
            provenance=provenance,
            undoes_transaction_id=None,
            undone_by_transaction_id=None,
            created_at=now,
        )
        db.add(tx)
        db.flush()

        snapshot = build_session_snapshot(db, session, changed=True)
        resp = AcceptProposalResponse(
            session_snapshot=snapshot,
            accepted_workspace_id=str(workspace.id),
            accepted_variant_id=str(variant.id),
        )
        resp_dict = resp.model_dump(by_alias=True)

        record_idempotency(
            db, session_id, idempotency_key, method, path, request_hash, 200, resp_dict
        )
        db.commit()
        return resp
    except IntegrityError as e:
        db.rollback()
        raise AppException(
            code="revision_conflict",
            message="A conflicting model change was committed concurrently.",
            status_code=409,
        ) from e
    except Exception:
        db.rollback()
        raise


def undo_transaction(
    db: Session,
    session_id: uuid.UUID,
    expected_revision: int,
    idempotency_key: str,
    method: str,
    path: str,
    request_data: Any,
) -> SessionSnapshotResponse:
    session = get_locked_session(db, session_id)

    request_hash = compute_request_hash(request_data)
    replay = check_idempotency_replay(db, session_id, idempotency_key, method, path, request_hash)
    if replay:
        status_code, body = replay
        return SessionSnapshotResponse.model_validate(body)

    if session.revision != expected_revision:
        raise AppException(
            code="revision_conflict",
            message="The model changed since undo was prepared.",
            status_code=409,
            details={"expectedRevision": expected_revision, "currentRevision": session.revision},
        )

    # Find most recent forward transaction not already undone
    stmt = (
        select(ChangeTransaction)
        .where(
            ChangeTransaction.session_id == session.id,
            ChangeTransaction.kind.in_(["manual-edit", "proposal-accepted", "reset-to-baseline"]),
            ChangeTransaction.undone_by_transaction_id.is_(None),
        )
        .order_by(ChangeTransaction.resulting_revision.desc())
        .limit(1)
        .with_for_update()
    )
    target_tx = db.scalar(stmt)
    if not target_tx:
        raise AppException(
            code="nothing_to_undo",
            message="No eligible committed transaction remains to undo.",
            status_code=409,
        )

    try:
        restored_assumptions = copy.deepcopy(target_tx.previous_assumptions)
        validate_model_assumptions(restored_assumptions)

        old_assumptions = copy.deepcopy(session.working_assumptions)
        affected_cells = compute_affected_cell_ids(old_assumptions, restored_assumptions)

        now = datetime.now(timezone.utc)
        session.working_assumptions = restored_assumptions
        session.revision += 1
        session.state_version += 1
        session.updated_at = now

        undo_tx_id = uuid.uuid4()
        undo_tx = ChangeTransaction(
            id=undo_tx_id,
            session_id=session.id,
            resulting_revision=session.revision,
            kind="undo",
            description=f"Undid: {target_tx.description}",
            affected_cell_ids=affected_cells,
            previous_assumptions=old_assumptions,
            new_assumptions=restored_assumptions,
            provenance=None,
            undoes_transaction_id=target_tx.id,
            undone_by_transaction_id=None,
            created_at=now,
        )
        # Flush undo_tx FIRST so target_tx.undone_by_transaction_id foreign key
        # constraint is satisfied!
        db.add(undo_tx)
        db.flush()

        target_tx.undone_by_transaction_id = undo_tx_id
        db.flush()

        snapshot = build_session_snapshot(db, session, changed=True)
        snapshot_dict = snapshot.model_dump(by_alias=True)

        record_idempotency(
            db, session_id, idempotency_key, method, path, request_hash, 200, snapshot_dict
        )
        db.commit()
        return snapshot
    except IntegrityError as e:
        db.rollback()
        raise AppException(
            code="revision_conflict",
            message="A conflicting model change was committed concurrently.",
            status_code=409,
        ) from e
    except Exception:
        db.rollback()
        raise
