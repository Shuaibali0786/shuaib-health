"""Database tables (see specs/003-catalog-api/data-model.md).

Constraint and index names come from the naming convention below so that models, the Alembic
migration and ``alembic check`` agree. The no-overlap exclusion constraint on
``doctor_weekly_schedule`` exists only in the migration (it needs ``btree_gist``).
"""

import uuid
from datetime import datetime, time
from typing import Any

from sqlalchemy import (
    ARRAY,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    SmallInteger,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlmodel import Column, Field, SQLModel

SQLModel.metadata.naming_convention = {
    "ix": "ix_%(table_name)s_%(column_0_name)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

SLUG_CHECK = "slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'"
WEEKDAYS_SQL = "('mon','tue','wed','thu','fri','sat','sun')"
UUID_TYPE = PG_UUID(as_uuid=True)
TEXT_ARRAY = ARRAY(Text)


def _uuid_pk() -> Any:
    return Field(
        default=None,
        primary_key=True,
        sa_type=UUID_TYPE,
        sa_column_kwargs={"server_default": text("gen_random_uuid()")},
    )


def _timestamp() -> Any:
    return Field(
        default=None,
        sa_type=DateTime(timezone=True),
        sa_column_kwargs={"server_default": func.now(), "nullable": False},
    )


def _fk(target: str, ondelete: str, *, index: bool = True, primary_key: bool = False) -> Any:
    return Field(
        sa_column=Column(
            UUID_TYPE,
            ForeignKey(target, ondelete=ondelete),
            nullable=False,
            index=index,
            primary_key=primary_key,
        )
    )


def _text_array() -> Any:
    return Field(
        default_factory=list,
        sa_type=TEXT_ARRAY,
        sa_column_kwargs={"server_default": text("'{}'::text[]"), "nullable": False},
    )


def _jsonb() -> Any:
    return Field(sa_type=JSONB, sa_column_kwargs={"nullable": False})


def _flag(default: bool) -> Any:
    return Field(
        default=default,
        sa_column_kwargs={"server_default": text("true" if default else "false")},
    )


def _small_int() -> Any:
    return Field(sa_type=SmallInteger, sa_column_kwargs={"nullable": False})


def _slug() -> Any:
    return Field(max_length=80, unique=True)


class Entity(SQLModel):
    id: uuid.UUID | None = _uuid_pk()
    created_at: datetime | None = _timestamp()
    updated_at: datetime | None = _timestamp()


class ClinicSettings(Entity, table=True):
    __tablename__ = "clinic_settings"
    __table_args__ = (CheckConstraint("singleton", name="singleton_true"),)

    singleton: bool = Field(
        default=True, unique=True, sa_column_kwargs={"server_default": text("true")}
    )
    name: str = Field(max_length=120)
    tagline: str = Field(max_length=200)
    full_title: str = Field(max_length=200)
    demo_notice: str = Field(max_length=200)
    emergency_phone: dict[str, Any] = _jsonb()
    general_phone: dict[str, Any] = _jsonb()
    address: list[str] = _text_array()
    time_zone: str = Field(max_length=64)
    opening_hours: list[dict[str, Any]] = _jsonb()
    lab_hours: list[dict[str, Any]] = _jsonb()
    map_area: dict[str, Any] = _jsonb()
    credit: dict[str, Any] = _jsonb()
    logo: dict[str, Any] = _jsonb()
    brand_colors: dict[str, Any] = _jsonb()
    indexable: bool = _flag(False)
    is_sample: bool = _flag(False)


class ClinicRule(Entity, table=True):
    __tablename__ = "clinic_rule"
    __table_args__ = (CheckConstraint("sort_order >= 1", name="sort_order_positive"),)

    sort_order: int = Field(sa_type=SmallInteger, unique=True)
    text: str = Field(max_length=300)
    is_active: bool = _flag(True)
    is_sample: bool = _flag(False)


class Department(Entity, table=True):
    __tablename__ = "department"
    __table_args__ = (
        CheckConstraint(SLUG_CHECK, name="slug_format"),
        CheckConstraint("image_width > 0 AND image_height > 0", name="image_size_positive"),
    )

    slug: str = _slug()
    name: str = Field(max_length=120)
    summary: str = Field(max_length=120)
    image_key: str = Field(max_length=200)
    image_alt: str = Field(max_length=300)
    image_width: int
    image_height: int
    sort_order: int = _small_int()
    overview: str = Field(sa_type=Text)
    conditions: list[str] = _text_array()
    services: list[str] = _text_array()
    is_active: bool = _flag(True)
    is_sample: bool = _flag(False)


class Doctor(Entity, table=True):
    __tablename__ = "doctor"
    __table_args__ = (
        CheckConstraint(SLUG_CHECK, name="slug_format"),
        CheckConstraint("fee_pkr >= 0", name="fee_pkr_non_negative"),
        CheckConstraint("experience_years BETWEEN 0 AND 70", name="experience_years_range"),
        CheckConstraint(
            "languages <@ ARRAY['Urdu','English','Sindhi','Punjabi']::text[]",
            name="languages_allowed",
        ),
        CheckConstraint("photo_width > 0 AND photo_height > 0", name="photo_size_positive"),
    )

    slug: str = _slug()
    full_name: str = Field(max_length=120)
    department_id: uuid.UUID = _fk("department.id", "RESTRICT")
    specialty: str = Field(max_length=120)
    photo_key: str = Field(max_length=200)
    photo_alt: str = Field(max_length=300)
    photo_width: int
    photo_height: int
    fee_pkr: int = Field(sa_type=Integer)
    qualifications: list[str] = _text_array()
    experience_years: int = _small_int()
    languages: list[str] = _text_array()
    bio: str = Field(sa_type=Text)
    sort_order: int = _small_int()
    is_featured: bool = _flag(False)
    is_active: bool = _flag(True)
    is_sample: bool = _flag(False)


class DoctorWeeklySchedule(Entity, table=True):
    __tablename__ = "doctor_weekly_schedule"
    __table_args__ = (
        CheckConstraint(f"weekday IN {WEEKDAYS_SQL}", name="weekday_valid"),
        CheckConstraint("end_time > start_time", name="end_after_start"),
        CheckConstraint("slot_minutes BETWEEN 5 AND 120", name="slot_minutes_range"),
        UniqueConstraint(
            "doctor_id", "weekday", "start_time", name="uq_doctor_weekly_schedule_session"
        ),
    )

    # Lookups by doctor use the leading column of uq_doctor_weekly_schedule_session.
    doctor_id: uuid.UUID = _fk("doctor.id", "CASCADE", index=False)
    weekday: str = Field(max_length=3, index=True)
    start_time: time
    end_time: time
    slot_minutes: int = _small_int()


class LabTestCategory(Entity, table=True):
    __tablename__ = "lab_test_category"
    __table_args__ = (CheckConstraint(SLUG_CHECK, name="slug_format"),)

    slug: str = _slug()
    name: str = Field(max_length=80)
    icon_name: str = Field(max_length=40)
    sort_order: int = _small_int()


class LabTest(Entity, table=True):
    __tablename__ = "lab_test"
    __table_args__ = (
        CheckConstraint(SLUG_CHECK, name="slug_format"),
        CheckConstraint("price_pkr >= 0", name="price_pkr_non_negative"),
    )

    slug: str = _slug()
    name: str = Field(max_length=160)
    also_known_as: list[str] = _text_array()
    category_id: uuid.UUID = _fk("lab_test_category.id", "RESTRICT")
    price_pkr: int = Field(sa_type=Integer)
    sample_type: str = Field(max_length=80)
    report_time: str = Field(max_length=80)
    preparation: str = Field(max_length=200)
    home_collection: bool
    about: str = Field(max_length=300)
    sort_order: int = _small_int()
    is_active: bool = _flag(True)
    is_sample: bool = _flag(False)


class HealthPackage(Entity, table=True):
    __tablename__ = "health_package"
    __table_args__ = (
        CheckConstraint(SLUG_CHECK, name="slug_format"),
        CheckConstraint("package_price_pkr >= 0", name="package_price_pkr_non_negative"),
    )

    slug: str = _slug()
    name: str = Field(max_length=120)
    icon_name: str = Field(max_length=40)
    who_for: str = Field(max_length=300)
    package_price_pkr: int = Field(sa_type=Integer)
    preparation: str = Field(max_length=200)
    home_collection: bool
    sort_order: int = _small_int()
    is_active: bool = _flag(True)
    is_sample: bool = _flag(False)


class DepartmentRelatedTest(SQLModel, table=True):
    __tablename__ = "department_related_test"

    department_id: uuid.UUID = _fk("department.id", "CASCADE", index=False, primary_key=True)
    lab_test_id: uuid.UUID = _fk("lab_test.id", "CASCADE", primary_key=True)
    sort_order: int = _small_int()


class LabTestRelatedDepartment(SQLModel, table=True):
    __tablename__ = "lab_test_related_department"

    lab_test_id: uuid.UUID = _fk("lab_test.id", "CASCADE", index=False, primary_key=True)
    department_id: uuid.UUID = _fk("department.id", "CASCADE", primary_key=True)
    sort_order: int = _small_int()


class HealthPackageTest(SQLModel, table=True):
    __tablename__ = "health_package_test"

    package_id: uuid.UUID = _fk("health_package.id", "CASCADE", index=False, primary_key=True)
    lab_test_id: uuid.UUID = _fk("lab_test.id", "RESTRICT", primary_key=True)
    sort_order: int = _small_int()
