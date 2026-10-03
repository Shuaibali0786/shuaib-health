import json
import logging

from app.logging_config import JsonFormatter, RedactFilter, request_id_var

URL = "postgresql+psycopg://u:SECRETPW@ep-a.x.aws.neon.tech/db?sslmode=require"


def make_record(msg: str, **extra: object) -> logging.LogRecord:
    record = logging.LogRecord("test", logging.INFO, __file__, 1, msg, None, None)
    record.__dict__.update(extra)
    return record


def render(record: logging.LogRecord) -> str:
    RedactFilter().filter(record)
    return JsonFormatter().format(record)


def test_output_is_json_with_core_keys() -> None:
    data = json.loads(render(make_record("hello", status=200, method="GET")))
    assert data["msg"] == "hello"
    assert data["level"] == "INFO"
    assert data["status"] == 200
    assert data["method"] == "GET"
    assert {"ts", "logger", "requestId"} <= data.keys()


def test_non_allow_listed_extras_are_dropped() -> None:
    data = json.loads(render(make_record("x", phone="+920000", query="q=private")))
    assert "phone" not in data
    assert "query" not in data


def test_connection_strings_are_redacted_in_message() -> None:
    line = render(make_record(f"cannot connect to {URL}"))
    assert "SECRETPW" not in line
    assert "postgresql://***" in line


def test_connection_strings_are_redacted_in_exceptions() -> None:
    try:
        raise RuntimeError(f"boom {URL}")
    except RuntimeError:
        import sys

        record = logging.LogRecord("t", logging.ERROR, __file__, 1, "failed", None, sys.exc_info())
    line = render(record)
    assert "SECRETPW" not in line
    assert "RuntimeError" in line


def test_request_id_comes_from_context() -> None:
    token = request_id_var.set("abc12345")
    try:
        data = json.loads(render(make_record("x")))
    finally:
        request_id_var.reset(token)
    assert data["requestId"] == "abc12345"
