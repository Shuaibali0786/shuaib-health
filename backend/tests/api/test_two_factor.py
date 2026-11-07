"""Two-step sign-in (Feature 011): setup, sign-in with a code or backup code, recovery, management.

Every test runs against the transactional test database with a frozen clock and a test-only
``TWO_FACTOR_KEY``. No code, secret or password may appear in an audit row or a log line.
"""

import base64
import logging
import secrets
from collections.abc import Callable
from datetime import timedelta
from typing import cast

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, col, select

from app import models as m
from app.auth import secretbox, totp, two_factor
from app.auth.create_admin import RESET_DONE, RESET_NOTHING, main
from app.settings import Settings
from tests.api.admin_support import (
    API,
    PASSWORD,
    error_code,
    headers,
    make_staff,
    sign_in,
    staff_session,
)
from tests.conftest import FrozenClock, SettingsFactory, override_clock

pytestmark = pytest.mark.db

KEY = secrets.token_bytes(32)
KEY_B64 = base64.b64encode(KEY).decode()


@pytest.fixture
def tf_settings(settings_factory: SettingsFactory) -> Settings:
    return settings_factory(two_factor_key=KEY_B64)


@pytest.fixture
def tf_client(make_client: Callable[..., TestClient], cc_clock: FrozenClock) -> TestClient:
    client = make_client(two_factor_key=KEY_B64)
    override_clock(client.app, cc_clock)  # type: ignore[arg-type]
    return client


def actions(db: Session) -> list[str]:
    rows = db.exec(select(m.AuditLog).order_by(col(m.AuditLog.occurred_at))).all()
    return [row.action for row in rows]


def enrol(db: Session, staff: m.StaffAccount, clock: FrozenClock) -> tuple[bytes, list[str]]:
    """Put ``staff`` straight into the "on" state; returns the secret and the backup codes."""
    assert staff.id is not None
    secret = totp.new_secret()
    staff.totp_secret_encrypted = secretbox.encrypt(KEY, staff.id, secret)
    staff.totp_enabled_at = clock.now() - timedelta(days=1)
    staff.password_changed_at = clock.now() - timedelta(days=2)
    codes = two_factor._new_backup_codes(db, KEY, staff.id)
    db.flush()
    return secret, codes


def code_now(secret: bytes, clock: FrozenClock, offset_steps: int = 0) -> str:
    return totp.code_at(secret, clock.now().timestamp() + offset_steps * totp.PERIOD)


def challenge(client: TestClient, email: str = "owner@example.org") -> str:
    response = sign_in(client, email)
    assert response.status_code == 202, response.text
    body = response.json()
    assert body["twoFactorRequired"] is True and "token" not in body
    assert response.headers["cache-control"] == "no-store"
    token: str = body["challengeToken"]
    return token


def verify(client: TestClient, token: str, **factor: str):  # type: ignore[no-untyped-def]
    return client.post(
        f"{API}/auth/sign-in/two-factor",
        json={"challengeToken": token, **factor},
        headers=headers(),
    )


# --- US2: sign-in -----------------------------------------------------------------------------


def test_password_alone_issues_no_session_and_a_code_finishes_sign_in(
    tf_client: TestClient, db_session: Session, cc_clock: FrozenClock
) -> None:
    staff = make_staff(db_session)
    secret, _ = enrol(db_session, staff, cc_clock)
    token = challenge(tf_client)
    assert db_session.exec(select(m.StaffSession)).all() == []
    response = verify(tf_client, token, code=code_now(secret, cc_clock))
    assert response.status_code == 200, response.text
    assert response.json()["token"].startswith("cs_")
    assert len(db_session.exec(select(m.StaffSession)).all()) == 1
    assert actions(db_session)[-2:] == ["auth.two_factor_challenge", "auth.sign_in"]
    # The challenge is used up.
    assert error_code(verify(tf_client, token, code=code_now(secret, cc_clock))) == (
        "challenge_expired"
    )


def test_accounts_without_two_factor_sign_in_as_before(
    tf_client: TestClient, db_session: Session
) -> None:
    make_staff(db_session)
    assert sign_in(tf_client, "owner@example.org").status_code == 200


