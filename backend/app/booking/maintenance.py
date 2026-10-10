"""The daily purge, shared by the startup hook (local) and the cron endpoint (production).

Both paths call ``run_purge`` so the behaviour cannot drift. The work is synchronous and bounded:
it runs inside one transaction with a database-side time limit, so it can never outlive the
request that asked for it.
"""

from sqlalchemy import Engine, text

from app.booking.clock import Clock, SystemClock
from app.booking.limits import cleanup_counters
from app.booking.retention import purge_demo_bookings, purge_old_sessions
from app.settings import Settings

TIME_BUDGET_SECONDS = 18  # stays under the 20 s budget in contracts/ops-endpoints.md
COUNTER_CLEANUP_LIMIT = 10000


def run_purge(
    engine: Engine,
    settings: Settings,
    *,
    clock: Clock | None = None,
    include_counters: bool = False,
) -> int:
    """Remove old sessions, and in demo mode expired demo data. Returns the rows purged.

    The count is the bookings deleted in demo mode, else the sessions deleted. With
    ``include_counters`` expired rate-limit counters are removed too (not counted).
    Idempotent: a second call finds nothing left and returns 0.
    """
    now = (clock or SystemClock()).now()
    with engine.begin() as conn:
        conn.execute(text(f"SET LOCAL statement_timeout = '{TIME_BUDGET_SECONDS}s'"))
        if settings.demo_mode:  # purges old sessions too
            purged = purge_demo_bookings(
                conn,
                now=now,
                after_days=settings.booking_purge_after_days,
                audit_after_days=settings.audit_purge_after_days,
                limit=None,
            )
        else:
            purged = purge_old_sessions(conn, now=now, limit=None)
        if include_counters:
            cleanup_counters(conn, now, limit=COUNTER_CLEANUP_LIMIT)
    return purged
