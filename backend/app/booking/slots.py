"""The slot engine (data-model section 9).

Pure functions: no I/O, no ``datetime.now()``, no process time zone. The caller passes the current
instant, the clinic time zone and every fact the answer depends on. All instants in and out are
aware UTC datetimes; ``local_time`` and dates are in the clinic time zone.
"""

from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from typing import Literal
from zoneinfo import ZoneInfo

from app.booking.timeutil import to_utc

WEEKDAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
DayStatus = Literal[
    "available",
    "fully_booked",
    "doctor_unavailable",
    "clinic_closed",
    "not_working",
    "no_longer_available",
]


@dataclass(frozen=True)
class SessionRule:
    weekday: str
    start: time
    end: time
    slot_minutes: int


@dataclass(frozen=True)
class Busy:
    """A half-open ``[start, end)`` range in which nothing can be booked (leave or a booking)."""

    start: datetime
    end: datetime


@dataclass(frozen=True)
class Holiday:
    date: date
    name: str


@dataclass(frozen=True)
class SlotOut:
    starts_at: datetime
    ends_at: datetime
    local_time: str


@dataclass(frozen=True)
class DayOut:
    date: date
    weekday: str
    status: DayStatus
    holiday_name: str | None
    slots: list[SlotOut]


def _overlaps(start: datetime, end: datetime, busy: list[Busy]) -> bool:
    return any(start < b.end and end > b.start for b in busy)


def _grid(day: date, rule: SessionRule, tz: ZoneInfo) -> list[SlotOut]:
    """Slots start at ``rule.start + k * slot_minutes`` and must end by ``rule.end``.

    Times are built with ``fold=0``. A wall-clock time that does not exist (a DST gap) does not
    survive the round trip through UTC, so it is skipped.
    """
    first = rule.start.hour * 60 + rule.start.minute
    last = rule.end.hour * 60 + rule.end.minute
    out: list[SlotOut] = []
    minute = first
    while minute + rule.slot_minutes <= last:
        wall = datetime(day.year, day.month, day.day, minute // 60, minute % 60)
        start = wall.replace(tzinfo=tz, fold=0).astimezone(UTC)
        if start.astimezone(tz).replace(tzinfo=None) == wall:
            end = start + timedelta(minutes=rule.slot_minutes)
            out.append(SlotOut(start, end, wall.strftime("%H:%M")))
        minute += rule.slot_minutes
    return out


def scheduled_grid(day: date, sessions: list[SessionRule], tz: ZoneInfo) -> list[SlotOut]:
    """Every slot of the weekday's sessions, before lead time, leave and bookings.

    The Command Centre counts these as "scheduled" for chair utilisation.
    """
    weekday = WEEKDAYS[day.weekday()]
    todays = sorted((s for s in sessions if s.weekday == weekday), key=lambda s: s.start)
    return [slot for rule in todays for slot in _grid(day, rule, tz)]


def _build_day(
    day: date,
    *,
    now: datetime,
    tz: ZoneInfo,
    lead_minutes: int,
    sessions: list[SessionRule],
    leave: list[Busy],
    holidays: dict[date, str],
    bookings: list[Busy],
) -> DayOut:
    weekday = WEEKDAYS[day.weekday()]
    if day in holidays:
        return DayOut(day, weekday, "clinic_closed", holidays[day], [])
    todays = sorted((s for s in sessions if s.weekday == weekday), key=lambda s: s.start)
    if not todays:
        return DayOut(day, weekday, "not_working", None, [])

    candidates = [slot for rule in todays for slot in _grid(day, rule, tz)]
    earliest = now + timedelta(minutes=lead_minutes)
    after_lead = [s for s in candidates if s.starts_at >= earliest]
    after_leave = [s for s in after_lead if not _overlaps(s.starts_at, s.ends_at, leave)]
    free = [s for s in after_leave if not _overlaps(s.starts_at, s.ends_at, bookings)]

    status: DayStatus
    if free:
        status = "available"
    elif len(after_leave) < len(after_lead) and len(free) == len(after_leave):
        status = "doctor_unavailable"
    elif len(free) < len(after_leave):
        status = "fully_booked"
    else:
        status = "no_longer_available"
    return DayOut(day, weekday, status, None, free)


def build_days(
    *,
    now: datetime,
    tz: ZoneInfo,
    window_days: int,
    lead_minutes: int,
    sessions: list[SessionRule],
    leave: list[Busy],
    holidays: list[Holiday],
    bookings: list[Busy],
    from_date: date | None = None,
    days: int | None = None,
) -> list[DayOut]:
    """One ``DayOut`` per clinic-local date in the booking window (optionally narrowed)."""
    now = to_utc(now)
    today = now.astimezone(tz).date()
    last = today + timedelta(days=window_days - 1)
    first = max(from_date or today, today)
    final = min(first + timedelta(days=(days or window_days) - 1), last)
    holiday_names = {h.date: h.name for h in holidays}
    out: list[DayOut] = []
    day = first
    while day <= final:
        out.append(
            _build_day(
                day,
                now=now,
                tz=tz,
                lead_minutes=lead_minutes,
                sessions=sessions,
                leave=leave,
                holidays=holiday_names,
                bookings=bookings,
            )
        )
        day += timedelta(days=1)
    return out


def next_free(
    *,
    now: datetime,
    tz: ZoneInfo,
    window_days: int,
    lead_minutes: int,
    sessions: list[SessionRule],
    leave: list[Busy],
    holidays: list[Holiday],
    bookings: list[Busy],
    after: datetime,
    limit: int = 5,
) -> list[SlotOut]:
    """The next free slots strictly after ``after``, ascending, inside the booking window."""
    after = to_utc(after)
    every = build_days(
        now=now,
        tz=tz,
        window_days=window_days,
        lead_minutes=lead_minutes,
        sessions=sessions,
        leave=leave,
        holidays=holidays,
        bookings=bookings,
        from_date=after.astimezone(tz).date(),
    )
    slots = sorted((s for day in every for s in day.slots if s.starts_at > after), key=_start)
    return slots[:limit]


def is_available(
    *,
    now: datetime,
    tz: ZoneInfo,
    window_days: int,
    lead_minutes: int,
    sessions: list[SessionRule],
    leave: list[Busy],
    holidays: list[Holiday],
    bookings: list[Busy],
    starts_at: datetime,
) -> SlotOut | None:
    """The free slot that starts exactly at ``starts_at``, or ``None``."""
    starts_at = to_utc(starts_at)
    on_that_day = build_days(
        now=now,
        tz=tz,
        window_days=window_days,
        lead_minutes=lead_minutes,
        sessions=sessions,
        leave=leave,
        holidays=holidays,
        bookings=bookings,
        from_date=starts_at.astimezone(tz).date(),
        days=1,
    )
    for day in on_that_day:
        for slot in day.slots:
            if slot.starts_at == starts_at:
                return slot
    return None


def _start(slot: SlotOut) -> datetime:
    return slot.starts_at
