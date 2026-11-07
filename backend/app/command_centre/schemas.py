"""Command Centre response models (contracts/command-centre-api.openapi.yaml). Camel-case on the
wire like every other model; routes return these, never the tables."""

import uuid
from datetime import date
from typing import Literal

from pydantic import AwareDatetime, Field, model_validator

from app.command_centre.status import Status
from app.schemas import CamelModel, ErrorInfo

Role = Literal["admin", "receptionist"]
EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


class ViewerOut(CamelModel):
    kind: Literal["staff", "demo"]
    role: Role | None = None
    display_name: str | None = None
    must_change_password: bool | None = None
    csrf_token: str
    clinic_today: date
    timezone: str
    session_expires_at: AwareDatetime | None = None
    # Demo only: the instant the demo treats as now, and whether it is the sample day.
    demo_now: AwareDatetime | None = None
    typical_day: bool | None = None


class SignInRequest(CamelModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=128)


class SessionIssued(CamelModel):
    """Returned to the website server only; the BFF moves ``token`` into the cookie."""

    token: str
    viewer: ViewerOut


class ChangePasswordRequest(CamelModel):
    current_password: str = Field(max_length=128)
    new_password: str = Field(min_length=12, max_length=128)


class TwoFactorChallenge(CamelModel):
    """202 from sign-in when the account uses two-step sign-in (Feature 011). The website keeps
    ``challenge_token`` in an httpOnly cookie; it never reaches browser JavaScript."""

    two_factor_required: Literal[True] = True
    challenge_token: str
    expires_at: AwareDatetime


class TwoFactorVerifyRequest(CamelModel):
    challenge_token: str = Field(max_length=100)
    code: str | None = Field(default=None, max_length=12)
    backup_code: str | None = Field(default=None, max_length=16)


class TwoFactorStatusOut(CamelModel):
    available: bool
    enabled: bool
    enabled_at: AwareDatetime | None = None
    backup_codes_left: int | None = None
    can_enrol: bool


class TwoFactorSetupRequest(CamelModel):
    current_password: str = Field(max_length=128)


class TwoFactorSetupOut(CamelModel):
    secret: str
    otpauth_uri: str


class TwoFactorEnableRequest(CamelModel):
    code: str = Field(max_length=12)


class TwoFactorConfirmRequest(CamelModel):
    current_password: str = Field(max_length=128)
    code: str | None = Field(default=None, max_length=12)
    backup_code: str | None = Field(default=None, max_length=16)


class BackupCodesOut(CamelModel):
    backup_codes: list[str]


class StaffOut(CamelModel):
    id: uuid.UUID
    email: str
    display_name: str
    job_title: str | None = None
    role: Role
    is_active: bool
    must_change_password: bool | None = None
    last_sign_in_at: AwareDatetime | None = None
    is_sample: bool | None = None
    two_factor_enabled: bool = False


class StaffCreate(CamelModel):
    email: str = Field(max_length=254, pattern=EMAIL_PATTERN)
    display_name: str = Field(min_length=1, max_length=60)
    role: Role
    temporary_password: str = Field(min_length=12, max_length=128)


class ResetPasswordRequest(CamelModel):
    temporary_password: str = Field(min_length=12, max_length=128)


class StaffPatch(CamelModel):
    role: Role | None = None
    is_active: bool | None = None

    @model_validator(mode="after")
    def _not_empty(self) -> "StaffPatch":
        if self.role is None and self.is_active is None:
            raise ValueError("at least one of role, isActive is required")
        return self


MAX_SEARCH_SPAN_DAYS = 92
PAGE_SIZE = 20


class DoctorRef(CamelModel):
    id: uuid.UUID
    name: str
    department_name: str
    is_active: bool | None = None


class DepartmentRef(CamelModel):
    id: uuid.UUID
    name: str
    is_active: bool | None = None


class Lookups(CamelModel):
    doctors: list[DoctorRef]
    departments: list[DepartmentRef]


class BookingSummary(CamelModel):
    reference: str
    starts_at: AwareDatetime
    ends_at: AwareDatetime
    local_date: date
    local_time: str
    status: Status
    version: int
    patient_name_masked: str
    phone_masked: str
    doctor: DoctorRef
    allowed_next: list[Status]
    is_sample: bool | None = None
    booked_at: AwareDatetime
    # Feature 012: new for the signed-in staff member (not opened, not marked seen).
    is_new: bool = False


class HistoryItem(CamelModel):
    at: AwareDatetime
    from_status: Status | None = None
    to_status: Status
    actor: str
    is_undo: bool


class BookingDetail(BookingSummary):
    patient_name: str
    email_masked: str | None = None
    reason: str | None = None
    fee_pkr: int
    history: list[HistoryItem]
    patient_age: int | None = None
    booked_by: str | None = None


class BookingSearchRequest(CamelModel):
    """Which bookings to list. Dates apply only when ``q`` is empty: a search by reference or name
    looks at every date. ``scope="upcoming"`` means every booking from tomorrow on, and
    ``booked_within_hours`` is the "Recently booked" filter (no dates unless given)."""

    q: str | None = Field(default=None, max_length=80)
    from_: date | None = Field(default=None, alias="from")
    to: date | None = None
    scope: Literal["day", "upcoming"] = "day"
    booked_within_hours: Literal[24, 168] | None = None
    sort: Literal["soonest", "recently_booked"] = "soonest"
    doctor_id: uuid.UUID | None = None
    department_id: uuid.UUID | None = None
    statuses: list[Status] | None = None
    page: int = Field(default=1, ge=1, le=100_000)

    @model_validator(mode="after")
    def _range(self) -> "BookingSearchRequest":
        if self.from_ and self.to:
            if self.to < self.from_:
                raise ValueError("to must not be before from")
            if (self.to - self.from_).days > MAX_SEARCH_SPAN_DAYS:
                raise ValueError(f"the date range may span at most {MAX_SEARCH_SPAN_DAYS} days")
        return self


