"""Shared helpers for the Command Centre sign-in tests (Feature 006, US2)."""

import uuid
from typing import Any

from fastapi.testclient import TestClient
from httpx2 import Response
from sqlmodel import Session

from app import models as m
from app.auth import sessions, tokens
from app.auth.passwords import hash_password
from app.settings import Settings

SECRET = "test-proxy-secret-0123456789abcdef"
PASSWORD = "Tr1cky-Horse-Battery"
NEW_PASSWORD = "Another-Fine-Passphrase-7"
HASH = hash_password(PASSWORD)
FP = "f" * 16
API = "/api/v1/admin"

# Error codes that mean "the gate refused", as opposed to anything a route itself answers.
GATE_CODES = frozenset(
    {
        "not_signed_in",
        "session_expired",
        "forbidden",
        "demo_read_only",
        "password_change_required",
        "csrf_failed",
    }
)


def make_staff(
    db: Session,
    email: str = "owner@example.org",
    role: str = "admin",
    name: str = "Clinic Owner",
    **kw: Any,
) -> m.StaffAccount:
    staff = m.StaffAccount(email=email, display_name=name, role=role, password_hash=HASH, **kw)
    db.add(staff)
    db.flush()
    return staff


def headers(token: str | None = None, csrf: str | None = None, **extra: str) -> dict[str, str]:
    values = {"X-Proxy-Secret": SECRET, **extra}
    if token:
        values["X-Session-Token"] = token
    if csrf:
        values["X-CSRF-Token"] = csrf
    return values


def csrf_for(settings: Settings, session_id: uuid.UUID | None) -> str:
    assert session_id is not None
    return tokens.csrf_token(settings.session_secret, session_id)


def staff_session(
    db: Session, settings: Settings, staff: m.StaffAccount, now: Any
) -> tuple[dict[str, str], str, m.StaffSession]:
    """Headers (with CSRF) for a fresh session of ``staff``, plus its token and row."""
    token, row = sessions.create_staff_session(db, settings, staff, FP, now)
    return headers(token, csrf_for(settings, row.id)), token, row


def sign_in(client: TestClient, email: str, password: str = PASSWORD, **extra: str) -> Response:
    return client.post(
        f"{API}/auth/sign-in",
        json={"email": email, "password": password},
        headers=headers(**extra),
    )


def error_code(response: Response) -> str:
    code: str = response.json()["error"]["code"]
    return code
