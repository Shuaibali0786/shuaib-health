# Research: Doctor Schedules, Available Time Slots and Online Appointment Booking

**Feature**: 005-appointment-booking | **Date**: 2026-10-04

Each entry records the decision, why it was chosen, and the alternatives that were considered. The user fixed R1, R2, R3, R5, R6 and R10 in the `/sp.plan` input, and R12–R13 plus the form notice on 2026-10-04; this file records the details. ADRs: [ADR-0005](../../history/adr/0005-booking-integrity-db-enforcement.md) (R1, R2, R5, R6, R12) and [ADR-0006](../../history/adr/0006-proxy-trust-and-postgres-rate-limiting.md) (R3, R4, R7, R13).

## R1. Preventing double-booking: PostgreSQL exclusion constraint

- **Decision**:
  - `appointment` stores `starts_at` / `ends_at` as `timestamptz`.
  - The migration adds `CONSTRAINT ex_appointment_no_overlap EXCLUDE USING gist (doctor_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&) WHERE (status = 'confirmed')`.
  - `btree_gist` is already created by `0001_catalog` for the weekly-schedule constraint, and is available on Neon.
  - The service catches SQLSTATE `23P01` (`exclusion_violation`) on this constraint name and turns it into `409 slot_taken`.
- **Rationale**:
  - The database rejects any second confirmed booking whose time range overlaps another for the same doctor, whether the times are identical or only overlapping. That holds even if app checks race, are bypassed, or the slot length changed after a booking (spec US2 AS3/AS4, Principle III).
  - The partial `WHERE` frees a cancelled slot again, which later features need.
  - Half-open `[)` ranges let back-to-back slots (10:00–10:15 and 10:15–10:30) coexist.
- **Alternatives**:
  - `UNIQUE (doctor_id, starts_at)`: misses overlaps of different lengths.
  - `SELECT … FOR UPDATE` on a slot row: needs slot rows to be materialized.
  - `SERIALIZABLE` isolation: retry loops, and still app-level.
  - Advisory lock per doctor: only app-level, so a direct insert bypasses it.

## R2. Idempotency: key table written in the booking transaction

- **Decision**:
  - The browser creates a UUID v4 once per booking attempt and keeps it while the visitor retries that attempt.
  - It sends the key as the `Idempotency-Key` header. The website proxy forwards it unchanged.
  - The backend stores the key with `request_hash` (SHA-256 of the canonical, normalized request: doctor, start, name, phone, email, reason) and `appointment_id`.
  - It does **not** store the request body, so the table holds no patient data.
- **Flow**:
  1. **Pre-check (read only)**: if the key exists with the same hash, replay the original `201` (same reference). If the hash differs, return `409 idempotency_key_reused`. Doing this before the rate limits means retries do not use up limits.
  2. **In the booking transaction**: `INSERT … ON CONFLICT (key) DO NOTHING`.
     - A concurrent duplicate blocks on the unique index until the first transaction finishes.
     - If the first committed, the insert does nothing; the request re-reads the key and replays.
     - If the first rolled back (for example slot taken), the second proceeds and gets the same business result.
     - The key row is created only when a booking is created, so failed attempts leave nothing behind.
  3. **Expiry**: 24 h (`expires_at`). Expired rows are deleted opportunistically, at most 200 per booking request. No cron is needed (the host has none on the free tier).
- **Rationale**: correct under concurrency without a separate lock service, and it satisfies FR-040–FR-042.
- **Alternatives**:
  - Redis: user excluded.
  - Storing full responses: would keep patient data.
  - Client-side button disabling only: not sufficient, though still done as UX.

## R3. Rate limits: Postgres fixed-window counters

