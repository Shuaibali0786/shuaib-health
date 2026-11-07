"""Command Centre queries over the real database (staff sessions only)."""

import uuid
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any, NotRequired, TypedDict

from sqlalchemy import (
    Date,
    DateTime,
    Select,
    String,
    Uuid,
    cast,
    literal,
    null,
    or_,
    union_all,
    update,
)
from sqlalchemy import select as sa_select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlmodel import Session, col, func, select

from app import models as m
from app.repositories._common import escape_like, paginate, require_id


class SearchWindow(TypedDict):
    """Filters shared by the page query and the status counts (all but the statuses)."""

    q: str | None
    starts_from: datetime | None
    starts_before: datetime | None
    doctor_id: uuid.UUID | None
    department_id: uuid.UUID | None
    booked_since: NotRequired[datetime | None]


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
    starts_from: datetime | None,
    starts_before: datetime | None,
    doctor_id: uuid.UUID | None,
    department_id: uuid.UUID | None,
    booked_since: datetime | None = None,
) -> Select[Any]:
    if starts_from is not None:
        stmt = stmt.where(col(m.Appointment.starts_at) >= starts_from)
    if starts_before is not None:
        stmt = stmt.where(col(m.Appointment.starts_at) < starts_before)
    if booked_since is not None:
        stmt = stmt.where(col(m.Appointment.created_at) >= booked_since)
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
    starts_from: datetime | None,
    starts_before: datetime | None,
    doctor_id: uuid.UUID | None,
    department_id: uuid.UUID | None,
    booked_since: datetime | None = None,
) -> dict[str, int]:
    """Bookings per status for the same filters but not the status filter (the chips)."""
    stmt = _filtered(
        select(m.Appointment.status, func.count()).select_from(m.Appointment),
        q=q,
        starts_from=starts_from,
        starts_before=starts_before,
        doctor_id=doctor_id,
        department_id=department_id,
        booked_since=booked_since,
    ).group_by(col(m.Appointment.status))
    return {str(status): int(n) for status, n in db.execute(stmt).all()}


def search_bookings(
    db: Session,
    *,
    q: str | None,
    starts_from: datetime | None,
    starts_before: datetime | None,
    doctor_id: uuid.UUID | None,
    department_id: uuid.UUID | None,
    statuses: list[str] | None,
    page: int,
    page_size: int,
    booked_since: datetime | None = None,
    recently_booked_first: bool = False,
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
        booked_since=booked_since,
    )
    if statuses:
        stmt = stmt.where(col(m.Appointment.status).in_(statuses))
    if recently_booked_first:
        stmt = stmt.order_by(col(m.Appointment.created_at).desc(), col(m.Appointment.reference))
    else:
        stmt = stmt.order_by(
            col(m.Appointment.starts_at), col(m.Doctor.full_name), col(m.Appointment.reference)
        )
    rows, total = paginate(db, stmt, page, page_size)
    return [BookingRow(a, d, p) for a, d, p in rows], total


def day_counts(
    db: Session,
    *,
    tz_name: str,
    q: str | None,
    starts_from: datetime | None,
    starts_before: datetime | None,
    doctor_id: uuid.UUID | None,
    department_id: uuid.UUID | None,
    statuses: list[str] | None,
    booked_since: datetime | None = None,
    limit: int = 400,
) -> list[tuple[date, int]]:
    """Bookings per clinic-local day for the same filters (the Upcoming view's day headings)."""
    local_day = cast(func.timezone(tz_name, col(m.Appointment.starts_at)), Date)
    stmt = _filtered(
        select(local_day, func.count()).select_from(m.Appointment),
        q=q,
        starts_from=starts_from,
        starts_before=starts_before,
        doctor_id=doctor_id,
        department_id=department_id,
        booked_since=booked_since,
    )
    if statuses:
        stmt = stmt.where(col(m.Appointment.status).in_(statuses))
    stmt = stmt.group_by(local_day).order_by(local_day).limit(limit)
    return [(day, int(n)) for day, n in db.execute(stmt).all()]


# ----- Seen / new (Feature 012) -----------------------------------------------------------------


def seen_watermark(db: Session, staff_id: uuid.UUID) -> datetime | None:
    """The moment from which bookings count as new for this staff member."""
    staff = db.get(m.StaffAccount, staff_id)
    if staff is None:
        return None
    return staff.bookings_seen_at or staff.created_at


def new_ids(db: Session, staff_id: uuid.UUID, appointments: list[m.Appointment]) -> set[uuid.UUID]:
    """Which of these are new for the staff member: booked after their watermark, not opened."""
    if not appointments:
        return set()
    watermark = seen_watermark(db, staff_id)
    if watermark is None:
        return set()
    ids = [require_id(a.id) for a in appointments]
    seen = set(
        db.exec(
            select(m.BookingSeen.appointment_id)
            .where(col(m.BookingSeen.staff_id) == staff_id)
            .where(col(m.BookingSeen.appointment_id).in_(ids))
        ).all()
    )
    return {
        require_id(a.id)
        for a in appointments
        if a.created_at is not None and a.created_at > watermark and require_id(a.id) not in seen
    }


