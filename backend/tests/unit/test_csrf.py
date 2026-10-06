import uuid

from pydantic import SecretStr

from app.auth import tokens

KEY = SecretStr("k" * 32)


def test_csrf_is_deterministic_per_session_and_url_safe() -> None:
    session = uuid.uuid4()
    first = tokens.csrf_token(KEY, session)
    assert first == tokens.csrf_token(KEY, session)
    assert first.replace("-", "").replace("_", "").isalnum()
    assert "=" not in first


def test_csrf_is_bound_to_the_session_and_the_secret() -> None:
    a, b = uuid.uuid4(), uuid.uuid4()
    assert tokens.csrf_token(KEY, a) != tokens.csrf_token(KEY, b)
    assert tokens.csrf_token(KEY, a) != tokens.csrf_token(SecretStr("z" * 32), a)


def test_verify_accepts_only_the_exact_token() -> None:
    session = uuid.uuid4()
    good = tokens.csrf_token(KEY, session)
    assert tokens.verify_csrf(KEY, session, good)
    assert not tokens.verify_csrf(KEY, session, good[:-1] + ("A" if good[-1] != "A" else "B"))
    assert not tokens.verify_csrf(KEY, uuid.uuid4(), good)
    assert not tokens.verify_csrf(KEY, session, "")
    assert not tokens.verify_csrf(KEY, session, None)
    assert not tokens.verify_csrf(KEY, session, "é" * 40)


def test_csrf_is_not_the_session_token_hash() -> None:
    session = uuid.uuid4()
    assert tokens.csrf_token(KEY, session) != tokens.hash_token(KEY, str(session))
