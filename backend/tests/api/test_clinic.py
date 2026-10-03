import json
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlmodel import Session

from tests.api.parity import CATALOG_PATH, assert_subset, load_catalog

pytestmark = pytest.mark.db

DEMO_NOTICE = "Portfolio demo — not a real clinic, not medical advice."
CREDIT_HREF = "https://github.com/Shuaibali0786"


def extras() -> dict[str, Any]:
    data: dict[str, Any] = json.loads(
        (CATALOG_PATH.parent / "extras.json").read_text(encoding="utf-8")
    )
    return data


def test_clinic_matches_mock_site_config(client: TestClient) -> None:
    response = client.get("/api/v1/clinic")
    assert response.status_code == 200
    body = response.json()
    assert_subset(body, load_catalog()["siteConfig"], frozenset())
    assert body["logo"] == {
        "src": "/images/" + extras()["logo"]["key"],
        "alt": extras()["logo"]["alt"],
        "width": extras()["logo"]["width"],
        "height": extras()["logo"]["height"],
    }
    assert body["brandColors"] == extras()["brandColors"]


def test_honesty_texts_come_from_the_database(client: TestClient) -> None:
    body = client.get("/api/v1/clinic").json()
    assert body["demoNotice"] == DEMO_NOTICE
    assert body["credit"]["href"] == CREDIT_HREF
    assert body["isSample"] is True


def test_changing_the_name_changes_response_and_etag(
    client: TestClient, db_session: Session
) -> None:
    first = client.get("/api/v1/clinic")
    db_session.execute(text("UPDATE clinic_settings SET name = 'Another Clinic'"))
    second = client.get("/api/v1/clinic")
    assert second.json()["name"] == "Another Clinic"
    assert second.headers["etag"] != first.headers["etag"]


def test_missing_settings_is_503_not_configured(client: TestClient, db_session: Session) -> None:
    db_session.execute(text("DELETE FROM clinic_settings"))
    response = client.get("/api/v1/clinic")
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "not_configured"
    assert response.headers["cache-control"] == "no-store"


def test_malformed_stored_json_is_a_generic_500(client: TestClient, db_session: Session) -> None:
    db_session.execute(text("""UPDATE clinic_settings SET emergency_phone = '{"secret": "x"}'"""))
    response = client.get("/api/v1/clinic")
    assert response.status_code == 500
    assert response.json()["error"]["code"] == "internal_error"
    assert "secret" not in response.text


def test_rules_are_active_and_ordered(client: TestClient) -> None:
    body = client.get("/api/v1/clinic/rules").json()
    expected = sorted(extras()["clinicRules"], key=lambda r: r["sortOrder"])
    assert body["total"] == 5
    assert [r["text"] for r in body["items"]] == [r["text"] for r in expected]
    assert [r["sortOrder"] for r in body["items"]] == [1, 2, 3, 4, 5]
    assert all(r["isSample"] is True for r in body["items"])


def test_inactive_rule_is_hidden(client: TestClient, db_session: Session) -> None:
    db_session.execute(text("UPDATE clinic_rule SET is_active = false WHERE sort_order = 2"))
    body = client.get("/api/v1/clinic/rules").json()
    assert body["total"] == 4
    assert [r["sortOrder"] for r in body["items"]] == [1, 3, 4, 5]


def test_rules_paging_and_validation(client: TestClient) -> None:
    body = client.get("/api/v1/clinic/rules", params={"pageSize": 2, "page": 3}).json()
    assert (body["total"], len(body["items"])) == (5, 1)
    assert client.get("/api/v1/clinic/rules", params={"pageSize": 101}).status_code == 422


def test_conditional_requests(client: TestClient) -> None:
    for path in ("/api/v1/clinic", "/api/v1/clinic/rules"):
        etag = client.get(path).headers["etag"]
        assert client.get(path, headers={"If-None-Match": etag}).status_code == 304