def _new_filter(staff_id: uuid.UUID, watermark: datetime) -> list[Any]:
    opened = (
        sa_select(literal(1))
        .select_from(m.BookingSeen)
        .where(col(m.BookingSeen.appointment_id) == col(m.Appointment.id))
        .where(col(m.BookingSeen.staff_id) == staff_id)
        .exists()
    )
    return [col(m.Appointment.created_at) > watermark, ~opened]


def new_count(db: Session, staff_id: uuid.UUID) -> int:
    watermark = seen_watermark(db, staff_id)
    if watermark is None:
        return 0
    stmt = select(func.count()).select_from(m.Appointment).where(*_new_filter(staff_id, watermark))
    return int(db.exec(stmt).one())


def new_bookings(db: Session, staff_id: uuid.UUID, limit: int) -> tuple[int, list[BookingRow]]:
    """How many bookings are new for the staff member, and the newest ``limit`` of them."""
    watermark = seen_watermark(db, staff_id)
    if watermark is None:
        return 0, []
    conditions = _new_filter(staff_id, watermark)
    count = db.exec(select(func.count()).select_from(m.Appointment).where(*conditions)).one()
    stmt = (
        select(m.Appointment, m.Doctor, m.Department)
        .join(m.Doctor, col(m.Doctor.id) == col(m.Appointment.doctor_id))
        .join(m.Department, col(m.Department.id) == col(m.Appointment.department_id))
        .where(*conditions)
        .order_by(col(m.Appointment.created_at).desc(), col(m.Appointment.reference))
        .limit(limit)
    )
    return int(count), [BookingRow(a, d, p) for a, d, p in db.exec(stmt).all()]


def mark_seen(db: Session, staff_id: uuid.UUID, appointment_ids: list[uuid.UUID]) -> None:
    """Record that the staff member opened these bookings (idempotent)."""
    for appointment_id in appointment_ids:
        db.execute(
            pg_insert(m.BookingSeen)
            .values(staff_id=staff_id, appointment_id=appointment_id)
            .on_conflict_do_nothing()
        )


def mark_all_seen(db: Session, staff_id: uuid.UUID, now: datetime) -> None:
    """Every booking made so far stops being new for this staff member."""
    db.execute(
        update(m.StaffAccount)
        .where(col(m.StaffAccount.id) == staff_id)
        .values(bookings_seen_at=now)
    )


def appointment_ids_of(db: Session, references: list[str]) -> list[uuid.UUID]:
    rows = db.exec(
        select(m.Appointment.id).where(
            col(m.Appointment.reference).in_([r.upper() for r in references])
        )
    ).all()
    return [require_id(i) for i in rows]


def card_counts(
    db: Session,
    *,
    today: tuple[datetime, datetime],
    tomorrow: tuple[datetime, datetime],
    next7: tuple[datetime, datetime],
    week: tuple[datetime, datetime],
) -> dict[str, int]:
    """Counts for the Overview cards in one query. Active means not cancelled."""
    starts = col(m.Appointment.starts_at)
    active = col(m.Appointment.status) != "cancelled"

    def between(window: tuple[datetime, datetime], *extra: Any) -> Any:
        return func.count().filter(starts >= window[0], starts < window[1], *extra)

    row = db.execute(
        select(
            between(today, active),
            between(tomorrow, active),
            between(next7, active),
            between(week, col(m.Appointment.status) == "cancelled"),
        ).select_from(m.Appointment)
    ).one()
    return {
        "today": int(row[0]),
        "tomorrow": int(row[1]),
        "next7": int(row[2]),
        "cancelled_week": int(row[3]),
    }


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


def doctor_counts(
    db: Session, starts_from: datetime, starts_before: datetime, limit: int = 10
) -> list[tuple[str, int]]:
    """Active bookings per doctor in a window, the busiest first (the morning email)."""
    stmt = (
        select(m.Doctor.full_name, func.count())
        .select_from(m.Appointment)
        .join(m.Doctor, col(m.Doctor.id) == col(m.Appointment.doctor_id))
        .where(col(m.Appointment.starts_at) >= starts_from)
        .where(col(m.Appointment.starts_at) < starts_before)
        .where(col(m.Appointment.status) != "cancelled")
        .group_by(col(m.Doctor.full_name))
        .order_by(func.count().desc(), col(m.Doctor.full_name))
        .limit(limit)
    )
    return [(name, int(n)) for name, n in db.execute(stmt).all()]


def count_booked_since(db: Session, since: datetime) -> int:
    stmt = (
        select(func.count())
        .select_from(m.Appointment)
        .where(col(m.Appointment.created_at) >= since)
    )
    return int(db.exec(stmt).one())
