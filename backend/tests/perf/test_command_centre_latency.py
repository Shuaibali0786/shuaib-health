"""Command Centre read latency over 30 000 synthetic bookings (NFR-001).

Run on demand: ``uv run pytest -m perf -s tests/perf/test_command_centre_latency.py``. The time is
the server's own ``durationMs`` from the access log; it includes the round trip to the database,
so it depends on the distance to the database region; the assertion therefore takes off the
database round trips each read makes (statements counted, one trip measured). The rows live in
the test's transaction and are rolled back. Budgets: search and every Insights range p95 < 1 s
(target 400 ms), Overview p95 < 300 ms.
"""

import logging
import math
import statistics
import time
import uuid
from collections.abc import Callable
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import event, insert, text
from sqlmodel import Session, select

from app import models as m
from app.settings import Settings
from tests.api.admin_support import API, make_staff, staff_session
from tests.conftest import FROZEN_NOW, FrozenClock

pytestmark = [pytest.mark.perf, pytest.mark.db]

BOOKINGS = 30_000
SLOTS_PER_DAY = 20
WARMUP = 3
REQUESTS = 30
ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"  # the booking-reference alphabet (no I, L, O, U)
STATUSES = ("confirmed", "completed", "completed", "completed", "no_show", "cancelled")

SEARCH_BUDGET_MS = 1000.0
INSIGHTS_BUDGET_MS = 1000.0
OVERVIEW_BUDGET_MS = 300.0


def reference_of(n: int) -> str:
    digits = []
    for _ in range(10):
        n, rest = divmod(n, 32)
        digits.append(ALPHABET[rest])
    return "".join(reversed(digits))


class DurationCollector(logging.Handler):
    def __init__(self) -> None:
        super().__init__()
        self.durations: list[float] = []

    def emit(self, record: logging.LogRecord) -> None:
        value = getattr(record, "durationMs", None)
        if value is not None:
            self.durations.append(float(value))


def p95(values: list[float]) -> float:
    ordered = sorted(values)
    return ordered[max(0, math.ceil(0.95 * len(ordered)) - 1)]


def synthesize(db: Session) -> None:
    """30 000 non-overlapping bookings: every doctor, 20 quarter-hours a day, from 150 days back."""
    doctors = db.exec(select(m.Doctor)).all()
    first = FROZEN_NOW.replace(hour=4, minute=0, second=0, microsecond=0) - timedelta(days=150)
    rows = []
    for n in range(BOOKINGS):
        day, within = divmod(n, SLOTS_PER_DAY * len(doctors))
        doctor = doctors[within % len(doctors)]
        starts_at = first + timedelta(days=day, minutes=15 * (within // len(doctors)))
        rows.append(
            {
                "id": uuid.uuid4(),
                "reference": reference_of(n + 1),
                "doctor_id": doctor.id,
                "department_id": doctor.department_id,
                "starts_at": starts_at,
                "ends_at": starts_at + timedelta(minutes=15),
                "status": STATUSES[n % len(STATUSES)],
                "fee_pkr": doctor.fee_pkr,
                "patient_name": f"Sample Patient {n % 500}",
                "patient_phone": f"+92300{n % 10_000_000:07d}",
                "reason": "Sample reason",
                "rules_accepted_at": FROZEN_NOW,
                "rules_version": "0" * 16,
                "is_sample": True,
            }
        )
    for start in range(0, len(rows), 5000):
        db.execute(insert(m.Appointment), rows[start : start + 5000])
    db.flush()


def test_command_centre_reads_stay_under_budget_with_30k_bookings(
    make_client: Callable[..., TestClient],
    db_session: Session,
    settings_factory: Callable[..., Settings],
) -> None:
    from tests.conftest import override_clock

    client = make_client(rate_limit_per_minute=10_000)
    clock = FrozenClock(FROZEN_NOW)
    override_clock(client.app, clock)  # type: ignore[arg-type]
    settings = settings_factory()
    staff = make_staff(db_session, "perf@example.org", "admin", "Perf Admin")
    headers, _, _ = staff_session(db_session, settings, staff, clock.now())
    synthesize(db_session)

    logging.getLogger("httpx2").setLevel(logging.WARNING)
    logger = logging.getLogger("app.access")
    logger.setLevel(logging.INFO)
    collector = DurationCollector()
    logger.addHandler(collector)
    cases: dict[str, tuple[Callable[[], int], float]] = {
        "search (30 days, free text)": (
            lambda: (
                client.post(
                    f"{API}/bookings/search",
                    json={"q": "Sample", "from": "2026-09-05", "to": "2026-10-05"},
                    headers=headers,
                ).status_code
            ),
            SEARCH_BUDGET_MS,
        ),
        "search (90 days, page 3)": (
            lambda: (
                client.post(
                    f"{API}/bookings/search",
                    json={"from": "2026-07-10", "to": "2026-10-05", "page": 3},
                    headers=headers,
                ).status_code
            ),
            SEARCH_BUDGET_MS,
        ),
        "insights 7": (
            lambda: client.get(f"{API}/insights?range=7", headers=headers).status_code,
            INSIGHTS_BUDGET_MS,
        ),
        "insights 30": (
            lambda: client.get(f"{API}/insights?range=30", headers=headers).status_code,
            INSIGHTS_BUDGET_MS,
        ),
        "insights 90": (
            lambda: client.get(f"{API}/insights?range=90", headers=headers).status_code,
            INSIGHTS_BUDGET_MS,
        ),
        "overview": (
            lambda: client.get(f"{API}/overview", headers=headers).status_code,
            OVERVIEW_BUDGET_MS,
        ),
        "doctors today": (
            lambda: client.get(f"{API}/doctors-today", headers=headers).status_code,
            OVERVIEW_BUDGET_MS,
        ),
    }
    results: dict[str, list[float]] = {}
    statements: dict[str, int] = {}
    seen = {"n": 0}

    def count(*_: object) -> None:
        seen["n"] += 1

    engine = db_session.get_bind()
    event.listen(engine, "before_cursor_execute", count)
    try:
        for name, (call, _) in cases.items():
            for _ in range(WARMUP):
                assert call() == 200, name
            collector.durations.clear()
            seen["n"] = 0
            for _ in range(REQUESTS):
                assert call() == 200, name
            results[name] = list(collector.durations)
            statements[name] = round(seen["n"] / REQUESTS)
    finally:
        event.remove(engine, "before_cursor_execute", count)
        logger.removeHandler(collector)

    # One empty statement measures the trip to the database; the budget is for the work itself, so
    # the trips a read makes are taken off (a nearby database makes them near zero).
    trips = []
    for _ in range(20):
        began = time.perf_counter()
        db_session.execute(text("SELECT 1"))
        trips.append((time.perf_counter() - began) * 1000)
    trip = statistics.median(trips)

    print()
    print(f"database round trip: {trip:.1f} ms; {BOOKINGS} bookings; times in ms")
    print(f"{'read':<30} {'queries':>7} {'median':>8} {'p95':>8} {'p95 - trips':>11}")
    adjusted = {name: p95(v) - statements[name] * trip for name, v in results.items()}
    for name, values in results.items():
        row = (statements[name], statistics.median(values), p95(values), adjusted[name])
        print(f"{name:<30} {row[0]:>7} {row[1]:8.1f} {row[2]:8.1f} {row[3]:11.1f}")
    slow = {name: round(adjusted[name], 1) for name in results if adjusted[name] >= cases[name][1]}
    assert not slow, f"over budget (p95 less the database round trips): {slow}"
