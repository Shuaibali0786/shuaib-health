"""Shared abuse limits (research R3): fixed-window counters in Postgres.

Each hit is one upsert in its own autocommitted transaction, run before the booking transaction,
so a refused or failed booking still counts. Buckets hold an HMAC, never a raw IP or phone number.
"""

import math
from datetime import datetime, timedelta

from pydantic import SecretStr
from sqlalchemy import Connection, Engine, text

from app.booking.privacy import hmac_hex

BOOKING_IP_WINDOW = timedelta(hours=1)
BOOKING_PHONE_WINDOW = timedelta(hours=24)  # aligned to UTC midnight
LOOKUP_IP_WINDOW = timedelta(minutes=1)
LOGIN_IP_WINDOW = timedelta(minutes=15)
DEMO_IP_WINDOW = timedelta(hours=1)
CLEANUP_LIMIT = 200

HIT = text(
    "INSERT INTO rate_limit_counter (bucket, window_start, count, expires_at) "
    "VALUES (:bucket, :window_start, 1, :expires_at) "
    "ON CONFLICT (bucket, window_start) DO UPDATE SET count = rate_limit_counter.count + 1 "
    "RETURNING count"
)
CLEANUP = text(
    "DELETE FROM rate_limit_counter WHERE ctid IN "
    "(SELECT ctid FROM rate_limit_counter WHERE expires_at <= :now LIMIT :limit)"
)


def _window_start(now: datetime, window: timedelta) -> datetime:
    seconds = int(window.total_seconds())
    floored = int(now.timestamp()) // seconds * seconds
    return datetime.fromtimestamp(floored, tz=now.tzinfo)


def hit(engine: Engine, bucket: str, window: timedelta, limit: int, now: datetime) -> int | None:
    """Count one attempt. ``None`` when allowed, else the seconds until the window ends."""
    start = _window_start(now, window)
    end = start + window
    with engine.begin() as conn:
        count = conn.execute(
            HIT, {"bucket": bucket, "window_start": start, "expires_at": end}
        ).scalar_one()
    if count <= limit:
        return None
    return max(1, math.ceil((end - now).total_seconds()))


def cleanup_counters(conn: Connection, now: datetime, limit: int = CLEANUP_LIMIT) -> None:
    """Delete up to ``limit`` expired counters; there is no cron on the free host."""
    conn.execute(CLEANUP, {"now": now, "limit": limit})


def booking_ip_bucket(key: SecretStr, ip: str) -> str:
    return f"booking:ip:{hmac_hex(key, 'booking-ip', ip)}"


def booking_phone_bucket(key: SecretStr, phone: str) -> str:
    return f"booking:phone:{hmac_hex(key, 'booking-phone', phone)}"


def lookup_ip_bucket(key: SecretStr, ip: str) -> str:
    return f"lookup:ip:{hmac_hex(key, 'lookup-ip', ip)}"


def login_ip_bucket(key: SecretStr, ip: str) -> str:
    return f"login:ip:{hmac_hex(key, 'login-ip', ip)}"


def demo_ip_bucket(key: SecretStr, ip: str) -> str:
    return f"demo:ip:{hmac_hex(key, 'demo-ip', ip)}"