@pytest.mark.parametrize("offset", [-1, 1])
def test_adjacent_steps_are_accepted(
    tf_client: TestClient, db_session: Session, cc_clock: FrozenClock, offset: int
) -> None:
    secret, _ = enrol(db_session, make_staff(db_session), cc_clock)
    assert (
        verify(tf_client, challenge(tf_client), code=code_now(secret, cc_clock, offset)).status_code
        == 200
    )


def test_a_code_two_steps_away_is_refused_and_attempts_count_down(
    tf_client: TestClient, db_session: Session, cc_clock: FrozenClock
) -> None:
    secret, _ = enrol(db_session, make_staff(db_session), cc_clock)
    token = challenge(tf_client)
    response = verify(tf_client, token, code=code_now(secret, cc_clock, 2))
    assert response.status_code == 401
    assert error_code(response) == "two_factor_failed"
    assert response.json()["attemptsLeft"] == 4
    assert "auth.two_factor_failed" in actions(db_session)


def test_a_replayed_code_is_refused(
    tf_client: TestClient, db_session: Session, cc_clock: FrozenClock
) -> None:
    secret, _ = enrol(db_session, make_staff(db_session), cc_clock)
    code = code_now(secret, cc_clock)
    assert verify(tf_client, challenge(tf_client), code=code).status_code == 200
    assert error_code(verify(tf_client, challenge(tf_client), code=code)) == "two_factor_failed"


def test_five_wrong_codes_end_the_challenge(
    tf_client: TestClient, db_session: Session, cc_clock: FrozenClock
) -> None:
    secret, _ = enrol(db_session, make_staff(db_session), cc_clock)
    token = challenge(tf_client)
    wrong = "000000" if code_now(secret, cc_clock) != "000000" else "111111"
    codes = [error_code(verify(tf_client, token, code=wrong)) for _ in range(5)]
    assert codes[:4] == ["two_factor_failed"] * 4
    assert codes[4] in {"challenge_expired", "account_locked"}
    assert error_code(verify(tf_client, token, code=code_now(secret, cc_clock))) in {
        "challenge_expired",
        "account_locked",
    }


def test_wrong_codes_share_the_password_lockout(
    tf_client: TestClient, db_session: Session, cc_clock: FrozenClock, tf_settings: Settings
) -> None:
    enrol(db_session, make_staff(db_session), cc_clock)
    results = []
    for _ in range(tf_settings.login_lock_failures):
        results.append(error_code(verify(tf_client, challenge(tf_client), code="000000")))
    assert results[-1] == "account_locked"
    assert "auth.lockout" in actions(db_session)
    # Locked: even the right password is refused now.
    assert error_code(sign_in(tf_client, "owner@example.org")) == "account_locked"


def test_re_entering_the_password_does_not_reset_the_failure_count(
    tf_client: TestClient, db_session: Session, cc_clock: FrozenClock, tf_settings: Settings
) -> None:
    enrol(db_session, make_staff(db_session), cc_clock)
    for _ in range(tf_settings.login_lock_failures - 1):
        verify(tf_client, challenge(tf_client), code="000000")
    # One more wrong code after a fresh, correct password still locks the account.
    assert error_code(verify(tf_client, challenge(tf_client), code="000000")) == "account_locked"


def test_an_expired_challenge_is_refused(
    tf_client: TestClient, db_session: Session, cc_clock: FrozenClock
) -> None:
    secret, _ = enrol(db_session, make_staff(db_session), cc_clock)
    token = challenge(tf_client)
    cc_clock.set(cc_clock.now() + timedelta(minutes=5, seconds=1))
    assert error_code(verify(tf_client, token, code=code_now(secret, cc_clock))) == (
        "challenge_expired"
    )


def test_deactivation_or_password_reset_during_the_step_ends_it(
    tf_client: TestClient, db_session: Session, cc_clock: FrozenClock
) -> None:
    staff = make_staff(db_session)
    secret, _ = enrol(db_session, staff, cc_clock)
    token = challenge(tf_client)
    staff.password_changed_at = cc_clock.now() + timedelta(seconds=1)
    db_session.flush()
    cc_clock.set(cc_clock.now() + timedelta(seconds=2))
    assert error_code(verify(tf_client, token, code=code_now(secret, cc_clock))) == (
        "challenge_expired"
    )
    token = challenge(tf_client)
    staff.is_active = False
    db_session.flush()
    assert error_code(verify(tf_client, token, code=code_now(secret, cc_clock))) == (
        "challenge_expired"
    )


