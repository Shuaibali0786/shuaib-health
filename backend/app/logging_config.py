"""Structured JSON logging with an allow-list of fields and connection-string redaction.

Only the fields named in ``ALLOWED_EXTRAS`` ever reach a log line, so personal or medical
data passed as ``extra=`` by mistake is dropped instead of logged.
"""

import json
import logging
import re
from contextvars import ContextVar
from datetime import UTC, datetime
from typing import Any

request_id_var: ContextVar[str] = ContextVar("request_id", default="-")

ALLOWED_EXTRAS = (
    "event",
    "method",
    "path",
    "route",
    "status",
    "durationMs",
    "xffHops",
    "deleted",
    "role",
    "outcome",
    "code",
)

_DB_URL_RE = re.compile(r"postgres(?:ql)?(?:\+\w+)?://\S+", re.IGNORECASE)
_REDACTED = "postgresql://***"


def redact(text: str) -> str:
    return _DB_URL_RE.sub(_REDACTED, text)


class RedactFilter(logging.Filter):
    """Replace any Postgres connection string in the message or exception text."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.msg = redact(record.getMessage())
        record.args = None
        if record.exc_info and not record.exc_text:
            record.exc_text = logging.Formatter().formatException(record.exc_info)
        if record.exc_text:
            record.exc_text = redact(record.exc_text)
        record.exc_info = None
        return True


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": datetime.fromtimestamp(record.created, UTC).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "msg": redact(record.getMessage()),
            "requestId": request_id_var.get(),
        }
        for key in ALLOWED_EXTRAS:
            if key in record.__dict__:
                payload[key] = record.__dict__[key]
        if record.exc_info:
            payload["exc"] = redact(self.formatException(record.exc_info))
        elif record.exc_text:
            payload["exc"] = redact(record.exc_text)
        return json.dumps(payload, ensure_ascii=False, default=str)


def configure_logging(level: str = "INFO") -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    handler.addFilter(RedactFilter())
    root = logging.getLogger()
    for existing in list(root.handlers):
        if getattr(existing, "_clinic_json", False):
            root.removeHandler(existing)
    handler._clinic_json = True  # type: ignore[attr-defined]  # marks our handler for reconfiguration
    root.addHandler(handler)
    root.setLevel(level)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
