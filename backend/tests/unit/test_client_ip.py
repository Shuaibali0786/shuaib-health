from starlette.types import Scope

from app.middleware.rate_limit import client_ip

SECRET = "s" * 32


def scope(headers: dict[str, str], peer: str = "10.0.0.7") -> Scope:
    return {
        "type": "http",
        "client": (peer, 5000),
        "headers": [(k.lower().encode(), v.encode()) for k, v in headers.items()],
    }


def test_valid_secret_uses_the_reported_ip() -> None:
    headers = {"X-Proxy-Secret": SECRET, "X-Client-IP": "203.0.113.9"}
    assert client_ip(scope(headers), 0, SECRET) == "203.0.113.9"


def test_valid_secret_accepts_ipv6() -> None:
    headers = {"X-Proxy-Secret": SECRET, "X-Client-IP": "2001:db8::1"}
    assert client_ip(scope(headers), 0, SECRET) == "2001:db8::1"


def test_wrong_secret_uses_the_socket_address() -> None:
    headers = {"X-Proxy-Secret": "x" * 32, "X-Client-IP": "203.0.113.9"}
    assert client_ip(scope(headers), 0, SECRET) == "10.0.0.7"


def test_missing_secret_header_uses_the_socket_address() -> None:
    assert client_ip(scope({"X-Client-IP": "203.0.113.9"}), 0, SECRET) == "10.0.0.7"


def test_no_configured_secret_never_trusts_the_header() -> None:
    headers = {"X-Proxy-Secret": SECRET, "X-Client-IP": "203.0.113.9"}
    assert client_ip(scope(headers), 0, None) == "10.0.0.7"
    assert client_ip(scope(headers), 0, "") == "10.0.0.7"


def test_invalid_reported_ip_falls_back_to_the_socket_address() -> None:
    headers = {"X-Proxy-Secret": SECRET, "X-Client-IP": "not-an-ip"}
    assert client_ip(scope(headers), 0, SECRET) == "10.0.0.7"


def test_forwarded_for_behaviour_is_unchanged() -> None:
    headers = {"X-Forwarded-For": "198.51.100.1, 203.0.113.9"}
    assert client_ip(scope(headers), 0) == "10.0.0.7"
    assert client_ip(scope(headers), 1) == "203.0.113.9"
    assert client_ip(scope(headers), 2) == "198.51.100.1"
    assert client_ip(scope(headers), 3) == "10.0.0.7"
    assert client_ip(scope({"X-Forwarded-For": "junk"}), 1) == "10.0.0.7"


def test_secret_with_invalid_ip_still_honours_forwarded_for_hops() -> None:
    headers = {
        "X-Proxy-Secret": SECRET,
        "X-Client-IP": "bad",
        "X-Forwarded-For": "203.0.113.9",
    }
    assert client_ip(scope(headers), 1, SECRET) == "203.0.113.9"


def test_missing_peer_is_unknown() -> None:
    assert client_ip({"type": "http", "headers": []}, 0, SECRET) == "unknown"
