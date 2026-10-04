"""The slot engine is pure, so these tests need no database (data-model section 9)."""

import time as time_module
from datetime import UTC, date, datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import pytest

from app.booking.slots import (
    Busy,
    DayOut,
    Holiday,
    SessionRule,
    build_days,
    is_available,
    next_free,
)

KARACHI = ZoneInfo("Asia/Karachi")
# Monday 2026-10-05 09:00 in Asia/Karachi (UTC+5, no DST).
NOW = datetime(2026, 10, 5, 4, 0, tzinfo=UTC)
MONDAY = date(2026, 10, 5)
TUESDAY = date(2026, 10, 6)
NEXT_MONDAY = date(2026, 10, 12)

TWO_SESSIONS = [
    SessionRule("mon", time(10, 0), time(13, 0), 15),
    SessionRule("mon", time(17, 0), time(20, 0), 15),
]


def local(day: date, hh: int, mm: int = 0, tz: ZoneInfo = KARACHI) -> datetime:
    return datetime(day.year, day.month, day.day, hh, mm, tzinfo=tz).astimezone(UTC)


def args(**over: Any) -> dict[str, Any]:
    values: dict[str, Any] = {
        "now": NOW,
        "tz": KARACHI,
        "window_days": 14,
        "lead_minutes": 0,
        "sessions": TWO_SESSIONS,
        "leave": [],
        "holidays": [],
        "bookings": [],
    }
    values.update(over)
    return values


def day_of(days: list[DayOut], d: date) -> DayOut:
    return next(day for day in days if day.date == d)


def times(day: DayOut) -> list[str]:
    return [s.local_time for s in day.slots]


def test_grid_and_break() -> None:
    days = build_days(**args(now=local(date(2026, 10, 4), 8)))
    monday = day_of(days, MONDAY)
    expected = [f"{h}:{m:02d}" for h in (10, 11, 12) for m in (0, 15, 30, 45)]
    expected += [f"{h}:{m:02d}" for h in (17, 18, 19) for m in (0, 15, 30, 45)]
    assert times(monday) == [t.zfill(5) for t in expected]
    assert "13:00" not in times(monday)
    assert monday.status == "available"
    assert monday.weekday == "mon"


def test_session_not_a_multiple_of_slot_length_drops_the_partial_slot() -> None:
    sessions = [SessionRule("mon", time(10, 0), time(12, 50), 20)]
    monday = day_of(build_days(**args(sessions=sessions, now=local(date(2026, 10, 4), 8))), MONDAY)
    # 20-minute grid from 10:00: the 12:40 slot would end at 13:00, past the session end.
    assert times(monday)[-1] == "12:20"
    sessions = [SessionRule("mon", time(10, 0), time(12, 50), 15)]
    monday = day_of(build_days(**args(sessions=sessions, now=local(date(2026, 10, 4), 8))), MONDAY)
    assert times(monday)[-1] == "12:30"


def test_slot_instants_are_utc_and_end_after_slot_length() -> None:
    monday = day_of(build_days(**args()), MONDAY)
    first = monday.slots[0]
    assert first.starts_at == datetime(2026, 10, 5, 5, 0, tzinfo=UTC)  # 10:00 PKT
    assert first.ends_at - first.starts_at == timedelta(minutes=15)
    assert first.local_time == "10:00"


def test_lead_time_hides_slots_before_now_plus_lead() -> None:
    sessions = [SessionRule("mon", time(10, 0), time(16, 0), 15)]
    now = local(MONDAY, 11, 5)
    monday = day_of(build_days(**args(sessions=sessions, now=now, lead_minutes=120)), MONDAY)
    assert times(monday)[0] == "13:15"


def test_slot_starting_exactly_at_the_lead_boundary_is_kept() -> None:
    sessions = [SessionRule("mon", time(10, 0), time(16, 0), 15)]
    now = local(MONDAY, 11, 0)
    monday = day_of(build_days(**args(sessions=sessions, now=now, lead_minutes=120)), MONDAY)
    assert times(monday)[0] == "13:00"


def test_whole_day_leave_is_doctor_unavailable() -> None:
    leave = [Busy(local(NEXT_MONDAY, 0), local(NEXT_MONDAY + timedelta(days=1), 0))]
    day = day_of(build_days(**args(leave=leave)), NEXT_MONDAY)
    assert day.status == "doctor_unavailable"
    assert day.slots == []