def test_a_backup_code_works_once(
    tf_client: TestClient, db_session: Session, cc_clock: FrozenClock
) -> None:
    _, codes = enrol(db_session, make_staff(db_session), cc_clock)
    assert verify(tf_client, challenge(tf_client), backupCode=codes[0].lower()).status_code == 200
    assert "auth.backup_code_used" in actions(db_session)
    assert error_code(verify(tf_client, challenge(tf_client), backupCode=codes[0])) == (
        "two_factor_failed"
    )
    assert verify(tf_client, challenge(tf_client), backupCode=codes[1]).status_code == 200


def test_code_and_backup_code_together_or_neither_is_a_422(
    tf_client: TestClient, db_session: Session, cc_clock: FrozenClock
) -> None:
    secret, codes = enrol(db_session, make_staff(db_session), cc_clock)
    token = challenge(tf_client)
    assert verify(tf_client, token).status_code == 422
    assert (
        verify(tf_client, token, code=code_now(secret, cc_clock), backupCode=codes[0]).status_code
        == 422
    )


def test_without_the_key_an_enrolled_account_can_never_sign_in_with_the_password_alone(
    make_client: Callable[..., TestClient], db_session: Session, cc_clock: FrozenClock
) -> None:
    secret, _ = enrol(db_session, make_staff(db_session), cc_clock)
    client = make_client()  # no TWO_FACTOR_KEY
    override_clock(client.app, cc_clock)  # type: ignore[arg-type]
    token = challenge(client)
    response = verify(client, token, code=code_now(secret, cc_clock))
    assert response.status_code == 503
    assert error_code(response) == "two_factor_unavailable"
    assert db_session.exec(select(m.StaffSession)).all() == []


def test_a_forged_or_unknown_challenge_is_refused(tf_client: TestClient) -> None:
    for token in ("", "cs_not-a-challenge", "shc_" + "x" * 43):
        assert error_code(verify(tf_client, token, code="123456")) in {
            "challenge_expired",
            "validation_error",
        }


# --- US1: setup -------------------------------------------------------------------------------


def test_an_admin_enrols_with_password_and_a_code(
    tf_client: TestClient,
    db_session: Session,
    tf_settings: Settings,
    cc_clock: FrozenClock,
    caplog: pytest.LogCaptureFixture,
) -> None:
    caplog.set_level(logging.DEBUG)
    staff = make_staff(db_session)
    auth, _, _ = staff_session(db_session, tf_settings, staff, cc_clock.now())
    status = tf_client.get(f"{API}/auth/two-factor", headers=auth).json()
    assert status == {"available": True, "enabled": False, "canEnrol": True}

    assert (
        tf_client.post(
            f"{API}/auth/two-factor/setup", json={"currentPassword": "wrong"}, headers=auth
        ).status_code
        == 422
    )
    setup = tf_client.post(
        f"{API}/auth/two-factor/setup", json={"currentPassword": PASSWORD}, headers=auth
    )
    assert setup.status_code == 200, setup.text
    body = setup.json()
    assert body["otpauthUri"].startswith("otpauth://totp/") and body["secret"] in body["otpauthUri"]
    secret = base64.b32decode(body["secret"] + "=" * (-len(body["secret"]) % 8))
    db_session.refresh(staff)
    assert (
        staff.totp_secret_encrypted is not None
        and body["secret"] not in staff.totp_secret_encrypted
    )
    assert staff.totp_enabled_at is None

    # Starting again (e.g. after Cancel) issues a brand-new key; the old one no longer works.
    again = tf_client.post(
        f"{API}/auth/two-factor/setup", json={"currentPassword": PASSWORD}, headers=auth
    )
    assert again.json()["secret"] != body["secret"]
    old_secret = secret
    body = again.json()
    secret = base64.b32decode(body["secret"] + "=" * (-len(body["secret"]) % 8))
    assert (
        tf_client.post(
            f"{API}/auth/two-factor/enable",
            json={"code": code_now(old_secret, cc_clock)},
            headers=auth,
        ).status_code
        == 422
    )
    assert (
        tf_client.post(
            f"{API}/auth/two-factor/enable", json={"code": "000000"}, headers=auth
        ).status_code
        == 422
    )

    enabled = tf_client.post(
        f"{API}/auth/two-factor/enable", json={"code": code_now(secret, cc_clock)}, headers=auth
    )
    assert enabled.status_code == 200, enabled.text
    codes = enabled.json()["backupCodes"]
    assert len(codes) == 10 and len(set(codes)) == 10
    stored = db_session.exec(select(m.StaffBackupCode)).all()
    assert len(stored) == 10 and not {row.code_hash for row in stored} & set(codes)
    assert "auth.two_factor_enabled" in actions(db_session)
    status = tf_client.get(f"{API}/auth/two-factor", headers=auth).json()
    assert status["enabled"] is True and status["backupCodesLeft"] == 10

    leaked = [body["secret"], PASSWORD, *codes]
    for record in caplog.records:
        message = record.getMessage() + str(record.__dict__)
        assert not any(value in message for value in leaked)


