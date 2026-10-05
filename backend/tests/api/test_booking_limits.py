"""Abuse cannot flood the schedule (FR-060 to FR-062): IP and phone limits, the trap field, the
maximum active bookings per phone, and the lookup limit.

Frozen "now" is Monday 2026-10-05 09:00 Karachi (04:00 UTC); ``dr-omar-sheikh`` works Tuesday
14:00-17:00 in 15-minute slots.
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

from tests.conftest import FrozenClock

pytestmark = pytest.mark.db

SECRET = "test-proxy-secret-0123456789abcdef"
DOCTOR = "dr-omar-sheikh"
SLOT = datetime(2026, 10, 6, 9, 0, tzinfo=UTC)  # Tue 14:00 Karachi
APPOINTMENTS = "/api/v1/appointments"
LIMITS = {
    "booking_limit_per_ip_per_hour": 3,
    "booking_limit_per_phone_per_day": 2,
    "lookup_limit_per_ip_per_minute": 3,
}
IP = "203.0.113.7"
MOBILE = "03001234567"


def iso(value: datetime) -> str:
    return value.strftime("%Y-%m-%dT%H:%M:%SZ")


def slot(index: int) -> datetime:
    return SLOT + timedelta(minutes=15 * index)


def payload(index: int = 0, mobile: str = MOBILE, **extra: Any) -> dict[str, Any]:
    return {
        "doctorSlug": DOCTOR,
        "startsAt": iso(slot(index)),
        "fullName": "Ayesha Khan",
        "mobile": mobile,
        "reason": "Checkup",
        "acceptRules": True,
        **extra,
    }


def headers(ip: str = IP, key: uuid.UUID | None = None) -> dict[str, str]:
    return {
        "X-Proxy-Secret": SECRET,
        "X-Client-IP": ip,
        "Idempotency-Key": str(key or uuid.uuid4()),
    }


def scalars(engine: Engine, sql: str) -> list[Any]:
    with engine.connect() as conn:
        return list(conn.execute(text(sql)).scalars())


def appointments(engine: Engine) -> int:
    return int(scalars(engine, "SELECT count(*) FROM appointment")[0])


def outcomes(engine: Engine) -> list[str]:
    return scalars(engine, "SELECT outcome FROM audit_log ORDER BY occurred_at")


def test_the_ip_limit_refuses_the_fourth_attempt(
    make_committing_client: Callable[..., TestClient],
    frozen_clock: FrozenClock,
    committing_engine: Engine,
) -> None:
    client = make_committing_client(clock=frozen_clock, **LIMITS)
    statuses = [
        client.post(
            APPOINTMENTS, json=payload(i, mobile=f"030{i}1234567"), headers=headers()
        ).status_code
        for i in range(3)
    ]
    refused = client.post(APPOINTMENTS, json=payload(3, mobile="03091234567"), headers=headers())

    assert statuses == [201, 201, 201]
    assert refused.status_code == 429, refused.text
    assert int(refused.headers["Retry-After"]) >= 1
    error = refused.json()["error"]
    assert error["code"] == "rate_limited"
    assert error["requestId"]
    assert appointments(committing_engine) == 3
    assert "rate_limited_ip" in outcomes(committing_engine)


def test_another_ip_is_not_affected_by_the_ip_limit(
    make_committing_client: Callable[..., TestClient], frozen_clock: FrozenClock
) -> None:
    client = make_committing_client(clock=frozen_clock, **LIMITS)
    for i in range(4):
        client.post(APPOINTMENTS, json=payload(i, mobile=f"030{i}1234567"), headers=headers())

    other = client.post(
        APPOINTMENTS, json=payload(5, mobile="03091234567"), headers=headers("198.51.100.9")
    )

    assert other.status_code == 201, other.text


def test_the_phone_limit_counts_every_format_as_one_number(
    make_committing_client: Callable[..., TestClient],
    frozen_clock: FrozenClock,
    committing_engine: Engine,
) -> None:
    client = make_committing_client(clock=frozen_clock, **LIMITS)
    formats = ["03001234567", "+923001234567", "0300 1234567"]

    results = [
        client.post(
            APPOINTMENTS, json=payload(i, mobile=number), headers=headers(f"198.51.100.{i + 1}")
        )
        for i, number in enumerate(formats)
    ]

    assert [r.status_code for r in results] == [201, 201, 429], results[2].text
    assert results[2].json()["error"]["code"] == "rate_limited"
    assert "Retry-After" in results[2].headers
    assert appointments(committing_engine) == 2
    assert outcomes(committing_engine).count("rate_limited_phone") == 1


def test_the_fourth_booking_for_one_phone_is_refused(
    make_committing_client: Callable[..., TestClient],
    frozen_clock: FrozenClock,
    committing_engine: Engine,
) -> None:
    client = make_committing_client(
        clock=frozen_clock, booking_limit_per_ip_per_hour=50, booking_limit_per_phone_per_day=50
    )
    statuses = [
        client.post(APPOINTMENTS, json=payload(i), headers=headers()).status_code for i in range(3)
    ]
    refused = client.post(APPOINTMENTS, json=payload(3), headers=headers())

    assert statuses == [201, 201, 201]
    assert refused.status_code == 409, refused.text
    error = refused.json()["error"]
    assert error["code"] == "booking_limit_reached"
    assert "maximum upcoming bookings" in error["message"]
    assert "alternatives" not in refused.json()
    assert appointments(committing_engine) == 3
    assert outcomes(committing_engine).count("limit_reached") == 1


def test_concurrent_requests_for_one_phone_never_pass_the_maximum(
    make_committing_client: Callable[..., TestClient],
    frozen_clock: FrozenClock,
    committing_engine: Engine,
) -> None:
    racers = 5
    clients = [
        make_committing_client(
            clock=frozen_clock,
            booking_limit_per_ip_per_hour=50,
            booking_limit_per_phone_per_day=50,
        )
        for _ in range(racers)
    ]
    barrier = threading.Barrier(racers)

    def attempt(index: int) -> Any:
        barrier.wait(timeout=30)
        return clients[index].post(APPOINTMENTS, json=payload(index), headers=headers())

    with ThreadPoolExecutor(racers) as pool:
        results = list(pool.map(attempt, range(racers)))

    counts = Counter((r.status_code, r.json().get("error", {}).get("code")) for r in results)
    assert counts == {(201, None): 3, (409, "booking_limit_reached"): 2}, counts
    assert appointments(committing_engine) == 3


def test_the_trap_field_is_rejected_and_counted(
    make_committing_client: Callable[..., TestClient],
    frozen_clock: FrozenClock,
    committing_engine: Engine,
) -> None:
    client = make_committing_client(clock=frozen_clock, **LIMITS)

    response = client.post(APPOINTMENTS, json=payload(trap="x"), headers=headers())

    assert response.status_code == 400, response.text
    assert response.json()["error"]["code"] == "request_rejected"
    assert "call the clinic" in response.json()["error"]["message"]
    assert appointments(committing_engine) == 0
    assert outcomes(committing_engine) == ["trap"]
    assert scalars(committing_engine, "SELECT count FROM rate_limit_counter") == [1]


def test_an_empty_trap_field_is_fine(
    make_committing_client: Callable[..., TestClient], frozen_clock: FrozenClock
) -> None:
    client = make_committing_client(clock=frozen_clock, **LIMITS)

    response = client.post(APPOINTMENTS, json=payload(trap=""), headers=headers())

    assert response.status_code == 201, response.text


def test_the_fourth_lookup_in_a_minute_is_refused(
    make_committing_client: Callable[..., TestClient], frozen_clock: FrozenClock
) -> None:
    client = make_committing_client(clock=frozen_clock, **LIMITS)
    lookup = {"X-Proxy-Secret": SECRET, "X-Client-IP": IP}

    statuses = [client.get("/api/v1/appointments/ABCDEFGHJK", headers=lookup) for _ in range(4)]

    assert [r.status_code for r in statuses] == [404, 404, 404, 429]
    assert int(statuses[3].headers["Retry-After"]) >= 1
    assert statuses[3].json()["error"]["code"] == "rate_limited"


def test_counters_never_hold_an_ip_or_a_phone_number(
    make_committing_client: Callable[..., TestClient],
    frozen_clock: FrozenClock,
    committing_engine: Engine,
) -> None:
    client = make_committing_client(clock=frozen_clock, **LIMITS)
    client.post(APPOINTMENTS, json=payload(), headers=headers())
    client.get(
        "/api/v1/appointments/ABCDEFGHJK", headers={"X-Proxy-Secret": SECRET, "X-Client-IP": IP}
    )

    buckets = scalars(committing_engine, "SELECT bucket FROM rate_limit_counter")

    assert sorted(b.rsplit(":", 1)[0] for b in buckets) == [
        "booking:ip",
        "booking:phone",
        "lookup:ip",
    ]
    for bucket in buckets:
        assert IP not in bucket
        assert "3001234567" not in bucket
        assert len(bucket.rsplit(":", 1)[1]) == 32


def test_attempts_are_allowed_again_after_the_window(
    make_committing_client: Callable[..., TestClient],
    frozen_clock: FrozenClock,
) -> None:
    client = make_committing_client(clock=frozen_clock, **LIMITS)
    for i in range(3):
        client.post(APPOINTMENTS, json=payload(i, mobile=f"030{i}1234567"), headers=headers())
    refused = client.post(APPOINTMENTS, json=payload(3, mobile="03091234567"), headers=headers())

    frozen_clock.set(frozen_clock.now() + timedelta(hours=1))
    allowed = client.post(APPOINTMENTS, json=payload(3, mobile="03091234567"), headers=headers())

    assert refused.status_code == 429
    assert allowed.status_code == 201, allowed.text


def test_a_replay_does_not_use_up_the_limits(
    make_committing_client: Callable[..., TestClient],
    frozen_clock: FrozenClock,
    committing_engine: Engine,
) -> None:
    client = make_committing_client(clock=frozen_clock, **LIMITS)
    key = uuid.uuid4()
    first = client.post(APPOINTMENTS, json=payload(), headers=headers(key=key))

    replays = [
        client.post(APPOINTMENTS, json=payload(), headers=headers(key=key)) for _ in range(5)
    ]

    assert first.status_code == 201
    assert [r.status_code for r in replays] == [201] * 5
    assert scalars(committing_engine, "SELECT count FROM rate_limit_counter") == [1, 1]
