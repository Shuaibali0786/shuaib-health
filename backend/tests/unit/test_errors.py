from fastapi import FastAPI, Query
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.errors import (
    ClinicNotConfigured,
    NotFound,
    RateLimited,
    UnhandledErrorMiddleware,
    register_exception_handlers,
)
from app.middleware.request_id import RequestIdMiddleware


def make_client() -> TestClient:
    app = FastAPI()
    register_exception_handlers(app)

    @app.get("/missing")
    def missing() -> None:
        raise NotFound("Doctor")

    @app.get("/unconfigured")
    def unconfigured() -> None:
        raise ClinicNotConfigured

    @app.get("/limited")
    def limited() -> None:
        raise RateLimited(17)

    @app.get("/db-down")
    def db_down() -> None:
        raise OperationalError("SELECT 1", {}, Exception("host=secret-host"))

    @app.get("/boom")
    def boom() -> None:
        raise RuntimeError("secret detail")

    @app.get("/validate")
    def validate(page_size: int = Query(20, alias="pageSize", le=100)) -> dict[str, int]:
        return {"pageSize": page_size}

    app.add_middleware(UnhandledErrorMiddleware)
    app.add_middleware(RequestIdMiddleware)
    return TestClient(app, raise_server_exceptions=False)


def check_shape(body: dict[str, object], code: str) -> dict[str, object]:
    error = body["error"]
    assert isinstance(error, dict)
    assert error["code"] == code
    assert isinstance(error["message"], str)
    assert isinstance(error["requestId"], str)
    assert error["requestId"] != "-"
    return error


def test_not_found() -> None:
    response = make_client().get("/missing")
    assert response.status_code == 404
    error = check_shape(response.json(), "not_found")
    assert error["message"] == "Doctor not found."
    assert response.headers["cache-control"] == "no-store"
    assert "details" not in error


def test_unknown_route_and_wrong_method() -> None:
    client = make_client()
    check_shape(client.get("/nope").json(), "not_found")
    response = client.post("/missing")
    assert response.status_code == 405
    check_shape(response.json(), "method_not_allowed")


def test_not_configured() -> None:
    response = make_client().get("/unconfigured")
    assert response.status_code == 503
    check_shape(response.json(), "not_configured")


def test_rate_limited_has_retry_after() -> None:
    response = make_client().get("/limited")
    assert response.status_code == 429
    assert response.headers["retry-after"] == "17"
    check_shape(response.json(), "rate_limited")


def test_database_errors_become_503_without_details() -> None:
    response = make_client().get("/db-down")
    assert response.status_code == 503
    check_shape(response.json(), "service_unavailable")
    assert "secret-host" not in response.text
    assert "SELECT" not in response.text


def test_unexpected_errors_become_generic_500() -> None:
    response = make_client().get("/boom")
    assert response.status_code == 500
    check_shape(response.json(), "internal_error")
    assert "secret detail" not in response.text
    assert "Traceback" not in response.text
    assert response.headers["x-request-id"] == response.json()["error"]["requestId"]


def test_validation_error_names_field_and_hides_input() -> None:
    response = make_client().get("/validate", params={"pageSize": "98765"})
    assert response.status_code == 422
    error = check_shape(response.json(), "validation_error")
    assert error["details"] == [{"field": "pageSize", "issue": "must be <= 100"}]
    assert "98765" not in response.text
