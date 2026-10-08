"""``GET /admin/activity`` (US8): newest first, filters, paging, admins only, the synthetic demo
feed and nothing personal in any entry. Time is the frozen 005 clock."""

import json
from datetime import timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app import models as m
from app.auth import sessions
from app.settings import Settings
from tests.api.admin_support import API, FP, csrf_for, headers, make_staff, staff_session
from tests.conftest import FROZEN_NOW, FrozenClock

pytestmark = pytest.mark.db

FINGERPRINT = "abcdef0123456789"


@pytest.fixture
def admin(db_session: Session) -> m.StaffAccount:
    return make_staff(db_session, "owner@example.org", "admin", "Clinic Owner")


@pytest.fixture
def admin_headers(
    db_session: Session, cc_settings: Settings, cc_clock: FrozenClock, admin: m.StaffAccount
) -> dict[str, str]:
    hdrs, _, _ = staff_session(db_session, cc_settings, admin, cc_clock.now())
    db_session.commit()
    return hdrs


@pytest.fixture
def receptionist_headers(
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


def event(
    db: Session,
    action: str,
    minutes_ago: int,
    staff: m.StaffAccount | None = None,
    *,
    outcome: str = "ok",
    reference: str | None = None,
    change: tuple[str, str] | None = None,
) -> None:
    db.add(
        m.AuditLog(
            occurred_at=FROZEN_NOW - timedelta(minutes=minutes_ago),
            actor_type="staff" if staff else "anonymous",
            actor_fingerprint=FINGERPRINT,
            actor_staff_id=staff.id if staff else None,
            actor_role=staff.role if staff else None,
            action=action,
            outcome=outcome,
            target_type="appointment" if reference else None,
            target_reference=reference,
            from_status=change[0] if change else None,
            to_status=change[1] if change else None,
        )
    )


def seed_feed(db: Session, admin: m.StaffAccount) -> m.StaffAccount:
    desk = make_staff(db, "reception@example.org", "receptionist", "Desk Person")
    event(db, "auth.sign_in", 50, desk)
    event(
        db,
        "booking.status_changed",
        40,
        desk,
        reference="AAAAAAAA01",
        change=("confirmed", "arrived"),
    )
    event(
        db,
        "booking.status_undone",
        30,
        desk,
        reference="AAAAAAAA01",
        change=("arrived", "confirmed"),
    )
    event(db, "booking.phone_revealed", 20, admin, reference="AAAAAAAA02")
    event(db, "auth.sign_in_failed", 10, outcome="bad_credentials")
    db.commit()
    return desk


def get_feed(client: TestClient, hdrs: dict[str, str], **params: Any) -> Any:
    answer = client.get(f"{API}/activity", params=params, headers=hdrs)
    assert answer.status_code == 200, answer.text
    assert answer.headers["cache-control"] == "no-store"
    return answer.json()


def test_newest_first_with_actor_names_references_and_a_six_character_tag(
    cc_client: TestClient, db_session: Session, admin: m.StaffAccount, admin_headers: dict[str, str]
) -> None:
    seed_feed(db_session, admin)
    body = get_feed(cc_client, admin_headers)
    mine = [
        e for e in body["items"] if e["action"] != "auth.sign_in" or e["actorName"] == "Desk Person"
    ]
    assert [e["action"] for e in mine][:5] == [
        "auth.sign_in_failed",
        "booking.phone_revealed",
        "booking.status_undone",
        "booking.status_changed",
        "auth.sign_in",
    ]
    times = [e["at"] for e in body["items"]]
    assert times == sorted(times, reverse=True)
    failed, revealed, undone, changed, _ = mine[:5]
    assert failed["outcome"] == "bad_credentials" and "actorName" not in failed
    assert revealed["actorName"] == "Clinic Owner" and revealed["actorRole"] == "admin"
    assert revealed["bookingReference"] == "AAAAAAAA02"
    assert (changed["fromStatus"], changed["toStatus"]) == ("confirmed", "arrived")
    assert (undone["fromStatus"], undone["toStatus"]) == ("arrived", "confirmed")
    assert all(
        e["networkTag"] == FINGERPRINT[:6] and len(e["networkTag"]) == 6 for e in body["items"]
    )
    assert body["page"] == 1 and body["pageSize"] == 25 and body["total"] >= 5


def test_filter_by_action_and_by_staff(
    cc_client: TestClient, db_session: Session, admin: m.StaffAccount, admin_headers: dict[str, str]
) -> None:
    desk = seed_feed(db_session, admin)
    only_changes = get_feed(cc_client, admin_headers, action="booking.status_changed")
    assert [e["action"] for e in only_changes["items"]] == ["booking.status_changed"]
    assert only_changes["total"] == 1
    by_desk = get_feed(cc_client, admin_headers, staffId=str(desk.id))
    assert [e["action"] for e in by_desk["items"]] == [
        "booking.status_undone",
        "booking.status_changed",
        "auth.sign_in",
    ]
    both = get_feed(cc_client, admin_headers, staffId=str(desk.id), action="auth.sign_in")
    assert both["total"] == 1


def test_an_unknown_action_or_a_bad_staff_id_or_page_is_a_422(
    cc_client: TestClient, admin_headers: dict[str, str]
) -> None:
    for params in ({"action": "not.an_action"}, {"staffId": "nope"}, {"page": 0}, {"page": "x"}):
        answer = cc_client.get(f"{API}/activity", params=params, headers=admin_headers)
        assert answer.status_code == 422, params


def test_paging_is_25_a_page_and_the_last_page_is_short(
    cc_client: TestClient, db_session: Session, admin: m.StaffAccount, admin_headers: dict[str, str]
) -> None:
    for i in range(30):
        event(db_session, "auth.sign_out", i + 1, admin)
    db_session.commit()
    first = get_feed(cc_client, admin_headers, action="auth.sign_out")
    second = get_feed(cc_client, admin_headers, action="auth.sign_out", page=2)
    assert (first["total"], len(first["items"]), len(second["items"])) == (30, 25, 5)
    assert first["items"][-1]["at"] > second["items"][0]["at"]
    assert not {e["id"] for e in first["items"]} & {e["id"] for e in second["items"]}
    empty = get_feed(cc_client, admin_headers, action="auth.sign_out", page=3)
    assert empty["items"] == [] and empty["total"] == 30


def test_a_receptionist_gets_403_and_nobody_unsigned_gets_in(
    cc_client: TestClient, receptionist_headers: dict[str, str]
) -> None:
    answer = cc_client.get(f"{API}/activity", headers=receptionist_headers)
    assert answer.status_code == 403
    assert answer.json()["error"]["code"] == "forbidden"
    assert cc_client.get(f"{API}/activity", headers=headers()).status_code == 401


def test_no_password_phone_email_name_or_reason_is_in_any_entry(
    cc_client: TestClient, db_session: Session, admin: m.StaffAccount, admin_headers: dict[str, str]
) -> None:
    seed_feed(db_session, admin)
    text = cc_client.get(f"{API}/activity", headers=admin_headers).text
    allowed = {
        "id", "at", "action", "outcome", "actorName", "actorRole", "bookingReference",
        "fromStatus", "toStatus", "networkTag", "isSample",
    }  # fmt: skip
    for entry in json.loads(text)["items"]:
        assert set(entry) <= allowed
    for secret in (
        "owner@example.org",
        "desk@example.org",
        "reception@example.org",
        "+92",
        "0300",
        FINGERPRINT,
    ):
        assert secret not in text
    assert "password" not in text.lower()


def test_the_demo_sees_only_the_synthetic_feed(
    cc_client: TestClient, db_session: Session, admin: m.StaffAccount, demo_headers: dict[str, str]
) -> None:
    seed_feed(db_session, admin)  # real events the demo must never show
    body = get_feed(cc_client, demo_headers)
    assert body["total"] > 20 and len(body["items"]) == 25
    assert all(e["isSample"] is True for e in body["items"])
    names = {e["actorName"] for e in body["items"]}
    assert "Clinic Owner" not in names and "Desk Person" not in names
    assert all(len(e["networkTag"]) == 6 for e in body["items"])
    assert [e["at"] for e in body["items"]] == sorted(
        (e["at"] for e in body["items"]), reverse=True
    )
    assert get_feed(cc_client, demo_headers) == body
    filtered = get_feed(cc_client, demo_headers, action="auth.sign_in")
    assert filtered["items"] and {e["action"] for e in filtered["items"]} == {"auth.sign_in"}
    some = body["items"][0]["actorName"]
    staff = cc_client.get(f"{API}/staff", headers=demo_headers).json()
    who = next(s for s in staff if s["displayName"] == some)
    mine = get_feed(cc_client, demo_headers, staffId=who["id"])
    assert mine["items"] and {e["actorName"] for e in mine["items"]} == {some}
