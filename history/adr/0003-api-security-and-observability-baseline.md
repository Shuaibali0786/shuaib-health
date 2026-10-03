# ADR-0003: API Security and Observability Baseline

> **Scope**: Document decision clusters, not individual technology choices. Group related decisions that work together (e.g., "Frontend Stack" not separate ADRs for framework, styling, deployment).

- **Status:** Proposed
- **Date:** 2026-10-03
- **Feature:** 003-catalog-api
- **Context:** The user asked for a security and privacy baseline in Feature 003 that every later feature (auth, booking, staff app, AI agent) inherits. The constitution requires strict CORS, no secrets in logs or errors, no medical data in logs, rate limiting on public endpoints, and typed configuration. Only one instance runs for now (local dev, later Render). The choices here decide how every future endpoint is protected and observed by default, so a new route must be safe without the author remembering extra steps.

## Decision

- **Configuration**: `pydantic-settings` with `SecretStr` URLs; startup fails (naming the setting, not the value) on missing settings, non-SSL URLs, swapped pooled/direct URLs, test URL equal to a dev URL, `*` or malformed CORS origins, unknown `APP_ENV`.
- **Middleware pipeline (outermost first)**, all small in-house pure ASGI components applied app-wide: Request ID → Access log → Security headers → CORS → Rate limit → routes → exception handlers.
- **Request ID**: accept `X-Request-ID` only if `^[A-Za-z0-9._-]{8,64}$`, else generate; contextvar; echoed in header, every log record and every error body.
- **Logging**: stdlib `logging` with a JSON formatter and **allow-listed fields** (`method`, `path` without query string, route template, `status`, `durationMs`, `requestId`); uvicorn access log disabled; redaction filter for `postgres(ql)://` strings; SQL echo always off; tracebacks only server-side.
- **Security headers**: `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `CORP: same-site`, restrictive `Permissions-Policy`, `CSP: default-src 'none'; frame-ancestors 'none'`, HSTS in production/https; `/docs` and `/redoc` only in development with a relaxed CSP on those paths.
- **CORS**: explicit allow-list, `GET` only, no credentials, limited allowed/exposed headers; the website will use a same-origin proxy (Constitution VI), so CORS is a fallback.
- **Rate limiting**: per-IP fixed window per minute (default 60), in-process store behind a `RateLimiter` protocol; `429` + `Retry-After` + standard error; `/health` exempt; `X-Forwarded-For` trusted only when `TRUSTED_PROXY_HOPS > 0`.
- **HTTP caching**: per-route helper computes weak content-hash ETags, honours `If-None-Match` (304), sets `Cache-Control: public, max-age=300` on catalog 200s and `no-store` on health, readiness and errors.

## Consequences

### Positive

- Protection is on by default: a new router is rate limited, traced, header-hardened and error-safe without per-route code.
- Allow-listed logging means personal or medical data cannot reach logs by accident when auth and booking arrive; secrets are masked by type.
- No extra runtime dependencies beyond `pydantic-settings`; each component is ~30–80 lines and unit-tested with injected clocks and inputs.
- Not trusting `X-Forwarded-For` by default prevents rate-limit evasion via spoofed headers.
- Content-hash ETags need no `updated_at` bookkeeping and cut repeat payloads to 304s.

### Negative

- In-memory rate limits reset on restart and are per instance; a shared store is required before scaling out (Phase 4).
- Fixed windows allow short bursts at window edges (up to 2× limit across a boundary).
- In-house middleware is code we maintain and must get right (header details, proxy hop parsing) instead of using a vetted library.
- Hashing every catalog response costs CPU per request (small at catalog sizes).
- `TRUSTED_PROXY_HOPS` must be set correctly at deployment, or all users behind the proxy share one limit.

## Alternatives Considered

- **`slowapi` / `limits` for rate limiting**: mature, but adds dependencies outside the constitution stack and relies on per-route decorators that are easy to forget. Rejected for now; the `RateLimiter` protocol allows swapping in Redis-backed limiting later.
- **Edge-only protection (CDN/WAF)**: strong in production but absent in local dev and untestable here. Complementary, not a replacement.
- **`structlog` / `python-json-logger`**: nicer ergonomics, extra dependency for ~30 lines of code. Rejected.
- **`secure` package for headers**: a dependency for six static headers. Rejected.
- **ETag middleware buffering all responses / `updated_at`-based ETags**: hashes errors and docs too, or needs max-timestamp queries across joins. Rejected for the per-route helper.
- **Plain `os.environ` configuration**: no validation, secret masking is opt-in. Rejected.

## References

- Feature Spec: [specs/003-catalog-api/spec.md](../../specs/003-catalog-api/spec.md)
- Implementation Plan: [specs/003-catalog-api/plan.md](../../specs/003-catalog-api/plan.md)
- Research: [research.md R4, R11–R15](../../specs/003-catalog-api/research.md)
- Related ADRs: ADR-0001, ADR-0002
- Evaluator Evidence: [history/prompts/003-catalog-api/002-plan-catalog-api.plan.prompt.md](../prompts/003-catalog-api/002-plan-catalog-api.plan.prompt.md)
