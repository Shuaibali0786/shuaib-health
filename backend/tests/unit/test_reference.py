import pytest

from app.booking.reference import ALPHABET, SAFE_ALPHABET, display, new_reference, parse


def test_alphabet_is_crockford_base32() -> None:
    assert len(ALPHABET) == 32
    assert not set("ILOU") & set(ALPHABET)


def test_new_reference_is_ten_characters_from_the_alphabet() -> None:
    ref = new_reference()
    assert len(ref) == 10
    assert set(ref) <= set(ALPHABET)


def test_display_groups_in_fives() -> None:
    assert display("ABCDE12345") == "ABCDE-12345"


@pytest.mark.parametrize(
    "text",
    ["ABCDE12345", "abcde12345", "ABCDE-12345", "abcde-12345", " ABCDE 12345 ", "ab cde-12345"],
)
def test_parse_accepts_case_dash_and_spaces(text: str) -> None:
    assert parse(text) == "ABCDE12345"


@pytest.mark.parametrize(
    "text",
    [
        "",
        "ABCDE1234",
        "ABCDE123456",
        "ABCDI12345",
        "ABCDL12345",
        "ABCDO12345",
        "ABCDU12345",
        "ABCDE-1234!",
    ],
)
def test_parse_rejects_bad_references(text: str) -> None:
    assert parse(text) is None


def test_ten_thousand_references_are_unique() -> None:
    assert len({new_reference() for _ in range(10_000)}) == 10_000


def test_new_references_avoid_look_alike_characters() -> None:
    assert len(SAFE_ALPHABET) == 30 and set(SAFE_ALPHABET) <= set(ALPHABET)
    assert not set("01OILU") & set(SAFE_ALPHABET)
    drawn = "".join(new_reference() for _ in range(5_000))
    assert not set("01OILU") & set(drawn)
    assert set(drawn) == set(SAFE_ALPHABET)  # and every safe character does get used


@pytest.mark.parametrize("old", ["0123456789", "ABCD0E1FGH", "abcd0e1fgh", "ABCD0-E1FGH"])
def test_existing_references_with_zero_or_one_stay_valid(old: str) -> None:
    assert parse(old) == old.replace("-", "").upper()
