from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlmodel import Session

from tests.api.parity import assert_subset, load_catalog

pytestmark = pytest.mark.db

SKIP = frozenset({"id"})


def mock_packages() -> list[dict[str, Any]]:
    packages: list[dict[str, Any]] = load_catalog()["healthPackages"]
    return packages


def test_list_matches_mock_in_order(client: TestClient) -> None:
    body = client.get("/api/v1/health-packages").json()
    mock = mock_packages()
    assert body["total"] == 5
    assert [p["slug"] for p in body["items"]] == [p["slug"] for p in mock]
    for api_item, mock_item in zip(body["items"], mock, strict=True):
        assert_subset(api_item, mock_item, SKIP)


def test_detail_includes_tests_in_package_order(client: TestClient) -> None:
    mock = mock_packages()[0]
    response = client.get(f"/api/v1/health-packages/{mock['slug']}")
    assert response.status_code == 200
    body = response.json()
    assert_subset(body, mock, SKIP)
    assert [t["slug"] for t in body["tests"]] == mock["testSlugs"] == body["testSlugs"]

    api_tests = {
        t["slug"]: t
        for t in client.get("/api/v1/lab-tests", params={"pageSize": 100}).json()["items"]
    }
    for summary in body["tests"]:
        full = api_tests[summary["slug"]]
        assert summary == {
            "id": full["id"],
            "slug": full["slug"],
            "name": full["name"],
            "pricePkr": full["pricePkr"],
            "homeCollection": full["homeCollection"],
        }


def test_no_derived_sum_or_saving_is_returned(client: TestClient) -> None:
    body = client.get(f"/api/v1/health-packages/{mock_packages()[0]['slug']}").json()
    assert not {"sumPkr", "savingPkr", "totalPkr"} & body.keys()


def test_inactive_test_is_omitted_but_price_is_unchanged(
    client: TestClient, db_session: Session
) -> None:
    mock = mock_packages()[0]
    removed = mock["testSlugs"][0]
    db_session.execute(
        text("UPDATE lab_test SET is_active = false WHERE slug = :s"), {"s": removed}
    )
    body = client.get(f"/api/v1/health-packages/{mock['slug']}").json()
    assert body["testSlugs"] == mock["testSlugs"][1:]
    assert [t["slug"] for t in body["tests"]] == mock["testSlugs"][1:]
    assert body["packagePricePkr"] == mock["packagePricePkr"]


def test_inactive_package_is_hidden(client: TestClient, db_session: Session) -> None:
    slug = mock_packages()[0]["slug"]
    db_session.execute(
        text("UPDATE health_package SET is_active = false WHERE slug = :s"), {"s": slug}
    )
    assert client.get("/api/v1/health-packages").json()["total"] == 4
    assert client.get(f"/api/v1/health-packages/{slug}").status_code == 404


def test_unknown_slug_is_404(client: TestClient) -> None:
    response = client.get("/api/v1/health-packages/nope")
    assert response.status_code == 404
    assert response.json()["error"]["message"] == "Health package not found."


def test_paging_and_validation(client: TestClient) -> None:
    body = client.get("/api/v1/health-packages", params={"pageSize": 2, "page": 3}).json()
    assert (body["total"], len(body["items"])) == (5, 1)
    response = client.get("/api/v1/health-packages", params={"page": "abc"})
    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["field"] == "page"


def test_conditional_request(client: TestClient) -> None:
    slug = mock_packages()[0]["slug"]
    first = client.get(f"/api/v1/health-packages/{slug}")
    second = client.get(
        f"/api/v1/health-packages/{slug}", headers={"If-None-Match": first.headers["etag"]}
    )
    assert second.status_code == 304
