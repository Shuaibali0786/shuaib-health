"""Audit rows for staff-facing events. Like the 005 rows they hold no free text and no personal
data: no password, phone, email or patient name can be written here (FR-030)."""

import uuid
from typing import Literal

from sqlmodel import Session

from app import models as m
from app.logging_config import request_id_var

AuthAction = Literal[
    "auth.sign_in",
    "auth.sign_in_failed",
    "auth.lockout",
    "auth.sign_out",
    "auth.session_expired",
    "auth.password_changed",
    "booking.status_changed",
    "booking.status_undone",
    "booking.phone_revealed",
    "staff.created",
    "staff.password_reset",
    "staff.deactivated",
    "staff.reactivated",
    "staff.role_changed",
]
AuthOutcome = Literal["ok", "refused", "bad_credentials", "locked", "inactive"]
ActorType = Literal["anonymous", "staff", "system"]


def record(
    db: Session,
    *,
    action: AuthAction,
    outcome: AuthOutcome = "ok",
    fingerprint: str,
    staff_id: uuid.UUID | None = None,
    role: str | None = None,
    actor_type: ActorType | None = None,
    target_type: str | None = None,
    target_id: uuid.UUID | None = None,
    target_reference: str | None = None,
    from_status: str | None = None,
    to_status: str | None = None,
) -> None:
    """Add one audit row to ``db``; the caller commits."""
    db.add(
        m.AuditLog(
            action=action,
            outcome=outcome,
            actor_type=actor_type or ("staff" if staff_id is not None else "anonymous"),
            actor_fingerprint=fingerprint,
            actor_staff_id=staff_id,
            actor_role=role,
            target_type=target_type,
            target_id=target_id,
            target_reference=target_reference,
            from_status=from_status,
            to_status=to_status,
            request_id=request_id_var.get(),
        )
    )
