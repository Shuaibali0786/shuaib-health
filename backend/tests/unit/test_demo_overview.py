"""The demo's Overview is sample data that adds up (US3), without touching a database."""

from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

from app.demo.demo_source import DemoSource

DAY = date(2026, 10, 5)
KARACHI = ZoneInfo("Asia/Karachi")
NOW = datetime(2026, 10, 5, 6, 20, 45, tzinfo=UTC)  # 11:20:45 in Karachi


def test_demo_overview_adds_up() -> None:
    overview = DemoSource(DAY).overview(KARACHI, NOW)
    items = [b for row in overview.agenda for b in row.items]
    assert overview.is_sample is True and overview.recent_bookings == []
    assert overview.clinic_closed is None and overview.local_date == DAY
    assert all(b.reference.startswith("D") and b.is_sample for b in items)
    counted = [b for b in items if b.status != "cancelled"]
    assert overview.kpis.appointments.value == len(counted)
    assert overview.kpis.arrived.value == sum(b.status in ("arrived", "completed") for b in items)
    assert overview.kpis.cancellations.value == len(items) - len(counted)
    assert 0 < (overview.kpis.utilisation_pct.value or 0) <= 100
    assert all(row.sessions for row in overview.agenda)


def test_demo_next_up_is_confirmed_and_upcoming() -> None:
    overview = DemoSource(DAY).overview(KARACHI, NOW)
    assert 0 < len(overview.next_up) <= 5
    assert all(b.status == "confirmed" for b in overview.next_up)
    starts = [b.starts_at for b in overview.next_up]
    assert starts == sorted(starts)


def test_demo_trends_compare_with_last_week_at_the_same_time_of_day() -> None:
    kpis = DemoSource(DAY).overview(KARACHI, NOW).kpis
    # Mid-morning against mid-morning: not a half-finished day against a finished one.
    assert abs(kpis.arrived.delta or 0) < 15 and abs(kpis.completed.delta or 0) < 15


def test_demo_overview_is_deterministic() -> None:
    first = DemoSource(DAY).overview(KARACHI, NOW)
    assert first == DemoSource(DAY).overview(KARACHI, NOW)
