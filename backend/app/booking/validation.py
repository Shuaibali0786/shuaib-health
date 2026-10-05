"""Booking input rules. The server is authoritative; the browser repeats them for UX only.

Every ``ValueError`` carries a short reason and never the input, so a message can be logged or
returned safely.
"""

import re
import unicodedata

_PHONE_NOISE = re.compile(r"[ \t\r\n\-.()]")
_PK_MOBILE = re.compile(r"(?:\+92|0092|92|0)(3[0-9]{9})")
_EMAIL = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")
CURLY_APOSTROPHE = chr(0x2019)
_NAME_PUNCTUATION = frozenset(f" .'-{CURLY_APOSTROPHE}")  # space, dot, apostrophes, hyphen

NAME_MIN, NAME_MAX = 2, 80
EMAIL_MAX = 254
REASON_MAX = 300


def normalize_pk_mobile(raw: str) -> str | None:
    """A Pakistani mobile as ``+923XXXXXXXXX``, or ``None`` when it is not one (research R9)."""
    found = _PK_MOBILE.fullmatch(_PHONE_NOISE.sub("", raw))
    return None if found is None else f"+92{found.group(1)}"


def clean_name(raw: str) -> str:
    """Letters in any script (and their marks), spaces, dots, apostrophes and hyphens; 2 to 80."""
    if any(unicodedata.category(c) == "Cc" for c in raw):
        raise ValueError("name contains control characters")
    name = " ".join(raw.split())
    if not NAME_MIN <= len(name) <= NAME_MAX:
        raise ValueError(f"name must be {NAME_MIN} to {NAME_MAX} characters")
    for char in name:
        if char in _NAME_PUNCTUATION or unicodedata.category(char)[0] in {"L", "M"}:
            continue
        raise ValueError("name may contain letters, spaces, . ' and - only")
    return name


def clean_email(raw: str | None) -> str | None:
    """Lower-cased, or ``None`` when empty. Only a simple ``local@domain.tld`` shape is required."""
    if raw is None:
        return None
    email = raw.strip().lower()
    if not email:
        return None
    if len(email) > EMAIL_MAX or _EMAIL.fullmatch(email) is None:
        raise ValueError("email is not valid")
    return email


def clean_reason(raw: str | None) -> str | None:
    """Plain text up to 300 characters. Line breaks and tabs become spaces; other controls go."""
    if raw is None:
        return None
    kept: list[str] = []
    for char in raw:
        if char in "\r\n\t":
            kept.append(" ")
        elif unicodedata.category(char) != "Cc":
            kept.append(char)
    reason = "".join(kept).strip()
    if not reason:
        return None
    if len(reason) > REASON_MAX:
        raise ValueError(f"reason must be at most {REASON_MAX} characters")
    return reason
