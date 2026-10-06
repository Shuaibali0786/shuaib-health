import pytest

from app.command_centre.masking import initials, mask_email, mask_mobile, short_name


@pytest.mark.parametrize(
    ("full", "short", "short_initials"),
    [
        ("Ayesha Khan", "Ayesha K.", "A.K."),
        ("ayesha khan", "Ayesha K.", "A.K."),
        ("Muhammad Ali Raza", "Muhammad R.", "M.R."),
        ("Sana", "Sana", "S."),
        ("  Bilal   Ahmed  ", "Bilal A.", "B.A."),
        ("Zoya O'Neil", "Zoya O.", "Z.O."),
    ],
)
def test_short_name_and_initials(full: str, short: str, short_initials: str) -> None:
    assert short_name(full) == short
    assert initials(full) == short_initials


def test_blank_names_do_not_crash() -> None:
    assert short_name("") == ""
    assert initials("   ") == ""


def test_phone_is_the_005_mask() -> None:
    assert mask_mobile("+923001234567") == "0300****567"


@pytest.mark.parametrize(
    ("email", "masked"),
    [("ayesha@gmail.com", "a****@g****.com"), ("a.k@mail.example.org", "a****@m****.org")],
)
def test_email_mask(email: str, masked: str) -> None:
    assert mask_email(email) == masked


def test_malformed_email_is_fully_hidden() -> None:
    assert mask_email("not-an-email") == "****"
