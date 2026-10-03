from typing import Any

import pytest
from pydantic import ValidationError

from app.settings import Settings

SECRET = "SECRETPW"
POOLED = f"postgresql+psycopg://u:{SECRET}@ep-a-pooler.x.aws.neon.tech/db?sslmode=require"
DIRECT = f"postgresql+psycopg://u:{SECRET}@ep-a.x.aws.neon.tech/db?sslmode=require"
TEST = f"postgresql+psycopg://u:{SECRET}@ep-b.x.aws.neon.tech/db_test?sslmode=require"


def make(**overrides: Any) -> Settings:
    values: dict[str, Any] = {
        "app_env": "test",
        "database_url": POOLED,
        "direct_database_url": DIRECT,
        "test_database_url": TEST,
        "cors_origins": "http://localhost:3000, https://example.org",
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)  # type: ignore[call-arg]


def assert_rejected(field: str, **overrides: Any) -> None:
    with pytest.raises(ValidationError) as info:
        make(**overrides)
    text = str(info.value)
    assert field in text
    assert SECRET not in text


def test_valid_settings_load() -> None:
    settings = make()
    assert settings.cors_origins == ["http://localhost:3000", "https://example.org"]
    assert settings.rate_limit_per_minute == 60
    assert settings.test_database_url is not None


def test_secrets_are_masked_in_repr() -> None:
    settings = make()
    assert SECRET not in repr(settings)
    assert SECRET not in str(settings.model_dump())


def test_empty_test_url_means_unset() -> None:
    assert make(test_database_url="").test_database_url is None


@pytest.mark.parametrize("field", ["database_url", "direct_database_url", "test_database_url"])
def test_wrong_driver_is_rejected(field: str) -> None:
    good = {"database_url": POOLED, "direct_database_url": DIRECT, "test_database_url": TEST}
    assert_rejected(field, **{field: good[field].replace("postgresql+psycopg", "postgresql")})


@pytest.mark.parametrize("field", ["database_url", "direct_database_url", "test_database_url"])
def test_missing_ssl_is_rejected(field: str) -> None:
    good = {"database_url": POOLED, "direct_database_url": DIRECT, "test_database_url": TEST}
    assert_rejected(field, **{field: good[field].replace("sslmode=require", "sslmode=prefer")})


def test_direct_url_as_app_url_is_rejected() -> None:
    assert_rejected("database_url", database_url=DIRECT)


def test_pooled_url_for_migrations_is_rejected() -> None:
    assert_rejected("direct_database_url", direct_database_url=POOLED)


@pytest.mark.parametrize("url", [POOLED, DIRECT])
def test_test_url_equal_to_dev_is_rejected(url: str) -> None:
    assert_rejected("test_database_url", test_database_url=url)


@pytest.mark.parametrize("origins", ["*", "localhost:3000", "http://a.com/path"])
def test_bad_cors_origins_are_rejected(origins: str) -> None:
    assert_rejected("cors_origins", cors_origins=origins)


def test_unknown_app_env_is_rejected() -> None:
    assert_rejected("app_env", app_env="staging")


def test_missing_required_setting_is_rejected() -> None:
    with pytest.raises(ValidationError) as info:
        Settings(_env_file=None, app_env="test", direct_database_url=DIRECT)  # type: ignore[call-arg]
    assert "database_url" in str(info.value)
