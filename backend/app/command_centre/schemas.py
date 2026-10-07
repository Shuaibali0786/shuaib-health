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
    booked_at: AwareDatetime
    history: list[HistoryItem]
    patient_age: int | None = None
    booked_by: str | None = None


class BookingSearchRequest(CamelModel):
    q: str | None = Field(default=None, max_length=80)
    from_: date | None = Field(default=None, alias="from")
    to: date | None = None
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


class BookingPage(CamelModel):
    items: list[BookingSummary]
    total: int
    status_counts: dict[Status, int] = Field(default_factory=dict)
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
    booked_at: AwareDatetime


class Overview(CamelModel):
    local_date: date
    now: AwareDatetime
    clinic_closed: str | None = None
    kpis: Kpis
    agenda: list[AgendaDoctor]
    next_up: list[BookingSummary] = Field(max_length=5)
    recent_bookings: list[RecentBooking] = Field(default_factory=list, max_length=5)
    is_sample: bool
