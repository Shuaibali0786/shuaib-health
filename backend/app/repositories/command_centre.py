"""Command Centre queries over the real database (staff sessions only)."""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Any, TypedDict

from sqlalchemy import Select, or_
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
