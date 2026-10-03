"""Nothing about the clinic may be hard-coded in backend code (FR-001).

The forbidden values are read from the seed files, so this test is itself white-label.
"""

from pathlib import Path

from tests.api.parity import load_catalog

APP_DIR = Path(__file__).resolve().parents[2] / "app"
EXTRA_FORBIDDEN = ("Asia/Karachi", "Karachi")


def forbidden_values() -> set[str]:
    site = load_catalog()["siteConfig"]
    values = {
        site["name"],
        site["tagline"],
        site["fullTitle"],
        site["demoNotice"],
        site["emergencyPhone"]["tel"],
        site["emergencyPhone"]["display"],
        site["generalPhone"]["tel"],
        site["generalPhone"]["display"],
        site["credit"]["text"],
        site["timeZone"],
        "#0B2545",
        "#14B8A6",
        *site["address"],
        *EXTRA_FORBIDDEN,
    }
    return {v for v in values if v}


def test_no_clinic_values_in_backend_source() -> None:
    values = forbidden_values()
    assert len(values) >= 8
    offenders: list[str] = []
    for path in APP_DIR.rglob("*.py"):
        content = path.read_text(encoding="utf-8")
        offenders.extend(f"{path.relative_to(APP_DIR)}: {v}" for v in values if v in content)
    assert not offenders, "clinic values found in code:\n" + "\n".join(offenders)
