"""Demo bookings are purged 7 days after the appointment ends; audit rows after 90 (FR-054)."""

import logging
import os
import subprocess
import sys
import uuid
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

from app.booking.retention import purge_demo_bookings
from app.main import create_app
from tests.conftest import FROZEN_NOW, FrozenClock, SettingsFactory

pytestmark = pytest.mark.db

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
SECRET = "test-proxy-secret-0123456789abcdef"


def reference_for(index: int) -> str:
    return f"TESTRETN{index:02d}"


def insert_appointment(engine: Engine, index: int, ends_at: datetime) -> uuid.UUID:
    starts_at = ends_at - timedelta(minutes=20)
    with engine.begin() as conn:
        row = conn.execute(
            text(
                "INSERT INTO appointment (id, reference, doctor_id, department_id, starts_at, "
                "ends_at, fee_pkr, patient_name, patient_phone, rules_accepted_at, "
                "rules_version, is_sample) "
                "SELECT gen_random_uuid(), :ref, d.id, d.department_id, :s, :e, 1000, "
                "'Purge Test', '+923001234567', :s, 'v1', true "
                "FROM doctor d ORDER BY d.slug LIMIT 1 RETURNING id"
            ),
            {"ref": reference_for(index), "s": starts_at, "e": ends_at},
        ).one()
    inserted: uuid.UUID = row.id
    return inserted


def insert_key(engine: Engine, appointment_id: uuid.UUID) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO idempotency_key (key, scope, request_hash, appointment_id, "
                "expires_at) VALUES (:k, 'booking', :h, :a, :x)"
            ),
            {
                "k": uuid.uuid4(),
                "h": "0" * 64,
                "a": appointment_id,
                "x": FROZEN_NOW + timedelta(days=1),
            },
        )


def insert_audit(engine: Engine, age_days: int) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO audit_log (id, occurred_at, actor_fingerprint, action, outcome) "
                "VALUES (gen_random_uuid(), :t, '0123456789abcdef', 'appointment.created', 'ok')"
            ),
            {"t": FROZEN_NOW - timedelta(days=age_days)},
        )


def count(engine: Engine, table: str) -> int:
    with engine.connect() as conn:
        return int(conn.execute(text(f"SELECT count(*) FROM {table}")).scalar_one())


def purge(engine: Engine, **over: Any) -> int:
    args: dict[str, Any] = {
        "now": FROZEN_NOW,
        "after_days": 7,
        "audit_after_days": 90,
        "limit": None,
        **over,
    }
    with engine.begin() as conn:
        return purge_demo_bookings(conn, **args)


def book(client: TestClient) -> Any:
    return client.post(
        "/api/v1/appointments",
        json={
            "doctorSlug": "dr-omar-sheikh",
            "startsAt": "2026-10-06T09:00:00Z",
            "fullName": "Ali Khan",
            "mobile": "0300 1234567",
            "acceptRules": True,
        },
        headers={"X-Proxy-Secret": SECRET, "Idempotency-Key": str(uuid.uuid4())},
    )


def test_old_bookings_are_purged_and_recent_and_future_ones_kept(
    committing_engine: Engine, committing_cleanup: None
) -> None:
    old = insert_appointment(committing_engine, 0, FROZEN_NOW - timedelta(days=8))
    insert_appointment(committing_engine, 1, FROZEN_NOW - timedelta(days=6))
    insert_appointment(committing_engine, 2, FROZEN_NOW + timedelta(days=2))
    insert_key(committing_engine, old)

    assert purge(committing_engine) == 1

    assert count(committing_engine, "appointment") == 2
    assert count(committing_engine, "idempotency_key") == 0  # cascaded


def test_recent_audit_rows_remain_and_old_ones_go(
    committing_engine: Engine, committing_cleanup: None
) -> None:
    insert_audit(committing_engine, 91)
    insert_audit(committing_engine, 89)
    insert_audit(committing_engine, 1)

    purge(committing_engine)
    assert count(committing_engine, "audit_log") == 2

    purge(committing_engine, audit_after_days=0)
    assert count(committing_engine, "audit_log") == 0


