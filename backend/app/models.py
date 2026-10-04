"""Database tables (see specs/003-catalog-api/data-model.md).

Constraint and index names come from the naming convention below so that models, the Alembic
migration and ``alembic check`` agree. The no-overlap exclusion constraint on
``doctor_weekly_schedule`` exists only in the migration (it needs ``btree_gist``). The same is true
of the no-overlap exclusion constraint on ``appointment``: it exists only in migration 0002
(ADR-0005), and it is the double-booking guarantee.
"""

import uuid
from datetime import date, datetime, time
from typing import Any

from sqlalchemy import (
    ARRAY,
    CHAR,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
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


def _small_int_default(default: int) -> Any:
    return Field(
        default=default,
        sa_type=SmallInteger,
        sa_column_kwargs={"server_default": text(str(default)), "nullable": False},
    )


def _instant(*, nullable: bool = False, index: bool = False) -> Any:
    return Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=nullable, index=index),
    )


def _slug() -> Any:
    return Field(max_length=80, unique=True)


class Entity(SQLModel):
    id: uuid.UUID | None = _uuid_pk()
    created_at: datetime | None = _timestamp()
    updated_at: datetime | None = _timestamp()


class ClinicSettings(Entity, table=True):
    __tablename__ = "clinic_settings"
    __table_args__ = (
        CheckConstraint("singleton", name="singleton_true"),
        CheckConstraint("booking_window_days BETWEEN 1 AND 60", name="booking_window_days_range"),
        CheckConstraint(
            "booking_lead_minutes BETWEEN 0 AND 10080", name="booking_lead_minutes_range"
        ),
        CheckConstraint(
            "max_active_bookings_per_phone BETWEEN 1 AND 20",
            name="max_active_bookings_per_phone_range",
        ),
    )

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
    booking_window_days: int = _small_int_default(14)
    booking_lead_minutes: int = _small_int_default(120)
    max_active_bookings_per_phone: int = _small_int_default(3)


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


CONFIRMED_SQL = "status = 'confirmed'"
AUDIT_OUTCOMES_SQL = (
    "('ok','rate_limited_ip','rate_limited_phone','limit_reached','trap','slot_taken',"
    "'slot_unavailable')"
)


class DoctorLeave(Entity, table=True):
    __tablename__ = "doctor_leave"
    __table_args__ = (
        CheckConstraint("ends_at > starts_at", name="ends_after_starts"),
        Index("ix_doctor_leave_doctor_id_starts_at", "doctor_id", "starts_at"),
    )

    doctor_id: uuid.UUID = _fk("doctor.id", "CASCADE", index=False)
    starts_at: datetime = _instant()
    ends_at: datetime = _instant()
    note: str | None = Field(default=None, max_length=200)  # internal only, never in a response
    is_sample: bool = _flag(False)


class ClinicHoliday(Entity, table=True):
    __tablename__ = "clinic_holiday"

    holiday_date: date = Field(unique=True)
    name: str = Field(max_length=80)
    is_sample: bool = _flag(False)


class Appointment(Entity, table=True):
    __tablename__ = "appointment"
    __table_args__ = (
        CheckConstraint("reference ~ '^[0-9A-HJKMNP-TV-Z]{10}$'", name="reference_format"),
        CheckConstraint("ends_at > starts_at", name="ends_after_starts"),
        CheckConstraint("status IN ('confirmed','cancelled','completed')", name="status_valid"),
        CheckConstraint("fee_pkr >= 0", name="fee_pkr_non_negative"),
        CheckConstraint(r"patient_phone ~ '^\+923[0-9]{9}$'", name="patient_phone_format"),
        Index(
            "ix_appointment_patient_phone_active",
            "patient_phone",
            "starts_at",
            postgresql_where=text(CONFIRMED_SQL),
        ),
    )

    reference: str = Field(max_length=10, unique=True)
    doctor_id: uuid.UUID = _fk("doctor.id", "RESTRICT")
    department_id: uuid.UUID = _fk("department.id", "RESTRICT")
    starts_at: datetime = _instant()
    ends_at: datetime = _instant(index=True)
    status: str = Field(
        default="confirmed",
        max_length=12,
        sa_column_kwargs={"server_default": text("'confirmed'")},
    )
    fee_pkr: int = Field(sa_type=Integer)
    patient_name: str = Field(max_length=80)
    patient_phone: str = Field(max_length=13)
    patient_email: str | None = Field(default=None, max_length=254)
    reason: str | None = Field(default=None, max_length=300)
    rules_accepted_at: datetime = _instant()
    rules_version: str = Field(max_length=16)
    is_sample: bool = _flag(True)


class IdempotencyKey(SQLModel, table=True):
    __tablename__ = "idempotency_key"

    key: uuid.UUID = Field(sa_column=Column(UUID_TYPE, primary_key=True))
    scope: str = Field(max_length=40)
    request_hash: str = Field(sa_type=CHAR(64))
    appointment_id: uuid.UUID | None = Field(
        default=None,
        sa_column=Column(UUID_TYPE, ForeignKey("appointment.id", ondelete="CASCADE")),
    )
    created_at: datetime | None = _timestamp()
    expires_at: datetime = _instant(index=True)


class RateLimitCounter(SQLModel, table=True):
    __tablename__ = "rate_limit_counter"
    __table_args__ = (CheckConstraint("count >= 1", name="count_positive"),)

    bucket: str = Field(max_length=80, primary_key=True)
    window_start: datetime = Field(
        sa_column=Column(DateTime(timezone=True), primary_key=True, nullable=False)
    )
    count: int = Field(sa_type=Integer)
    expires_at: datetime = _instant(index=True)


class AuditLog(SQLModel, table=True):
    __tablename__ = "audit_log"
    __table_args__ = (
        CheckConstraint(
            "action IN ('appointment.created','appointment.rejected')", name="action_valid"
        ),
        CheckConstraint(f"outcome IN {AUDIT_OUTCOMES_SQL}", name="outcome_valid"),
    )

    id: uuid.UUID | None = _uuid_pk()
    occurred_at: datetime | None = Field(
        default=None,
        sa_column=Column(
            DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
        ),
    )
    actor_type: str = Field(
        default="anonymous",
        max_length=20,
        sa_column_kwargs={"server_default": text("'anonymous'")},
    )
    actor_fingerprint: str = Field(sa_type=CHAR(16))
    action: str = Field(max_length=40)
    outcome: str = Field(max_length=30)
    target_type: str | None = Field(default=None, max_length=30)
    target_id: uuid.UUID | None = Field(default=None, sa_type=UUID_TYPE)
    request_id: str | None = Field(default=None, max_length=64)
