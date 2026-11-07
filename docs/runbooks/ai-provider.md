# Runbook: plugging a real AI provider into the assistant (Feature 010, ADR-0013)

Status: **not done**. v1 uses only the free local engine. Do this only after Shuaib approves a provider and a monthly budget.

## Rules (never break)
- The key lives only in the **API project's** env vars (Vercel), never in the browser, never in git.
- The browser never calls the AI company directly. Flow: widget → `POST /api/assistant/ask` (Next BFF, same origin) → backend `POST /assistant/ask` (FastAPI) → AI model.
- The backend applies the **Postgres rate limiter** (ADR-0006) per network address and a daily total cap; it refuses when the cap is reached and the widget falls back to the local engine.
- Grounding: send the same knowledge pack (public data only) plus the question. Never send names, phone numbers or booking references; the widget already tells visitors not to share personal details.
- System prompt keeps constitution I/II/III: no diagnosis or medical advice, prices only from the pack, emergency → local emergency number.
- Log only counts and latency, never the question text (it may contain health information).

## Code steps
1. Backend: new router `assistant.py` with a Pydantic request `{mode, question≤300}`, the limiter, a provider client behind an interface, tests with a fake client.
2. Frontend: `src/agent/remoteProvider.ts` implementing `AgentProvider` (calls the BFF route; on any error returns the local answer).
3. `src/agent/registry.ts`: add `"remote"` and select it with a second flag `ASSISTANT_PROVIDER=remote` (default `local`).
4. Update the contract (OpenAPI), `.env.example` (placeholder only), the new-env-var runbook, and the CSP if needed (it should not be: the browser only talks to its own origin).
5. Tests: provider fallback, rate-limit 429, no personal data in the outgoing payload.
