"""Daily maintenance, called by Vercel Cron (condition C3).

Mounted only when ``MAINTENANCE_VIA_CRON`` is on and ``CRON_SECRET`` is set. Without the right
bearer token the route answers 404, so it does not reveal that it exists.
"""

import hmac
import logging
from typing import Annotated

import sentry_sdk
from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import JSONResponse, Response
from sqlalchemy import Engine

from app.booking.clock import Clock, get_clock
from app.booking.maintenance import run_purge
from app.db import get_engine
from app.errors import NotFound, error_response
from app.settings import Settings

logger = logging.getLogger("app.maintenance")
PREFIX = "/internal/maintenance"
NO_STORE = {"Cache-Control": "no-store"}

router = APIRouter(prefix=PREFIX, include_in_schema=False)


def bearer_is_valid(authorization: str | None, secret: str) -> bool:
    """Constant-time check of ``Authorization: Bearer <secret>``."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return False
    presented = authorization[7:].strip()
    return hmac.compare_digest(presented.encode(), secret.encode())


def require_cron(request: Request, authorization: Annotated[str | None, Header()] = None) -> None:
    settings: Settings = request.app.state.settings
    if settings.cron_secret is None or not bearer_is_valid(
        authorization, settings.cron_secret.get_secret_value()
    ):
        raise NotFound("route")


class SentryCheckError(RuntimeError):
    """Raised on purpose by the sentry-check route."""


@router.post("/sentry-check", dependencies=[Depends(require_cron)])
def sentry_check() -> Response:
    """Raise one deliberate error that carries made-up personal data, to verify scrubbing live.

    The caller adds fake personal data to the query string and headers too (see
    specs/007-launch-ready/contracts/ops-endpoints.md). Nothing here is real.
    """
    sentry_sdk.set_tag("check", "sentry-scrub")
    sentry_sdk.set_context(
        "scrub_probe",
        {"phone": "0300 1234567", "email": "fake.patient@example.org", "booking": "ABCDE-FGHJK"},
    )
    raise SentryCheckError(
        "deliberate check: fake.patient@example.org rang 0300 1234567 about ABCDE-FGHJK"
    )


@router.api_route("/purge", methods=["GET", "POST"], dependencies=[Depends(require_cron)])
def purge(
    request: Request,
    engine: Annotated[Engine, Depends(get_engine)],
    clock: Annotated[Clock, Depends(get_clock)],
) -> Response:
    settings: Settings = request.app.state.settings
    try:
        purged = run_purge(engine, settings, clock=clock, include_counters=True)
    except Exception as error:
        logger.warning("purge_failed: %s", type(error).__name__)
        return error_response(500, "internal_error", "Something went wrong.")
    return JSONResponse({"status": "ok", "purged": purged}, headers=NO_STORE)
