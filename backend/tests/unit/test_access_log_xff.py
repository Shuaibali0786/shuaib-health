"""The access log carries only the COUNT of X-Forwarded-For entries (FR-031), never addresses."""

import json

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from tests.conftest import SettingsFactory


def access_lines(capsys: pytest.CaptureFixture[str]) -> list[dict[str, object]]:
    lines = capsys.readouterr().err.strip().splitlines()
    records = [json.loads(line) for line in lines]
    return [r for r in records if r.get("event") == "request"]


@pytest.mark.parametrize(
    ("header", "hops"),
    [(None, 0), ("203.0.113.5", 1), ("203.0.113.5, 10.0.0.1", 2), (" , 1.1.1.1,,2.2.2.2 ", 2)],
)
def test_xff_hops_is_a_count(
    capsys: pytest.CaptureFixture[str],
    settings_factory: SettingsFactory,
    header: str | None,
    hops: int,
) -> None:
    client = TestClient(create_app(settings_factory()))
    client.get("/health", headers={"X-Forwarded-For": header} if header else {})
    (record,) = access_lines(capsys)
    assert record["xffHops"] == hops
    for address in (header or "").split(","):
        assert not address.strip() or address.strip() not in json.dumps(record)


def test_xff_hops_is_logged_on_admin_routes_too(
    capsys: pytest.CaptureFixture[str], settings_factory: SettingsFactory
) -> None:
    client = TestClient(create_app(settings_factory()))
    client.get("/api/v1/admin/auth/me", headers={"X-Forwarded-For": "1.1.1.1, 2.2.2.2"})
    (record,) = access_lines(capsys)
    assert record["xffHops"] == 2