- **Decision**:
  - Table `rate_limit_counter(bucket, window_start, count, expires_at)`, primary key `(bucket, window_start)`.
  - One atomic statement per hit: `INSERT … VALUES (:bucket, :window_start, 1, :expires) ON CONFLICT (bucket, window_start) DO UPDATE SET count = rate_limit_counter.count + 1 RETURNING count`.
  - Counters are written in their own short, autocommitted transaction **before** the booking transaction, so a refused or failed booking still counts.
  - Buckets hold `HMAC-SHA256(PRIVACY_HASH_KEY, value)` (first 32 hex chars), never a raw IP or phone number.

  | Bucket | Window | Default limit | Setting |
  |---|---|---|---|
  | `booking:ip:<h>` | 1 h | 10 | `BOOKING_LIMIT_PER_IP_PER_HOUR` |
  | `booking:phone:<h>` | 24 h | 5 | `BOOKING_LIMIT_PER_PHONE_PER_DAY` |
  | `lookup:ip:<h>` | 1 min | 20 | `LOOKUP_LIMIT_PER_IP_PER_MINUTE` |

- **Slot reads** stay on the existing in-memory per-IP middleware (`RATE_LIMIT_PER_MINUTE`, default 60). It is cheap, already tested, and a slot read changes nothing. This changes the spec default from 120/min to 60/min (spec updated); the spec allows defaults to be configured.
- **Rationale**:
  - The limits are shared across instances with no new infrastructure.
  - One round trip per hit.
  - Hashed keys keep patient phone numbers out of the counters table.
- **Alternatives**: Redis/Upstash (user excluded); in-memory for bookings (not shared across instances); sliding-window log (more rows, little benefit at this scale).

## R4. Trusting the client IP behind the website proxy

- **Problem**:
  - Browsers reach the backend only through the website's same-origin route handlers (Principle VI), so the backend's socket peer is always the website server.
  - Without forwarding, every visitor would share one IP bucket and one visitor could rate-limit the whole site.
  - Blindly trusting `X-Forwarded-For` lets anyone who calls the public backend directly spoof their IP.
- **Decision**:
  - The website proxy sends `X-Proxy-Secret: <BOOKING_PROXY_SECRET>` and `X-Client-IP: <visitor IP>`.
  - On Vercel, the visitor IP is the first `x-forwarded-for` entry set by the platform. Locally it is the socket address.
  - The backend `client_ip()` uses `X-Client-IP` only when the secret matches (`hmac.compare_digest`). Otherwise it uses its existing logic (socket or trusted hops).
  - The same rule feeds the global middleware and the booking limits.
  - `POST /appointments` **requires** a valid proxy secret (`403 forbidden` otherwise).
  - It **also rejects** any request that carries an `Origin` header not on `CORS_ORIGINS` (`403`). Browsers always send `Origin` on a cross-site POST, so a browser-originated cross-origin POST is refused even if the secret leaked. Server-to-server calls (website proxy, future staff app or agent) send no `Origin` and are authenticated by the secret.
  - This is how Principle VI ("cross-origin and missing-Origin POST is rejected") is applied at each layer:
    - **Website** (browser-facing): rejects both missing and foreign `Origin`.
    - **Backend** (server-to-server): rejects foreign `Origin`, and treats a missing `Origin` as acceptable **only** together with a valid secret. That makes it a server-to-server call that browsers cannot forge (Principle VI CSRF), while the browser-facing CSRF check (Origin) happens in the website proxy.
  - Future trusted clients (staff app, AI agent) use the same endpoint with their own server-side secret (Principle IV).
- **Alternatives**:
  - Origin check on the backend: Origin is trivially forged by non-browser clients and is absent on server-to-server calls.
  - mTLS: too heavy for the demo hosting.
  - Signed JWT from the proxy: more moving parts than a shared secret at this stage.

## R5. Times: UTC storage, clinic-time rules

- **Decision**:
  - **Storage**: instants (`starts_at`, `ends_at`, leave ranges, created/accepted times) are `timestamptz`, which Postgres stores in UTC.
    - The session time zone is **not** set: the app connects through PgBouncer in transaction mode, where session settings are not reliably kept.
    - Instead, the code only passes timezone-aware Python datetimes, and repositories call `.astimezone(UTC)` on every datetime they read, so the session zone never matters.
    - A test checks this with the session time zone set to `Asia/Tokyo`.
  - **Calendar facts**: clinic holidays and weekly sessions stay calendar values (`date`, weekday + `time`), interpreted in `clinic_settings.time_zone` via `zoneinfo`.
  - **Wire format**: instants are ISO 8601 UTC (`2026-10-06T05:15:00Z`), sent together with `localDate` (`2026-10-06`), `localTime` (`10:15`) and `timeZone`, so clients never convert for display rules. The booking request carries `startsAt` (UTC); the server checks it against the grid.
  - **Slot engine**: a pure function with no `datetime.now()` inside. It receives `now` from an injectable `Clock` dependency, so tests freeze time.
  - **DST**: Asia/Karachi has none, but the engine is zone-correct for white-label clinics. Local times that don't exist are skipped; ambiguous ones use `fold=0`.
