"""Command Centre response models (contracts/command-centre-api.openapi.yaml). Camel-case on the
wire like every other model; routes return these, never the tables."""

import uuid
from datetime import date
from typing import Literal

from pydantic import AwareDatetime, Field, model_validator

from app.schemas import CamelModel

Role = Literal["admin", "receptionist"]
EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


class ViewerOut(CamelModel):
    kind: Literal["staff", "demo"]
    role: Role | None = None
    display_name: str | None = None
    must_change_password: bool | None = None
    csrf_token: str
    clinic_today: date
    timezone: str
    session_expires_at: AwareDatetime | None = None


class SignInRequest(CamelModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=128)


class SessionIssued(CamelModel):
    """Returned to the website server only; the BFF moves ``token`` into the cookie."""

    token: str
    viewer: ViewerOut


class ChangePasswordRequest(CamelModel):
    current_password: str = Field(max_length=128)
    new_password: str = Field(min_length=12, max_length=128)


class StaffOut(CamelModel):
    id: uuid.UUID
    email: str
    display_name: str
    role: Role
    is_active: bool
    must_change_password: bool | None = None
    last_sign_in_at: AwareDatetime | None = None
    is_sample: bool | None = None


class StaffCreate(CamelModel):
    email: str = Field(max_length=254, pattern=EMAIL_PATTERN)
    display_name: str = Field(min_length=1, max_length=60)
    role: Role
    temporary_password: str = Field(min_length=12, max_length=128)


class ResetPasswordRequest(CamelModel):
    temporary_password: str = Field(min_length=12, max_length=128)


class StaffPatch(CamelModel):
    role: Role | None = None
    is_active: bool | None = None

    @model_validator(mode="after")
    def _not_empty(self) -> "StaffPatch":
        if self.role is None and self.is_active is None:
            raise ValueError("at least one of role, isActive is required")
        return self