def test_every_setup_start_issues_a_fresh_secret_even_after_turning_it_off(
    tf_client: TestClient, db_session: Session, tf_settings: Settings, cc_clock: FrozenClock
) -> None:
    staff = make_staff(db_session)
    auth, _, _ = staff_session(db_session, tf_settings, staff, cc_clock.now())

    def start() -> bytes:
        body = tf_client.post(
            f"{API}/auth/two-factor/setup", json={"currentPassword": PASSWORD}, headers=auth
        ).json()
        return base64.b32decode(body["secret"] + "=" * (-len(body["secret"]) % 8))

    first, second = start(), start()
    assert first != second
    refused = tf_client.post(
        f"{API}/auth/two-factor/enable", json={"code": code_now(first, cc_clock)}, headers=auth
    )
    assert refused.status_code == 422 and staff.totp_enabled_at is None
    enabled = tf_client.post(
        f"{API}/auth/two-factor/enable", json={"code": code_now(second, cc_clock)}, headers=auth
    )
    assert enabled.status_code == 200, enabled.text

    # Off, then on again: a third, different secret; the second no longer works.
    off = tf_client.post(
        f"{API}/auth/two-factor/disable",
        json={"currentPassword": PASSWORD, "code": code_now(second, cc_clock, 1)},
        headers=auth,
    )
    assert off.status_code == 204, off.text
    third = start()
    assert third not in (first, second)
    stale = tf_client.post(
        f"{API}/auth/two-factor/enable", json={"code": code_now(second, cc_clock)}, headers=auth
    )
    assert stale.status_code == 422


def test_setup_refusals(
    make_client: Callable[..., TestClient],
    tf_client: TestClient,
    db_session: Session,
    tf_settings: Settings,
    cc_clock: FrozenClock,
) -> None:
    receptionist = make_staff(db_session, email="desk@example.org", role="receptionist")
    auth, _, _ = staff_session(db_session, tf_settings, receptionist, cc_clock.now())
    response = tf_client.post(
        f"{API}/auth/two-factor/setup", json={"currentPassword": PASSWORD}, headers=auth
    )
    assert error_code(response) == "two_factor_admins_only"

    newcomer = make_staff(db_session, email="new@example.org", must_change_password=True)
    auth, _, _ = staff_session(db_session, tf_settings, newcomer, cc_clock.now())
    response = tf_client.post(
        f"{API}/auth/two-factor/setup", json={"currentPassword": PASSWORD}, headers=auth
    )
    assert error_code(response) == "password_change_required"

    admin = make_staff(db_session)
    auth, _, _ = staff_session(db_session, tf_settings, admin, cc_clock.now())
    keyless = make_client()
    override_clock(keyless.app, cc_clock)  # type: ignore[arg-type]
    assert keyless.get(f"{API}/auth/two-factor", headers=auth).json()["available"] is False
    response = keyless.post(
        f"{API}/auth/two-factor/setup", json={"currentPassword": PASSWORD}, headers=auth
    )
    assert error_code(response) == "two_factor_unavailable"


