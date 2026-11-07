"""The assistant's optional Claude provider (Feature 010 v1.1): off by default, limits, cost cap,
grounding prompt shape, and no question text in logs. A fake client stands in for Anthropic: no test
makes a real API call or spends money."""

import logging
from collections.abc import Callable
from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any

import anthropic
import httpx2
import pytest
from fastapi.testclient import TestClient
from httpx2 import Response
from sqlalchemy import Engine, text

from app.assistant import claude
from app.routers.assistant import get_claude_client
from tests.api.admin_support import SECRET

pytestmark = pytest.mark.db

PACK: dict[str, Any] = {
    "clinic": {
        "name": "Sample Clinic",
        "emergencyNumbers": "1122 or 115",
        "emergencyPhone": "+92 21 0000 0000",
    },
    "doctors": [{"name": "Dr. Sample", "feePkr": 2000}],
}
ON = {"assistant_ai_enabled": True, "anthropic_api_key": "sk-ant-test-not-a-real-key-000000000000"}
HEADERS = {"X-Proxy-Secret": SECRET, "X-Client-IP": "203.0.113.9"}


class FakeMessages:
    def __init__(self, reply: str = "We are open Mon-Sat, 9 AM - 9 PM.", **extra: Any) -> None:
        self.calls: list[dict[str, Any]] = []
        self.reply = reply
        self.extra = extra

    def create(self, **kwargs: Any) -> Any:
        self.calls.append(kwargs)
        if "error" in self.extra:
            raise self.extra["error"]
        usage = SimpleNamespace(
            input_tokens=1200,
            cache_creation_input_tokens=0,
            cache_read_input_tokens=0,
            output_tokens=60,
        )
        return SimpleNamespace(
            usage=usage,
            stop_reason=self.extra.get("stop_reason", "end_turn"),
            content=[SimpleNamespace(type="text", text=self.reply)],
        )


class FakeClient:
    def __init__(self, messages: FakeMessages) -> None:
        self.messages = messages


@pytest.fixture
def ai(make_client: Callable[..., TestClient]) -> Callable[..., tuple[TestClient, FakeMessages]]:
    def build(
        messages: FakeMessages | None = None, **overrides: Any
    ) -> tuple[TestClient, FakeMessages]:
        fake = messages or FakeMessages()
        client = make_client(**{**ON, **overrides})
        client.app.dependency_overrides[get_claude_client] = lambda: FakeClient(fake)  # type: ignore[attr-defined]
        return client, fake

    return build


def ask(
    client: TestClient, question: str = "When are you open?", headers: dict[str, str] | None = None
) -> Response:
    return client.post(
        "/api/v1/assistant/answer",
        json={"question": question, "pack": PACK},
        headers=headers or HEADERS,
    )


def test_off_by_default_answers_503(make_client: Callable[..., TestClient]) -> None:
    response = ask(make_client())
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "service_unavailable"


def test_enabled_without_a_key_stays_off(make_client: Callable[..., TestClient]) -> None:
    assert ask(make_client(assistant_ai_enabled=True, anthropic_api_key="  ")).status_code == 503


def test_needs_the_proxy_secret(ai: Callable[..., tuple[TestClient, FakeMessages]]) -> None:
    client, fake = ai()
    assert ask(client, headers={"X-Client-IP": "203.0.113.9"}).status_code == 403
    assert fake.calls == []


def test_answers_with_haiku_grounded_in_the_pack_and_records_the_cost(
    ai: Callable[..., tuple[TestClient, FakeMessages]], seeded_engine: Engine
) -> None:
    client, fake = ai()
    response = ask(client)
    assert response.status_code == 200, response.text
    assert response.json() == {"text": "We are open Mon-Sat, 9 AM - 9 PM.", "provider": "claude"}
    assert response.headers["cache-control"] == "no-store"
    [call] = fake.calls
    assert call["model"] == "claude-haiku-5-5"
    assert call["max_tokens"] == claude.MAX_TOKENS
    assert call["thinking"] == {"type": "disabled"}
    assert call["output_config"] == {"effort": "low"}
    assert call["messages"] == [{"role": "user", "content": "When are you open?"}]
    rules, facts = call["system"]
    assert "ONLY the clinic facts" in rules["text"] and "Never give medical advice" in rules["text"]
    assert "Sample Clinic" in rules["text"] and "1122 or 115" in rules["text"]
    assert facts["cache_control"] == {"type": "ephemeral"}
    assert '"feePkr": 2000' in facts["text"]
    # 1200 input tokens at $0.10/M plus 60 output tokens at $0.50/M = $0.00015 = 150 micro-dollars.
    assert claude.spent_micros(seeded_engine, datetime.now(UTC)) == 150


