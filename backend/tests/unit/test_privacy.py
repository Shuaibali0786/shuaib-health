from pydantic import SecretStr

from app.booking.privacy import fingerprint, hmac_hex, request_hash

KEY = SecretStr("k" * 32)
OTHER_KEY = SecretStr("o" * 32)


def test_hmac_is_deterministic_and_truncated() -> None:
    first = hmac_hex(KEY, "booking:ip", "203.0.113.9")
    assert first == hmac_hex(KEY, "booking:ip", "203.0.113.9")
    assert len(first) == 32
    assert len(hmac_hex(KEY, "booking:ip", "203.0.113.9", 8)) == 8
    assert all(c in "0123456789abcdef" for c in first)


def test_namespaces_and_keys_separate_the_hashes() -> None:
    value = "203.0.113.9"
    assert hmac_hex(KEY, "booking:ip", value) != hmac_hex(KEY, "lookup:ip", value)
    assert hmac_hex(KEY, "booking:ip", value) != hmac_hex(OTHER_KEY, "booking:ip", value)


def test_output_does_not_contain_the_input() -> None:
    assert "203.0.113.9" not in hmac_hex(KEY, "booking:ip", "203.0.113.9")
    assert "+923001234567" not in hmac_hex(KEY, "booking:phone", "+923001234567")
    assert "k" * 8 not in hmac_hex(KEY, "x", "y")


def test_fingerprint_is_16_hex_and_stable() -> None:
    value = fingerprint(KEY, "2001:db8::1")
    assert len(value) == 16
    assert value == fingerprint(KEY, "2001:db8::1")
    assert value != fingerprint(KEY, "2001:db8::2")


def test_request_hash_ignores_key_order_and_changes_with_content() -> None:
    a = request_hash({"name": "Ali Khan", "reason": None})
    assert a == request_hash({"reason": None, "name": "Ali Khan"})
    assert a != request_hash({"name": "Ali Khan", "reason": "cough"})
    assert len(a) == 64
    assert "Ali" not in a
