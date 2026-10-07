"""Overview numbers (data-model §8): KPIs, utilisation, trends and next-up, all pure.

The process time zone is set to New York for every test, so a function that quietly used it
instead of the clinic zone would disagree with these answers (SC-009). Time is always passed in.
"""

import os
import time
import uuid
from collections.abc import Iterator
from datetime import UTC, date, datetime, timedelta
from datetime import time as clock
from zoneinfo import ZoneInfo

import pytest

from app.booking.slots import Busy, SessionRule
from app.command_centre import metrics
from app.command_centre.schemas import BookingSummary, DoctorRef, DoctorsToday

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


# ----- Insights (US6) --------------------------------------------------------------------------


def row(
    day: date, hh: int, status: str = "confirmed", dept: str = "Cardiology"
) -> metrics.InsightRow:
    return metrics.InsightRow(at(hh, 0, day), status, dept)


def test_insights_zero_fill_every_day_ending_today() -> None:
    result = metrics.build_insights(
        range_days=7,
        today=MONDAY,
        tz=KARACHI,
        rows=[row(MONDAY, 10), row(MONDAY, 10), row(MONDAY - timedelta(days=2), 9)],
        is_sample=False,
    )
    assert result.from_ == MONDAY - timedelta(days=6)
    assert result.to == MONDAY
    assert [d.date for d in result.per_day] == [MONDAY - timedelta(days=6 - i) for i in range(7)]
    assert [d.count for d in result.per_day] == [0, 0, 0, 0, 1, 0, 2]
    assert result.total == 3


def test_insights_ranges_have_that_many_days_and_ignore_bookings_outside() -> None:
    old = row(MONDAY - timedelta(days=40), 9)
    future = row(MONDAY + timedelta(days=1), 9)
    for days in (7, 30, 90):
        result = metrics.build_insights(
            range_days=days,
            today=MONDAY,
            tz=KARACHI,
            rows=[old, future, row(MONDAY, 9)],
            is_sample=True,
        )
        assert len(result.per_day) == days
        assert result.is_sample is True
    thirty = metrics.build_insights(
        range_days=30, today=MONDAY, tz=KARACHI, rows=[old], is_sample=False
    )
    ninety = metrics.build_insights(
        range_days=90, today=MONDAY, tz=KARACHI, rows=[old], is_sample=False
    )
    assert (thirty.total, ninety.total) == (0, 1)


def test_insights_by_department_counts_cancelled_in_their_own_column() -> None:
    rows = [
        row(MONDAY, 9, "completed", "Cardiology"),
        row(MONDAY, 10, "confirmed", "Cardiology"),
        row(MONDAY, 11, "cancelled", "Cardiology"),
        row(MONDAY, 9, "no_show", "Dental"),
        row(MONDAY, 9, "cancelled", "Pediatrics"),
    ]
    result = metrics.build_insights(
        range_days=7, today=MONDAY, tz=KARACHI, rows=rows, is_sample=False
    )
    assert [(d.department_name, d.count, d.cancelled) for d in result.by_department] == [
        ("Cardiology", 2, 1),
        ("Dental", 1, 0),
        ("Pediatrics", 0, 1),
    ]
    assert sum(d.count for d in result.by_department) == result.total == 3


def test_insights_by_status_lists_all_five_statuses() -> None:
    rows = [row(MONDAY, 9, "completed"), row(MONDAY, 9, "completed"), row(MONDAY, 9, "cancelled")]
    result = metrics.build_insights(
        range_days=7, today=MONDAY, tz=KARACHI, rows=rows, is_sample=False
    )
    assert [(s.status, s.count) for s in result.by_status] == [
        ("confirmed", 0),
        ("arrived", 0),
        ("completed", 2),
        ("no_show", 0),
        ("cancelled", 1),
    ]


def test_insights_busiest_hours_are_clinic_hours_and_skip_cancelled() -> None:
    # 23:30 in Karachi is 18:30 UTC (14:30 in New York): the hour must be the clinic's.
    late = metrics.InsightRow(at(23, 30), "confirmed", "Dental")
    rows = [late, row(MONDAY, 9), row(MONDAY, 9), row(MONDAY, 9, "cancelled")]
    result = metrics.build_insights(
        range_days=7, today=MONDAY, tz=KARACHI, rows=rows, is_sample=False
    )
    assert len(result.by_hour) == 24
    counts = {h.hour: h.count for h in result.by_hour}
    assert counts[23] == 1 and counts[9] == 2 and sum(counts.values()) == 3


def test_a_late_evening_booking_belongs_to_its_clinic_day() -> None:
    late = metrics.InsightRow(at(23, 45), "confirmed", "Dental")
    result = metrics.build_insights(
        range_days=7, today=MONDAY, tz=KARACHI, rows=[late], is_sample=False
    )
    assert result.per_day[-1].count == 1


def test_too_little_data_threshold_is_five() -> None:
    assert metrics.INSIGHTS_MIN_BOOKINGS == 5


# ----- Doctors today (US7) ---------------------------------------------------------------------


def doctor_ref(name: str, n: int) -> DoctorRef:
    return DoctorRef(
        id=f"00000000-0000-4000-8000-00000000000{n}", name=name, department_name="General Medicine"
    )


