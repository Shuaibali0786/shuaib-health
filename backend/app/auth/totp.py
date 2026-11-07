"""Time-based one-time codes (RFC 4226 HOTP + RFC 6238 TOTP), standard library only (Feature 011).

The settings every authenticator app supports: HMAC-SHA1, 6 digits, a 30-second step. A code from
one step before or after the current one is accepted for phone clock drift. A step that was already
used for the account is refused, so a code cannot be replayed.
"""

import base64
import hashlib
import hmac
import secrets
import struct
from typing import Literal
from urllib.parse import quote

DIGITS = 6
PERIOD = 30
WINDOW = 1
SECRET_BYTES = 20

Verdict = Literal["ok", "replay", "wrong"]


def new_secret() -> bytes:
    return secrets.token_bytes(SECRET_BYTES)


def to_base32(secret: bytes) -> str:
    """The setup key shown to the person: unpadded base32, as authenticator apps expect."""
    return base64.b32encode(secret).decode("ascii").rstrip("=")


def hotp(secret: bytes, counter: int, digits: int = DIGITS) -> str:
    mac = hmac.new(secret, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = mac[-1] & 0x0F
    value = struct.unpack(">I", mac[offset : offset + 4])[0] & 0x7FFFFFFF
    return f"{value % 10**digits:0{digits}d}"


def step_at(unix_seconds: float) -> int:
    return int(unix_seconds // PERIOD)


def code_at(secret: bytes, unix_seconds: float, digits: int = DIGITS) -> str:
    return hotp(secret, step_at(unix_seconds), digits)


def normalise_code(code: str) -> str | None:
    """Six digits, ignoring spaces; anything else is not a code."""
    cleaned = code.replace(" ", "")
    return cleaned if len(cleaned) == DIGITS and cleaned.isascii() and cleaned.isdigit() else None


def verify(
    secret: bytes, code: str, unix_seconds: float, last_step: int | None
) -> tuple[Verdict, int | None]:
    """Check ``code`` around ``unix_seconds``; returns the matched step on "ok"."""
    typed = normalise_code(code)
    if typed is None:
        return "wrong", None
    current = step_at(unix_seconds)
    matched: int | None = None
    for step in range(current - WINDOW, current + WINDOW + 1):
        # Compare every candidate so the time taken does not reveal which step matched.
        if hmac.compare_digest(hotp(secret, step), typed) and matched is None:
            matched = step
    if matched is None:
        return "wrong", None
    if last_step is not None and matched <= last_step:
        return "replay", None
    return "ok", matched


def otpauth_uri(secret: bytes, account: str, issuer: str) -> str:
    """The link a QR code carries so an authenticator app can add the account."""
    label = quote(f"{issuer}:{account}", safe="@")
    return (
        f"otpauth://totp/{label}?secret={to_base32(secret)}&issuer={quote(issuer, safe='')}"
        f"&algorithm=SHA1&digits={DIGITS}&period={PERIOD}"
    )
