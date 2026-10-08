"""Every /api/v1/admin route has a row in ENDPOINT_POLICIES and the matching require_viewer
dependency, and every row names a real route (research R6, SC-004). Rows whose routes belong to a
later story are tolerated only while the contract test lists them as pending."""

import re
from collections.abc import Iterator
from typing import Any

from fastapi.routing import APIRoute

from app.auth.policies import ENDPOINT_POLICIES, Policy
from app.main import API_PREFIX, create_app
from tests.api.test_admin_contract import CONTRACT_OPERATIONS, PENDING_ADMIN_OPERATIONS
from tests.conftest import SettingsFactory

PARAM = re.compile(r"\{[^}]+\}")


def _shape(path: str) -> str:
    return PARAM.sub("{}", path)


def _leaf_routes(routes: Any) -> Iterator[APIRoute]:
    """Leaf routes of an app, through FastAPI's nested include nodes. Admin routers carry their own
    ``/admin`` prefix, so a leaf path starts with ``/admin/`` whatever the include prefix is."""
    for route in routes:
        original = getattr(route, "original_router", None)
        if original is not None:
            yield from _leaf_routes(original.routes)
        elif isinstance(route, APIRoute):
            yield route


def _admin_routes(settings_factory: SettingsFactory) -> dict[tuple[str, str], APIRoute]:
    app = create_app(settings_factory())
    found: dict[tuple[str, str], APIRoute] = {}
    for route in _leaf_routes(app.router.routes):
        if route.path.startswith("/admin/"):
            for method in route.methods or ():
                found[(method, _shape(route.path))] = route
    served = {
        (method.upper(), _shape(path.removeprefix(API_PREFIX)))
        for path, item in app.openapi()["paths"].items()
        if path.startswith(f"{API_PREFIX}/admin/")
        for method in item
    }
    assert served == set(found), "an /api/v1/admin route is outside the admin routers"
    return found


def _policy_of(route: APIRoute) -> Policy | None:
    policies: list[Policy] = []

    def walk(dependant: Any) -> None:
        for sub in dependant.dependencies:
            policy = getattr(sub.call, "policy", None)
            if isinstance(policy, Policy):
                policies.append(policy)
            walk(sub)

    walk(route.dependant)
    return policies[0] if len(policies) == 1 else None


def test_every_admin_route_is_in_the_table_with_its_dependency(
    settings_factory: SettingsFactory,
) -> None:
    table = {(method, _shape(path)): policy for (method, path), policy in ENDPOINT_POLICIES.items()}
    for key, route in _admin_routes(settings_factory).items():
        assert key in table, f"{key} has no row in ENDPOINT_POLICIES"
        assert _policy_of(route) is table[key], f"{key} lacks require_viewer({table[key].value})"


def test_every_table_row_names_a_real_route_or_a_pending_one(
    settings_factory: SettingsFactory,
) -> None:
    routes = set(_admin_routes(settings_factory))
    pending = {
        (method.upper(), _shape(path.removeprefix(API_PREFIX)))
        for (path, method), op in CONTRACT_OPERATIONS.items()
        if op["operationId"] in PENDING_ADMIN_OPERATIONS
    }
    for method, path in ENDPOINT_POLICIES:
        key = (method, _shape(path))
        assert key in routes or key in pending, f"{key} is neither a route nor a pending operation"


def test_the_table_matches_the_contracts_x_policy() -> None:
    for (path, method), op in CONTRACT_OPERATIONS.items():
        key = (method.upper(), path.removeprefix(API_PREFIX))
        policy = ENDPOINT_POLICIES.get(key)
        assert policy is not None, f"{key} is in the contract but not in the table"
        declared = op["x-policy"].split()[0]
        assert policy.value == declared, f"{key}: table says {policy.value}, contract {declared}"
    assert len(ENDPOINT_POLICIES) == len(CONTRACT_OPERATIONS)
