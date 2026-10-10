"""Serverless-safe pool settings (condition C1) and the pooled-URL rule."""

from typing import Any

import pytest
from pydantic import SecretStr, ValidationError

from app.db import make_engine
from tests.conftest import FAKE_DIRECT, FAKE_POOLED, SettingsFactory

DIRECT_AS_APP = "postgresql+psycopg://u:p@ep-fake.x.aws.neon.tech/db?sslmode=require"


def test_pool_defaults_are_small(settings_factory: SettingsFactory) -> None:
    settings = settings_factory()
    assert (settings.db_pool_size, settings.db_max_overflow, settings.db_pool_timeout) == (1, 1, 5)


@pytest.mark.parametrize(
    ("name", "value"),
    [
        ("db_pool_size", 0),
        ("db_pool_size", 11),
        ("db_max_overflow", -1),
        ("db_max_overflow", 11),
        ("db_pool_timeout", 0),
        ("db_pool_timeout", 31),
    ],
)
def test_pool_bounds(settings_factory: SettingsFactory, name: str, value: int) -> None:
    with pytest.raises(ValidationError) as info:
        settings_factory(**{name: value})
    assert name in str(info.value)


def test_engine_uses_the_pool_settings() -> None:
    engine = make_engine(
        SecretStr(FAKE_POOLED), pool_size=2, max_overflow=0, pool_timeout=3, connect_timeout=1
    )
    pool: Any = engine.pool
    assert (pool.size(), pool._max_overflow, pool._timeout) == (2, 0, 3)
    engine.dispose()


def test_production_rejects_a_non_pooler_database_url(settings_factory: SettingsFactory) -> None:
    with pytest.raises(ValidationError) as info:
        settings_factory(
            app_env="production", database_url=DIRECT_AS_APP, direct_database_url=FAKE_DIRECT
        )
    assert "database_url" in str(info.value)
