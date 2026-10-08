"""Opaque session tokens and the session-bound CSRF token (ADR-0007, research R1/R4).

Only HMACs are stored or compared; the tokens themselves are never persisted. Staff tokens start
``cs_`` and demo tokens ``cd_``, so a lookup goes to exactly one table.
"""

import base64
import hashlib
import hmac
import secrets
import uuid
from typing import Literal

from pydantic import SecretStr

STAFF_PREFIX = "cs_"
DEMO_PREFIX = "cd_"

TokenKind = Literal["staff", "demo"]


def new_staff_token() -> str:
    return STAFF_PREFIX + secrets.token_urlsafe(32)


def new_demo_token() -> str:
    return DEMO_PREFIX + secrets.token_urlsafe(32)


def token_kind(token: str) -> TokenKind | None:
    if token.startswith(STAFF_PREFIX) and len(token) > len(STAFF_PREFIX):
        return "staff"
    if token.startswith(DEMO_PREFIX) and len(token) > len(DEMO_PREFIX):
        return "demo"
    return None


def _hmac(key: SecretStr, message: str) -> bytes:
    return hmac.new(key.get_secret_value().encode(), message.encode(), hashlib.sha256).digest()


def hash_token(key: SecretStr, token: str) -> str:
    """Hex HMAC-SHA256 of the token: the only form that reaches the database."""
    return _hmac(key, token).hex()


def csrf_token(key: SecretStr, session_id: uuid.UUID) -> str:
    """Derived, never stored: a new session has a new id, so it invalidates the old token."""
    digest = _hmac(key, f"csrf:{session_id}")
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode()


def verify_csrf(key: SecretStr, session_id: uuid.UUID, presented: str | None) -> bool:
    if not presented:
        return False
    expected = csrf_token(key, session_id).encode()
    return hmac.compare_digest(presented.encode("utf-8"), expected)
