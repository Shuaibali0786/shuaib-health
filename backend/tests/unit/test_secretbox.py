"""Encryption of the authenticator secret and backup-code handling (Feature 011, FR-003/FR-012)."""

import base64
import secrets
import uuid

import pytest

from app.auth import secretbox
from tests.conftest import SettingsFactory

KEY = secrets.token_bytes(32)


def test_round_trip_and_ciphertext_hides_the_secret() -> None:
    staff = uuid.uuid4()
    secret = secrets.token_bytes(20)
    stored = secretbox.encrypt(KEY, staff, secret)
    assert stored.startswith("v1.")
    assert secret.hex() not in stored and base64.b32encode(secret).decode() not in stored
    assert secretbox.decrypt(KEY, staff, stored) == secret
    assert secretbox.encrypt(KEY, staff, secret) != stored  # fresh nonce every time


def test_wrong_account_wrong_key_or_tampering_is_refused() -> None:
    staff = uuid.uuid4()
    stored = secretbox.encrypt(KEY, staff, b"x" * 20)
    with pytest.raises(secretbox.SecretUnreadable):
        secretbox.decrypt(KEY, uuid.uuid4(), stored)
    with pytest.raises(secretbox.SecretUnreadable):
        secretbox.decrypt(secrets.token_bytes(32), staff, stored)
    flipped = stored[:-2] + ("A" if stored[-2] != "A" else "B") + stored[-1]
    with pytest.raises(secretbox.SecretUnreadable):
        secretbox.decrypt(KEY, staff, flipped)
    with pytest.raises(secretbox.SecretUnreadable):
        secretbox.decrypt(KEY, staff, "v0." + stored[3:])


def test_backup_codes_have_the_documented_shape_and_alphabet() -> None:
    codes = {secretbox.new_backup_code() for _ in range(200)}
    assert len(codes) == 200
    for code in codes:
        assert len(code) == 11 and code[5] == "-"
        assert all(ch in secretbox.BACKUP_ALPHABET for ch in code.replace("-", ""))
    assert not set("01ILOU") & set(secretbox.BACKUP_ALPHABET)


@pytest.mark.parametrize(
    ("typed", "expected"),
    [("abcde-fghjk", "ABCDEFGHJK"), (" ABCDE FGHJK ", "ABCDEFGHJK"), ("ABCDEFGHJK", "ABCDEFGHJK")],
)
def test_backup_code_input_is_normalised(typed: str, expected: str) -> None:
    assert secretbox.normalise_backup_code(typed) == expected


@pytest.mark.parametrize("typed", ["", "ABCDE-FGHJ", "ABCDE-FGHJKL", "ABCDE-FGHI0", "123456"])
def test_malformed_backup_codes_are_refused(typed: str) -> None:
    assert secretbox.normalise_backup_code(typed) is None


def test_backup_code_hash_is_keyed_and_stable() -> None:
    first = secretbox.backup_code_hash(KEY, "ABCDEFGHJK")
    assert first == secretbox.backup_code_hash(KEY, "ABCDEFGHJK")
    assert len(first) == 64 and "ABCDEFGHJK" not in first
    assert first != secretbox.backup_code_hash(secrets.token_bytes(32), "ABCDEFGHJK")


def test_key_setting_must_be_32_bytes_of_base64(settings_factory: SettingsFactory) -> None:
    assert secretbox.key_from(settings_factory()) is None
    good = base64.b64encode(KEY).decode()
    assert secretbox.key_from(settings_factory(two_factor_key=good)) == KEY
    assert secretbox.key_from(settings_factory(two_factor_key="  ")) is None
    for bad in ("short", base64.b64encode(b"x" * 16).decode(), "not base64 at all!!"):
        with pytest.raises(ValueError, match="TWO_FACTOR_KEY"):
            settings_factory(two_factor_key=bad)
