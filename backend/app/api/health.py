import logging

from fastapi import APIRouter, Response, status
from sqlalchemy import text

from app.database import SessionLocal

logger = logging.getLogger("mcrl")
router = APIRouter(tags=["health"])


@router.get("/health")
@router.get("/api/v1/health")
def get_health(response: Response) -> dict[str, str]:
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "ok"}
    except Exception as exc:
        logger.warning("Health check DB ping failed: %s", exc)
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "error", "database": "unavailable"}
    finally:
        db.close()
