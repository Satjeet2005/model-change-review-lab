import hashlib
import json
import logging
import threading
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import desc, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.config import settings
from app.errors import AppException
from app.models import ChangeTransaction, DemoSession, ProposalWorkspace
from app.schemas import (
    ModelAssumptionsSchema,
    ProposalOperationSchema,
    ProposalVariantSchema,
    ProposalWorkspaceSchema,
    SessionSnapshotResponse,
    TransactionProvenanceSchema,
    TransactionRecordSchema,
)

logger = logging.getLogger("mcrl")


def load_seed_assumptions() -> dict:
    seed_path: Path = settings.seed_file_path
    if not seed_path.exists():
        raise RuntimeError(f"Seed assumptions file not found at {seed_path}")
    with open(seed_path, "r", encoding="utf-8") as f:
        return json.load(f)


def check_can_undo(db: Session, session_id: uuid.UUID) -> bool:
    stmt = (
        select(ChangeTransaction.id)
        .where(
            ChangeTransaction.session_id == session_id,
            ChangeTransaction.kind.in_(["manual-edit", "proposal-accepted", "reset-to-baseline"]),
            ChangeTransaction.undone_by_transaction_id.is_(None),
        )
        .limit(1)
    )
    return db.scalar(stmt) is not None


def serialize_workspace(
    workspace: ProposalWorkspace, current_revision: int, state_version: int = 1
) -> ProposalWorkspaceSchema:
    variants = []
    for v in workspace.variants:
        dup_id = str(v.duplicated_from_variant_id) if v.duplicated_from_variant_id else None
        ops = [ProposalOperationSchema.model_validate(op) for op in v.operations]
        reset_ops = [
            ProposalOperationSchema.model_validate(op) for op in v.reset_snapshot_operations
        ]
        variants.append(
            ProposalVariantSchema(
                id=str(v.id),
                label=v.label,
                source_template_id=v.source_template_id,  # type: ignore[arg-type]
                duplicated_from_variant_id=dup_id,
                operations=ops,
                reset_snapshot_operations=reset_ops,
                created_at=v.created_at.isoformat(),
            )
        )

    return ProposalWorkspaceSchema(
        id=str(workspace.id),
        base_revision=workspace.base_revision,
        base_assumptions=ModelAssumptionsSchema.model_validate(workspace.base_assumptions),
        source_template_id=workspace.source_template_id,  # type: ignore[arg-type]
        title=workspace.title,
        description=workspace.description,
        variants=variants,
        selected_variant_id=str(workspace.selected_variant_id),
        comparison_variant_ids=[str(vid) for vid in workspace.comparison_variant_ids],
        created_at=workspace.created_at.isoformat(),
        status=workspace.status,  # type: ignore[arg-type]
        is_stale=(workspace.base_revision != current_revision),
        state_version=state_version,
    )


