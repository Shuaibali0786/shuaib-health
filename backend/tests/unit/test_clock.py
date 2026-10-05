from datetime import UTC, datetime, timedelta

from app.booking.clock import SystemClock, get_clock
from tests.conftest import FROZEN_NOW, FrozenClock


def test_system_clock_returns_aware_utc() -> None:
    now = SystemClock().now()
    assert now.tzinfo is not None
    assert now.utcoffset() == timedelta(0)
    assert abs(now - datetime.now(UTC)) < timedelta(seconds=5)


def test_get_clock_gives_the_system_clock() -> None:
    assert isinstance(get_clock(), SystemClock)


def test_frozen_clock_moves_only_when_set(frozen_clock: FrozenClock) -> None:
    assert frozen_clock.now() == FROZEN_NOW
    assert frozen_clock.now() == FROZEN_NOW
    frozen_clock.set(FROZEN_NOW + timedelta(hours=25))
    assert frozen_clock.now() == FROZEN_NOW + timedelta(hours=25)
