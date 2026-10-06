"""Session lifetime and ending, through the real endpoints (frozen clock)."""

from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, col, select

from app import models as m
from app.auth import sessions
from app.settings import Settings
from tests.api.admin_support import (
    API,
    FP,
    NEW_PASSWORD,
    PASSWORD,
    csrf_for,
    error_code,
    headers,
    make_staff,
    sign_in,
    staff_session,
)
from tests.conftest import FROZEN_NOW, FrozenClock

pytestmark = pytest.mark.db

ME = f"{API}/auth/me"


def audit_actions(db: Session, action: str) -> list[m.AuditLog]:
    return list(db.exec(select(m.AuditLog).where(col(m.AuditLog.action) == action)).all())


def test_idle_31_minutes_is_session_expired_with_one_audit_row(
    cc_client: TestClient, db_session: Session, cc_clock: FrozenClock
) -> None:
    token = sign_in(cc_client, make_staff(db_session).email).json()["token"]
    cc_clock.set(FROZEN_NOW + timedelta(minutes=31))
    first = cc_client.get(ME, headers=headers(token))
    assert (first.status_code, error_code(first)) == (401, "session_expired")
    assert error_code(cc_client.get(ME, headers=headers(token))) == "not_signed_in"
    assert len(audit_actions(db_session, "auth.session_expired")) == 1


def test_absolute_12h_1min_is_a_401_even_when_kept_busy(
    cc_client: TestClient, db_session: Session, cc_clock: FrozenClock
) -> None:
    token = sign_in(cc_client, make_staff(db_session).email).json()["token"]
    minutes = 0
    while minutes + 25 < 12 * 60:
        minutes += 25
        cc_clock.set(FROZEN_NOW + timedelta(minutes=minutes))
        assert cc_client.get(ME, headers=headers(token)).status_code == 200
    cc_clock.set(FROZEN_NOW + timedelta(hours=12, minutes=1))
    assert cc_client.get(ME, headers=headers(token)).status_code == 401
    assert db_session.exec(select(m.StaffSession)).one().end_reason == "absolute"


def test_sign_out_ends_the_session_on_the_server_and_audits_once(
    cc_client: TestClient, db_session: Session
) -> None:
    make_staff(db_session)
    issued = sign_in(cc_client, "owner@example.org").json()
    token, csrf = issued["token"], issued["viewer"]["csrfToken"]
    out = cc_client.post(f"{API}/auth/sign-out", headers=headers(token, csrf))
    assert out.status_code == 204
    assert cc_client.get(ME, headers=headers(token)).status_code == 401
    row = db_session.exec(select(m.StaffSession)).one()
    assert row.end_reason == "sign_out"
    assert len(audit_actions(db_session, "auth.sign_out")) == 1
    # The same token cannot sign out twice.
    assert cc_client.post(f"{API}/auth/sign-out", headers=headers(token, csrf)).status_code == 401
    assert len(audit_actions(db_session, "auth.sign_out")) == 1


def test_sign_out_needs_the_csrf_token(cc_client: TestClient, db_session: Session) -> None:
    make_staff(db_session)
    token = sign_in(cc_client, "owner@example.org").json()["token"]
    refused = cc_client.post(f"{API}/auth/sign-out", headers=headers(token))
    assert (refused.status_code, error_code(refused)) == (403, "csrf_failed")
    assert cc_client.get(ME, headers=headers(token)).status_code == 200


def test_a_fourth_session_evicts_the_oldest(
    cc_client: TestClient, db_session: Session, cc_clock: FrozenClock
) -> None:
    make_staff(db_session)
    issued: list[str] = []
    for minute in range(4):
        cc_clock.set(FROZEN_NOW + timedelta(minutes=minute))
        issued.append(sign_in(cc_client, "owner@example.org").json()["token"])
    codes = [cc_client.get(ME, headers=headers(t)).status_code for t in issued]
    assert codes == [401, 200, 200, 200]
    reasons = sorted(r.end_reason or "" for r in db_session.exec(select(m.StaffSession)).all())
    assert reasons == ["", "", "", "evicted"]


