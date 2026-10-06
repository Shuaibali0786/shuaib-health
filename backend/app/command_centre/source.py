"""The seam between the Command Centre endpoints and their data (ADR-0009).

Every story adds its read methods here and implements them twice: ``RealSource`` (the database)
and ``DemoSource`` (a deterministic in-memory dataset). An endpoint never knows which one it got;
``app.auth.deps.get_source`` picks by session kind, so a demo visitor can never reach real data.
"""

from datetime import datetime
from typing import Protocol
from zoneinfo import ZoneInfo

from app.command_centre.schemas import BookingDetail, BookingPage, BookingSearchRequest, Lookups


class CommandCentreSource(Protocol):
    """Methods are added by each user story (overview, bookings, insights, ...)."""

    def search(self, body: BookingSearchRequest, tz: ZoneInfo, now: datetime) -> BookingPage: ...

    def detail(self, reference: str, tz: ZoneInfo, now: datetime) -> BookingDetail: ...

    def lookups(self) -> Lookups: ...
