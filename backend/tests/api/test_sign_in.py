"""POST /admin/auth/sign-in: sessions without fixation, a generic failure, lockout, IP limit."""

import time
from collections.abc import Callable
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
)
from tests.conftest import FROZEN_NOW, FrozenClock, override_clock

pytestmark = pytest.mark.db


def audit_rows(db: Session, action: str) -> list[m.AuditLog]:
    return list(db.exec(select(m.AuditLog).where(col(m.AuditLog.action) == action)).all())


def test_success_issues_a_new_session_and_the_viewer(
    cc_client: TestClient, db_session: Session, cc_settings: Settings
) -> None:
    staff = make_staff(db_session)
    response = sign_in(cc_client, " Owner@Example.ORG ")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    body = response.json()
    assert body["token"].startswith("cs_")
    viewer = body["viewer"]
    assert viewer["kind"] == "staff" and viewer["role"] == "admin"
    assert viewer["displayName"] == "Clinic Owner" and viewer["mustChangePassword"] is False
    assert viewer["clinicToday"] == "2026-10-05"
    row = db_session.exec(select(m.StaffSession)).one()
    assert viewer["csrfToken"] == csrf_for(cc_settings, row.id)
    db_session.refresh(staff)
    assert staff.last_sign_in_at == FROZEN_NOW
    me = cc_client.get(f"{API}/auth/me", headers=headers(body["token"]))
    assert me.status_code == 200


def test_a_presented_token_is_replaced_not_reused(
    cc_client: TestClient, db_session: Session, cc_settings: Settings, cc_clock: FrozenClock
) -> None:
    staff = make_staff(db_session)
    old, old_row = sessions.create_staff_session(db_session, cc_settings, staff, FP, cc_clock.now())
    response = sign_in(cc_client, "owner@example.org", **{"X-Session-Token": old})
    assert response.status_code == 200
    assert response.json()["token"] != old
    db_session.refresh(old_row)
    assert old_row.ended_at is not None and old_row.end_reason == "replaced"
    assert cc_client.get(f"{API}/auth/me", headers=headers(old)).status_code == 401


def test_a_presented_demo_token_is_ended_by_sign_in(
    cc_client: TestClient, db_session: Session, cc_settings: Settings, cc_clock: FrozenClock
) -> None:
    make_staff(db_session)
    demo, _ = sessions.create_demo_session(
        db_session, cc_settings, FROZEN_NOW.date(), FP, cc_clock.now()
    )
    cc_clock.set(cc_clock.now() + timedelta(seconds=1))
    assert sign_in(cc_client, "owner@example.org", **{"X-Session-Token": demo}).status_code == 200
    assert cc_client.get(f"{API}/auth/me", headers=headers(demo)).status_code == 401


@pytest.mark.parametrize("case", ["unknown", "wrong", "inactive"])
def test_every_failure_is_the_same_generic_answer(
    cc_client: TestClient, db_session: Session, case: str
) -> None:
    make_staff(db_session, "owner@example.org")
    make_staff(db_session, "gone@example.org", is_active=False)
    email, password = {
        "unknown": ("nobody@example.org", PASSWORD),
        "wrong": ("owner@example.org", "not-the-password-1"),
        "inactive": ("gone@example.org", PASSWORD),
    }[case]
    response = sign_in(cc_client, email, password)
    assert response.status_code == 401
    error = response.json()["error"]
    error.pop("requestId", None)
    assert error == {"code": "sign_in_failed", "message": "Email or password is incorrect."}


def test_failures_take_about_as_long_whatever_went_wrong(
    cc_client: TestClient, db_session: Session
) -> None:
    make_staff(db_session)

    def timed(email: str) -> float:
        started = time.perf_counter()
        sign_in(cc_client, email, "not-the-password-1")
        return time.perf_counter() - started

    timed("owner@example.org")  # warm up
    unknown = min(timed("nobody-1@example.org"), timed("nobody-2@example.org"))
    known = min(timed("owner@example.org"), timed("owner@example.org"))
    assert 0.3 < unknown / known < 3


