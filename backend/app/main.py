"""Application factory.

Run with ``uv run uvicorn app.main:app --port 8000 --no-access-log``. ``app`` is built lazily on
first access, so importing this module never reads configuration.
"""

import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from functools import lru_cache

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.booking.clock import SystemClock
from app.booking.retention import purge_demo_bookings, purge_old_sessions
from app.db import get_engine, make_engine
from app.errors import UnhandledErrorMiddleware, register_exception_handlers
from app.logging_config import configure_logging
from app.middleware.access_log import AccessLogMiddleware
from app.middleware.rate_limit import InMemoryFixedWindowLimiter, RateLimitMiddleware
from app.middleware.request_id import RequestIdMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.routers import (
    admin_auth,
    admin_bookings,
    admin_dashboard,
    admin_staff,
    appointments,
    clinic,
    departments,
    doctors,
    health,
    lab_tests,
    packages,
    slots,
)
from app.settings import Settings, get_settings

API_PREFIX = "/api/v1"

logger = logging.getLogger("app.booking")


def _startup_purge(app: FastAPI, settings: Settings) -> None:
    """Remove old sessions, and in demo mode expired demo data, once at startup.

    Any failure is logged by type only.
    """
    try:
        override = app.dependency_overrides.get(get_engine)
        # The app's own settings decide which database this is, not the process-wide cache.
        engine = override() if override else make_engine(settings.database_url, pool_size=1)
        try:
            with engine.begin() as conn:
                if settings.demo_mode:  # purges old sessions too
                    purge_demo_bookings(
                        conn,
                        now=SystemClock().now(),
                        after_days=settings.booking_purge_after_days,
                        audit_after_days=settings.audit_purge_after_days,
                        limit=None,
                    )
                else:
                    purge_old_sessions(conn, now=SystemClock().now(), limit=None)
        finally:
            if not override:
                engine.dispose()
    except Exception as error:
        logger.warning("purge_failed: %s", type(error).__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings: Settings = app.state.settings
    # Not awaited before serving: a slow or unreachable database must not delay startup.
    task = asyncio.create_task(asyncio.to_thread(_startup_purge, app, settings))
    yield
    await task


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)
    docs_enabled = settings.app_env == "development"

    app = FastAPI(
        title="Clinic Catalog API",
        version="1.0.0",
        debug=False,
        lifespan=lifespan,
        docs_url="/docs" if docs_enabled else None,
        redoc_url="/redoc" if docs_enabled else None,
        openapi_url="/openapi.json",
    )
    app.state.settings = settings
    register_exception_handlers(app)

    app.include_router(health.router)
    api = APIRouter(prefix=API_PREFIX)
    api.include_router(clinic.router)
    api.include_router(departments.router)
    api.include_router(doctors.router)
    api.include_router(lab_tests.router)
    api.include_router(packages.router)
    api.include_router(slots.router)
    api.include_router(appointments.router)
    api.include_router(admin_auth.router)
    api.include_router(admin_staff.router)
    api.include_router(admin_bookings.router)
    api.include_router(admin_dashboard.router)
    app.include_router(api)

    # add_middleware wraps the current stack, so the LAST one added is the OUTERMOST.
    # Effective order, outermost first: RequestId -> AccessLog -> SecurityHeaders -> CORS
    # -> RateLimit -> UnhandledError -> routes. Rate limiting sits inside CORS so a 429 still
    # carries CORS and security headers, and preflight requests are not counted.
    app.add_middleware(UnhandledErrorMiddleware)
    app.add_middleware(
        RateLimitMiddleware,
        limiter=InMemoryFixedWindowLimiter(settings.rate_limit_per_minute),
        trusted_proxy_hops=settings.trusted_proxy_hops,
        proxy_secret=settings.booking_proxy_secret.get_secret_value(),
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET"],
        allow_headers=["If-None-Match", "X-Request-ID"],
        expose_headers=["ETag", "X-Request-ID", "Retry-After"],
        allow_credentials=False,
    )
    app.add_middleware(SecurityHeadersMiddleware, hsts=settings.app_env == "production")
    app.add_middleware(AccessLogMiddleware)
    app.add_middleware(RequestIdMiddleware)
    return app


@lru_cache
def _default_app() -> FastAPI:
    return create_app()


def __getattr__(name: str) -> FastAPI:
    if name == "app":
        return _default_app()
    raise AttributeError(name)
