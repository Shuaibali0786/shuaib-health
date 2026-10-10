"""Production fails closed: a missing demo switch or CRON_SECRET stops startup (B4, B5)."""

from typing import Any

import pytest
from pydantic import ValidationError

from tests.unit.test_feature_flags import PRODUCTION, build

LEAK = "super-secret-value-that-must-not-appear"


@pytest.mark.parametrize("name", ["demo_mode", "demo_enabled", "cron_secret"])
def test_production_without_the_setting_names_it(name: str) -> None:
    with pytest.raises(ValidationError) as info:
        build(**{name: ...})
    assert name.upper() in str(info.value)


def test_a_short_cron_secret_is_refused_without_echoing_it() -> None:
    with pytest.raises(ValidationError) as info:
        build(cron_secret="short-" + LEAK[:5])
    text = str(info.value)
    assert "CRON_SECRET" in text
    assert "short-" not in text


def test_errors_never_contain_secret_values() -> None:
    values: dict[str, Any] = {**PRODUCTION, "demo_mode": ..., "booking_proxy_secret": LEAK}
    with pytest.raises(ValidationError) as info:
        build(**values)
    assert LEAK not in str(info.value)


def test_development_keeps_todays_defaults(settings_factory: Any) -> None:
    settings = settings_factory(app_env="development")
    assert settings.demo_mode is True
    assert settings.demo_enabled is True
