"""One-way hashes so that no raw IP, phone number or request body is stored or logged."""

import hashlib
import hmac
import json
from collections.abc import Mapping

from pydantic import SecretStr


def hmac_hex(key: SecretStr, namespace: str, value: str, length: int = 32) -> str:
    """HMAC-SHA256 of ``value``, separated by ``namespace``, as hex truncated to ``length``."""
    message = f"{namespace}:{value}".encode()
    digest = hmac.new(key.get_secret_value().encode(), message, hashlib.sha256).hexdigest()
    return digest[:length]


def fingerprint(key: SecretStr, ip: str) -> str:
    """A 16-hex-character, non-reversible identifier of a client IP (for the audit log)."""
    return hmac_hex(key, "fingerprint", ip, 16)


def request_hash(payload: Mapping[str, str | None]) -> str:
    """SHA-256 of the canonical JSON of the normalized request (sorted keys, no whitespace)."""
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canonical.encode()).hexdigest()
