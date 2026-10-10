"""Fixtures shared by the Command Centre API tests: a frozen clock and a client that reads it."""

import os
from collections.abc import Callable, Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

from app.settings import Settings
from tests.conftest import FROZEN_NOW, FrozenClock, SettingsFactory, override_clock


@pytest.fixture
def cc_settings(settings_factory: SettingsFactory) -> Settings:
    return settings_factory()


@pytest.fixture
def cc_clock() -> FrozenClock:
    return FrozenClock(FROZEN_NOW)


@pytest.fixture
def cc_client(make_client: Callable[..., TestClient], cc_clock: FrozenClock) -> TestClient:
    client = make_client()
    override_clock(client.app, cc_clock)  # type: ignore[arg-type]
    return client


@pytest.fixture(autouse=True)
def rate_limit_api_own_counters(
    request: pytest.FixtureRequest, monkeypatch: pytest.MonkeyPatch
) -> Iterator[None]:
    """Give ``test_rate_limit_api.py`` its own emptied counters under RATE_LIMIT_STORE=postgres.

    That file builds many apps and never gives them a database. With the shared limiter every app
    would count into the developer database from backend/.env, under one address and one 60-second
    window, so earlier tests would use up the bucket of later ones. Here the limiter points at the
    test database and the counter table is emptied before and after each test. No assertion in that
    file changes, and in the default ``memory`` mode this fixture does nothing.
    """
    module = request.module.__name__
    if (
        not module.endswith("test_rate_limit_api")
        or os.environ.get("RATE_LIMIT_STORE") != "postgres"
    ):
        yield
        return

    engine: Engine = request.getfixturevalue("seeded_engine")
    monkeypatch.setattr("app.main.get_engine", lambda: engine)

    def empty() -> None:
        with engine.begin() as conn:
            conn.execute(text("DELETE FROM rate_limit_counter"))

    empty()
    yield
    empty()
