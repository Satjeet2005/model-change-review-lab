from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import DemoSession
from app.schemas import (
    DirectEditRequest,
    ModelResponse,
    ResetModelRequest,
    SessionSnapshotResponse,
    UndoRequest,
)
from app.security import get_current_session
from app.services.idempotency import get_idempotency_key
from app.services.model_service import direct_edit, get_model, reset_to_baseline, undo_transaction

router = APIRouter(tags=["model"])


@router.get("/api/v1/model", response_model=ModelResponse)
def read_model(
    session: DemoSession = Depends(get_current_session),
) -> ModelResponse:
    return get_model(session)


@router.patch("/api/v1/model/assumptions", response_model=SessionSnapshotResponse)
def update_model_assumption(
    payload: DirectEditRequest,
    request: Request,
    idempotency_key: str = Depends(get_idempotency_key),
    session: DemoSession = Depends(get_current_session),
    db: Session = Depends(get_db),
) -> SessionSnapshotResponse:
    return direct_edit(
        db=db,
        session_id=session.id,
        expected_revision=payload.expected_revision,
        target_cell_id=payload.target_cell_id,
        proposed_value=payload.proposed_value,
        idempotency_key=idempotency_key,
        method=request.method,
        path=request.url.path,
        request_data=payload.model_dump(),
    )


@router.post("/api/v1/model/reset", response_model=SessionSnapshotResponse)
def reset_model(
    payload: ResetModelRequest,
    request: Request,
    idempotency_key: str = Depends(get_idempotency_key),
    session: DemoSession = Depends(get_current_session),
    db: Session = Depends(get_db),
) -> SessionSnapshotResponse:
    return reset_to_baseline(
        db=db,
        session_id=session.id,
        expected_revision=payload.expected_revision,
        idempotency_key=idempotency_key,
        method=request.method,
        path=request.url.path,
        request_data=payload.model_dump(),
    )


@router.post("/api/v1/undo", response_model=SessionSnapshotResponse)
def undo_last_mutation(
    payload: UndoRequest,
    request: Request,
    idempotency_key: str = Depends(get_idempotency_key),
    session: DemoSession = Depends(get_current_session),
    db: Session = Depends(get_db),
) -> SessionSnapshotResponse:
    return undo_transaction(
        db=db,
        session_id=session.id,
        expected_revision=payload.expected_revision,
        idempotency_key=idempotency_key,
        method=request.method,
        path=request.url.path,
        request_data=payload.model_dump(),
    )
