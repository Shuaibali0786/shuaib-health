"""Booking search, detail, status changes, undo and phone reveal over the real database.

Each write is one transaction: the booking row, its history row and the audit row are committed
together or not at all. The booking is changed with ``UPDATE ... WHERE version = :expected``, so a
second user working from a stale view is refused instead of overwriting (ADR-0010). Time is always
passed in.
"""

import uuid
from datetime import datetime, timedelta
from typing import TYPE_CHECKING, Any
from zoneinfo import ZoneInfo

from sqlalchemy import func, update
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, col

from app import models as m
from app.auth import audit
from app.booking.slots import Busy, SessionRule
from app.command_centre import metrics
from app.command_centre import status as rules
from app.command_centre.common import day_bounds, format_phone, resolve_range
from app.command_centre.masking import mask_email, mask_mobile, short_name
from app.command_centre.schemas import (
    ACTIVITY_PAGE_SIZE,
    PAGE_SIZE,
    ActivityEvent,
    ActivityPage,
    BookingDetail,
    BookingPage,
    BookingSearchRequest,
    BookingSummary,
    DayBookings,
    DepartmentRef,
    DoctorRef,
    DoctorsToday,
    HistoryItem,
    Insights,
    InsightsRange,
    Lookups,
    MarkSeenRequest,
    NewBookings,
    Overview,
    OverviewCards,
    PhoneReveal,
    RecentBooking,
    StatusChangeResult,
)
from app.command_centre.status import Status
from app.errors import AdminError, AdminErrorCode, NotFound
from app.notifications.templates import DailySummaryFacts, DoctorLoad
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


def _summary_fields(
    row: repo.BookingRow, tz: ZoneInfo, now: datetime, *, is_new: bool = False
) -> dict[str, Any]:
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
        "booked_at": appt.created_at or appt.starts_at,
        "is_new": is_new,
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
        history=items,
    )


def search_window(
    body: BookingSearchRequest, tz: ZoneInfo, now: datetime
) -> tuple[datetime | None, datetime | None, datetime | None]:
    """(starts from, starts before, booked since) for a search. A typed search looks at every date;
    "Upcoming" is every booking from the start of tomorrow; "Recently booked" without dates looks at
    every date too."""
    today = now.astimezone(tz).date()
    booked_since = (
        now - timedelta(hours=body.booked_within_hours) if body.booked_within_hours else None
    )
    if (body.q or "").strip():
        return None, None, booked_since
    if body.scope == "upcoming":
        return day_bounds(today + timedelta(days=1), tz)[0], None, booked_since
    if body.booked_within_hours and body.from_ is None and body.to is None:
        return None, None, booked_since
    first, last = resolve_range(body, today)
    return day_bounds(first, tz)[0], day_bounds(last, tz)[1], booked_since


def search(
    db: Session,
    body: BookingSearchRequest,
    tz: ZoneInfo,
    now: datetime,
    staff_id: uuid.UUID | None = None,
) -> BookingPage:
    starts_from, starts_before, booked_since = search_window(body, tz, now)
    window: repo.SearchWindow = {
        "q": body.q,
        "starts_from": starts_from,
        "starts_before": starts_before,
        "doctor_id": body.doctor_id,
        "department_id": body.department_id,
        "booked_since": booked_since,
    }
    statuses: list[str] | None = list(body.statuses) if body.statuses else None
    rows, total = repo.search_bookings(
        db,
        **window,
        statuses=statuses,
        page=body.page,
        page_size=PAGE_SIZE,
        recently_booked_first=body.sort == "recently_booked",
    )
    counts = {_status(name): n for name, n in repo.status_counts(db, **window).items()}
    new = repo.new_ids(db, staff_id, [r.appointment for r in rows]) if staff_id else set()
    items = [
        BookingSummary(**_summary_fields(r, tz, now, is_new=require(r.appointment.id) in new))
        for r in rows
    ]
    days: list[DayBookings] = []
    if body.scope == "upcoming":
        days = [
            DayBookings(date=day, count=n)
            for day, n in repo.day_counts(db, tz_name=tz.key, statuses=statuses, **window)
        ]
    return BookingPage(
        items=items, total=total, page=body.page, status_counts=counts, day_counts=days
    )


