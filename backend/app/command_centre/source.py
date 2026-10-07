"""The seam between the Command Centre endpoints and their data (ADR-0009).

Every story adds its read methods here and implements them twice: ``RealSource`` (the database)
and ``DemoSource`` (a deterministic in-memory dataset). An endpoint never knows which one it got;
``app.auth.deps.get_source`` picks by session kind, so a demo visitor can never reach real data.
"""

import uuid
from datetime import datetime
from typing import Protocol
from zoneinfo import ZoneInfo

from app.command_centre.schemas import (
    ActivityPage,
    BookingDetail,
    BookingPage,
    BookingSearchRequest,
    DoctorsToday,
    Insights,
    InsightsRange,
    Lookups,
    Overview,
)


class CommandCentreSource(Protocol):
    """Methods are added by each user story (overview, bookings, insights, ...)."""

    def search(self, body: BookingSearchRequest, tz: ZoneInfo, now: datetime) -> BookingPage: ...

    def detail(self, reference: str, tz: ZoneInfo, now: datetime) -> BookingDetail: ...

    def lookups(self) -> Lookups: ...

    def overview(self, tz: ZoneInfo, now: datetime) -> Overview: ...

    def insights(self, range_days: InsightsRange, tz: ZoneInfo, now: datetime) -> Insights: ...

    def doctors_today(self, tz: ZoneInfo, now: datetime) -> DoctorsToday: ...

    def activity(
        self, *, action: str | None, staff_id: uuid.UUID | None, page: int
    ) -> ActivityPage: ...
