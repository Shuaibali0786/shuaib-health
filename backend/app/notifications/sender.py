"""Sending clinic email alerts (Feature 012), behind ``EMAIL_ALERTS_ENABLED`` (OFF by default).

One small HTTPS call to the provider's API with the standard library, so no new dependency. The
provider is Resend's ``POST /emails`` shape (see docs/runbooks/email-alerts.md); changing provider
means changing only ``deliver``. A failure never reaches the caller: a booking must not fail because
an alert could not be sent, and a cron run only logs it.
"""

import json
import logging
import urllib.request
from collections.abc import Callable
from dataclasses import dataclass

from app.notifications.templates import Email
from app.settings import Settings

logger = logging.getLogger("app.notifications")
API_URL = "https://api.resend.com/emails"
TIMEOUT_SECONDS = 4

Transport = Callable[[urllib.request.Request, int], int]


def _urlopen(request: urllib.request.Request, timeout: int) -> int:
    with urllib.request.urlopen(request, timeout=timeout) as response:  # noqa: S310  # fixed https URL
        return int(response.status)


@dataclass(frozen=True)
class MailConfig:
    api_key: str
    sender: str
    recipients: tuple[str, ...]


def mail_config(settings: Settings) -> MailConfig | None:
    """The settings needed to send, or ``None`` when the feature is off or not fully set up."""
    if not settings.email_alerts_enabled:
        return None
    recipients = tuple(
        part.strip() for part in (settings.email_alerts_to or "").split(",") if part.strip()
    )
    if settings.email_api_key is None or not settings.email_alerts_from or not recipients:
        logger.warning("email alerts are on but not fully set up (key, sender, recipients)")
        return None
    return MailConfig(
        settings.email_api_key.get_secret_value(), settings.email_alerts_from, recipients
    )


def send(settings: Settings, email: Email, *, transport: Transport = _urlopen) -> bool:
    """Send one alert. ``False`` when it is off, not set up, or failed; never raises."""
    config = mail_config(settings)
    if config is None:
        return False
    payload = json.dumps(
        {
            "from": config.sender,
            "to": list(config.recipients),
            "subject": email.subject,
            "text": email.text,
            "html": email.html,
        }
    ).encode()
    request = urllib.request.Request(  # fixed https URL
        API_URL,
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {config.api_key}",
            "Content-Type": "application/json",
        },
    )
    try:
        status = transport(request, TIMEOUT_SECONDS)
    except Exception as error:  # the alert is best effort
        logger.warning("email_alert_failed: %s", type(error).__name__)
        return False
    if status >= 300:
        logger.warning("email_alert_refused: status %s", status)
        return False
    return True
