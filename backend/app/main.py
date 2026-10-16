import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.api import health, history, model, proposals, sessions
from app.config import settings
from app.errors import (
    AppException,
    app_exception_handler,
    generic_exception_handler,
    validation_exception_handler,
)


class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        req_id = request.headers.get("X-Request-Id", str(uuid.uuid4()))
        request.state.request_id = req_id
        response = await call_next(request)
        response.headers["X-Request-Id"] = req_id
        return response


class MutationOriginMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # PRD §5.3: Validate Origin header, when provided, against configured allowlist on mutations
        if request.method in ("POST", "PATCH", "PUT", "DELETE"):
            origin = request.headers.get("origin")
            if origin:
                normalized = origin.strip().rstrip("/")
                allowed = [o.rstrip("/") for o in settings.cors_origin_list]
                if normalized not in allowed:
                    return JSONResponse(
                        status_code=403,
                        content={
                            "error": {
                                "code": "forbidden_origin",
                                "message": (
                                    f"Origin '{origin}' is not authorized to "
                                    "perform model mutations."
                                ),
                            }
                        },
                    )
        return await call_next(request)


def create_app() -> FastAPI:
    app = FastAPI(
        title="Model Change Review Lab API",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # Middleware
    app.add_middleware(RequestIdMiddleware)
    app.add_middleware(MutationOriginMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "X-Workspace-Token", "Idempotency-Key"],
    )

    # Exception Handlers
    app.add_exception_handler(AppException, app_exception_handler)  # type: ignore[arg-type]
    app.add_exception_handler(RequestValidationError, validation_exception_handler)  # type: ignore[arg-type]
    app.add_exception_handler(Exception, generic_exception_handler)

    # Routes
    app.include_router(health.router)
    app.include_router(sessions.router)
    app.include_router(proposals.router)
    app.include_router(model.router)
    app.include_router(history.router)

    return app


app = create_app()
