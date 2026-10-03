"""Compare API output with the frontend mock data (catalog.json) field by field."""

import json
from pathlib import Path
from typing import Any

CATALOG_PATH = Path(__file__).resolve().parents[2] / "app" / "seed" / "data" / "catalog.json"


def load_catalog() -> dict[str, Any]:
    data: dict[str, Any] = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    return data


def assert_subset(api: object, mock: object, skip: frozenset[str], path: str = "") -> None:
    """Every key of ``mock`` must appear in ``api`` with an equal value.

    ``api`` may have additional keys (the additive fields). Keys in ``skip`` are not compared
    (ids and id references; those are checked separately).
    """
    if isinstance(mock, dict):
        assert isinstance(api, dict), f"{path}: expected object"
        for key, expected in mock.items():
            if key in skip:
                continue
            assert key in api, f"{path}.{key}: missing in API response"
            assert_subset(api[key], expected, skip, f"{path}.{key}")
    elif isinstance(mock, list):
        assert isinstance(api, list), f"{path}: expected list"
        assert len(api) == len(mock), f"{path}: length {len(api)} != {len(mock)}"
        for index, (api_item, mock_item) in enumerate(zip(api, mock, strict=True)):
            assert_subset(api_item, mock_item, skip, f"{path}[{index}]")
    else:
        assert api == mock, f"{path}: {api!r} != {mock!r}"
