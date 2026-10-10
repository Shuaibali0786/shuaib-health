"""The daily maintenance route (condition C3): auth, behaviour and mounting."""

import asyncio
import threading
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine

from app.main import create_app, lifespan
from tests.api.test_retention import count, insert_appointment
from tests.conftest import SettingsFactory

CRON = "test-cron-secret-0123456789abcdefghij"
PURGE = "/internal/maintenance/purge"
GOOD = {"Authorization": f"Bearer {CRON}"}


def cron_client(make: Callable[..., TestClient], **over: Any) -> TestClient:
    return make(maintenance_via_cron=True, cron_secret=CRON, **over)


@pytest.mark.db
def test_without_or_with_a_wrong_bearer_the_route_is_404(
    make_committing_client: Callable[..., TestClient], committing_engine: Engine
) -> None:
    insert_appointment(committing_engine, 0, datetime.now(UTC) - timedelta(days=8))
    client = cron_client(make_committing_client)
    for headers in ({}, {"Authorization": "Bearer nope"}, {"Authorization": CRON}):
        for method in ("GET", "POST"):
            assert client.request(method, PURGE, headers=headers).status_code == 404
    assert count(committing_engine, "appointment") == 1  # nothing was purged


@pytest.mark.db
def test_the_right_bearer_purges_then_a_second_call_purges_nothing(
    make_committing_client: Callable[..., TestClient], committing_engine: Engine
) -> None:
    insert_appointment(committing_engine, 0, datetime.now(UTC) - timedelta(days=8))
    insert_appointment(committing_engine, 1, datetime.now(UTC) + timedelta(days=2))
    client = cron_client(make_committing_client)

    first = client.get(PURGE, headers=GOOD)  # Vercel Cron sends GET
    assert first.status_code == 200
    assert first.json() == {"status": "ok", "purged": 1}
    assert first.headers["cache-control"] == "no-store"
    assert count(committing_engine, "appointment") == 1

    second = client.post(PURGE, headers=GOOD)
    assert second.status_code == 200
    assert second.json() == {"status": "ok", "purged": 0}


@pytest.mark.db
def test_the_authorised_call_is_not_counted_by_the_per_ip_limiter(
    make_committing_client: Callable[..., TestClient],
) -> None:
    client = cron_client(make_committing_client, rate_limit_per_minute=1)
    assert [client.get(PURGE, headers=GOOD).status_code for _ in range(3)] == [200, 200, 200]
    # An unauthorised caller is still limited like anyone else.
    assert [client.get(PURGE).status_code for _ in range(3)] == [404, 429, 429]


def test_the_route_is_not_in_the_openapi_schema(settings_factory: SettingsFactory) -> None:
    app = create_app(settings_factory(maintenance_via_cron=True, cron_secret=CRON))
    paths = TestClient(app).get("/openapi.json").json()["paths"]
    assert not [p for p in paths if "maintenance" in p]


def test_lifespan_starts_no_task_or_thread(settings_factory: SettingsFactory) -> None:
    app = create_app(settings_factory(maintenance_via_cron=True, cron_secret=CRON))

    async def run() -> tuple[int, int, int, int]:
        tasks_before, threads_before = len(asyncio.all_tasks()), threading.active_count()
        async with lifespan(app):
            return (
                tasks_before,
                len(asyncio.all_tasks()),
                threads_before,
                threading.active_count(),
            )

    tasks_before, tasks_inside, threads_before, threads_inside = asyncio.run(run())
    assert tasks_inside == tasks_before
    assert threads_inside == threads_before


@pytest.mark.parametrize(
    "over",
    [
        {"maintenance_via_cron": False, "cron_secret": CRON},  # flag off
        {"maintenance_via_cron": True},  # no CRON_SECRET
        {},  # code defaults
    ],
)
def test_the_route_does_not_exist_without_the_flag_or_the_secret(
    settings_factory: SettingsFactory, over: dict[str, Any]
) -> None:
    client = TestClient(create_app(settings_factory(**over)))
    assert client.get(PURGE, headers=GOOD).status_code == 404
    assert client.post(PURGE, headers=GOOD).status_code == 404


SENTRY_CHECK = "/internal/maintenance/sentry-check"


def test_sentry_check_is_404_without_the_bearer_and_never_in_the_schema(
    settings_factory: SettingsFactory,
) -> None:
    client = TestClient(create_app(settings_factory(maintenance_via_cron=True, cron_secret=CRON)))
    for headers in ({}, {"Authorization": "Bearer nope"}, {"Authorization": CRON}):
        assert client.post(SENTRY_CHECK, headers=headers).status_code == 404
    assert client.get(SENTRY_CHECK, headers=GOOD).status_code == 405  # POST only, behind the bearer
    assert SENTRY_CHECK not in client.get("/openapi.json").text


def test_sentry_check_with_the_bearer_fails_on_purpose_with_the_standard_500(
    settings_factory: SettingsFactory,
) -> None:
    client = TestClient(create_app(settings_factory(maintenance_via_cron=True, cron_secret=CRON)))
    response = client.post(SENTRY_CHECK, headers=GOOD)
    assert response.status_code == 500
    assert response.json()["error"]["code"] == "internal_error"
    assert "fake.patient" not in response.text
