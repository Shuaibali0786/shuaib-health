"""Overview, Insights and Doctors-today numbers (data-model §8), pure, shared by both sources.

Nothing here reads a clock, a database or the process time zone: the caller passes the instant, the
clinic zone and the facts. A booking belongs to the clinic-local date of its start (SC-009).
"""

import uuid
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Final
from zoneinfo import ZoneInfo

from app.booking.slots import WEEKDAYS, Busy, SessionRule, scheduled_grid
from app.command_centre.schemas import (
    AgendaDoctor,
    BookingSummary,
    DayCount,
    DepartmentCount,
    DoctorRef,
    DoctorsToday,
    DoctorToday,
    HourCount,
    Insights,
    InsightsRange,
    Kpis,
    Overview,
    RecentBooking,
    StatusCount,
    Trend,
    WorkHours,
)
from app.command_centre.status import STATUSES

NEXT_UP_LIMIT: Final = 5
NEXT_UP_GRACE: Final = timedelta(minutes=15)  # late arrivals are still listed
TREND_DAYS: Final = 7


@dataclass(frozen=True)
class KpiValues:
    appointments: int
    arrived: int
    completed: int
    no_shows: int
    cancellations: int
    utilisation_pct: int | None


def day_counts(items: Iterable[tuple[datetime, str]], day: date, tz: ZoneInfo) -> dict[str, int]:
    """Bookings per status whose start falls on the clinic-local ``day``."""
    counts: dict[str, int] = {}
    for starts_at, status in items:
        if starts_at.astimezone(tz).date() == day:
            counts[status] = counts.get(status, 0) + 1
    return counts


def utilisation_pct(booked: int, slots: int) -> int | None:
    """Booked over scheduled slots as a whole percent, halves rounded up; ``None`` with no slots."""
    if slots <= 0:
        return None
    return (200 * booked + slots) // (2 * slots)


def kpi_values(counts: Mapping[str, int], slots: int) -> KpiValues:
    completed = counts.get("completed", 0)
    appointments = sum(n for status, n in counts.items() if status != "cancelled")
    return KpiValues(
        appointments=appointments,
        arrived=counts.get("arrived", 0) + completed,
        completed=completed,
        no_shows=counts.get("no_show", 0),
        cancellations=counts.get("cancelled", 0),
        utilisation_pct=utilisation_pct(appointments, slots),
    )


def trend(value: int | None, previous: int | None, compared_to: date) -> Trend:
    delta = None if value is None or previous is None else value - previous
    return Trend(value=value, previous=previous, delta=delta, compared_to=compared_to)


def build_kpis(today: KpiValues, last_week: KpiValues, day: date) -> Kpis:
    """Each KPI against the same weekday a week earlier; utilisation moves in percentage points."""
    compared_to = day - timedelta(days=TREND_DAYS)

    def pair(name: str) -> Trend:
        return trend(getattr(today, name), getattr(last_week, name), compared_to)

    return Kpis(
        appointments=pair("appointments"),
        arrived=pair("arrived"),
        completed=pair("completed"),
        no_shows=pair("no_shows"),
        cancellations=pair("cancellations"),
        utilisation_pct=pair("utilisation_pct"),
    )


def _overlaps(start: datetime, end: datetime, busy: Sequence[Busy]) -> bool:
    return any(start < b.end and end > b.start for b in busy)


def scheduled_slots(
    day: date,
    tz: ZoneInfo,
    sessions: list[SessionRule],
    leave: Sequence[Busy],
    *,
    closed: bool = False,
) -> int:
    """Slots of the 005 grid on ``day`` that are not on leave; none on a clinic holiday."""
    if closed:
        return 0
    return sum(
        1
        for slot in scheduled_grid(day, sessions, tz)
        if not _overlaps(slot.starts_at, slot.ends_at, leave)
    )


def next_up(bookings: Sequence[BookingSummary], now: datetime) -> list[BookingSummary]:
    """Confirmed bookings starting no earlier than 15 minutes ago, soonest first, at most five."""
    waiting = [
        b for b in bookings if b.status == "confirmed" and b.starts_at >= now - NEXT_UP_GRACE
    ]
    waiting.sort(key=lambda b: (b.starts_at, b.doctor.name, b.reference))
    return waiting[:NEXT_UP_LIMIT]


