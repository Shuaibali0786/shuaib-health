"""Audit rows for booking attempts. They hold no free text and no personal data (FR-053)."""

import uuid
from typing import Literal

from sqlmodel import Session

from app import models as m

AuditAction = Literal["appointment.created", "appointment.rejected"]
AuditOutcome = Literal[
    "ok",
    "rate_limited_ip",
    "rate_limited_phone",
    "limit_reached",
    "trap",
    "slot_taken",
    "slot_unavailable",
]


def write_audit(
    session: Session,
    *,
    action: AuditAction,
    outcome: AuditOutcome,
    fingerprint: str,
    request_id: str | None,
    target_id: uuid.UUID | None = None,
) -> None:
    session.add(
        m.AuditLog(
            action=action,
            outcome=outcome,
            actor_fingerprint=fingerprint,
            target_type="appointment" if target_id is not None else None,
            target_id=target_id,
            request_id=request_id,
        )
    )
