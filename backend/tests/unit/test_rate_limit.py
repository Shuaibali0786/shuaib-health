from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.middleware.rate_limit import (
    InMemoryFixedWindowLimiter,
    RateLimitMiddleware,
    client_ip,
)


def test_allows_the_limit_then_blocks_with_retry_after() -> None:
    limiter = InMemoryFixedWindowLimiter(3)
    assert [limiter.hit("a", 100.0) for _ in range(3)] == [None, None, None]
    assert limiter.hit("a", 110.0) == 50
    assert limiter.hit("a", 159.5) == 1


def test_window_resets() -> None:
    limiter = InMemoryFixedWindowLimiter(1)
    assert limiter.hit("a", 0.0) is None
    assert limiter.hit("a", 30.0) is not None
    assert limiter.hit("a", 60.0) is None


def test_ips_are_independent() -> None:
    limiter = InMemoryFixedWindowLimiter(1)
    assert limiter.hit("a", 0.0) is None
    assert limiter.hit("b", 0.0) is None
    assert limiter.hit("a", 1.0) is not None


def test_expired_windows_are_evicted() -> None:
    limiter = InMemoryFixedWindowLimiter(5)
    for i in range(100):
        limiter.hit(f"ip-{i}", 0.0)
    limiter.hit("late", 200.0)
    assert set(limiter._windows) == {"late"}


def scope_with(forwarded: str | None, client: tuple[str, int] | None = ("9.9.9.9", 1)) -> Any:
    headers = [(b"x-forwarded-for", forwarded.encode())] if forwarded is not None else []
    return {"type": "http", "client": client, "headers": headers}


def test_forwarded_header_is_ignored_without_trusted_proxies() -> None:
    assert client_ip(scope_with("1.2.3.4"), 0) == "9.9.9.9"


@pytest.mark.parametrize(
    ("header", "hops", "expected"),
    [
        ("1.2.3.4", 1, "1.2.3.4"),
        ("6.6.6.6, 1.2.3.4", 1, "1.2.3.4"),
        ("6.6.6.6, 1.2.3.4, 10.0.0.1", 2, "1.2.3.4"),
        ("1.2.3.4", 2, "9.9.9.9"),
        ("not-an-ip", 1, "9.9.9.9"),
        ("", 1, "9.9.9.9"),
    ],
)
def test_forwarded_header_uses_the_hop_from_the_right(
    header: str, hops: int, expected: str
) -> None:
    assert client_ip(scope_with(header), hops) == expected


def test_missing_forwarded_header_and_client() -> None:
    assert client_ip(scope_with(None), 1) == "9.9.9.9"
    assert client_ip(scope_with(None, client=None), 0) == "unknown"


def test_middleware_uses_the_injected_clock_and_exempts_health() -> None:
    now = [0.0]
    app = FastAPI()

    @app.get("/a")
    def a() -> dict[str, str]:
        return {"ok": "yes"}

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"ok": "yes"}

    app.add_middleware(
        RateLimitMiddleware,
        limiter=InMemoryFixedWindowLimiter(2),
        trusted_proxy_hops=0,
        clock=lambda: now[0],
    )
    client = TestClient(app)
    assert [client.get("/a").status_code for _ in range(3)] == [200, 200, 429]
    assert all(client.get("/health").status_code == 200 for _ in range(10))
    blocked = client.get("/a")
    assert blocked.headers["retry-after"] == "60"
    now[0] = 61.0
    assert client.get("/a").status_code == 200
