from types import SimpleNamespace

import pytest

from app.seed import __main__ as cli
from tests.conftest import SettingsFactory


def test_production_is_refused_without_seeding(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    settings_factory: SettingsFactory,
) -> None:
    def fail(*_: object, **__: object) -> None:
        raise AssertionError("seed must not run in production")

    monkeypatch.setattr(cli, "get_settings", lambda: settings_factory(app_env="production"))
    monkeypatch.setattr(cli, "run_seed", fail)
    monkeypatch.setattr(cli, "get_engine", fail)

    assert cli.main() == 2
    output = capsys.readouterr()
    assert cli.REFUSAL in output.err
    assert "postgresql" not in output.out + output.err


def test_development_seeds_and_prints_counts_only(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    settings_factory: SettingsFactory,
) -> None:
    report = SimpleNamespace(counts={"department": 7, "doctor": 9})

    monkeypatch.setattr(cli, "get_settings", lambda: settings_factory(app_env="development"))
    monkeypatch.setattr(cli, "get_engine", lambda: object())
    monkeypatch.setattr(cli, "run_seed", lambda _engine: report)

    assert cli.main() == 0
    assert capsys.readouterr().out.splitlines() == ["department: 7", "doctor: 9"]
