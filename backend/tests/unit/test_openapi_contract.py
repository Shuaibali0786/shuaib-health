"""The committed contract (specs/003-catalog-api/contracts/openapi.yaml) and the app agree.

Checks paths and methods, query parameters, documented error statuses, and the property names
of every response schema that exists under the same name in both. The /api/v1/admin/* operations are
checked by tests/api/test_admin_contract.py.
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
HTTP_METHODS = {"get", "post", "put", "patch", "delete", "options", "head"}


@pytest.fixture(scope="module")
def contract() -> dict[str, Any]:
    data: dict[str, Any] = yaml.safe_load(CONTRACT.read_text(encoding="utf-8"))
    return data


@pytest.fixture
def generated(settings_factory: SettingsFactory) -> dict[str, Any]:
    return create_app(settings_factory()).openapi()


def operations(spec: dict[str, Any]) -> dict[tuple[str, str], dict[str, Any]]:
    return {
        (path, method): op
        for path, item in spec["paths"].items()
        for method, op in item.items()
        if method in HTTP_METHODS and not path.startswith("/api/v1/admin/")
    }


def resolve(spec: dict[str, Any], node: dict[str, Any]) -> dict[str, Any]:
    while "$ref" in node:
        target: Any = spec
        for part in node["$ref"].lstrip("#/").split("/"):
            target = target[part]
        node = target
    return node


def query_parameter_names(spec: dict[str, Any], op: dict[str, Any]) -> set[str]:
    resolved = [resolve(spec, p) for p in op.get("parameters", [])]
    return {p["name"] for p in resolved if p["in"] == "query"}


def flat_properties(spec: dict[str, Any], schema: dict[str, Any]) -> set[str]:
    schema = resolve(spec, schema)
    names = set(schema.get("properties", {}))
    for part in schema.get("allOf", []):
        names |= flat_properties(spec, part)
    return names


def test_same_paths_and_methods(contract: dict[str, Any], generated: dict[str, Any]) -> None:
    assert set(operations(contract)) == set(operations(generated))


def test_same_query_parameters(contract: dict[str, Any], generated: dict[str, Any]) -> None:
    generated_ops = operations(generated)
    for key, op in operations(contract).items():
        assert query_parameter_names(contract, op) == query_parameter_names(
            generated, generated_ops[key]
        ), key


def test_documented_error_statuses_are_covered(
    contract: dict[str, Any], generated: dict[str, Any]
) -> None:
    generated_ops = operations(generated)
    for key, op in operations(contract).items():
        promised = set(op["responses"]) - {"304"}  # 304 is HTTP caching, not a body schema
        assert promised <= set(generated_ops[key]["responses"]), key


def test_response_schemas_have_the_same_properties(
    contract: dict[str, Any], generated: dict[str, Any]
) -> None:
    shared = [
        name
        for name in contract["components"]["schemas"]
        if name in generated["components"]["schemas"]
    ]
    for expected in (
        "Department",
        "Doctor",
        "ScheduleSession",
        "LabTestCategory",
        "LabTest",
        "LabTestSummary",
        "HealthPackage",
        "HealthPackageDetail",
        "ClinicSettings",
        "ClinicRule",
        "PhoneNumber",
        "OpeningHoursRule",
        "ImageAsset",
        "Slot",
        "SlotDay",
        "DoctorSlots",
        "AppointmentCreate",
        "AppointmentView",
        "BookingConflict",
        "ErrorInfo",
    ):
        assert expected in shared, f"{expected} missing from the generated schema"
    for name in shared:
        contract_props = flat_properties(contract, contract["components"]["schemas"][name])
        generated_props = flat_properties(generated, generated["components"]["schemas"][name])
        assert contract_props == generated_props, name


def test_required_properties_are_required_in_generated_schemas(
    contract: dict[str, Any], generated: dict[str, Any]
) -> None:
    for name in ("Department", "Doctor", "LabTest", "HealthPackage", "ClinicSettings"):
        required_in_contract = set(contract["components"]["schemas"][name]["required"])
        required_in_app = set(generated["components"]["schemas"][name].get("required", []))
        assert required_in_contract <= required_in_app, name
