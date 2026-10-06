"""Staff and demo sessions (ADR-0007, data-model §2/§3).

A staff session is valid while it is not ended, ``now`` is before both its idle and absolute expiry,
and the staff account is active. Looking a session up is where an expired one is ended (and one
``auth.session_expired`` audit row written), so the row is committed before ``AdminError`` is
raised. Every function takes ``now`` so tests can freeze the clock.
"""

import uuid
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Literal

from sqlmodel import Session, col, select

from app import models as m
from app.auth import audit, tokens
from app.errors import AdminError
from app.settings import Settings

SLIDE_AFTER = timedelta(seconds=60)

EndReason = Literal[
    "sign_out",
    "idle",
    "absolute",
    "evicted",
    "password_changed",
    "password_reset",
    "deactivated",
    "replaced",
]


@dataclass(frozen=True)
class ResolvedSession:
    kind: Literal["staff", "demo"]
    session_id: uuid.UUID
    staff: m.StaffAccount | None
    demo_date: date | None
    expires_at: datetime  # staff: the earlier of idle and absolute expiry


def create_staff_session(
    db: Session, settings: Settings, staff: m.StaffAccount, ip_fingerprint: str, now: datetime
) -> tuple[str, m.StaffSession]:
    """A new session and its one-time token; the oldest sessions beyond the maximum are evicted."""
    token = tokens.new_staff_token()
    row = m.StaffSession(
        staff_id=_required(staff.id),
        token_hash=tokens.hash_token(settings.session_secret, token),
        created_at=now,
        last_seen_at=now,
        idle_expires_at=now + timedelta(minutes=settings.staff_idle_minutes),
        absolute_expires_at=now + timedelta(hours=settings.staff_absolute_hours),
        ip_fingerprint=ip_fingerprint,
    )
    db.add(row)
    db.flush()
    active = db.exec(
        select(m.StaffSession)
        .where(
            col(m.StaffSession.staff_id) == staff.id,
            col(m.StaffSession.ended_at).is_(None),
            col(m.StaffSession.idle_expires_at) > now,
            col(m.StaffSession.absolute_expires_at) > now,
        )
        .order_by(col(m.StaffSession.created_at), col(m.StaffSession.id))
    ).all()
    for old in active[: max(0, len(active) - settings.staff_max_sessions)]:
        _end(old, "evicted", now)
    db.flush()
    return token, row


def create_demo_session(
    db: Session, settings: Settings, demo_date: date, ip_fingerprint: str, now: datetime
) -> tuple[str, m.DemoSession]:
    token = tokens.new_demo_token()
    row = m.DemoSession(
        token_hash=tokens.hash_token(settings.session_secret, token),
        demo_date=demo_date,
        created_at=now,
        expires_at=now + timedelta(hours=settings.demo_session_hours),
        ip_fingerprint=ip_fingerprint,
    )
    db.add(row)
    db.flush()
    return token, row


def _required[T](value: T | None) -> T:
    """A persisted row always has its id and server timestamps; this narrows the Optional."""
    if value is None:
        raise RuntimeError("row was not persisted")
    return value


def _end(row: m.StaffSession, reason: EndReason, now: datetime) -> None:
    row.ended_at = now
    row.end_reason = reason


def resolve(db: Session, settings: Settings, token: str | None, now: datetime) -> ResolvedSession:
    """The valid session behind ``token``, or ``AdminError`` (401)."""
    kind = tokens.token_kind(token) if token else None
    if token is None or kind is None:
        raise AdminError("not_signed_in")
    token_hash = tokens.hash_token(settings.session_secret, token)
    if kind == "demo":
        return _resolve_demo(db, token_hash, now)
    return _resolve_staff(db, settings, token_hash, now)


def _resolve_demo(db: Session, token_hash: str, now: datetime) -> ResolvedSession:
    row = db.exec(select(m.DemoSession).where(col(m.DemoSession.token_hash) == token_hash)).first()
    if row is None:
        raise AdminError("not_signed_in")
    if now >= row.expires_at:
        raise AdminError("session_expired")
    return ResolvedSession("demo", _required(row.id), None, row.demo_date, row.expires_at)


def _resolve_staff(
    db: Session, settings: Settings, token_hash: str, now: datetime
) -> ResolvedSession:
    row = db.exec(
        select(m.StaffSession).where(col(m.StaffSession.token_hash) == token_hash)
    ).first()
    if row is None or row.ended_at is not None:
        raise AdminError("not_signed_in")
    staff = db.get(m.StaffAccount, row.staff_id)
    if staff is None or not staff.is_active:
        _end(row, "deactivated", now)
        db.commit()
        raise AdminError("not_signed_in")
    expired: EndReason | None = None
    if now >= row.absolute_expires_at:
        expired = "absolute"
    elif now >= row.idle_expires_at:
        expired = "idle"
    if expired is not None:
        _end(row, expired, now)
        audit.record(
            db,
            action="auth.session_expired",
            fingerprint=row.ip_fingerprint,
            staff_id=staff.id,
            role=staff.role,
        )
        db.commit()
        raise AdminError("session_expired")
    if row.last_seen_at is None or now - row.last_seen_at >= SLIDE_AFTER:
        row.last_seen_at = now
        row.idle_expires_at = now + timedelta(minutes=settings.staff_idle_minutes)
        db.commit()
    return ResolvedSession(
        "staff", _required(row.id), staff, None, min(row.idle_expires_at, row.absolute_expires_at)
    )


def end_session(db: Session, session_id: uuid.UUID, reason: EndReason, now: datetime) -> None:
    row = db.get(m.StaffSession, session_id)
    if row is not None and row.ended_at is None:
        _end(row, reason, now)
        db.flush()


def end_demo_session(db: Session, session_id: uuid.UUID, now: datetime) -> None:
    """A demo session ends by expiring immediately (it has no ``ended_at``)."""
    row = db.get(m.DemoSession, session_id)
    if row is not None and row.expires_at > now:
        # The table requires expiry after creation, so a session ended in its first instant
        # expires one microsecond later.
        row.expires_at = max(now, (row.created_at or now) + timedelta(microseconds=1))
        db.flush()


def end_presented(
    db: Session, settings: Settings, token: str | None, reason: EndReason, now: datetime
) -> None:
    """End whatever session ``token`` names, valid or not (sign-in must never reuse a token)."""
    kind = tokens.token_kind(token) if token else None
    if token is None or kind is None:
        return
    token_hash = tokens.hash_token(settings.session_secret, token)
    if kind == "demo":
        demo = db.exec(
            select(m.DemoSession).where(col(m.DemoSession.token_hash) == token_hash)
        ).first()
        if demo is not None and demo.id is not None:
            end_demo_session(db, demo.id, now)
        return
    row = db.exec(
        select(m.StaffSession).where(col(m.StaffSession.token_hash) == token_hash)
    ).first()
    if row is not None and row.id is not None:
        end_session(db, row.id, reason, now)


def end_all_for_staff(
    db: Session,
    staff_id: uuid.UUID,
    reason: EndReason,
    now: datetime,
    *,
    except_session: uuid.UUID | None = None,
) -> int:
    rows = db.exec(
        select(m.StaffSession).where(
            col(m.StaffSession.staff_id) == staff_id, col(m.StaffSession.ended_at).is_(None)
        )
    ).all()
    ended = 0
    for row in rows:
        if row.id != except_session:
            _end(row, reason, now)
            ended += 1
    db.flush()
    return ended
