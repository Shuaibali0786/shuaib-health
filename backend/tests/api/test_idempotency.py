"""The same idempotency key never creates two bookings (FR-040 to FR-042), and a transient database
error is retried once only because of that key.

Frozen "now" is Monday 2026-10-05 09:00 Karachi; ``dr-omar-sheikh`` works Tuesday 14:00-17:00.
"""

import threading
import uuid
from collections import Counter
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text
from sqlalchemy.exc import IntegrityError, OperationalError

from app.booking import service
from app.repositories import appointments as appointments_repo
from app.repositories import availability as availability_repo
from tests.conftest import FrozenClock

pytestmark = pytest.mark.db

SECRET = "test-proxy-secret-0123456789abcdef"
DOCTOR = "dr-omar-sheikh"
SLOT = datetime(2026, 10, 6, 9, 0, tzinfo=UTC)  # Tue 14:00 Karachi
OTHER_SLOT = SLOT + timedelta(minutes=15)
APPOINTMENTS = "/api/v1/appointments"
REPEATS = 5


def iso(value: datetime) -> str:
    return value.strftime("%Y-%m-%dT%H:%M:%SZ")


def body(starts_at: datetime = SLOT, reason: str = "Checkup") -> dict[str, Any]:
    return {
        "doctorSlug": DOCTOR,
        "startsAt": iso(starts_at),
        "fullName": "Ayesha Khan",
        "mobile": "03001234567",
        "email": "ayesha@example.com",
        "reason": reason,
        "acceptRules": True,
    }


def headers(key: uuid.UUID | str) -> dict[str, str]:
    return {"X-Proxy-Secret": SECRET, "Idempotency-Key": str(key)}


def count(engine: Engine, table: str) -> int:
    with engine.connect() as conn:
        return int(conn.execute(text(f"SELECT count(*) FROM {table}")).scalar_one())


def test_a_sequential_replay_returns_the_same_booking(
    make_committing_client: Callable[..., TestClient],
    frozen_clock: FrozenClock,
    committing_engine: Engine,
) -> None:
    client = make_committing_client(clock=frozen_clock)
    key = uuid.uuid4()

    first = client.post(APPOINTMENTS, json=body(), headers=headers(key))
    replay = client.post(APPOINTMENTS, json=body(), headers=headers(key))

    assert (first.status_code, replay.status_code) == (201, 201), replay.text
    assert replay.json() == first.json()
    assert count(committing_engine, "appointment") == 1
    assert count(committing_engine, "idempotency_key") == 1


def test_concurrent_identical_requests_make_one_booking(
    make_committing_client: Callable[..., TestClient],
    frozen_clock: FrozenClock,
    committing_engine: Engine,
) -> None:
    clients = [make_committing_client(clock=frozen_clock) for _ in range(REPEATS)]
    barrier = threading.Barrier(REPEATS)
    key = uuid.uuid4()

    def attempt(index: int) -> Any:
        barrier.wait(timeout=30)
        return clients[index].post(APPOINTMENTS, json=body(), headers=headers(key))

    with ThreadPoolExecutor(REPEATS) as pool:
        responses = list(pool.map(attempt, range(REPEATS)))

    assert Counter(r.status_code for r in responses) == {201: REPEATS}, [r.text for r in responses]
    assert len({r.json()["reference"] for r in responses}) == 1
    assert count(committing_engine, "appointment") == 1


def test_the_same_key_with_different_details_is_rejected(
    make_committing_client: Callable[..., TestClient],
    frozen_clock: FrozenClock,
    committing_engine: Engine,
) -> None:
    client = make_committing_client(clock=frozen_clock)
    key = uuid.uuid4()
    assert client.post(APPOINTMENTS, json=body(), headers=headers(key)).status_code == 201

    reused = client.post(APPOINTMENTS, json=body(reason="Something else"), headers=headers(key))

    assert reused.status_code == 409, reused.text
    assert reused.json()["error"]["code"] == "idempotency_key_reused"
    assert "alternatives" not in reused.json()
    assert count(committing_engine, "appointment") == 1


@pytest.mark.parametrize("value", [None, "not-a-uuid", str(uuid.uuid1())])
def test_a_missing_or_non_v4_key_is_a_validation_error(
    make_committing_client: Callable[..., TestClient], frozen_clock: FrozenClock, value: str | None
) -> None:
    client = make_committing_client(clock=frozen_clock)
    sent = {"X-Proxy-Secret": SECRET}
    if value is not None:
        sent["Idempotency-Key"] = value

    response = client.post(APPOINTMENTS, json=body(), headers=sent)

    assert response.status_code == 422, response.text
    assert response.json()["error"]["code"] == "validation_error"


def test_a_failed_attempt_stores_no_key(
    make_committing_client: Callable[..., TestClient],
    frozen_clock: FrozenClock,
    committing_engine: Engine,
) -> None:
    client = make_committing_client(clock=frozen_clock)
    assert client.post(APPOINTMENTS, json=body(), headers=headers(uuid.uuid4())).status_code == 201
    loser_key = uuid.uuid4()
    other = {**body(), "mobile": "03007654321"}

    first = client.post(APPOINTMENTS, json=other, headers=headers(loser_key))
    retry = client.post(APPOINTMENTS, json=other, headers=headers(loser_key))

    assert [r.status_code for r in (first, retry)] == [409, 409]
    assert [r.json()["error"]["code"] for r in (first, retry)] == ["slot_taken", "slot_taken"]
    assert count(committing_engine, "idempotency_key") == 1  # only the winner's


