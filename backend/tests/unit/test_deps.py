from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.deps import ClientIpDep, require_proxy_secret
from app.errors import register_exception_handlers
from tests.conftest import SettingsFactory

SECRET = "test-proxy-secret-0123456789abcdef"  # same value as settings_factory
ALLOWED = "http://localhost:3000"


def make_client(settings_factory: SettingsFactory) -> TestClient:
    app = FastAPI()
    app.state.settings = settings_factory(cors_origins=ALLOWED)
    register_exception_handlers(app)

    @app.post("/guarded", dependencies=[Depends(require_proxy_secret)])
    def guarded(ip: ClientIpDep) -> dict[str, str]:
        return {"ip": ip}

    return TestClient(app)


def test_valid_secret_without_origin_is_accepted(settings_factory: SettingsFactory) -> None:
    client = make_client(settings_factory)
    response = client.post("/guarded", headers={"X-Proxy-Secret": SECRET})
    assert response.status_code == 200


def test_valid_secret_with_a_foreign_origin_is_forbidden(
    settings_factory: SettingsFactory,
) -> None:
    client = make_client(settings_factory)
    headers = {"X-Proxy-Secret": SECRET, "Origin": "https://evil.example"}
    response = client.post("/guarded", headers=headers)
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "forbidden"


def test_valid_secret_with_an_allowed_origin_is_accepted(
    settings_factory: SettingsFactory,
) -> None:
    client = make_client(settings_factory)
    headers = {"X-Proxy-Secret": SECRET, "Origin": ALLOWED}
    assert client.post("/guarded", headers=headers).status_code == 200


def test_missing_or_wrong_secret_is_forbidden(settings_factory: SettingsFactory) -> None:
    client = make_client(settings_factory)
    assert client.post("/guarded").status_code == 403
    assert client.post("/guarded", headers={"X-Proxy-Secret": "wrong"}).status_code == 403
    assert client.post("/guarded", headers={"X-Proxy-Secret": SECRET[:-1]}).status_code == 403
    # An allowed Origin alone is not enough: the secret is always required.
    assert client.post("/guarded", headers={"Origin": ALLOWED}).status_code == 403


def test_forbidden_body_does_not_echo_the_secret(settings_factory: SettingsFactory) -> None:
    client = make_client(settings_factory)
    response = client.post("/guarded", headers={"X-Proxy-Secret": "wrong-secret-value"})
    assert "wrong-secret-value" not in response.text
    assert SECRET not in response.text


def test_client_ip_dependency_uses_the_reported_ip_only_with_the_secret(
    settings_factory: SettingsFactory,
) -> None:
    client = make_client(settings_factory)
    headers = {"X-Proxy-Secret": SECRET, "X-Client-IP": "203.0.113.9"}
    assert client.post("/guarded", headers=headers).json() == {"ip": "203.0.113.9"}
