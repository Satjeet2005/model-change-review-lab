import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import Header
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import AppException
from app.models import IdempotencyRequest


def get_idempotency_key(
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
) -> str:
    if not idempotency_key:
        raise AppException(
            code="invalid_request",
            message="Idempotency-Key header is required for mutating endpoints.",
            status_code=400,
        )
    key = idempotency_key.strip()
    if len(key) < 8 or len(key) > 128:
        raise AppException(
            code="invalid_request",
            message="Idempotency-Key header must be between 8 and 128 characters.",
            status_code=400,
        )
    return key


def compute_request_hash(data: Any) -> str:
    if data is None:
        raw = b""
    elif isinstance(data, (bytes, bytearray)):
        raw = bytes(data)
    elif isinstance(data, str):
        raw = data.encode("utf-8")
    else:
        raw = json.dumps(data, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def check_idempotency_replay(
    db: Session,
    session_id: uuid.UUID,
    idempotency_key: str,
    method: str,
    path: str,
    request_hash: str,
) -> tuple[int, dict[str, Any]] | None:
    stmt = (
        select(IdempotencyRequest)
        .where(
            IdempotencyRequest.session_id == session_id,
            IdempotencyRequest.idempotency_key == idempotency_key,
        )
        .with_for_update()
    )
    existing = db.scalar(stmt)
    if not existing:
        return None

    if existing.method != method or existing.path != path or existing.request_hash != request_hash:
        raise AppException(
            code="idempotency_key_reused",
            message="Idempotency key was previously used with different method, path, or payload.",
            status_code=409,
        )

    return existing.response_status, existing.response_body


def record_idempotency(
    db: Session,
    session_id: uuid.UUID,
    idempotency_key: str,
    method: str,
    path: str,
    request_hash: str,
    response_status: int,
    response_body: dict[str, Any],
) -> None:
    rec = IdempotencyRequest(
        id=uuid.uuid4(),
        session_id=session_id,
        idempotency_key=idempotency_key,
        method=method,
        path=path,
        request_hash=request_hash,
        response_status=response_status,
        response_body=response_body,
        created_at=datetime.now(timezone.utc),
    )
    db.add(rec)
