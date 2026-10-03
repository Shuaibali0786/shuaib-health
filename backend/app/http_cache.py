"""ETag, Cache-Control and 304 handling for public catalog responses."""

import hashlib

from fastapi import Request, Response
from pydantic import BaseModel


def make_etag(body: bytes) -> str:
    return f'W/"{hashlib.sha256(body).hexdigest()[:32]}"'


def _strip_weak(tag: str) -> str:
    tag = tag.strip()
    return tag[2:] if tag.startswith("W/") else tag


def etag_matches(if_none_match: str | None, etag: str) -> bool:
    if not if_none_match:
        return False
    wanted = _strip_weak(etag)
    for candidate in if_none_match.split(","):
        candidate = candidate.strip()
        if candidate == "*" or _strip_weak(candidate) == wanted:
            return True
    return False


def respond(request: Request, model: BaseModel, max_age: int) -> Response:
    body = model.model_dump_json(by_alias=True).encode()
    etag = make_etag(body)
    headers = {"ETag": etag, "Cache-Control": f"public, max-age={max_age}"}
    if etag_matches(request.headers.get("if-none-match"), etag):
        return Response(status_code=304, headers=headers)
    return Response(content=body, media_type="application/json", headers=headers)
