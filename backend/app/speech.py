"""Short-lived tokens for the premium voice provider (Feature 013, Azure Speech).

OFF unless ``AZURE_SPEECH_KEY`` and ``AZURE_SPEECH_REGION`` are both set: the endpoint then answers
404 and the website keeps the free browser voice. The key stays on the server; the browser gets a
token that the speech service accepts for about 10 minutes. Each visitor (hashed IP) may fetch a
limited number per hour (Postgres counter, ADR-0006). Neither the key nor a token is ever logged.
"""

import logging
import urllib.error
import urllib.request
from collections.abc import Callable
from datetime import datetime, timedelta

from sqlalchemy import Engine

from app.booking import limits
from app.booking.privacy import hmac_hex
from app.errors import NotFound, RateLimited, ServiceUnavailable
from app.settings import Settings

logger = logging.getLogger("app.speech")

IP_WINDOW = timedelta(hours=1)
TOKEN_TTL_SECONDS = 600  # the speech service's own token lifetime
TIMEOUT_SECONDS = 5

#: Posts to the token endpoint and returns the token text (tests replace this; no network there).
Fetcher = Callable[[str, str], str]


def is_enabled(settings: Settings) -> bool:
    return settings.azure_speech_key is not None and bool(settings.azure_speech_region)


def _issue_token(url: str, key: str) -> str:
    request = urllib.request.Request(  # noqa: S310 (a fixed https URL built from the region)
        url,
        data=b"",
        method="POST",
        headers={"Ocp-Apim-Subscription-Key": key, "Content-Length": "0"},
    )
    with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:  # noqa: S310 (fixed https URL)
        body: bytes = response.read()
    return body.decode("ascii").strip()


def issue(
    *,
    settings: Settings,
    engine: Engine,
    client_ip: str,
    now: datetime,
    fetch: Fetcher = _issue_token,
) -> tuple[str, str]:
    """A fresh token and its region, or 404 (off), 429 (limit) or 503 (the service failed)."""
    if (
        not is_enabled(settings)
        or settings.azure_speech_key is None
        or not settings.azure_speech_region
    ):
        raise NotFound("Speech token")
    bucket = f"speech:ip:{hmac_hex(settings.privacy_hash_key, 'speech-ip', client_ip)}"
    retry = limits.hit(engine, bucket, IP_WINDOW, settings.speech_token_per_ip_per_hour, now)
    if retry is not None:
        raise RateLimited(retry)
    region = settings.azure_speech_region
    url = f"https://{region}.api.cognitive.microsoft.com/sts/v1.0/issueToken"
    try:
        token = fetch(url, settings.azure_speech_key.get_secret_value())
    except (urllib.error.URLError, TimeoutError, OSError, ValueError) as error:
        logger.warning("speech.token_failed", extra={"error_type": type(error).__name__})
        raise ServiceUnavailable from error
    if len(token) < 10:
        logger.warning("speech.token_failed", extra={"error_type": "empty"})
        raise ServiceUnavailable
    logger.info("speech.token_issued")
    return token, region