class DayBookings(CamelModel):
    """Bookings on one clinic-local day, for the Upcoming view's day headings."""

    date: date
    count: int


class BookingPage(CamelModel):
    items: list[BookingSummary]
    total: int
    status_counts: dict[Status, int] = Field(default_factory=dict)
    # Upcoming scope only: every day with bookings (not just this page's), soonest first.
    day_counts: list[DayBookings] = Field(default_factory=list)
    page: int
    page_size: int = PAGE_SIZE


class StatusChangeRequest(CamelModel):
    to: Status
    expected_version: int = Field(ge=1)


class StatusChangeResult(CamelModel):
    booking: BookingDetail
    change_id: uuid.UUID
    undo_expires_at: AwareDatetime


class UndoRequest(CamelModel):
    change_id: uuid.UUID


class PhoneReveal(CamelModel):
    phone: str
    tel_href: str
    mask_after_seconds: int = 60


class BookingChanged(CamelModel):
    """A 409 on a booking write: the usual error body plus the booking as it is now."""

    error: ErrorInfo
    latest: BookingDetail | None = None


class Trend(CamelModel):
    """A KPI value, the same weekday's value a week earlier and their difference.

    ``None`` means "not known" (utilisation with no scheduled slots), shown as a dash.
    """

    value: int | None = None
    previous: int | None = None
    delta: int | None = None
    compared_to: date


class Kpis(CamelModel):
    appointments: Trend
    arrived: Trend
    completed: Trend
    no_shows: Trend
    cancellations: Trend
    utilisation_pct: Trend


class WorkHours(CamelModel):
    """One session of a doctor's day in clinic time, for the agenda's off-hours hatching."""

    start: str
    end: str


class AgendaDoctor(CamelModel):
    doctor: DoctorRef
    sessions: list[WorkHours]
    items: list[BookingSummary]


class RecentBooking(BookingSummary):
    pass


class OverviewCards(CamelModel):
    """The count cards (Feature 012). Today, tomorrow and the next seven days count bookings that
    are not cancelled; ``cancelled_this_week`` counts the cancelled ones of the clinic-local
    Monday-Sunday week; ``new_since_last_visit`` is what the bell shows."""

    today: int
    tomorrow: int
    next7_days: int
    new_since_last_visit: int
    cancelled_this_week: int


class NewBookings(CamelModel):
    """The bell: how many bookings are new for this staff member and the newest few."""

    count: int
    items: list[BookingSummary] = Field(max_length=5)


class MarkSeenRequest(CamelModel):
    """Either the bookings just opened, or ``all`` to mark every current booking seen."""

    references: list[str] | None = Field(default=None, max_length=50)
    all: bool = False

    @model_validator(mode="after")
    def _one_of(self) -> "MarkSeenRequest":
        if self.all == bool(self.references):
            raise ValueError("send either references or all")
        return self


class Overview(CamelModel):
    local_date: date
    now: AwareDatetime
    clinic_closed: str | None = None
    kpis: Kpis
    cards: OverviewCards
    agenda: list[AgendaDoctor]
    next_up: list[BookingSummary] = Field(max_length=5)
    recent_bookings: list[RecentBooking] = Field(default_factory=list, max_length=5)
    is_sample: bool


# ----- Insights (US6) ---------------------------------------------------------------------------

InsightsRange = Literal[7, 30, 90]
ACTIVITY_PAGE_SIZE = 25


class DayCount(CamelModel):
    date: date
    count: int


class DepartmentCount(CamelModel):
    department_name: str
    count: int
    cancelled: int


class StatusCount(CamelModel):
    status: Status
    count: int


class HourCount(CamelModel):
    hour: int = Field(ge=0, le=23)
    count: int


class Insights(CamelModel):
    """Bookings of the ``range_days`` ending on ``to`` (clinic-local days). ``total`` counts every
    booking that was not cancelled, so it equals the sum of ``per_day``, ``by_department.count`` and
    ``by_hour``; ``by_status`` has all five statuses."""

    range_days: InsightsRange
    from_: date = Field(alias="from")
    to: date
    total: int
    per_day: list[DayCount]
    by_department: list[DepartmentCount]
    by_status: list[StatusCount]
    by_hour: list[HourCount]
    is_sample: bool


# ----- Doctors today (US7) ----------------------------------------------------------------------


class DoctorToday(CamelModel):
    doctor: DoctorRef
    sessions: list[WorkHours]
    scheduled: int
    booked: int
    free: int
    free_passed: int = 0
    utilisation_pct: int
    next_free: str | None = None


class DoctorsToday(CamelModel):
    local_date: date
    clinic_closed: str | None = None
    working: list[DoctorToday]
    on_leave: list[DoctorRef]
    not_in: list[DoctorRef]
    is_sample: bool = False


# ----- Activity (US8) ---------------------------------------------------------------------------


class ActivityEvent(CamelModel):
    id: uuid.UUID
    at: AwareDatetime
    action: str
    outcome: str
    actor_name: str | None = None
    actor_role: str | None = None
    booking_reference: str | None = None
    from_status: Status | None = None
    to_status: Status | None = None
    network_tag: str
    is_sample: bool = False


class ActivityPage(CamelModel):
    items: list[ActivityEvent]
    total: int
    page: int
    page_size: int = ACTIVITY_PAGE_SIZE
