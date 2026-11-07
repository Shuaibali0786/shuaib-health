# Runbook: the assistant's optional Claude provider (Feature 010 v1.1, ADR-0013)

Status: **built and OFF**. The chat uses the free built-in engine. Switching Claude on costs money: do it only with Shuaib's approval of the monthly budget.

## How it works
- The **free engine answers first** in the browser: greetings, small talk, emergencies, symptoms → department, timings, doctors, tests, fees, booking. These never cost anything.
- Only a question the free engine **cannot answer** goes `browser → POST /api/assistant` (same origin) `→ POST /api/v1/assistant/answer` (API, proxy secret) `→ Claude Haiku 5.5` (`claude-haiku-5-5`).
- Grounding: the website sends the same **public knowledge pack** (clinic, departments, doctors, tests, packages, FAQ). The system prompt allows answers only from it, in the visitor's language, with no medical advice and no personal data.
- Limits: 20 questions per hour per address, 500 per day in total, and a **hard monthly cost cap** (default **$5**). Before each call the month's spend plus that call's worst case must fit under the cap; after it, the real cost is added from the token usage. All of this is in Postgres (`rate_limit_counter`), and no migration is needed.
- Any "no" (off, no key, limit, cap, Claude error or refusal) → the visitor gets the free engine's friendly answer. The chat never breaks.
- Logs hold token counts and cost only, never the question.

## Cost
Haiku 5.5: $0.10 per million input tokens and $0.50 per million output tokens. One question is about 8k input tokens (mostly the cached clinic facts) and ≤400 output tokens, so roughly **$0.001 per question**. **$5 a month covers about 4,000–5,000 AI questions**, on top of unlimited free-engine answers.

## Switch on (🔑 owner, after approval)
1. Create an API key at console.anthropic.com (Settings → API keys). Set a **monthly spend limit** there too: a second cap outside this app.
2. Vercel → `shuaib-health-api` → Environment Variables (Production):
   - `ANTHROPIC_API_KEY` = the key (Sensitive)
   - `ASSISTANT_AI_ENABLED` = `true`
   - optional: `ASSISTANT_AI_MONTHLY_BUDGET_USD` (default `5`), `ASSISTANT_AI_PER_IP_PER_HOUR` (default `20`), `ASSISTANT_AI_PER_DAY` (default `500`)
3. Vercel → `shuaib-health-web` → Environment Variables (Production): `ASSISTANT_PROVIDER` = `claude`. `ASSISTANT_ENABLED` must already be `true`.
4. Redeploy both projects (variables apply only to a new deployment). Ask Claude Code to redeploy through the CLI if the dashboard asks for the old-email code.
5. Check: ask the chat something the free engine does not know (for example "is there parking nearby?"). The answer should be a short clinic-only reply, and the API logs show `assistant.answered` with a cost.

## Switch off
Set `ASSISTANT_PROVIDER=local` on the website (or `ASSISTANT_AI_ENABLED=false` on the API) and redeploy. Removing the key also turns it off (503 → free engine).

## Code
- Backend: `backend/app/assistant/claude.py` (prompt, limits, cap, cost) and `backend/app/routers/assistant.py`; tests in `backend/tests/api/test_assistant_ai.py` (a fake client: no real calls).
- Website: `frontend/src/agent/remoteProvider.ts` (hybrid), `frontend/src/agent/registry.ts`, `frontend/src/app/api/assistant/route.ts`; tests in `frontend/tests/unit/agent-ai-provider.test.ts` and `assistant-route.test.ts`.
- Contract: `specs/003-catalog-api/contracts/openapi.yaml` v1.4.0 (`/api/v1/assistant/answer`).
