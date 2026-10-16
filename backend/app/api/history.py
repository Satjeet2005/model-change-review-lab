from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ChangeTransaction, DemoSession
from app.schemas import (
    HistoryResponse,
    ModelAssumptionsSchema,
    TransactionProvenanceSchema,
    TransactionRecordSchema,
)
from app.security import get_current_session
from app.services.session_service import check_can_undo

router = APIRouter(prefix="/api/v1/history", tags=["history"])


@router.get("", response_model=HistoryResponse)
def get_change_history(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    session: DemoSession = Depends(get_current_session),
    db: Session = Depends(get_db),
) -> HistoryResponse:
    # Total count
    count_stmt = select(func.count(ChangeTransaction.id)).where(
        ChangeTransaction.session_id == session.id
    )
    total = db.scalar(count_stmt) or 0

    # Query items
    stmt = (
        select(ChangeTransaction)
        .where(ChangeTransaction.session_id == session.id)
        .order_by(desc(ChangeTransaction.resulting_revision))
        .offset(offset)
        .limit(limit)
    )
    rows = db.scalars(stmt).all()

    items = []
    for tx in rows:
        provenance_dto = (
            TransactionProvenanceSchema.model_validate(tx.provenance) if tx.provenance else None
        )
        undoes_id = str(tx.undoes_transaction_id) if tx.undoes_transaction_id else None
        undone_by_id = str(tx.undone_by_transaction_id) if tx.undone_by_transaction_id else None
        items.append(
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

    return HistoryResponse(
        items=items,
        limit=limit,
        offset=offset,
        total=total,
        can_undo=can_undo,
    )
