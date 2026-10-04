from datetime import UTC, datetime, timedelta, timezone

import pytest

from app.booking.timeutil import to_utc, utc_iso

KARACHI = timezone(timedelta(hours=5))


def test_naive_datetime_is_rejected() -> None:
    with pytest.raises(ValueError, match="timezone-aware"):
        to_utc(datetime(2026, 10, 5, 10, 0))


def test_aware_datetime_is_converted_to_utc() -> None:
    local = datetime(2026, 10, 5, 10, 0, tzinfo=KARACHI)
    result = to_utc(local)
    assert result.tzinfo is UTC
    assert result == local
    assert (result.hour, result.minute) == (5, 0)


def test_utc_iso_format() -> None:
    assert utc_iso(datetime(2026, 10, 5, 10, 0, tzinfo=KARACHI)) == "2026-10-05T05:00:00Z"
    assert utc_iso(datetime(2026, 1, 2, 3, 4, 5, 999999, tzinfo=UTC)) == "2026-01-02T03:04:05Z"


def test_utc_iso_rejects_naive() -> None:
    with pytest.raises(ValueError):
        utc_iso(datetime(2026, 10, 5, 10, 0))
