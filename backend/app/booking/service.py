"""The booking transaction (data-model section 5 and research R2).

Order of checks (research R2, R3): idempotency precheck, trap field, IP limit, phone limit, then
inside the transaction the per-phone lock, the idempotency claim and the active-bookings cap.
"""

import logging
import time
import uuid
from datetime import datetime
from typing import Any, Literal, NoReturn
from zoneinfo import ZoneInfo

from sqlalchemy import Engine, text
from sqlalchemy.exc import IntegrityError, InterfaceError, OperationalError
from sqlmodel import Session

from app import models as m
from app.booking import idempotency, limits, slots
from app.booking.audit import AuditOutcome, write_audit
from app.booking.clock import Clock
from app.booking.masking import mask_mobile, mask_name
from app.booking.privacy import fingerprint, request_hash
from app.booking.reference import display, new_reference
from app.booking.retention import purge_demo_bookings
from app.booking.timeutil import utc_iso
from app.errors import (
    BookingConflict,
    ClinicNotConfigured,
    RateLimited,
    RequestInvalid,
    RequestRejected,
)
from app.repositories import appointments as appointments_repo
from app.repositories import availability as repo
from app.repositories._common import require_id, require_value
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
PURGE_BATCH_LIMIT = 200
TRANSIENT_ATTEMPTS = 2  # one try and one retry
TRANSIENT_BACKOFF_SECONDS = 0.25
LIMIT_REACHED_MESSAGE = (
    "This mobile number already has the maximum upcoming bookings. Please call the clinic."
)
PHONE_LOCK = text("SELECT pg_advisory_xact_lock(hashtextextended(:bucket, 0))")

logger = logging.getLogger("app.booking")


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
    created_at = require_value(row.created_at)
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
        booked_at=utc_iso(created_at),
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


def _request_hash(data: AppointmentCreate) -> str:
    return request_hash(
        {
            "doctorSlug": data.doctor_slug,
            "startsAt": utc_iso(data.starts_at),
            "fullName": data.full_name,
            "mobile": data.mobile,
            "email": data.email,
            "reason": data.reason,
        }
    )


def _replay(session: Session, appointment_id: uuid.UUID) -> AppointmentView:
    """The booking an earlier request with the same key made."""
    session.rollback()  # nothing to keep from this attempt
    stored = appointments_repo.get_by_id(session, appointment_id)
    if stored is None:
        raise RuntimeError("idempotency key points at a missing booking")
    return view_of(stored.appointment, stored.doctor, stored.time_zone)


def create_appointment(
    session: Session,
    *,
    data: AppointmentCreate,
    idempotency_key: uuid.UUID,
    client_ip: str,
    engine: Engine,
    request_id: str,
    clock: Clock,
    settings: Settings,
) -> AppointmentView:
    """Book the slot; a transient database error is retried once.

    The retry is safe only because of the idempotency key: if the first attempt had committed
    before the connection dropped, the retry finds the key and replays that booking. Anything
    else (a taken slot, a constraint violation, a rejected key) is never retried.
    """
    for attempt in range(1, TRANSIENT_ATTEMPTS + 1):
        try:
            return _create_once(
                session,
                data=data,
                idempotency_key=idempotency_key,
                client_ip=client_ip,
                engine=engine,
                request_id=request_id,
                clock=clock,
                settings=settings,
            )
        except (OperationalError, InterfaceError) as error:
            if attempt == TRANSIENT_ATTEMPTS:
                raise
            logger.warning("transient database error, retrying once: %s", type(error).__name__)
            _discard(session)
            time.sleep(TRANSIENT_BACKOFF_SECONDS)
    raise AssertionError("unreachable")  # pragma: no cover


def _discard(session: Session) -> None:
    """Drop whatever the failed attempt left in the session, even on a dead connection."""
    try:
        session.rollback()
    except Exception:  # the connection is gone; closing releases it
        session.close()


