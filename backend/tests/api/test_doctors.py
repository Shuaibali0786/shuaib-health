import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlmodel import Session

from tests.api.parity import assert_subset, load_catalog

pytestmark = pytest.mark.db

SKIP = frozenset({"id", "departmentId"})
SLOT_MINUTES = 15


def mock_doctors() -> list[dict[str, object]]:
    doctors: list[dict[str, object]] = load_catalog()["doctors"]
    return doctors


def department_slug_by_api_id(client: TestClient) -> dict[str, str]:
    items = client.get("/api/v1/departments").json()["items"]
    return {d["id"]: d["slug"] for d in items}


def test_list_matches_mock_in_order(client: TestClient) -> None:
    response = client.get("/api/v1/doctors")
    assert response.status_code == 200
    body = response.json()
    mock = mock_doctors()
    assert body["total"] == 9
    assert [d["slug"] for d in body["items"]] == [d["slug"] for d in mock]

    mock_department_slug = {d["id"]: d["slug"] for d in load_catalog()["departments"]}
    api_department_slug = department_slug_by_api_id(client)
    for api_item, mock_item in zip(body["items"], mock, strict=True):
        assert_subset(api_item, mock_item, SKIP)
        assert (
            api_department_slug[api_item["departmentId"]]
            == mock_department_slug[str(mock_item["departmentId"])]
        )
        assert all(s["slotMinutes"] == SLOT_MINUTES for s in api_item["schedule"])


def test_detail_has_ordered_schedule(client: TestClient) -> None:
    response = client.get("/api/v1/doctors/dr-hassan-mirza")
    assert response.status_code == 200
    mock = next(d for d in mock_doctors() if d["slug"] == "dr-hassan-mirza")
    assert_subset(response.json(), mock, SKIP)
    days = [s["day"] for s in response.json()["schedule"]]
    assert days == sorted(days, key=["mon", "tue", "wed", "thu", "fri", "sat", "sun"].index)


def test_filter_by_department(client: TestClient) -> None:
    body = client.get("/api/v1/doctors", params={"department": "cardiology"}).json()
    mock_department = {d["slug"]: d["id"] for d in load_catalog()["departments"]}["cardiology"]
    expected = {d["slug"] for d in mock_doctors() if d["departmentId"] == mock_department}
    assert expected
    assert {d["slug"] for d in body["items"]} == expected
    assert body["total"] == len(expected)


def test_unknown_department_filter_is_empty_not_error(client: TestClient) -> None:
    response = client.get("/api/v1/doctors", params={"department": "nope"})
    assert response.status_code == 200
    assert response.json()["items"] == []


def test_search_by_name_is_case_insensitive(client: TestClient) -> None:
    body = client.get("/api/v1/doctors", params={"q": "HASSAN"}).json()
    assert [d["slug"] for d in body["items"]] == ["dr-hassan-mirza"]


@pytest.mark.parametrize("term", ["%", "_", "\\", "'; DROP TABLE doctor; --"])
def test_search_special_characters_are_literal(client: TestClient, term: str) -> None:
    response = client.get("/api/v1/doctors", params={"q": term})
    assert response.status_code == 200
    assert response.json()["items"] == []
    assert client.get("/api/v1/doctors").json()["total"] == 9


def test_filter_by_weekday(client: TestClient) -> None:
    body = client.get("/api/v1/doctors", params={"day": "fri"}).json()
    expected = {
        d["slug"]
        for d in mock_doctors()
        if any(s["day"] == "fri" for s in d["schedule"])  # type: ignore[attr-defined]
    }
    assert expected
    assert {d["slug"] for d in body["items"]} == expected


def test_combined_filters(client: TestClient) -> None:
    body = client.get(
        "/api/v1/doctors", params={"department": "general-medicine", "day": "mon"}
    ).json()
    assert [d["slug"] for d in body["items"]] == ["dr-hassan-mirza"]


@pytest.mark.parametrize(
    ("params", "field"),
    [
        ({"q": "x" * 61}, "q"),
        ({"day": "funday"}, "day"),
        ({"department": "Bad Slug"}, "department"),
        ({"pageSize": 500}, "pageSize"),
    ],
)
def test_invalid_params_are_422_naming_the_field(
    client: TestClient, params: dict[str, object], field: str
) -> None:
    response = client.get("/api/v1/doctors", params=params)
    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["field"] == field
    assert "x" * 61 not in response.text


def test_unknown_slug_is_404(client: TestClient) -> None:
    response = client.get("/api/v1/doctors/dr-nobody")
    assert response.status_code == 404
    assert response.json()["error"]["message"] == "Doctor not found."


def test_inactive_doctor_is_hidden(client: TestClient, db_session: Session) -> None:
    db_session.execute(text("UPDATE doctor SET is_active = false WHERE slug = 'dr-hassan-mirza'"))
    assert client.get("/api/v1/doctors").json()["total"] == 8
    assert client.get("/api/v1/doctors/dr-hassan-mirza").status_code == 404


def test_doctor_of_inactive_department_is_hidden(client: TestClient, db_session: Session) -> None:
    db_session.execute(text("UPDATE department SET is_active = false WHERE slug = 'cardiology'"))
    assert client.get("/api/v1/doctors/dr-imran-qureshi").status_code == 404
    assert "dr-imran-qureshi" not in {
        d["slug"] for d in client.get("/api/v1/doctors").json()["items"]
    }


def test_doctor_without_schedule_has_empty_schedule(
    client: TestClient, db_session: Session
) -> None:
    db_session.execute(
        text(
            "DELETE FROM doctor_weekly_schedule WHERE doctor_id = "
            "(SELECT id FROM doctor WHERE slug = 'dr-hassan-mirza')"
        )
    )
    assert client.get("/api/v1/doctors/dr-hassan-mirza").json()["schedule"] == []


def test_paging(client: TestClient) -> None:
    body = client.get("/api/v1/doctors", params={"pageSize": 4, "page": 3}).json()
    assert body["total"] == 9
    assert len(body["items"]) == 1
    assert body["page"] == 3
    assert body["pageSize"] == 4


def test_conditional_request(client: TestClient) -> None:
    etag = client.get("/api/v1/doctors/dr-hassan-mirza").headers["etag"]
    response = client.get("/api/v1/doctors/dr-hassan-mirza", headers={"If-None-Match": etag})
    assert response.status_code == 304
