"""Overview numbers (data-model §8): KPIs, utilisation, trends and next-up, all pure.

The process time zone is set to New York for every test, so a function that quietly used it
instead of the clinic zone would disagree with these answers (SC-009). Time is always passed in.
"""

import os
import time
from collections.abc import Iterator
from datetime import UTC, date, datetime, timedelta
from datetime import time as clock
from zoneinfo import ZoneInfo

import pytest

from app.booking.slots import Busy, SessionRule
from app.command_centre import metrics
from app.command_centre.schemas import BookingSummary, DoctorRef

KARACHI = ZoneInfo("Asia/Karachi")
MONDAY = date(2026, 10, 5)
NOW = datetime(2026, 10, 5, 6, 20, 45, tzinfo=UTC)  # 11:20:45 Karachi


def _set_zone() -> None:
    if hasattr(
        time, "tzset"
    ):  # not on Windows, where the checks below still hold: nothing reads it
        time.tzset()


@pytest.fixture(autouse=True)
def new_york_process_zone() -> Iterator[None]:
    before = os.environ.get("TZ")
    os.environ["TZ"] = "America/New_York"
    _set_zone()
    yield
    if before is None:
        os.environ.pop("TZ", None)
    else:
        os.environ["TZ"] = before
    _set_zone()


def at(hh: int, mm: int, day: date = MONDAY) -> datetime:
    return datetime.combine(day, clock(hh, mm), tzinfo=KARACHI)


def summary(
    reference: str,
    starts_at: datetime,
    status: str = "confirmed",
    doctor: str = "Dr. Omar Sheikh",
) -> BookingSummary:
    return BookingSummary.model_validate(
        {
            "reference": reference,
            "starts_at": starts_at,
            "ends_at": starts_at + timedelta(minutes=15),
            "local_date": starts_at.astimezone(KARACHI).date(),
            "local_time": starts_at.astimezone(KARACHI).strftime("%H:%M"),
            "status": status,
            "version": 1,
            "patient_name_masked": "Ayesha K.",
            "phone_masked": "0300****567",
            "doctor": DoctorRef(
                id="00000000-0000-4000-8000-000000000001",
                name=doctor,
                department_name="General Medicine",
            ),
            "allowed_next": [],
        }
    )


# ----- counts per status ----------------------------------------------------------------------


def test_kpi_values_follow_the_definitions() -> None:
    counts = {"confirmed": 3, "arrived": 2, "completed": 4, "no_show": 1, "cancelled": 2}
    values = metrics.kpi_values(counts, slots=12)
    assert values.appointments == 10  # everything but cancelled
    assert values.arrived == 6  # arrived + completed: completed always passed through arrived
    assert values.completed == 4
    assert values.no_shows == 1
    assert values.cancellations == 2
    assert values.utilisation_pct == 83  # 10 / 12


def test_missing_statuses_count_as_zero() -> None:
    values = metrics.kpi_values({}, slots=8)
    assert (values.appointments, values.arrived, values.completed) == (0, 0, 0)
    assert (values.no_shows, values.cancellations, values.utilisation_pct) == (0, 0, 0)


def test_utilisation_is_a_dash_with_no_slots() -> None:
    assert metrics.kpi_values({"confirmed": 3}, slots=0).utilisation_pct is None


@pytest.mark.parametrize(
    ("booked", "slots", "expected"),
    [(1, 8, 13), (1, 3, 33), (2, 3, 67), (9, 9, 100), (0, 5, 0)],
)
def test_utilisation_rounds_half_up_to_a_whole_percent(
    booked: int, slots: int, expected: int
) -> None:
    assert metrics.utilisation_pct(booked, slots) == expected


# ----- trends ----------------------------------------------------------------------------------


def test_trend_is_the_change_since_the_same_weekday_last_week() -> None:
    last_monday = MONDAY - timedelta(days=7)
    trend = metrics.trend(50, 54, last_monday)
    assert (trend.value, trend.previous, trend.delta) == (50, 54, -4)
    assert trend.compared_to == last_monday