def _create_once(
    session: Session,
    *,
    data: AppointmentCreate,
    idempotency_key: uuid.UUID,
    client_ip: str,
    engine: Engine,
    request_id: str,
    clock: Clock,
    settings: Settings,
) -> AppointmentView:
    now = clock.now()
    req_hash = _request_hash(data)
    existing = idempotency.precheck(session, idempotency_key, req_hash, now)
    if existing is not None:
        return _replay(session, existing)  # a retry uses up no limit
    fingerprint_value = fingerprint(settings.privacy_hash_key, client_ip)
    phone_bucket = limits.booking_phone_bucket(settings.privacy_hash_key, data.mobile)
    _check_limits(
        session,
        data=data,
        client_ip=client_ip,
        phone_bucket=phone_bucket,
        engine=engine,
        fingerprint_value=fingerprint_value,
        request_id=request_id,
        now=now,
        settings=settings,
    )
    context = repo.load_booking_context(session, data.doctor_slug)
    if context is None:
        raise ClinicNotConfigured
    doctor = context.doctor
    if doctor is None:
        raise RequestInvalid("doctorSlug", "is not available for online booking")
    clinic = context.settings

    # One booking at a time per phone, so the active-bookings count below cannot be raced.
    session.connection().execute(PHONE_LOCK, {"bucket": phone_bucket})
    # A concurrent duplicate waits here until the first request ends, then replays its booking.
    claimed = idempotency.claim(session, idempotency_key, req_hash, now)
    if claimed is not None:
        return _replay(session, claimed)
    active = appointments_repo.count_active_for_phone(session, data.mobile, now)
    if active >= clinic.max_active_per_phone:
        _refuse(session, "limit_reached", fingerprint_value, request_id)
        raise BookingConflict("booking_limit_reached", LIMIT_REACHED_MESSAGE)
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
        session.flush()
        idempotency.link(session, idempotency_key, require_id(row.id))
        idempotency.cleanup(session, now)
        limits.cleanup_counters(session.connection(), now)
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
    view = view_of(row, doctor, clinic.time_zone)
    if settings.demo_mode:
        _purge_after_booking(engine, now, settings)
    return view


def _purge_after_booking(engine: Engine, now: datetime, settings: Settings) -> None:
    """Drop a little expired demo data in its own short transaction; never fail the booking."""
    try:
        with engine.begin() as conn:
            purge_demo_bookings(
                conn,
                now=now,
                after_days=settings.booking_purge_after_days,
                audit_after_days=settings.audit_purge_after_days,
                limit=PURGE_BATCH_LIMIT,
            )
    except Exception as error:
        logger.warning("purge_failed: %s", type(error).__name__)


def _refuse(
    session: Session,
    outcome: AuditOutcome,
    fingerprint_value: str,
    request_id: str,
) -> None:
    """Undo the attempt (its lock and idempotency claim), then record the refusal."""
    session.rollback()
    write_audit(
        session,
        action="appointment.rejected",
        outcome=outcome,
        fingerprint=fingerprint_value,
        request_id=request_id,
    )
    session.commit()


def _check_limits(
    session: Session,
    *,
    data: AppointmentCreate,
    client_ip: str,
    phone_bucket: str,
    engine: Engine,
    fingerprint_value: str,
    request_id: str,
    now: datetime,
    settings: Settings,
) -> None:
    """The trap field, then the per-IP and per-phone limits; each refusal is audited."""
    key = settings.privacy_hash_key
    ip_retry = limits.hit(
        engine,
        limits.booking_ip_bucket(key, client_ip),
        limits.BOOKING_IP_WINDOW,
        settings.booking_limit_per_ip_per_hour,
        now,
    )
    if data.trap:  # a bot filled the hidden field; it still costs the sender an IP attempt
        _refuse(session, "trap", fingerprint_value, request_id)
        raise RequestRejected
    if ip_retry is not None:
        _refuse(session, "rate_limited_ip", fingerprint_value, request_id)
        raise RateLimited(ip_retry)
    phone_retry = limits.hit(
        engine,
        phone_bucket,
        limits.BOOKING_PHONE_WINDOW,
        settings.booking_limit_per_phone_per_day,
        now,
    )
    if phone_retry is not None:
        _refuse(session, "rate_limited_phone", fingerprint_value, request_id)
        raise RateLimited(phone_retry)


def _reject(
    session: Session,
    *,
    code: Literal["slot_taken", "slot_unavailable"],
    message: str,
    alternatives: list[AlternativeSlot],
    fingerprint_value: str,
    request_id: str,
) -> NoReturn:
    """Record the refusal (no personal data) and answer 409 with the next free times.

    The idempotency key claimed for this attempt is rolled back first: a failed attempt keeps none.
    """
    session.rollback()
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
