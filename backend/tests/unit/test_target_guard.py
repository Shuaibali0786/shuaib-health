"""The target guard: wrong database, dev database and a wrong typed name are all refused."""

import io
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.auth import create_admin as admin_cli
from app.ops.target_guard import GuardRefusal, confirm_target, mask_host
from app.seed import __main__ as seed_cli
from tests.conftest import SettingsFactory

PROD_HOST = "ep-prod-river-123456.ap-southeast-1.aws.neon.tech"
PROD = f"postgresql+psycopg://app_user:Sup3rS3cret@{PROD_HOST}/shuaib_prod?sslmode=require"
DEV = "postgresql+psycopg://dev:devpw@localhost:5432/shuaib_dev?sslmode=require"


def env_file(tmp_path: Path, url: str = DEV) -> Path:
    path = tmp_path / ".env"
    path.write_text(f"APP_ENV=development\nDATABASE_URL={url}\n", encoding="utf-8")
    return path


def confirm(url: str, tmp_path: Path, *, hosts: list[str], typed: str = "shuaib_prod") -> str:
    out = io.StringIO()
    confirm_target(
        url, expect_hosts=hosts, out=out, ask=lambda _: typed, env_file=env_file(tmp_path)
    )
    return out.getvalue()


def test_a_matching_host_and_typed_name_pass_and_print_only_masked_values(tmp_path: Path) -> None:
    printed = confirm(PROD, tmp_path, hosts=[PROD_HOST])
    assert "ep-pro***.ap-southeast-1.aws.neon.tech" in printed
    assert "shuaib_prod" in printed
    for secret in ("app_user", "Sup3rS3cret", PROD_HOST, "postgresql"):
        assert secret not in printed


def test_missing_expect_host_is_refused(tmp_path: Path) -> None:
    with pytest.raises(GuardRefusal, match="--expect-host"):
        confirm(PROD, tmp_path, hosts=[])


def test_a_host_outside_the_expected_list_is_refused(tmp_path: Path) -> None:
    with pytest.raises(GuardRefusal, match="not one of"):
        confirm(PROD, tmp_path, hosts=["ep-other-000000.ap-southeast-1.aws.neon.tech"])


def test_the_dev_url_from_the_local_env_is_refused_even_if_expected(tmp_path: Path) -> None:
    with pytest.raises(GuardRefusal, match="development database"):
        confirm(DEV, tmp_path, hosts=["localhost"], typed="shuaib_dev")


def test_the_dev_database_is_refused_through_its_pooled_host_too(tmp_path: Path) -> None:
    domain = "ap-southeast-1.aws.neon.tech"
    dev = f"postgresql+psycopg://u:p@ep-dev-aaa-111.{domain}/neondb?sslmode=require"
    pooled = f"postgresql+psycopg://u:p@ep-dev-aaa-111-pooler.{domain}/neondb?sslmode=require"
    path = env_file(tmp_path, dev)
    with pytest.raises(GuardRefusal, match="development database"):
        confirm_target(
            pooled,
            expect_hosts=[f"ep-dev-aaa-111-pooler.{domain}"],
            out=io.StringIO(),
            ask=lambda _: "neondb",
            env_file=path,
        )


def test_a_wrong_typed_name_is_refused(tmp_path: Path) -> None:
    with pytest.raises(GuardRefusal, match="does not match"):
        confirm(PROD, tmp_path, hosts=[PROD_HOST], typed="shuaib_dev")


def test_mask_host_hides_the_start_of_the_host() -> None:
    assert mask_host("ep-prod-river-123456.x.neon.tech") == "ep-pro***.x.neon.tech"


def test_a_missing_env_file_means_no_dev_database_to_compare(tmp_path: Path) -> None:
    out = io.StringIO()
    confirm_target(
        PROD,
        expect_hosts=[PROD_HOST],
        out=out,
        ask=lambda _: "shuaib_prod",
        env_file=tmp_path / "none.env",
    )
    assert "shuaib_prod" in out.getvalue()


def fail(*_: object, **__: object) -> None:
    raise AssertionError("must not run")


POOLED = PROD.replace("ep-prod-river-123456", "ep-prod-river-123456-pooler")


def production_settings(settings_factory: SettingsFactory) -> object:
    """The app connects through the pooled URL; the guard must judge that one."""
    return settings_factory(app_env="production", database_url=POOLED, direct_database_url=PROD)


def test_seed_in_production_needs_the_flag_and_then_the_guard(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    settings_factory: SettingsFactory,
) -> None:
    monkeypatch.setattr(seed_cli, "get_settings", lambda: production_settings(settings_factory))
    monkeypatch.setattr(seed_cli, "run_seed", fail)
    monkeypatch.setattr(seed_cli, "get_engine", fail)
    assert seed_cli.main([]) == 2  # the default production refusal stays
    assert seed_cli.REFUSAL in capsys.readouterr().err
    assert seed_cli.main([seed_cli.PRODUCTION_FLAG]) == 2  # flag alone: --expect-host is required
    assert "--expect-host" in capsys.readouterr().err


def test_seed_with_flag_host_and_typed_name_seeds_and_prints_no_secret(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    settings_factory: SettingsFactory,
) -> None:
    report = SimpleNamespace(counts={"department": 7})
    monkeypatch.setattr(seed_cli, "get_settings", lambda: production_settings(settings_factory))
    monkeypatch.setattr(seed_cli, "get_engine", lambda: object())
    monkeypatch.setattr(seed_cli, "run_seed", lambda _engine: report)
    monkeypatch.setattr("builtins.input", lambda _prompt="": "shuaib_prod")
    assert seed_cli.main([seed_cli.PRODUCTION_FLAG, "--expect-host", PROD_HOST]) == 0
    output = capsys.readouterr()
    assert "department: 7" in output.out
    for secret in ("app_user", "Sup3rS3cret", PROD_HOST):
        assert secret not in output.out + output.err


def test_seed_with_a_wrong_typed_name_does_not_seed(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    settings_factory: SettingsFactory,
) -> None:
    monkeypatch.setattr(seed_cli, "get_settings", lambda: production_settings(settings_factory))
    monkeypatch.setattr(seed_cli, "get_engine", fail)
    monkeypatch.setattr(seed_cli, "run_seed", fail)
    monkeypatch.setattr("builtins.input", lambda _prompt="": "wrong")
    assert seed_cli.main([seed_cli.PRODUCTION_FLAG, "--expect-host", PROD_HOST]) == 2
    assert "does not match" in capsys.readouterr().err


def test_create_admin_in_production_refuses_a_password_on_stdin(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    settings_factory: SettingsFactory,
) -> None:
    monkeypatch.setattr(admin_cli, "get_settings", lambda: production_settings(settings_factory))
    argv = ["--email", "a@example.org", "--password-stdin", "--expect-host", PROD_HOST]
    code = admin_cli.main(argv)
    assert code == 1
    assert "stdin" in capsys.readouterr().err


def test_create_admin_in_production_without_expect_host_is_refused(
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    settings_factory: SettingsFactory,
) -> None:
    monkeypatch.setattr(admin_cli, "get_settings", lambda: production_settings(settings_factory))
    code = admin_cli.main(["--email", "a@example.org"])
    assert code == 1
    assert "--expect-host" in capsys.readouterr().err
