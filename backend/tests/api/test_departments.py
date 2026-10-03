import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlmodel import Session

from tests.api.parity import assert_subset, load_catalog

pytestmark = pytest.mark.db

SKIP = frozenset({"id"})


def test_list_matches_mock_in_order(client: TestClient) -> None:
    response = client.get("/api/v1/departments")
    assert response.status_code == 200
    body = response.json()
    mock = load_catalog()["departments"]
    assert (body["total"], body["page"], body["pageSize"]) == (7, 1, 20)
    assert [d["slug"] for d in body["items"]] == [d["slug"] for d in mock]
    for api_item, mock_item in zip(body["items"], mock, strict=True):
        assert_subset(api_item, mock_item, SKIP)
        assert len(api_item["id"]) == 36


def test_detail_matches_mock(client: TestClient) -> None:
    mock = next(d for d in load_catalog()["departments"] if d["slug"] == "cardiology")
    response = client.get("/api/v1/departments/cardiology")
    assert response.status_code == 200
    assert_subset(response.json(), mock, SKIP)


def test_unknown_slug_is_404(client: TestClient) -> None:
    response = client.get("/api/v1/departments/nope")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"
    assert response.json()["error"]["message"] == "Department not found."


def test_invalid_slug_is_422(client: TestClient) -> None:
    response = client.get("/api/v1/departments/Bad_Slug")
    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["field"] == "slug"


def test_paging(client: TestClient) -> None:
    page2 = client.get("/api/v1/departments", params={"pageSize": 3, "page": 2}).json()
    assert page2["total"] == 7
    assert len(page2["items"]) == 3
    slugs = [d["slug"] for d in load_catalog()["departments"]]
    assert [d["slug"] for d in page2["items"]] == slugs[3:6]
    past_end = client.get("/api/v1/departments", params={"page": 99}).json()
    assert past_end["items"] == []
    assert past_end["total"] == 7


@pytest.mark.parametrize(
    ("params", "field"),
    [({"pageSize": 101}, "pageSize"), ({"pageSize": 0}, "pageSize"), ({"page": 0}, "page")],
)
def test_bad_paging_is_422(client: TestClient, params: dict[str, int], field: str) -> None:
    response = client.get("/api/v1/departments", params=params)
    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["field"] == field


def test_inactive_department_is_hidden(client: TestClient, db_session: Session) -> None:
    db_session.execute(text("UPDATE department SET is_active = false WHERE slug = 'cardiology'"))
    assert client.get("/api/v1/departments").json()["total"] == 6
    assert client.get("/api/v1/departments/cardiology").status_code == 404


def test_inactive_related_test_is_omitted(client: TestClient, db_session: Session) -> None:
    before = client.get("/api/v1/departments/cardiology").json()["relatedTestSlugs"]
    db_session.execute(
        text("UPDATE lab_test SET is_active = false WHERE slug = :s"), {"s": before[0]}
    )
    after = client.get("/api/v1/departments/cardiology").json()["relatedTestSlugs"]
    assert after == before[1:]


def test_cache_headers_and_conditional_request(client: TestClient) -> None:
    first = client.get("/api/v1/departments")
    assert first.headers["cache-control"] == "public, max-age=300"
    etag = first.headers["etag"]
    second = client.get("/api/v1/departments", headers={"If-None-Match": etag})
    assert second.status_code == 304
    assert second.content == b""
