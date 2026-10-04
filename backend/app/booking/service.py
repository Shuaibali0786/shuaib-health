"""The booking transaction (data-model section 5 and research R2).

Later features hook in at the marked points: idempotency (US3), limits and the per-phone lock
(US6), and the demo purge (US7).
"""

from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from app import models as m
from app.booking import slots
from app.booking.audit import write_audit
from app.booking.clock import Clock
from app.booking.masking import mask_mobile, mask_name
from app.booking.privacy import fingerprint
from app.booking.reference import display, new_reference
from app.booking.timeutil import utc_iso
from app.errors import BookingConflict, ClinicNotConfigured, RequestInvalid
from app.repositories import appointments as appointments_repo
from app.repositories import availability as repo
from app.repositories._common import require_id
from app.schemas import (
    AlternativeSlot,
    AppointmentCreate,
    AppointmentDepartment,
    AppointmentDoctor,
    AppointmentView,
)
from app.settings import Settings

REFERENCE_CONSTRAINT = "uq_appointment_reference"
MAX_REFERENCE_ATTEMPTS = 2


def to_alternative(slot: slots.SlotOut, tz: ZoneInfo) -> AlternativeSlot:
    return AlternativeSlot(
        starts_at=utc_iso(slot.starts_at),
        ends_at=utc_iso(slot.ends_at),
        local_date=slot.starts_at.astimezone(tz).date().isoformat(),
        local_time=slot.local_time,
    )


def view_of(
    row: m.Appointment, doctor: repo.BookableDoctor, time_zone: ZoneInfo
) -> AppointmentView:
    local = row.starts_at.astimezone(time_zone)
    return AppointmentView(
        reference=display(row.reference),
        status=row.status,
        doctor=AppointmentDoctor(
            slug=doctor.slug, full_name=doctor.full_name, specialty=doctor.specialty
        ),
        department=AppointmentDepartment(slug=doctor.department_slug, name=doctor.department_name),
        starts_at=utc_iso(row.starts_at),
        ends_at=utc_iso(row.ends_at),
        local_date=local.date().isoformat(),
        local_time=local.strftime("%H:%M"),
        time_zone=time_zone.key,
        fee_pkr=row.fee_pkr,
        patient_name_masked=mask_name(row.patient_name),
        mobile_masked=mask_mobile(row.patient_phone),
        booked_at=utc_iso(row.created_at),
        is_sample=row.is_sample,
    )


def _is_reference_collision(error: IntegrityError) -> bool:
    diag = getattr(error.orig, "diag", None)
    return getattr(diag, "constraint_name", None) == REFERENCE_CONSTRAINT


def _insert(session: Session, **fields: Any) -> m.Appointment:
    """Insert with a fresh reference; one retry when the random reference already exists."""
    for attempt in range(1, MAX_REFERENCE_ATTEMPTS + 1):
        row = m.Appointment(reference=new_reference(), **fields)
        try:
            with session.begin_nested():
                session.add(row)
        except IntegrityError as error:
            if attempt < MAX_REFERENCE_ATTEMPTS and _is_reference_collision(error):
                continue
            raise
        return row
    raise AssertionError("unreachable")  # pragma: no cover


def create_appointment(
    session: Session,
    *,
    data: AppointmentCreate,
    client_ip: str,
    request_id: str,
    clock: Clock,
    settings: Settings,
) -> AppointmentView:
    # US3 idempotency: pre-check the key here, claim it inside the transaction.
    # US6 limits/lock: trap field, IP and phone limits, then the per-phone advisory lock.
    context = repo.load_booking_context(session, data.doctor_slug)
    if context is None:
        raise ClinicNotConfigured
    doctor = context.doctor
    if doctor is None:
        raise RequestInvalid("doctorSlug", "is not available for online booking")
    clinic = context.settings

    now = clock.now()
    availability = repo.load_availability(session, doctor.id, clinic, now)
    engine_input: dict[str, Any] = {
        "now": now,
        "tz": clinic.time_zone,
        "window_days": clinic.window_days,
        "lead_minutes": clinic.lead_minutes,
        "sessions": context.sessions,
        "leave": availability.leave,
        "holidays": availability.holidays,
        "bookings": availability.bookings,
    }
    slot = slots.is_available(starts_at=data.starts_at, **engine_input)
    if slot is None:
        raise BookingConflict(
            "slot_unavailable",
            "This time is no longer available.",
            _alternatives(data.starts_at, now, clinic.time_zone, engine_input),
        )

    row = _insert(
        session,
        doctor_id=doctor.id,
        department_id=doctor.department_id,
        starts_at=slot.starts_at,
        ends_at=slot.ends_at,
        fee_pkr=doctor.fee_pkr,  # decided by the server, never read from the request
        patient_name=data.full_name,
        patient_phone=data.mobile,
        patient_email=data.email,
        reason=data.reason,
        rules_accepted_at=now,
        rules_version=appointments_repo.active_rules_version(session),
    )
    # US2: a lost race surfaces at the flush as the exclusion violation (23P01) -> slot_taken.
    # US3: link the idempotency key to ``row``. US7: purge expired demo bookings after commit.
    session.flush()
    write_audit(
        session,
        action="appointment.created",
        outcome="ok",
        fingerprint=fingerprint(settings.privacy_hash_key, client_ip),
        request_id=request_id,
        target_id=require_id(row.id),
    )
    session.commit()
    return view_of(row, doctor, clinic.time_zone)


def _alternatives(
    requested: datetime, now: datetime, tz: ZoneInfo, engine_input: dict[str, Any]
) -> list[AlternativeSlot]:
    """The next free times after the one asked for; from now when nothing follows it."""
    found = slots.next_free(after=requested, limit=5, **engine_input)
    if not found:
        found = slots.next_free(after=now, limit=5, **engine_input)
    return [to_alternative(s, tz) for s in found]
