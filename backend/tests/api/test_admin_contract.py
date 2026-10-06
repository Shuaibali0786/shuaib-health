"""Every /api/v1/admin/* operation in the merged contract is served by the app, same shape.

The contract is specs/003-catalog-api/contracts/openapi.yaml (v1.2.0, merged from the 006 delta).
The existing test_openapi_contract.py skips the admin paths; this module owns them. Operations
whose routes are not built yet are listed in PENDING_ADMIN_OPERATIONS and expected to fail (strict
xfail), so each story that adds routes turns its tests green and must then remove its entries from
the set: an unexpectedly passing pending operation fails the run.
"""

from pathlib import Path
from typing import Any

import pytest
import yaml

from app.main import create_app
from tests.conftest import SettingsFactory

CONTRACT = (
    Path(__file__).resolve().parents[3] / "specs" / "003-catalog-api" / "contracts" / "openapi.yaml"
)
HTTP_METHODS = {"get", "post", "put", "patch", "delete"}
ADMIN_PREFIX = "/api/v1/admin/"

# operationId values whose routes do not exist yet. Remove an entry when its route lands.
PENDING_ADMIN_OPERATIONS: frozenset[str] = frozenset(
    {
        "adminSignIn",
        "adminDemoStart",
        "adminSignOut",
        "adminChangePassword",
        "adminLookups",
        "adminOverview",
        "adminBookingSearch",
        "adminBookingDetail",
        "adminBookingChangeStatus",
        "adminBookingUndoStatus",
        "adminBookingRevealPhone",
        "adminInsights",
        "adminDoctorsToday",
        "adminActivity",
        "adminStaffList",
        "adminStaffCreate",
        "adminStaffResetPassword",
        "adminStaffUpdate",
    }
)


def _load_contract() -> dict[str, Any]:
    data: dict[str, Any] = yaml.safe_load(CONTRACT.read_text(encoding="utf-8"))
    return data


def _admin_operations(spec: dict[str, Any]) -> dict[tuple[str, str], dict[str, Any]]:
    return {
        (path, method): op
        for path, item in spec["paths"].items()
        if path.startswith(ADMIN_PREFIX)
        for method, op in item.items()
        if method in HTTP_METHODS
    }


CONTRACT_OPERATIONS = _admin_operations(_load_contract())


def _resolve(spec: dict[str, Any], node: dict[str, Any]) -> dict[str, Any]:
    while "$ref" in node:
        target: Any = spec
        for part in node["$ref"].lstrip("#/").split("/"):
            target = target[part]
        node = target
    return node


def _flat_properties(spec: dict[str, Any], schema: dict[str, Any]) -> set[str]:
    schema = _resolve(spec, schema)
    names = set(schema.get("properties", {}))
    for part in schema.get("allOf", []):
        names |= _flat_properties(spec, part)
    return names


def _query_names(spec: dict[str, Any], op: dict[str, Any]) -> set[str]:
    resolved = [_resolve(spec, p) for p in op.get("parameters", [])]
    return {p["name"] for p in resolved if p["in"] == "query"}


def _json_schema(spec: dict[str, Any], response: dict[str, Any]) -> dict[str, Any] | None:
    content = _resolve(spec, response).get("content", {}).get("application/json")
    return content["schema"] if content else None


def _cases() -> list[Any]:
    cases = []
    for (path, method), op in sorted(CONTRACT_OPERATIONS.items()):
        marks = []
        if op["operationId"] in PENDING_ADMIN_OPERATIONS:
            marks.append(pytest.mark.xfail(strict=True, reason="admin route not built yet"))
        cases.append(pytest.param(path, method, id=f"{op['operationId']}", marks=marks))
    return cases


@pytest.fixture(scope="module")
def contract() -> dict[str, Any]:
    return _load_contract()


@pytest.fixture
def generated(settings_factory: SettingsFactory) -> dict[str, Any]:
    return create_app(settings_factory()).openapi()


def test_contract_declares_the_admin_surface(contract: dict[str, Any]) -> None:
    assert contract["info"]["version"] == "1.2.0"
    assert len(CONTRACT_OPERATIONS) == 19
    assert {op["operationId"] for op in CONTRACT_OPERATIONS.values()} >= PENDING_ADMIN_OPERATIONS


def test_the_app_serves_no_admin_operation_the_contract_does_not_declare(
    generated: dict[str, Any],
) -> None:
    extra = set(_admin_operations(generated)) - set(CONTRACT_OPERATIONS)
    assert not extra, f"undocumented admin operations: {sorted(extra)}"


@pytest.mark.parametrize(("path", "method"), _cases())
def test_admin_operation_matches_the_contract(
    contract: dict[str, Any], generated: dict[str, Any], path: str, method: str
) -> None:
    served = _admin_operations(generated)
    assert (path, method) in served, "route missing"
    expected, actual = CONTRACT_OPERATIONS[(path, method)], served[(path, method)]

    assert _query_names(contract, expected) == _query_names(generated, actual)

    promised = set(expected["responses"])
    assert promised <= set(actual["responses"]), (
        f"undocumented statuses: {sorted(promised - set(actual['responses']))}"
    )

    for status, response in expected["responses"].items():
        schema = _json_schema(contract, response)
        if schema is None:
            continue
        served_schema = _json_schema(generated, actual["responses"][status])
        assert served_schema is not None, f"{status} has no JSON body"
        assert _flat_properties(contract, schema) == _flat_properties(generated, served_schema), (
            status
        )