def test_trend_has_no_delta_when_either_side_is_unknown() -> None:
    assert metrics.trend(None, 54, MONDAY).delta is None
    assert metrics.trend(50, None, MONDAY).delta is None


def test_kpis_compare_today_with_seven_days_earlier() -> None:
    today = metrics.kpi_values({"confirmed": 30, "arrived": 8, "completed": 8, "no_show": 2}, 72)
    before = metrics.kpi_values({"completed": 40, "no_show": 4, "cancelled": 4}, 60)
    kpis = metrics.build_kpis(today, before, MONDAY)
    assert kpis.appointments.compared_to == date(2026, 9, 28)
    assert kpis.appointments.delta == 48 - 44
    assert kpis.no_shows.delta == -2
    assert kpis.cancellations.delta == -4
    # Utilisation moves in percentage points: 67 % now against 73 % a week ago.
    assert (kpis.utilisation_pct.value, kpis.utilisation_pct.previous) == (67, 73)
    assert kpis.utilisation_pct.delta == -6


# ----- the scheduled slot grid -----------------------------------------------------------------

MONDAY_SESSION = SessionRule("mon", clock(9, 0), clock(13, 0), 15)


def test_scheduled_slots_come_from_the_session_grid() -> None:
    assert metrics.scheduled_slots(MONDAY, KARACHI, [MONDAY_SESSION], []) == 16


def test_other_weekdays_have_no_slots() -> None:
    assert metrics.scheduled_slots(date(2026, 10, 6), KARACHI, [MONDAY_SESSION], []) == 0


def test_leave_removes_the_slots_it_overlaps() -> None:
    leave = [Busy(at(10, 0), at(11, 0))]
    assert metrics.scheduled_slots(MONDAY, KARACHI, [MONDAY_SESSION], leave) == 12


def test_a_holiday_leaves_no_slots() -> None:
    assert metrics.scheduled_slots(MONDAY, KARACHI, [MONDAY_SESSION], [], closed=True) == 0


def test_two_sessions_in_a_day_add_up() -> None:
    evening = SessionRule("mon", clock(16, 0), clock(18, 0), 30)
    assert metrics.scheduled_slots(MONDAY, KARACHI, [MONDAY_SESSION, evening], []) == 16 + 4


# ----- a booking belongs to its Karachi date (SC-009) -------------------------------------------


def test_a_late_evening_booking_counts_on_its_karachi_date() -> None:
    late = at(23, 45)  # Monday 14:45 in New York
    after_midnight = at(
        0, 5, MONDAY + timedelta(days=1)
    )  # Tuesday here, but Monday 15:05 in New York
    items = [(late, "confirmed"), (after_midnight, "confirmed"), (at(9, 0), "completed")]
    assert metrics.day_counts(items, MONDAY, KARACHI) == {"confirmed": 1, "completed": 1}
    assert metrics.day_counts(items, MONDAY + timedelta(days=1), KARACHI) == {"confirmed": 1}


# ----- next patients up -------------------------------------------------------------------------


def test_next_up_is_confirmed_bookings_from_a_quarter_hour_ago_in_time_order() -> None:
    items = [
        summary("A", at(11, 6)),  # 14 minutes ago: still listed (late arrivals)
        summary("B", at(11, 5)),  # 15 min 45 s ago: dropped
        summary("C", at(11, 40), "arrived"),
        summary("D", at(10, 0), "completed"),
        summary("E", at(12, 0), "cancelled"),
        summary("F", at(12, 0), doctor="Dr. Anwar"),
        summary("G", at(11, 40)),
        summary("H", at(12, 0)),
        summary("I", at(12, 15)),
        summary("J", at(12, 30)),
        summary("K", at(12, 45)),
    ]
    picked = metrics.next_up(items, NOW)
    assert [b.reference for b in picked] == ["A", "G", "F", "H", "I"]
    assert len(picked) == metrics.NEXT_UP_LIMIT == 5


def test_next_up_is_empty_when_nobody_is_left() -> None:
    assert metrics.next_up([summary("A", at(9, 0), "completed")], NOW) == []
