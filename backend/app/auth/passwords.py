"""Argon2id password hashing and the password policy (ADR-0007, research R2).

Everything here is pure: no database, no clock. ``verify_password`` never raises, so a malformed
stored hash simply fails to verify.
"""

from functools import lru_cache
from pathlib import Path

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

MIN_LENGTH = 12
MAX_LENGTH = 128
_MIN_LOCAL_PART = 4
_COMMON_FILE = Path(__file__).parent / "data" / "common-passwords.txt"

_hasher = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=1)

# Verified against for unknown or inactive accounts so every sign-in costs about the same.
DUMMY_HASH = _hasher.hash("dummy-password-for-timing-equalisation")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(stored_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(stored_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def verify_dummy(password: str) -> bool:
    """Spend the same time as a real verification. Always False."""
    verify_password(DUMMY_HASH, password)
    return False


def needs_rehash(stored_hash: str) -> bool:
    return _hasher.check_needs_rehash(stored_hash)


@lru_cache
def common_passwords() -> frozenset[str]:
    lines = _COMMON_FILE.read_text(encoding="utf-8").splitlines()
    return frozenset(line.strip().lower() for line in lines if line.strip())


def check_policy(password: str, *, email: str, current_hash: str | None = None) -> str | None:
    """The first policy reason the password breaks, or ``None`` when it is acceptable.

    Reasons: ``too_short``, ``too_long``, ``too_common``, ``contains_email``, ``same_as_current``.
    """
    if len(password) < MIN_LENGTH:
        return "too_short"
    if len(password) > MAX_LENGTH:
        return "too_long"
    if password.lower() in common_passwords():
        return "too_common"
    local = email.strip().lower().split("@", 1)[0]
    if len(local) >= _MIN_LOCAL_PART and local in password.lower():
        return "contains_email"
    if current_hash is not None and verify_password(current_hash, password):
        return "same_as_current"
    return None
