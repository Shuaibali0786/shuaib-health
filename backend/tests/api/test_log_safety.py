import json
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from tests.conftest import SettingsFactory

SECRET_URL = "postgresql+psycopg://appuser:SECRETPW@ep-x.example.neon.tech/db?sslmode=require"


def log_records(capsys: pytest.CaptureFixture[str]) -> list[dict[str, Any]]:
    lines = [ln for ln in capsys.readouterr().err.splitlines() if ln.startswith("{")]
    records = [json.loads(ln) for ln in lines]
    # The in-process test client logs its own outgoing request URL (with the query string);
    # that is not server output, so it is not part of what is being checked.
    return [r for r in records if not r["logger"].startswith("httpx")]


def test_logs_have_no_query_strings_urls_or_secrets(
    capsys: pytest.CaptureFixture[str], settings_factory: SettingsFactory
) -> None:
    app = create_app(settings_factory(rate_limit_per_minute=100))

    @app.get("/boom")
    def boom() -> None:
        raise RuntimeError(f"cannot connect to {SECRET_URL}")

    client = TestClient(app, raise_server_exceptions=False)
    client.get("/api/v1/nope", params={"q": "private-text", "pageSize": 5})
    client.get("/health")
    assert client.get("/boom").status_code == 500

    records = log_records(capsys)
    raw = json.dumps(records)
    for forbidden in ("private-text", "SECRETPW", "appuser", "ep-x.example", "pageSize"):
        assert forbidden not in raw
    assert "postgresql://***" in raw  # the redaction ran on the logged exception

    access = [r for r in records if r.get("event") == "request"]
    assert len(access) == 3
    for record in access:
        assert {"requestId", "method", "path", "status", "durationMs"} <= record.keys()
        assert "?" not in record["path"]
        assert record["requestId"] != "-"
    assert {r["status"] for r in access} == {404, 200, 500}


def test_every_log_line_is_valid_json(
    capsys: pytest.CaptureFixture[str], settings_factory: SettingsFactory
) -> None:
    client = TestClient(create_app(settings_factory()))
    client.get("/health")
    out = capsys.readouterr().err.strip().splitlines()
    assert out
    for line in out:
        assert isinstance(json.loads(line), dict)
