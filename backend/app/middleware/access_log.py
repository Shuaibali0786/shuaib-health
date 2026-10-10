"""One structured log line per request. Logs the path only, never the query string."""

import logging
import time

from starlette.types import ASGIApp, Message, Receive, Scope, Send

logger = logging.getLogger("app.access")
ADMIN_PREFIX = "/api/v1/admin/"


def xff_hops(scope: Scope) -> int:
    """How many addresses ``X-Forwarded-For`` lists. A count only, never the addresses.

    Used to measure ``TRUSTED_PROXY_HOPS`` on the live host (FR-031).
    """
    for key, value in scope.get("headers", []):
        if key == b"x-forwarded-for":
            return len([p for p in value.decode("latin-1").split(",") if p.strip()])
    return 0


def outcome_of(status: int) -> str:
    """A coarse, countable result for the operator (NFR-003)."""
    if status < 400:
        return "ok"
    if status in (401, 403):
        return "refused"
    if status == 429:
        return "rate_limited"
    return "invalid" if status < 500 else "error"


class AccessLogMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        started = time.perf_counter()
        status = 500

        async def capture_status(message: Message) -> None:
            nonlocal status
            if message["type"] == "http.response.start":
                status = int(message["status"])
            await send(message)

        try:
            await self.app(scope, receive, capture_status)
        finally:
            route = scope.get("route")
            fields = {
                "event": "request",
                "method": scope.get("method"),
                "path": scope.get("path"),
                "route": getattr(route, "path", None),
                "status": status,
                "durationMs": round((time.perf_counter() - started) * 1000, 1),
                "xffHops": xff_hops(scope),
            }
            if str(scope.get("path", "")).startswith(ADMIN_PREFIX):
                state = scope.get("state") or {}
                fields["role"] = state.get("cc_role", "none")
                fields["outcome"] = outcome_of(status)
                logger.info("request", extra=fields)
                if fields["outcome"] == "refused":
                    # Refusals are counted separately; only the code, never who or what.
                    refused = {k: fields[k] for k in ("method", "route", "status", "role")}
                    logger.info(
                        "request.refused",
                        extra={"event": "request.refused", "code": state.get("cc_code"), **refused},
                    )
            else:
                logger.info("request", extra=fields)
