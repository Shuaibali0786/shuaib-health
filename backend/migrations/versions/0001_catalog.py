"""Catalog tables: clinic settings and rules, departments, doctors and schedules, lab tests,
health packages and their link tables.

Revision ID: 0001_catalog
Revises:
Create Date: 2026-10-03 16:42:05.328823
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_catalog"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # btree_gist lets the exclusion constraint below combine "=" on uuid/varchar with "&&".
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")
    op.create_table(
        "clinic_rule",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("sort_order", sa.SmallInteger(), nullable=False),
        sa.Column("text", sa.String(length=300), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("is_sample", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.CheckConstraint("sort_order >= 1", name=op.f("ck_clinic_rule_sort_order_positive")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_clinic_rule")),
        sa.UniqueConstraint("sort_order", name=op.f("uq_clinic_rule_sort_order")),
    )
    op.create_table(
        "clinic_settings",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("singleton", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("tagline", sa.String(length=200), nullable=False),
        sa.Column("full_title", sa.String(length=200), nullable=False),
        sa.Column("demo_notice", sa.String(length=200), nullable=False),
        sa.Column("emergency_phone", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("general_phone", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "address", sa.ARRAY(sa.Text()), server_default=sa.text("'{}'::text[]"), nullable=False
        ),
        sa.Column("time_zone", sa.String(length=64), nullable=False),
        sa.Column("opening_hours", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("lab_hours", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("map_area", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("credit", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("logo", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("brand_colors", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("indexable", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("is_sample", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.CheckConstraint("singleton", name=op.f("ck_clinic_settings_singleton_true")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_clinic_settings")),
        sa.UniqueConstraint("singleton", name=op.f("uq_clinic_settings_singleton")),
    )
    op.create_table(
        "department",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("slug", sa.String(length=80), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("summary", sa.String(length=120), nullable=False),
        sa.Column("image_key", sa.String(length=200), nullable=False),
        sa.Column("image_alt", sa.String(length=300), nullable=False),
        sa.Column("image_width", sa.Integer(), nullable=False),
        sa.Column("image_height", sa.Integer(), nullable=False),
        sa.Column("sort_order", sa.SmallInteger(), nullable=False),
        sa.Column("overview", sa.Text(), nullable=False),
        sa.Column(
            "conditions",
            sa.ARRAY(sa.Text()),
            server_default=sa.text("'{}'::text[]"),
            nullable=False,
        ),
        sa.Column(
            "services", sa.ARRAY(sa.Text()), server_default=sa.text("'{}'::text[]"), nullable=False
        ),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("is_sample", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.CheckConstraint(
            "slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'", name=op.f("ck_department_slug_format")
        ),
        sa.CheckConstraint(
            "image_width > 0 AND image_height > 0", name=op.f("ck_department_image_size_positive")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_department")),
        sa.UniqueConstraint("slug", name=op.f("uq_department_slug")),
    )
    op.create_table(
        "health_package",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("slug", sa.String(length=80), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("icon_name", sa.String(length=40), nullable=False),
        sa.Column("who_for", sa.String(length=300), nullable=False),
        sa.Column("package_price_pkr", sa.Integer(), nullable=False),
        sa.Column("preparation", sa.String(length=200), nullable=False),
        sa.Column("home_collection", sa.Boolean(), nullable=False),
        sa.Column("sort_order", sa.SmallInteger(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("is_sample", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.CheckConstraint(
            "slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'", name=op.f("ck_health_package_slug_format")
        ),
        sa.CheckConstraint(
            "package_price_pkr >= 0", name=op.f("ck_health_package_package_price_pkr_non_negative")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_health_package")),
        sa.UniqueConstraint("slug", name=op.f("uq_health_package_slug")),
    )
    op.create_table(
        "lab_test_category",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("slug", sa.String(length=80), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("icon_name", sa.String(length=40), nullable=False),
        sa.Column("sort_order", sa.SmallInteger(), nullable=False),
        sa.CheckConstraint(
            "slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'", name=op.f("ck_lab_test_category_slug_format")
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_lab_test_category")),
        sa.UniqueConstraint("slug", name=op.f("uq_lab_test_category_slug")),
    )
    op.create_table(
        "doctor",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("slug", sa.String(length=80), nullable=False),
        sa.Column("full_name", sa.String(length=120), nullable=False),
        sa.Column("department_id", sa.UUID(), nullable=False),
        sa.Column("specialty", sa.String(length=120), nullable=False),
        sa.Column("photo_key", sa.String(length=200), nullable=False),
        sa.Column("photo_alt", sa.String(length=300), nullable=False),
        sa.Column("photo_width", sa.Integer(), nullable=False),
        sa.Column("photo_height", sa.Integer(), nullable=False),
        sa.Column("fee_pkr", sa.Integer(), nullable=False),
        sa.Column(
            "qualifications",
            sa.ARRAY(sa.Text()),
            server_default=sa.text("'{}'::text[]"),
            nullable=False,
        ),
        sa.Column("experience_years", sa.SmallInteger(), nullable=False),
        sa.Column(
            "languages", sa.ARRAY(sa.Text()), server_default=sa.text("'{}'::text[]"), nullable=False
        ),
        sa.Column("bio", sa.Text(), nullable=False),
        sa.Column("sort_order", sa.SmallInteger(), nullable=False),
        sa.Column("is_featured", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("is_sample", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.CheckConstraint(
            "languages <@ ARRAY['Urdu','English','Sindhi','Punjabi']::text[]",
            name=op.f("ck_doctor_languages_allowed"),
        ),
        sa.CheckConstraint("slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'", name=op.f("ck_doctor_slug_format")),
        sa.CheckConstraint(
            "experience_years BETWEEN 0 AND 70", name=op.f("ck_doctor_experience_years_range")
        ),
        sa.CheckConstraint("fee_pkr >= 0", name=op.f("ck_doctor_fee_pkr_non_negative")),
        sa.CheckConstraint(
            "photo_width > 0 AND photo_height > 0", name=op.f("ck_doctor_photo_size_positive")
        ),
        sa.ForeignKeyConstraint(
            ["department_id"],
            ["department.id"],
            name=op.f("fk_doctor_department_id_department"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_doctor")),
        sa.UniqueConstraint("slug", name=op.f("uq_doctor_slug")),
    )
    op.create_index(op.f("ix_doctor_department_id"), "doctor", ["department_id"], unique=False)
    op.create_table(
        "lab_test",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("slug", sa.String(length=80), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column(
            "also_known_as",
            sa.ARRAY(sa.Text()),
            server_default=sa.text("'{}'::text[]"),
            nullable=False,
        ),
        sa.Column("category_id", sa.UUID(), nullable=False),
        sa.Column("price_pkr", sa.Integer(), nullable=False),
        sa.Column("sample_type", sa.String(length=80), nullable=False),
        sa.Column("report_time", sa.String(length=80), nullable=False),
        sa.Column("preparation", sa.String(length=200), nullable=False),
        sa.Column("home_collection", sa.Boolean(), nullable=False),
        sa.Column("about", sa.String(length=300), nullable=False),
        sa.Column("sort_order", sa.SmallInteger(), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("is_sample", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.CheckConstraint(
            "slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'", name=op.f("ck_lab_test_slug_format")
        ),
        sa.CheckConstraint("price_pkr >= 0", name=op.f("ck_lab_test_price_pkr_non_negative")),
        sa.ForeignKeyConstraint(
            ["category_id"],
            ["lab_test_category.id"],
            name=op.f("fk_lab_test_category_id_lab_test_category"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_lab_test")),
        sa.UniqueConstraint("slug", name=op.f("uq_lab_test_slug")),
    )
    op.create_index(op.f("ix_lab_test_category_id"), "lab_test", ["category_id"], unique=False)
    op.create_table(
        "department_related_test",
        sa.Column("department_id", sa.UUID(), nullable=False),
        sa.Column("lab_test_id", sa.UUID(), nullable=False),
        sa.Column("sort_order", sa.SmallInteger(), nullable=False),
        sa.ForeignKeyConstraint(
            ["department_id"],
            ["department.id"],
            name=op.f("fk_department_related_test_department_id_department"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["lab_test_id"],
            ["lab_test.id"],
            name=op.f("fk_department_related_test_lab_test_id_lab_test"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "department_id", "lab_test_id", name=op.f("pk_department_related_test")
        ),
    )
    op.create_index(
        op.f("ix_department_related_test_lab_test_id"),
        "department_related_test",
        ["lab_test_id"],
        unique=False,
    )
    op.create_table(
        "doctor_weekly_schedule",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("doctor_id", sa.UUID(), nullable=False),
        sa.Column("weekday", sa.String(length=3), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("slot_minutes", sa.SmallInteger(), nullable=False),
        sa.CheckConstraint(
            "weekday IN ('mon','tue','wed','thu','fri','sat','sun')",
            name=op.f("ck_doctor_weekly_schedule_weekday_valid"),
        ),
        sa.CheckConstraint(
            "end_time > start_time", name=op.f("ck_doctor_weekly_schedule_end_after_start")
        ),
        sa.CheckConstraint(
            "slot_minutes BETWEEN 5 AND 120",
            name=op.f("ck_doctor_weekly_schedule_slot_minutes_range"),
        ),
        sa.ForeignKeyConstraint(
            ["doctor_id"],
            ["doctor.id"],
            name=op.f("fk_doctor_weekly_schedule_doctor_id_doctor"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_doctor_weekly_schedule")),
        sa.UniqueConstraint(
            "doctor_id", "weekday", "start_time", name="uq_doctor_weekly_schedule_session"
        ),
    )
    op.create_index(
        op.f("ix_doctor_weekly_schedule_weekday"),
        "doctor_weekly_schedule",
        ["weekday"],
        unique=False,
    )
    # A doctor cannot have two overlapping sessions on the same weekday.
    op.execute(
        "ALTER TABLE doctor_weekly_schedule ADD CONSTRAINT ex_doctor_weekly_schedule_no_overlap "
        "EXCLUDE USING gist (doctor_id WITH =, weekday WITH =, "
        "tsrange('2000-01-01'::date + start_time, '2000-01-01'::date + end_time) WITH &&)"
    )
    op.create_table(
        "health_package_test",
        sa.Column("package_id", sa.UUID(), nullable=False),
        sa.Column("lab_test_id", sa.UUID(), nullable=False),
        sa.Column("sort_order", sa.SmallInteger(), nullable=False),
        sa.ForeignKeyConstraint(
            ["lab_test_id"],
            ["lab_test.id"],
            name=op.f("fk_health_package_test_lab_test_id_lab_test"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["package_id"],
            ["health_package.id"],
            name=op.f("fk_health_package_test_package_id_health_package"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("package_id", "lab_test_id", name=op.f("pk_health_package_test")),
    )
    op.create_index(
        op.f("ix_health_package_test_lab_test_id"),
        "health_package_test",
        ["lab_test_id"],
        unique=False,
    )
    op.create_table(
        "lab_test_related_department",
        sa.Column("lab_test_id", sa.UUID(), nullable=False),
        sa.Column("department_id", sa.UUID(), nullable=False),
        sa.Column("sort_order", sa.SmallInteger(), nullable=False),
        sa.ForeignKeyConstraint(
            ["department_id"],
            ["department.id"],
            name=op.f("fk_lab_test_related_department_department_id_department"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["lab_test_id"],
            ["lab_test.id"],
            name=op.f("fk_lab_test_related_department_lab_test_id_lab_test"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint(
            "lab_test_id", "department_id", name=op.f("pk_lab_test_related_department")
        ),
    )
    op.create_index(
        op.f("ix_lab_test_related_department_department_id"),
        "lab_test_related_department",
        ["department_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_lab_test_related_department_department_id"),
        table_name="lab_test_related_department",
    )
    op.drop_table("lab_test_related_department")
    op.drop_index(op.f("ix_health_package_test_lab_test_id"), table_name="health_package_test")
    op.drop_table("health_package_test")
    op.drop_index(op.f("ix_doctor_weekly_schedule_weekday"), table_name="doctor_weekly_schedule")
    op.drop_table("doctor_weekly_schedule")
    op.drop_index(
        op.f("ix_department_related_test_lab_test_id"), table_name="department_related_test"
    )
    op.drop_table("department_related_test")
    op.drop_index(op.f("ix_lab_test_category_id"), table_name="lab_test")
    op.drop_table("lab_test")
    op.drop_index(op.f("ix_doctor_department_id"), table_name="doctor")
    op.drop_table("doctor")
    op.drop_table("lab_test_category")
    op.drop_table("health_package")
    op.drop_table("department")
    op.drop_table("clinic_settings")
    op.drop_table("clinic_rule")
    # btree_gist is left installed: other objects may use it and dropping it needs ownership.
