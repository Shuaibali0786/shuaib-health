"""Staff administration: create, reset, deactivate, role changes and the last-admin lock."""

import threading
import time
import uuid
from collections import Counter
from collections.abc import Callable, Iterator
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text
from sqlmodel import Session, col, select

from app import models as m
from app.auth import sessions
from app.settings import Settings
from tests.api.admin_support import (
    API,
    FP,
    PASSWORD,
    csrf_for,
    error_code,
    headers,
    make_staff,
    sign_in,
    staff_session,
)
from tests.conftest import FrozenClock

pytestmark = pytest.mark.db

TEMP = "Temporary-Welcome-Pass-42"


def admin_headers(
    db: Session, settings: Settings, clock: FrozenClock, email: str = "owner@example.org"
) -> tuple[dict[str, str], m.StaffAccount]:
    staff = make_staff(db, email)
    return staff_session(db, settings, staff, clock.now())[0], staff


def audit_for(db: Session, action: str) -> list[m.AuditLog]:
    return list(db.exec(select(m.AuditLog).where(col(m.AuditLog.action) == action)).all())


def new_member(**overrides: str) -> dict[str, str]:
    body = {
        "email": "Reception.One@Example.org",
        "displayName": "Reception One",
        "role": "receptionist",
        "temporaryPassword": TEMP,
    }
    return {**body, **overrides}


def test_create_returns_the_member_who_must_change_the_password(
    cc_client: TestClient, db_session: Session, cc_settings: Settings, cc_clock: FrozenClock
) -> None:
    actor, admin = admin_headers(db_session, cc_settings, cc_clock)
    response = cc_client.post(f"{API}/staff", json=new_member(), headers=actor)
    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "reception.one@example.org" and body["role"] == "receptionist"
    assert body["isActive"] is True and body["mustChangePassword"] is True
    assert "password" not in response.text.lower().replace("mustchangepassword", "")
    (row,) = audit_for(db_session, "staff.created")
    assert row.actor_staff_id == admin.id and str(row.target_id) == body["id"]
    # They can sign in with the temporary password and are told to change it.
    signed = sign_in(cc_client, "reception.one@example.org", TEMP)
    assert signed.status_code == 200 and signed.json()["viewer"]["mustChangePassword"] is True


def test_email_is_unique_ignoring_case(
    cc_client: TestClient, db_session: Session, cc_settings: Settings, cc_clock: FrozenClock
) -> None:
    actor, _ = admin_headers(db_session, cc_settings, cc_clock)
    assert cc_client.post(f"{API}/staff", json=new_member(), headers=actor).status_code == 201
    again = cc_client.post(
        f"{API}/staff", json=new_member(email="RECEPTION.ONE@example.ORG"), headers=actor
    )
    assert (again.status_code, error_code(again)) == (409, "email_taken")
    clash = cc_client.post(
        f"{API}/staff", json=new_member(email="OWNER@example.org"), headers=actor
    )
    assert error_code(clash) == "email_taken"


@pytest.mark.parametrize(
    ("password", "reason"),
    [("password1234", "too_common"), ("reception.one-9", "contains_email")],
)
def test_create_enforces_the_password_policy(
    cc_client: TestClient,
    db_session: Session,
    cc_settings: Settings,
    cc_clock: FrozenClock,
    password: str,
    reason: str,
) -> None:
    actor, _ = admin_headers(db_session, cc_settings, cc_clock)
    response = cc_client.post(
        f"{API}/staff", json=new_member(temporaryPassword=password), headers=actor
    )
    assert (response.status_code, error_code(response)) == (422, "weak_password")
    assert response.json()["reason"] == reason


def test_list_returns_every_member_without_secrets(
    cc_client: TestClient, db_session: Session, cc_settings: Settings, cc_clock: FrozenClock
) -> None:
    actor, _ = admin_headers(db_session, cc_settings, cc_clock)
    make_staff(db_session, "two@example.org", "receptionist", "Two")
    response = cc_client.get(f"{API}/staff", headers=actor)
    assert response.status_code == 200
    items = response.json()
    assert {i["email"] for i in items} == {"owner@example.org", "two@example.org"}
    assert not any(k in i for i in items for k in ("passwordHash", "password", "token"))


