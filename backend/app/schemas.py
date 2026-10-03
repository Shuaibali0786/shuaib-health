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
