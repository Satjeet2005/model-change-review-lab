import hashlib
import re
from datetime import datetime, timedelta, timezone

from fastapi import Depends, Header
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.errors import AppException
from app.models import DemoSession

TOKEN_BASE64URL_PATTERN = re.compile(r"^[A-Za-z0-9_-]{43,44}$")
TOKEN_LEGACY_UUID_PATTERN = re.compile(
    r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
)
TOKEN_LEGACY_HEX_PATTERN = re.compile(r"^[0-9a-fA-F]{32,64}$")


def is_valid_capability_token(token: str) -> bool:
    cleaned = token.strip()
    return bool(
        TOKEN_BASE64URL_PATTERN.match(cleaned)
        or TOKEN_LEGACY_UUID_PATTERN.match(cleaned)
        or TOKEN_LEGACY_HEX_PATTERN.match(cleaned)
    )


def hash_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.strip().encode("utf-8")).hexdigest()


def get_token_header(
    x_workspace_token: str | None = Header(None, alias="X-Workspace-Token"),
) -> str:
    if not x_workspace_token or not is_valid_capability_token(x_workspace_token):
        raise AppException(
            code="invalid_workspace_token",
            message=(
                "Valid high-entropy capability token is required "
                "(32-byte base64url or legacy UUID format)."
            ),
            status_code=401,
        )
    return x_workspace_token.strip()


def get_current_session(
    token: str = Depends(get_token_header),
    db: Session = Depends(get_db),
) -> DemoSession:
    t_hash = hash_token(token)
    stmt = select(DemoSession).where(DemoSession.token_hash == t_hash)
    session = db.scalar(stmt)
    if not session:
        raise AppException(
            code="invalid_workspace_token",
            message="Session not found or token invalid.",
            status_code=401,
        )

    # Check 30-day expiration
    now = datetime.now(timezone.utc)
    if now - session.last_seen_at > timedelta(days=settings.SESSION_TTL_DAYS):
        raise AppException(
            code="invalid_workspace_token",
            message="Session expired due to inactivity. Reinitialize via POST /api/v1/session.",
            status_code=401,
        )

    session.last_seen_at = now
    db.commit()
    return session
