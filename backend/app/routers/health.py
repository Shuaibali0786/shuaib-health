"""Liveness and readiness checks (not under /api/v1, never cached)."""

import logging
from functools import lru_cache
from pathlib import Path
from typing import Annotated

from alembic.config import Config
from alembic.script import ScriptDirectory
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse, Response
from sqlalchemy import Engine, text
from sqlalchemy.exc import SQLAlchemyError

from app.db import get_engine
from app.errors import error_response
from app.schemas import ErrorResponse, HealthStatus

logger = logging.getLogger("app.health")
router = APIRouter(tags=["health"])

ALEMBIC_INI = Path(__file__).resolve().parents[2] / "alembic.ini"
NO_STORE = {"Cache-Control": "no-store"}


@lru_cache
def head_revision() -> str | None:
    return ScriptDirectory.from_config(Config(str(ALEMBIC_INI))).get_current_head()


@router.get("/health", response_model=HealthStatus)
def health() -> Response:
    return JSONResponse({"status": "ok"}, headers=NO_STORE)


@router.get(
    "/ready",
    response_model=HealthStatus,
    responses={503: {"model": ErrorResponse}},
)
def ready(engine: Annotated[Engine, Depends(get_engine)]) -> Response:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
            current = conn.execute(text("SELECT version_num FROM alembic_version")).scalar()
    except SQLAlchemyError as exc:
        logger.warning("readiness check failed: %s", type(exc).__name__)
        return error_response(503, "service_unavailable", "The service is not ready.")
    if current is None or current != head_revision():
        logger.warning("readiness check failed: database schema is not at the latest revision")
        return error_response(503, "service_unavailable", "The service is not ready.")
    return JSONResponse({"status": "ok"}, headers=NO_STORE)
