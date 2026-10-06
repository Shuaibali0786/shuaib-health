"""``python -m app.auth.create_admin``: policy, duplicates, audit and silence."""

import io
from collections.abc import Callable

import pytest
from sqlmodel import Session, col, select

from app import models as m
from app.auth import create_admin as cli
from app.auth.passwords import verify_password

pytestmark = pytest.mark.db

GOOD = "Tr1cky-Horse-Battery"


def run(
    db: Session,
    *args: str,
    stdin: str = "",
    prompt: Callable[[str], str] | None = None,
) -> int:
    class Borrowed:
        """A session the CLI may enter and leave without closing the test's transaction."""

        def __enter__(self) -> Session:
            return db

        def __exit__(self, *_: object) -> None:
            return None

    kwargs = {"prompt": prompt} if prompt else {}
    return cli.main(
        list(args),
        stdin=io.StringIO(stdin),
        session_factory=lambda: Borrowed(),  # type: ignore[arg-type,return-value]
        **kwargs,  # type: ignore[arg-type]
    )


def accounts(db: Session) -> list[m.StaffAccount]:
    return list(db.exec(select(m.StaffAccount)).all())


def test_prompts_twice_creates_an_admin_and_prints_only_the_success_line(
    db_session: Session, capsys: pytest.CaptureFixture[str]
) -> None:
    answers = iter([GOOD, GOOD])
    asked: list[str] = []

    def prompt(label: str) -> str:
        asked.append(label)
        return next(answers)

    code = run(db_session, "--email", "Owner@Example.org", "--name", "Dr Owner", prompt=prompt)
    out = capsys.readouterr()
    assert code == 0 and len(asked) == 2
    assert out.out == "Admin account created.\n" and out.err == ""
    (staff,) = accounts(db_session)
    assert staff.email == "owner@example.org" and staff.role == "admin"
    assert staff.display_name == "Dr Owner" and staff.must_change_password is False
    assert verify_password(staff.password_hash, GOOD)


def test_a_mismatched_repeat_is_refused_and_nothing_is_written(
    db_session: Session, capsys: pytest.CaptureFixture[str]
) -> None:
    answers = iter([GOOD, GOOD + "x"])
    assert run(db_session, "--email", "a@example.org", prompt=lambda _: next(answers)) == 1
    assert "do not match" in capsys.readouterr().err
    assert accounts(db_session) == []


def test_password_from_stdin_reads_the_first_line(
    db_session: Session, capsys: pytest.CaptureFixture[str]
) -> None:
    assert run(db_session, "--email", "a@example.org", "--password-stdin", stdin=GOOD + "\n") == 0
    assert capsys.readouterr().out == "Admin account created.\n"
    assert verify_password(accounts(db_session)[0].password_hash, GOOD)


@pytest.mark.parametrize(
    "password",
    ["short-1", "password1234", "owner-is-my-name-1", ""],
)
def test_the_policy_is_enforced(
    db_session: Session, capsys: pytest.CaptureFixture[str], password: str
) -> None:
    code = run(db_session, "--email", "owner@example.org", "--password-stdin", stdin=password)
    out = capsys.readouterr()
    assert code == 1 and out.out == "" and "not acceptable" in out.err
    assert password not in out.err or password == ""
    assert accounts(db_session) == []


def test_an_existing_email_is_refused_ignoring_case(
    db_session: Session, capsys: pytest.CaptureFixture[str]
) -> None:
    assert run(db_session, "--email", "owner@example.org", "--password-stdin", stdin=GOOD) == 0
    capsys.readouterr()
    code = run(db_session, "--email", "OWNER@example.org", "--password-stdin", stdin=GOOD)
    out = capsys.readouterr()
    assert code == 1 and "already exists" in out.err and out.out == ""
    assert len(accounts(db_session)) == 1


def test_it_writes_a_staff_created_audit_row_with_actor_system(db_session: Session) -> None:
    run(db_session, "--email", "owner@example.org", "--password-stdin", stdin=GOOD)
    (row,) = db_session.exec(
        select(m.AuditLog).where(col(m.AuditLog.action) == "staff.created")
    ).all()
    staff = accounts(db_session)[0]
    assert row.actor_type == "system" and row.actor_staff_id is None
    assert row.target_type == "staff" and row.target_id == staff.id
    assert "owner" not in " ".join(str(v) for v in row.model_dump().values())
