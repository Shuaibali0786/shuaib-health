"""Idempotency keys (research R2): one key makes one booking, however often it is sent.

The table stores the key, a hash of the request and the booking it made; never the request itself.
A key row exists only for a booking that was created, so a failed attempt leaves nothing behind.
"""

import uuid
from datetime import datetime, timedelta

from sqlalchemy import text, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session as OrmSession
from sqlmodel import Session, col, select

from app import models as m
from app.errors import BookingConflict

SCOPE = "appointment.create"
TTL = timedelta(hours=24)
CLEANUP_LIMIT = 200
KEY_REUSED_MESSAGE = "This booking key was already used for different details."

CLEANUP = text(
    "DELETE FROM idempotency_key WHERE ctid IN "
    "(SELECT ctid FROM idempotency_key WHERE expires_at <= :now LIMIT :limit)"
)


def _reused() -> BookingConflict:
    return BookingConflict("idempotency_key_reused", KEY_REUSED_MESSAGE)


def _stored(session: Session, key: uuid.UUID) -> tuple[str, uuid.UUID | None, datetime] | None:
    row = session.exec(
        select(
            col(m.IdempotencyKey.request_hash),
            col(m.IdempotencyKey.appointment_id),
            col(m.IdempotencyKey.expires_at),
        ).where(col(m.IdempotencyKey.key) == key)
    ).first()
    return None if row is None else (row[0], row[1], row[2])


def precheck(session: Session, key: uuid.UUID, req_hash: str, now: datetime) -> uuid.UUID | None:
    """The booking this key already made, or ``None`` when it is absent or expired.

    Read only, so it runs before the rate limits: a retry does not use them up.
    """
    stored = _stored(session, key)
    if stored is None or stored[2] <= now:
        return None
    if stored[0] != req_hash:
        raise _reused()
    return stored[1]


def claim(session: Session, key: uuid.UUID, req_hash: str, now: datetime) -> uuid.UUID | None:
    """Take the key inside the booking transaction.

    Returns ``None`` when it is now ours. When another request already made the booking, returns
    that booking's id (or raises when the details differ). A concurrent duplicate waits on the
    unique index until the first transaction ends; if that one rolled back, this one proceeds.
    An expired row is taken over in the same statement.
    """
    base = insert(m.IdempotencyKey).values(
        key=key, scope=SCOPE, request_hash=req_hash, expires_at=now + TTL
    )
    statement = base.on_conflict_do_update(
        index_elements=["key"],
        set_={
            "scope": SCOPE,
            "request_hash": req_hash,
            "appointment_id": None,
            "created_at": now,
            "expires_at": now + TTL,
        },
        where=col(m.IdempotencyKey.expires_at) <= now,
    ).returning(col(m.IdempotencyKey.key))
    if OrmSession.execute(session, statement).first() is not None:
        return None
    stored = _stored(session, key)
    if stored is None:  # an expired row was purged between the two statements: take it again
        return claim(session, key, req_hash, now)
    if stored[0] != req_hash:
        raise _reused()
    return stored[1]


def link(session: Session, key: uuid.UUID, appointment_id: uuid.UUID) -> None:
    OrmSession.execute(
        session,
        update(m.IdempotencyKey)
        .where(col(m.IdempotencyKey.key) == key)
        .values(appointment_id=appointment_id),
    )


def cleanup(session: Session, now: datetime, limit: int = CLEANUP_LIMIT) -> None:
    """Delete up to ``limit`` expired rows; there is no cron on the free host."""
    session.connection().execute(CLEANUP, {"now": now, "limit": limit})
