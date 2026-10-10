"""Vercel build step: apply database migrations before the new deployment goes live.

Runs only for Vercel ``production`` and ``preview`` builds, each against its own environment's
``DIRECT_DATABASE_URL`` (read by migrations/env.py). Never runs locally or in CI. Neon may be
asleep, so a failed attempt is retried for a short, bounded time. A build that cannot migrate
exits non-zero, so Vercel keeps the previous deployment live. Output never contains a URL.
"""

import os
import sys
import time
from collections.abc import Callable, Mapping
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
MIGRATE_ENVS = frozenset({"production", "preview"})
RETRY_BUDGET_SECONDS = 30.0
RETRY_INTERVAL_SECONDS = 3.0


def should_migrate(env: Mapping[str, str]) -> bool:
    return env.get("VERCEL_ENV") in MIGRATE_ENVS


def upgrade_to_head() -> None:
    from alembic import command
    from alembic.config import Config

    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.attributes["configure_logging"] = False
    command.upgrade(config, "head")


def run(
    env: Mapping[str, str],
    upgrade: Callable[[], None] = upgrade_to_head,
    *,
    sleep: Callable[[float], None] = time.sleep,
    monotonic: Callable[[], float] = time.monotonic,
    budget: float = RETRY_BUDGET_SECONDS,
    interval: float = RETRY_INTERVAL_SECONDS,
) -> int:
    """Return the process exit code."""
    if not should_migrate(env):
        print("vercel_build: not a production or preview build; skipping migrations")
        return 0
    deadline = monotonic() + budget
    attempt = 0
    while True:
        attempt += 1
        try:
            upgrade()
        except Exception as error:  # the message could contain a URL, so print the class only
            print(f"vercel_build: migration attempt {attempt} failed: {type(error).__name__}")
            if monotonic() + interval > deadline:
                print("vercel_build: giving up; the previous deployment stays live")
                return 1
            sleep(interval)
        else:
            print("vercel_build: migrations are at head")
            return 0


if __name__ == "__main__":
    sys.path.insert(0, str(BACKEND_DIR))
    os.chdir(BACKEND_DIR)
    sys.exit(run(os.environ))
