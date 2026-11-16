"""``python -m app.auth.admin_access``: read-only status and a hidden-prompt reset of ONE admin."""

import io
from collections.abc import Callable
from contextlib import redirect_stdout
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import text
from sqlmodel import Session, col, select

from app import models as m
from app.auth import admin_access as cli
from app.auth import create_admin, passwords, throttle
from app.settings import get_settings

pytestmark = pytest.mark.db

OLD = "Tr1cky-Horse-Battery"
NEW = "Brand-New-Purple-Table-42"
NOW = datetime(2026, 11, 15, 12, 0, tzinfo=UTC)


class Borrowed:
    def __init__(self, db: Session) -> None:
        self.db = db

    def __enter__(self) -> Session:
        return self.db

    def __exit__(self, *_: object) -> None:
        return None


def run(db: Session, *args: str, prompt: Callable[[str], str] | None = None) -> tuple[int, str]:
    buffer = io.StringIO()
    kwargs = {"prompt": prompt} if prompt else {}
    with redirect_stdout(buffer):
        code = cli.main(list(args), session_factory=lambda: Borrowed(db), now=lambda: NOW, **kwargs)
    return code, buffer.getvalue()


def make(db: Session, email: str = "owner@example.org") -> m.StaffAccount:
    create_admin.create_admin(db, email=email, name="Owner", password=OLD)
    return db.exec(select(m.StaffAccount).where(col(m.StaffAccount.email) == email)).one()


def answers(*values: str) -> Callable[[str], str]:
    it = iter(values)
    return lambda _label: next(it)


def test_status_is_read_only_and_prints_no_secret(db_session: Session) -> None:
    staff = make(db_session)
    before = staff.password_hash
    code, out = run(db_session, "status", "--email", "Owner@Example.org")
    assert code == 0
    assert (
        "Account exists: yes" in out and "Active: yes" in out and "Two-step sign-in on: no" in out
    )
    assert "none recorded (not locked)" in out
    for secret in (before, "owner@example.org", str(staff.id)):
        assert secret not in out
    db_session.refresh(staff)
    assert staff.password_hash == before


def test_status_reports_a_lock_and_a_missing_account(db_session: Session) -> None:
    make(db_session)
    subject = throttle.subject_hash(get_settings().privacy_hash_key, "owner@example.org")
    db_session.execute(
        text(
            "INSERT INTO login_throttle (subject_hash, failed_count, window_started_at, "
            "locked_until, expires_at) "
            "VALUES (:s, 5, :now, :until, :until)"
        ),
        {"s": subject, "now": NOW - timedelta(minutes=3), "until": NOW + timedelta(minutes=12)},
    )
    _, out = run(db_session, "status", "--email", "owner@example.org")
    assert (
        "LOCKED, about 13 more minute(s)" in out
        and "Emails locked right now (all accounts): 1" in out
    )
    _, none = run(db_session, "status", "--email", "nobody@example.org")
    assert "Account exists: no" in none


def test_set_password_changes_only_that_account_lifts_its_lock_and_keeps_two_factor(
    db_session: Session, capsys: pytest.CaptureFixture[str]
) -> None:
    owner = make(db_session)
    other = make(db_session, "other@example.org")
    owner.totp_secret_encrypted = "x" * 40
    owner.totp_enabled_at = NOW
    db_session.flush()
    other_hash = other.password_hash
    subject = throttle.subject_hash(get_settings().privacy_hash_key, "owner@example.org")
    db_session.execute(
        text(
            "INSERT INTO login_throttle (subject_hash, failed_count, window_started_at, "
            "locked_until, expires_at) VALUES (:s, 5, :n, :u, :u)"
        ),
        {"s": subject, "n": NOW, "u": NOW + timedelta(minutes=15)},
    )
    code, out = run(
        db_session, "set-password", "--email", "owner@example.org", prompt=answers(NEW, NEW)
    )
    assert code == 0 and out == cli.DONE + "\n"
    assert NEW not in out and NEW not in capsys.readouterr().err
    db_session.refresh(owner)
    db_session.refresh(other)
    assert passwords.verify_password(owner.password_hash, NEW) and not passwords.verify_password(
        owner.password_hash, OLD
    )
    assert owner.must_change_password is False
    assert (
        owner.totp_enabled_at is not None and owner.totp_secret_encrypted == "x" * 40
    )  # two-step left alone
    assert other.password_hash == other_hash  # nobody else touched
    assert (
        db_session.execute(
            text("SELECT count(*) FROM login_throttle WHERE subject_hash = :s"), {"s": subject}
        ).scalar_one()
        == 0
    )


def test_refusals_change_nothing(db_session: Session, capsys: pytest.CaptureFixture[str]) -> None:
    owner = make(db_session)
    before = owner.password_hash
    assert (
        run(
            db_session,
            "set-password",
            "--email",
            "owner@example.org",
            prompt=answers(NEW, "different"),
        )[0]
        == 1
    )
    assert (
        run(
            db_session,
            "set-password",
            "--email",
            "owner@example.org",
            prompt=answers("short", "short"),
        )[0]
        == 1
    )
    assert (
        run(db_session, "set-password", "--email", "nobody@example.org", prompt=answers(NEW, NEW))[
            0
        ]
        == 1
    )
    err = capsys.readouterr().err
    assert "do not match" in err and "too_short" in err and "No account" in err and NEW not in err
    db_session.refresh(owner)
    assert owner.password_hash == before


def test_the_password_cannot_be_given_on_the_command_line(db_session: Session) -> None:
    with pytest.raises(SystemExit):
        run(db_session, "set-password", "--email", "owner@example.org", "--password", NEW)
