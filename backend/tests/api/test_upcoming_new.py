"""Upcoming, search across all dates, "Recently booked", New / seen per staff member, the bell and
the Overview cards (Feature 012). The clock is the frozen 005 clock (Monday 2026-10-05, 09:00 in
Karachi); booking times are stamped explicitly, because the database stamps real time."""

import uuid
from datetime import datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlmodel import Session

from app import models as m
from app.demo.generator import get_dataset
from app.settings import Settings
from tests.api.admin_support import API, make_staff, staff_session
from tests.api.test_bookings_admin import NOON, demo_headers, search, seed, staff_headers
from tests.conftest import FROZEN_NOW, FrozenClock

pytestmark = pytest.mark.db

__all__ = ["demo_headers", "staff_headers"]  # fixtures re-used from the bookings tests

DAY = timedelta(days=1)


def stamp(db: Session, ref: str, created_at: datetime) -> None:
    """Set when a booking was made (the database would stamp the real time)."""
    db.execute(
        text("UPDATE appointment SET created_at = :at WHERE reference = :ref"),
        {"at": created_at, "ref": ref},
    )
    db.commit()


def watermark(db: Session, staff: m.StaffAccount, at: datetime) -> None:
    db.execute(
        text("UPDATE staff_account SET bookings_seen_at = :at WHERE id = :id"),
        {"at": at, "id": staff.id},
    )
    db.commit()


def refs(response: Any) -> list[str]:
    return [item["reference"] for item in response.json()["items"]]


def test_a_typed_search_looks_at_every_date_not_just_the_selected_day(
    cc_client: TestClient, db_session: Session, staff_headers: tuple[dict[str, str], Any]
) -> None:
    hdrs, _ = staff_headers
    seed(db_session, "AAAAAAAA01", NOON)
    seed(db_session, "BBBBBBBB02", NOON + 10 * DAY, name="Bilal Ahmed")
    today = "2026-10-05"
    # With a date only today's booking shows; typing a reference or name ignores the date.
    assert refs(search(cc_client, hdrs, **{"from": today, "to": today})) == ["AAAAAAAA01"]
    assert refs(search(cc_client, hdrs, q="BBBBBBBB02", **{"from": today, "to": today})) == [
        "BBBBBBBB02"
    ]
    assert refs(search(cc_client, hdrs, q="bilal", **{"from": today, "to": today})) == [
        "BBBBBBBB02"
    ]


def test_upcoming_lists_everything_from_tomorrow_soonest_first_with_day_counts(
    cc_client: TestClient, db_session: Session, staff_headers: tuple[dict[str, str], Any]
) -> None:
    hdrs, _ = staff_headers
    seed(db_session, "AAAAAAAA01", NOON)  # today: not upcoming
    seed(db_session, "CCCCCCCC03", NOON + 3 * DAY)
    seed(db_session, "BBBBBBBB02", NOON + DAY)
    seed(db_session, "DDDDDDDD04", NOON + DAY + timedelta(hours=1), slug="dr-ayesha-rahman")
    body = search(cc_client, hdrs, scope="upcoming").json()
    assert [i["reference"] for i in body["items"]] == ["BBBBBBBB02", "DDDDDDDD04", "CCCCCCCC03"]
    assert body["total"] == 3
    assert body["dayCounts"] == [
        {"date": "2026-10-06", "count": 2},
        {"date": "2026-10-08", "count": 1},
    ]
    # A status filter narrows the headings as well.
    cancelled = search(cc_client, hdrs, scope="upcoming", statuses=["cancelled"]).json()
    assert cancelled["items"] == [] and cancelled["dayCounts"] == []


