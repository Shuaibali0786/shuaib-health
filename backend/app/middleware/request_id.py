"""Give every request an ID, echo it in ``X-Request-ID`` and expose it to logs and errors."""

import re
from uuid import uuid4

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.logging_config import request_id_var

HEADER = "x-request-id"
_VALID_RE = re.compile(r"^[A-Za-z0-9._-]{8,64}$")


def choose_request_id(incoming: str | None) -> str:
    if incoming is not None and _VALID_RE.match(incoming):
        return incoming
    return uuid4().hex


class RequestIdMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        incoming = None
        for name, value in scope.get("headers", []):
            if name == HEADER.encode("latin-1"):
                incoming = value.decode("latin-1")
                break
        request_id = choose_request_id(incoming)
        scope.setdefault("state", {})["request_id"] = request_id
        token = request_id_var.set(request_id)

        async def send_with_id(message: Message) -> None:
            if message["type"] == "http.response.start":
                MutableHeaders(scope=message)["X-Request-ID"] = request_id
            await send(message)

        try:
            await self.app(scope, receive, send_with_id)
        finally:
            request_id_var.reset(token)
