"""Command Centre: staff accounts and sessions, demo sessions, login throttle, booking status
lifecycle (new statuses, version, status-change history) and the audit-log extensions.

The double-booking guarantee (ADR-0005) is widened: ``ex_appointment_no_overlap`` now applies to
every status except ``cancelled`` (ADR-0010). Downgrading refuses while ``arrived`` or ``no_show``
bookings exist, because 0002 cannot represent them.

Revision ID: 0003_command_centre
Revises: 0002_booking
Create Date: 2026-10-06 09:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003_command_centre"
down_revision: str | None = "0002_booking"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

STATUSES = "('confirmed','arrived','completed','no_show','cancelled')"
OLD_STATUSES = "('confirmed','cancelled','completed')"
OLD_ACTIONS = "('appointment.created','appointment.rejected')"
NEW_ACTIONS = (
    "('appointment.created','appointment.rejected','auth.sign_in','auth.sign_in_failed',"
    "'auth.lockout','auth.sign_out','auth.session_expired','auth.password_changed',"
    "'booking.status_changed','booking.status_undone','booking.phone_revealed','staff.created',"
    "'staff.password_reset','staff.deactivated','staff.reactivated','staff.role_changed')"
)
OLD_OUTCOMES = (
    "('ok','rate_limited_ip','rate_limited_phone','limit_reached','trap','slot_taken',"
    "'slot_unavailable')"
)
NEW_OUTCOMES = (
    "('ok','rate_limited_ip','rate_limited_phone','limit_reached','trap','slot_taken',"
    "'slot_unavailable','refused','bad_credentials','locked','inactive')"
)
END_REASONS = (
    "('sign_out','idle','absolute','evicted','password_changed','password_reset',"
    "'deactivated','replaced')"
)


def _id_and_timestamps() -> list[sa.Column[object]]:
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


def _recreate_overlap(where: str) -> None:
    op.execute("ALTER TABLE appointment DROP CONSTRAINT ex_appointment_no_overlap")
    op.execute(
        "ALTER TABLE appointment ADD CONSTRAINT ex_appointment_no_overlap "
        "EXCLUDE USING gist (doctor_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&) "
        f"WHERE ({where})"
    )


def upgrade() -> None:
    op.create_table(
        "staff_account",
        *_id_and_timestamps(),
        sa.Column("email", sa.String(length=254), nullable=False),
        sa.Column("display_name", sa.String(length=60), nullable=False),
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column(
            "must_change_password", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
        sa.Column(
            "password_changed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("last_sign_in_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by_id", sa.UUID(), nullable=True),
        sa.CheckConstraint(
            "role IN ('admin','receptionist')", name=op.f("ck_staff_account_role_valid")
        ),
        sa.CheckConstraint(
            "password_hash LIKE '$argon2id$%'", name=op.f("ck_staff_account_password_hash_argon2id")
        ),
        sa.ForeignKeyConstraint(
            ["created_by_id"],
            ["staff_account.id"],
            name=op.f("fk_staff_account_created_by_id_staff_account"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_staff_account")),
        sa.UniqueConstraint("email", name=op.f("uq_staff_account_email")),
    )

    op.create_table(
        "staff_session",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("staff_id", sa.UUID(), nullable=False),
        sa.Column("token_hash", sa.CHAR(length=64), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "last_seen_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("idle_expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("absolute_expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("end_reason", sa.String(length=20), nullable=True),
        sa.Column("ip_fingerprint", sa.CHAR(length=16), nullable=False),
        sa.CheckConstraint(
            "absolute_expires_at > created_at", name=op.f("ck_staff_session_absolute_after_created")
        ),
        sa.CheckConstraint(
            f"end_reason IS NULL OR end_reason IN {END_REASONS}",
            name=op.f("ck_staff_session_end_reason_valid"),
        ),
        sa.ForeignKeyConstraint(
            ["staff_id"],
            ["staff_account.id"],
            name=op.f("fk_staff_session_staff_id_staff_account"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_staff_session")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_staff_session_token_hash")),
    )
    op.create_index(
        "ix_staff_session_staff_id_active",
        "staff_session",
        ["staff_id"],
        postgresql_where=sa.text("ended_at IS NULL"),
    )

    op.create_table(
        "demo_session",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("token_hash", sa.CHAR(length=64), nullable=False),
        sa.Column("demo_date", sa.Date(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ip_fingerprint", sa.CHAR(length=16), nullable=False),
        sa.CheckConstraint("expires_at > created_at", name=op.f("ck_demo_session_expires_after")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_demo_session")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_demo_session_token_hash")),
    )
    op.create_index(op.f("ix_demo_session_expires_at"), "demo_session", ["expires_at"])

    op.create_table(
        "login_throttle",
        sa.Column("subject_hash", sa.CHAR(length=64), nullable=False),
        sa.Column("failed_count", sa.SmallInteger(), nullable=False),
        sa.Column("window_started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint(
            "failed_count >= 1", name=op.f("ck_login_throttle_failed_count_positive")
        ),
        sa.PrimaryKeyConstraint("subject_hash", name=op.f("pk_login_throttle")),
    )
    op.create_index(op.f("ix_login_throttle_expires_at"), "login_throttle", ["expires_at"])

    # appointment: new statuses, version, widened exclusion constraint, starts_at index.
    op.drop_constraint(op.f("ck_appointment_status_valid"), "appointment", type_="check")
    op.create_check_constraint(
        op.f("ck_appointment_status_valid"), "appointment", f"status IN {STATUSES}"
    )
    op.add_column(
        "appointment",
        sa.Column("version", sa.Integer(), server_default=sa.text("1"), nullable=False),
    )
    op.create_check_constraint(
        op.f("ck_appointment_version_positive"), "appointment", "version >= 1"
    )
    op.create_index("ix_appointment_starts_at", "appointment", ["starts_at"])
    _recreate_overlap("status <> 'cancelled'")

    op.create_table(
        "appointment_status_change",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("appointment_id", sa.UUID(), nullable=False),
        sa.Column("from_status", sa.String(length=12), nullable=False),
        sa.Column("to_status", sa.String(length=12), nullable=False),
        sa.Column("actor_staff_id", sa.UUID(), nullable=False),
        sa.Column(
            "occurred_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("version_after", sa.Integer(), nullable=False),
        sa.Column("is_undo", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("undoes_change_id", sa.UUID(), nullable=True),
        sa.Column("undo_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            f"from_status IN {STATUSES}", name=op.f("ck_appointment_status_change_from_valid")
        ),
        sa.CheckConstraint(
            f"to_status IN {STATUSES}", name=op.f("ck_appointment_status_change_to_valid")
        ),
        sa.CheckConstraint(
            "from_status <> to_status", name=op.f("ck_appointment_status_change_status_differs")
        ),
        sa.CheckConstraint(
            "is_undo = (undoes_change_id IS NOT NULL)",
            name=op.f("ck_appointment_status_change_undo_consistent"),
        ),
        sa.ForeignKeyConstraint(
            ["appointment_id"],
            ["appointment.id"],
            name=op.f("fk_appointment_status_change_appointment_id_appointment"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["actor_staff_id"],
            ["staff_account.id"],
            name=op.f("fk_appointment_status_change_actor_staff_id_staff_account"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["undoes_change_id"],
            ["appointment_status_change.id"],
            name=op.f("fk_appointment_status_change_undoes_change_id_appointment_status_change"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_appointment_status_change")),
    )
    op.create_index(
        "ix_appointment_status_change_appointment_id_occurred_at",
        "appointment_status_change",
        ["appointment_id", "occurred_at"],
    )

    # audit_log: staff actors and the new actions/outcomes (one log, still no free text).
    op.add_column("audit_log", sa.Column("actor_staff_id", sa.UUID(), nullable=True))
    op.add_column("audit_log", sa.Column("actor_role", sa.String(length=16), nullable=True))
    op.add_column("audit_log", sa.Column("target_reference", sa.CHAR(length=10), nullable=True))
    op.add_column("audit_log", sa.Column("from_status", sa.String(length=12), nullable=True))
    op.add_column("audit_log", sa.Column("to_status", sa.String(length=12), nullable=True))
    op.create_foreign_key(
        op.f("fk_audit_log_actor_staff_id_staff_account"),
        "audit_log",
        "staff_account",
        ["actor_staff_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.drop_constraint(op.f("ck_audit_log_action_valid"), "audit_log", type_="check")
    op.create_check_constraint(
        op.f("ck_audit_log_action_valid"), "audit_log", f"action IN {NEW_ACTIONS}"
    )
    op.drop_constraint(op.f("ck_audit_log_outcome_valid"), "audit_log", type_="check")
    op.create_check_constraint(
        op.f("ck_audit_log_outcome_valid"), "audit_log", f"outcome IN {NEW_OUTCOMES}"
    )
    op.create_check_constraint(
        op.f("ck_audit_log_actor_type_valid"),
        "audit_log",
        "actor_type IN ('anonymous','staff','system')",
    )
    op.create_check_constraint(
        op.f("ck_audit_log_actor_role_valid"),
        "audit_log",
        "actor_role IS NULL OR actor_role IN ('admin','receptionist')",
    )
    op.create_index(
        "ix_audit_log_actor_staff_id_occurred_at", "audit_log", ["actor_staff_id", "occurred_at"]
    )
    op.create_index("ix_audit_log_action_occurred_at", "audit_log", ["action", "occurred_at"])


def downgrade() -> None:
    bind = op.get_bind()
    blocked = bind.execute(
        sa.text("SELECT count(*) FROM appointment WHERE status IN ('arrived','no_show')")
    ).scalar_one()
    if blocked:
        raise RuntimeError(
            "Cannot downgrade 0003_command_centre: "
            f"{blocked} appointment(s) are 'arrived' or 'no_show', which 0002 cannot represent. "
            "Resolve or purge them first."
        )

    # Audit rows written by 0003 cannot satisfy the 0002 checks (and reference staff accounts).
    op.execute(
        "DELETE FROM audit_log WHERE actor_type <> 'anonymous' "  # noqa: S608
        f"OR action NOT IN {OLD_ACTIONS} OR outcome NOT IN {OLD_OUTCOMES}"
    )
    op.drop_index("ix_audit_log_action_occurred_at", table_name="audit_log")
    op.drop_index("ix_audit_log_actor_staff_id_occurred_at", table_name="audit_log")
    op.drop_constraint(op.f("ck_audit_log_actor_role_valid"), "audit_log", type_="check")
    op.drop_constraint(op.f("ck_audit_log_actor_type_valid"), "audit_log", type_="check")
    op.drop_constraint(op.f("ck_audit_log_outcome_valid"), "audit_log", type_="check")
    op.create_check_constraint(
        op.f("ck_audit_log_outcome_valid"), "audit_log", f"outcome IN {OLD_OUTCOMES}"
    )
    op.drop_constraint(op.f("ck_audit_log_action_valid"), "audit_log", type_="check")
    op.create_check_constraint(
        op.f("ck_audit_log_action_valid"), "audit_log", f"action IN {OLD_ACTIONS}"
    )
    op.drop_constraint(
        op.f("fk_audit_log_actor_staff_id_staff_account"), "audit_log", type_="foreignkey"
    )
    for column in ("to_status", "from_status", "target_reference", "actor_role", "actor_staff_id"):
        op.drop_column("audit_log", column)

    op.drop_index(
        "ix_appointment_status_change_appointment_id_occurred_at",
        table_name="appointment_status_change",
    )
    op.drop_table("appointment_status_change")

    _recreate_overlap("status = 'confirmed'")
    op.drop_index("ix_appointment_starts_at", table_name="appointment")
    op.drop_constraint(op.f("ck_appointment_version_positive"), "appointment", type_="check")
    op.drop_column("appointment", "version")
    op.drop_constraint(op.f("ck_appointment_status_valid"), "appointment", type_="check")
    op.create_check_constraint(
        op.f("ck_appointment_status_valid"), "appointment", f"status IN {OLD_STATUSES}"
    )

    op.drop_index(op.f("ix_login_throttle_expires_at"), table_name="login_throttle")
    op.drop_table("login_throttle")
    op.drop_index(op.f("ix_demo_session_expires_at"), table_name="demo_session")
    op.drop_table("demo_session")
    op.drop_index("ix_staff_session_staff_id_active", table_name="staff_session")
    op.drop_table("staff_session")
    op.drop_table("staff_account")