def test_reset_sets_a_temporary_password_and_ends_only_that_persons_sessions(
    cc_client: TestClient, db_session: Session, cc_settings: Settings, cc_clock: FrozenClock
) -> None:
    actor, admin = admin_headers(db_session, cc_settings, cc_clock)
    member = make_staff(db_session, "two@example.org", "receptionist", "Two")
    theirs, _, _ = staff_session(db_session, cc_settings, member, cc_clock.now())
    response = cc_client.post(
        f"{API}/staff/{member.id}/reset-password", json={"temporaryPassword": TEMP}, headers=actor
    )
    assert response.status_code == 204
    assert cc_client.get(f"{API}/auth/me", headers=theirs).status_code == 401
    assert cc_client.get(f"{API}/auth/me", headers=actor).status_code == 200
    db_session.refresh(member)
    assert member.must_change_password is True
    assert sign_in(cc_client, "two@example.org", PASSWORD).status_code == 401
    assert sign_in(cc_client, "two@example.org", TEMP).json()["viewer"]["mustChangePassword"]
    (row,) = audit_for(db_session, "staff.password_reset")
    assert row.actor_staff_id == admin.id and row.target_id == member.id


def test_reset_of_an_unknown_member_is_404(
    cc_client: TestClient, db_session: Session, cc_settings: Settings, cc_clock: FrozenClock
) -> None:
    actor, _ = admin_headers(db_session, cc_settings, cc_clock)
    response = cc_client.post(
        f"{API}/staff/{uuid.uuid4()}/reset-password",
        json={"temporaryPassword": TEMP},
        headers=actor,
    )
    assert response.status_code == 404


def test_deactivate_and_reactivate_with_audit(
    cc_client: TestClient, db_session: Session, cc_settings: Settings, cc_clock: FrozenClock
) -> None:
    actor, _ = admin_headers(db_session, cc_settings, cc_clock)
    member = make_staff(db_session, "two@example.org", "receptionist", "Two")
    off = cc_client.patch(f"{API}/staff/{member.id}", json={"isActive": False}, headers=actor)
    assert off.status_code == 200 and off.json()["isActive"] is False
    assert sign_in(cc_client, "two@example.org").status_code == 401
    on = cc_client.patch(f"{API}/staff/{member.id}", json={"isActive": True}, headers=actor)
    assert on.json()["isActive"] is True
    assert sign_in(cc_client, "two@example.org").status_code == 200
    assert len(audit_for(db_session, "staff.deactivated")) == 1
    assert len(audit_for(db_session, "staff.reactivated")) == 1


def test_role_change_is_audited(
    cc_client: TestClient, db_session: Session, cc_settings: Settings, cc_clock: FrozenClock
) -> None:
    actor, _ = admin_headers(db_session, cc_settings, cc_clock)
    member = make_staff(db_session, "two@example.org", "receptionist", "Two")
    response = cc_client.patch(f"{API}/staff/{member.id}", json={"role": "admin"}, headers=actor)
    assert response.json()["role"] == "admin"
    assert len(audit_for(db_session, "staff.role_changed")) == 1
    assert cc_client.patch(f"{API}/staff/{member.id}", json={}, headers=actor).status_code == 422


def test_the_last_active_admin_cannot_be_deactivated_or_demoted(
    cc_client: TestClient, db_session: Session, cc_settings: Settings, cc_clock: FrozenClock
) -> None:
    actor, admin = admin_headers(db_session, cc_settings, cc_clock)
    for body in ({"isActive": False}, {"role": "receptionist"}):
        response = cc_client.patch(f"{API}/staff/{admin.id}", json=body, headers=actor)
        assert (response.status_code, error_code(response)) == (409, "last_admin")
    # A second admin makes the first replaceable; an inactive one does not count.
    spare = make_staff(db_session, "spare@example.org", "admin", "Spare", is_active=False)
    assert (
        cc_client.patch(
            f"{API}/staff/{admin.id}", json={"isActive": False}, headers=actor
        ).status_code
        == 409
    )
    db_session.refresh(spare)
    cc_client.patch(f"{API}/staff/{spare.id}", json={"isActive": True}, headers=actor)
    done = cc_client.patch(f"{API}/staff/{admin.id}", json={"role": "receptionist"}, headers=actor)
    assert done.status_code == 200


