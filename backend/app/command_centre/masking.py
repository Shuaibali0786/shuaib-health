"""Short masked forms for lists and cards. The phone mask is the 005 one; the drawer shows full
names, lists never do (FR-019)."""

from app.booking.masking import mask_mobile

__all__ = ["initials", "mask_email", "mask_mobile", "short_name"]

MASK = "****"


def _words(name: str) -> list[str]:
    return name.split()


def short_name(name: str) -> str:
    """``Ayesha Khan`` -> ``Ayesha K.``: the first name and the initial of the last word."""
    words = _words(name)
    if not words:
        return ""
    first = words[0].capitalize()
    return first if len(words) == 1 else f"{first} {words[-1][0].upper()}."


def initials(name: str) -> str:
    """``Ayesha Khan`` -> ``A.K.``: first and last word only."""
    words = _words(name)
    if not words:
        return ""
    picked = [words[0]] if len(words) == 1 else [words[0], words[-1]]
    return "".join(f"{word[0].upper()}." for word in picked)


def mask_email(email: str) -> str:
    """``ayesha@gmail.com`` -> ``a****@g****.com`` (first letters and the final domain label)."""
    local, at, domain = email.partition("@")
    if not at or not local or "." not in domain:
        return MASK
    return f"{local[0]}{MASK}@{domain[0]}{MASK}.{domain.rsplit('.', 1)[1]}"
