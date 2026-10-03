"""Shared fixtures.

Unit tests build ``Settings`` from fake values and never read backend/.env. Database tests
(marked ``db``) use TEST_DATABASE_URL only, and are skipped with a clear reason when it is not
configured. The test database is migrated from scratch and seeded once per session; each test
runs inside a transaction that is rolled back.
"""

from collections.abc import Callable, Iterator
from pathlib import Path
from typing import Any

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import Connection, Engine
from sqlmodel import Session

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
        }
        values.update(overrides)
        return Settings(_env_file=None, **values)  # type: ignore[call-arg]

    return build


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
    except ValidationError:
        pytest.skip("TEST_DATABASE_URL not set (backend settings are not configured)")
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
) -> Callable[..., TestClient]:
    """Build a client on the seeded test database, with optional settings overrides."""

    def build(**overrides: Any) -> TestClient:
        app = create_app(settings_factory(**overrides))
        app.dependency_overrides[get_session] = lambda: db_session
        app.dependency_overrides[get_engine] = lambda: seeded_engine
        return TestClient(app, raise_server_exceptions=False)

    return build


@pytest.fixture
def client(make_client: Callable[..., TestClient]) -> TestClient:
    return make_client()
