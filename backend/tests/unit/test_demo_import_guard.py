"""SC-005: the demo can never read real bookings, because it cannot reach them."""

import ast
import importlib
from pathlib import Path

import pytest

FORBIDDEN_PREFIXES = (
    "app.repositories",
    "app.models",
    "app.db",
    "sqlmodel",
    "sqlalchemy",
    "psycopg",
)
MODULES = ("app.demo.demo_source", "app.demo.generator", "app.demo.names")


def imported_names(module: str) -> set[str]:
    path = Path(importlib.import_module(module).__file__ or "")
    names: set[str] = set()
    for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
        if isinstance(node, ast.Import):
            names.update(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom):
            base = node.module or ""
            names.add(base)
            names.update(f"{base}.{alias.name}" for alias in node.names)
    return names


@pytest.mark.parametrize("module", MODULES)
def test_demo_modules_import_no_database_code(module: str) -> None:
    found = imported_names(module)
    assert [n for n in found if n.startswith(FORBIDDEN_PREFIXES)] == []
    assert not any(n == "Appointment" or n.endswith(".Appointment") for n in found)
