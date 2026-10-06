import time

import pytest

from app.auth import passwords
from app.auth.passwords import (
    DUMMY_HASH,
    check_policy,
    hash_password,
    needs_rehash,
    verify_dummy,
    verify_password,
)

GOOD = "Tr1cky-Horse-Battery"


def test_hash_is_argon2id_and_verifies() -> None:
    hashed = hash_password(GOOD)
    assert hashed.startswith("$argon2id$")
    assert verify_password(hashed, GOOD)
    assert not verify_password(hashed, GOOD + "x")


def test_hashes_are_salted() -> None:
    assert hash_password(GOOD) != hash_password(GOOD)


def test_verify_never_raises_on_a_malformed_hash() -> None:
    assert not verify_password("not-a-hash", GOOD)
    assert not verify_password("", GOOD)


def test_needs_rehash_flags_weaker_parameters() -> None:
    from argon2 import PasswordHasher

    weak = PasswordHasher(time_cost=1, memory_cost=8, parallelism=1).hash(GOOD)
    assert needs_rehash(weak)
    assert not needs_rehash(hash_password(GOOD))


def test_dummy_hash_is_a_valid_argon2id_hash_that_never_matches() -> None:
    assert DUMMY_HASH.startswith("$argon2id$")
    assert not verify_dummy("anything")


def test_dummy_verify_costs_about_as_much_as_a_real_one() -> None:
    real = hash_password(GOOD)
    started = time.perf_counter()
    verify_password(real, "wrong")
    real_time = time.perf_counter() - started
    started = time.perf_counter()
    verify_dummy("wrong")
    dummy_time = time.perf_counter() - started
    assert 0.3 < dummy_time / real_time < 3


@pytest.mark.parametrize(
    ("password", "reason"),
    [
        ("short1!", "too_short"),
        ("a" * 129, "too_long"),
        ("password1234", "too_common"),
        ("Qwertyuiop12", "too_common"),
        ("ayesha-is-here-1", "contains_email"),
        ("AYESHA.khan.2026", "contains_email"),
    ],
)
def test_policy_rejects(password: str, reason: str) -> None:
    assert check_policy(password, email="ayesha.khan@example.org") == reason or (
        reason == "contains_email" and check_policy(password, email="ayesha@example.org")
    )


def test_policy_rejects_the_email_local_part_case_insensitively() -> None:
    assert check_policy("Sunny-AYESHA-day-9", email="ayesha@example.org") == "contains_email"


def test_policy_accepts_a_good_password() -> None:
    assert check_policy(GOOD, email="ayesha@example.org") is None
    assert check_policy("a" * 128, email="ayesha@example.org") is None
    assert check_policy("x9" * 6, email="ayesha@example.org") is None


def test_policy_rejects_the_current_password() -> None:
    current = hash_password(GOOD)
    assert check_policy(GOOD, email="ayesha@example.org", current_hash=current) == "same_as_current"
    assert check_policy(GOOD + "2", email="ayesha@example.org", current_hash=current) is None


def test_short_email_local_parts_are_not_used_for_the_contains_rule() -> None:
    # "al" would match almost anything; only local parts of 4+ characters count.
    assert check_policy("Tr1cky-Horse-Battery", email="al@example.org") is None


def test_common_password_list_is_loaded_lower_case() -> None:
    assert "password1234" in passwords.common_passwords()
    assert all(p == p.lower() for p in passwords.common_passwords())


def test_common_password_list_is_large_and_within_policy_length() -> None:
    common = passwords.common_passwords()
    assert len(common) >= 25_000
    assert all(passwords.MIN_LENGTH <= len(p) <= passwords.MAX_LENGTH for p in common)
