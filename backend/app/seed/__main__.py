"""``uv run python -m app.seed``: load the sample catalog into the configured database."""

import argparse
import sys
from collections.abc import Sequence

from app.db import get_engine
from app.ops.target_guard import GuardRefusal, add_guard_arguments, confirm_target
from app.seed.loader import SeedError, run_seed
from app.settings import get_settings

REFUSAL = "Refusing to seed: APP_ENV is production."
PRODUCTION_FLAG = "--i-understand-this-is-production"


def main(argv: Sequence[str] = ()) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.seed")
    add_guard_arguments(parser)
    parser.add_argument(PRODUCTION_FLAG, action="store_true", dest="production_ok")
    args = parser.parse_args(list(argv))

    settings = get_settings()
    if settings.app_env == "production" and not args.production_ok:
        print(REFUSAL, file=sys.stderr)
        return 2
    # Without these flags this is today's development seed. With either one, it writes only to the
    # database the operator named and typed back.
    if args.production_ok or args.expect_host:
        try:
            confirm_target(
                settings.database_url.get_secret_value(),
                expect_hosts=args.expect_host,
                out=sys.stdout,
            )
        except GuardRefusal as refusal:
            print(str(refusal), file=sys.stderr)
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
    raise SystemExit(main(sys.argv[1:]))