def test_an_expired_key_is_cleaned_up_and_treated_as_new(
    make_committing_client: Callable[..., TestClient],
    frozen_clock: FrozenClock,
    committing_engine: Engine,
) -> None:
    client = make_committing_client(clock=frozen_clock)
    key = uuid.uuid4()
    assert client.post(APPOINTMENTS, json=body(), headers=headers(key)).status_code == 201
    stale = uuid.uuid4()
    with committing_engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO idempotency_key (key, scope, request_hash, expires_at) "
                "VALUES (:key, 'appointment.create', :hash, :expires)"
            ),
            {"key": stale, "hash": "0" * 64, "expires": frozen_clock.now() + timedelta(hours=1)},
        )

    frozen_clock.set(frozen_clock.now() + timedelta(hours=25))
    again = client.post(APPOINTMENTS, json=body(OTHER_SLOT), headers=headers(key))

    assert again.status_code == 201, again.text  # not idempotency_key_reused
    assert count(committing_engine, "appointment") == 2
    with committing_engine.connect() as conn:
        keys = {row[0] for row in conn.execute(text("SELECT key FROM idempotency_key"))}
    assert keys == {key}  # the expired stale row was deleted, the reused key was renewed


def test_the_key_table_holds_no_patient_data(
    make_committing_client: Callable[..., TestClient],
    frozen_clock: FrozenClock,
    committing_engine: Engine,
) -> None:
    client = make_committing_client(clock=frozen_clock)
    assert client.post(APPOINTMENTS, json=body(), headers=headers(uuid.uuid4())).status_code == 201

    with committing_engine.connect() as conn:
        rows = conn.execute(text("SELECT idempotency_key::text FROM idempotency_key")).scalars()
        dump = "".join(rows)
    for private in ("Ayesha", "Khan", "03001234567", "3001234567", "ayesha@example.com", "Checkup"):
        assert private not in dump


# Transient database errors: retried once, and only safe because of the key.


def transient() -> OperationalError:
    return OperationalError("SELECT 1", {}, Exception("server closed the connection"))


@pytest.fixture(autouse=True)
def no_backoff(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(service, "TRANSIENT_BACKOFF_SECONDS", 0)


def test_a_transient_error_before_the_insert_is_retried_once(
    make_committing_client: Callable[..., TestClient],
    frozen_clock: FrozenClock,
    committing_engine: Engine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    real = appointments_repo.active_rules_version
    calls = {"n": 0}

    def flaky(session: Any) -> str:
        calls["n"] += 1
        if calls["n"] == 1:
            raise transient()
        return str(real(session))

    monkeypatch.setattr(appointments_repo, "active_rules_version", flaky)
    client = make_committing_client(clock=frozen_clock)

    response = client.post(APPOINTMENTS, json=body(), headers=headers(uuid.uuid4()))

    assert response.status_code == 201, response.text
    assert calls["n"] == 2
    assert count(committing_engine, "appointment") == 1


def test_a_drop_after_the_commit_replays_instead_of_booking_twice(
    make_committing_client: Callable[..., TestClient],
    frozen_clock: FrozenClock,
    committing_engine: Engine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The connection dies after the booking committed; the retry finds it through the key."""
    real = service.view_of
    calls = {"n": 0}

    def flaky(*args: Any, **kwargs: Any) -> Any:
        calls["n"] += 1
        if calls["n"] == 1:
            raise transient()
        return real(*args, **kwargs)

    monkeypatch.setattr(service, "view_of", flaky)
    client = make_committing_client(clock=frozen_clock)

    response = client.post(APPOINTMENTS, json=body(), headers=headers(uuid.uuid4()))

    assert response.status_code == 201, response.text
    assert count(committing_engine, "appointment") == 1


def test_a_persistent_transient_error_is_tried_twice_then_503(
    make_committing_client: Callable[..., TestClient],
    frozen_clock: FrozenClock,
    committing_engine: Engine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = {"n": 0}

    def always(*_: Any, **__: Any) -> Any:
        calls["n"] += 1
        raise transient()

    monkeypatch.setattr(appointments_repo, "active_rules_version", always)
    client = make_committing_client(clock=frozen_clock)

    response = client.post(APPOINTMENTS, json=body(), headers=headers(uuid.uuid4()))

    assert response.status_code == 503, response.text
    assert response.json()["error"]["code"] == "service_unavailable"
    assert calls["n"] == 2
    assert count(committing_engine, "appointment") == 0
    assert count(committing_engine, "idempotency_key") == 0


def test_slot_taken_is_never_retried(
    make_committing_client: Callable[..., TestClient],
    frozen_clock: FrozenClock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client = make_committing_client(clock=frozen_clock)
    assert client.post(APPOINTMENTS, json=body(), headers=headers(uuid.uuid4())).status_code == 201
    real = availability_repo.load_booking_context
    calls = {"n": 0}

    def counted(*args: Any, **kwargs: Any) -> Any:
        calls["n"] += 1
        return real(*args, **kwargs)

    monkeypatch.setattr(availability_repo, "load_booking_context", counted)

    loser = client.post(APPOINTMENTS, json=body(), headers=headers(uuid.uuid4()))

    assert loser.status_code == 409
    assert calls["n"] == 1


def test_a_constraint_error_is_not_retried(
    make_committing_client: Callable[..., TestClient],
    frozen_clock: FrozenClock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls = {"n": 0}

    def broken(*_: Any, **__: Any) -> Any:
        calls["n"] += 1
        raise IntegrityError("INSERT", {}, Exception("other constraint"))

    monkeypatch.setattr(service, "_insert", broken)
    client = make_committing_client(clock=frozen_clock)

    response = client.post(APPOINTMENTS, json=body(), headers=headers(uuid.uuid4()))

    assert response.status_code == 500
    assert calls["n"] == 1
