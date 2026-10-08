"""DEMO_ENABLED (on and off), the demo's typical clinic day, sample sign-ins in the past, and one
set of booking counts across Overview, Bookings and Today-by-status (demo and staff)."""

from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from httpx2 import Response
from sqlmodel import Session

from app.settings import Settings
from tests.api.admin_support import API, error_code, headers, make_staff, staff_session
from tests.api.test_bookings_admin import seed
from tests.api.test_overview_api import MIRZA, QURESHI, seed_today
from tests.conftest import FROZEN_NOW, FrozenClock, override_clock

pytestmark = pytest.mark.db


def start(client: TestClient) -> Response:
    return client.post(f"{API}/demo/start", headers=headers())


def at(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


# ----- DEMO_ENABLED ----------------------------------------------------------------------------


def test_demo_enabled_is_on_by_default(cc_settings: Settings) -> None:
    assert cc_settings.demo_enabled is True


def test_demo_start_works_when_the_demo_is_enabled(cc_client: TestClient) -> None:
    assert start(cc_client).status_code == 200


def test_demo_start_is_404_when_the_demo_is_disabled(
    make_client: Callable[..., TestClient], cc_clock: FrozenClock
) -> None:
    client = make_client(demo_enabled=False)
    override_clock(client.app, cc_clock)  # type: ignore[arg-type]
    response = start(client)
    assert response.status_code == 404 and error_code(response) == "not_found"
    assert "token" not in response.text


def test_no_demo_data_is_reachable_when_the_demo_is_disabled(
    make_client: Callable[..., TestClient], cc_clock: FrozenClock, cc_client: TestClient
) -> None:
    issued = start(cc_client).json()  # a demo session made before the switch was turned off
    token = issued["token"]
    off = make_client(demo_enabled=False)
    override_clock(off.app, cc_clock)  # type: ignore[arg-type]
    for path in ("/auth/me", "/overview", "/staff", "/lookups"):
        response = off.get(f"{API}{path}", headers=headers(token))
        assert response.status_code == 401, path
        assert error_code(response) == "not_signed_in", path
    csrf = issued["viewer"]["csrfToken"]
    search = off.post(f"{API}/bookings/search", headers=headers(token, csrf), json={})
    assert search.status_code == 401


def test_staff_still_work_when_the_demo_is_disabled(
    make_client: Callable[..., TestClient],
    cc_clock: FrozenClock,
    db_session: Session,
    cc_settings: Settings,
) -> None:
    off = make_client(demo_enabled=False)
    override_clock(off.app, cc_clock)  # type: ignore[arg-type]
    staff = make_staff(db_session, "desk@example.org", "receptionist", "Desk Person")
    hdrs, _, _ = staff_session(db_session, cc_settings, staff, cc_clock.now())
    db_session.commit()
    assert off.get(f"{API}/overview", headers=hdrs).status_code == 200


# ----- the typical clinic day ------------------------------------------------------------------


def test_outside_clinic_hours_the_demo_shows_a_typical_day(
    cc_client: TestClient, cc_clock: FrozenClock
) -> None:
    cc_clock._now = FROZEN_NOW.replace(hour=20, minute=30)  # 01:30 on 6 Oct in Karachi
    issued = start(cc_client).json()
    assert issued["viewer"]["typicalDay"] is True
    assert at(issued["viewer"]["demoNow"]) == datetime(2026, 10, 6, 7, 30, tzinfo=UTC)  # 12:30 PKT
    token = issued["token"]

    cc_clock._now += timedelta(minutes=10)
    me = cc_client.get(f"{API}/auth/me", headers=headers(token)).json()
    assert me["typicalDay"] is True
    assert at(me["demoNow"]) == datetime(2026, 10, 6, 7, 40, tzinfo=UTC)
    overview = cc_client.get(f"{API}/overview", headers=headers(token)).json()
    assert at(overview["now"]) == datetime(2026, 10, 6, 7, 40, tzinfo=UTC)


def test_inside_clinic_hours_the_demo_uses_the_real_time(cc_client: TestClient) -> None:
    viewer = start(cc_client).json()["viewer"]
    assert viewer["typicalDay"] is False and at(viewer["demoNow"]) == FROZEN_NOW


def test_a_typical_day_has_arrivals_and_completions(
    cc_client: TestClient, cc_clock: FrozenClock
) -> None:
    cc_clock._now = FROZEN_NOW.replace(hour=20, minute=30)
    token = start(cc_client).json()["token"]
    kpis = cc_client.get(f"{API}/overview", headers=headers(token)).json()["kpis"]
    assert kpis["completed"]["value"] > 0 and kpis["arrived"]["value"] > 0


def test_staff_always_get_the_real_time(
    cc_client: TestClient, cc_clock: FrozenClock, db_session: Session, cc_settings: Settings
) -> None:
    cc_clock._now = FROZEN_NOW.replace(hour=20, minute=30)
    staff = make_staff(db_session, "desk@example.org", "receptionist", "Desk Person")
    hdrs, _, _ = staff_session(db_session, cc_settings, staff, cc_clock.now())
    db_session.commit()
    body = cc_client.get(f"{API}/overview", headers=hdrs).json()
    assert at(body["now"]) == FROZEN_NOW.replace(hour=20, minute=30)
    me = cc_client.get(f"{API}/auth/me", headers=hdrs).json()
    assert "demoNow" not in me and "typicalDay" not in me


# ----- sample sign-ins -------------------------------------------------------------------------


@pytest.mark.parametrize("hour", [1, 5, 9, 14, 23])
def test_demo_staff_sign_ins_are_always_in_the_past(
    cc_client: TestClient, cc_clock: FrozenClock, hour: int
) -> None:
    cc_clock._now = FROZEN_NOW.replace(hour=hour, minute=7)
    issued = start(cc_client).json()
    shown = at(issued["viewer"]["demoNow"])
    rows = cc_client.get(f"{API}/staff", headers=headers(issued["token"])).json()
    assert rows
    assert all(at(row["lastSignInAt"]) <= shown for row in rows)


# ----- one set of counts -----------------------------------------------------------------------


def counts_of(client: TestClient, hdrs: dict[str, str]) -> dict[str, Any]:
    overview = client.get(f"{API}/overview", headers=hdrs).json()
    items = [b for row in overview["agenda"] for b in row["items"]]
    by_status: dict[str, int] = {}
    for item in items:
        by_status[item["status"]] = by_status.get(item["status"], 0) + 1
    page = client.post(f"{API}/bookings/search", headers=hdrs, json={}).json()
    return {
        "overview_items": len(items),
        "mix": by_status,
        "list_total": page["total"],
        "chips": page["statusCounts"],
        "appointments": overview["kpis"]["appointments"]["value"],
        "cancellations": overview["kpis"]["cancellations"]["value"],
    }


def assert_one_set_of_numbers(found: dict[str, Any]) -> None:
    assert found["overview_items"] == found["list_total"] == sum(found["chips"].values())
    assert found["mix"] == found["chips"]
    assert found["appointments"] + found["cancellations"] == found["list_total"]


def test_demo_overview_bookings_and_status_mix_match(
    cc_client: TestClient, cc_clock: FrozenClock
) -> None:
    for hour in (3, 11, 22):
        cc_clock._now = FROZEN_NOW.replace(hour=hour)
        issued = start(cc_client).json()
        hdrs = headers(issued["token"], issued["viewer"]["csrfToken"])
        assert_one_set_of_numbers(counts_of(cc_client, hdrs))


def test_staff_overview_bookings_and_status_mix_match(
    cc_client: TestClient, db_session: Session, cc_settings: Settings, cc_clock: FrozenClock
) -> None:
    seed_today(db_session)
    seed(db_session, "AAAAAAAA07", FROZEN_NOW + timedelta(hours=2), slug=QURESHI, status="no_show")
    seed(db_session, "AAAAAAAA08", FROZEN_NOW + timedelta(hours=3), slug=MIRZA)
    staff = make_staff(db_session, "desk@example.org", "receptionist", "Desk Person")
    hdrs, _, _ = staff_session(db_session, cc_settings, staff, cc_clock.now())
    db_session.commit()
    found = counts_of(cc_client, hdrs)
    assert_one_set_of_numbers(found)
    assert found["list_total"] == 6
