"""Protection for two-step sign-in data (Feature 011, research R2/R3).

- The authenticator secret is encrypted with AES-256-GCM under ``TWO_FACTOR_KEY``. The staff id is
  the associated data, so a ciphertext copied to another account does not decrypt.
- Backup codes are random (about 49 bits each). Only a keyed HMAC-SHA256 of each is stored.
"""

import base64
import hashlib
import hmac
import secrets
import uuid

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.settings import Settings

PREFIX = "v1."
NONCE_BYTES = 12
BACKUP_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789"  # no 0/O, 1/I/L, U/V look-alike pairs
BACKUP_LENGTH = 10
BACKUP_COUNT = 10


class SecretUnreadable(Exception):
    """The stored secret cannot be decrypted (wrong key, other account or tampering)."""


def key_from(settings: Settings) -> bytes | None:
    if settings.two_factor_key is None:
        return None
    return base64.b64decode(settings.two_factor_key.get_secret_value().strip())


def _aad(staff_id: uuid.UUID) -> bytes:
    return f"staff:{staff_id}".encode()


def encrypt(key: bytes, staff_id: uuid.UUID, secret: bytes) -> str:
    nonce = secrets.token_bytes(NONCE_BYTES)
    sealed = AESGCM(key).encrypt(nonce, secret, _aad(staff_id))
    return PREFIX + base64.urlsafe_b64encode(nonce + sealed).decode("ascii")


def decrypt(key: bytes, staff_id: uuid.UUID, stored: str) -> bytes:
    if not stored.startswith(PREFIX):
        raise SecretUnreadable
    try:
        raw = base64.urlsafe_b64decode(stored[len(PREFIX) :].encode("ascii"))
        return AESGCM(key).decrypt(raw[:NONCE_BYTES], raw[NONCE_BYTES:], _aad(staff_id))
    except (InvalidTag, ValueError) as error:
        raise SecretUnreadable from error


def new_backup_code() -> str:
    """``XXXXX-XXXXX`` from the look-alike-free alphabet."""
    chars = "".join(secrets.choice(BACKUP_ALPHABET) for _ in range(BACKUP_LENGTH))
    return f"{chars[:5]}-{chars[5:]}"


def normalise_backup_code(text: str) -> str | None:
    cleaned = text.upper().replace("-", "").replace(" ", "")
    if len(cleaned) != BACKUP_LENGTH or any(ch not in BACKUP_ALPHABET for ch in cleaned):
        return None
    return cleaned


def backup_code_hash(key: bytes, normalised: str) -> str:
    derived = hmac.new(key, b"backup-codes/v1", hashlib.sha256).digest()
    return hmac.new(derived, normalised.encode("ascii"), hashlib.sha256).hexdigest()
