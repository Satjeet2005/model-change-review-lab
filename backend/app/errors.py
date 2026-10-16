import logging
import uuid
from typing import Any

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger("mcrl")


class AppException(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = 400,
        details: dict[str, Any] | None = None,
    ):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details


def build_error_response(
    status_code: int,
    code: str,
    message: str,
    details: dict[str, Any] | None = None,
    request_id: str | None = None,
) -> JSONResponse:
    if request_id is None:
        request_id = str(uuid.uuid4())
    payload: dict[str, Any] = {
        "error": {
            "code": code,
            "message": message,
            "requestId": request_id,
        }
    }
    if details is not None:
        payload["error"]["details"] = details
    return JSONResponse(status_code=status_code, content=payload)


async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    return build_error_response(
        status_code=exc.status_code,
        code=exc.code,
        message=exc.message,
        details=exc.details,
        request_id=request_id,
    )


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    errors_summary = []
    for err in exc.errors():
        loc = " -> ".join(str(p) for p in err.get("loc", []))
        errors_summary.append(f"{loc}: {err.get('msg', 'invalid')}")
    return build_error_response(
        status_code=422,
        code="validation_error",
        message="; ".join(errors_summary) or "Validation error",
        details={"validationErrors": [err.get("msg") for err in exc.errors()]},
        request_id=request_id,
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    logger.error(
        "Unhandled error on %s %s [req %s]: %s",
        request.method,
        request.url.path,
        request_id,
        exc,
        exc_info=True,
    )
    return build_error_response(
        status_code=500,
        code="internal_error",
        message="An unexpected internal error occurred.",
        request_id=request_id,
    )
