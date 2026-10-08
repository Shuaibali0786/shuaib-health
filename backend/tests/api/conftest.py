"""Fixtures shared by the Command Centre API tests: a frozen clock and a client that reads it."""

from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient

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
