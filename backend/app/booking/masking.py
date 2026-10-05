"""What the confirmation page may show: a hint of the name and number, never the full values."""

MAX_NAME_WORDS = 3
MASK = "****"


def mask_name(name: str) -> str:
    """Initial of each of the first three words, then ``****``: ``Ali Khan`` -> ``A**** K****``."""
    return " ".join(f"{word[0]}{MASK}" for word in name.split()[:MAX_NAME_WORDS])


def mask_mobile(e164: str) -> str:
    """``+923001234567`` -> ``0300****567`` (local form: first four and last three digits)."""
    local = "0" + e164.removeprefix("+92")
    return f"{local[:4]}{MASK}{local[-3:]}"
