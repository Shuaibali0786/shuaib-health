"""Infrastructure flags (007): OFF in code; production must set each one explicitly."""

from typing import Any

import pytest
from pydantic import ValidationError

from tests.conftest import FAKE_DIRECT, FAKE_POOLED

SECRET = "x" * 32

PRODUCTION: dict[str, Any] = {
    "app_env": "production",
    "database_url": FAKE_POOLED,
    "direct_database_url": FAKE_DIRECT,
    "cors_origins": "https://example.org",
    "booking_proxy_secret": SECRET,
    "privacy_hash_key": SECRET,
    "session_secret": SECRET,
    "cron_secret": SECRET,
    "rate_limit_store": "postgres",
    "trusted_server_exempt": True,
    "maintenance_via_cron": True,
    "demo_mode": True,
    "demo_enabled": True,
}


def build(**overrides: Any) -> Any:
    from app.settings import Settings

    values = {**PRODUCTION, **overrides}
    for name in [k for k, v in values.items() if v is ...]:
        del values[name]
    return Settings(_env_file=None, **values)


def test_flags_are_off_in_code(settings_factory: Any) -> None:
    settings = settings_factory()
    assert settings.rate_limit_store == "memory"
    assert settings.trusted_server_exempt is False
    assert settings.maintenance_via_cron is False
    assert settings.cron_secret is None


def test_a_complete_production_configuration_loads() -> None:
    settings = build()
    assert settings.rate_limit_store == "postgres"
    assert settings.maintenance_via_cron is True


@pytest.mark.parametrize(
    "flag", ["rate_limit_store", "trusted_server_exempt", "maintenance_via_cron"]
)
def test_production_requires_each_flag_explicitly(flag: str) -> None:
    with pytest.raises(ValidationError) as info:
        build(**{flag: ...})
    assert flag.upper() in str(info.value)


def test_production_rejects_cron_maintenance_switched_off() -> None:
    with pytest.raises(ValidationError) as info:
        build(maintenance_via_cron=False)
    assert "MAINTENANCE_VIA_CRON" in str(info.value)


def test_non_production_may_leave_the_flags_unset(settings_factory: Any) -> None:
    assert settings_factory(app_env="development").app_env == "development"
