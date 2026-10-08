"""The booking status lifecycle (FR-023, FR-024). Pure: the caller passes the instant in.

Allowed changes are exactly Confirmed -> Arrived / No-show / Cancelled and Arrived -> Completed /
No-show. Time rules: Arrived from two hours before the start, No-show from the start, Cancelled
only before the start. Completed has no time rule, so a past day can still be tidied up.
"""

from datetime import datetime, timedelta
from typing import Final, Literal

Status = Literal["confirmed", "arrived", "completed", "no_show", "cancelled"]

STATUSES: Final[tuple[Status, ...]] = ("confirmed", "arrived", "completed", "no_show", "cancelled")
TRANSITIONS: Final[dict[Status, tuple[Status, ...]]] = {
    "confirmed": ("arrived", "no_show", "cancelled"),
    "arrived": ("completed", "no_show"),
}
ARRIVE_LEAD: Final = timedelta(hours=2)
UNDO_WINDOW: Final = timedelta(seconds=10)
UNDO_GRACE: Final = timedelta(seconds=2)
DISPLAY_ORDER: Final[tuple[Status, ...]] = ("arrived", "completed", "no_show", "cancelled")


def time_rule_met(to: Status, starts_at: datetime, now: datetime) -> bool:
    if to == "arrived":
        return now >= starts_at - ARRIVE_LEAD
    if to == "no_show":
        return now >= starts_at
    if to == "cancelled":
        return now < starts_at
    return True


def is_allowed(current: Status, to: Status, starts_at: datetime, now: datetime) -> bool:
    return to in TRANSITIONS.get(current, ()) and time_rule_met(to, starts_at, now)


def allowed_next(current: Status, starts_at: datetime, now: datetime) -> list[Status]:
    """The statuses a booking may move to now, in a stable display order."""
    return [to for to in DISPLAY_ORDER if is_allowed(current, to, starts_at, now)]
