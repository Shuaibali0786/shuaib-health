from fastapi import FastAPI, Request, Response
from fastapi.testclient import TestClient

from app.http_cache import etag_matches, make_etag, respond
from app.schemas import HealthStatus


def test_same_body_same_etag_and_different_body_different_etag() -> None:
    assert make_etag(b"a") == make_etag(b"a")
    assert make_etag(b"a") != make_etag(b"b")
    assert make_etag(b"a").startswith('W/"')


def test_etag_matching_rules() -> None:
    tag = make_etag(b"x")
    strong = tag[2:]
    assert etag_matches(tag, tag)
    assert etag_matches(strong, tag)
    assert etag_matches(f'"other", {tag}', tag)
    assert etag_matches("*", tag)
    assert not etag_matches('"other"', tag)
    assert not etag_matches(None, tag)
    assert not etag_matches("", tag)


def make_client() -> TestClient:
    app = FastAPI()

    @app.get("/thing")
    def thing(request: Request) -> Response:
        return respond(request, HealthStatus(status="ok"), 300)

    return TestClient(app)


def test_respond_sets_cache_headers_and_body() -> None:
    response = make_client().get("/thing")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert response.headers["cache-control"] == "public, max-age=300"
    assert response.headers["etag"].startswith('W/"')


def test_matching_if_none_match_returns_304_without_body() -> None:
    client = make_client()
    etag = client.get("/thing").headers["etag"]
    for header in (etag, etag[2:], f'"nope", {etag}', "*"):
        response = client.get("/thing", headers={"If-None-Match": header})
        assert response.status_code == 304
        assert response.content == b""
        assert response.headers["etag"] == etag
        assert response.headers["cache-control"] == "public, max-age=300"


def test_non_matching_if_none_match_returns_200() -> None:
    response = make_client().get("/thing", headers={"If-None-Match": '"nope"'})
    assert response.status_code == 200
