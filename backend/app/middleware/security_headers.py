"""Standard security headers on every response."""

from starlette.datastructures import MutableHeaders
from starlette.types import ASGIApp, Message, Receive, Scope, Send

API_CSP = "default-src 'none'; frame-ancestors 'none'"
# Swagger UI / ReDoc load their assets from jsDelivr; only served when APP_ENV=development.
DOCS_CSP = (
    "default-src 'self'; "
    "script-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'; "
    "style-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'; "
    "img-src 'self' data: https://fastapi.tiangolo.com; "
    "worker-src 'self' blob:; "
    "frame-ancestors 'none'"
)
DOCS_PATHS = frozenset({"/docs", "/redoc"})
HSTS = "max-age=63072000; includeSubDomains"

STATIC_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Resource-Policy": "same-site",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
}


class SecurityHeadersMiddleware:
    def __init__(self, app: ASGIApp, *, hsts: bool = False) -> None:
        self.app = app
        self.hsts = hsts

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        csp = DOCS_CSP if scope.get("path") in DOCS_PATHS else API_CSP
        add_hsts = self.hsts or scope.get("scheme") == "https"

        async def send_with_headers(message: Message) -> None:
            if message["type"] == "http.response.start":
                headers = MutableHeaders(scope=message)
                for name, value in STATIC_HEADERS.items():
                    headers[name] = value
                headers["Content-Security-Policy"] = csp
                if add_hsts:
                    headers["Strict-Transport-Security"] = HSTS
            await send(message)

        await self.app(scope, receive, send_with_headers)
