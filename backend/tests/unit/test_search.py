from app.repositories._common import escape_like


def test_plain_text_is_wrapped() -> None:
    assert escape_like("hassan") == "%hassan%"


def test_wildcards_are_escaped() -> None:
    assert escape_like("50%") == "%50\\%%"
    assert escape_like("a_b") == "%a\\_b%"


def test_backslash_is_escaped_first() -> None:
    assert escape_like("a\\b") == "%a\\\\b%"
    assert escape_like("\\%") == "%\\\\\\%%"
