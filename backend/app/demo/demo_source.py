"""Synthetic data for demo visitors. This module must never import the database, the models or
any repository (SC-005; guarded by a test); the dataset is built in memory from a seeded PRNG."""

import uuid
from dataclasses import replace
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from app.booking.slots import WEEKDAYS, Busy, SessionRule
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
    NewBookings,
    Overview,
    OverviewCards,
    PhoneReveal,
)
from app.demo import generator
from app.demo.generator import DemoBooking, DemoDataset, DemoDoctor, DemoStaff
from app.errors import NotFound

ONLINE_BOOKING = "Online booking"
DEMO_NEW_LIMIT = 12  # how many sample bookings count as new in the demo
NEW_LIST_LIMIT = 5


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

    def staff(self, now: datetime | None = None) -> tuple[DemoStaff, ...]:
        """The sample staff; with ``now``, each person's last sign-in is their latest "Signed in"
        event in the feed that has happened by then."""
        if now is None:
            return self.dataset.staff
        fallback = generator.never_signed_in(self.demo_date)
        return tuple(
            replace(
                m, last_sign_in_at=generator.last_sign_in(self.dataset.activity, m, fallback, now)
            )
            for m in self.dataset.staff
        )

    # ----- bookings (US4) ---------------------------------------------------------------

    def _doctor_ref(self, booking: DemoBooking) -> DoctorRef:
        return DoctorRef(
            id=doctor_uuid(booking.doctor_slug),
            name=booking.doctor_name,
            department_name=booking.department,
            is_active=True,
        )

    def _new_references(self, now: datetime) -> frozenset[str]:
        """The sample bookings shown as new: the latest few made in the last 24 hours that are still
        to come. The demo remembers which ones the visitor opened in their own browser."""
        recent = [
            b
            for b in self.dataset.bookings
            if now - timedelta(hours=24) <= b.created_at <= now and b.starts_at > now
        ]
        recent.sort(key=lambda b: (b.created_at, b.reference), reverse=True)
        return frozenset(b.reference for b in recent[:DEMO_NEW_LIMIT])

    def _summary_fields(
        self,
        booking: DemoBooking,
        tz: ZoneInfo,
        now: datetime,
        new: frozenset[str] = frozenset(),
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
            "booked_at": booking.created_at,
            "is_new": booking.reference in new,
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

        # Who did it comes from the feed where it holds the event (the last week); older visits
        # are credited to someone stable. The times are the booking's own, as in the feed.
        actors = {
            (e.target_reference, e.to_status): e.staff_name
            for e in self.dataset.activity
            if e.action == "booking.status_changed" and e.target_reference == booking.reference
        }

        def step(at: datetime, before: rules.Status, after: rules.Status) -> None:
            items.append(
                HistoryItem(
                    at=at,
                    from_status=before,
                    to_status=after,
                    actor=actors.get((booking.reference, after), who),
                    is_undo=False,
                )
            )

        status = booking.status_at(now)
        if status == "cancelled":
            cancelled_at = min(
                booking.created_at + timedelta(days=1), booking.starts_at - timedelta(hours=1)
            )
            step(max(cancelled_at, booking.created_at), "confirmed", "cancelled")
        elif status == "no_show":
            step(booking.closed_at, "confirmed", "no_show")
        elif status in ("arrived", "completed"):
            step(booking.arrived_at, "confirmed", "arrived")
            if status == "completed":
                step(booking.closed_at, "arrived", "completed")
        return items

    def _detail_of(self, booking: DemoBooking, tz: ZoneInfo, now: datetime) -> BookingDetail:
        return BookingDetail(
            **self._summary_fields(booking, tz, now),
            patient_name=f"{booking.patient_first} {booking.patient_last}",
            email_masked=mask_email(booking.email),
            reason=booking.reason,
            fee_pkr=booking.fee_pkr,
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
        # The same window rules as the real search: a typed search looks at every date, "Upcoming"
        # starts tomorrow, and "Recently booked" without dates looks at every date too.
        term = (body.q or "").strip().lower()
        lo: datetime | None
        hi: datetime | None
        if term or (body.booked_within_hours and body.from_ is None and body.to is None):
            lo = hi = None
        elif body.scope == "upcoming":
            lo, hi = day_bounds(self.demo_date + timedelta(days=1), tz)[0], None
        else:
            first, last = resolve_range(body, self.demo_date)
            lo, hi = day_bounds(first, tz)[0], day_bounds(last, tz)[1]
        booked_since = (
            now - timedelta(hours=body.booked_within_hours) if body.booked_within_hours else None
        )
        wanted = set(body.statuses or ())
        in_window = [
            b
            for b in self.dataset.bookings
            if (lo is None or lo <= b.starts_at)
            and (hi is None or b.starts_at < hi)
            and (booked_since is None or booked_since <= b.created_at <= now)
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
        if body.sort == "recently_booked":
            hits.sort(key=lambda b: (-b.created_at.timestamp(), b.reference))
        else:
            hits.sort(key=lambda b: (b.starts_at, b.doctor_name, b.reference))
        days: list[DayBookings] = []
        if body.scope == "upcoming":
            per_day: dict[date, int] = {}
            for b in hits:
                day = b.starts_at.astimezone(tz).date()
                per_day[day] = per_day.get(day, 0) + 1
            days = [DayBookings(date=d, count=n) for d, n in sorted(per_day.items())]
        new = self._new_references(now)
        start = (body.page - 1) * PAGE_SIZE
        return BookingPage(
            items=[
                BookingSummary(**self._summary_fields(b, tz, now, new))
                for b in hits[start : start + PAGE_SIZE]
            ],
            total=len(hits),
            page=body.page,
            status_counts=counts,
            day_counts=days,
        )

    def new_bookings(self, tz: ZoneInfo, now: datetime) -> NewBookings:
        new = self._new_references(now)
        found = sorted(
            (b for b in self.dataset.bookings if b.reference in new),
            key=lambda b: (b.created_at, b.reference),
            reverse=True,
        )
        return NewBookings(
            count=len(found),
            items=[
                BookingSummary(**self._summary_fields(b, tz, now, new))
                for b in found[:NEW_LIST_LIMIT]
            ],
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
            cards=self._cards(tz, now),
            is_sample=True,
        )

    def _cards(self, tz: ZoneInfo, now: datetime) -> OverviewCards:
        today = self.demo_date
        monday = today - timedelta(days=today.weekday())

        def day_of(b: DemoBooking) -> date:
            return b.starts_at.astimezone(tz).date()

        def active(b: DemoBooking) -> bool:
            return b.status_at(now) != "cancelled"

        bookings = self.dataset.bookings
        return OverviewCards(
            today=sum(1 for b in bookings if day_of(b) == today and active(b)),
            tomorrow=sum(
                1 for b in bookings if day_of(b) == today + timedelta(days=1) and active(b)
            ),
            next7_days=sum(
                1 for b in bookings if today < day_of(b) <= today + timedelta(days=7) and active(b)
            ),
            new_since_last_visit=len(self._new_references(now)),
            cancelled_this_week=sum(
                1
                for b in bookings
                if monday <= day_of(b) <= monday + timedelta(days=6) and not active(b)
            ),
        )

    # ----- insights, doctors today, activity (US6-US8) ----------------------------------

    def insights(self, range_days: InsightsRange, tz: ZoneInfo, now: datetime) -> Insights:
        rows = [
            metrics.InsightRow(b.starts_at, b.status_at(now), b.department)
            for b in self.dataset.bookings
        ]
        return metrics.build_insights(
            range_days=range_days, today=self.demo_date, tz=tz, rows=rows, is_sample=True
        )

    def doctors_today(self, tz: ZoneInfo, now: datetime) -> DoctorsToday:
        today = self.demo_date
        booked: dict[uuid.UUID, list[datetime]] = {}
        for b in self.dataset.bookings:
            if b.starts_at.astimezone(tz).date() == today and b.status_at(now) != "cancelled":
                booked.setdefault(doctor_uuid(b.doctor_slug), []).append(b.starts_at)
        return metrics.build_doctors_today(
            day=today,
            now=now,
            tz=tz,
            plans=[self._plan(d, (today,), tz) for d in self.dataset.doctors],
            booked_starts=booked,
            holiday=self.dataset.holidays.get(today),
            is_sample=True,
        )

    def activity(
        self, *, action: str | None, staff_id: uuid.UUID | None, page: int, now: datetime
    ) -> ActivityPage:
        """The synthetic feed only, as far as it has happened by ``now``: nothing here comes from
        the database, and nothing is in the future."""
        name = None
        if staff_id is not None:
            name = next((m.display_name for m in self.staff() if m.id == staff_id), "")
        hits = [
            (index, event)
            for index, event in enumerate(self.dataset.activity)
            if event.occurred_at <= now
            and (action is None or event.action == action)
            and (name is None or event.staff_name == name)
        ]
        start = (page - 1) * ACTIVITY_PAGE_SIZE
        return ActivityPage(
            items=[
                ActivityEvent(
                    id=uuid.uuid5(
                        uuid.NAMESPACE_URL, f"{generator.SEED_PREFIX}activity:{self.demo_date}:{i}"
                    ),
                    at=event.occurred_at,
                    action=event.action,
                    outcome="ok",
                    actor_name=event.staff_name,
                    actor_role=event.role,
                    booking_reference=event.target_reference,
                    from_status=event.from_status,
                    to_status=event.to_status,
                    network_tag=event.network_tag,
                    is_sample=True,
                )
                for i, event in hits[start : start + ACTIVITY_PAGE_SIZE]
            ],
            total=len(hits),
            page=page,
        )
