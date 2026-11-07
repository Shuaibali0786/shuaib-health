"""Per-staff "seen" state for new bookings (Feature 012).

Two additive changes, nothing existing is touched:

* ``staff_account.bookings_seen_at`` (nullable): "Mark all seen" moves it to now. A booking is
  *new* for a staff member while it was booked after this moment (or after the account was created,
  when it is NULL) and the member has not opened it.
* ``booking_seen``: one row per (staff member, booking) the member opened.

Existing staff get ``bookings_seen_at = now()`` so a deploy does not mark the whole history as new.
Downgrade drops the table and the column.

Revision ID: 0005_booking_seen
Revises: 0004_two_factor
Create Date: 2026-11-07 15:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005_booking_seen"
down_revision: str | None = "0004_two_factor"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "staff_account",
        sa.Column("bookings_seen_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.execute("UPDATE staff_account SET bookings_seen_at = now()")
    op.create_table(
        "booking_seen",
        sa.Column("staff_id", sa.UUID(), nullable=False),
        sa.Column("appointment_id", sa.UUID(), nullable=False),
        sa.Column(
            "seen_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["staff_id"],
            ["staff_account.id"],
            name=op.f("fk_booking_seen_staff_id_staff_account"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["appointment_id"],
            ["appointment.id"],
            name=op.f("fk_booking_seen_appointment_id_appointment"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("staff_id", "appointment_id", name=op.f("pk_booking_seen")),
    )
    op.create_index(
        op.f("ix_booking_seen_appointment_id"), "booking_seen", ["appointment_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_booking_seen_appointment_id"), table_name="booking_seen")
    op.drop_table("booking_seen")
    op.drop_column("staff_account", "bookings_seen_at")