def build_session_snapshot(
    db: Session,
    session: DemoSession,
    session_reset_because_expired: bool | None = None,
    changed: bool | None = None,
) -> SessionSnapshotResponse:
    # 1. Active workspace
    active_ws_stmt = (
        select(ProposalWorkspace)
        .options(selectinload(ProposalWorkspace.variants))
        .where(
            ProposalWorkspace.session_id == session.id,
            ProposalWorkspace.status == "active",
        )
    )
    active_workspace = db.scalar(active_ws_stmt)
    active_workspace_dto = (
        serialize_workspace(active_workspace, session.revision, session.state_version)
        if active_workspace
        else None
    )

    # 2. Archived workspaces (limit 20)
    archived_stmt = (
        select(ProposalWorkspace)
        .options(selectinload(ProposalWorkspace.variants))
        .where(
            ProposalWorkspace.session_id == session.id,
            ProposalWorkspace.status == "archived",
        )
        .order_by(desc(ProposalWorkspace.created_at))
        .limit(20)
    )
    archived_workspaces = [
        serialize_workspace(ws, session.revision, session.state_version)
        for ws in db.scalars(archived_stmt).unique()
    ]

    # 3. Change history (limit 100)
    history_stmt = (
        select(ChangeTransaction)
        .where(ChangeTransaction.session_id == session.id)
        .order_by(desc(ChangeTransaction.resulting_revision))
        .limit(100)
    )
    history_rows = db.scalars(history_stmt).all()
    change_history = []
    for tx in history_rows:
        provenance_dto = (
            TransactionProvenanceSchema.model_validate(tx.provenance) if tx.provenance else None
        )
        undoes_id = str(tx.undoes_transaction_id) if tx.undoes_transaction_id else None
        undone_by_id = str(tx.undone_by_transaction_id) if tx.undone_by_transaction_id else None
        change_history.append(
            TransactionRecordSchema(
                id=str(tx.id),
                timestamp=tx.created_at.isoformat(),
                kind=tx.kind,  # type: ignore[arg-type]
                description=tx.description,
                affected_cell_ids=tx.affected_cell_ids,
                previous_assumptions=ModelAssumptionsSchema.model_validate(tx.previous_assumptions),
                new_assumptions=ModelAssumptionsSchema.model_validate(tx.new_assumptions),
                resulting_revision=tx.resulting_revision,
                provenance=provenance_dto,
                undoes_transaction_id=undoes_id,
                undone_by_transaction_id=undone_by_id,
            )
        )

    can_undo = check_can_undo(db, session.id)

    return SessionSnapshotResponse(
        session_id=str(session.id),
        session_reset_because_expired=session_reset_because_expired,
        baseline_assumptions=ModelAssumptionsSchema.model_validate(session.baseline_assumptions),
        working_assumptions=ModelAssumptionsSchema.model_validate(session.working_assumptions),
        revision=session.revision,
        state_version=session.state_version,
        active_workspace=active_workspace_dto,
        archived_workspaces=archived_workspaces,
        change_history=change_history,
        can_undo=can_undo,
        changed=changed,
    )


_recently_reset_tokens: dict[str, float] = {}
_reset_tokens_lock = threading.Lock()


def create_or_resume_session(db: Session, token_hash: str) -> tuple[DemoSession, bool]:
    # Lock token_hash via transaction advisory lock to serialize concurrent init calls
    lock_id = int(hashlib.md5(token_hash.encode("utf-8")).hexdigest()[:15], 16)
    db.execute(text("SELECT pg_advisory_xact_lock(:lock_id)"), {"lock_id": lock_id})

    now = datetime.now(timezone.utc)
    stmt = select(DemoSession).where(DemoSession.token_hash == token_hash)
    existing = db.scalar(stmt)

    if existing:
        if now - existing.last_seen_at > timedelta(days=settings.SESSION_TTL_DAYS):
            logger.info(
                "Session %s expired after %d days. Re-seeding.",
                existing.id,
                settings.SESSION_TTL_DAYS,
            )
            with _reset_tokens_lock:
                _recently_reset_tokens[token_hash] = time.time()
            db.delete(existing)
            db.flush()
            return _create_fresh_session(db, token_hash, session_reset_because_expired=True)

        with _reset_tokens_lock:
            now_ts = time.time()
            for th in list(_recently_reset_tokens.keys()):
                if now_ts - _recently_reset_tokens[th] > 30.0:
                    _recently_reset_tokens.pop(th, None)
            was_recently_reset = (
                token_hash in _recently_reset_tokens
                and (now_ts - _recently_reset_tokens[token_hash]) < 5.0
            )

        existing.last_seen_at = now
        db.commit()
        return existing, was_recently_reset

    return _create_fresh_session(db, token_hash, session_reset_because_expired=False)


def _create_fresh_session(
    db: Session, token_hash: str, session_reset_because_expired: bool
) -> tuple[DemoSession, bool]:
    now = datetime.now(timezone.utc)
    seed = load_seed_assumptions()

    new_session = DemoSession(
        id=uuid.uuid4(),
        token_hash=token_hash,
        baseline_assumptions=seed,
        working_assumptions=seed,
        revision=1,
        created_at=now,
        updated_at=now,
        last_seen_at=now,
    )

    try:
        db.add(new_session)
        db.commit()
        db.refresh(new_session)
        return new_session, session_reset_because_expired
    except IntegrityError:
        # Race-safe convergence: another process created the session with same token_hash
        db.rollback()
        stmt = select(DemoSession).where(DemoSession.token_hash == token_hash)
        winner = db.scalar(stmt)
        if winner:
            return winner, session_reset_because_expired
        raise AppException(
            code="database_unavailable",
            message="Failed to initialize session concurrently.",
            status_code=503,
        )
