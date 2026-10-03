"""Constitution I: nothing fabricated is presented as real; every catalog item is a sample."""

from typing import Any

import pytest
from fastapi.testclient import TestClient

pytestmark = pytest.mark.db

DEMO_NOTICE = "Portfolio demo — not a real clinic, not medical advice."
LIST_PATHS = (
    "/api/v1/clinic/rules",
    "/api/v1/departments",
    "/api/v1/doctors",
    "/api/v1/lab-test-categories",
    "/api/v1/lab-tests",
    "/api/v1/health-packages",
)
# Categories carry no isSample flag in the frontend type; they are structure, not content.
NO_SAMPLE_FLAG = {"/api/v1/lab-test-categories"}


def all_items(client: TestClient, path: str) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    page = 1
    while True:
        body = client.get(path, params={"page": page, "pageSize": 7}).json()
        items.extend(body["items"])
        if len(items) >= body["total"] or not body["items"]:
            return items
        page += 1


@pytest.mark.parametrize("path", LIST_PATHS)
def test_every_listed_item_is_marked_as_sample(client: TestClient, path: str) -> None:
    items = all_items(client, path)
    assert items
    if path in NO_SAMPLE_FLAG:
        return
    assert all(item["isSample"] is True for item in items), path


def test_clinic_is_a_labelled_demo(client: TestClient) -> None:
    body = client.get("/api/v1/clinic").json()
    assert body["isSample"] is True
    assert body["demoNotice"] == DEMO_NOTICE


def test_catalog_text_makes_no_forbidden_claims(client: TestClient) -> None:
    forbidden = ("accredited", "award", "rated", "jci", "iso-certified", "patients served")
    for path in LIST_PATHS:
        text = " ".join(str(item).lower() for item in all_items(client, path))
        for word in forbidden:
            assert word not in text, f"{word!r} found in {path}"