def test_enable_after_the_setup_went_stale_asks_to_start_again(
    tf_client: TestClient, db_session: Session, tf_settings: Settings, cc_clock: FrozenClock
) -> None:
    staff = make_staff(db_session)
    auth, _, _ = staff_session(db_session, tf_settings, staff, cc_clock.now())
    body = tf_client.post(
        f"{API}/auth/two-factor/setup", json={"currentPassword": PASSWORD}, headers=auth
    ).json()
    secret = base64.b32decode(body["secret"] + "=" * (-len(body["secret"]) % 8))
    cc_clock.set(cc_clock.now() + timedelta(minutes=16))
    auth, _, _ = staff_session(db_session, tf_settings, staff, cc_clock.now())
    response = tf_client.post(
        f"{API}/auth/two-factor/enable", json={"code": code_now(secret, cc_clock)}, headers=auth
    )
    assert error_code(response) == "two_factor_not_started"


def test_the_demo_viewer_cannot_use_two_factor(
    tf_client: TestClient,
) -> None:
    demo = tf_client.post(f"{API}/demo/start", headers=headers()).json()
    auth = headers(demo["token"], demo["viewer"]["csrfToken"])
    assert error_code(tf_client.get(f"{API}/auth/two-factor", headers=auth)) == "demo_read_only"
    response = tf_client.post(
        f"{API}/auth/two-factor/setup", json={"currentPassword": PASSWORD}, headers=auth
    )
    assert error_code(response) == "demo_read_only"


# --- US3: recovery ----------------------------------------------------------------------------


def test_an_admin_resets_another_persons_two_factor(
    tf_client: TestClient, db_session: Session, tf_settings: Settings, cc_clock: FrozenClock
) -> None:
    admin = make_staff(db_session)
    other = make_staff(db_session, email="second@example.org", name="Second Admin")
    enrol(db_session, other, cc_clock)
    _, _, other_row = staff_session(db_session, tf_settings, other, cc_clock.now())
    auth, _, _ = staff_session(db_session, tf_settings, admin, cc_clock.now())

    listed = tf_client.get(f"{API}/staff", headers=auth).json()
    assert {s["email"]: s["twoFactorEnabled"] for s in listed} == {
        "owner@example.org": False,
        "second@example.org": True,
    }
    response = tf_client.post(f"{API}/staff/{other.id}/two-factor/reset", headers=auth)
    assert response.status_code == 204, response.text
    db_session.refresh(other)
    db_session.refresh(other_row)
    assert other.totp_enabled_at is None and other.totp_secret_encrypted is None
    assert other_row.end_reason == "two_factor_reset"
    assert db_session.exec(select(m.StaffBackupCode)).all() == []
    row = db_session.exec(
        select(m.AuditLog).where(col(m.AuditLog.action) == "staff.two_factor_reset")
    ).one()
    assert row.actor_staff_id == admin.id and row.target_id == other.id
    # The person signs in with the password alone again.
    assert sign_in(tf_client, "second@example.org").status_code == 200
    # Nothing left to reset; and nobody resets their own from Staff.
    response = tf_client.post(f"{API}/staff/{other.id}/two-factor/reset", headers=auth)
    assert error_code(response) == "two_factor_off"
    assert (
        error_code(tf_client.post(f"{API}/staff/{admin.id}/two-factor/reset", headers=auth))
        == "cannot_reset_self"
    )


def test_a_receptionist_cannot_reset(
    tf_client: TestClient, db_session: Session, tf_settings: Settings, cc_clock: FrozenClock
) -> None:
    admin = make_staff(db_session)
    enrol(db_session, admin, cc_clock)
    desk = make_staff(db_session, email="desk@example.org", role="receptionist")
    auth, _, _ = staff_session(db_session, tf_settings, desk, cc_clock.now())
    response = tf_client.post(f"{API}/staff/{admin.id}/two-factor/reset", headers=auth)
    assert response.status_code == 403


