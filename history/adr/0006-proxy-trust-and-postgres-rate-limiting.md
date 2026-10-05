# ADR-0006: Proxy Trust and Postgres Rate Limiting

> **Scope**: Document decision clusters, not individual technology choices. Group related decisions that work together (e.g., "Frontend Stack" not separate ADRs for framework, styling, deployment).

- **Status:** Accepted
- **Date:** 2026-10-04
- **Feature:** 005-appointment-booking
- **Context:**
  - Constitution Principle VI says browsers reach the backend only through a same-origin proxy on the website, and that state-changing requests pass Origin/CSRF checks. Principle II requires rate limits on booking and lookup.
  - The ADR-0003 baseline has an in-memory, per-instance, per-IP limiter that trusts `X-Forwarded-For` only through `TRUSTED_PROXY_HOPS`.
  - Behind the website proxy, the backend's socket peer is always the website server. Every visitor would therefore share one rate-limit bucket, while a forwarded header from the public internet can be spoofed.
  - Booking adds limits that must hold across instances (per IP, per phone, per lookup). The user ruled out Redis.
  - A misconfigured shared secret should stop the deployment rather than degrade it silently.

## Decision

- **Website proxy (backend-for-frontend)**:
  - Next.js route handlers `GET /api/booking/slots/[doctorSlug]` and `POST /api/booking/appointments`, plus a dynamic server-rendered confirmation page.
  - All of them go through one `server-only` module, `lib/booking/backend.ts`.
  - It adds `X-Proxy-Secret`, `X-Client-IP` (the visitor IP from the platform), `X-Request-ID` and, on POST, the visitor's `Idempotency-Key`.
  - It validates responses with zod, passes status and error codes through, and never logs bodies.
  - There are no Server Actions or rewrites for booking.
- **Browser CSRF guard (website)**: the POST requires `Origin` to equal the site origin and `Sec-Fetch-Site` (when present) to be `same-origin`. It also requires a JSON content type and a body of at most 4 KB. Otherwise it returns `403`.
- **Server-to-server trust (backend)**:
  - `client_ip()` honours `X-Client-IP` only when `X-Proxy-Secret` matches `BOOKING_PROXY_SECRET`, compared with `hmac.compare_digest`; otherwise the ADR-0003 rules apply.
  - `POST /api/v1/appointments` requires a valid secret (`403 forbidden`). It also rejects any request carrying an `Origin` not on `CORS_ORIGINS`. A missing `Origin` is accepted only with the secret (server-to-server; Principle VI applied per layer).
  - Future trusted clients (staff app, AI agent) use the same endpoint with a server-side secret.
  - CORS stays GET-only.
- **Fail fast**:
  - `BOOKING_PROXY_SECRET` and `PRIVACY_HASH_KEY` are required `SecretStr` settings, at least 32 characters, in every `APP_ENV`. A missing or short value stops the API, seed and purge CLI at startup, with a message that names the setting and never the value.
  - The website's `instrumentation.ts` `register()` throws in production server start (`NODE_ENV=production`, Node runtime, not `phase-production-build`) without a valid secret. `next build` and `next dev` are unaffected, keeping Principle V.
- **Postgres fixed-window limiter (booking and lookup)**:
  - Table `rate_limit_counter(bucket, window_start, count, expires_at)`, updated by one atomic `INSERT … ON CONFLICT DO UPDATE … RETURNING count` in its own committed transaction, before the booking transaction. Refused or failed attempts therefore still count.
  - Buckets: `booking:ip` (10/h), `booking:phone` (5/24 h), `lookup:ip` (20/min), all configurable.
  - Bucket keys are `HMAC-SHA256(PRIVACY_HASH_KEY, value)`; raw IPs and phone numbers are never stored.
  - Expired rows are deleted opportunistically, at most 200 per request.
  - Responses are `429` + `Retry-After` + the standard error body.
- **Two-tier limiting**: catalog and slot GETs stay on the existing in-memory per-IP middleware (60/min), now fed the trusted client IP. Only state-changing or enumerable endpoints pay for the shared counter.

## Consequences

### Positive

- Every visitor gets their own rate-limit bucket behind the proxy, and an attacker who calls the public backend directly cannot spoof an IP.
- Booking and lookup limits are shared by all backend instances with no new infrastructure or dependency, which closes the ADR-0003 gap ("a shared store is required before scaling out") for the endpoints that matter.
- The backend URL and secret never reach the browser; a bundle-scan test enforces it.
- CSRF is handled where each threat lives: Origin checks for browsers at the website, a secret for server-to-server calls at the backend.
- Misconfiguration fails at deploy time with a clear message instead of as mysterious `403`s or a single shared rate bucket.
- Personal data stays out of the rate-limit tables, so a dump of the counters is harmless.

### Negative

- **Shared secret**: it must be distributed to, and rotated in, two deployments at once. If it leaks, an attacker can spoof IPs and post bookings directly (still subject to the phone limit, the max-active limit and the exclusion constraint). Rotation means restarting both apps.
- **Database load**: every booking or lookup attempt costs one extra database write.
- **Fixed windows**: allow bursts of up to twice the limit across a window boundary, same as ADR-0003.
- **Two limiter implementations**: in-memory and Postgres must be kept in mind. GET limits are still per instance.
- **Fail-fast trade-off**: a missing secret takes down the whole website server, including pages unrelated to booking. That is accepted in exchange for never running half-configured. The build remains independent of it.
- **Platform dependence**: the website must read the visitor IP correctly on each host (the platform `x-forwarded-for`); a wrong source would group visitors.

## Alternatives Considered

- **Redis/Upstash limiter**: purpose-built and fast, but new infrastructure, cost and secrets. The user excluded it. Rejected.
- **In-memory limiter for booking too**: no writes, but not shared across instances and reset on restart. Rejected for booking and lookup; kept for GETs.
- **Trust `X-Forwarded-For` via `TRUSTED_PROXY_HOPS` only**: works when the backend is reachable only through the proxy, but this backend is publicly reachable, so the header can be spoofed. Rejected as the sole mechanism.
- **Origin/CORS checks on the backend**: Origin is forgeable by non-browser clients and absent on server-to-server calls. Rejected.
- **Signed short-lived JWT, or mTLS, from proxy to backend**: stronger (expiry, no static secret), but more moving parts before the deploy feature. Kept as the upgrade path.
- **Server Actions instead of route handlers**: less code, but opaque endpoints, no clean `Idempotency-Key` pass-through, harder to test as HTTP and to reuse (Principle IV). Rejected.
- **Warn and run degraded when the secret is missing**: keeps unrelated pages up, but hides a security-relevant misconfiguration. The user rejected it.

## References

- Feature Spec: [specs/005-appointment-booking/spec.md](../../specs/005-appointment-booking/spec.md) (FR-055, FR-060–062, FR-076)
- Implementation Plan: [specs/005-appointment-booking/plan.md](../../specs/005-appointment-booking/plan.md) (Key Decisions 3, 4, 7, 10)
- Research: [research.md R3, R4, R7, R13](../../specs/005-appointment-booking/research.md); [contracts/website-booking.md](../../specs/005-appointment-booking/contracts/website-booking.md)
- Related ADRs: ADR-0003 (amended: trusted client IP via proxy secret; shared store for booking/lookup limits), ADR-0004 (website data layer), ADR-0005 (booking integrity)
- Evaluator Evidence: [history/prompts/005-appointment-booking/003-adrs-booking-integrity-proxy-trust.plan.prompt.md](../prompts/005-appointment-booking/003-adrs-booking-integrity-proxy-trust.plan.prompt.md)