- **Rationale**: Principle III ("UTC on the wire with explicit conversion"), spec FR-003, the user's instruction, and day-boundary tests that run with a non-Karachi server time zone.
- **Alternatives**:
  - Storing local `timestamp without time zone`: ambiguous, and breaks if the clinic time zone changes.
  - Computing slots in the browser: violates Principle III.

## R6. Booking reference and masked confirmation

- **Decision**:
  - **Reference**: 10 characters from Crockford base32 (`0123456789ABCDEFGHJKMNPQRSTVWXYZ`), drawn with `secrets.choice`. That is 32¹⁰ = 2⁵⁰ values, above the spec's 2⁴⁰ minimum.
  - It is displayed in two groups, `K7P4Q-9TXM2`. Lookup is case-insensitive and ignores spaces and dashes.
  - A unique constraint guards collisions; a collision triggers one retry with a new value.
  - There is no clinic prefix, because the product is white-label.
- **Masking** (done on the server; the full values never leave it after booking):
  - Name: each word becomes its first letter plus `****`, so "Ali Khan" → `A**** K****`. The fixed four asterisks hide the word length. At most 3 words are shown.
  - Mobile: the local form with the middle hidden, so `+923001234567` → `0300****567`.
- **Confirmation view**:
  - The `POST` response and `GET /appointments/{reference}` return the same masked view: reference, status, doctor (name, specialty), department, local date/time, time zone, fee, masked name, masked mobile.
  - Email and reason are never returned. The confirmation page always renders the masked view (user decision; spec FR-050/FR-051 updated).
- **Rationale**: the page address carries only the reference; knowing a reference reveals no usable personal data; lookups are rate limited and unknown references return a uniform 404.
- **Alternatives**: sequential IDs or UUIDs (guessable, or too long to read out by phone); showing full details once (the user chose masked-only).

## R7. Website ↔ backend: route handlers as a thin proxy (BFF)

- **Decision**:
  - **Website routes**:
    - `GET /api/booking/slots/[doctorSlug]` proxies `GET /api/v1/doctors/{slug}/slots`.
    - `POST /api/booking/appointments` proxies `POST /api/v1/appointments`.
    - The confirmation page is a dynamic server component that calls `GET /api/v1/appointments/{reference}` server-side.
  - **Shared server-only module**: `src/lib/booking/backend.ts` adds the proxy secret and client IP, applies timeouts (slots 5 s, booking 15 s, lookup 5 s), and never logs bodies.
  - **Response handling**: backend status codes and error codes pass through after zod validation.
  - **Origin check**: the `POST` handler rejects requests whose `Origin` is missing or differs from the site origin, and requests whose `Sec-Fetch-Site` is not `same-origin` when the header is present (`403`).
