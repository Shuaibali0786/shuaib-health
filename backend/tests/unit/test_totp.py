"""RFC 6238 test vectors and the window/replay rules (Feature 011, FR-005)."""

import base64

import pytest

from app.auth import totp

RFC_SECRET = b"12345678901234567890"


@pytest.mark.parametrize(
    ("unix_seconds", "expected"),
    [
        (59, "94287082"),
        (1111111109, "07081804"),
        (1111111111, "14050471"),
        (1234567890, "89005924"),
        (2000000000, "69279037"),
        (20000000000, "65353130"),
    ],
)
def test_rfc6238_sha1_vectors(unix_seconds: int, expected: str) -> None:
    assert totp.code_at(RFC_SECRET, unix_seconds, digits=8) == expected


def test_rfc4226_hotp_vectors() -> None:
    expected = ["755224", "287082", "359152", "969429", "338314", "254676", "287922", "162583"]
    assert [totp.hotp(RFC_SECRET, counter) for counter in range(8)] == expected


def test_secret_is_160_bits_and_base32_round_trips() -> None:
    secret = totp.new_secret()
    assert len(secret) == 20
    shown = totp.to_base32(secret)
    assert "=" not in shown and len(shown) == 32
    assert base64.b32decode(shown) == secret


NOW = 1_800_000_015.0  # inside a step, not on a boundary


def test_current_and_adjacent_steps_are_accepted_others_are_not() -> None:
    secret = totp.new_secret()
    step = totp.step_at(NOW)
    for offset in (-1, 0, 1):
        verdict, matched = totp.verify(secret, totp.hotp(secret, step + offset), NOW, None)
        assert (verdict, matched) == ("ok", step + offset)
    for offset in (-2, 2):
        assert totp.verify(secret, totp.hotp(secret, step + offset), NOW, None) == ("wrong", None)


def test_a_used_step_or_an_earlier_one_is_a_replay() -> None:
    secret = totp.new_secret()
    step = totp.step_at(NOW)
    code = totp.hotp(secret, step)
    assert totp.verify(secret, code, NOW, last_step=step) == ("replay", None)
    assert totp.verify(secret, totp.hotp(secret, step - 1), NOW, last_step=step) == ("replay", None)
    assert totp.verify(secret, totp.hotp(secret, step + 1), NOW, last_step=step) == ("ok", step + 1)


@pytest.mark.parametrize("typed", ["", "12345", "1234567", "12a456", "١٢٣٤٥٦", "12 34 5"])
def test_malformed_codes_are_wrong(typed: str) -> None:
    assert totp.verify(totp.new_secret(), typed, NOW, None) == ("wrong", None)


def test_spaces_inside_a_code_are_ignored() -> None:
    secret = totp.new_secret()
    code = totp.code_at(secret, NOW)
    assert totp.verify(secret, f"{code[:3]} {code[3:]}", NOW, None)[0] == "ok"


def test_otpauth_uri_has_the_standard_parameters_and_escapes_the_label() -> None:
    uri = totp.otpauth_uri(RFC_SECRET, "admin@example.com", "Crescent Family Clinic")
    assert uri.startswith("otpauth://totp/Crescent%20Family%20Clinic%3Aadmin@example.com?")
    assert f"secret={totp.to_base32(RFC_SECRET)}" in uri
    for part in ("issuer=Crescent%20Family%20Clinic", "algorithm=SHA1", "digits=6", "period=30"):
        assert part in uri
    assert len(uri) < 200  # fits the website's QR encoder (version 10, level M)
