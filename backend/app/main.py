"""Application factory.

Run with ``uv run uvicorn app.main:app --port 8000 --no-access-log``. ``app`` is built lazily on
first access, so importing this module never reads configuration.
"""

from functools import lru_cache

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.errors import UnhandledErrorMiddleware, register_exception_handlers
from app.logging_config import configure_logging
from app.middleware.access_log import AccessLogMiddleware
from app.middleware.request_id import RequestIdMiddleware
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.routers import departments, doctors, health, lab_tests, packages
from app.settings import Settings, get_settings

API_PREFIX = "/api/v1"


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    configure_logging(settings.log_level)
    docs_enabled = settings.app_env == "development"

    app = FastAPI(
        title="Clinic Catalog API",
        version="1.0.0",
        debug=False,
        docs_url="/docs" if docs_enabled else None,
        redoc_url="/redoc" if docs_enabled else None,
        openapi_url="/openapi.json",
    )
    app.state.settings = settings
    register_exception_handlers(app)

    app.include_router(health.router)
    api = APIRouter(prefix=API_PREFIX)
    api.include_router(departments.router)
    api.include_router(doctors.router)
    api.include_router(lab_tests.router)
    api.include_router(packages.router)
    app.include_router(api)

    # add_middleware wraps the current stack, so the LAST one added is the OUTERMOST.
    # Effective order, outermost first: RequestId -> AccessLog -> SecurityHeaders -> CORS
    # -> UnhandledError -> routes.
    app.add_middleware(UnhandledErrorMiddleware)
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
