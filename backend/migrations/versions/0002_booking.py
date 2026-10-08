"""Booking: doctor leave, clinic holidays, appointments, idempotency keys, rate-limit counters,
audit log, and three booking settings on clinic_settings.

The double-booking guarantee is the exclusion constraint ``ex_appointment_no_overlap`` below. It
exists only in this migration (like the schedule constraint in 0001), see ADR-0005.

Revision ID: 0002_booking
Revises: 0001_catalog
Create Date: 2026-10-04 13:30:00.000000
"""

from collections.abc import Sequence
from typing import Any

import sqlalchemy as sa
from alembic import op

revision: str = "0002_booking"
down_revision: str | None = "0001_catalog"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _id_and_timestamps() -> list[sa.Column[Any]]:
    return [
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
    ]


def upgrade() -> None:
    # btree_gist is installed by 0001; repeated here so this migration stands on its own.
    op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist")

    op.add_column(
        "clinic_settings",
        sa.Column(
            "booking_window_days", sa.SmallInteger(), server_default=sa.text("14"), nullable=False
        ),
    )
    op.add_column(
        "clinic_settings",
        sa.Column(
            "booking_lead_minutes", sa.SmallInteger(), server_default=sa.text("120"), nullable=False
        ),
    )
    op.add_column(
        "clinic_settings",
        sa.Column(
            "max_active_bookings_per_phone",
            sa.SmallInteger(),
            server_default=sa.text("3"),
            nullable=False,
        ),
    )
    op.create_check_constraint(
        op.f("ck_clinic_settings_booking_window_days_range"),
        "clinic_settings",
        "booking_window_days BETWEEN 1 AND 60",
    )
    op.create_check_constraint(
        op.f("ck_clinic_settings_booking_lead_minutes_range"),
        "clinic_settings",
        "booking_lead_minutes BETWEEN 0 AND 10080",
    )
    op.create_check_constraint(
        op.f("ck_clinic_settings_max_active_bookings_per_phone_range"),
        "clinic_settings",
        "max_active_bookings_per_phone BETWEEN 1 AND 20",
    )

    op.create_table(
        "doctor_leave",
        *_id_and_timestamps(),
        sa.Column("doctor_id", sa.UUID(), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("note", sa.String(length=200), nullable=True),
        sa.Column("is_sample", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.CheckConstraint("ends_at > starts_at", name=op.f("ck_doctor_leave_ends_after_starts")),
        sa.ForeignKeyConstraint(
            ["doctor_id"],
            ["doctor.id"],
            name=op.f("fk_doctor_leave_doctor_id_doctor"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_doctor_leave")),
    )
    op.create_index(
        "ix_doctor_leave_doctor_id_starts_at", "doctor_leave", ["doctor_id", "starts_at"]
    )

    op.create_table(
        "clinic_holiday",
        *_id_and_timestamps(),
        sa.Column("holiday_date", sa.Date(), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("is_sample", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_clinic_holiday")),
        sa.UniqueConstraint("holiday_date", name=op.f("uq_clinic_holiday_holiday_date")),
    )

    op.create_table(
        "appointment",
        *_id_and_timestamps(),
        sa.Column("reference", sa.String(length=10), nullable=False),
        sa.Column("doctor_id", sa.UUID(), nullable=False),
        sa.Column("department_id", sa.UUID(), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "status", sa.String(length=12), server_default=sa.text("'confirmed'"), nullable=False
        ),
        sa.Column("fee_pkr", sa.Integer(), nullable=False),
        sa.Column("patient_name", sa.String(length=80), nullable=False),
        sa.Column("patient_phone", sa.String(length=13), nullable=False),
        sa.Column("patient_email", sa.String(length=254), nullable=True),
        sa.Column("reason", sa.String(length=300), nullable=True),
        sa.Column("rules_accepted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("rules_version", sa.String(length=16), nullable=False),
        sa.Column("is_sample", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.CheckConstraint(
            "reference ~ '^[0-9A-HJKMNP-TV-Z]{10}$'",
            name=op.f("ck_appointment_reference_format"),
        ),
        sa.CheckConstraint("ends_at > starts_at", name=op.f("ck_appointment_ends_after_starts")),
        sa.CheckConstraint(
            "status IN ('confirmed','cancelled','completed')",
            name=op.f("ck_appointment_status_valid"),
        ),
        sa.CheckConstraint("fee_pkr >= 0", name=op.f("ck_appointment_fee_pkr_non_negative")),
        sa.CheckConstraint(
            r"patient_phone ~ '^\+923[0-9]{9}$'", name=op.f("ck_appointment_patient_phone_format")
        ),
        sa.ForeignKeyConstraint(
            ["doctor_id"],
            ["doctor.id"],
            name=op.f("fk_appointment_doctor_id_doctor"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["department_id"],
            ["department.id"],
            name=op.f("fk_appointment_department_id_department"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_appointment")),
        sa.UniqueConstraint("reference", name=op.f("uq_appointment_reference")),
    )
    op.create_index(op.f("ix_appointment_doctor_id"), "appointment", ["doctor_id"])
    op.create_index(op.f("ix_appointment_department_id"), "appointment", ["department_id"])
    op.create_index(op.f("ix_appointment_ends_at"), "appointment", ["ends_at"])
    op.create_index(
        "ix_appointment_patient_phone_active",
        "appointment",
        ["patient_phone", "starts_at"],
        postgresql_where=sa.text("status = 'confirmed'"),
    )
    # The double-booking guarantee (ADR-0005): no two confirmed appointments of one doctor overlap.
    # Half-open ranges let back-to-back slots (10:00-10:15, 10:15-10:30) coexist.
    op.execute(
        "ALTER TABLE appointment ADD CONSTRAINT ex_appointment_no_overlap "
        "EXCLUDE USING gist (doctor_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&) "
        "WHERE (status = 'confirmed')"
    )

    op.create_table(
        "idempotency_key",
        sa.Column("key", sa.UUID(), nullable=False),
        sa.Column("scope", sa.String(length=40), nullable=False),
        sa.Column("request_hash", sa.CHAR(length=64), nullable=False),
        sa.Column("appointment_id", sa.UUID(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["appointment_id"],
            ["appointment.id"],
            name=op.f("fk_idempotency_key_appointment_id_appointment"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("key", name=op.f("pk_idempotency_key")),
    )
    op.create_index(op.f("ix_idempotency_key_expires_at"), "idempotency_key", ["expires_at"])

    op.create_table(
        "rate_limit_counter",
        sa.Column("bucket", sa.String(length=80), nullable=False),
        sa.Column("window_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("count", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("count >= 1", name=op.f("ck_rate_limit_counter_count_positive")),
        sa.PrimaryKeyConstraint("bucket", "window_start", name=op.f("pk_rate_limit_counter")),
    )
    op.create_index(op.f("ix_rate_limit_counter_expires_at"), "rate_limit_counter", ["expires_at"])

    op.create_table(
        "audit_log",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column(
            "occurred_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "actor_type",
            sa.String(length=20),
            server_default=sa.text("'anonymous'"),
            nullable=False,
        ),
        sa.Column("actor_fingerprint", sa.CHAR(length=16), nullable=False),
        sa.Column("action", sa.String(length=40), nullable=False),
        sa.Column("outcome", sa.String(length=30), nullable=False),
        sa.Column("target_type", sa.String(length=30), nullable=True),
        sa.Column("target_id", sa.UUID(), nullable=True),
        sa.Column("request_id", sa.String(length=64), nullable=True),
        sa.CheckConstraint(
            "action IN ('appointment.created','appointment.rejected')",
            name=op.f("ck_audit_log_action_valid"),
        ),
        sa.CheckConstraint(
            "outcome IN ('ok','rate_limited_ip','rate_limited_phone','limit_reached','trap',"
            "'slot_taken','slot_unavailable')",
            name=op.f("ck_audit_log_outcome_valid"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_audit_log")),
    )
    op.create_index(op.f("ix_audit_log_occurred_at"), "audit_log", ["occurred_at"])


def downgrade() -> None:
    op.drop_index(op.f("ix_audit_log_occurred_at"), table_name="audit_log")
    op.drop_table("audit_log")
    op.drop_index(op.f("ix_rate_limit_counter_expires_at"), table_name="rate_limit_counter")
    op.drop_table("rate_limit_counter")
    op.drop_index(op.f("ix_idempotency_key_expires_at"), table_name="idempotency_key")
    op.drop_table("idempotency_key")
    op.execute("ALTER TABLE appointment DROP CONSTRAINT ex_appointment_no_overlap")
    op.drop_index("ix_appointment_patient_phone_active", table_name="appointment")
    op.drop_index(op.f("ix_appointment_ends_at"), table_name="appointment")
    op.drop_index(op.f("ix_appointment_department_id"), table_name="appointment")
    op.drop_index(op.f("ix_appointment_doctor_id"), table_name="appointment")
    op.drop_table("appointment")
    op.drop_table("clinic_holiday")
    op.drop_index("ix_doctor_leave_doctor_id_starts_at", table_name="doctor_leave")
    op.drop_table("doctor_leave")
    op.drop_constraint(
        op.f("ck_clinic_settings_max_active_bookings_per_phone_range"),
        "clinic_settings",
        type_="check",
    )
    op.drop_constraint(
        op.f("ck_clinic_settings_booking_lead_minutes_range"), "clinic_settings", type_="check"
    )
    op.drop_constraint(
        op.f("ck_clinic_settings_booking_window_days_range"), "clinic_settings", type_="check"
    )
    op.drop_column("clinic_settings", "max_active_bookings_per_phone")
    op.drop_column("clinic_settings", "booking_lead_minutes")
    op.drop_column("clinic_settings", "booking_window_days")
