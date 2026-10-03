"""``uv run python -m app.seed``: load the sample catalog into the configured database."""

import sys

from app.db import get_engine
from app.seed.loader import SeedError, run_seed
from app.settings import get_settings

REFUSAL = "Refusing to seed: APP_ENV is production."


def main() -> int:
    settings = get_settings()
    if settings.app_env == "production":
        print(REFUSAL, file=sys.stderr)
        return 2
    try:
        report = run_seed(get_engine())
    except SeedError as exc:
        print(f"Seed data is invalid: {exc}", file=sys.stderr)
        return 1
    for table, count in report.counts.items():
        print(f"{table}: {count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