def test_a_purged_reference_looks_up_as_404(
    make_committing_client: Callable[..., TestClient],
    committing_engine: Engine,
    frozen_clock: FrozenClock,
) -> None:
    client = make_committing_client(clock=frozen_clock)
    # Ends 8 days before the frozen "now" but is still found until it is purged.
    insert_appointment(committing_engine, 3, FROZEN_NOW - timedelta(days=8))
    reference = reference_for(3)
    assert client.get(f"/api/v1/appointments/{reference}").status_code == 200
    purge(committing_engine)
    assert client.get(f"/api/v1/appointments/{reference}").status_code == 404


def test_the_limit_caps_rows_per_run(committing_engine: Engine, committing_cleanup: None) -> None:
    for index in range(5):
        insert_appointment(committing_engine, index, FROZEN_NOW - timedelta(days=8, hours=index))
    assert purge(committing_engine, limit=2) == 2
    assert count(committing_engine, "appointment") == 3
    assert purge(committing_engine, limit=None) == 3


def test_the_purge_logs_only_a_count(
    committing_engine: Engine, committing_cleanup: None, caplog: pytest.LogCaptureFixture
) -> None:
    insert_appointment(committing_engine, 0, FROZEN_NOW - timedelta(days=8))
    with caplog.at_level(logging.DEBUG):
        purge(committing_engine)
    records = [r for r in caplog.records if r.name == "app.booking"]
    assert [r.getMessage() for r in records] == ["purge"]
    assert [r.__dict__.get("deleted") for r in records] == [1]


def run_cli(demo_mode: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [sys.executable, "-m", "app.booking.purge"],
        cwd=BACKEND_DIR,
        env={**os.environ, "DEMO_MODE": demo_mode},
        capture_output=True,
        text=True,
        timeout=120,
    )


def test_the_cli_refuses_when_demo_mode_is_off() -> None:
    result = run_cli("false")
    assert result.returncode == 2
    assert "Refusing to purge: DEMO_MODE is false" in result.stderr
    assert result.stdout == ""


def test_the_cli_prints_only_the_count_with_demo_mode_on() -> None:
    result = run_cli("true")
    assert result.returncode == 0
    assert result.stdout.strip().removeprefix("purged: ").isdigit()
    assert result.stdout.startswith("purged: ")


def test_demo_mode_off_purges_nothing_after_a_booking(
    make_committing_client: Callable[..., TestClient],
    committing_engine: Engine,
    frozen_clock: FrozenClock,
) -> None:
    insert_appointment(committing_engine, 0, FROZEN_NOW - timedelta(days=8))
    client = make_committing_client(clock=frozen_clock, demo_mode=False)
    assert book(client).status_code == 201
    assert count(committing_engine, "appointment") == 2


def test_a_booking_purges_old_rows_afterwards(
    make_committing_client: Callable[..., TestClient],
    committing_engine: Engine,
    frozen_clock: FrozenClock,
) -> None:
    insert_appointment(committing_engine, 0, FROZEN_NOW - timedelta(days=8))
    client = make_committing_client(clock=frozen_clock)
    assert book(client).status_code == 201
    assert count(committing_engine, "appointment") == 1


def test_startup_purges_in_the_background(
    make_committing_client: Callable[..., TestClient], committing_engine: Engine
) -> None:
    insert_appointment(committing_engine, 0, datetime.now(UTC) - timedelta(days=8))
    insert_appointment(committing_engine, 1, datetime.now(UTC) + timedelta(days=2))
    with make_committing_client():  # entering the context runs the lifespan
        pass
    assert count(committing_engine, "appointment") == 1


def test_the_app_starts_when_the_database_is_down(
    settings_factory: SettingsFactory, caplog: pytest.LogCaptureFixture
) -> None:
    dead = "postgresql+psycopg://u:p@127.0.0.1:1/db?sslmode=require"
    settings = settings_factory(database_url=dead, direct_database_url=dead)
    with caplog.at_level(logging.WARNING), TestClient(create_app(settings)) as client:
        assert client.get("/health").status_code == 200
    warnings = [r.getMessage() for r in caplog.records if r.getMessage().startswith("purge_failed")]
    assert warnings
    assert all("127.0.0.1" not in w and "postgresql" not in w for w in warnings)
