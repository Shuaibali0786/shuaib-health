"""One structured log line per request. Logs the path only, never the query string."""

import logging
import time

from starlette.types import ASGIApp, Message, Receive, Scope, Send

logger = logging.getLogger("app.access")


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
            logger.info(
                "request",
                extra={
                    "event": "request",
                    "method": scope.get("method"),
                    "path": scope.get("path"),
                    "route": getattr(route, "path", None),
                    "status": status,
                    "durationMs": round((time.perf_counter() - started) * 1000, 1),
                },
            )
