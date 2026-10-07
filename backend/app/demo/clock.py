"""The demo's own "now".

A demo visitor who arrives outside clinic hours would otherwise see an empty, finished (or not
yet started) day. The demo then shows its sample day as it stands at 12:30 and lets it run on
from there, one demo minute per real minute since the demo began. Inside clinic hours the demo
uses the real time. Staff never use this.
"""

from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta

from app.demo.generator import CLINIC_ZONE

OPENS = time(9, 0)
CLOSES = time(20, 0)
TYPICAL_START = time(12, 30)


@dataclass(frozen=True)
class DemoNow:
    at: datetime
    #: True when the sample day is being shown instead of the real clock.
    typical: bool


def demo_now(real_now: datetime, demo_date: date, started_at: datetime) -> DemoNow:
    """The instant the demo treats as now. ``started_at`` is when the demo session began."""
    local = real_now.astimezone(CLINIC_ZONE)
    if local.date() == demo_date and OPENS <= local.time() < CLOSES:
        return DemoNow(real_now, False)
    typical = datetime.combine(demo_date, TYPICAL_START, tzinfo=CLINIC_ZONE)
    elapsed = max(timedelta(0), real_now - started_at)
    return DemoNow((typical + elapsed).astimezone(UTC), True)
