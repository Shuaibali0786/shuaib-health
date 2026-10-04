"""Response models. Field names are camelCase on the wire and match frontend/src/types/content.ts.

Routes return these models, never the SQLModel tables.
"""

from datetime import UTC, datetime
from typing import Literal
from uuid import UUID

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel

from app.booking.validation import clean_email, clean_name, clean_reason, normalize_pk_mobile
from app.params import SLUG_PATTERN, Weekday


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, frozen=True)


class ImageAsset(CamelModel):
    src: str
    alt: str
    width: int
    height: int


class Page[T](CamelModel):
    items: list[T]
    total: int
    page: int
    page_size: int


class ErrorDetail(CamelModel):
    field: str
    issue: str


class ErrorInfo(CamelModel):
    code: str
    message: str
    request_id: str
    details: list[ErrorDetail] | None = Field(default=None)


class ErrorResponse(CamelModel):
    error: ErrorInfo


class AlternativeSlot(CamelModel):
    starts_at: str
    ends_at: str
    local_date: str
    local_time: str


class HealthStatus(CamelModel):
    status: Literal["ok", "unavailable"]


def image_asset(key: str, alt: str, width: int, height: int, base_path: str) -> ImageAsset:
    """Build an ``ImageAsset`` from a stored key, joining base path and key with one slash."""
    src = f"{base_path.rstrip('/')}/{key.lstrip('/')}"
    return ImageAsset(src=src, alt=alt, width=width, height=height)


class Department(CamelModel):
    id: UUID
    slug: str
    name: str
    summary: str
    image: ImageAsset
    sort_order: int
    overview: str
    conditions: list[str]
    services: list[str]
    related_test_slugs: list[str]
    is_sample: bool


class ScheduleSession(CamelModel):
    day: Weekday
    start: str
    end: str
    slot_minutes: int


class Doctor(CamelModel):
    id: UUID
    slug: str
    full_name: str
    department_id: UUID
    specialty: str
    photo: ImageAsset
    fee_pkr: int
    qualifications: list[str]
    experience_years: int
    languages: list[str]
    bio: str
    schedule: list[ScheduleSession]
    is_featured: bool
    is_sample: bool


class LabTestCategory(CamelModel):
    id: UUID
    slug: str
    name: str
    icon_name: str


class LabTest(CamelModel):
    id: UUID
    slug: str
    name: str
    also_known_as: list[str]
    category_id: UUID
    price_pkr: int
    sample_type: str
    report_time: str
    preparation: str
    home_collection: bool
    about: str
    related_department_ids: list[UUID]
    is_sample: bool


class LabTestSummary(CamelModel):
    id: UUID
    slug: str
    name: str
    price_pkr: int
    home_collection: bool


class HealthPackage(CamelModel):
    id: UUID
    slug: str
    name: str
    icon_name: str
    who_for: str
    test_slugs: list[str]
    package_price_pkr: int
    preparation: str
    home_collection: bool
    is_sample: bool


class HealthPackageDetail(HealthPackage):
    tests: list[LabTestSummary]


class PhoneNumber(CamelModel):
    display: str
    tel: str


class OpeningHoursRule(CamelModel):
    days: list[Weekday]
    opens: str
    closes: str


class MapArea(CamelModel):
    bbox: tuple[float, float, float, float]
    label: str


class Credit(CamelModel):
    text: str
    href: str


class BrandColors(CamelModel):
    primary: str
    accent: str


class StoredLogo(CamelModel):
    key: str
    alt: str
    width: int
    height: int


class ClinicSettings(CamelModel):
    name: str
    tagline: str
    full_title: str
    demo_notice: str
    emergency_phone: PhoneNumber
    general_phone: PhoneNumber
    address: list[str]
    time_zone: str
    opening_hours: list[OpeningHoursRule]
    lab_hours: list[OpeningHoursRule]
    map_area: MapArea
    credit: Credit
    indexable: bool
    is_sample: bool
    logo: ImageAsset
    brand_colors: BrandColors


class ClinicRule(CamelModel):
    id: UUID
    sort_order: int
    text: str
    is_sample: bool


class Slot(CamelModel):
    starts_at: str
    ends_at: str
    local_time: str


class SlotDay(CamelModel):
    date: str
    weekday: Weekday
    status: Literal[
        "available",
        "fully_booked",
        "doctor_unavailable",
        "clinic_closed",
        "not_working",
        "no_longer_available",
    ]
    holiday_name: str | None = Field(default=None)
    slots: list[Slot]


class DoctorSlots(CamelModel):
    doctor_slug: str
    time_zone: str
    window_days: int
    generated_at: str
    days: list[SlotDay]


class AppointmentCreate(CamelModel):
    """The booking request. Anything the server decides (fee, end time, status) is not accepted."""

    model_config = ConfigDict(extra="forbid")

    doctor_slug: str = Field(min_length=1, max_length=80, pattern=SLUG_PATTERN)
    starts_at: AwareDatetime
    full_name: str = Field(min_length=2, max_length=80)
    mobile: str = Field(min_length=1, max_length=20)
    email: str | None = Field(default=None, max_length=254)
    reason: str | None = Field(default=None, max_length=300)
    accept_rules: Literal[True]
    trap: str | None = Field(default=None, max_length=200)

    @field_validator("starts_at")
    @classmethod
    def _utc(cls, value: datetime) -> datetime:
        return value.astimezone(UTC)

    @field_validator("full_name")
    @classmethod
    def _name(cls, value: str) -> str:
        return clean_name(value)

    @field_validator("mobile")
    @classmethod
    def _mobile(cls, value: str) -> str:
        normalized = normalize_pk_mobile(value)
        if normalized is None:
            raise ValueError("mobile must be a Pakistani mobile number")
        return normalized

    @field_validator("email")
    @classmethod
    def _email(cls, value: str | None) -> str | None:
        return clean_email(value)

    @field_validator("reason")
    @classmethod
    def _reason(cls, value: str | None) -> str | None:
        return clean_reason(value)


class AppointmentDoctor(CamelModel):
    slug: str
    full_name: str
    specialty: str


class AppointmentDepartment(CamelModel):
    slug: str
    name: str


class AppointmentView(CamelModel):
    """What leaves the server after a booking: masked personal data only."""

    reference: str
    status: Literal["confirmed", "cancelled", "completed"]
    doctor: AppointmentDoctor
    department: AppointmentDepartment
    starts_at: str
    ends_at: str
    local_date: str
    local_time: str
    time_zone: str
    fee_pkr: int
    patient_name_masked: str
    mobile_masked: str
    is_sample: bool


class BookingConflict(CamelModel):
    error: ErrorInfo
    alternatives: list[AlternativeSlot] | None = Field(default=None, max_length=5)
