import pytest

from app.booking.masking import mask_mobile, mask_name


@pytest.mark.parametrize(
    ("name", "masked"),
    [
        ("Ali Khan", "A**** K****"),
        ("Muhammad Ali Raza Khan", "M**** A**** R****"),
        ("علی", "ع****"),
        ("  Sara   Ahmed ", "S**** A****"),
        ("Madonna", "M****"),
    ],
)
def test_mask_name(name: str, masked: str) -> None:
    assert mask_name(name) == masked


def test_mask_name_never_leaks_more_than_the_first_letter_of_three_words() -> None:
    masked = mask_name("Muhammad Ali Raza Khan")
    assert "uhammad" not in masked
    assert "Khan" not in masked


def test_mask_mobile() -> None:
    assert mask_mobile("+923001234567") == "0300****567"
    assert mask_mobile("+923451234567") == "0345****567"
