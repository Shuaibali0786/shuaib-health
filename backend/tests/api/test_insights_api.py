"""``GET /admin/insights`` (US6): totals per range, the breakdowns, validation and the demo.
Time is the frozen 005 clock: Monday 2026-10-05 09:00 in Karachi."""

from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.auth import sessions
from app.settings import Settings
from tests.api.admin_support import API, FP, csrf_for, headers, make_staff, staff_session
from tests.api.test_bookings_admin import seed
from tests.conftest import FROZEN_NOW, FrozenClock

pytestmark = pytest.mark.db

MIRZA = "dr-hassan-mirza"  # General Medicine
QURESHI = "dr-imran-qureshi"  # Cardiology


@pytest.fixture
def staff_headers(
    db_session: Session, cc_settings: Settings, cc_clock: FrozenClock
) -> dict[str, str]:
    staff = make_staff(db_session, "desk@example.org", "receptionist", "Desk Person")
    hdrs, _, _ = staff_session(db_session, cc_settings, staff, cc_clock.now())
    db_session.commit()
    return hdrs


@pytest.fixture
def demo_headers(
    db_session: Session, cc_settings: Settings, cc_clock: FrozenClock
) -> dict[str, str]:
    token, row = sessions.create_demo_session(
        db_session, cc_settings, cc_clock.now().date(), FP, cc_clock.now()
    )
    db_session.commit()
    return headers(token, csrf_for(cc_settings, row.id))


def get_insights(client: TestClient, hdrs: dict[str, str], days: int = 7) -> Any:
    answer = client.get(f"{API}/insights", params={"range": days}, headers=hdrs)
    assert answer.status_code == 200, answer.text
    assert answer.headers["cache-control"] == "no-store"
    return answer.json()


def seed_fixed(db: Session) -> None:
    """Today (Mon 05 Oct): 3 General Medicine at 09:00/09:15 + 1 Cardiology 16:00, one cancelled.
    Two days ago: 1 Cardiology no-show. 20 days ago: 1 completed. 60 days ago: 1 completed."""
    seed(db, "AAAAAAAA01", FROZEN_NOW, slug=MIRZA, status="arrived")
    seed(db, "AAAAAAAA02", FROZEN_NOW + timedelta(minutes=15), slug=MIRZA)
    seed(db, "AAAAAAAA03", FROZEN_NOW + timedelta(hours=7), slug=QURESHI)
    seed(db, "AAAAAAAA04", FROZEN_NOW + timedelta(minutes=30), slug=MIRZA, status="cancelled")
    seed(db, "AAAAAAAA05", FROZEN_NOW - timedelta(days=2), slug=QURESHI, status="no_show")
    seed(db, "AAAAAAAA06", FROZEN_NOW - timedelta(days=20), slug=MIRZA, status="completed")
    seed(db, "AAAAAAAA07", FROZEN_NOW - timedelta(days=60), slug=MIRZA, status="completed")


def test_each_range_gives_its_totals_and_zero_filled_days(
    cc_client: TestClient, db_session: Session, staff_headers: dict[str, str]
) -> None:
    seed_fixed(db_session)
    totals = {}
    for days in (7, 30, 90):
        body = get_insights(cc_client, staff_headers, days)
        assert body["rangeDays"] == days and body["to"] == "2026-10-05"
        assert body["from"] == (datetime(2026, 10, 5) - timedelta(days=days - 1)).date().isoformat()
        assert len(body["perDay"]) == days
        assert body["isSample"] is False
        totals[days] = body["total"]
        assert body["total"] == sum(d["count"] for d in body["perDay"])
        assert body["total"] == sum(d["count"] for d in body["byDepartment"])
        assert body["total"] == sum(h["count"] for h in body["byHour"])
    assert totals == {7: 4, 30: 5, 90: 6}


def test_seven_day_breakdowns(
    cc_client: TestClient, db_session: Session, staff_headers: dict[str, str]
) -> None:
    seed_fixed(db_session)
    body = get_insights(cc_client, staff_headers, 7)
    per_day = {d["date"]: d["count"] for d in body["perDay"]}
    assert per_day["2026-10-05"] == 3 and per_day["2026-10-03"] == 1 and per_day["2026-10-04"] == 0
    assert body["byDepartment"] == [
        {"departmentName": "Cardiology", "count": 2, "cancelled": 0},
        {"departmentName": "General Medicine", "count": 2, "cancelled": 1},
    ]
    assert {s["status"]: s["count"] for s in body["byStatus"]} == {
        "confirmed": 2,
        "arrived": 1,
        "completed": 0,
        "no_show": 1,
        "cancelled": 1,
    }
    assert [s["status"] for s in body["byStatus"]] == [
        "confirmed",
        "arrived",
        "completed",
        "no_show",
        "cancelled",
    ]
    hours = {h["hour"]: h["count"] for h in body["byHour"]}
    assert len(body["byHour"]) == 24
    assert hours[9] == 3 and hours[16] == 1 and sum(hours.values()) == 4  # Karachi hours


def test_busiest_hours_use_the_clinic_hour_not_utc(
    cc_client: TestClient, db_session: Session, staff_headers: dict[str, str]
) -> None:
    seed(db_session, "AAAAAAAA01", datetime(2026, 10, 5, 18, 45, tzinfo=UTC), slug=QURESHI)  # 23:45
    body = get_insights(cc_client, staff_headers, 7)
    assert {h["hour"]: h["count"] for h in body["byHour"]}[23] == 1
    assert {d["date"]: d["count"] for d in body["perDay"]}["2026-10-05"] == 1


@pytest.mark.parametrize("bad", ["1", "14", "0", "-7", "abc", ""])
def test_a_range_outside_7_30_90_is_a_422(
    cc_client: TestClient, staff_headers: dict[str, str], bad: str
) -> None:
    answer = cc_client.get(f"{API}/insights", params={"range": bad}, headers=staff_headers)
    assert answer.status_code == 422


def test_the_range_is_required(cc_client: TestClient, staff_headers: dict[str, str]) -> None:
    assert cc_client.get(f"{API}/insights", headers=staff_headers).status_code == 422


def test_no_personal_data_is_in_the_answer(
    cc_client: TestClient, db_session: Session, staff_headers: dict[str, str]
) -> None:
    seed_fixed(db_session)
    text = cc_client.get(f"{API}/insights", params={"range": 90}, headers=staff_headers).text
    for secret in ("Ayesha", "Khan", "0300", "ayesha@example.com", "AAAAAAAA"):
        assert secret not in text


def test_the_demo_gets_sample_totals_and_never_real_bookings(
    cc_client: TestClient, db_session: Session, demo_headers: dict[str, str]
) -> None:
    seed_fixed(db_session)  # real data the demo must not count
    first = get_insights(cc_client, demo_headers, 30)
    assert first["isSample"] is True
    assert first["total"] > 100 and len(first["perDay"]) == 30
    assert first["total"] == sum(d["count"] for d in first["perDay"])
    assert {s["status"] for s in first["byStatus"]} == {
        "confirmed",
        "arrived",
        "completed",
        "no_show",
        "cancelled",
    }
    assert get_insights(cc_client, demo_headers, 30) == first  # deterministic for a date
    assert get_insights(cc_client, demo_headers, 90)["total"] > first["total"]


def test_nobody_unsigned_may_read(cc_client: TestClient) -> None:
    assert (
        cc_client.get(f"{API}/insights", params={"range": 7}, headers=headers()).status_code == 401
    )
