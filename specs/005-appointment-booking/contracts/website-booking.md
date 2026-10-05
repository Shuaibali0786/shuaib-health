# Contract: Website Booking Proxy, Flow and Mock API

**Feature**: 005-appointment-booking. Covers the website side: same-origin routes, the server-only backend module, the flow URL, error mapping, configuration and test doubles.

## 1. Same-origin routes (Next.js route handlers)

| Website route | Method | Forwards to | Timeout | Cache |
|---|---|---|---|---|
| `/api/booking/slots/[doctorSlug]?from&days` | GET | `GET /api/v1/doctors/{slug}/slots` | 5 s | `no-store` (dynamic) |
| `/api/booking/appointments` | POST | `POST /api/v1/appointments` | 15 s | not cached |
| page `/book-appointment/confirmed/[reference]` | server render | `GET /api/v1/appointments/{reference}` | 5 s | dynamic, `noindex`, `referrer: no-referrer` |

Rules:

- **Module boundary**: all three call `src/lib/booking/backend.ts` (`import "server-only"`). That module reads `CATALOG_API_URL` (via the existing `getApiBase()`) and `BOOKING_PROXY_SECRET`.
- **Headers added**:
  - `X-Proxy-Secret`;
  - `X-Client-IP`: the first `x-forwarded-for` entry, or the platform IP;
  - `X-Request-ID`: generated per request;
  - `Idempotency-Key`: POST only, passed through after a UUID v4 check.
- **POST CSRF guard**: `403` unless `Origin` is present and equals `new URL(request.url).origin`, and `Sec-Fetch-Site` (when present) is `same-origin`. `Content-Type` must be `application/json`, and the body must be at most 4 KB.
- **Response handling**:
  - Backend JSON is validated with zod; an invalid shape becomes `502 bad_gateway`.
  - Status and `error.code` pass through unchanged, with `Retry-After` kept for `429`.
  - The proxy never rewrites business outcomes.
- **Never logged**: request or response bodies, `Idempotency-Key`, `X-Client-IP`. On failure, only route, status, `error.code` and backend request ID are logged.
- **No service**: if `CATALOG_API_URL` or `BOOKING_PROXY_SECRET` is unset, the routes return `503 service_unavailable`. The page build never calls these routes (Principle V).

## 2. Error mapping in the flow

| Code (status) | Visitor sees | Flow behaviour |
|---|---|---|
| `slot_taken` (409) | "Sorry, this slot was just taken." + up to 5 alternatives | Details kept. Picking an alternative re-submits with a **new** idempotency key. |
| `slot_unavailable` (409) | "This time is no longer available." + alternatives | Same as above. |
| `booking_limit_reached` (409) | "This mobile number already has the maximum upcoming bookings. Please call the clinic." | Clinic phone shown. |
| `idempotency_key_reused` (409) | Generic retry message | New key generated. |
| `rate_limited` (429) | "Too many attempts. Please try again later or call the clinic." | Retry disabled until `Retry-After`. |
| `request_rejected` (400) | "We couldn't process this booking. Please call the clinic." | — |
| `validation_error` (422) | Field errors mapped by `details[].field` | Focus moves to the first invalid field. |
| network / timeout / 502 / 503 on POST | "We couldn't confirm your booking yet. It's safe to try again; you won't be booked twice." | The same idempotency key is reused on retry. |
| slots fetch failure | "Online booking is temporarily unavailable. Please call the clinic." + phone + Retry | — |

## 3. Flow URL and state

- **URL**: `/book-appointment?department=<slug>&doctor=<slug>&date=YYYY-MM-DD&time=HH:MM&step=department|doctor|date|time|details`.
- **Invalid or stale parameters**: the flow falls back to the deepest valid step and shows a polite note (US5 AS2).
- **Entry links**: doctor pages link to `?doctor=<slug>`, department pages to `?department=<slug>`.
- **Personal data**: name, mobile, email and reason never appear in the URL, `localStorage`/`sessionStorage`, or analytics.
- **Idempotency key**: created when the visitor first submits, then reused across retries of that attempt. A new key is created when the slot or any detail changes.
- **Success**: `router.replace("/book-appointment/confirmed/<reference>")`, so Back does not resubmit.

## 4. Configuration (`frontend/.env.example`, server-only)

| Variable | Purpose |
|---|---|
| `CATALOG_API_URL` | existing; also used for booking |
| `BOOKING_PROXY_SECRET` | placeholder value; must equal the backend's `BOOKING_PROXY_SECRET` |

Neither variable is `NEXT_PUBLIC_*`. The existing `no-api-url-in-client` bundle scan also asserts that the secret never appears in client bundles.

## 5. Mock API additions (`frontend/tests/mock-api/server.mjs`)

- **Slots**: `GET /api/v1/doctors/:slug/slots` builds days from the fixture schedules with a fixed clock `MOCK_NOW` (default `2026-10-05T04:00:00Z`).
- **Booking**: `POST /api/v1/appointments` keeps confirmed slots, plus a map from idempotency key to result, in memory. It returns `201` / `409 slot_taken` with alternatives and replays repeated keys.
- **Lookup**: `GET /api/v1/appointments/:reference` returns the masked view.
- **Proxy secret**: the mock requires `X-Proxy-Secret` to equal `MOCK_PROXY_SECRET`, so the e2e run proves the website sends it.
- **New modes** (via the existing `POST /__mode`):

  | Mode | Behaviour |
  |---|---|
  | `booking-down` | booking routes refuse the connection |
  | `booking-slow` | 20 s delay |
  | `slot-taken` | the next POST loses the race |
  | `rate-limited` | `429` with `Retry-After: 60` |

- **Request log**: `/__log` records booking requests without their bodies. A test asserts that log entries contain no personal data.
