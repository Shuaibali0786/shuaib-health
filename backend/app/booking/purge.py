"""Manual purge of demo bookings: ``python -m app.booking.purge`` (FR-054)."""

import sys

from app.booking.clock import SystemClock
from app.booking.retention import purge_demo_bookings
from app.db import get_engine
from app.settings import get_settings


def main() -> int:
    settings = get_settings()  # fails fast on bad configuration
    if not settings.demo_mode:
        print("Refusing to purge: DEMO_MODE is false", file=sys.stderr)
        return 2
    try:
        with get_engine().begin() as conn:
            deleted = purge_demo_bookings(
                conn,
                now=SystemClock().now(),
                after_days=settings.booking_purge_after_days,
                audit_after_days=settings.audit_purge_after_days,
                limit=None,
            )
    except Exception as error:
        print(f"purge failed: {type(error).__name__}", file=sys.stderr)
        return 1
    print(f"purged: {deleted}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