def test_the_monthly_cap_stops_calls_before_they_cost_money(
    ai: Callable[..., tuple[TestClient, FakeMessages]],
) -> None:
    client, fake = ai(assistant_ai_monthly_budget_usd=0.0)
    response = ask(client)
    assert response.status_code == 503
    assert fake.calls == []


def test_the_cap_counts_what_was_already_spent(
    ai: Callable[..., tuple[TestClient, FakeMessages]], seeded_engine: Engine
) -> None:
    claude.add_spend(seeded_engine, datetime.now(UTC), 999_900)  # $0.9999 of a $1 cap
    client, fake = ai(assistant_ai_monthly_budget_usd=1.0)
    assert ask(client).status_code == 503
    assert fake.calls == []


def test_per_ip_limit(ai: Callable[..., tuple[TestClient, FakeMessages]]) -> None:
    client, _ = ai(assistant_ai_per_ip_per_hour=2)
    assert [ask(client).status_code for _ in range(3)] == [200, 200, 429]


@pytest.mark.parametrize(
    "error",
    [
        anthropic.APIConnectionError(
            request=httpx2.Request("POST", "https://api.anthropic.com/v1/messages")
        ),
        anthropic.InternalServerError(
            "boom",
            response=httpx2.Response(
                500, request=httpx2.Request("POST", "https://api.anthropic.com/v1/messages")
            ),
            body=None,
        ),
    ],
)
def test_upstream_failures_answer_503_so_the_website_falls_back(
    ai: Callable[..., tuple[TestClient, FakeMessages]], error: Exception
) -> None:
    client, _ = ai(FakeMessages(error=error))
    assert ask(client).status_code == 503


def test_a_refusal_or_an_empty_answer_falls_back(
    ai: Callable[..., tuple[TestClient, FakeMessages]],
) -> None:
    client, _ = ai(FakeMessages(stop_reason="refusal"))
    assert ask(client).status_code == 503
    client, _ = ai(FakeMessages(reply="   "))
    assert ask(client).status_code == 503


def test_an_unpriced_model_is_refused_because_the_cap_could_not_be_enforced(
    ai: Callable[..., tuple[TestClient, FakeMessages]],
) -> None:
    client, fake = ai(assistant_ai_model="some-unknown-model")
    assert ask(client).status_code == 503
    assert fake.calls == []


def test_validation(ai: Callable[..., tuple[TestClient, FakeMessages]]) -> None:
    client, _ = ai()
    assert ask(client, question="").status_code == 422
    assert ask(client, question="x" * 301).status_code == 422


def test_the_question_never_reaches_a_log(
    ai: Callable[..., tuple[TestClient, FakeMessages]], caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.DEBUG)
    client, _ = ai()
    ask(client, question="My private question about Dr Sample")
    text_of_logs = " ".join(record.getMessage() + str(record.__dict__) for record in caplog.records)
    assert "private question" not in text_of_logs
    assert any(getattr(r, "event", "") == "assistant.answered" for r in caplog.records)


def test_cost_maths() -> None:
    usage = SimpleNamespace(
        input_tokens=1_000_000,
        cache_creation_input_tokens=0,
        cache_read_input_tokens=0,
        output_tokens=1_000_000,
    )
    assert claude.cost_micros("claude-haiku-5-5", usage) == 600_000  # $0.10 + $0.50
    cached = SimpleNamespace(
        input_tokens=0,
        cache_creation_input_tokens=1_000_000,
        cache_read_input_tokens=1_000_000,
        output_tokens=0,
    )
    assert claude.cost_micros("claude-haiku-5-5", cached) == 125_000 + 10_000


@pytest.fixture(autouse=True)
def _empty_spend(seeded_engine: Engine) -> Any:
    yield
    with seeded_engine.begin() as conn:
        conn.execute(text("DELETE FROM rate_limit_counter WHERE bucket LIKE 'assistant:%'"))
