from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import DemoSession
from app.schemas import SessionSnapshotResponse
from app.security import get_current_session, get_token_header, hash_token
from app.services.session_service import build_session_snapshot, create_or_resume_session

router = APIRouter(prefix="/api/v1/session", tags=["session"])


@router.post("", response_model=SessionSnapshotResponse)
def init_session(
    token: str = Depends(get_token_header),
    db: Session = Depends(get_db),
) -> SessionSnapshotResponse:
    t_hash = hash_token(token)
    session, expired_reset = create_or_resume_session(db, t_hash)
    db.refresh(session, with_for_update={"read": True})
    return build_session_snapshot(db, session, session_reset_because_expired=expired_reset)


@router.get("", response_model=SessionSnapshotResponse)
def get_session_snapshot(
    session: DemoSession = Depends(get_current_session),
    db: Session = Depends(get_db),
) -> SessionSnapshotResponse:
    db.refresh(session, with_for_update={"read": True})
    return build_session_snapshot(db, session, session_reset_because_expired=None)
