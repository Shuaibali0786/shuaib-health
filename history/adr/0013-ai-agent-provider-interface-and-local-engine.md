# ADR-0013: AI Agent — Provider Interface with a Free Local Engine First

- **Status:** Proposed (agent, unattended run 2026-11-07; needs owner acceptance)
- **Date:** 2026-11-07
- **Feature:** 010-ai-agent
- **Context:**
  - Money rule: free tiers only, no new API keys, no paid services until a client pays.
  - Constitution X (Phase 5): the AI agent uses only the public APIs and is bound by honesty, privacy and server-truth principles.
  - Serverless rules: rate limits live in Postgres (ADR-0006); no background work in functions.
  - The agent must answer timings, doctors, departments, lab tests, fees, and guide to booking; on the demo it must also explain the product.

## Decision
- One interface, `AgentProvider.answer(request) → AgentReply`, and a registry that picks the provider.
- v1 ships one provider, **`local`**: a deterministic intent + keyword-overlap engine over a **knowledge pack** of the site's own public data (built in the site layout from the cached catalog loaders and passed to the widget as a prop) plus product-guide notes. It runs **in the browser** and makes no network call.
- Client-side throttle (8/min, 60/session) in v1. Any future **remote** provider MUST run server-side (backend endpoint behind the BFF), use the Postgres rate limiter, keep keys in env vars, and send no personal data.
- Flag `ASSISTANT_ENABLED` (build-time, default off). Product-guide mode also requires `DEMO_ENABLED`.
- The widget is code-split and loaded on first open.

## Consequences
- Positive: $0, no keys, no data leaves the browser, instant answers, fully testable (deterministic), no Lighthouse impact.
- Negative: no free-form understanding; unmatched questions get an honest fallback. Quality depends on synonyms and data.
- Upgrade path: add `remote` provider + backend endpoint + Postgres limits + prompt with the same pack as grounding; the widget does not change.

## Alternatives considered
1. **Paid LLM now** (Claude/OpenAI/Gemini): best quality, but needs a key, billing and server rate limits. Deferred; options and costs in `specs/QUESTIONS-FOR-SHUAIB.md`.
2. **Server-side local engine** (Next route or FastAPI): needs a server rate limit for no benefit, since the data is public. Rejected for v1.
3. **In-browser small LLM (WebLLM/transformers.js)**: tens to hundreds of MB download on phones. Rejected.

## References
- `specs/010-ai-agent/spec.md`, `plan.md`; ADR-0006; constitution I, II, III, X.
