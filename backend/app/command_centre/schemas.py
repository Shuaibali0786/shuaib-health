"""Command Centre response models (contracts/command-centre-api.openapi.yaml). Camel-case on the
wire like every other model; routes return these, never the tables."""

from datetime import date
from typing import Literal

from pydantic import AwareDatetime

from app.schemas import CamelModel

Role = Literal["admin", "receptionist"]


class ViewerOut(CamelModel):
    kind: Literal["staff", "demo"]
    role: Role | None = None
    display_name: str | None = None
    must_change_password: bool | None = None
    csrf_token: str
    clinic_today: date
    timezone: str
    session_expires_at: AwareDatetime | None = None
