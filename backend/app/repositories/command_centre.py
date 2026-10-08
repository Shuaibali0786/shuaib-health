"""Command Centre queries over the real database (staff sessions only)."""

import uuid
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any, TypedDict

from sqlalchemy import Date, DateTime, Select, String, Uuid, cast, literal, null, or_, union_all
from sqlalchemy import select as sa_select
from sqlmodel import Session, col, func, select

from app import models as m
from app.repositories._common import escape_like, paginate, require_id


class SearchWindow(TypedDict):
    """Filters shared by the page query and the status counts (all but the statuses)."""

    q: str | None
    starts_from: datetime
    starts_before: datetime
    doctor_id: uuid.UUID | None
    department_id: uuid.UUID | None


@dataclass(frozen=True)
class BookingRow:
    appointment: m.Appointment
    doctor: m.Doctor
    department: m.Department


@dataclass(frozen=True)
class HistoryRow:
    change: m.AppointmentStatusChange
    actor_name: str


def _filtered(
    stmt: Select[Any],
    *,
    q: str | None,
    starts_from: datetime,
    starts_before: datetime,
    doctor_id: uuid.UUID | None,
    department_id: uuid.UUID | None,
) -> Select[Any]:
    stmt = stmt.where(col(m.Appointment.starts_at) >= starts_from).where(
        col(m.Appointment.starts_at) < starts_before
    )
    term = (q or "").strip()
    if term:
        pattern = escape_like(term)
        stmt = stmt.where(
            or_(
                col(m.Appointment.reference).ilike(pattern, escape="\\"),
                func.lower(col(m.Appointment.patient_name)).like(pattern.lower(), escape="\\"),
            )
        )
    if doctor_id is not None:
        stmt = stmt.where(col(m.Appointment.doctor_id) == doctor_id)
    if department_id is not None:
        stmt = stmt.where(col(m.Appointment.department_id) == department_id)
    return stmt


def status_counts(
    db: Session,
    *,
    q: str | None,
    starts_from: datetime,
    starts_before: datetime,
    doctor_id: uuid.UUID | None,
    department_id: uuid.UUID | None,
) -> dict[str, int]:
    """Bookings per status for the same filters but not the status filter (the chips)."""
    stmt = _filtered(
        select(m.Appointment.status, func.count()).select_from(m.Appointment),
        q=q,
        starts_from=starts_from,
        starts_before=starts_before,
        doctor_id=doctor_id,
        department_id=department_id,
    ).group_by(col(m.Appointment.status))
    return {str(status): int(n) for status, n in db.execute(stmt).all()}


def search_bookings(
    db: Session,
    *,
    q: str | None,
    starts_from: datetime,
    starts_before: datetime,
    doctor_id: uuid.UUID | None,
    department_id: uuid.UUID | None,
    statuses: list[str] | None,
    page: int,
    page_size: int,
) -> tuple[list[BookingRow], int]:
    stmt = _filtered(
        select(m.Appointment, m.Doctor, m.Department)
        .join(m.Doctor, col(m.Doctor.id) == col(m.Appointment.doctor_id))
        .join(m.Department, col(m.Department.id) == col(m.Appointment.department_id)),
        q=q,
        starts_from=starts_from,
        starts_before=starts_before,
        doctor_id=doctor_id,
        department_id=department_id,
    )
    if statuses:
        stmt = stmt.where(col(m.Appointment.status).in_(statuses))
    stmt = stmt.order_by(
        col(m.Appointment.starts_at), col(m.Doctor.full_name), col(m.Appointment.reference)
    )
    rows, total = paginate(db, stmt, page, page_size)
    return [BookingRow(a, d, p) for a, d, p in rows], total


def get_booking(db: Session, reference: str, *, lock: bool = False) -> BookingRow | None:
    stmt = (
        select(m.Appointment, m.Doctor, m.Department)
        .join(m.Doctor, col(m.Doctor.id) == col(m.Appointment.doctor_id))
        .join(m.Department, col(m.Department.id) == col(m.Appointment.department_id))
        .where(col(m.Appointment.reference) == reference.upper())
        .execution_options(populate_existing=True)
    )
    if lock:
        stmt = stmt.with_for_update(of=m.Appointment)
    found = db.exec(stmt).first()
    return BookingRow(*found) if found else None


