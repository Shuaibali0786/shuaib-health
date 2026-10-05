from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlmodel import Session

from tests.api.parity import assert_subset, load_catalog

pytestmark = pytest.mark.db

SKIP = frozenset({"id", "categoryId", "relatedDepartmentIds"})


def mock_tests() -> list[dict[str, Any]]:
    tests: list[dict[str, Any]] = load_catalog()["labTests"]
    return tests


def all_tests(client: TestClient) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = client.get("/api/v1/lab-tests", params={"pageSize": 100}).json()[
        "items"
    ]
    return items


def test_categories_match_mock_in_order(client: TestClient) -> None:
    body = client.get("/api/v1/lab-test-categories").json()
    mock = load_catalog()["labTestCategories"]
    assert body["total"] == 9
    assert [c["slug"] for c in body["items"]] == [c["slug"] for c in mock]
    for api_item, mock_item in zip(body["items"], mock, strict=True):
        assert_subset(api_item, mock_item, frozenset({"id"}))


def test_list_matches_mock(client: TestClient) -> None:
    body = client.get("/api/v1/lab-tests", params={"pageSize": 100}).json()
    mock = mock_tests()
    assert body["total"] == 26
    assert [t["slug"] for t in body["items"]] == [t["slug"] for t in mock]

    category_slug_by_api_id = {
        c["id"]: c["slug"] for c in client.get("/api/v1/lab-test-categories").json()["items"]
    }
    mock_category_slug = {c["id"]: c["slug"] for c in load_catalog()["labTestCategories"]}
    department_slug_by_api_id = {
        d["id"]: d["slug"]
        for d in client.get("/api/v1/departments", params={"pageSize": 100}).json()["items"]
    }
    mock_department_slug = {d["id"]: d["slug"] for d in load_catalog()["departments"]}

    for api_item, mock_item in zip(body["items"], mock, strict=True):
        assert_subset(api_item, mock_item, SKIP)
        assert (
            category_slug_by_api_id[api_item["categoryId"]]
            == mock_category_slug[mock_item["categoryId"]]
        )
        assert [department_slug_by_api_id[i] for i in api_item["relatedDepartmentIds"]] == [
            mock_department_slug[i] for i in mock_item["relatedDepartmentIds"]
        ]


def test_default_page_size_is_20(client: TestClient) -> None:
    body = client.get("/api/v1/lab-tests").json()
    assert (body["total"], body["pageSize"], len(body["items"])) == (26, 20, 20)
    second = client.get("/api/v1/lab-tests", params={"page": 2}).json()
    assert len(second["items"]) == 6


def test_search_by_name(client: TestClient) -> None:
    body = client.get("/api/v1/lab-tests", params={"q": "hba1c"}).json()
    assert body["total"] >= 1
    assert any("hba1c" in (t["name"] + " ".join(t["alsoKnownAs"])).lower() for t in body["items"])


def test_search_by_also_known_as(client: TestClient) -> None:
    # An alias that is not part of the test's own name, so only the alias match can find it.
    target, alias = next(
        (t, a) for t in mock_tests() for a in t["alsoKnownAs"] if a.lower() not in t["name"].lower()
    )
    body = client.get("/api/v1/lab-tests", params={"q": alias.upper()}).json()
    assert target["slug"] in {t["slug"] for t in body["items"]}


@pytest.mark.parametrize("term", ["%", "_", "\\", "' OR 1=1 --"])
def test_search_special_characters_are_literal(client: TestClient, term: str) -> None:
    response = client.get("/api/v1/lab-tests", params={"q": term, "pageSize": 100})
    assert response.status_code == 200
    assert response.json()["total"] == 0


def test_category_filter(client: TestClient) -> None:
    mock_category = {c["slug"]: c["id"] for c in load_catalog()["labTestCategories"]}["thyroid"]
    expected = {t["slug"] for t in mock_tests() if t["categoryId"] == mock_category}
    assert expected
    body = client.get("/api/v1/lab-tests", params={"category": "thyroid"}).json()
    assert {t["slug"] for t in body["items"]} == expected


def test_unknown_category_is_empty_not_error(client: TestClient) -> None:
    response = client.get("/api/v1/lab-tests", params={"category": "nope"})
    assert response.status_code == 200
    assert response.json()["items"] == []


def test_search_and_category_combine(client: TestClient) -> None:
    body = client.get("/api/v1/lab-tests", params={"q": "a", "category": "urine"}).json()
    assert body["total"] >= 1
    assert all(t["slug"] in {m["slug"] for m in mock_tests()} for t in body["items"])


def test_detail_matches_mock(client: TestClient) -> None:
    mock = mock_tests()[0]
    response = client.get(f"/api/v1/lab-tests/{mock['slug']}")
    assert response.status_code == 200
    assert_subset(response.json(), mock, SKIP)
    assert response.json()["relatedDepartmentIds"]


def test_unknown_slug_is_404(client: TestClient) -> None:
    response = client.get("/api/v1/lab-tests/nope")
    assert response.status_code == 404
    assert response.json()["error"]["message"] == "Lab test not found."


@pytest.mark.parametrize(
    ("params", "field"),
    [
        ({"q": "x" * 61}, "q"),
        ({"category": "Bad Slug"}, "category"),
        ({"pageSize": 101}, "pageSize"),
    ],
)
def test_invalid_params_are_422(client: TestClient, params: dict[str, Any], field: str) -> None:
    response = client.get("/api/v1/lab-tests", params=params)
    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["field"] == field


def test_inactive_test_is_hidden(client: TestClient, db_session: Session) -> None:
    slug = mock_tests()[0]["slug"]
    db_session.execute(text("UPDATE lab_test SET is_active = false WHERE slug = :s"), {"s": slug})
    assert client.get("/api/v1/lab-tests", params={"pageSize": 100}).json()["total"] == 25
    assert client.get(f"/api/v1/lab-tests/{slug}").status_code == 404


def test_inactive_department_is_omitted_from_related_ids(
    client: TestClient, db_session: Session
) -> None:
    test = mock_tests()[0]
    before = client.get(f"/api/v1/lab-tests/{test['slug']}").json()["relatedDepartmentIds"]
    db_session.execute(
        text("UPDATE department SET is_active = false WHERE id = :i"), {"i": before[0]}
    )
    after = client.get(f"/api/v1/lab-tests/{test['slug']}").json()["relatedDepartmentIds"]
    assert after == before[1:]


def test_conditional_request(client: TestClient) -> None:
    first = client.get("/api/v1/lab-tests")
    second = client.get("/api/v1/lab-tests", headers={"If-None-Match": first.headers["etag"]})
    assert second.status_code == 304
