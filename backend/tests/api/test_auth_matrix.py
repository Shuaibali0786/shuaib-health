"""The auth matrix (SC-004): every row of ``ENDPOINT_POLICIES`` against every kind of viewer.

Parametrised from the table itself, so a row for a route built in a later story is exercised as
soon as that route exists (rows named in ``PENDING_ADMIN_OPERATIONS`` are skipped until then).
Contract: specs/006-clinic-command-centre/contracts/auth-matrix.md. A cell passes when the gate
answers with the expected refusal code, or, for an allowed cell, with none of the gate's codes
(the route itself may then answer 2xx, 404 or 422).
"""

import uuid
from collections.abc import Callable
from datetime import timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from httpx2 import Response
from sqlmodel import Session

from app.auth import sessions
from app.auth.policies import ENDPOINT_POLICIES, Policy
from app.settings import Settings
from tests.api.admin_support import (
    API,
    FP,
    GATE_CODES,
    csrf_for,
    headers,
    make_staff,
    staff_session,
)
from tests.api.test_admin_contract import CONTRACT_OPERATIONS, PENDING_ADMIN_OPERATIONS
from tests.conftest import FrozenClock

pytestmark = pytest.mark.db

PENDING = {
    (path.removeprefix("/api/v1"), method.upper())
    for (path, method), op in CONTRACT_OPERATIONS.items()
    if op["operationId"] in PENDING_ADMIN_OPERATIONS
}
ROWS = [
    (method, path, policy)
    for (method, path), policy in ENDPOINT_POLICIES.items()
    if (path, method) not in PENDING
]
SESSION_ROWS = [row for row in ROWS if row[2] is not Policy.PUBLIC_PROXY]
PUBLIC_ROWS = [row for row in ROWS if row[2] is Policy.PUBLIC_PROXY]

NS, EXP, FORBID, RO, PCR = (
    "not_signed_in",
    "session_expired",
    "forbidden",
    "demo_read_only",
    "password_change_required",
)
VIEWERS = ("none", "demo", "receptionist", "admin", "must_change")
EXPECTED: dict[Policy, tuple[str | None, ...]] = {
    #                none demo   recept   admin  must_change
    Policy.SELF: (NS, None, None, None, None),
    Policy.SELF_STAFF: (NS, RO, None, None, None),
    Policy.READ: (NS, None, None, None, PCR),
    Policy.READ_ADMIN: (NS, None, FORBID, None, PCR),
    Policy.WRITE: (NS, RO, None, None, PCR),
    Policy.WRITE_ADMIN: (NS, RO, FORBID, None, PCR),
}
STATES = (
    "idle_expired",
    "absolute_expired",
    "signed_out",
    "deactivated",
    "evicted",
    "demo_token_as_staff",
    "demo_expired",
)
STATE_EXPECTED = {
    "idle_expired": EXP,
    "absolute_expired": EXP,
    "signed_out": NS,
    "deactivated": NS,
    "evicted": NS,
    "demo_token_as_staff": NS,
    "demo_expired": EXP,
}


def gate_code(response: Response) -> str | None:
    if response.status_code < 400:
        return None
    try:
        code = response.json()["error"]["code"]
    except (ValueError, KeyError, TypeError):
        return None
    return str(code) if code in GATE_CODES else None


def call(client: TestClient, method: str, path: str, hdrs: dict[str, str]) -> Response:
    url = API.removesuffix("/admin") + path.replace("{staffId}", str(uuid.uuid4())).replace(
        "{reference}", "0123456789"
    )
    body: dict[str, Any] | None = {} if method in ("POST", "PATCH") else None
    return client.request(method, url, headers=hdrs, json=body)


@pytest.fixture
def make_viewer(
    db_session: Session, cc_settings: Settings, cc_clock: FrozenClock
) -> Callable[[str], dict[str, str]]:
    def build(kind: str) -> dict[str, str]:
        now = cc_clock.now()
        if kind == "none":
            return headers()
        if kind == "demo":
            token, row = sessions.create_demo_session(db_session, cc_settings, now.date(), FP, now)
            return headers(token, csrf_for(cc_settings, row.id))
        if kind == "must_change":
            staff = make_staff(db_session, "change@example.org", must_change_password=True)
        else:
            staff = make_staff(db_session, f"{kind}@example.org", kind)
        return staff_session(db_session, cc_settings, staff, now)[0]

    return build


def test_the_matrix_covers_at_least_the_built_rows() -> None:
    assert len(ENDPOINT_POLICIES) == 19
    # Every row of contracts/auth-matrix.md is built, so every row is exercised (T152, SC-004).
    assert PENDING == set() and len(ROWS) == 19
    assert (len(PUBLIC_ROWS), len(SESSION_ROWS)) == (2, 17)
    assert {r[1] for r in ROWS} >= {
        "/admin/auth/sign-in",
        "/admin/auth/me",
        "/admin/auth/sign-out",
        "/admin/auth/change-password",
        "/admin/staff",
        "/admin/staff/{staffId}/reset-password",
    }