def history(db: Session, appointment_id: uuid.UUID) -> list[HistoryRow]:
    rows = db.exec(
        select(m.AppointmentStatusChange, m.StaffAccount.display_name)
        .join(
            m.StaffAccount,
            col(m.StaffAccount.id) == col(m.AppointmentStatusChange.actor_staff_id),
        )
        .where(col(m.AppointmentStatusChange.appointment_id) == appointment_id)
        .order_by(
            col(m.AppointmentStatusChange.occurred_at),
            col(m.AppointmentStatusChange.version_after),
        )
    ).all()
    return [HistoryRow(change, name) for change, name in rows]


def latest_change(db: Session, appointment_id: uuid.UUID) -> m.AppointmentStatusChange | None:
    return db.exec(
        select(m.AppointmentStatusChange)
        .where(col(m.AppointmentStatusChange.appointment_id) == appointment_id)
        .order_by(
            col(m.AppointmentStatusChange.occurred_at).desc(),
            col(m.AppointmentStatusChange.version_after).desc(),
        )
        .limit(1)
    ).first()


def get_change(db: Session, change_id: uuid.UUID) -> m.AppointmentStatusChange | None:
    return db.get(m.AppointmentStatusChange, change_id)


def lookups(db: Session) -> tuple[list[tuple[m.Doctor, str]], list[m.Department]]:
    doctors = db.exec(
        select(m.Doctor, m.Department.name)
        .join(m.Department, col(m.Department.id) == col(m.Doctor.department_id))
        .order_by(col(m.Doctor.full_name))
    ).all()
    departments = db.exec(select(m.Department).order_by(col(m.Department.name))).all()
    return [(d, name) for d, name in doctors], list(departments)


def doctor_id_of(doctor: m.Doctor) -> uuid.UUID:
    return require_id(doctor.id)


# ----- Overview (US3) ---------------------------------------------------------------------------


def day_bookings(db: Session, starts_from: datetime, starts_before: datetime) -> list[BookingRow]:
    """Every booking starting in the window, whatever its status, in agenda order."""
    stmt = (
        select(m.Appointment, m.Doctor, m.Department)
        .join(m.Doctor, col(m.Doctor.id) == col(m.Appointment.doctor_id))
        .join(m.Department, col(m.Department.id) == col(m.Appointment.department_id))
        .where(col(m.Appointment.starts_at) >= starts_from)
        .where(col(m.Appointment.starts_at) < starts_before)
        .order_by(
            col(m.Appointment.starts_at), col(m.Doctor.full_name), col(m.Appointment.reference)
        )
    )
    return [BookingRow(a, d, p) for a, d, p in db.exec(stmt).all()]


def recent_bookings(db: Session, limit: int) -> list[BookingRow]:
    """The newest bookings by the time they were made, for the new-booking notifications."""
    stmt = (
        select(m.Appointment, m.Doctor, m.Department)
        .join(m.Doctor, col(m.Doctor.id) == col(m.Appointment.doctor_id))
        .join(m.Department, col(m.Department.id) == col(m.Appointment.department_id))
        .order_by(col(m.Appointment.created_at).desc(), col(m.Appointment.reference))
        .limit(limit)
    )
    return [BookingRow(a, d, p) for a, d, p in db.exec(stmt).all()]


@dataclass(frozen=True)
class WeeklyPlan:
    doctor: m.Doctor
    department_name: str
    sessions: list[m.DoctorWeeklySchedule]


def weekly_plans(db: Session) -> list[WeeklyPlan]:
    """Active doctors of active departments with their weekly sessions (one round trip)."""
    rows = db.exec(
        select(m.Doctor, m.Department.name, m.DoctorWeeklySchedule)
        .join(m.Department, col(m.Department.id) == col(m.Doctor.department_id))
        .join(
            m.DoctorWeeklySchedule,
            col(m.DoctorWeeklySchedule.doctor_id) == col(m.Doctor.id),
            isouter=True,
        )
        .where(col(m.Doctor.is_active), col(m.Department.is_active))
    ).all()
    plans: dict[uuid.UUID, WeeklyPlan] = {}
    for doctor, name, session in rows:
        plan = plans.setdefault(require_id(doctor.id), WeeklyPlan(doctor, name, []))
        if session is not None:
            plan.sessions.append(session)
    return list(plans.values())


