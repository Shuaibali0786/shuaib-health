"""Operator tool for a locked-out admin (owner request 2026-11-15).

``python -m app.auth.admin_access status --email you@example.org --expect-host <host>``
    READ-ONLY. Says whether the account exists, is active, has two-step sign-in on, and whether the
    sign-in is locked by too many wrong attempts. Nothing is written.

``python -m app.auth.admin_access set-password --email you@example.org --expect-host <host>``
    Asks for a new password twice WITHOUT echo (never on the command line, never from stdin, never
    saved or logged) and sets it for that one account only. Two-step sign-in is left as it is. The
    account's open sessions end and its failed-sign-in counter is cleared.

Both commands use the production guard (``app.ops.target_guard``): the masked host and the database
name are printed and the database name must be typed. Nothing here ever prints a URL, a password, a
hash or a key.
"""

import argparse
import getpass
import sys
import uuid
from collections.abc import Callable, Sequence
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import text
from sqlmodel import Session, col, func, select

from app import models as m
from app.auth import audit, passwords, sessions, throttle, two_factor
from app.db import get_engine
from app.ops.target_guard import GuardRefusal, add_guard_arguments, confirm_target
from app.settings import get_settings

SYSTEM_FINGERPRINT = "0" * 16
DONE = "Password updated for that account. Two-step sign-in was not changed."
NO_SUCH_ACCOUNT = "No account with that email."


class AdminAccessError(Exception):
    """A refusal with a message that is safe to print."""


def _account(db: Session, email: str) -> m.StaffAccount | None:
    typed = email.strip().lower()
    return db.exec(
        select(m.StaffAccount).where(func.lower(col(m.StaffAccount.email)) == typed)
    ).first()


def status_lines(db: Session, *, email: str, now: datetime) -> list[str]:
    """The read-only report. Yes/no facts and minutes only: no email, id, hash or key."""
    settings = get_settings()
    staff = _account(db, email)
    lines = [f"Account exists: {'yes' if staff else 'no'}"]
    if staff:
        lines += [
            f"Role: {staff.role}",
            f"Active: {'yes' if staff.is_active else 'no'}",
            f"Two-step sign-in on: {'yes' if two_factor.is_enrolled(staff) else 'no'}",
            "Must change password at next sign-in: "
            + ("yes" if staff.must_change_password else "no"),
            "Last sign-in: "
            + (staff.last_sign_in_at.isoformat() if staff.last_sign_in_at else "never"),
        ]
    subject = throttle.subject_hash(settings.privacy_hash_key, email)
    row = db.execute(
        text(
            "SELECT failed_count, locked_until FROM login_throttle "
            "WHERE subject_hash = :subject AND expires_at > :now"
        ),
        {"subject": subject, "now": now},
    ).first()
    if row is None:
        lines.append("Sign-in lock for this email: none recorded (not locked)")
    else:
        failed, until = row
        if until is not None and until > now:
            minutes = max(1, int((until - now).total_seconds() // 60) + 1)
            lines.append(f"Sign-in lock for this email: LOCKED, about {minutes} more minute(s)")
        else:
            lines.append(
                f"Sign-in lock for this email: not locked (failed tries in the window: {failed})"
            )
    locked_now = db.execute(
        text("SELECT count(*) FROM login_throttle WHERE locked_until > :now"), {"now": now}
    ).scalar_one()
    lines.append(f"Emails locked right now (all accounts): {locked_now}")
    lines.append(
        "(The lock line is exact only when PRIVACY_HASH_KEY in this shell is the production value; "
        "a lock ends by itself after "
        f"{settings.login_lock_minutes} minutes.)"
    )
    return lines


def set_password(db: Session, *, email: str, password: str, now: datetime) -> None:
    staff = _account(db, email)
    if staff is None:
        raise AdminAccessError(NO_SUCH_ACCOUNT)
    reason = passwords.check_policy(password, email=staff.email)
    if reason is not None:
        raise AdminAccessError(f"That password is not acceptable ({reason}).")
    settings = get_settings()
    staff.password_hash = passwords.hash_password(password)
    staff.must_change_password = False
    staff.password_changed_at = now
    # Old sessions end, and a lock caused by the forgotten password is lifted for this email only.
    sessions.end_all_for_staff(db, uuid.UUID(str(staff.id)), "password_reset", now)
    throttle.clear(db, throttle.subject_hash(settings.privacy_hash_key, staff.email))
    audit.record(
        db,
        action="staff.password_reset",
        fingerprint=SYSTEM_FINGERPRINT,
        actor_type="system",
        target_type="staff",
        target_id=staff.id,
    )
    db.commit()


def _guard(expect_hosts: list[str]) -> None:
    confirm_target(
        get_settings().database_url.get_secret_value(), expect_hosts=expect_hosts, out=sys.stdout
    )


def main(
    argv: Sequence[str] | None = None,
    *,
    prompt: Callable[[str], str] = getpass.getpass,
    session_factory: Callable[[], Any] | None = None,
    now: Callable[[], datetime] = lambda: datetime.now(UTC),
) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.auth.admin_access")
    parser.add_argument("command", choices=["status", "set-password"])
    parser.add_argument("--email", required=True)
    add_guard_arguments(parser)
    args = parser.parse_args(argv)
    try:
        if session_factory is None:
            _guard(args.expect_host)
        factory = session_factory or (lambda: Session(get_engine()))
        if args.command == "status":
            with factory() as db:
                for line in status_lines(db, email=args.email, now=now()):
                    print(line)
            return 0
        first = prompt("New password: ")
        if prompt("Repeat new password: ") != first:
            raise AdminAccessError("The passwords do not match.")
        with factory() as db:
            set_password(db, email=args.email, password=first, now=now())
    except (AdminAccessError, GuardRefusal) as error:
        print(str(error), file=sys.stderr)
        return 1
    print(DONE)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
