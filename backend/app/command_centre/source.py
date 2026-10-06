"""The seam between the Command Centre endpoints and their data (ADR-0009).

Every story adds its read methods here and implements them twice: ``RealSource`` (the database)
and ``DemoSource`` (a deterministic in-memory dataset). An endpoint never knows which one it got;
``app.auth.deps.get_source`` picks by session kind, so a demo visitor can never reach real data.
"""

from typing import Protocol


class CommandCentreSource(Protocol):
    """Methods are added by each user story (overview, bookings, insights, ...)."""
