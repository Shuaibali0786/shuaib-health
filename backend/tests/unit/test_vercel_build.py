"""The Vercel build migrates production and preview builds only, retries, and prints no URL."""

import pytest

from scripts import vercel_build

URL = "postgresql://user:hunter2@ep-secret.neon.tech/db"


class Clock:
    def __init__(self) -> None:
        self.now = 0.0
        self.sleeps: list[float] = []

    def monotonic(self) -> float:
        return self.now

    def sleep(self, seconds: float) -> None:
        self.sleeps.append(seconds)
        self.now += seconds


def run(env: dict[str, str], upgrade: object, clock: Clock) -> int:
    return vercel_build.run(
        env,
        upgrade,  # type: ignore[arg-type]
        sleep=clock.sleep,
        monotonic=clock.monotonic,
    )


@pytest.mark.parametrize("vercel_env", ["production", "preview"])
def test_runs_for_production_and_preview(vercel_env: str) -> None:
    calls: list[int] = []
    assert run({"VERCEL_ENV": vercel_env}, lambda: calls.append(1), Clock()) == 0
    assert calls == [1]


@pytest.mark.parametrize("env", [{}, {"VERCEL_ENV": "development"}, {"VERCEL_ENV": ""}])
def test_skips_when_not_a_deployment_build(env: dict[str, str]) -> None:
    def boom() -> None:
        raise AssertionError("must not migrate")

    assert run(env, boom, Clock()) == 0


def test_retries_while_the_database_wakes_then_succeeds(
    capsys: pytest.CaptureFixture[str],
) -> None:
    attempts = {"n": 0}

    def flaky() -> None:
        attempts["n"] += 1
        if attempts["n"] < 3:
            raise ConnectionError(URL)

    clock = Clock()
    assert run({"VERCEL_ENV": "production"}, flaky, clock) == 0
    assert attempts["n"] == 3
    assert clock.sleeps == [3.0, 3.0]
    assert "hunter2" not in capsys.readouterr().out


def test_fails_cleanly_after_the_budget_and_prints_no_url(
    capsys: pytest.CaptureFixture[str],
) -> None:
    def always() -> None:
        raise ConnectionError(URL)

    clock = Clock()
    assert run({"VERCEL_ENV": "preview"}, always, clock) == 1
    out = capsys.readouterr().out
    assert "ConnectionError" in out and "giving up" in out
    for leak in ("hunter2", "ep-secret", "postgresql", "neon.tech"):
        assert leak not in out
    assert sum(clock.sleeps) <= 30.0
