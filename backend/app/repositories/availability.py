"""Queries behind slot generation and booking. Every datetime returned is aware UTC.

The database can be a network round trip away, so a slots request reads everything in two queries:
``load_booking_context`` (settings, doctor, weekly sessions) and ``load_availability`` (leave,
holidays and confirmed bookings in one ``UNION ALL``).
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import Date as SqlDate
from sqlalchemy import DateTime as SqlDateTime
from sqlalchemy import and_, cast, literal, union_all
from sqlalchemy import select as core_select
from sqlmodel import Session, col, select

from app import models as m
from app.booking.slots import Busy, Holiday, SessionRule
from app.booking.timeutil import to_utc
from app.repositories._common import require_id
from app.repositories.doctors import _sessions


@dataclass(frozen=True)
class BookingSettings:
    time_zone: ZoneInfo
    window_days: int
    lead_minutes: int
    max_active_per_phone: int


@dataclass(frozen=True)
class BookableDoctor:
    id: uuid.UUID
    slug: str
    full_name: str
    specialty: str
    fee_pkr: int
    department_id: uuid.UUID
    department_slug: str
    department_name: str


@dataclass(frozen=True)
class BookingContext:
    settings: BookingSettings
    #: ``None`` when no active doctor in an active department has this slug.
    doctor: BookableDoctor | None
    sessions: list[SessionRule]


@dataclass(frozen=True)
class Availability:
    """Leave, holidays and confirmed bookings for one doctor across the booking window."""

    leave: list[Busy]
    holidays: list[Holiday]
    bookings: list[Busy]


def _c(attribute: Any) -> Any:
    """``col()`` typed loosely, so datetime columns fit a multi-column ``select``."""
    return col(attribute)


def _parse_time(text: str) -> time:
    hours, minutes = text.split(":")
    return time(int(hours), int(minutes))


def load_booking_context(session: Session, slug: str) -> BookingContext | None:
    """Clinic settings plus the bookable doctor and their weekly sessions, in one query.

    Returns ``None`` when the clinic is not configured. The doctor must be active, in an active
    department.
    """
    stmt = (
        select(m.ClinicSettings, m.Doctor, m.Department, _sessions().label("sessions"))
        .select_from(m.ClinicSettings)
        .outerjoin(m.Doctor, and_(col(m.Doctor.slug) == slug, col(m.Doctor.is_active)))
        .outerjoin(
            m.Department,
            and_(col(m.Department.id) == col(m.Doctor.department_id), col(m.Department.is_active)),
        )
    )
    row: Any = session.exec(stmt).first()
    if row is None:
        return None
    clinic, doctor, department, raw_sessions = row
    settings = BookingSettings(
        time_zone=ZoneInfo(clinic.time_zone),
        window_days=clinic.booking_window_days,
        lead_minutes=clinic.booking_lead_minutes,
        max_active_per_phone=clinic.max_active_bookings_per_phone,
    )
    if doctor is None or department is None:
        return BookingContext(settings, None, [])
    bookable = BookableDoctor(
        id=require_id(doctor.id),
        slug=doctor.slug,
        full_name=doctor.full_name,
        specialty=doctor.specialty,
        fee_pkr=doctor.fee_pkr,
        department_id=require_id(department.id),
        department_slug=department.slug,
        department_name=department.name,
    )
    rules = [
        SessionRule(s["weekday"], _parse_time(s["start"]), _parse_time(s["end"]), s["slotMinutes"])
        for s in (raw_sessions or [])
    ]
    return BookingContext(settings, bookable, rules)


def window_bounds(
    now: datetime, settings: BookingSettings
) -> tuple[date, date, datetime, datetime]:
    """First and last clinic-local dates of the window, and the UTC range that covers them."""
    tz = settings.time_zone
    first = to_utc(now).astimezone(tz).date()
    last = first + timedelta(days=settings.window_days - 1)
    start = datetime.combine(first, time.min, tzinfo=tz).astimezone(UTC)
    end = datetime.combine(last + timedelta(days=1), time.min, tzinfo=tz).astimezone(UTC)
    return first, last, start, end


def load_availability(
    session: Session, doctor_id: uuid.UUID, settings: BookingSettings, now: datetime
) -> Availability:
    """Leave and confirmed bookings overlapping the window, and holidays inside it.

    The leave note is never selected.
    """
    first, last, start, end = window_bounds(now, settings)
    null_instant: Any = cast(literal(None), SqlDateTime(timezone=True))
    null_date: Any = cast(literal(None), SqlDate)
    none_text: Any = literal(None)
    leave = core_select(
        literal("leave").label("kind"),
        _c(m.DoctorLeave.starts_at).label("a"),
        _c(m.DoctorLeave.ends_at).label("b"),
        null_date.label("d"),
        none_text.label("n"),
    ).where(
        col(m.DoctorLeave.doctor_id) == doctor_id,
        col(m.DoctorLeave.starts_at) < end,
        col(m.DoctorLeave.ends_at) > start,
    )
    booked = core_select(
        literal("booking").label("kind"),
        _c(m.Appointment.starts_at).label("a"),
        _c(m.Appointment.ends_at).label("b"),
        null_date.label("d"),
        none_text.label("n"),
    ).where(
        col(m.Appointment.doctor_id) == doctor_id,
        col(m.Appointment.status) == "confirmed",
        col(m.Appointment.starts_at) < end,
        col(m.Appointment.ends_at) > start,
    )
    holidays = core_select(
        literal("holiday").label("kind"),
        null_instant.label("a"),
        null_instant.label("b"),
        _c(m.ClinicHoliday.holiday_date).label("d"),
        _c(m.ClinicHoliday.name).label("n"),
    ).where(col(m.ClinicHoliday.holiday_date) >= first, col(m.ClinicHoliday.holiday_date) <= last)

    out = Availability([], [], [])
    for kind, a, b, d, n in session.execute(union_all(leave, booked, holidays)):
        if kind == "leave":
            out.leave.append(Busy(to_utc(a), to_utc(b)))
        elif kind == "booking":
            out.bookings.append(Busy(to_utc(a), to_utc(b)))
        else:
            out.holidays.append(Holiday(d, n))
    return out
