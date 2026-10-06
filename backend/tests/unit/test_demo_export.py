"""The committed demo fixture is exactly what the generator produces (no mock API drift)."""

import json
from datetime import date, time

from app.demo import export_fixture

DAY = date(2026, 10, 5)
AT = time(11, 20)


def test_the_export_is_deterministic() -> None:
    first = export_fixture.build_fixture(DAY, AT)
    assert first == export_fixture.build_fixture(DAY, AT)
    assert first["meta"]["now"] == "2026-10-05T06:20:45Z"
    assert first["viewer"]["sessionExpiresAt"] == "2026-10-05T08:20:45Z"
    assert all(b["reference"].startswith("D") for b in first["bookings"])
    assert {b["status"] for b in first["bookings"]} >= {"confirmed", "completed"}


def test_the_committed_fixture_matches_the_generator() -> None:
    committed = json.loads(export_fixture.DEFAULT_OUT.read_text(encoding="utf-8"))
    assert committed == export_fixture.build_fixture(DAY, AT), (
        "run: uv run python -m app.demo.export_fixture --date 2026-10-05 --now 11:20"
    )
