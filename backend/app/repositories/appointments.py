"""Appointment queries."""

import hashlib
import uuid
from dataclasses import dataclass
from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import ColumnElement, func, true
from sqlmodel import Session, col, select

from app import models as m
from app.repositories.availability import BookableDoctor, bookable_from


@dataclass(frozen=True)
class StoredAppointment:
    appointment: m.Appointment
    doctor: BookableDoctor
    time_zone: ZoneInfo


def _stored(session: Session, condition: ColumnElement[bool]) -> StoredAppointment | None:
    row = session.exec(
        select(m.Appointment, m.Doctor, m.Department, m.ClinicSettings.time_zone)
        .join(m.Doctor, col(m.Doctor.id) == col(m.Appointment.doctor_id))
        .join(m.Department, col(m.Department.id) == col(m.Appointment.department_id))
        .join(m.ClinicSettings, true())
        .where(condition)
    ).first()
    if row is None:
        return None
    appointment, doctor, department, time_zone = row
    return StoredAppointment(appointment, bookable_from(doctor, department), ZoneInfo(time_zone))


def get_by_reference(session: Session, reference: str) -> StoredAppointment | None:
    """The appointment with its doctor and department, and the clinic time zone for display."""
    return _stored(session, col(m.Appointment.reference) == reference)


def get_by_id(session: Session, appointment_id: uuid.UUID) -> StoredAppointment | None:
    return _stored(session, col(m.Appointment.id) == appointment_id)


def active_rules_version(session: Session) -> str:
    """First 16 hex characters of the SHA-256 of the active rules' text, in display order."""
    texts = session.exec(
        select(col(m.ClinicRule.text))
        .where(col(m.ClinicRule.is_active))
        .order_by(col(m.ClinicRule.sort_order))
    ).all()
    return hashlib.sha256("\n".join(texts).encode()).hexdigest()[:16]


def count_active_for_phone(session: Session, phone: str, now: datetime) -> int:
    """Confirmed bookings for this mobile number that have not ended yet."""
    return int(
        session.exec(
            select(func.count())
            .select_from(m.Appointment)
            .where(
                col(m.Appointment.patient_phone) == phone,
                col(m.Appointment.status) == "confirmed",
                col(m.Appointment.ends_at) > now,
            )
        ).one()
    )