def test_the_operator_reset_turns_it_off_and_logs_a_system_action(
    db_session: Session, cc_clock: FrozenClock, capsys: pytest.CaptureFixture[str]
) -> None:
    staff = make_staff(db_session)
    enrol(db_session, staff, cc_clock)
    factory = lambda: cast(Session, _NoClose(db_session))  # noqa: E731
    assert (
        main(["--email", "OWNER@example.org", "--reset-two-factor"], session_factory=factory) == 0
    )
    assert capsys.readouterr().out.strip() == RESET_DONE
    db_session.refresh(staff)
    assert staff.totp_enabled_at is None
    row = db_session.exec(
        select(m.AuditLog).where(col(m.AuditLog.action) == "staff.two_factor_reset")
    ).one()
    assert row.actor_type == "system" and row.target_id == staff.id
    assert (
        main(["--email", "owner@example.org", "--reset-two-factor"], session_factory=factory) == 0
    )
    assert capsys.readouterr().out.strip() == RESET_NOTHING


class _NoClose:
    """Lets the CLI use the test's transactional session without closing it."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def __enter__(self) -> Session:
        return self.db

    def __exit__(self, *_: object) -> None:
        return None


# --- US4: turn off, new codes -----------------------------------------------------------------


def test_new_backup_codes_replace_the_old_ones(
    tf_client: TestClient, db_session: Session, tf_settings: Settings, cc_clock: FrozenClock
) -> None:
    staff = make_staff(db_session)
    secret, old = enrol(db_session, staff, cc_clock)
    auth, _, _ = staff_session(db_session, tf_settings, staff, cc_clock.now())
    response = tf_client.post(
        f"{API}/auth/two-factor/backup-codes",
        json={"currentPassword": PASSWORD, "code": code_now(secret, cc_clock)},
        headers=auth,
    )
    assert response.status_code == 200, response.text
    new = response.json()["backupCodes"]
    assert len(new) == 10 and not set(new) & set(old)
    assert "auth.backup_codes_regenerated" in actions(db_session)
    assert error_code(verify(tf_client, challenge(tf_client), backupCode=old[0])) == (
        "two_factor_failed"
    )
    assert verify(tf_client, challenge(tf_client), backupCode=new[0]).status_code == 200


def test_turning_off_needs_the_password_and_a_code(
    tf_client: TestClient, db_session: Session, tf_settings: Settings, cc_clock: FrozenClock
) -> None:
    staff = make_staff(db_session)
    secret, codes = enrol(db_session, staff, cc_clock)
    auth, _, _ = staff_session(db_session, tf_settings, staff, cc_clock.now())
    url = f"{API}/auth/two-factor/disable"
    wrong_password = {"currentPassword": "nope", "code": code_now(secret, cc_clock)}
    assert tf_client.post(url, json=wrong_password, headers=auth).status_code == 422
    wrong_code = {"currentPassword": PASSWORD, "code": "000000"}
    assert tf_client.post(url, json=wrong_code, headers=auth).status_code == 422
    assert actions(db_session).count("auth.two_factor_failed") == 2
    db_session.refresh(staff)
    assert staff.totp_enabled_at is not None
    good = {"currentPassword": PASSWORD, "backupCode": codes[3]}
    assert tf_client.post(url, json=good, headers=auth).status_code == 204
    db_session.refresh(staff)
    assert staff.totp_enabled_at is None and staff.totp_secret_encrypted is None
    assert "auth.two_factor_disabled" in actions(db_session)
    assert sign_in(tf_client, "owner@example.org").status_code == 200


def test_audit_rows_never_hold_codes_or_secrets(
    tf_client: TestClient, db_session: Session, cc_clock: FrozenClock
) -> None:
    secret, codes = enrol(db_session, make_staff(db_session), cc_clock)
    token = challenge(tf_client)
    verify(tf_client, token, code="000000")
    verify(tf_client, token, backupCode=codes[0])
    text_of_rows = " ".join(
        str(row.model_dump()) for row in db_session.exec(select(m.AuditLog)).all()
    )
    for value in (*codes, codes[0].replace("-", ""), totp.to_base32(secret), token, "000000"):
        assert value not in text_of_rows
