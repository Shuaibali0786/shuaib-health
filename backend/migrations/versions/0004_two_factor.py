"""Two-step sign-in (Feature 011): authenticator columns on staff accounts, single-use backup
codes, the short-lived sign-in challenge, and the new audit actions and session end reason.

Additive only (playbook rule 8). The two CHECK constraints are replaced by supersets. Downgrade
drops the new tables and columns and puts the old CHECK constraints back as NOT VALID, so audit
rows already written with the new action names are kept, not deleted.

Revision ID: 0004_two_factor
Revises: 0003_command_centre
Create Date: 2026-11-07 10:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004_two_factor"
down_revision: str | None = "0003_command_centre"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

OLD_ACTIONS = (
    "('appointment.created','appointment.rejected','auth.sign_in','auth.sign_in_failed',"
    "'auth.lockout','auth.sign_out','auth.session_expired','auth.password_changed',"
    "'booking.status_changed','booking.status_undone','booking.phone_revealed','staff.created',"
    "'staff.password_reset','staff.deactivated','staff.reactivated','staff.role_changed')"
)
NEW_ACTIONS = (
    "('appointment.created','appointment.rejected','auth.sign_in','auth.sign_in_failed',"
    "'auth.lockout','auth.sign_out','auth.session_expired','auth.password_changed',"
    "'booking.status_changed','booking.status_undone','booking.phone_revealed','staff.created',"
    "'staff.password_reset','staff.deactivated','staff.reactivated','staff.role_changed',"
    "'auth.two_factor_challenge','auth.two_factor_failed','auth.two_factor_enabled',"
    "'auth.two_factor_disabled','auth.backup_code_used','auth.backup_codes_regenerated',"
    "'staff.two_factor_reset')"
)
OLD_END_REASONS = (
    "('sign_out','idle','absolute','evicted','password_changed','password_reset',"
    "'deactivated','replaced')"
)
NEW_END_REASONS = (
    "('sign_out','idle','absolute','evicted','password_changed','password_reset',"
    "'deactivated','replaced','two_factor_reset')"
)
ACTION_CK = "ck_audit_log_action_valid"
END_REASON_CK = "ck_staff_session_end_reason_valid"


def upgrade() -> None:
    # staff_account: nullable columns, no default (metadata-only change, no table rewrite).
    op.add_column(
        "staff_account", sa.Column("totp_secret_encrypted", sa.String(length=200), nullable=True)
    )
    op.add_column(
        "staff_account", sa.Column("totp_enabled_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column("staff_account", sa.Column("totp_last_step", sa.BigInteger(), nullable=True))
    op.add_column(
        "staff_account",
        sa.Column("totp_setup_started_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_check_constraint(
        op.f("ck_staff_account_totp_enabled_has_secret"),
        "staff_account",
        "totp_enabled_at IS NULL OR totp_secret_encrypted IS NOT NULL",
    )

    op.create_table(
        "staff_backup_code",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("staff_id", sa.UUID(), nullable=False),
        sa.Column("code_hash", sa.CHAR(length=64), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["staff_id"],
            ["staff_account.id"],
            name=op.f("fk_staff_backup_code_staff_id_staff_account"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_staff_backup_code")),
        sa.UniqueConstraint("staff_id", "code_hash", name=op.f("uq_staff_backup_code_staff_id")),
    )
    op.create_index(
        op.f("ix_staff_backup_code_staff_id"), "staff_backup_code", ["staff_id"], unique=False
    )

    op.create_table(
        "staff_sign_in_challenge",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("staff_id", sa.UUID(), nullable=False),
        sa.Column("token_hash", sa.CHAR(length=64), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempts", sa.SmallInteger(), server_default=sa.text("0"), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ip_fingerprint", sa.CHAR(length=16), nullable=False),
        sa.CheckConstraint(
            "expires_at > created_at",
            name=op.f("ck_staff_sign_in_challenge_expires_after_created"),
        ),
        sa.CheckConstraint(
            "attempts >= 0 AND attempts <= 5",
            name=op.f("ck_staff_sign_in_challenge_attempts_range"),
        ),
        sa.ForeignKeyConstraint(
            ["staff_id"],
            ["staff_account.id"],
            name=op.f("fk_staff_sign_in_challenge_staff_id_staff_account"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_staff_sign_in_challenge")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_staff_sign_in_challenge_token_hash")),
    )
    op.create_index(
        op.f("ix_staff_sign_in_challenge_staff_id"),
        "staff_sign_in_challenge",
        ["staff_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_staff_sign_in_challenge_expires_at"),
        "staff_sign_in_challenge",
        ["expires_at"],
        unique=False,
    )

    # Supersets of the old lists: every existing row still passes.
    op.drop_constraint(op.f(ACTION_CK), "audit_log", type_="check")
    op.create_check_constraint(op.f(ACTION_CK), "audit_log", f"action IN {NEW_ACTIONS}")
    op.drop_constraint(op.f(END_REASON_CK), "staff_session", type_="check")
    op.create_check_constraint(
        op.f(END_REASON_CK),
        "staff_session",
        f"end_reason IS NULL OR end_reason IN {NEW_END_REASONS}",
    )


def downgrade() -> None:
    # The old lists come back NOT VALID: new rows written while 0004 was live are kept, and
    # every later insert is checked against the old list again.
    op.drop_constraint(op.f(END_REASON_CK), "staff_session", type_="check")
    op.execute(
        f"ALTER TABLE staff_session ADD CONSTRAINT {END_REASON_CK} "
        f"CHECK (end_reason IS NULL OR end_reason IN {OLD_END_REASONS}) NOT VALID"
    )
    op.drop_constraint(op.f(ACTION_CK), "audit_log", type_="check")
    op.execute(
        f"ALTER TABLE audit_log ADD CONSTRAINT {ACTION_CK} "
        f"CHECK (action IN {OLD_ACTIONS}) NOT VALID"
    )

    op.drop_index(
        op.f("ix_staff_sign_in_challenge_expires_at"), table_name="staff_sign_in_challenge"
    )
    op.drop_index(op.f("ix_staff_sign_in_challenge_staff_id"), table_name="staff_sign_in_challenge")
    op.drop_table("staff_sign_in_challenge")
    op.drop_index(op.f("ix_staff_backup_code_staff_id"), table_name="staff_backup_code")
    op.drop_table("staff_backup_code")

    op.drop_constraint(
        op.f("ck_staff_account_totp_enabled_has_secret"), "staff_account", type_="check"
    )
    op.drop_column("staff_account", "totp_setup_started_at")
    op.drop_column("staff_account", "totp_last_step")
    op.drop_column("staff_account", "totp_enabled_at")
    op.drop_column("staff_account", "totp_secret_encrypted")
