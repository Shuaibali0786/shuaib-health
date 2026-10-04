"""Booking input rules. The phone cases are shared with the frontend (research R9)."""

import json
from pathlib import Path

import pytest

from app.booking.validation import clean_email, clean_name, clean_reason, normalize_pk_mobile

CASES = json.loads(
    (
        Path(__file__).resolve().parents[3]
        / "specs"
        / "005-appointment-booking"
        / "contracts"
        / "fixtures"
        / "phone-cases.json"
    ).read_text(encoding="utf-8")
)["cases"]


@pytest.mark.parametrize("case", CASES, ids=[c["input"] or "<empty>" for c in CASES])
def test_phone_cases(case: dict[str, str | None]) -> None:
    assert normalize_pk_mobile(str(case["input"])) == case["normalized"]


@pytest.mark.parametrize(
    "name", ["Ali Khan", "علی خان", "Shaista O'Brien", "Anne-Marie", "Dr. Ali", "Ñandú Pérez"]
)
def test_names_in_any_script_with_apostrophes_and_hyphens_are_accepted(name: str) -> None:
    assert clean_name(name) == name


@pytest.mark.parametrize(
    "name", ["Ali 2", "<script>", "A", "", " ", "x" * 81, "Ali\nKhan", "Ali_Khan", "Ali@Khan"]
)
def test_bad_names_are_rejected(name: str) -> None:
    with pytest.raises(ValueError):
        clean_name(name)


def test_names_are_trimmed_and_inner_spaces_collapsed() -> None:
    assert clean_name("  Ali   Khan  ") == "Ali Khan"
    assert clean_name("x" * 80) == "x" * 80


def test_email_is_lowercased_and_empty_becomes_none() -> None:
    assert clean_email("  Ali@Example.COM ") == "ali@example.com"
    assert clean_email("") is None
    assert clean_email("   ") is None
    assert clean_email(None) is None


@pytest.mark.parametrize("email", ["not-an-email", "a@b", "a b@c.de", "@x.com", "a@@x.com"])
def test_bad_email_is_rejected(email: str) -> None:
    with pytest.raises(ValueError):
        clean_email(email)


def test_email_longer_than_254_is_rejected() -> None:
    with pytest.raises(ValueError):
        clean_email("a" * 250 + "@b.co")


def test_reason_allows_300_characters_and_rejects_301() -> None:
    assert clean_reason("x" * 300) == "x" * 300
    with pytest.raises(ValueError):
        clean_reason("x" * 301)


def test_reason_strips_control_characters_and_empty_becomes_none() -> None:
    assert clean_reason("Cough\x00 and\x07 fever") == "Cough and fever"
    assert clean_reason("line one\nline two\tend") == "line one line two end"
    assert clean_reason("   ") is None
    assert clean_reason("\x00\x01") is None
    assert clean_reason(None) is None


def test_error_messages_never_contain_the_input() -> None:
    for call, value in ((clean_name, "<b>secret-name</b>"), (clean_email, "secret-not-email")):
        with pytest.raises(ValueError) as error:
            call(value)
        assert "secret" not in str(error.value)
