"""Shared route dependencies and OpenAPI error documentation."""

import hmac
from typing import Annotated

from fastapi import Depends, Request

from app.errors import Forbidden
from app.middleware.rate_limit import client_ip
from app.schemas import ErrorResponse
from app.settings import Settings


def get_app_settings(request: Request) -> Settings:
    settings: Settings = request.app.state.settings
    return settings


SettingsDep = Annotated[Settings, Depends(get_app_settings)]


def get_client_ip(request: Request, settings: SettingsDep) -> str:
    """The caller's address; ``X-Client-IP`` counts only with a valid ``X-Proxy-Secret``."""
    secret = settings.booking_proxy_secret.get_secret_value()
    return client_ip(request.scope, settings.trusted_proxy_hops, secret)


ClientIpDep = Annotated[str, Depends(get_client_ip)]


def require_proxy_secret(request: Request, settings: SettingsDep) -> None:
    """Booking writes come from the website server, never straight from a browser.

    A browser always sends ``Origin`` on a cross-origin POST, so an ``Origin`` that is not in
    ``cors_origins`` is refused even when the secret is right. The secret is always required; a
    request without ``Origin`` passes only together with it (server to server).
    """
    origin = request.headers.get("origin")
    if origin is not None and origin not in settings.cors_origins:
        raise Forbidden
    presented = request.headers.get("x-proxy-secret")
    expected = settings.booking_proxy_secret.get_secret_value()
    if presented is None or not hmac.compare_digest(presented.encode(), expected.encode()):
        raise Forbidden


ProxySecretDep = Depends(require_proxy_secret)

LIST_ERRORS: dict[int | str, dict[str, object]] = {
    422: {"model": ErrorResponse},
    429: {"model": ErrorResponse},
}
DETAIL_ERRORS: dict[int | str, dict[str, object]] = {404: {"model": ErrorResponse}, **LIST_ERRORS}
