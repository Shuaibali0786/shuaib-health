"""Response models. Field names are camelCase on the wire and match frontend/src/types/content.ts.

Routes return these models, never the SQLModel tables.
"""

from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from app.params import Weekday


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