def test_partial_leave_removes_only_overlapping_slots() -> None:
    leave = [Busy(local(NEXT_MONDAY, 10, 20), local(NEXT_MONDAY, 11, 0))]
    day = day_of(build_days(**args(leave=leave)), NEXT_MONDAY)
    assert day.status == "available"
    got = times(day)
    assert "10:15" not in got  # 10:15-10:30 overlaps the leave
    assert "10:00" in got
    assert "10:45" not in got
    assert "11:00" in got


def test_holiday_is_clinic_closed_with_name() -> None:
    day = day_of(build_days(**args(holidays=[Holiday(NEXT_MONDAY, "Sample holiday")])), NEXT_MONDAY)
    assert day.status == "clinic_closed"
    assert day.holiday_name == "Sample holiday"
    assert day.slots == []


def test_non_working_weekday_is_not_working() -> None:
    day = day_of(build_days(**args()), TUESDAY)
    assert day.status == "not_working"
    assert day.slots == []
    assert day.weekday == "tue"
    assert day.holiday_name is None


def test_holiday_wins_over_a_non_working_day() -> None:
    day = day_of(build_days(**args(holidays=[Holiday(TUESDAY, "Closed")])), TUESDAY)
    assert day.status == "clinic_closed"


def test_booking_removes_overlapping_slots_of_any_length() -> None:
    # A 30-minute booking at 10:00 blocks the 10:00 and 10:15 grid slots.
    bookings = [Busy(local(NEXT_MONDAY, 10, 0), local(NEXT_MONDAY, 10, 30))]
    day = day_of(build_days(**args(bookings=bookings)), NEXT_MONDAY)
    got = times(day)
    assert "10:00" not in got and "10:15" not in got
    assert "10:30" in got
    # Back-to-back is not an overlap.
    bookings = [Busy(local(NEXT_MONDAY, 10, 15), local(NEXT_MONDAY, 10, 30))]
    got = times(day_of(build_days(**args(bookings=bookings)), NEXT_MONDAY))
    assert "10:00" in got and "10:30" in got and "10:15" not in got


def test_every_slot_booked_is_fully_booked() -> None:
    bookings = [
        Busy(local(NEXT_MONDAY, 10), local(NEXT_MONDAY, 13)),
        Busy(local(NEXT_MONDAY, 17), local(NEXT_MONDAY, 20)),
    ]
    day = day_of(build_days(**args(bookings=bookings)), NEXT_MONDAY)
    assert day.status == "fully_booked"
    assert day.slots == []


def test_leave_plus_bookings_covering_everything_is_fully_booked() -> None:
    leave = [Busy(local(NEXT_MONDAY, 10), local(NEXT_MONDAY, 13))]
    bookings = [Busy(local(NEXT_MONDAY, 17), local(NEXT_MONDAY, 20))]
    day = day_of(build_days(**args(leave=leave, bookings=bookings)), NEXT_MONDAY)
    assert day.status == "fully_booked"


def test_everything_in_the_past_is_no_longer_available() -> None:
    now = local(MONDAY, 21, 0)
    day = day_of(build_days(**args(now=now)), MONDAY)
    assert day.status == "no_longer_available"
    assert day.slots == []


def test_lead_time_can_make_today_no_longer_available() -> None:
    now = local(MONDAY, 18, 30)
    day = day_of(build_days(**args(now=now, lead_minutes=120)), MONDAY)
    assert day.status == "no_longer_available"


def test_window_is_today_plus_window_days() -> None:
    days = build_days(**args(window_days=14))
    assert len(days) == 14
    assert days[0].date == MONDAY
    assert days[-1].date == MONDAY + timedelta(days=13)


def test_days_larger_than_the_window_are_clamped() -> None:
    assert len(build_days(**args(window_days=14, days=60))) == 14
    assert len(build_days(**args(window_days=14, days=3))) == 3


def test_from_in_the_past_is_clamped_to_today() -> None:
    days = build_days(**args(from_date=date(2026, 9, 1)))
    assert days[0].date == MONDAY


def test_from_inside_the_window_starts_there_and_never_exceeds_it() -> None:
    days = build_days(**args(from_date=date(2026, 10, 10), days=60))
    assert days[0].date == date(2026, 10, 10)
    assert days[-1].date == MONDAY + timedelta(days=13)


def test_from_after_the_window_gives_no_days() -> None:
    assert build_days(**args(from_date=date(2026, 12, 1))) == []


