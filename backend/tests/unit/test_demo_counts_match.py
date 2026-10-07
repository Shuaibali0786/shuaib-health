"""One set of numbers (spec 006, data consistency): for the same day and the same moment the
Overview's bookings, its Today-by-status counts, the KPI cards and the Bookings list agree."""

from collections.abc import Mapping
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest

from app.command_centre.schemas import BookingSearchRequest
from app.demo.demo_source import DemoSource
from app.demo.generator import CLINIC_ZONE

DAY = date(2026, 10, 5)
KARACHI = ZoneInfo("Asia/Karachi")
MOMENTS = [
    datetime.combine(DAY, datetime.min.time(), tzinfo=CLINIC_ZONE) + timedelta(hours=h, minutes=m)
    for h, m in ((0, 5), (9, 0), (11, 20), (12, 30), (15, 45), (19, 59), (23, 30))
]


def all_pages(source: DemoSource, now: datetime) -> tuple[int, Mapping[str, int], int]:
    first = source.search(BookingSearchRequest(), KARACHI, now)
    seen = len(first.items)
    page = 1
    while seen < first.total:
        page += 1
        seen += len(source.search(BookingSearchRequest(page=page), KARACHI, now).items)
    return first.total, {str(k): v for k, v in first.status_counts.items()}, seen


@pytest.mark.parametrize("now", MOMENTS, ids=lambda n: n.strftime("%H:%M"))
def test_overview_bookings_and_status_mix_agree(now: datetime) -> None:
    source = DemoSource(DAY)
    now = now.astimezone(UTC)
    overview = source.overview(KARACHI, now)
    items = [b for row in overview.agenda for b in row.items]

    total, counts, listed = all_pages(source, now)
    by_status: dict[str, int] = {}
    for item in items:
        by_status[item.status] = by_status.get(item.status, 0) + 1

    assert total == len(items) == listed
    assert counts == by_status  # Today by status == the Bookings chips
    assert sum(counts.values()) == total
    kpis = overview.kpis
    assert kpis.appointments.value == total - counts.get("cancelled", 0)
    assert kpis.cancellations.value == counts.get("cancelled", 0)
    assert kpis.no_shows.value == counts.get("no_show", 0)
    assert kpis.completed.value == counts.get("completed", 0)
    assert kpis.arrived.value == counts.get("arrived", 0) + counts.get("completed", 0)