def plan(
    name: str, n: int, sessions: list[SessionRule] | None, leave: list[Busy] | None = None
) -> metrics.DoctorPlan:
    return metrics.DoctorPlan(
        doctor=doctor_ref(name, n), sessions=sessions or [], leave=leave or []
    )


MON_MORNING = SessionRule("mon", clock(9, 0), clock(11, 0), 15)  # 8 slots
MON_AFTERNOON = SessionRule("mon", clock(16, 0), clock(17, 0), 15)  # 4 slots


def today_for(
    plans: list[metrics.DoctorPlan],
    booked: dict[uuid.UUID, list[datetime]],
    now: datetime,
    holiday: str | None = None,
) -> DoctorsToday:
    return metrics.build_doctors_today(
        day=MONDAY,
        now=now,
        tz=KARACHI,
        plans=plans,
        booked_starts=booked,
        holiday=holiday,
        is_sample=False,
    )


def test_free_is_scheduled_minus_booked_with_utilisation() -> None:
    p = plan("Dr. Omar Sheikh", 1, [MON_MORNING])
    booked = {p.doctor.id: [at(9, 0), at(9, 15), at(10, 0)]}
    only = today_for([p], booked, at(8, 0)).working[0]
    assert (only.scheduled, only.booked, only.free) == (8, 3, 5)
    assert only.utilisation_pct == 38  # 3 / 8 = 37.5 rounds up
    assert [(s.start, s.end) for s in only.sessions] == [("09:00", "11:00")]


def test_free_slots_already_passed_are_flagged_and_next_free_is_not_in_the_past() -> None:
    p = plan("Dr. Omar Sheikh", 1, [MON_MORNING])
    booked = {p.doctor.id: [at(9, 0), at(9, 15), at(10, 0)]}
    only = today_for([p], booked, at(9, 40)).working[0]
    # Free: 9:30 (passed), 9:45, 10:15, 10:30, 10:45.
    assert only.free == 5
    assert only.free_passed == 1
    assert only.next_free == "09:45"
    full = today_for([p], {p.doctor.id: [at(9, 0)]}, at(11, 30)).working[0]
    assert full.next_free is None and full.free_passed == 7


def test_a_fully_booked_doctor_has_no_next_free_slot() -> None:
    p = plan("Dr. A", 1, [MON_AFTERNOON])
    booked = {p.doctor.id: [at(16, 0), at(16, 15), at(16, 30), at(16, 45)]}
    only = today_for([p], booked, at(8, 0)).working[0]
    assert (only.free, only.next_free, only.utilisation_pct) == (0, None, 100)


def test_working_doctors_are_ordered_by_next_free_slot_then_name() -> None:
    early = plan("Dr. Zed", 1, [MON_MORNING])
    late = plan("Dr. Amir", 2, [MON_AFTERNOON])
    busy = plan("Dr. Bee", 3, [MON_MORNING])
    booked = {busy.doctor.id: [at(9, 0), at(9, 15), at(9, 30), at(9, 45)]}
    names = [d.doctor.name for d in today_for([late, early, busy], booked, at(9, 0)).working]
    assert names == ["Dr. Zed", "Dr. Bee", "Dr. Amir"]  # Zed 09:00, Bee 10:00, Amir 16:00
    full = {late.doctor.id: [at(16, 0), at(16, 15), at(16, 30), at(16, 45)]}
    order = [d.doctor.name for d in today_for([late, early], full, at(9, 0)).working]
    assert order == ["Dr. Zed", "Dr. Amir"]  # nobody free sorts last


def test_leave_over_the_whole_day_is_on_leave_and_partial_leave_reduces_slots() -> None:
    away = plan("Dr. Away", 1, [MON_MORNING], [Busy(at(0, 0), at(23, 59))])
    part = plan("Dr. Part", 2, [MON_MORNING], [Busy(at(9, 0), at(10, 0))])
    result = today_for([away, part], {}, at(8, 0))
    assert [d.name for d in result.on_leave] == ["Dr. Away"]
    assert [(d.doctor.name, d.scheduled) for d in result.working] == [("Dr. Part", 4)]


def test_a_doctor_with_no_session_today_is_not_in() -> None:
    tuesday_only = plan("Dr. Tue", 1, [SessionRule("tue", clock(9, 0), clock(10, 0), 15)])
    result = today_for([tuesday_only, plan("Dr. None", 2, None)], {}, at(8, 0))
    assert result.working == [] and result.on_leave == []
    assert [d.name for d in result.not_in] == ["Dr. None", "Dr. Tue"]


def test_a_holiday_closes_the_clinic_and_names_it() -> None:
    plans = [plan("Dr. A", 1, [MON_MORNING])]
    result = today_for(plans, {}, at(8, 0), holiday="Clinic closed (sample)")
    assert result.clinic_closed == "Clinic closed (sample)"
    assert result.working == [] and result.on_leave == [] and result.not_in == []


def test_cancelled_bookings_are_not_passed_in_so_they_free_their_slot() -> None:
    p = plan("Dr. A", 1, [MON_AFTERNOON])
    assert today_for([p], {}, at(8, 0)).working[0].free == 4
