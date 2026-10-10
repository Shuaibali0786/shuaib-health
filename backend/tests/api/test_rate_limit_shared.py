"""The general per-IP limiter on shared state (condition C2): Postgres, not process memory."""

import time
import uuid
from typing import Any

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import Engine, text
from sqlmodel import Session

from app.db import get_engine, get_session, make_engine
from app.main import create_app
from app.middleware.rate_limit import PostgresFixedWindowLimiter
from tests.conftest import SettingsFactory

SECRET = "test-proxy-secret-0123456789abcdef"
DEAD = SecretStr("postgresql+psycopg://u:p@127.0.0.1:1/db?sslmode=require")
HASH_KEY = SecretStr("test-privacy-key-0123456789abcdefgh")


def counters(engine: Engine) -> int:
    with engine.connect() as conn:
        return int(conn.execute(text("SELECT count(*) FROM rate_limit_counter")).scalar_one())


def wait_for_fresh_minute() -> None:
    """Counters use fixed 60 s windows; start a test right after one begins."""
    left = 60 - time.time() % 60
    if left < 20:
        time.sleep(left + 0.5)


@pytest.fixture
def shared(seeded_engine: Engine) -> Any:
    yield seeded_engine
    with seeded_engine.begin() as conn:
        conn.execute(text("DELETE FROM rate_limit_counter"))


@pytest.mark.db
def test_two_instances_sharing_one_database_share_the_count(
    shared: Engine, settings_factory: SettingsFactory
) -> None:
    wait_for_fresh_minute()

    def instance() -> TestClient:
        app = create_app(settings_factory(rate_limit_store="postgres", rate_limit_per_minute=6))
        app.dependency_overrides[get_engine] = lambda: shared
        return TestClient(app)

    first, second = instance(), instance()
    codes = [(first if i % 2 == 0 else second).get("/api/v1/nope").status_code for i in range(6)]
    assert codes == [404] * 6
    assert first.get("/api/v1/nope").status_code == 429  # the 7th, across both instances
    assert second.get("/api/v1/nope").status_code == 429


@pytest.mark.db
def test_health_never_writes_a_counter(shared: Engine, settings_factory: SettingsFactory) -> None:
    app = create_app(settings_factory(rate_limit_store="postgres", rate_limit_per_minute=1))
    app.dependency_overrides[get_engine] = lambda: shared
    client = TestClient(app)
    before = counters(shared)
    assert all(client.get("/health").status_code == 200 for _ in range(5))
    assert counters(shared) == before


@pytest.mark.db
def test_buckets_hold_a_hash_not_the_address(shared: Engine) -> None:
    limiter = PostgresFixedWindowLimiter(lambda: shared, HASH_KEY, limit=5)
    assert limiter.hit("203.0.113.9", 0.0) is None
    with shared.connect() as conn:
        buckets = [r[0] for r in conn.execute(text("SELECT bucket FROM rate_limit_counter"))]
    assert buckets and all("203.0.113.9" not in b for b in buckets)


def test_the_general_check_fails_open_and_logs_only_the_error_class(
    caplog: pytest.LogCaptureFixture,
) -> None:
    dead = make_engine(DEAD, connect_timeout=1)
    limiter = PostgresFixedWindowLimiter(lambda: dead, HASH_KEY, limit=1)
    with caplog.at_level("WARNING", logger="app.ratelimit"):
        assert [limiter.hit("198.51.100.1", 0.0) for _ in range(3)] == [None, None, None]
    messages = " ".join(r.getMessage() for r in caplog.records)
    assert "rate_limit_store_unavailable: OperationalError" in messages
    assert "127.0.0.1" not in messages and "198.51.100.1" not in messages


BOOKING = {
    "doctorSlug": "dr-omar-sheikh",
    "startsAt": "2026-10-06T09:00:00Z",
    "fullName": "Ali Khan",
    "mobile": "0300 1234567",
    "acceptRules": True,
}


def test_a_database_failure_lets_the_general_check_through_but_not_booking_login_or_demo(
    settings_factory: SettingsFactory,
) -> None:
    dead = make_engine(DEAD, connect_timeout=1)
    app = create_app(settings_factory(rate_limit_store="postgres", rate_limit_per_minute=1))
    app.dependency_overrides[get_engine] = lambda: dead

    def dead_session() -> Any:
        with Session(dead) as session:
            yield session

    app.dependency_overrides[get_session] = dead_session
    client = TestClient(app, raise_server_exceptions=False)
    proxy = {"X-Proxy-Secret": SECRET}

    # General check: more than the limit of 1 per minute, none refused with 429.
    assert [client.get("/api/v1/nope").status_code for _ in range(3)] == [404, 404, 404]

    booking = client.post(
        "/api/v1/appointments",
        json=BOOKING,
        headers={**proxy, "Idempotency-Key": str(uuid.uuid4())},
    )
    sign_in = client.post(
        "/api/v1/admin/auth/sign-in",
        json={"email": "owner@example.org", "password": "irrelevant-Pass-1"},
        headers=proxy,
    )
    demo = client.post("/api/v1/admin/demo/start", headers=proxy)
    for response in (booking, sign_in, demo):
        assert response.status_code >= 500, response.text  # blocked, not served
        assert response.status_code != 429
