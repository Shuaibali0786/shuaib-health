"""The clock as a dependency, so tests can freeze time."""

from datetime import UTC, datetime
from typing import Annotated, Protocol

from fastapi import Depends


class Clock(Protocol):
    def now(self) -> datetime:
        """The current instant, as an aware UTC datetime."""
        ...


class SystemClock:
    def now(self) -> datetime:
        return datetime.now(UTC)


def get_clock() -> Clock:
    return SystemClock()


ClockDep = Annotated[Clock, Depends(get_clock)]
