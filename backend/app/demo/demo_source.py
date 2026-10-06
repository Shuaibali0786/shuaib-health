"""Synthetic data for demo visitors. This module must never import the database, the models or
any repository (SC-005; guarded by a test); the dataset is built in memory from a seeded PRNG."""

import uuid
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from app.booking.slots import WEEKDAYS, Busy, SessionRule
from app.command_centre import metrics
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
    Overview,
    PhoneReveal,
)
from app.demo import generator
from app.demo.generator import DemoBooking, DemoDataset, DemoDoctor, DemoStaff
from app.errors import NotFound

ONLINE_BOOKING = "Online booking"


def doctor_uuid(slug: str) -> uuid.UUID:
    return uuid.uuid5(uuid.NAMESPACE_URL, f"{generator.SEED_PREFIX}doctor:{slug}")


def department_uuid(name: str) -> uuid.UUID:
    return uuid.uuid5(uuid.NAMESPACE_URL, f"{generator.SEED_PREFIX}department:{name}")


class DemoSource:
    def __init__(self, demo_date: date) -> None:
        self.demo_date = demo_date

    @property
    def dataset(self) -> DemoDataset:
        return generator.get_dataset(self.demo_date)

    def staff(self) -> tuple[DemoStaff, ...]:
        return self.dataset.staff

    # ----- bookings (US4) ---------------------------------------------------------------

    def _doctor_ref(self, booking: DemoBooking) -> DoctorRef:
        return DoctorRef(
            id=doctor_uuid(booking.doctor_slug),
            name=booking.doctor_name,
            department_name=booking.department,
            is_active=True,
        )

    def _summary_fields(
        self, booking: DemoBooking, tz: ZoneInfo, now: datetime
    ) -> dict[str, object]:
        status = booking.status_at(now)
        local = booking.starts_at.astimezone(tz)
        return {
            "reference": booking.reference,
            "starts_at": booking.starts_at,
            "ends_at": booking.ends_at,
            "local_date": local.date(),
            "local_time": local.strftime("%H:%M"),
            "status": status,
            "version": 1,
            "patient_name_masked": short_name(f"{booking.patient_first} {booking.patient_last}"),
            "phone_masked": mask_mobile(booking.phone),
            "doctor": self._doctor_ref(booking),
            "allowed_next": rules.allowed_next(status, booking.starts_at, now),
            "is_sample": True,
        }

    def _history(self, booking: DemoBooking, now: datetime) -> list[HistoryItem]:
        items = [
            HistoryItem(
                at=booking.created_at,
                from_status=None,
                to_status="confirmed",
                actor=ONLINE_BOOKING,
                is_undo=False,
            )
        ]
        names = [member.display_name for member in self.staff()]
        who = names[sum(map(ord, booking.reference)) % len(names)]

        def step(at: datetime, before: rules.Status, after: rules.Status) -> None:
            items.append(
                HistoryItem(at=at, from_status=before, to_status=after, actor=who, is_undo=False)
            )

        status = booking.status_at(now)
        if status == "cancelled":
            cancelled_at = min(
                booking.created_at + timedelta(days=1), booking.starts_at - timedelta(hours=1)
            )
            step(max(cancelled_at, booking.created_at), "confirmed", "cancelled")
        elif status == "no_show":
            step(booking.starts_at + timedelta(minutes=15), "confirmed", "no_show")
        elif status in ("arrived", "completed"):
            step(booking.starts_at - timedelta(minutes=5), "confirmed", "arrived")
            if status == "completed":
                step(booking.ends_at, "arrived", "completed")
        return items

    def _detail_of(self, booking: DemoBooking, tz: ZoneInfo, now: datetime) -> BookingDetail:
        return BookingDetail(
            **self._summary_fields(booking, tz, now),
            patient_name=f"{booking.patient_first} {booking.patient_last}",
            email_masked=mask_email(booking.email),
            reason=booking.reason,
            fee_pkr=booking.fee_pkr,
            booked_at=booking.created_at,
            history=self._history(booking, now),
            patient_age=booking.patient_age,
            booked_by=booking.booked_by,
        )

    def _find(self, reference: str) -> DemoBooking:
        wanted = reference.upper()
        for booking in self.dataset.bookings:
            if booking.reference == wanted:
                return booking
        raise NotFound("Booking")

    def search(self, body: BookingSearchRequest, tz: ZoneInfo, now: datetime) -> BookingPage:
        first, last = resolve_range(body, self.demo_date)
        lo, hi = day_bounds(first, tz)[0], day_bounds(last, tz)[1]
        term = (body.q or "").strip().lower()
        wanted = set(body.statuses or ())
        in_window = [
            b
            for b in self.dataset.bookings
            if lo <= b.starts_at < hi
            and (
                not term
                or term in b.reference.lower()
                or term in f"{b.patient_first} {b.patient_last}".lower()
            )
            and (body.doctor_id is None or doctor_uuid(b.doctor_slug) == body.doctor_id)
            and (body.department_id is None or department_uuid(b.department) == body.department_id)
        ]
        counts: dict[rules.Status, int] = {}
        for b in in_window:
            status = b.status_at(now)
            counts[status] = counts.get(status, 0) + 1
        hits = [b for b in in_window if not wanted or b.status_at(now) in wanted]
        hits.sort(key=lambda b: (b.starts_at, b.doctor_name, b.reference))
        start = (body.page - 1) * PAGE_SIZE
        return BookingPage(
            items=[
                BookingSummary(**self._summary_fields(b, tz, now))
                for b in hits[start : start + PAGE_SIZE]
            ],
            total=len(hits),
            page=body.page,
            status_counts=counts,
        )

    def detail(self, reference: str, tz: ZoneInfo, now: datetime) -> BookingDetail:
        return self._detail_of(self._find(reference), tz, now)

    def lookups(self) -> Lookups:
        doctors = sorted(self.dataset.doctors, key=lambda d: d.name)
        return Lookups(
            doctors=[
                DoctorRef(
                    id=doctor_uuid(d.slug),
                    name=d.name,
                    department_name=d.department,
                    is_active=True,
                )
                for d in doctors
            ],
            departments=[
                DepartmentRef(id=department_uuid(name), name=name, is_active=True)
                for name in sorted({d.department for d in doctors})
            ],
        )

    def reveal_phone(self, reference: str) -> PhoneReveal:
        return format_phone(self._find(reference).phone)

    # ----- overview (US3) ---------------------------------------------------------------

    def _plan(self, doctor: DemoDoctor, days: tuple[date, ...], tz: ZoneInfo) -> metrics.DoctorPlan:
        sessions = [
            SessionRule(
                WEEKDAYS[weekday],
                time(begin // 60, begin % 60),
                time(end // 60, end % 60),
                generator.SLOT_MINUTES,
            )
            for weekday, spans in doctor.sessions.items()
            for begin, end in spans
        ]
        leave = [
            Busy(*day_bounds(day, tz)) for day in days if (doctor.slug, day) in self.dataset.leave
        ]
        return metrics.DoctorPlan(
            doctor=DoctorRef(
                id=doctor_uuid(doctor.slug),
                name=doctor.name,
                department_name=doctor.department,
                is_active=True,
            ),
            sessions=sessions,
            leave=leave,
        )

    def overview(self, tz: ZoneInfo, now: datetime) -> Overview:
        today = self.demo_date
        earlier = today - timedelta(days=metrics.TREND_DAYS)
        dataset = self.dataset
        todays = [b for b in dataset.bookings if b.starts_at.astimezone(tz).date() == today]
        # A like-for-like comparison: last week's day as it stood at this time of day, so a
        # half-finished Monday is not set against a finished one (the sample data can say so).
        week_ago = now - timedelta(days=metrics.TREND_DAYS)
        last_counts = metrics.day_counts(
            ((b.starts_at, b.status_at(week_ago)) for b in dataset.bookings), earlier, tz
        )
        return metrics.build_overview(
            day=today,
            now=now,
            tz=tz,
            plans=[self._plan(d, (today, earlier), tz) for d in dataset.doctors],
            today=[BookingSummary(**self._summary_fields(b, tz, now)) for b in todays],
            last_week_counts=last_counts,
            holiday_today=dataset.holidays.get(today),
            holiday_last_week=earlier in dataset.holidays,
            recent=[],
            is_sample=True,
        )
