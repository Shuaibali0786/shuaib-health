"""One JSON error format for every failure. Never returns stack traces, SQL or input values."""

import json
import logging
from collections.abc import Mapping
from typing import Literal, cast

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic.alias_generators import to_camel
from sqlalchemy.exc import InterfaceError, OperationalError
from sqlalchemy.exc import TimeoutError as PoolTimeoutError
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.logging_config import request_id_var
from app.observability import report_unhandled
from app.schemas import AlternativeSlot, ErrorDetail, ErrorInfo, ErrorResponse

logger = logging.getLogger("app.errors")


class NotFound(Exception):
    def __init__(self, resource: str) -> None:
        super().__init__(resource)
        self.resource = resource


class ClinicNotConfigured(Exception):
    pass


class StoredDataInvalid(Exception):
    """Stored data does not match its schema. Becomes a generic 500; the data is never echoed."""


class RateLimited(Exception):
    def __init__(self, retry_after: int) -> None:
        super().__init__(retry_after)
        self.retry_after = retry_after


BookingConflictCode = Literal[
    "slot_taken", "slot_unavailable", "booking_limit_reached", "idempotency_key_reused"
]
REQUEST_REJECTED_MESSAGE = "We couldn't process this booking. Please call the clinic."


class BookingConflict(Exception):
    """409. ``alternatives`` is only sent for slot_taken and slot_unavailable."""

    def __init__(
        self,
        code: BookingConflictCode,
        message: str,
        alternatives: list[AlternativeSlot] | None = None,
    ) -> None:
        super().__init__(code)
        self.code: BookingConflictCode = code
        self.message = message
        self.alternatives = alternatives


class RequestInvalid(Exception):
    """422 for a rule only the server can check (for example an inactive doctor)."""

    def __init__(self, field: str, issue: str) -> None:
        super().__init__(field)
        self.field = field
        self.issue = issue


class Forbidden(Exception):
    """403. Missing or wrong proxy secret, or a browser origin that is not allowed."""


class RequestRejected(Exception):
    """400. Generic refusal (for example the honeypot field was filled); gives nothing away."""


AdminErrorCode = Literal[
    "not_signed_in",
    "session_expired",
    "forbidden",
    "demo_read_only",
    "password_change_required",
    "csrf_failed",
    "sign_in_failed",
    "account_locked",
    "weak_password",
    "email_taken",
    "last_admin",
    "transition_not_allowed",
    "booking_changed",
    "undo_unavailable",
    "slot_taken",
]
# code -> (status, calm message). The message never says which part of a sign-in was wrong.
ADMIN_ERRORS: dict[str, tuple[int, str]] = {
    "not_signed_in": (401, "Please sign in."),
    "session_expired": (401, "Your session has ended. Please sign in again."),
    "forbidden": (403, "You do not have access to this."),
    "demo_read_only": (403, "The demo is read-only."),
    "password_change_required": (403, "Please choose a new password first."),
    "csrf_failed": (403, "The request could not be verified."),
    "sign_in_failed": (401, "Email or password is incorrect."),
    "account_locked": (429, "Too many attempts. Try again later."),
    "weak_password": (422, "That password is not strong enough."),
    "email_taken": (409, "That email is already in use."),
    "last_admin": (409, "There must be at least one active admin."),
    "transition_not_allowed": (409, "That status change is not allowed."),
    "booking_changed": (409, "This booking was changed by someone else."),
    "undo_unavailable": (409, "This change can no longer be undone."),
    "slot_taken": (409, "That time slot has been taken."),
}


class AdminError(Exception):
    """A Command Centre refusal. ``code`` picks the status and message from ``ADMIN_ERRORS``."""

    def __init__(
        self,
        code: AdminErrorCode,
        *,
        retry_after: int | None = None,
        extra: Mapping[str, object] | None = None,
    ) -> None:
        super().__init__(code)
        self.code: AdminErrorCode = code
        self.retry_after = retry_after
        self.extra = extra


_HTTP_CODES: dict[int, tuple[str, str]] = {
    404: ("not_found", "Not found."),
    405: ("method_not_allowed", "Method not allowed."),
}


def error_body(code: str, message: str, details: list[ErrorDetail] | None = None) -> bytes:
    info = ErrorInfo(code=code, message=message, request_id=request_id_var.get(), details=details)
    return ErrorResponse(error=info).model_dump_json(by_alias=True, exclude_none=True).encode()


def error_response(
    status: int,
    code: str,
    message: str,
    details: list[ErrorDetail] | None = None,
    headers: Mapping[str, str] | None = None,
    extra: Mapping[str, object] | None = None,
) -> JSONResponse:
    response = JSONResponse(status_code=status, content=None, headers=dict(headers or {}))
    response.body = error_body(code, message, details)
    if extra:
        response.body = json.dumps({**json.loads(response.body), **extra}).encode()
    response.headers["Content-Length"] = str(len(response.body))
    response.headers["Cache-Control"] = "no-store"
    return response