def leave_and_holidays(
    db: Session, starts_from: datetime, starts_before: datetime, days: list[date]
) -> tuple[dict[uuid.UUID, list[tuple[datetime, datetime]]], dict[date, str]]:
    """``leave_between`` and ``holiday_names`` in one round trip (a UNION ALL of the two)."""
    leave_stmt: Select[Any] = sa_select(
        literal("leave").label("kind"),
        col(m.DoctorLeave.doctor_id).label("doctor_id"),
        col(m.DoctorLeave.starts_at).label("starts_at"),
        col(m.DoctorLeave.ends_at).label("ends_at"),
        cast(null(), Date).label("day"),
        cast(null(), String).label("name"),
    ).where(col(m.DoctorLeave.starts_at) < starts_before, col(m.DoctorLeave.ends_at) > starts_from)
    holiday_stmt: Select[Any] = sa_select(
        literal("holiday"),
        cast(null(), Uuid),
        cast(null(), DateTime(timezone=True)),
        cast(null(), DateTime(timezone=True)),
        col(m.ClinicHoliday.holiday_date),
        col(m.ClinicHoliday.name),
    ).where(col(m.ClinicHoliday.holiday_date).in_(days))
    leave: dict[uuid.UUID, list[tuple[datetime, datetime]]] = {}
    holidays: dict[date, str] = {}
    for kind, doctor_id, start, end, day, name in db.execute(
        union_all(leave_stmt, holiday_stmt)
    ).all():
        if kind == "leave":
            leave.setdefault(doctor_id, []).append((start, end))
        else:
            holidays[day] = name
    return leave, holidays


def leave_between(
    db: Session, starts_from: datetime, starts_before: datetime
) -> dict[uuid.UUID, list[tuple[datetime, datetime]]]:
    """Leave overlapping the window, per doctor. The internal note is never selected."""
    rows = db.exec(
        select(m.DoctorLeave.doctor_id, m.DoctorLeave.starts_at, m.DoctorLeave.ends_at)
        .where(col(m.DoctorLeave.starts_at) < starts_before)
        .where(col(m.DoctorLeave.ends_at) > starts_from)
    ).all()
    out: dict[uuid.UUID, list[tuple[datetime, datetime]]] = {}
    for doctor_id, start, end in rows:
        out.setdefault(doctor_id, []).append((start, end))
    return out


def holiday_names(db: Session, days: list[date]) -> dict[date, str]:
    rows = db.exec(
        select(col(m.ClinicHoliday.holiday_date), col(m.ClinicHoliday.name)).where(
            col(m.ClinicHoliday.holiday_date).in_(days)
        )
    ).all()
    return {day: name for day, name in rows}


# ----- Insights, doctors today, activity (US6-US8) ----------------------------------------------


def insight_rows(
    db: Session, starts_from: datetime, starts_before: datetime
) -> list[tuple[datetime, str, str]]:
    """Start, status and department name of every booking starting in the window."""
    stmt = (
        select(m.Appointment.starts_at, m.Appointment.status, m.Department.name)
        .join(m.Department, col(m.Department.id) == col(m.Appointment.department_id))
        .where(col(m.Appointment.starts_at) >= starts_from)
        .where(col(m.Appointment.starts_at) < starts_before)
    )
    return [(at, str(status), name) for at, status, name in db.execute(stmt).all()]


def booked_starts(
    db: Session, starts_from: datetime, starts_before: datetime
) -> dict[uuid.UUID, list[datetime]]:
    """Start of every non-cancelled booking in the window, per doctor."""
    stmt = (
        select(m.Appointment.doctor_id, m.Appointment.starts_at)
        .where(col(m.Appointment.starts_at) >= starts_from)
        .where(col(m.Appointment.starts_at) < starts_before)
        .where(col(m.Appointment.status) != "cancelled")
    )
    out: dict[uuid.UUID, list[datetime]] = {}
    for doctor_id, at in db.execute(stmt).all():
        out.setdefault(doctor_id, []).append(at)
    return out


@dataclass(frozen=True)
class ActivityRow:
    event: m.AuditLog
    actor_name: str | None


def activity_page(
    db: Session,
    *,
    action: str | None,
    staff_id: uuid.UUID | None,
    page: int,
    page_size: int,
) -> tuple[list[ActivityRow], int]:
    """Audit rows newest first, with the staff member's display name (never an email)."""
    stmt = select(m.AuditLog, m.StaffAccount.display_name).join(
        m.StaffAccount,
        col(m.StaffAccount.id) == col(m.AuditLog.actor_staff_id),
        isouter=True,
    )
    if action is not None:
        stmt = stmt.where(col(m.AuditLog.action) == action)
    if staff_id is not None:
        stmt = stmt.where(col(m.AuditLog.actor_staff_id) == staff_id)
    stmt = stmt.order_by(col(m.AuditLog.occurred_at).desc(), col(m.AuditLog.id))
    rows, total = paginate(db, stmt, page, page_size)
    return [ActivityRow(event, name) for event, name in rows], total
