"""Shared fixtures.

Unit tests build ``Settings`` from fake values and never read backend/.env. Database tests
(marked ``db``) use TEST_DATABASE_URL only, and are skipped with a clear reason when it is not
configured. The test database is migrated from scratch and seeded once per session; each test
runs inside a transaction that is rolled back.
"""

from collections.abc import Callable, Iterator
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import pytest
from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import Connection, Engine, text
from sqlmodel import Session

from app.booking.clock import Clock, get_clock
from app.db import get_engine, get_session, make_engine
from app.main import create_app
from app.seed.loader import run_seed
from app.settings import Settings, get_settings

BACKEND_DIR = Path(__file__).resolve().parent.parent
ALEMBIC_INI = BACKEND_DIR / "alembic.ini"

FAKE_POOLED = "postgresql+psycopg://u:p@ep-fake-pooler.x.aws.neon.tech/db?sslmode=require"
FAKE_DIRECT = "postgresql+psycopg://u:p@ep-fake.x.aws.neon.tech/db?sslmode=require"

SettingsFactory = Callable[..., Settings]


@pytest.fixture
def settings_factory() -> SettingsFactory:
    def build(**overrides: Any) -> Settings:
        values: dict[str, Any] = {
            "app_env": "test",
            "database_url": FAKE_POOLED,
            "direct_database_url": FAKE_DIRECT,
            "test_database_url": None,
            "cors_origins": "http://localhost:3000",
            "booking_proxy_secret": "test-proxy-secret-0123456789abcdef",
            "privacy_hash_key": "test-privacy-key-0123456789abcdefgh",
            "session_secret": "test-session-secret-0123456789abcdef",
        }
        values.update(overrides)
        return Settings(_env_file=None, **values)

    return build


class FrozenClock:
    """A clock that only moves when the test says so."""

    def __init__(self, now: datetime) -> None:
        self._now = now

    def now(self) -> datetime:
        return self._now

    def set(self, now: datetime) -> None:
        self._now = now


# Monday 2026-10-05 09:00 in Asia/Karachi.
FROZEN_NOW = datetime(2026, 10, 5, 4, 0, tzinfo=UTC)


@pytest.fixture
def frozen_clock() -> FrozenClock:
    return FrozenClock(FROZEN_NOW)


def override_clock(app: FastAPI, clock: Clock) -> None:
    """Make ``app`` read time from ``clock`` instead of the system clock."""
    app.dependency_overrides[get_clock] = lambda: clock


@pytest.fixture
def app_client(settings_factory: SettingsFactory) -> TestClient:
    """App with fake database settings, for tests that never touch the database."""
    return TestClient(create_app(settings_factory()), raise_server_exceptions=False)


def alembic_config(connection: Connection) -> Config:
    config = Config(str(ALEMBIC_INI))
    config.attributes["connection"] = connection
    config.attributes["configure_logging"] = False
    return config


def run_alembic(engine: Engine, action: Callable[[Config], None]) -> None:
    with engine.begin() as conn:
        action(alembic_config(conn))


@pytest.fixture(scope="session")
def test_engine() -> Iterator[Engine]:
    try:
        settings = get_settings()
    except ValidationError as exc:
        names = ", ".join(str(e["loc"][0]) for e in exc.errors())
        pytest.skip(f"backend settings invalid: {names}")
    if settings.test_database_url is None:
        pytest.skip("TEST_DATABASE_URL not set")
    # Settings validation already refuses a test URL equal to a dev URL.
    engine = make_engine(settings.test_database_url)
    yield engine
    engine.dispose()


@pytest.fixture(scope="session")
def migrated_engine(test_engine: Engine) -> Engine:
    run_alembic(test_engine, lambda cfg: command.downgrade(cfg, "base"))
    run_alembic(test_engine, lambda cfg: command.upgrade(cfg, "head"))
    return test_engine


@pytest.fixture(scope="session")
def seeded_engine(migrated_engine: Engine) -> Engine:
    run_seed(migrated_engine)
    return migrated_engine


@pytest.fixture
def db_session(seeded_engine: Engine) -> Iterator[Session]:
    connection = seeded_engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection, join_transaction_mode="create_savepoint")
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def make_client(
    settings_factory: SettingsFactory, db_session: Session, seeded_engine: Engine
) -> Iterator[Callable[..., TestClient]]:
    """Build a client on the seeded test database, with optional settings overrides.

    Rate-limit counters commit on their own connection, so they are emptied after each test.
    """

    def build(**overrides: Any) -> TestClient:
        app = create_app(settings_factory(**overrides))
        app.dependency_overrides[get_session] = lambda: db_session
        app.dependency_overrides[get_engine] = lambda: seeded_engine
        return TestClient(app, raise_server_exceptions=False)

    yield build
    with seeded_engine.begin() as conn:
        conn.execute(text("DELETE FROM rate_limit_counter"))


@pytest.fixture
def client(make_client: Callable[..., TestClient]) -> TestClient:
    return make_client()


@pytest.fixture(scope="session")
def committing_engine(seeded_engine: Engine) -> Iterator[Engine]:
    """A pool large enough for 20 racing requests, on the migrated and seeded test database.

    Unlike ``db_session`` nothing here is rolled back, so concurrency and retention tests commit
    for real. Request ``committing_cleanup`` (``make_committing_client`` does) to empty the
    booking tables after each test.
    """
    settings = get_settings()
    assert settings.test_database_url is not None
    engine = make_engine(settings.test_database_url, pool_size=25, max_overflow=5)
    yield engine
    engine.dispose()


@pytest.fixture
def committing_cleanup(committing_engine: Engine) -> Iterator[None]:
    yield
    with committing_engine.begin() as conn:
        conn.execute(
            text(
                "TRUNCATE appointment, appointment_status_change, idempotency_key, rate_limit_counter, audit_log"
            )
        )


@pytest.fixture
def make_committing_client(
    settings_factory: SettingsFactory, committing_engine: Engine, committing_cleanup: None
) -> Callable[..., TestClient]:
    """Build a client whose requests each open a real ``Session`` on ``committing_engine``.

    Pass ``clock=`` (a ``Clock``) to freeze time; every other keyword overrides a setting.
    """

    def build(*, clock: Clock | None = None, **overrides: Any) -> TestClient:
        app = create_app(settings_factory(**overrides))

        def committing_session() -> Iterator[Session]:
            with Session(committing_engine) as session:
                yield session

        app.dependency_overrides[get_session] = committing_session
        app.dependency_overrides[get_engine] = lambda: committing_engine
        if clock is not None:
            override_clock(app, clock)
        return TestClient(app, raise_server_exceptions=False)

    return build