- **Rationale**:
  - Next 16 route handlers are uncached by default for `POST`, and a `GET` that reads the request is dynamic (bundled docs `01-getting-started/15-route-handlers.md`).
  - They give explicit, testable HTTP endpoints that mirror the backend API (Principle IV), and keep the backend URL and secret server-only (FR-076, Feature 004's `no-api-url-in-client` test).
- **Alternatives**:
  - **Server Actions**: opaque endpoint IDs, harder to rate-limit and test as HTTP, and no clean pass-through of `Idempotency-Key`.
  - **`next.config` rewrites**: cannot add the secret header or check Origin.
  - **Direct browser calls with CORS**: violates Principle VI.

## R8. Booking flow state and URL

- **Decision**:
  - One client component, `BookingFlow`, keeps flow state in `useReducer`.
  - The non-personal selections live in the query string, so browser Back/Forward and reload work: `?department=<slug>&doctor=<slug>&date=YYYY-MM-DD&time=HH:MM&step=details`. Doctor pages link to `/book-appointment?doctor=<slug>` (US5).
  - The patient details exist only in form state (React Hook Form + zod), never in the URL, storage or analytics (FR-052).
  - The idempotency key is held in a `useRef`. It is created when the visitor submits and reset after success, or when the slot or details change.
  - No Zustand: the state belongs to one component tree and is not shared across routes, so it is not needed.
- **Demo notice on the form** (user decision, 2026-10-04): the details step shows "Demo site: please don't enter real medical details" directly above the fields. It is a static `<p>` tied to the form by `aria-describedby`, so screen readers announce it with the first field.
- **Data**:
  - Departments and doctors come from the existing cached catalog layer (Feature 004 `content.ts`) and are passed as props, so there is no extra request.
  - Slots are fetched on demand from the website proxy with `cache: "no-store"`.
- **Rationale**: fast first paint (server-rendered shell plus catalog data), no new dependency, Back button support (spec US1 AS7).

## R9. Pakistani mobile validation (shared fixture)

- **Decision**:
  - Strip spaces, dashes, dots and brackets, then accept `^(?:\+92|0092|92|0)(3\d{9})$` and normalize to `+92` + the captured group.
  - Landlines (`021…`), wrong lengths, and other countries are rejected.
  - One JSON case table, `specs/005-appointment-booking/contracts/fixtures/phone-cases.json`, drives both the pytest and the Vitest test, so the backend (authoritative) and the browser (UX) can't drift.
- **Alternatives**: libphonenumber (a large dependency for one country); stricter operator-prefix lists (they change; `3\d{9}` covers all mobile ranges).

## R10. Reusing Feature 003/004 patterns

| Concern | Reused pattern | Change |
|---|---|---|
| Error body | `app/errors.py` `error_response` / codes | new codes: `slot_taken`, `slot_unavailable`, `idempotency_key_reused`, `booking_limit_reached`, `request_rejected`, `forbidden` |
| Settings | `app/settings.py` `SecretStr`, validators | `booking_proxy_secret`, `privacy_hash_key` (required in every env, ≥ 32 chars, R13), `demo_mode`, `booking_purge_after_days`, limit settings |
| Client IP | `client_ip()` in `middleware/rate_limit.py` | honours `X-Client-IP` only with a valid proxy secret |
| Contract | `specs/003-catalog-api/contracts/openapi.yaml` + `test_openapi_contract.py` + frontend `api:types` / drift tests | booking paths merged into that single service contract; delta authored in `contracts/booking-api.openapi.yaml` |
| Seed | `app/seed/loader.py`, refusal in `__main__.py` | sample leave/holidays relative to seed date; one schedule gets a midday break |
| Tests | `conftest.py` migrated/seeded engine, rolled-back sessions | new `committing_engine` fixture for concurrency (real commits, cleanup) |
| Frontend API | `lib/api/http.ts` (`ApiError`), zod schemas, `server-only` | `lib/booking/backend.ts` for POST/no-store calls; `single-fetch` guard test updated to allow exactly this second module |
| Mock API | `tests/mock-api/server.mjs` modes + `/__log` | in-memory slots/appointments and modes `booking-down`, `slot-taken`, `rate-limited`, `booking-slow` |
| E2E | three Playwright configs | booking specs in main (happy path, a11y) and stateful (race, down, retry) |

## R11. Breaks in the seed

- **Finding**: none of the 9 seeded doctors currently has two sessions on one day, so no seed schedule has a break. `catalog.json` is exported from `frontend/tests/fixtures/catalog`, which is the parity source.
- **Decision**:
  - Split `dr-omar-sheikh` Tuesday 14:00–20:00 into 14:00–17:00 and 18:00–20:00 in the frontend fixture, re-export `catalog.json`, and re-record the API fixtures.
  - This intentionally changes one doctor's public schedule table, so its visual baseline is updated in the same phase.
  - The existing schedule UI already groups several sessions per day (`groupScheduleByDay`).
- **Alternative**: a booking-only schedule source. Rejected: two sources of truth for when a doctor sits.

## R12. Data retention for the demo: automatic purge (user decision, 2026-10-04)

- **Decision**: in demo mode (`DEMO_MODE=true`, the default for this portfolio product), appointments are deleted automatically **7 days after the appointment time** (`ends_at < now() - BOOKING_PURGE_AFTER_DAYS`, default 7, allowed range 1–90).
  - Their idempotency keys go with them through `ON DELETE CASCADE`.
  - Audit rows stay, because they hold no personal data and no foreign key.
- **Triggers**: there is no cron on the free host, and the backend sleeps and wakes often, so the purge runs at three points.
  1. **On startup**, in a FastAPI `lifespan` hook.
     - It runs as a background task, so startup never waits on the database.
     - A database error only logs a warning (`purge_failed`, no data) and the app keeps running. Readiness still reports the database separately.
  2. **Opportunistically** during each booking `POST`, after commit: at most 200 rows, in its own short transaction.
  3. **On demand** with `uv run python -m app.booking.purge`, for a host scheduler such as a Render cron job.
     - The command prints only a count.
     - It refuses when `DEMO_MODE=false`.
- **Purge rule**: `DELETE FROM appointment WHERE ends_at < now() - make_interval(days => :days)`, batched. The rule is identical in all three paths (`booking/retention.py`).
- **Audit purge**: the same purge also deletes `audit_log` rows older than `AUDIT_PURGE_AFTER_DAYS` (default 90). They are pseudonymous (an HMAC IP fingerprint) but still personal-ish data, and the privacy page discloses the period (spec FR-056).
- **Outside demo mode** (`DEMO_MODE=false`): nothing is purged automatically. A real clinic needs its own retention policy, which is out of scope.
- **Rationale**: demo visitors may type real names and numbers. Purging them a week after the visit limits exposure without a scheduler dependency, and the booking flow stays demonstrable because upcoming bookings are kept.
- **Alternatives**:
  - Manual SQL only: relies on someone remembering.
  - A pg_cron extension: not guaranteed on the Neon plan, and adds infrastructure.
  - Purging at booking time only: nothing is purged while nobody books.
  - Purging immediately after the appointment: shorter retention, but the confirmation page would 404 soon after a visit, and the 7 days the user chose give a grace period.

## R13. Fail fast on missing or weak secrets (user decision, 2026-10-04)

- **Backend**:
  - `BOOKING_PROXY_SECRET` and `PRIVACY_HASH_KEY` are **required** `SecretStr` settings in every `APP_ENV`, including `test`, where the settings factory supplies fakes. Each must be at least 32 characters.
  - If either is missing or too short, `Settings()` raises at import or startup. Uvicorn exits non-zero with `BOOKING_PROXY_SECRET is required (at least 32 characters)`; the value is never echoed. This follows the ADR-0003 configuration rule.
  - `python -m app.seed` and the purge command load the same settings, so they fail the same way.
- **Website**:
  - `src/instrumentation.ts` `register()` throws `BOOKING_PROXY_SECRET is required (at least 32 characters); refusing to start` when the Node server starts in production (`NODE_ENV=production`, `NEXT_RUNTIME=nodejs`) without a valid secret.
  - It does **not** fail the build, so the Principle V offline build still passes with nothing configured. Build workers may load instrumentation while prerendering, so the check is skipped when `process.env.NEXT_PHASE === "phase-production-build"` (`next/constants` `PHASE_PRODUCTION_BUILD`). The bundled docs (`03-file-conventions/instrumentation.md`) say `register` runs "once when a new Next.js server instance is initiated, and must complete before the server is ready".
  - On serverless hosting, "start" means each cold start, so a misconfigured deployment answers every request with an error instead of serving a half-working booking flow. That is the intended fail-fast behaviour.
  - `next dev` logs the same message as an error and keeps running, so editorial work is not blocked; booking routes then return `503`.
  - The offline/stateful Playwright configs set a dummy secret.
- **Rationale**: a missing secret otherwise fails late and confusingly. Every visitor would share one rate-limit bucket, or every booking would get `403` while the site looks healthy. Failing at startup surfaces it at deploy time.
- **Alternative**: warn and run degraded. The user rejected this.