@dataclass(frozen=True)
class DoctorPlan:
    """What the Overview needs to know about a doctor's week, whichever source it came from."""

    doctor: DoctorRef
    sessions: list[SessionRule]
    #: Leave overlapping the two days looked at (today and the same weekday a week earlier).
    leave: list[Busy]


def _hours(sessions: list[SessionRule], day: date) -> list[WorkHours]:
    weekday = WEEKDAYS[day.weekday()]
    todays = sorted((s for s in sessions if s.weekday == weekday), key=lambda s: s.start)
    return [WorkHours(start=s.start.strftime("%H:%M"), end=s.end.strftime("%H:%M")) for s in todays]


def build_overview(
    *,
    day: date,
    now: datetime,
    tz: ZoneInfo,
    plans: Sequence[DoctorPlan],
    today: Sequence[BookingSummary],
    last_week_counts: Mapping[str, int],
    holiday_today: str | None,
    holiday_last_week: bool,
    recent: Sequence[RecentBooking],
    is_sample: bool,
) -> Overview:
    """Assembles the Overview from facts both sources can supply (data-model §8)."""
    earlier = day - timedelta(days=TREND_DAYS)
    slots_today = {
        p.doctor.id: scheduled_slots(day, tz, p.sessions, p.leave, closed=holiday_today is not None)
        for p in plans
    }
    slots_earlier = sum(
        scheduled_slots(earlier, tz, p.sessions, p.leave, closed=holiday_last_week) for p in plans
    )
    today_counts: dict[str, int] = {}
    for booking in today:
        today_counts[booking.status] = today_counts.get(booking.status, 0) + 1
    kpis = build_kpis(
        kpi_values(today_counts, sum(slots_today.values())),
        kpi_values(last_week_counts, slots_earlier),
        day,
    )

    by_doctor: dict[uuid.UUID, list[BookingSummary]] = {}
    for booking in today:
        by_doctor.setdefault(booking.doctor.id, []).append(booking)
    plan_of = {p.doctor.id: p for p in plans}
    agenda: list[AgendaDoctor] = []
    if today:  # nobody booked at all is the empty state, not a list of idle doctors
        for doctor_id in plan_of.keys() | by_doctor.keys():
            plan = plan_of.get(doctor_id)
            items = sorted(by_doctor.get(doctor_id, []), key=lambda b: (b.starts_at, b.reference))
            if not items and not slots_today.get(doctor_id):
                continue
            doctor = plan.doctor if plan else items[0].doctor
            agenda.append(
                AgendaDoctor(
                    doctor=doctor,
                    sessions=_hours(plan.sessions, day) if plan else [],
                    items=items,
                )
            )
        agenda.sort(key=lambda a: (a.sessions[0].start if a.sessions else "99:99", a.doctor.name))

    return Overview(
        local_date=day,
        now=now,
        clinic_closed=holiday_today,
        kpis=kpis,
        agenda=agenda,
        next_up=next_up(today, now),
        recent_bookings=list(recent),
        is_sample=is_sample,
    )


# ----- Insights (US6, FR-028) -------------------------------------------------------------------

#: Fewer bookings than this in the range and the page says there is too little data to chart.
INSIGHTS_MIN_BOOKINGS: Final = 5


@dataclass(frozen=True)
class InsightRow:
    """The three facts Insights needs of one booking."""

    starts_at: datetime
    status: str
    department_name: str