@pytest.mark.parametrize("viewer", VIEWERS)
@pytest.mark.parametrize(("method", "path", "policy"), SESSION_ROWS, ids=lambda v: str(v))
def test_row_by_viewer(
    cc_client: TestClient,
    make_viewer: Callable[[str], dict[str, str]],
    method: str,
    path: str,
    policy: Policy,
    viewer: str,
) -> None:
    expected = EXPECTED[policy][VIEWERS.index(viewer)]
    response = call(cc_client, method, path, make_viewer(viewer))
    assert gate_code(response) == expected, (
        f"{method} {path} as {viewer}: {response.status_code} {response.text[:200]}"
    )


@pytest.mark.parametrize("state", STATES)
@pytest.mark.parametrize(("method", "path", "policy"), SESSION_ROWS, ids=lambda v: str(v))
def test_row_by_session_state(
    cc_client: TestClient,
    db_session: Session,
    cc_settings: Settings,
    cc_clock: FrozenClock,
    method: str,
    path: str,
    policy: Policy,
    state: str,
) -> None:
    now = cc_clock.now()
    staff = make_staff(db_session)
    hdrs, _, row = staff_session(db_session, cc_settings, staff, now)
    if state == "idle_expired":
        cc_clock.set(now + timedelta(minutes=31))
    elif state == "absolute_expired":
        cc_clock.set(now + timedelta(hours=12, minutes=1))
    elif state == "signed_out":
        sessions.end_session(db_session, row.id, "sign_out", now)  # type: ignore[arg-type]
    elif state == "deactivated":
        staff.is_active = False
        db_session.flush()
    elif state == "evicted":
        for minute in range(1, 4):
            sessions.create_staff_session(
                db_session, cc_settings, staff, FP, now + timedelta(minutes=minute)
            )
        cc_clock.set(now + timedelta(minutes=4))
    elif state == "demo_token_as_staff":
        demo, demo_row = sessions.create_demo_session(db_session, cc_settings, now.date(), FP, now)
        hdrs = headers("cs_" + demo.removeprefix("cd_"), csrf_for(cc_settings, demo_row.id))
    elif state == "demo_expired":
        demo, demo_row = sessions.create_demo_session(db_session, cc_settings, now.date(), FP, now)
        hdrs = headers(demo, csrf_for(cc_settings, demo_row.id))
        cc_clock.set(now + timedelta(hours=2, minutes=1))
    response = call(cc_client, method, path, hdrs)
    assert (response.status_code, gate_code(response)) == (401, STATE_EXPECTED[state])


@pytest.mark.parametrize(("method", "path", "policy"), ROWS, ids=lambda v: str(v))
def test_row_needs_the_proxy_secret_and_a_known_origin(
    cc_client: TestClient,
    make_viewer: Callable[[str], dict[str, str]],
    method: str,
    path: str,
    policy: Policy,
) -> None:
    hdrs = make_viewer("admin" if policy is not Policy.PUBLIC_PROXY else "none")
    without_secret = {k: v for k, v in hdrs.items() if k != "X-Proxy-Secret"}
    refused = call(cc_client, method, path, without_secret)
    assert (refused.status_code, gate_code(refused)) == (403, FORBID)
    foreign = call(cc_client, method, path, {**hdrs, "Origin": "https://evil.example"})
    assert (foreign.status_code, gate_code(foreign)) == (403, FORBID)


@pytest.mark.parametrize("csrf", ["missing", "wrong"])
@pytest.mark.parametrize(
    ("method", "path", "policy"),
    [row for row in SESSION_ROWS if row[0] != "GET"],
    ids=lambda v: str(v),
)
def test_writes_need_the_session_bound_csrf_token(
    cc_client: TestClient,
    make_viewer: Callable[[str], dict[str, str]],
    method: str,
    path: str,
    policy: Policy,
    csrf: str,
) -> None:
    hdrs = make_viewer("admin")
    if csrf == "missing":
        hdrs.pop("X-CSRF-Token")
    else:
        hdrs["X-CSRF-Token"] = "x" * 43
    response = call(cc_client, method, path, hdrs)
    assert (response.status_code, gate_code(response)) == (403, "csrf_failed")


def test_public_rows_need_no_session(cc_client: TestClient) -> None:
    for method, path, _ in PUBLIC_ROWS:
        response = call(cc_client, method, path, headers())
        assert gate_code(response) is None, f"{method} {path}"
