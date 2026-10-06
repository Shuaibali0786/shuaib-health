"""Create the first admin: ``python -m app.auth.create_admin --email you@example.org``.

The password is asked for twice without echo, or read from the first line of stdin with
``--password-stdin``. The only output is "Admin account created."; nothing about the password,
the account or the database is ever printed.
"""

import argparse
import getpass
import sys
from collections.abc import Callable, Sequence
from typing import TextIO

from sqlmodel import Session, col, func, select

from app import models as m
from app.auth import audit, passwords
from app.db import get_engine
from app.settings import get_settings

SUCCESS = "Admin account created."
MAX_NAME = 60
SYSTEM_FINGERPRINT = "0" * 16


class CreateAdminError(Exception):
    """A refusal with a message that is safe to print."""


def create_admin(db: Session, *, email: str, name: str, password: str) -> None:
    typed = email.strip().lower()
    if not typed or "@" not in typed or len(typed) > 254:
        raise CreateAdminError("Enter a valid email address.")
    name = name.strip() or "Admin"
    if len(name) > MAX_NAME:
        raise CreateAdminError(f"The name can be at most {MAX_NAME} characters.")
    taken = db.exec(
        select(m.StaffAccount.id).where(func.lower(col(m.StaffAccount.email)) == typed)
    ).first()
    if taken is not None:
        raise CreateAdminError("An account with that email already exists.")
    reason = passwords.check_policy(password, email=typed)
    if reason is not None:
        raise CreateAdminError(f"That password is not acceptable ({reason}).")
    staff = m.StaffAccount(
        email=typed,
        display_name=name,
        role="admin",
        password_hash=passwords.hash_password(password),
        must_change_password=False,
    )
    db.add(staff)
    db.flush()
    audit.record(
        db,
        action="staff.created",
        fingerprint=SYSTEM_FINGERPRINT,
        actor_type="system",
        target_type="staff",
        target_id=staff.id,
    )
    db.commit()


def _read_password(stdin: TextIO, from_stdin: bool, prompt: Callable[[str], str]) -> str:
    if from_stdin:
        return stdin.readline().rstrip("\r\n")
    first = prompt("Password: ")
    if prompt("Repeat password: ") != first:
        raise CreateAdminError("The passwords do not match.")
    return first


def main(
    argv: Sequence[str] | None = None,
    *,
    stdin: TextIO | None = None,
    prompt: Callable[[str], str] = getpass.getpass,
    session_factory: Callable[[], Session] | None = None,
) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.auth.create_admin")
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", default="")
    parser.add_argument("--password-stdin", action="store_true")
    args = parser.parse_args(argv)
    try:
        password = _read_password(stdin or sys.stdin, args.password_stdin, prompt)
        factory = session_factory or _default_session
        with factory() as db:
            create_admin(db, email=args.email, name=args.name, password=password)
    except CreateAdminError as error:
        print(str(error), file=sys.stderr)
        return 1
    print(SUCCESS)
    return 0


def _default_session() -> Session:
    get_settings()
    return Session(get_engine())


if __name__ == "__main__":
    raise SystemExit(main())