def test_recently_booked_filters_by_when_the_booking_was_made(
    cc_client: TestClient, db_session: Session, staff_headers: tuple[dict[str, str], Any]
) -> None:
    hdrs, _ = staff_headers
    seed(db_session, "AAAAAAAA01", NOON + DAY)
    seed(db_session, "BBBBBBBB02", NOON + 2 * DAY)
    seed(db_session, "CCCCCCCC03", NOON + 3 * DAY)
    stamp(db_session, "AAAAAAAA01", FROZEN_NOW - timedelta(hours=2))
    stamp(db_session, "BBBBBBBB02", FROZEN_NOW - timedelta(days=3))
    stamp(db_session, "CCCCCCCC03", FROZEN_NOW - timedelta(days=30))
    assert refs(search(cc_client, hdrs, bookedWithinHours=24)) == ["AAAAAAAA01"]
    assert refs(search(cc_client, hdrs, bookedWithinHours=168)) == ["AAAAAAAA01", "BBBBBBBB02"]
    newest_first = search(cc_client, hdrs, bookedWithinHours=168, sort="recently_booked")
    assert refs(newest_first) == ["AAAAAAAA01", "BBBBBBBB02"]
    assert search(cc_client, hdrs, bookedWithinHours=48).status_code == 422
    first = newest_first.json()["items"][0]
    assert first["bookedAt"].startswith("2026-10-05T")


def test_new_is_per_staff_member_and_clears_on_open_or_mark_all(
    cc_client: TestClient,
    db_session: Session,
    cc_settings: Settings,
    cc_clock: FrozenClock,
    staff_headers: tuple[dict[str, str], m.StaffAccount],
) -> None:
    hdrs, desk = staff_headers
    other = make_staff(db_session, "other@example.org", "receptionist", "Other Person")
    other_hdrs, _, _ = staff_session(db_session, cc_settings, other, cc_clock.now())
    db_session.commit()
    for staff in (desk, other):
        watermark(db_session, staff, FROZEN_NOW - timedelta(days=1))
    seed(db_session, "AAAAAAAA01", NOON + DAY)
    seed(db_session, "BBBBBBBB02", NOON + 2 * DAY)
    seed(db_session, "CCCCCCCC03", NOON + 3 * DAY)
    stamp(db_session, "AAAAAAAA01", FROZEN_NOW - timedelta(hours=5))
    stamp(db_session, "BBBBBBBB02", FROZEN_NOW - timedelta(hours=3))
    stamp(db_session, "CCCCCCCC03", FROZEN_NOW - timedelta(days=2))  # before the watermark

    def bell(headers: dict[str, str]) -> dict[str, Any]:
        response = cc_client.get(f"{API}/bookings/new", headers=headers)
        assert response.status_code == 200
        body: dict[str, Any] = response.json()
        return body

    first = bell(hdrs)
    assert first["count"] == 2
    assert [i["reference"] for i in first["items"]] == ["BBBBBBBB02", "AAAAAAAA01"]
    assert all(i["isNew"] for i in first["items"])
    listed = {
        i["reference"]: i["isNew"]
        for i in search(cc_client, hdrs, scope="upcoming").json()["items"]
    }
    assert listed == {"AAAAAAAA01": True, "BBBBBBBB02": True, "CCCCCCCC03": False}

    # Opening one clears it for this member only.
    opened = cc_client.post(
        f"{API}/bookings/seen", json={"references": ["AAAAAAAA01"]}, headers=hdrs
    )
    assert opened.status_code == 200 and opened.json()["count"] == 1
    assert bell(hdrs)["count"] == 1
    assert bell(other_hdrs)["count"] == 2

    # "Mark all seen" clears the rest, again for this member only.
    cleared = cc_client.post(f"{API}/bookings/seen", json={"all": True}, headers=hdrs)
    assert cleared.json() == {"count": 0, "items": []}
    assert bell(other_hdrs)["count"] == 2
    overview = cc_client.get(f"{API}/overview", headers=hdrs).json()
    assert overview["cards"]["newSinceLastVisit"] == 0
    assert (
        cc_client.get(f"{API}/overview", headers=other_hdrs).json()["cards"]["newSinceLastVisit"]
        == 2
    )


