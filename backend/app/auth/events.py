"""Structured events the operator counts (NFR-003). They carry no personal data: no email, name,
address or token, only the event name."""

import logging
from typing import Literal

logger = logging.getLogger("app.auth")

AuthEvent = Literal["auth.sign_in_failed", "auth.lockout", "demo.started"]


def emit(event: AuthEvent) -> None:
    logger.info(event, extra={"event": event})
