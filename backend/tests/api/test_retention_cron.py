"""The cron path purges exactly what the startup path does (T011).

These mirror the startup-purge cases in test_retention.py, which stays unchanged; the only
difference is that the purge is triggered by the maintenance route instead of the lifespan.
"""

import logging
import uuid
from collections.abc import Callable
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy import Engine, text

from app.db import get_engine, make_engine
from app.main import create_app
from tests.api.test_maintenance_purge import CRON, GOOD, PURGE
from tests.api.test_retention import count, insert_appointment, remaining
from tests.conftest import SettingsFactory

pytestmark = pytest.mark.db


def test_the_cron_purge_removes_old_bookings_and_keeps_the_rest(
    make_committing_client: Callable[..., TestClient], committing_engine: Engine
) -> None:
    insert_appointment(committing_engine, 0, datetime.now(UTC) - timedelta(days=8))
    insert_appointment(committing_engine, 1, datetime.now(UTC) + timedelta(days=2))
    client = make_committing_client(maintenance_via_cron=True, cron_secret=CRON)
    with client:
        assert client.get(PURGE, headers=GOOD).status_code == 200
    assert count(committing_engine, "appointment") == 1


def test_outside_demo_mode_the_cron_purge_removes_old_sessions_but_keeps_bookings_and_audit(
    make_committing_client: Callable[..., TestClient], committing_engine: Engine
) -> None:
    now = datetime.now(UTC)
    insert_appointment(committing_engine, 0, now - timedelta(days=8))
    with committing_engine.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO audit_log (id, occurred_at, actor_fingerprint, action, outcome) "
                "VALUES (gen_random_uuid(), :t, '0123456789abcdef', 'appointment.created', 'ok')"
            ),
            {"t": now - timedelta(days=400)},
        )
        old = conn.execute(
            text(
                "INSERT INTO demo_session (token_hash, demo_date, created_at, expires_at, "
                "ip_fingerprint) VALUES (:hash, :day, :created, :expires, :fp) RETURNING id"
            ),
            {
                "hash": uuid.uuid4().hex * 2,
                "day": (now - timedelta(days=3)).date(),
                "created": now - timedelta(days=3, hours=2),
                "expires": now - timedelta(days=3),
                "fp": "0" * 16,
            },
        ).scalar_one()
    try:
        client = make_committing_client(
            demo_mode=False, maintenance_via_cron=True, cron_secret=CRON
        )
        assert client.get(PURGE, headers=GOOD).status_code == 200
        assert count(committing_engine, "appointment") == 1  # bookings: demo mode only
        assert count(committing_engine, "audit_log") == 1  # audit: kept outside demo mode
        with committing_engine.connect() as conn:
            assert remaining(conn, "demo_session", [old]) == set()
    finally:
        with committing_engine.begin() as conn:
            conn.execute(text("DELETE FROM demo_session WHERE id = :id"), {"id": old})


def test_a_database_failure_is_a_500_that_leaks_nothing(
    settings_factory: SettingsFactory, caplog: pytest.LogCaptureFixture
) -> None:
    dead = make_engine(
        SecretStr("postgresql+psycopg://u:p@127.0.0.1:1/db?sslmode=require"), connect_timeout=1
    )
    app = create_app(settings_factory(maintenance_via_cron=True, cron_secret=CRON))
    app.dependency_overrides[get_engine] = lambda: dead
    with caplog.at_level(logging.WARNING), TestClient(app) as client:
        response = client.get(PURGE, headers=GOOD)
    assert response.status_code == 500
    assert response.json()["error"]["code"] == "internal_error"
    assert "127.0.0.1" not in response.text and "postgresql" not in response.text
    logged = " ".join(r.getMessage() for r in caplog.records)
    assert "purge_failed: OperationalError" in logged
    assert "127.0.0.1" not in logged
