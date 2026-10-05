"""The booking transaction (data-model section 5 and research R2).

Later features hook in at the marked points: idempotency (US3), limits and the per-phone lock
(US6), and the demo purge (US7).
"""

from datetime import datetime
from typing import Any, Literal, NoReturn
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
OVERLAP_CONSTRAINT = "ex_appointment_no_overlap"
EXCLUSION_VIOLATION = "23P01"
SLOT_TAKEN_MESSAGE = "Sorry, this slot was just taken."
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


def _is_overlap(error: IntegrityError) -> bool:
    diag = getattr(error.orig, "diag", None)
    return (
        getattr(error.orig, "sqlstate", None) == EXCLUSION_VIOLATION
        and getattr(diag, "constraint_name", None) == OVERLAP_CONSTRAINT
    )


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
    fingerprint_value = fingerprint(settings.privacy_hash_key, client_ip)
    slot = slots.is_available(starts_at=data.starts_at, **engine_input)
    if slot is None:
        # Free apart from someone else's booking: that is a lost race, not an unavailable time.
        was_taken = (
            slots.is_available(starts_at=data.starts_at, **{**engine_input, "bookings": []})
            is not None
        )
        _reject(
            session,
            code="slot_taken" if was_taken else "slot_unavailable",
            message=SLOT_TAKEN_MESSAGE if was_taken else "This time is no longer available.",
            alternatives=_alternatives(data.starts_at, now, clinic.time_zone, engine_input),
            fingerprint_value=fingerprint_value,
            request_id=request_id,
        )

    try:
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
        # US3: link the idempotency key to ``row``. US7: purge expired demo bookings after commit.
        session.flush()
    except IntegrityError as error:
        if not _is_overlap(error):
            raise
        # Lost the race: the winner committed first. Start over in a fresh read-only transaction.
        session.rollback()
        fresh = repo.load_availability(session, doctor.id, clinic, now)
        _reject(
            session,
            code="slot_taken",
            message=SLOT_TAKEN_MESSAGE,
            alternatives=_alternatives(
                data.starts_at, now, clinic.time_zone, {**engine_input, "bookings": fresh.bookings}
            ),
            fingerprint_value=fingerprint_value,
            request_id=request_id,
        )
    write_audit(
        session,
        action="appointment.created",
        outcome="ok",
        fingerprint=fingerprint_value,
        request_id=request_id,
        target_id=require_id(row.id),
    )
    session.commit()
    return view_of(row, doctor, clinic.time_zone)


def _reject(
    session: Session,
    *,
    code: Literal["slot_taken", "slot_unavailable"],
    message: str,
    alternatives: list[AlternativeSlot],
    fingerprint_value: str,
    request_id: str,
) -> NoReturn:
    """Record the refusal (no personal data) and answer 409 with the next free times."""
    write_audit(
        session,
        action="appointment.rejected",
        outcome=code,
        fingerprint=fingerprint_value,
        request_id=request_id,
    )
    session.commit()
    raise BookingConflict(code, message, alternatives)


def _alternatives(
    requested: datetime, now: datetime, tz: ZoneInfo, engine_input: dict[str, Any]
) -> list[AlternativeSlot]:
    """The next free times after the one asked for; from now when nothing follows it."""
    found = slots.next_free(after=requested, limit=5, **engine_input)
    if not found:
        found = slots.next_free(after=now, limit=5, **engine_input)
    return [to_alternative(s, tz) for s in found]
