"""Booking search, detail, status changes, undo and phone reveal over the real database.

Each write is one transaction: the booking row, its history row and the audit row are committed
together or not at all. The booking is changed with ``UPDATE ... WHERE version = :expected``, so a
second user working from a stale view is refused instead of overwriting (ADR-0010). Time is always
passed in.
"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any
from zoneinfo import ZoneInfo

from sqlalchemy import func, update
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, col

from app import models as m
from app.auth import audit
from app.command_centre import status as rules
from app.command_centre.common import day_bounds, format_phone, resolve_range
from app.command_centre.masking import mask_email, mask_mobile, short_name
from app.command_centre.schemas import (
    PAGE_SIZE,
    BookingDetail,
    BookingPage,
    BookingSearchRequest,
    BookingSummary,
    DepartmentRef,
    DoctorRef,
    HistoryItem,
    Lookups,
    PhoneReveal,
    StatusChangeResult,
)
from app.command_centre.status import Status
from app.errors import AdminError, AdminErrorCode, NotFound
from app.repositories import command_centre as repo

if TYPE_CHECKING:
    from app.auth.deps import Viewer

EXCLUSION_VIOLATION = "23P01"
ONLINE_BOOKING = "Online booking"


def _status(value: str) -> Status:
    for known in rules.STATUSES:
        if known == value:
            return known
    raise RuntimeError("unknown booking status")


def require(value: uuid.UUID | None) -> uuid.UUID:
    if value is None:
        raise RuntimeError("row has no id")
    return value


def _summary_fields(row: repo.BookingRow, tz: ZoneInfo, now: datetime) -> dict[str, Any]:
    appt = row.appointment
    local = appt.starts_at.astimezone(tz)
    status = _status(appt.status)
    return {
        "reference": appt.reference,
        "starts_at": appt.starts_at,
        "ends_at": appt.ends_at,
        "local_date": local.date(),
        "local_time": local.strftime("%H:%M"),
        "status": status,
        "version": appt.version,
        "patient_name_masked": short_name(appt.patient_name),
        "phone_masked": mask_mobile(appt.patient_phone),
        "doctor": DoctorRef(
            id=require(row.doctor.id),
            name=row.doctor.full_name,
            department_name=row.department.name,
            is_active=row.doctor.is_active,
        ),
        "allowed_next": rules.allowed_next(status, appt.starts_at, now),
        "is_sample": appt.is_sample,
    }


def _detail_of(db: Session, row: repo.BookingRow, tz: ZoneInfo, now: datetime) -> BookingDetail:
    appt = row.appointment
    created = appt.created_at or appt.starts_at
    items = [
        HistoryItem(
            at=created,
            from_status=None,
            to_status="confirmed",
            actor=ONLINE_BOOKING,
            is_undo=False,
        )
    ]
    items += [
        HistoryItem(
            at=h.change.occurred_at or created,
            from_status=_status(h.change.from_status),
            to_status=_status(h.change.to_status),
            actor=h.actor_name,
            is_undo=h.change.is_undo,
        )
        for h in repo.history(db, require(appt.id))
    ]
    return BookingDetail(
        **_summary_fields(row, tz, now),
        patient_name=appt.patient_name,
        email_masked=mask_email(appt.patient_email) if appt.patient_email else None,
        reason=appt.reason,
        fee_pkr=appt.fee_pkr,
        booked_at=created,
        history=items,
    )


def search(db: Session, body: BookingSearchRequest, tz: ZoneInfo, now: datetime) -> BookingPage:
    first, last = resolve_range(body, now.astimezone(tz).date())
    window: repo.SearchWindow = {
        "q": body.q,
        "starts_from": day_bounds(first, tz)[0],
        "starts_before": day_bounds(last, tz)[1],
        "doctor_id": body.doctor_id,
        "department_id": body.department_id,
    }
    rows, total = repo.search_bookings(
        db,
        **window,
        statuses=list(body.statuses) if body.statuses else None,
        page=body.page,
        page_size=PAGE_SIZE,
    )
    counts = {_status(name): n for name, n in repo.status_counts(db, **window).items()}
    items = [BookingSummary(**_summary_fields(r, tz, now)) for r in rows]
    return BookingPage(items=items, total=total, page=body.page, status_counts=counts)


def detail(db: Session, reference: str, tz: ZoneInfo, now: datetime) -> BookingDetail:
    row = repo.get_booking(db, reference)
    if row is None:
        raise NotFound("Booking")
    return _detail_of(db, row, tz, now)


def lookups(db: Session) -> Lookups:
    doctors, departments = repo.lookups(db)
    return Lookups(
        doctors=[
            DoctorRef(
                id=require(d.id), name=d.full_name, department_name=dept, is_active=d.is_active
            )
            for d, dept in doctors
        ],
        departments=[
            DepartmentRef(id=require(d.id), name=d.name, is_active=d.is_active) for d in departments
        ],
    )


def _conflict(
    db: Session, code: AdminErrorCode, reference: str, tz: ZoneInfo, now: datetime
) -> AdminError:
    """A 409 that carries the booking as it is now, so the screen can refresh without a request."""
    db.rollback()
    row = repo.get_booking(db, reference)
    extra = None
    if row is not None:
        latest = _detail_of(db, row, tz, now)
        extra = {"latest": latest.model_dump(mode="json", by_alias=True, exclude_none=True)}
    return AdminError(code, extra=extra)


def _is_slot_overlap(error: IntegrityError) -> bool:
    return getattr(error.orig, "sqlstate", None) == EXCLUSION_VIOLATION


def _staff_id(actor: "Viewer") -> uuid.UUID:
    if actor.staff_id is None:
        raise AdminError("demo_read_only")
    return actor.staff_id


def _move(db: Session, appointment_id: uuid.UUID, to: Status, expected_version: int) -> int | None:
    """Set the status if the version is still ``expected_version``; the new version, else None."""
    result = db.execute(
        update(m.Appointment)
        .where(col(m.Appointment.id) == appointment_id)
        .where(col(m.Appointment.version) == expected_version)
        .values(status=to, version=expected_version + 1, updated_at=func.now())
        .returning(col(m.Appointment.version))
    ).first()
    return int(result[0]) if result else None


def change_status(
    db: Session,
    actor: "Viewer",
    reference: str,
    *,
    to: Status,
    expected_version: int,
    tz: ZoneInfo,
    now: datetime,
) -> StatusChangeResult:
    staff_id = _staff_id(actor)
    row = repo.get_booking(db, reference, lock=True)
    if row is None:
        raise NotFound("Booking")
    appt = row.appointment
    if appt.version != expected_version:
        raise _conflict(db, "booking_changed", reference, tz, now)
    current = _status(appt.status)
    if not rules.is_allowed(current, to, appt.starts_at, now):
        db.rollback()
        raise AdminError("transition_not_allowed")
    appointment_id = require(appt.id)
    try:
        version_after = _move(db, appointment_id, to, expected_version)
        if version_after is None:
            raise _conflict(db, "booking_changed", reference, tz, now)
        change = m.AppointmentStatusChange(
            appointment_id=appointment_id,
            from_status=current,
            to_status=to,
            actor_staff_id=staff_id,
            occurred_at=now,
            version_after=version_after,
            undo_expires_at=now + rules.UNDO_WINDOW,
        )
        db.add(change)
        db.flush()
        audit.record(
            db,
            action="booking.status_changed",
            fingerprint=actor.fingerprint,
            staff_id=staff_id,
            role=actor.role,
            target_type="appointment",
            target_id=appointment_id,
            target_reference=appt.reference,
            from_status=current,
            to_status=to,
        )
        db.commit()
    except IntegrityError as error:
        if not _is_slot_overlap(error):
            raise
        raise _conflict(db, "slot_taken", reference, tz, now) from error
    fresh = repo.get_booking(db, reference)
    if fresh is None:
        raise NotFound("Booking")
    return StatusChangeResult(
        booking=_detail_of(db, fresh, tz, now),
        change_id=require(change.id),
        undo_expires_at=now + rules.UNDO_WINDOW,
    )


def undo(
    db: Session,
    actor: "Viewer",
    reference: str,
    *,
    change_id: uuid.UUID,
    tz: ZoneInfo,
    now: datetime,
) -> BookingDetail:
    staff_id = _staff_id(actor)
    row = repo.get_booking(db, reference, lock=True)
    if row is None:
        raise NotFound("Booking")
    appt = row.appointment
    appointment_id = require(appt.id)
    original = repo.get_change(db, change_id)
    latest = repo.latest_change(db, appointment_id)
    if (
        original is None
        or latest is None
        or original.appointment_id != appointment_id
        or latest.id != original.id
        or original.is_undo
        or original.actor_staff_id != staff_id
        or original.undo_expires_at is None
        or now > original.undo_expires_at + rules.UNDO_GRACE
        or appt.version != original.version_after
    ):
        raise _conflict(db, "undo_unavailable", reference, tz, now)
    try:
        version_after = _move(db, appointment_id, _status(original.from_status), appt.version)
        if version_after is None:
            raise _conflict(db, "undo_unavailable", reference, tz, now)
        db.add(
            m.AppointmentStatusChange(
                appointment_id=appointment_id,
                from_status=original.to_status,
                to_status=original.from_status,
                actor_staff_id=staff_id,
                occurred_at=now,
                version_after=version_after,
                is_undo=True,
                undoes_change_id=original.id,
            )
        )
        db.flush()
        audit.record(
            db,
            action="booking.status_undone",
            fingerprint=actor.fingerprint,
            staff_id=staff_id,
            role=actor.role,
            target_type="appointment",
            target_id=appointment_id,
            target_reference=appt.reference,
            from_status=original.to_status,
            to_status=original.from_status,
        )
        db.commit()
    except IntegrityError as error:
        if not _is_slot_overlap(error):
            raise
        raise _conflict(db, "slot_taken", reference, tz, now) from error
    fresh = repo.get_booking(db, reference)
    if fresh is None:
        raise NotFound("Booking")
    return _detail_of(db, fresh, tz, now)


def reveal_phone(db: Session, actor: "Viewer", reference: str) -> PhoneReveal:
    row = repo.get_booking(db, reference)
    if row is None:
        raise NotFound("Booking")
    appt = row.appointment
    audit.record(
        db,
        action="booking.phone_revealed",
        fingerprint=actor.fingerprint,
        staff_id=actor.staff_id,
        role=actor.role,
        target_type="appointment",
        target_id=require(appt.id),
        target_reference=appt.reference,
    )
    db.commit()
    return format_phone(appt.patient_phone)
