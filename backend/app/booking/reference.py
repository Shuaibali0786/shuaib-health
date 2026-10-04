"""Booking references: ten Crockford base32 characters, shown as ``XXXXX-XXXXX``."""

import re
import secrets

ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"  # no I, L, O or U
LENGTH = 10
_VALID = re.compile(f"[{ALPHABET}]{{{LENGTH}}}")


def new_reference() -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(LENGTH))


def display(reference: str) -> str:
    return f"{reference[:5]}-{reference[5:]}"


def parse(text: str) -> str | None:
    """The stored form of ``text`` (case, one dash and spaces are ignored), or ``None``."""
    candidate = re.sub(r"[\s-]", "", text).upper()
    return candidate if _VALID.fullmatch(candidate) else None