def test_five_failures_in_fifteen_minutes_lock_for_fifteen_minutes(
    cc_client: TestClient, db_session: Session, cc_clock: FrozenClock
) -> None:
    make_staff(db_session)
    for _ in range(4):
        assert error_code(sign_in(cc_client, "owner@example.org", "wrong-password-1")) == (
            "sign_in_failed"
        )
    fifth = sign_in(cc_client, "owner@example.org", "wrong-password-1")
    assert (fifth.status_code, error_code(fifth)) == (429, "account_locked")
    assert fifth.json()["error"]["retryAfterSeconds"] == 900
    # Even the right password is refused while locked, with the same generic message.
    locked = sign_in(cc_client, "owner@example.org")
    assert (locked.status_code, error_code(locked)) == (429, "account_locked")
    assert locked.headers["retry-after"] == "900"
    cc_clock.set(FROZEN_NOW + timedelta(minutes=14))
    assert sign_in(cc_client, "owner@example.org").status_code == 429
    cc_clock.set(FROZEN_NOW + timedelta(minutes=15))
    assert sign_in(cc_client, "owner@example.org").status_code == 200


def test_an_unknown_email_locks_the_same_way(cc_client: TestClient, db_session: Session) -> None:
    for _ in range(5):
        response = sign_in(cc_client, "ghost@example.org", "wrong-password-1")
    assert error_code(response) == "account_locked"


def test_a_success_clears_the_failure_count(cc_client: TestClient, db_session: Session) -> None:
    make_staff(db_session)
    for _ in range(4):
        sign_in(cc_client, "owner@example.org", "wrong-password-1")
    assert sign_in(cc_client, "owner@example.org").status_code == 200
    for _ in range(4):
        assert error_code(sign_in(cc_client, "owner@example.org", "wrong-password-1")) == (
            "sign_in_failed"
        )


def test_the_per_ip_limit_answers_429(
    make_client: Callable[..., TestClient], db_session: Session, cc_clock: FrozenClock
) -> None:
    client = make_client(login_limit_per_ip_per_15min=3)
    override_clock(client.app, cc_clock)  # type: ignore[arg-type]
    make_staff(db_session)
    codes = [sign_in(client, f"user{n}@example.org").status_code for n in range(4)]
    assert codes == [401, 401, 401, 429]


def test_audit_rows_name_no_email_or_password(cc_client: TestClient, db_session: Session) -> None:
    staff = make_staff(db_session)
    sign_in(cc_client, "owner@example.org", "wrong-password-1")
    for _ in range(4):
        sign_in(cc_client, "owner@example.org", "wrong-password-1")
    cc_client.post(
        f"{API}/auth/sign-in",
        json={"email": "owner@example.org", "password": PASSWORD},
        headers=headers(),
    )
    failed = audit_rows(db_session, "auth.sign_in_failed")
    assert len(failed) == 6  # 5 wrong passwords and one refused while locked
    assert {row.outcome for row in failed} == {"bad_credentials", "locked"}
    assert len(audit_rows(db_session, "auth.lockout")) == 1
    assert audit_rows(db_session, "auth.sign_in") == []
    for row in db_session.exec(select(m.AuditLog)).all():
        dumped = " ".join(str(v) for v in row.model_dump().values())
        assert "example.org" not in dumped and PASSWORD not in dumped
        assert row.actor_staff_id is None  # a failure never names the account
    assert staff.id is not None


def test_a_success_writes_one_sign_in_audit_row(cc_client: TestClient, db_session: Session) -> None:
    staff = make_staff(db_session)
    sign_in(cc_client, "owner@example.org")
    (row,) = audit_rows(db_session, "auth.sign_in")
    assert row.actor_staff_id == staff.id and row.actor_role == "admin" and row.outcome == "ok"


def test_the_proxy_secret_is_required(cc_client: TestClient, db_session: Session) -> None:
    make_staff(db_session)
    body = {"email": "owner@example.org", "password": PASSWORD}
    assert cc_client.post(f"{API}/auth/sign-in", json=body).status_code == 403
    foreign = headers(Origin="https://evil.example")
    assert cc_client.post(f"{API}/auth/sign-in", json=body, headers=foreign).status_code == 403


def test_oversize_fields_are_validation_errors_not_hashed(
    cc_client: TestClient, db_session: Session
) -> None:
    response = sign_in(cc_client, "owner@example.org", "x" * 129)
    assert response.status_code == 422
    assert NEW_PASSWORD not in response.text
