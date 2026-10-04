import subprocess
import sys
from pathlib import Path
from typing import Any

import pytest
from pydantic import ValidationError

from app.main import create_app
from app.settings import Settings, get_settings

SECRET = "SECRETPW"
POOLED = f"postgresql+psycopg://u:{SECRET}@ep-a-pooler.x.aws.neon.tech/db?sslmode=require"
DIRECT = f"postgresql+psycopg://u:{SECRET}@ep-a.x.aws.neon.tech/db?sslmode=require"
PROXY_SECRET = "p" * 32
HASH_KEY = "h" * 32
TEST = f"postgresql+psycopg://u:{SECRET}@ep-b.x.aws.neon.tech/db_test?sslmode=require"


def make(**overrides: Any) -> Settings:
    values: dict[str, Any] = {
        "app_env": "test",
        "database_url": POOLED,
        "direct_database_url": DIRECT,
        "test_database_url": TEST,
        "cors_origins": "http://localhost:3000, https://example.org",
        "booking_proxy_secret": PROXY_SECRET,
        "privacy_hash_key": HASH_KEY,
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


@pytest.mark.parametrize(
    ("field", "name", "value"),
    [
        ("booking_proxy_secret", "BOOKING_PROXY_SECRET", "x" * 31),
        ("privacy_hash_key", "PRIVACY_HASH_KEY", "y" * 31),
    ],
)
def test_short_booking_secret_is_rejected_without_echoing_it(
    field: str, name: str, value: str
) -> None:
    with pytest.raises(ValidationError) as info:
        make(**{field: value})
    text = str(info.value)
    assert f"{name} is required (at least 32 characters)" in text
    assert value not in text


@pytest.mark.parametrize("field", ["booking_proxy_secret", "privacy_hash_key"])
def test_missing_booking_secret_is_rejected(field: str, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(field.upper(), raising=False)
    values: dict[str, Any] = {
        "app_env": "test",
        "database_url": POOLED,
        "direct_database_url": DIRECT,
        "booking_proxy_secret": PROXY_SECRET,
        "privacy_hash_key": HASH_KEY,
    }
    del values[field]
    with pytest.raises(ValidationError) as info:
        Settings(_env_file=None, **values)  # type: ignore[call-arg]
    assert field in str(info.value)


def test_booking_defaults() -> None:
    settings = make()
    assert settings.demo_mode is True
    assert settings.booking_purge_after_days == 7
    assert settings.booking_limit_per_ip_per_hour == 10
    assert settings.booking_limit_per_phone_per_day == 5
    assert settings.lookup_limit_per_ip_per_minute == 20
    assert settings.audit_purge_after_days == 90
    assert PROXY_SECRET not in repr(settings)


@pytest.mark.parametrize(
    ("field", "bad"),
    [
        ("booking_purge_after_days", 0),
        ("booking_purge_after_days", 91),
        ("booking_limit_per_ip_per_hour", 0),
        ("booking_limit_per_phone_per_day", 101),
        ("lookup_limit_per_ip_per_minute", 1001),
        ("audit_purge_after_days", 6),
        ("audit_purge_after_days", 366),
    ],
)
def test_booking_ranges_are_enforced(field: str, bad: int) -> None:
    assert_rejected(field, **{field: bad})


def test_create_app_refuses_to_start_without_the_proxy_secret(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("BOOKING_PROXY_SECRET", "")
    get_settings.cache_clear()
    try:
        with pytest.raises(ValidationError, match="BOOKING_PROXY_SECRET"):
            create_app()
    finally:
        get_settings.cache_clear()


def test_seed_cli_exits_non_zero_without_the_proxy_secret() -> None:
    import os

    env = {**os.environ, "BOOKING_PROXY_SECRET": ""}
    backend = Path(__file__).resolve().parents[2]
    result = subprocess.run(
        [sys.executable, "-m", "app.seed"],
        cwd=backend,
        env=env,
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode != 0
    assert "BOOKING_PROXY_SECRET" in result.stderr