def new_bookings(
    db: Session, staff_id: uuid.UUID | None, tz: ZoneInfo, now: datetime
) -> NewBookings:
    """The bell: how many bookings are new for this staff member and the newest five."""
    if staff_id is None:
        return NewBookings(count=0, items=[])
    count, rows = repo.new_bookings(db, staff_id, NEW_LIST_LIMIT)
    return NewBookings(
        count=count,
        items=[BookingSummary(**_summary_fields(r, tz, now, is_new=True)) for r in rows],
    )


def mark_seen(
    db: Session, actor: "Viewer", body: MarkSeenRequest, tz: ZoneInfo, now: datetime
) -> NewBookings:
    """Opening a booking, or "Mark all seen", clears the New mark for this staff member only."""
    staff_id = _staff_id(actor)
    if body.all:
        repo.mark_all_seen(db, staff_id, now)
    else:
        repo.mark_seen(db, staff_id, repo.appointment_ids_of(db, body.references or []))
    db.commit()
    return new_bookings(db, staff_id, tz, now)


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


RECENT_LIMIT = 5
NEW_LIST_LIMIT = 5


def _rules_of(weekly: repo.WeeklyPlan) -> list[SessionRule]:
    return [
        SessionRule(s.weekday, s.start_time, s.end_time, s.slot_minutes) for s in weekly.sessions
    ]


def overview_cards(
    db: Session, staff_id: uuid.UUID | None, tz: ZoneInfo, now: datetime
) -> OverviewCards:
    today = now.astimezone(tz).date()
    monday = today - timedelta(days=today.weekday())
    counts = repo.card_counts(
        db,
        today=day_bounds(today, tz),
        tomorrow=day_bounds(today + timedelta(days=1), tz),
        next7=(
            day_bounds(today + timedelta(days=1), tz)[0],
            day_bounds(today + timedelta(days=7), tz)[1],
        ),
        week=(day_bounds(monday, tz)[0], day_bounds(monday + timedelta(days=6), tz)[1]),
    )
    return OverviewCards(
        today=counts["today"],
        tomorrow=counts["tomorrow"],
        next7_days=counts["next7"],
        new_since_last_visit=repo.new_count(db, staff_id) if staff_id else 0,
        cancelled_this_week=counts["cancelled_week"],
    )


def overview(
    db: Session, tz: ZoneInfo, now: datetime, staff_id: uuid.UUID | None = None
) -> Overview:
    """Today at a glance from the database: the bookings of the clinic-local day, last week's counts
    for the trends, the 005 schedules, leave and holidays for utilisation, and the newest bookings
    for the notifications."""
    today = now.astimezone(tz).date()
    earlier = today - timedelta(days=metrics.TREND_DAYS)
    lo, hi = day_bounds(today, tz)
    earlier_lo, earlier_hi = day_bounds(earlier, tz)

    rows = repo.day_bookings(db, lo, hi)
    last_counts = repo.status_counts(
        db,
        q=None,
        starts_from=earlier_lo,
        starts_before=earlier_hi,
        doctor_id=None,
        department_id=None,
    )
    leave, holidays = repo.leave_and_holidays(db, earlier_lo, hi, [today, earlier])
    plans = [
        metrics.DoctorPlan(
            doctor=DoctorRef(
                id=require(w.doctor.id),
                name=w.doctor.full_name,
                department_name=w.department_name,
                is_active=w.doctor.is_active,
            ),
            sessions=_rules_of(w),
            leave=[Busy(a, b) for a, b in leave.get(require(w.doctor.id), [])],
        )
        for w in repo.weekly_plans(db)
    ]
    recent = [
        RecentBooking(**_summary_fields(r, tz, now)) for r in repo.recent_bookings(db, RECENT_LIMIT)
    ]
    return metrics.build_overview(
        day=today,
        now=now,
        tz=tz,
        plans=plans,
        today=[BookingSummary(**_summary_fields(r, tz, now)) for r in rows],
        last_week_counts=last_counts,
        holiday_today=holidays.get(today),
        holiday_last_week=earlier in holidays,
        recent=recent,
        cards=overview_cards(db, staff_id, tz, now),
        is_sample=False,
    )