def test_a_receptionist_and_a_demo_viewer_are_refused(
    cc_client: TestClient, db_session: Session, cc_settings: Settings, cc_clock: FrozenClock
) -> None:
    recept = make_staff(db_session, "r@example.org", "receptionist", "R")
    rh, _, _ = staff_session(db_session, cc_settings, recept, cc_clock.now())
    assert error_code(cc_client.get(f"{API}/staff", headers=rh)) == "forbidden"
    assert error_code(cc_client.post(f"{API}/staff", json=new_member(), headers=rh)) == "forbidden"
    token, row = sessions.create_demo_session(
        db_session, cc_settings, cc_clock.now().date(), FP, cc_clock.now()
    )
    dh = headers(token, csrf_for(cc_settings, row.id))
    sample = cc_client.get(f"{API}/staff", headers=dh).json()
    assert [x["displayName"] for x in sample] == [
        "Sample Admin",
        "Sample Receptionist A",
        "Sample Receptionist B",
    ]
    assert all(x["isSample"] is True for x in sample)
    assert error_code(cc_client.post(f"{API}/staff", json=new_member(), headers=dh)) == (
        "demo_read_only"
    )


@pytest.fixture
def clean_staff_tables(committing_engine: Engine) -> Iterator[None]:
    yield
    with committing_engine.begin() as conn:
        conn.execute(
            text(
                "TRUNCATE staff_account, staff_session, login_throttle, audit_log, "
                "rate_limit_counter CASCADE"
            )
        )


def test_two_concurrent_demotions_leave_exactly_one_admin(
    make_committing_client: Callable[..., TestClient],
    committing_engine: Engine,
    clean_staff_tables: None,
    cc_settings: Settings,
    cc_clock: FrozenClock,
) -> None:
    with Session(committing_engine) as db:
        first = make_staff(db, "one@example.org", "admin", "One")
        second = make_staff(db, "two@example.org", "admin", "Two")
        h1 = staff_session(db, cc_settings, first, cc_clock.now())[0]
        h2 = staff_session(db, cc_settings, second, cc_clock.now())[0]
        db.commit()
        ids = (first.id, second.id)
    clients = [make_committing_client(clock=cc_clock) for _ in range(2)]
    barrier = threading.Barrier(2)

    def demote(client: TestClient, hdrs: dict[str, str], target: uuid.UUID | None) -> int:
        barrier.wait()
        return client.patch(
            f"{API}/staff/{target}", json={"role": "receptionist"}, headers=hdrs
        ).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [
            pool.submit(demote, clients[0], h1, ids[1]),  # one demotes two
            pool.submit(demote, clients[1], h2, ids[0]),  # two demotes one
        ]
        outcomes = Counter(f.result() for f in futures)
    assert outcomes == Counter({200: 1, 409: 1})
    with Session(committing_engine) as db:
        admins = db.exec(select(m.StaffAccount).where(col(m.StaffAccount.role) == "admin")).all()
        assert len(admins) == 1


def test_the_last_admin_check_waits_for_the_lock_and_reads_fresh_state(
    make_committing_client: Callable[..., TestClient],
    committing_engine: Engine,
    clean_staff_tables: None,
    cc_settings: Settings,
    cc_clock: FrozenClock,
) -> None:
    """Deterministic version of the race: another writer holds the admin rows, deactivates the
    other admin and commits; the waiting request must then see no other admin and refuse."""
    with Session(committing_engine) as db:
        one = make_staff(db, "one@example.org", "admin", "One")
        two = make_staff(db, "two@example.org", "admin", "Two")
        hdrs = staff_session(db, cc_settings, one, cc_clock.now())[0]
        db.commit()
        one_id, two_id = one.id, two.id
    client = make_committing_client(clock=cc_clock)
    holder = Session(committing_engine)
    holder.exec(
        select(m.StaffAccount.id).where(col(m.StaffAccount.role) == "admin").with_for_update()
    ).all()
    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(
            client.patch, f"{API}/staff/{one_id}", json={"isActive": False}, headers=hdrs
        )
        time.sleep(1.5)
        assert not future.done(), "the request did not wait for the admin-row lock"
        other = holder.get(m.StaffAccount, two_id)
        assert other is not None
        other.is_active = False
        holder.commit()
        holder.close()
        response = future.result(timeout=30)
    assert (response.status_code, error_code(response)) == (409, "last_admin")