def build_insights(
    *,
    range_days: InsightsRange,
    today: date,
    tz: ZoneInfo,
    rows: Iterable[InsightRow],
    is_sample: bool,
) -> Insights:
    """Charts of the ``range_days`` clinic-local days ending ``today``.

    ``per_day`` is zero-filled; ``total``, ``per_day``, ``by_department.count`` and ``by_hour`` all
    count bookings that were not cancelled (so they agree with each other and with the Overview's
    Appointments); ``by_status`` has all five statuses and ``by_department.cancelled`` the rest.
    """
    first = today - timedelta(days=range_days - 1)
    per_day = {first + timedelta(days=i): 0 for i in range(range_days)}
    by_status: dict[str, int] = dict.fromkeys(STATUSES, 0)
    by_hour = dict.fromkeys(range(24), 0)
    departments: dict[str, list[int]] = {}
    for row in rows:
        local = row.starts_at.astimezone(tz)
        if not first <= local.date() <= today:
            continue
        by_status[row.status] = by_status.get(row.status, 0) + 1
        pair = departments.setdefault(row.department_name, [0, 0])
        if row.status == "cancelled":
            pair[1] += 1
            continue
        pair[0] += 1
        per_day[local.date()] += 1
        by_hour[local.hour] += 1
    return Insights(
        range_days=range_days,
        from_=first,
        to=today,
        total=sum(per_day.values()),
        per_day=[DayCount(date=d, count=n) for d, n in per_day.items()],
        by_department=[
            DepartmentCount(department_name=name, count=pair[0], cancelled=pair[1])
            for name, pair in sorted(departments.items(), key=lambda item: (-item[1][0], item[0]))
        ],
        by_status=[StatusCount(status=s, count=by_status[s]) for s in STATUSES],
        by_hour=[HourCount(hour=h, count=n) for h, n in by_hour.items()],
        is_sample=is_sample,
    )


# ----- Doctors today (US7, FR-029) --------------------------------------------------------------


def build_doctors_today(
    *,
    day: date,
    now: datetime,
    tz: ZoneInfo,
    plans: Sequence[DoctorPlan],
    booked_starts: Mapping[uuid.UUID, Sequence[datetime]],
    holiday: str | None,
    is_sample: bool,
) -> DoctorsToday:
    """Who is in on ``day``: sessions, slots scheduled, booked and free, utilisation, next free.

    ``booked_starts`` holds the start of every non-cancelled booking of the day per doctor. A free
    slot is a scheduled slot nobody booked; one that has already started counts in ``free_passed``.
    Leave over every slot of a doctor's session day is "on leave"; no session that weekday is
    "not in"; a clinic holiday empties all three lists and names the holiday.
    """
    if holiday is not None:
        return DoctorsToday(
            local_date=day,
            clinic_closed=holiday,
            working=[],
            on_leave=[],
            not_in=[],
            is_sample=is_sample,
        )
    working: list[tuple[DoctorToday, datetime | None]] = []
    on_leave: list[DoctorRef] = []
    not_in: list[DoctorRef] = []
    for plan in sorted(plans, key=lambda p: p.doctor.name):
        grid = scheduled_grid(day, plan.sessions, tz)
        if not grid:
            not_in.append(plan.doctor)
            continue
        slots = [s for s in grid if not _overlaps(s.starts_at, s.ends_at, plan.leave)]
        if not slots:
            on_leave.append(plan.doctor)
            continue
        taken = set(booked_starts.get(plan.doctor.id, ()))
        booked = len(booked_starts.get(plan.doctor.id, ()))
        free_slots = [s for s in slots if s.starts_at not in taken]
        upcoming = next((s.starts_at for s in free_slots if s.starts_at >= now), None)
        entry = DoctorToday(
            doctor=plan.doctor,
            sessions=_hours(plan.sessions, day),
            scheduled=len(slots),
            booked=booked,
            free=max(0, len(slots) - booked),
            free_passed=min(
                max(0, len(slots) - booked), sum(1 for s in free_slots if s.starts_at < now)
            ),
            utilisation_pct=utilisation_pct(booked, len(slots)) or 0,
            next_free=upcoming.astimezone(tz).strftime("%H:%M") if upcoming else None,
        )
        working.append((entry, upcoming))
    far = datetime.max.replace(tzinfo=now.tzinfo)
    working.sort(key=lambda item: (item[1] or far, item[0].doctor.name))
    return DoctorsToday(
        local_date=day,
        clinic_closed=None,
        working=[entry for entry, _ in working],
        on_leave=on_leave,
        not_in=not_in,
        is_sample=is_sample,
    )
