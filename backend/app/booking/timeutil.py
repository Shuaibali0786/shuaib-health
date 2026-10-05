"""UTC helpers. Every instant in the booking code is an aware UTC datetime (research R5)."""

from datetime import UTC, datetime

__all__ = ["UTC", "to_utc", "utc_iso"]


def to_utc(value: datetime) -> datetime:
    """Return ``value`` in UTC. A naive datetime is a bug, so it raises instead of guessing."""
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("datetime must be timezone-aware")
    return value.astimezone(UTC)


def utc_iso(value: datetime) -> str:
    """Format as ``YYYY-MM-DDTHH:MM:SSZ`` (whole seconds, UTC)."""
    return to_utc(value).strftime("%Y-%m-%dT%H:%M:%SZ")
