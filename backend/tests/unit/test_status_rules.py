"""The booking status lifecycle (FR-023, FR-024) with a frozen clock."""

from datetime import UTC, datetime, timedelta
from itertools import product

import pytest

from app.command_centre import status as rules
from app.command_centre.status import STATUSES, Status

START = datetime(2026, 10, 5, 8, 0, tzinfo=UTC)


def test_exactly_the_five_transitions_are_defined() -> None:
    pairs = {(a, b) for a, targets in rules.TRANSITIONS.items() for b in targets}
    assert pairs == {
        ("confirmed", "arrived"),
        ("confirmed", "no_show"),
        ("confirmed", "cancelled"),
        ("arrived", "completed"),
        ("arrived", "no_show"),
    }


@pytest.mark.parametrize(("current", "to"), list(product(STATUSES, STATUSES)))
def test_no_other_change_is_ever_allowed(current: Status, to: Status) -> None:
    defined = to in rules.TRANSITIONS.get(current, ())
    for offset in (-timedelta(days=3), -timedelta(hours=3), timedelta(0), timedelta(days=3)):
        if not defined:
            assert not rules.is_allowed(current, to, START, START + offset)


def test_arrived_opens_two_hours_before_the_start() -> None:
    assert not rules.is_allowed(
        "confirmed", "arrived", START, START - timedelta(hours=2, seconds=1)
    )
    assert rules.is_allowed("confirmed", "arrived", START, START - timedelta(hours=2))
    assert rules.is_allowed("confirmed", "arrived", START, START + timedelta(days=2))


def test_no_show_opens_at_the_start() -> None:
    assert not rules.is_allowed("confirmed", "no_show", START, START - timedelta(seconds=1))
    assert rules.is_allowed("confirmed", "no_show", START, START)
    assert rules.is_allowed("arrived", "no_show", START, START + timedelta(hours=1))


def test_cancel_only_before_the_start() -> None:
    assert rules.is_allowed("confirmed", "cancelled", START, START - timedelta(seconds=1))
    assert not rules.is_allowed("confirmed", "cancelled", START, START)
    assert not rules.is_allowed("confirmed", "cancelled", START, START + timedelta(days=1))


def test_completed_has_no_time_rule_so_a_past_day_can_be_tidied_up() -> None:
    assert rules.is_allowed("arrived", "completed", START, START + timedelta(days=5))
    assert rules.is_allowed("arrived", "completed", START, START - timedelta(hours=1))


def test_allowed_next_by_status_and_time() -> None:
    assert rules.allowed_next("confirmed", START, START - timedelta(days=1)) == ["cancelled"]
    assert rules.allowed_next("confirmed", START, START - timedelta(hours=1)) == [
        "arrived",
        "cancelled",
    ]
    assert rules.allowed_next("confirmed", START, START + timedelta(minutes=5)) == [
        "arrived",
        "no_show",
    ]
    assert rules.allowed_next("arrived", START, START + timedelta(minutes=5)) == [
        "completed",
        "no_show",
    ]
    for done in ("completed", "no_show", "cancelled"):
        assert rules.allowed_next(done, START, START) == []