def _issue(error: Mapping[str, object]) -> str:
    kind = str(error.get("type", ""))
    ctx = error.get("ctx")
    limits = ctx if isinstance(ctx, Mapping) else {}
    messages = {
        "missing": "is required",
        "int_parsing": "must be a whole number",
        "greater_than_equal": f"must be >= {limits.get('ge')}",
        "less_than_equal": f"must be <= {limits.get('le')}",
        "string_too_short": f"must be at least {limits.get('min_length')} characters",
        "string_too_long": f"must be at most {limits.get('max_length')} characters",
        "string_pattern_mismatch": "has an invalid format",
        "literal_error": f"must be one of {limits.get('expected')}",
        "enum": f"must be one of {limits.get('expected')}",
    }
    return messages.get(kind, "is invalid")


def _field_name(loc: object) -> str:
    if isinstance(loc, tuple | list) and loc:
        return to_camel(str(loc[-1]))
    return "request"


async def _http_exception(_: Request, exc: Exception) -> JSONResponse:
    http_exc = cast(StarletteHTTPException, exc)
    code, message = _HTTP_CODES.get(http_exc.status_code, ("http_error", "Request failed."))
    return error_response(http_exc.status_code, code, message, headers=http_exc.headers)


async def _validation_error(_: Request, exc: Exception) -> JSONResponse:
    errors = cast(RequestValidationError, exc).errors()
    details = [
        ErrorDetail(field=_field_name(error.get("loc")), issue=_issue(error)) for error in errors
    ]
    return error_response(422, "validation_error", "Some request parameters are invalid.", details)


async def _not_found(_: Request, exc: Exception) -> JSONResponse:
    resource = cast(NotFound, exc).resource
    return error_response(404, "not_found", f"{resource} not found.")


async def _not_configured(_: Request, __: Exception) -> JSONResponse:
    return error_response(503, "not_configured", "The clinic has not been configured yet.")


def rate_limited_response(retry_after: int) -> JSONResponse:
    return error_response(
        429,
        "rate_limited",
        "Too many requests. Please try again shortly.",
        headers={"Retry-After": str(retry_after)},
    )


async def _rate_limited(_: Request, exc: Exception) -> JSONResponse:
    return rate_limited_response(cast(RateLimited, exc).retry_after)


async def _booking_conflict(_: Request, exc: Exception) -> JSONResponse:
    conflict = cast(BookingConflict, exc)
    extra: dict[str, object] | None = None
    if conflict.alternatives is not None:
        extra = {
            "alternatives": [
                a.model_dump(by_alias=True, mode="json") for a in conflict.alternatives
            ]
        }
    return error_response(409, conflict.code, conflict.message, extra=extra)


async def _request_invalid(_: Request, exc: Exception) -> JSONResponse:
    invalid = cast(RequestInvalid, exc)
    details = [ErrorDetail(field=invalid.field, issue=invalid.issue)]
    return error_response(422, "validation_error", "Some request parameters are invalid.", details)


async def _forbidden(request: Request, __: Exception) -> JSONResponse:
    request.state.cc_code = "forbidden"
    return error_response(403, "forbidden", "Forbidden.")


async def _request_rejected(_: Request, __: Exception) -> JSONResponse:
    return error_response(400, "request_rejected", REQUEST_REJECTED_MESSAGE)


async def _admin_error(request: Request, exc: Exception) -> JSONResponse:
    error = cast(AdminError, exc)
    request.state.cc_code = error.code  # read by the access log, never logged with any input
    status, message = ADMIN_ERRORS[error.code]
    headers = {"Retry-After": str(error.retry_after)} if error.retry_after is not None else None
    response = error_response(status, error.code, message, headers=headers, extra=error.extra)
    if error.retry_after is not None:
        body = json.loads(bytes(response.body))
        body["error"]["retryAfterSeconds"] = error.retry_after
        response.body = json.dumps(body).encode()
        response.headers["Content-Length"] = str(len(response.body))
    return response


async def _database_unavailable(_: Request, exc: Exception) -> JSONResponse:
    logger.error("database unavailable: %s", type(exc).__name__)
    return error_response(503, "service_unavailable", "The service is temporarily unavailable.")


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(StarletteHTTPException, _http_exception)
    app.add_exception_handler(RequestValidationError, _validation_error)
    app.add_exception_handler(NotFound, _not_found)
    app.add_exception_handler(ClinicNotConfigured, _not_configured)
    app.add_exception_handler(RateLimited, _rate_limited)
    app.add_exception_handler(BookingConflict, _booking_conflict)
    app.add_exception_handler(RequestInvalid, _request_invalid)
    app.add_exception_handler(Forbidden, _forbidden)
    app.add_exception_handler(RequestRejected, _request_rejected)
    app.add_exception_handler(AdminError, _admin_error)
    for db_error in (OperationalError, InterfaceError, PoolTimeoutError):
        app.add_exception_handler(db_error, _database_unavailable)


class UnhandledErrorMiddleware:
    """Turn any unexpected exception into the standard 500 body.

    Starlette sends ``Exception`` handlers to its outermost middleware, which would bypass the
    request-ID and security-header middleware. This one sits inside them instead.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        started = False

        async def track(message: Message) -> None:
            nonlocal started
            if message["type"] == "http.response.start":
                started = True
            await send(message)

        try:
            await self.app(scope, receive, track)
        except Exception as exc:
            logger.error("unhandled error: %s", type(exc).__name__, exc_info=exc)
            report_unhandled(exc)
            if started:
                raise
            response = error_response(500, "internal_error", "Something went wrong.")
            await response(scope, receive, send)
