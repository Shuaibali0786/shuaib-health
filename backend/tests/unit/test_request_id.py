import re

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.logging_config import request_id_var
from app.middleware.request_id import RequestIdMiddleware, choose_request_id

HEX32 = re.compile(r"^[0-9a-f]{32}$")


def make_client() -> TestClient:
    app = FastAPI()

    @app.get("/rid")
    def rid() -> dict[str, str]:
        return {"seen": request_id_var.get()}

    app.add_middleware(RequestIdMiddleware)
    return TestClient(app)


def test_valid_incoming_id_is_echoed_and_set_in_context() -> None:
    response = make_client().get("/rid", headers={"X-Request-ID": "abc-123_XYZ.9"})
    assert response.headers["x-request-id"] == "abc-123_XYZ.9"
    assert response.json() == {"seen": "abc-123_XYZ.9"}


def test_missing_id_is_generated() -> None:
    response = make_client().get("/rid")
    generated = response.headers["x-request-id"]
    assert HEX32.match(generated)
    assert response.json() == {"seen": generated}


def test_invalid_ids_are_replaced() -> None:
    for bad in ("short", "x" * 65, "bad id!", "<script>"):
        assert HEX32.match(choose_request_id(bad))


def test_context_is_reset_after_request() -> None:
    make_client().get("/rid", headers={"X-Request-ID": "abcdefgh"})
    assert request_id_var.get() == "-"