def test_karachi_day_boundary_is_local_not_utc() -> None:
    # 23:45 Karachi on Monday is 18:45 UTC the same day; a 00:15 Tuesday slot is 19:15 UTC Monday.
    late = [
        SessionRule("mon", time(23, 30), time(23, 59), 5),
        SessionRule("tue", time(0, 0), time(1, 0), 15),
    ]
    days = build_days(**args(sessions=late, now=local(date(2026, 10, 4), 8)))
    monday = day_of(days, MONDAY)
    assert times(monday)[-1] == "23:50"
    assert times(day_of(days, TUESDAY))[0] == "00:00"
    at_2345 = next(s for s in monday.slots if s.local_time == "23:45")
    assert at_2345.starts_at == datetime(2026, 10, 5, 18, 45, tzinfo=UTC)


@pytest.mark.skipif(not hasattr(time_module, "tzset"), reason="time.tzset is not available here")
def test_process_time_zone_does_not_change_the_result(monkeypatch: pytest.MonkeyPatch) -> None:
    baseline = build_days(**args())
    monkeypatch.setenv("TZ", "America/New_York")
    time_module.tzset()
    try:
        assert build_days(**args()) == baseline
    finally:
        monkeypatch.undo()
        time_module.tzset()


def test_dst_gap_skips_nonexistent_local_times() -> None:
    london = ZoneInfo("Europe/London")
    # 2026-03-29: clocks go 01:00 -> 02:00, so 01:00-01:59 does not exist.
    sunday = date(2026, 3, 29)
    sessions = [SessionRule("sun", time(0, 30), time(3, 0), 30)]
    now = datetime(2026, 3, 28, 12, 0, tzinfo=UTC)
    days = build_days(**args(tz=london, sessions=sessions, now=now, window_days=3))
    day = day_of(days, sunday)
    assert times(day) == ["00:30", "02:00", "02:30"]


def test_dst_fold_uses_the_first_occurrence() -> None:
    london = ZoneInfo("Europe/London")
    # 2026-10-25: 01:00-01:59 happens twice; the engine uses fold=0 (still BST, UTC+1).
    sunday = date(2026, 10, 25)
    sessions = [SessionRule("sun", time(1, 0), time(2, 0), 30)]
    now = datetime(2026, 10, 24, 12, 0, tzinfo=UTC)
    day = day_of(build_days(**args(tz=london, sessions=sessions, now=now, window_days=3)), sunday)
    assert times(day) == ["01:00", "01:30"]
    assert day.slots[0].starts_at == datetime(2026, 10, 25, 0, 0, tzinfo=UTC)


def test_next_free_returns_at_most_five_ascending_slots_after_the_instant() -> None:
    after = local(NEXT_MONDAY, 10, 0)
    got = next_free(**args(after=after, limit=5))
    assert len(got) == 5
    assert [s.starts_at for s in got] == sorted(s.starts_at for s in got)
    assert all(s.starts_at > after for s in got)
    assert got[0].local_time == "10:15"


def test_next_free_skips_taken_slots_and_crosses_days() -> None:
    bookings = [Busy(local(NEXT_MONDAY, 12, 45), local(NEXT_MONDAY, 13, 0))]
    got = next_free(**args(after=local(NEXT_MONDAY, 12, 30), bookings=bookings, limit=2))
    assert [s.local_time for s in got] == ["17:00", "17:15"]  # 12:45 is taken, then the break
    got = next_free(**args(after=local(MONDAY, 19, 45), limit=2))
    assert [s.local_time for s in got] == ["10:00", "10:15"]
    assert got[0].starts_at.date() == NEXT_MONDAY


def test_next_free_is_empty_when_nothing_is_left() -> None:
    assert next_free(**args(after=local(MONDAY + timedelta(days=30), 9), limit=5)) == []


def test_is_available_matches_a_grid_slot_only() -> None:
    free = is_available(**args(starts_at=local(NEXT_MONDAY, 10, 15)))
    assert free is not None
    assert free.local_time == "10:15"
    assert free.ends_at == local(NEXT_MONDAY, 10, 30)
    assert is_available(**args(starts_at=local(NEXT_MONDAY, 10, 10))) is None  # off-grid
    assert is_available(**args(starts_at=local(NEXT_MONDAY, 13, 0))) is None  # in the break
    assert is_available(**args(now=local(MONDAY, 11), starts_at=local(MONDAY, 10, 0))) is None
    assert is_available(**args(starts_at=local(MONDAY + timedelta(days=21), 10))) is None  # window
    bookings = [Busy(local(NEXT_MONDAY, 10, 15), local(NEXT_MONDAY, 10, 30))]
    assert is_available(**args(starts_at=local(NEXT_MONDAY, 10, 15), bookings=bookings)) is None
