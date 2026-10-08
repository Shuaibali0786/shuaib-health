import re

from pydantic import SecretStr

from app.auth import tokens

KEY = SecretStr("k" * 32)
OTHER = SecretStr("o" * 32)


def test_staff_and_demo_tokens_have_their_prefix_and_enough_entropy() -> None:
    staff = tokens.new_staff_token()
    demo = tokens.new_demo_token()
    assert staff.startswith("cs_") and demo.startswith("cd_")
    assert len(staff) >= 46 and len(demo) >= 46
    assert re.fullmatch(r"cs_[A-Za-z0-9_-]+", staff)


def test_tokens_are_unique() -> None:
    assert len({tokens.new_staff_token() for _ in range(200)}) == 200


def test_kind_is_read_from_the_prefix() -> None:
    assert tokens.token_kind(tokens.new_staff_token()) == "staff"
    assert tokens.token_kind(tokens.new_demo_token()) == "demo"
    assert tokens.token_kind("xx_abc") is None
    assert tokens.token_kind("") is None
    assert tokens.token_kind("cs_") is None


def test_hash_is_hex_hmac_sha256_keyed_by_the_secret() -> None:
    token = tokens.new_staff_token()
    digest = tokens.hash_token(KEY, token)
    assert re.fullmatch(r"[0-9a-f]{64}", digest)
    assert digest == tokens.hash_token(KEY, token)
    assert digest != tokens.hash_token(OTHER, token)
    assert token not in digest


def test_a_staff_token_never_hashes_like_its_demo_swap() -> None:
    body = "A" * 43
    assert tokens.hash_token(KEY, "cs_" + body) != tokens.hash_token(KEY, "cd_" + body)