@pytest.mark.parametrize(
    "body", [{}, {"all": True, "references": ["AAAAAAAA01"]}, {"all": False}, {"references": []}]
)
def test_mark_seen_needs_exactly_one_of_references_or_all(
    cc_client: TestClient, staff_headers: tuple[dict[str, str], Any], body: dict[str, Any]
) -> None:
    hdrs, _ = staff_headers
    assert cc_client.post(f"{API}/bookings/seen", json=body, headers=hdrs).status_code == 422


def test_marking_unknown_references_seen_changes_nothing(
    cc_client: TestClient, staff_headers: tuple[dict[str, str], Any]
) -> None:
    hdrs, _ = staff_headers
    response = cc_client.post(
        f"{API}/bookings/seen", json={"references": ["ZZZZZZZZZZ"]}, headers=hdrs
    )
    assert response.status_code == 200 and response.json()["count"] == 0


def test_the_overview_cards_count_today_tomorrow_the_next_week_and_cancelled_this_week(
    cc_client: TestClient, db_session: Session, staff_headers: tuple[dict[str, str], Any]
) -> None:
    hdrs, _ = staff_headers
    seed(db_session, "AAAAAAAA01", NOON)  # today
    seed(db_session, "BBBBBBBB02", NOON, slug="dr-ayesha-rahman")  # today
    seed(db_session, "CCCCCCCC03", NOON + DAY)  # tomorrow
    seed(db_session, "DDDDDDDD04", NOON + 5 * DAY)  # inside the next 7 days
    seed(db_session, "EEEEEEEE05", NOON + 9 * DAY)  # outside
    seed(db_session, "FFFFFFFF06", NOON + 2 * DAY, status="cancelled")  # this week, cancelled
    seed(db_session, "GGGGGGGG07", NOON + 8 * DAY, status="cancelled")  # next week, cancelled
    cards = cc_client.get(f"{API}/overview", headers=hdrs).json()["cards"]
    assert (cards["today"], cards["tomorrow"], cards["next7Days"]) == (2, 1, 2)
    assert cards["cancelledThisWeek"] == 1


def test_a_demo_visitor_gets_the_same_views_from_sample_data_and_writes_nothing(
    cc_client: TestClient, db_session: Session, demo_headers: dict[str, str]
) -> None:
    upcoming = search(cc_client, demo_headers, scope="upcoming").json()
    assert upcoming["total"] > 0
    days = [d["date"] for d in upcoming["dayCounts"]]
    assert days == sorted(days) and days[0] > "2026-10-05"
    assert sum(d["count"] for d in upcoming["dayCounts"]) == upcoming["total"]
    assert (
        search(cc_client, demo_headers, scope="upcoming", sort="recently_booked").status_code == 200
    )

    sample_ref = get_dataset(FROZEN_NOW.date()).bookings[0].reference
    found = search(
        cc_client, demo_headers, q=sample_ref[:6], **{"from": "2026-10-05", "to": "2026-10-05"}
    )
    assert found.status_code == 200

    bell = cc_client.get(f"{API}/bookings/new", headers=demo_headers).json()
    assert 0 < bell["count"] <= 12 and len(bell["items"]) <= 5
    after = cc_client.post(f"{API}/bookings/seen", json={"all": True}, headers=demo_headers)
    assert after.status_code == 200 and after.json()["count"] == bell["count"]
    assert db_session.execute(text("SELECT count(*) FROM booking_seen")).scalar_one() == 0
    cards = cc_client.get(f"{API}/overview", headers=demo_headers).json()["cards"]
    assert cards["newSinceLastVisit"] == bell["count"]


def test_seen_rows_go_with_the_staff_member(
    cc_client: TestClient, db_session: Session, staff_headers: tuple[dict[str, str], m.StaffAccount]
) -> None:
    hdrs, desk = staff_headers
    seed(db_session, "AAAAAAAA01", NOON + DAY)
    cc_client.post(f"{API}/bookings/seen", json={"references": ["AAAAAAAA01"]}, headers=hdrs)
    rows: Any = db_session.execute(text("SELECT staff_id FROM booking_seen")).all()
    assert [r[0] for r in rows] == [desk.id]
    assert isinstance(desk.id, uuid.UUID)