def _doctor_plans(
    db: Session, leave_from: datetime, leave_before: datetime
) -> list[metrics.DoctorPlan]:
    leave = repo.leave_between(db, leave_from, leave_before)
    return [
        metrics.DoctorPlan(
            doctor=DoctorRef(
                id=require(w.doctor.id),
                name=w.doctor.full_name,
                department_name=w.department_name,
                is_active=w.doctor.is_active,
            ),
            sessions=_rules_of(w),
            leave=[Busy(a, b) for a, b in leave.get(require(w.doctor.id), [])],
        )
        for w in repo.weekly_plans(db)
    ]


def insights(db: Session, range_days: InsightsRange, tz: ZoneInfo, now: datetime) -> Insights:
    """Charts of the ``range_days`` clinic-local days ending today, from the bookings' start, status
    and department only (no personal data is read)."""
    today = now.astimezone(tz).date()
    first = today - timedelta(days=range_days - 1)
    rows = repo.insight_rows(db, day_bounds(first, tz)[0], day_bounds(today, tz)[1])
    return metrics.build_insights(
        range_days=range_days,
        today=today,
        tz=tz,
        rows=[metrics.InsightRow(*row) for row in rows],
        is_sample=False,
    )


def doctors_today(db: Session, tz: ZoneInfo, now: datetime) -> DoctorsToday:
    today = now.astimezone(tz).date()
    lo, hi = day_bounds(today, tz)
    return metrics.build_doctors_today(
        day=today,
        now=now,
        tz=tz,
        plans=_doctor_plans(db, lo, hi),
        booked_starts=repo.booked_starts(db, lo, hi),
        holiday=repo.holiday_names(db, [today]).get(today),
        is_sample=False,
    )


def _occurred(event: m.AuditLog) -> datetime:
    if event.occurred_at is None:
        raise RuntimeError("audit row has no time")
    return event.occurred_at


def _optional_status(value: str | None) -> Status | None:
    return None if value is None else _status(value)


def activity(
    db: Session, *, action: str | None, staff_id: uuid.UUID | None, page: int
) -> ActivityPage:
    """The audit feed, newest first. A row holds no free text, so nothing personal can appear; the
    network tag is the first six characters of the keyed address fingerprint."""
    rows, total = repo.activity_page(
        db, action=action, staff_id=staff_id, page=page, page_size=ACTIVITY_PAGE_SIZE
    )
    items = [
        ActivityEvent(
            id=require(row.event.id),
            at=_occurred(row.event),
            action=row.event.action,
            outcome=row.event.outcome,
            actor_name=row.actor_name,
            actor_role=row.event.actor_role,
            booking_reference=row.event.target_reference,
            from_status=_optional_status(row.event.from_status),
            to_status=_optional_status(row.event.to_status),
            network_tag=row.event.actor_fingerprint[:6],
        )
        for row in rows
    ]
    return ActivityPage(items=items, total=total, page=page)


def daily_summary(db: Session, tz: ZoneInfo, now: datetime, clinic_name: str) -> DailySummaryFacts:
    """What the morning email says: today, tomorrow, the last day's new bookings, doctors' load."""
    today = now.astimezone(tz).date()
    tomorrow = today + timedelta(days=1)
    counts = repo.card_counts(
        db,
        today=day_bounds(today, tz),
        tomorrow=day_bounds(tomorrow, tz),
        next7=day_bounds(tomorrow, tz),
        week=day_bounds(today, tz),
    )
    lo, hi = day_bounds(today, tz)
    return DailySummaryFacts(
        local_date=today.isoformat(),
        today=counts["today"],
        tomorrow=counts["tomorrow"],
        new_since_yesterday=repo.count_booked_since(db, now - timedelta(hours=24)),
        per_doctor_today=tuple(DoctorLoad(name, n) for name, n in repo.doctor_counts(db, lo, hi)),
        clinic_name=clinic_name,
    )
