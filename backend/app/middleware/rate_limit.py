"""Per-IP rate limiting.

The in-memory fixed-window store is per process; it is hidden behind the ``RateLimiter``
protocol. On serverless hosting every instance has its own memory, so production uses
``PostgresFixedWindowLimiter`` (shared state, ``RATE_LIMIT_STORE=postgres``).
"""

import hmac
import ipaddress
import logging
import math
import threading
import time
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Protocol

from pydantic import SecretStr
from sqlalchemy import Engine
from starlette.types import ASGIApp, Receive, Scope, Send

from app.booking import limits
from app.booking.privacy import hmac_hex
from app.errors import rate_limited_response

logger = logging.getLogger("app.ratelimit")

WINDOW_SECONDS = 60
EXEMPT_PATHS = frozenset({"/health"})
CRON_PREFIX = "/internal/maintenance/"


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


class PostgresFixedWindowLimiter:
    """Fixed-window counters shared by every instance, in the ``rate_limit_counter`` table.

    Buckets hold an HMAC of the address, never the address. If the database cannot be reached the
    request is allowed and only the error class is logged: this general per-IP check fails open
    (ADR-0011 C2). Booking, login, lookup and demo-start limits keep blocking, unchanged.
    """

    def __init__(
        self,
        engine_factory: Callable[[], Engine],
        key: SecretStr,
        limit: int,
        window_seconds: int = WINDOW_SECONDS,
        wall_clock: Callable[[], datetime] = lambda: datetime.now(UTC),
    ) -> None:
        self._engine_factory = engine_factory
        self._key = key
        self.limit = limit
        self.window = timedelta(seconds=window_seconds)
        self._wall_clock = wall_clock

    def hit(self, key: str, now: float) -> int | None:
        bucket = f"general:ip:{hmac_hex(self._key, 'general-ip', key)}"
        try:
            return limits.hit(
                self._engine_factory(), bucket, self.window, self.limit, self._wall_clock()
            )
        except Exception as error:
            logger.warning("rate_limit_store_unavailable: %s", type(error).__name__)
            return None


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
        cron_secret: str | None = None,
        trusted_server_exempt: bool = False,
        exempt_paths: frozenset[str] = EXEMPT_PATHS,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self.app = app
        self.limiter = limiter
        self.trusted_proxy_hops = trusted_proxy_hops
        self.proxy_secret = proxy_secret
        self.cron_secret = cron_secret
        self.trusted_server_exempt = trusted_server_exempt
        self.exempt_paths = exempt_paths
        self.clock = clock

    def _is_authorised_cron(self, scope: Scope) -> bool:
        """The daily maintenance call is exempt, but only with the right bearer token."""
        if not self.cron_secret or not str(scope.get("path", "")).startswith(CRON_PREFIX):
            return False
        presented = _header(scope, b"authorization") or ""
        if not presented.lower().startswith("bearer "):
            return False
        return hmac.compare_digest(presented[7:].strip().encode(), self.cron_secret.encode())

    def _is_trusted_server_call(self, scope: Scope) -> bool:
        """Our own website server (valid proxy secret) acting without a visitor: builds and ISR.

        Only when ``trusted_server_exempt`` is on. A request that names a visitor in
        ``X-Client-IP`` is not exempt; it is counted against that visitor instead.
        """
        if not self.trusted_server_exempt or not self.proxy_secret:
            return False
        presented = _header(scope, b"x-proxy-secret")
        if presented is None:
            return False
        if not hmac.compare_digest(presented.encode(), self.proxy_secret.encode()):
            return False
        return _header(scope, b"x-client-ip") is None

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope.get("path") in self.exempt_paths:
            await self.app(scope, receive, send)
            return
        if self._is_authorised_cron(scope) or self._is_trusted_server_call(scope):
            await self.app(scope, receive, send)
            return
        retry_after = self.limiter.hit(
            client_ip(scope, self.trusted_proxy_hops, self.proxy_secret), self.clock()
        )
        if retry_after is not None:
            await rate_limited_response(retry_after)(scope, receive, send)
            return
        await self.app(scope, receive, send)
