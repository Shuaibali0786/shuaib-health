"""Export one demo day as JSON for the website's mock API and tests.

    uv run python -m app.demo.export_fixture --date 2026-10-05 --now 11:20

The output (``frontend/tests/fixtures/admin/demo-day.json`` by default) is what the backend's demo
source would give a visitor on that date at that clinic time, so the mock API, the design preview and
the real demo agree. Each story that adds a demo read route extends this file. Nothing here touches
the database.
"""

import argparse
import json
import sys
from collections.abc import Sequence
from datetime import UTC, date, datetime, time, timedelta
from pathlib import Path
from typing import Any

from app.command_centre.masking import short_name
from app.demo import generator
from app.demo.demo_source import DemoSource

CLINIC_TZ = "Asia/Karachi"
DEFAULT_OUT = Path(__file__).resolve().parents[3] / "frontend/tests/fixtures/admin/demo-day.json"
SECONDS = 45  # the mock clock rests at hh:mm:45, matching the end-to-end tests' paused clock
SESSION_HOURS = 2


def _iso(moment: datetime) -> str:
    return moment.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def build_fixture(demo_date: date, clinic_time: time) -> dict[str, Any]:
    source = DemoSource(demo_date)
    local_now = datetime.combine(demo_date, clinic_time.replace(second=SECONDS), tzinfo=generator.KARACHI)
    now = local_now.astimezone(UTC)
    day = [b for b in source.dataset.bookings if b.starts_at.astimezone(generator.KARACHI).date() == demo_date]
    return {
        "meta": {
            "date": demo_date.isoformat(),
            "now": _iso(now),
            "timezone": CLINIC_TZ,
            "slotMinutes": generator.SLOT_MINUTES,
            "catalogEtag": source.dataset.catalog_etag,
        },
        "viewer": {
            "kind": "demo",
            "csrfToken": "csrf-demo-fixture",
            "clinicToday": demo_date.isoformat(),
            "timezone": CLINIC_TZ,
            "sessionExpiresAt": _iso(now + timedelta(hours=SESSION_HOURS)),
        },
        "staff": [
            {
                "id": str(member.id),
                "email": member.email,
                "displayName": member.display_name,
                "role": member.role,
                "isActive": True,
                "isSample": True,
            }
            for member in source.staff()
        ],
        "bookings": [
            {
                "reference": b.reference,
                "startsAt": _iso(b.starts_at),
                "endsAt": _iso(b.ends_at),
                "localDate": demo_date.isoformat(),
                "localTime": b.starts_at.astimezone(generator.KARACHI).strftime("%H:%M"),
                "status": b.status_at(now),
                "patientNameMasked": short_name(f"{b.patient_first} {b.patient_last}"),
                "doctorSlug": b.doctor_slug,
                "doctorName": b.doctor_name,
                "department": b.department,
                "isSample": True,
            }
            for b in sorted(day, key=lambda item: (item.starts_at, item.doctor_slug))
        ],
    }


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0] if __doc__ else None)
    parser.add_argument("--date", required=True, type=date.fromisoformat, help="clinic date, YYYY-MM-DD")
    parser.add_argument("--now", required=True, type=time.fromisoformat, help="clinic time, HH:MM")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args(argv)
    text = json.dumps(build_fixture(args.date, args.now), indent=2, ensure_ascii=False) + "\n"
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(text, encoding="utf-8", newline="\n")
    print(f"Wrote {args.out.name} ({len(text)} bytes).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
