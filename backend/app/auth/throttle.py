"""Sign-in throttling (research R5).

Per typed email: ``login_lock_failures`` failures inside a 15-minute window lock that email for
``login_lock_minutes``. The subject is an HMAC of the lower-cased email, so unknown emails are
throttled the same way and the answer never reveals whether an account exists. Per IP: the 005
fixed-window limiter (``app/booking/limits.py``). The caller commits.
"""

import math
from datetime import datetime, timedelta

from pydantic import SecretStr
from sqlalchemy import Engine, text
from sqlmodel import Session

from app.booking import limits
from app.booking.privacy import hmac_hex
from app.errors import AdminError, RateLimited
from app.settings import Settings

FAILURE_WINDOW = timedelta(minutes=15)

_UPSERT = text(
    "INSERT INTO login_throttle (subject_hash, failed_count, window_started_at, expires_at) "
    "VALUES (:subject, 1, :now, :window_end) "
    "ON CONFLICT (subject_hash) DO UPDATE SET "
    "failed_count = CASE WHEN login_throttle.window_started_at + :window <= :now "
    "THEN 1 ELSE login_throttle.failed_count + 1 END, "
    "window_started_at = CASE WHEN login_throttle.window_started_at + :window <= :now "
    "THEN :now ELSE login_throttle.window_started_at END, "
    "locked_until = CASE WHEN login_throttle.window_started_at + :window <= :now "
    "THEN NULL ELSE login_throttle.locked_until END "
    "RETURNING failed_count, window_started_at"
)
_LOCK = text(
    "UPDATE login_throttle SET locked_until = :until, "
    "expires_at = GREATEST(window_started_at + :window, :until) WHERE subject_hash = :subject"
)
_STATE = text(
    "SELECT locked_until FROM login_throttle WHERE subject_hash = :subject AND locked_until > :now"
)


def subject_hash(key: SecretStr, email: str) -> str:
    return hmac_hex(key, "login", email.strip().lower(), 64)


def locked_for(db: Session, subject: str, now: datetime) -> int | None:
    """Seconds until the email may try again, or ``None`` when it is not locked."""
    until: datetime | None = db.execute(
        _STATE, {"subject": subject, "now": now}
    ).scalar_one_or_none()
    if until is None:
        return None
    return max(1, math.ceil((until - now).total_seconds()))


def record_failure(db: Session, settings: Settings, subject: str, now: datetime) -> bool:
    """Count one failed sign-in. Returns True when this failure locked the email."""
    row = db.execute(
        _UPSERT,
        {
            "subject": subject,
            "now": now,
            "window": FAILURE_WINDOW,
            "window_end": now + FAILURE_WINDOW,
        },
    ).one()
    if row.failed_count < settings.login_lock_failures:
        return False
    until = now + timedelta(minutes=settings.login_lock_minutes)
    db.execute(_LOCK, {"subject": subject, "until": until, "window": FAILURE_WINDOW})
    return bool(row.failed_count == settings.login_lock_failures)


def clear(db: Session, subject: str) -> None:
    db.execute(
        text("DELETE FROM login_throttle WHERE subject_hash = :subject"), {"subject": subject}
    )


def cleanup(db: Session, now: datetime, limit: int = 200) -> None:
    db.execute(
        text(
            "DELETE FROM login_throttle WHERE ctid IN "
            "(SELECT ctid FROM login_throttle WHERE expires_at <= :now LIMIT :limit)"
        ),
        {"now": now, "limit": limit},
    )


def check_login_ip(engine: Engine, settings: Settings, ip: str, now: datetime) -> None:
    """429 ``rate_limited`` when this IP has made too many sign-in attempts in 15 minutes."""
    bucket = limits.login_ip_bucket(settings.privacy_hash_key, ip)
    retry = limits.hit(
        engine, bucket, limits.LOGIN_IP_WINDOW, settings.login_limit_per_ip_per_15min, now
    )
    if retry is not None:
        raise RateLimited(retry)


def raise_if_locked(db: Session, subject: str, now: datetime) -> None:
    retry = locked_for(db, subject, now)
    if retry is not None:
        raise AdminError("account_locked", retry_after=retry)
