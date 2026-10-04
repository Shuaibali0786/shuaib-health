"""Per-IP rate limiting.

The in-memory fixed-window store is per process; it is hidden behind the ``RateLimiter``
protocol so a shared store (for example Redis) can replace it when more than one instance runs.
"""

import hmac
import ipaddress
import math
import threading
import time
from collections.abc import Callable
from typing import Protocol

from starlette.types import ASGIApp, Receive, Scope, Send

from app.errors import rate_limited_response

WINDOW_SECONDS = 60
EXEMPT_PATHS = frozenset({"/health"})


class RateLimiter(Protocol):
    def hit(self, key: str, now: float) -> int | None:
        """Count one request. Return ``None`` if allowed, else seconds until it may retry."""
        ...


class InMemoryFixedWindowLimiter:
    def __init__(self, limit: int, window_seconds: int = WINDOW_SECONDS) -> None:
        self.limit = limit
        self.window = window_seconds
        self._windows: dict[str, tuple[float, int]] = {}
        self._last_eviction = 0.0
        self._lock = threading.Lock()

    def hit(self, key: str, now: float) -> int | None:
        with self._lock:
            self._evict(now)
            start, count = self._windows.get(key, (now, 0))
            if now - start >= self.window:
                start, count = now, 0
            if count >= self.limit:
                return max(1, math.ceil(start + self.window - now))
            self._windows[key] = (start, count + 1)
            return None

    def _evict(self, now: float) -> None:
        if now - self._last_eviction < self.window:
            return
        self._last_eviction = now
        expired = [k for k, (start, _) in self._windows.items() if now - start >= self.window]
        for key in expired:
            del self._windows[key]


def _header(scope: Scope, name: bytes) -> str | None:
    for key, value in scope.get("headers", []):
        if key == name:
            return str(value.decode("latin-1"))
    return None


def client_ip(scope: Scope, trusted_proxy_hops: int, proxy_secret: str | None = None) -> str:
    """The caller's address.

    A request that carries a valid ``X-Proxy-Secret`` comes from our own website server, which
    reports the visitor's address in ``X-Client-IP``; that address is used when it parses.
    Otherwise ``X-Forwarded-For`` is ignored unless ``trusted_proxy_hops`` > 0, because any client
    can send that header. With N trusted proxies the address is the Nth entry from the right.
    """
    client = scope.get("client")
    socket_address = str(client[0]) if client else "unknown"

    if proxy_secret:
        presented = _header(scope, b"x-proxy-secret")
        if presented is not None and hmac.compare_digest(presented.encode(), proxy_secret.encode()):
            reported = _header(scope, b"x-client-ip")
            if reported is not None:
                try:
                    return str(ipaddress.ip_address(reported.strip()))
                except ValueError:
                    pass

    if trusted_proxy_hops <= 0:
        return socket_address
    forwarded_for = _header(scope, b"x-forwarded-for")
    if forwarded_for is not None:
        parts = [p.strip() for p in forwarded_for.split(",") if p.strip()]
        if len(parts) >= trusted_proxy_hops:
            candidate = parts[-trusted_proxy_hops]
            try:
                return str(ipaddress.ip_address(candidate))
            except ValueError:
                return socket_address
    return socket_address


class RateLimitMiddleware:
    def __init__(
        self,
        app: ASGIApp,
        *,
        limiter: RateLimiter,
        trusted_proxy_hops: int = 0,
        proxy_secret: str | None = None,
        exempt_paths: frozenset[str] = EXEMPT_PATHS,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.app = app
        self.limiter = limiter
        self.trusted_proxy_hops = trusted_proxy_hops
        self.proxy_secret = proxy_secret
        self.exempt_paths = exempt_paths
        self.clock = clock

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope.get("path") in self.exempt_paths:
            await self.app(scope, receive, send)
            return
        retry_after = self.limiter.hit(
            client_ip(scope, self.trusted_proxy_hops, self.proxy_secret), self.clock()
        )
        if retry_after is not None:
            await rate_limited_response(retry_after)(scope, receive, send)
            return
        await self.app(scope, receive, send)
