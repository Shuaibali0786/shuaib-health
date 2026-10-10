"""Error reporting to Sentry with no personal data (007, US3).

Reporting is off unless ``SENTRY_DSN`` is set. Every event passes through ``scrub_event`` before it
leaves the process: cookies, credentials and proxy headers, query strings and request bodies are
dropped, and anything shaped like a phone number, an email address or a booking reference is masked
in every string. Nothing runs after the response (condition C3): the unhandled-error handler flushes
before it answers.
"""

import os
import re
from typing import Any

import sentry_sdk
from sentry_sdk.integrations.logging import LoggingIntegration

from app.settings import Settings

TRACES_SAMPLE_RATE = 0.02
FLUSH_TIMEOUT_SECONDS = 2

_SENSITIVE_HEADER_PARTS = (
    "cookie",
    "auth",
    "token",
    "secret",
    "key",
    "proxy",
    "csrf",
    "session",
    "forwarded",
    "client-ip",
    "real-ip",
    "bypass",
    "x-vercel",
)
_EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
# 10 characters of the reference alphabet (no I, L, O, U), alone or in two groups of five.
_REFERENCE_GROUPED = re.compile(r"\b[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}\b", re.IGNORECASE)
_REFERENCE = re.compile(r"\b[0-9A-HJKMNP-TV-Z]{10}\b")
_PHONE = re.compile(r"(?<!\w)\+?\d[\d\s().-]{7,}\d")
_URL_QUERY = re.compile(r"(\S+?)\?[^\s\"'#]*")
_REQUEST_DROP = ("cookies", "data", "query_string", "env")


def mask_text(text: str) -> str:
    text = _EMAIL.sub("[email]", text)
    text = _REFERENCE_GROUPED.sub("[reference]", text)
    text = _REFERENCE.sub("[reference]", text)
    text = _PHONE.sub("[phone]", text)
    return _URL_QUERY.sub(r"\1", text)


def _is_sensitive_header(name: str) -> bool:
    lowered = name.lower()
    return any(part in lowered for part in _SENSITIVE_HEADER_PARTS)


def _walk(value: Any) -> Any:
    if isinstance(value, str):
        return mask_text(value)
    if isinstance(value, dict):
        return {key: _walk(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_walk(item) for item in value]
    if isinstance(value, tuple):
        return tuple(_walk(item) for item in value)
    return value


def scrub_event(event: Any, hint: Any = None) -> Any:
    """The ``before_send`` hook: return a copy of the event that holds no personal data."""
    request = event.get("request")
    if isinstance(request, dict):
        for key in _REQUEST_DROP:
            request.pop(key, None)
        headers = request.get("headers")
        if isinstance(headers, dict):
            request["headers"] = {k: v for k, v in headers.items() if not _is_sensitive_header(k)}
    event.pop("user", None)
    event.pop("server_name", None)
    return _walk(event)


def init_observability(settings: Settings) -> bool:
    """Start Sentry when a DSN is configured. Returns whether reporting is on."""
    if settings.sentry_dsn is None:
        return False
    sentry_sdk.init(
        dsn=settings.sentry_dsn.get_secret_value(),
        environment=os.environ.get("VERCEL_ENV") or settings.app_env,
        release=(os.environ.get("VERCEL_GIT_COMMIT_SHA") or "")[:7] or None,
        send_default_pii=False,
        include_local_variables=False,
        max_request_body_size="never",
        max_breadcrumbs=20,
        traces_sample_rate=TRACES_SAMPLE_RATE,
        before_send=scrub_event,
        before_send_transaction=scrub_event,
        # Errors are reported once, explicitly, by the unhandled-error handler; no log-line events.
        integrations=[LoggingIntegration(level=None, event_level=None)],
    )
    return True


def report_unhandled(error: BaseException) -> None:
    """Send one captured error and wait briefly, so the work finishes inside the request (C3)."""
    if not sentry_sdk.is_initialized():
        return
    sentry_sdk.capture_exception(error)
    sentry_sdk.flush(timeout=FLUSH_TIMEOUT_SECONDS)