def test_password_change_ends_every_session_and_issues_a_fresh_one(
    cc_client: TestClient, db_session: Session, cc_settings: Settings, cc_clock: FrozenClock
) -> None:
    staff = make_staff(db_session)
    other, other_token, _ = staff_session(db_session, cc_settings, staff, cc_clock.now())
    issued = sign_in(cc_client, "owner@example.org").json()
    token, csrf = issued["token"], issued["viewer"]["csrfToken"]
    changed = cc_client.post(
        f"{API}/auth/change-password",
        json={"currentPassword": PASSWORD, "newPassword": NEW_PASSWORD},
        headers=headers(token, csrf),
    )
    assert changed.status_code == 200
    body = changed.json()
    assert body["token"] not in {token, other_token}
    assert cc_client.get(ME, headers=headers(token)).status_code == 401
    assert cc_client.get(ME, headers=other).status_code == 401
    assert cc_client.get(ME, headers=headers(body["token"])).status_code == 200
    assert body["viewer"]["mustChangePassword"] is False
    assert len(audit_actions(db_session, "auth.password_changed")) == 1
    assert sign_in(cc_client, "owner@example.org", NEW_PASSWORD).status_code == 200
    assert sign_in(cc_client, "owner@example.org", PASSWORD).status_code == 401


@pytest.mark.parametrize(
    ("new_password", "reason"),
    [
        ("short-1", "too_short"),
        ("password1234", "too_common"),
        ("owner-is-my-name-1", "contains_email"),
        (PASSWORD, "same_as_current"),
    ],
)
def test_change_password_enforces_the_policy(
    cc_client: TestClient, db_session: Session, new_password: str, reason: str
) -> None:
    make_staff(db_session)
    issued = sign_in(cc_client, "owner@example.org").json()
    response = cc_client.post(
        f"{API}/auth/change-password",
        json={"currentPassword": PASSWORD, "newPassword": new_password},
        headers=headers(issued["token"], issued["viewer"]["csrfToken"]),
    )
    if reason == "too_short":
        assert response.status_code == 422  # below the schema minimum
    else:
        assert (response.status_code, error_code(response)) == (422, "weak_password")
        assert response.json()["reason"] == reason


def test_change_password_needs_the_current_password(
    cc_client: TestClient, db_session: Session
) -> None:
    make_staff(db_session)
    issued = sign_in(cc_client, "owner@example.org").json()
    response = cc_client.post(
        f"{API}/auth/change-password",
        json={"currentPassword": "not-the-password-1", "newPassword": NEW_PASSWORD},
        headers=headers(issued["token"], issued["viewer"]["csrfToken"]),
    )
    assert (response.status_code, error_code(response)) == (422, "validation_error")
    assert response.json()["error"]["details"][0]["field"] == "currentPassword"
    assert cc_client.get(ME, headers=headers(issued["token"])).status_code == 200


def test_a_demo_viewer_cannot_change_a_password(
    cc_client: TestClient, db_session: Session, cc_settings: Settings, cc_clock: FrozenClock
) -> None:
    token, row = sessions.create_demo_session(
        db_session, cc_settings, FROZEN_NOW.date(), FP, cc_clock.now()
    )
    response = cc_client.post(
        f"{API}/auth/change-password",
        json={"currentPassword": PASSWORD, "newPassword": NEW_PASSWORD},
        headers=headers(token, csrf_for(cc_settings, row.id)),
    )
    assert (response.status_code, error_code(response)) == (403, "demo_read_only")


def test_must_change_password_blocks_read_routes_but_not_me_or_the_change(
    cc_client: TestClient, db_session: Session
) -> None:
    make_staff(db_session, must_change_password=True)
    issued = sign_in(cc_client, "owner@example.org").json()
    assert issued["viewer"]["mustChangePassword"] is True
    token = issued["token"]
    blocked = cc_client.get(f"{API}/staff", headers=headers(token))
    assert (blocked.status_code, error_code(blocked)) == (403, "password_change_required")
    assert cc_client.get(ME, headers=headers(token)).status_code == 200
    done = cc_client.post(
        f"{API}/auth/change-password",
        json={"currentPassword": PASSWORD, "newPassword": NEW_PASSWORD},
        headers=headers(token, issued["viewer"]["csrfToken"]),
    )
    assert done.status_code == 200
    assert cc_client.get(f"{API}/staff", headers=headers(done.json()["token"])).status_code == 200


def test_deactivation_ends_all_sessions_at_once(
    cc_client: TestClient, db_session: Session, cc_settings: Settings, cc_clock: FrozenClock
) -> None:
    staff = make_staff(db_session, "temp@example.org", "receptionist")
    victim, _, _ = staff_session(db_session, cc_settings, staff, cc_clock.now())
    admin = make_staff(db_session, "owner@example.org")
    actor, _, _ = staff_session(db_session, cc_settings, admin, cc_clock.now())
    response = cc_client.patch(f"{API}/staff/{staff.id}", json={"isActive": False}, headers=actor)
    assert response.status_code == 200
    assert cc_client.get(ME, headers=victim).status_code == 401
    assert sign_in(cc_client, "temp@example.org").status_code == 401
