# Implementation Plan: Doctor Schedules, Available Time Slots and Online Appointment Booking

**Branch**: `005-appointment-booking` | **Date**: 2026-10-04 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-appointment-booking/spec.md`

## Summary

Turn the "Booking coming soon" page into a real, demo-labelled booking flow, backed by a server that computes slots and makes double-booking impossible.

**Backend (FastAPI + Neon Postgres, migration `0002_booking`)**:
- New tables: doctor leave, clinic holidays, appointments, idempotency keys, rate-limit counters and an audit log. Clinic settings gain three booking columns.
- **Slots** come from a pure, clock-injected slot engine over the existing weekly sessions. Breaks are the gaps between a day's sessions. The engine removes past times, times inside the lead window, leave, holidays and confirmed bookings, and works in the clinic time zone. All instants are stored and sent in UTC, alongside the local date and time.
- **Double-booking** is impossible by a partial `EXCLUDE USING gist (doctor_id WITH =, tstzrange(starts_at, ends_at,'[)') WITH &&) WHERE status='confirmed'`.
- **Retries and double clicks** are safe because of an `idempotency_key` row inserted in the booking transaction.
- **Abuse limits** use Postgres fixed-window counters keyed by HMAC (per IP and per phone), plus a trap field and a max-active-bookings rule serialized by a per-phone advisory lock.
- The confirmation/lookup view is **masked** (`A**** K****`, `0300****567`).
- In **demo mode**, bookings are purged automatically 7 days after the appointment time. The purge runs on startup, after each booking, and from a CLI a scheduler can call.
- The service **fails fast** at startup if `BOOKING_PROXY_SECRET` or `PRIVACY_HASH_KEY` is missing or shorter than 32 characters. The website server does the same for `BOOKING_PROXY_SECRET` at start, but the build is unaffected.

**Website (Next.js 16)**:
- A step-by-step `BookingFlow` client component (department → doctor → date → time → details → confirm) built from existing design tokens and components.
- Non-personal choices live in the URL, so Back works. Doctor pages pre-select via `?doctor=`.
- Same-origin route handlers proxy to the backend with a server-only proxy secret and the visitor's IP.
- A dynamic, `noindex` confirmation page.

**Patterns reused from Features 003/004**: error body, settings, contract file and drift tests, seed, test fixtures, mock API, and the three Playwright configs.

## Technical Context

**Language/Version**: Python 3.12 (backend); TypeScript 6 strict, Node 24 (frontend)
**Primary Dependencies**:
- Backend: FastAPI 0.142, SQLModel 0.0.47, Alembic 1.20, psycopg 3.3, pydantic-settings (existing). No new backend dependency: `zoneinfo`, `secrets`, `hmac` and `hashlib` are stdlib.
- Frontend: Next.js 16.3.7, React 19.2, React Hook Form + zod (existing), lucide-react (existing). No new frontend dependency: Zustand is not needed (research R8).

**Storage**: Neon Postgres. Six new tables plus three columns (data-model.md). `btree_gist` already exists.
**Testing**: pytest (unit, db, concurrency with real commits, migration up/down, log safety, contract); Vitest (schemas, phone parity, proxy route handlers, components); Playwright + axe in the main, stateful and offline configs.
**Target Platform**: Backend on a Render-type host (sleeps when idle); website on Node / Vercel.
**Project Type**: Web application (`backend/` + `frontend/`).

**Performance Goals**:
- Slots endpoint p95 ≤ 300 ms server time for a 14-day window (3 indexed queries plus in-memory generation).
- Booking POST p95 ≤ 500 ms.
- Times for a chosen doctor appear ≤ 1 s p95 when the backend is awake (SC-008).
- `/book-appointment` Lighthouse mobile ≥ 90; the flow's client JS ≤ 60 KB gzip added.

**Constraints**:
- No double-booking (DB guarantee).
- No personal data in URLs, logs, counters, idempotency rows or the audit log.
- Build independent of the backend.
- Asia/Karachi rules, UTC storage, PKR fees.
- No Redis.

**Scale/Scope**: demo scale. 9 doctors, a 14-day window (≤ about 400 slots per doctor), single-digit bookings per minute; bursts of 20 concurrent requests in tests.

No NEEDS CLARIFICATION remain. The user's plan input resolved storage, rate limiting and masking; the rest is resolved in [research.md](./research.md) R1–R13.

**Scope notes**:
- `/book-appointment` stays out of the sitemap, as today (the existing `seo.spec.ts` and `pages.test.ts` assertions are kept). The booking flow is not a search landing page, and the confirmation page is `noindex`.
- The `ComingSoon` component is used only by the holding page, so it is deleted together with its unit test when the page is replaced.

## Constitution Check

*Pre-design: PASS. Post-design: PASS (re-checked after data-model and contracts).*

- [x] **I. Honesty**
  - The global layout already shows the demo notice on every page, including the new booking and confirmation pages (asserted by the existing honesty e2e, extended to the new routes).
  - Doctors carry the "Sample" label. The details step says "Demo site: please don't enter real medical details".
  - All seed and demo records have `is_sample`.
  - The site's own wording is updated so it stays true once booking ships (spec FR-056): privacy and terms pages, FAQ, About, the Book Appointment page metadata, and the department page note. The privacy page discloses what booking collects, the 7-day booking purge and the 90-day audit purge.
- [x] **II. Privacy**
  - No roles exist yet (no login). Booking and lookup are anonymous, but the lookup returns only masked data.
  - Booking (created and rejected) is audit-logged, with no personal data.
  - Booking, lookup and slot reads are rate limited.
  - A log-capture test (backend and proxy) asserts that no name, mobile, email or reason appears.
  - Data is never put in URLs.
  - Demo bookings, with their personal data, are purged 7 days after the appointment, and audit rows (pseudonymous fingerprint) after 90 days (R12). The booking form shows "Demo site: please don't enter real medical details".
- [x] **III. Server truth**
  - The server computes slots, fee, status and end time; client values are ignored or rejected.
  - Double-booking is prevented by the exclusion constraint, and the concurrency test proves it.
  - Times use Asia/Karachi rules with UTC storage and wire format (explicit conversion). Fees are in PKR.
  - The day-boundary test runs with the server's `TZ` set to a non-Karachi zone.
- [x] **IV. API-first**
  - One set of endpoints (`/doctors/{slug}/slots`, `/appointments`, `/appointments/{reference}`) for the website, and later the staff app and AI agent. The website proxy only adds transport headers.
  - Typed schemas (pydantic and zod) and a documented error taxonomy (contracts). The committed contract is extended, and the drift tests run on both sides.
- [x] **V. Resilience**
  - The booking page renders from cached catalog data; slots and booking are client-side calls with friendly failure states.
  - The offline build e2e is extended to `/book-appointment`.
- [x] **VI. Security**
  - Argon2 and JWT: N/A (no auth in this feature).
  - **CSRF, applied per layer (research R4)**:
    - The website's browser-facing POST rejects a missing or foreign `Origin` and a non-same-origin `Sec-Fetch-Site`.
    - The backend POST requires the server-side proxy secret and rejects any foreign `Origin`. A missing `Origin` is accepted only with the secret (server-to-server). This is how the constitution's "cross-origin and missing-Origin POST is rejected" test is satisfied at each layer.
  - Same-origin proxy only; CORS stays GET-only with the strict allow-list.
  - Secrets come only from env, with placeholders in both `.env.example` files. gitleaks runs in the final gate.
  - A missing or weak proxy/hash secret stops the backend and the website server at startup with a clear error (R13).
- [x] **VII. Databases**
  - The app uses the pooled URL. Transaction-scoped advisory locks and `prepare_threshold=None` are safe under PgBouncer transaction mode.
  - Migrations use the direct URL. `0002` is reversible, and the up/down test is extended.
  - Tests use `TEST_DATABASE_URL` only. The seed refuses production (existing guard, kept and tested).
- [x] **VIII. Design/a11y**
  - Only existing tokens and components; the new pieces follow the same tokens.
  - axe runs on every step, keyboard-only e2e, reduced motion respected, 24×24 px minimum targets, `aria-live` step and error announcements.
  - Lighthouse is checked by hand and recorded, as in 004 (accepted K6).
- [x] **IX. Quality**
  - TS strict with no `any`; mypy strict; ruff.
  - Unit tests for the slot engine, validators, masking, reference, limits and idempotency. Playwright for browse → book.
  - The work is phased into small diffs.
- [x] **X. Build order**: booking APIs and their website flow belong to constitution **Phase 2 — Backend** (as 004 did). Staff screens (Phase 3) and deploy (Phase 4) are excluded.

## Project Structure

### Documentation (this feature)

```text
specs/005-appointment-booking/
├── spec.md
├── plan.md                      # this file
├── research.md                  # R1–R13
├── data-model.md                # tables, constraints, slot algorithm, validation
├── quickstart.md
├── contracts/
│   ├── booking-api.openapi.yaml # delta merged into specs/003-catalog-api/contracts/openapi.yaml (v1.1.0)
│   ├── website-booking.md       # proxy routes, error mapping, flow URL, env, mock API
│   └── fixtures/phone-cases.json# shared backend/frontend validation cases
├── checklists/requirements.md
└── tasks.md                     # /sp.tasks
```

### Source Code

```text
backend/
├── .env.example                          # + BOOKING_PROXY_SECRET, PRIVACY_HASH_KEY, DEMO_MODE,
│                                         #   BOOKING_PURGE_AFTER_DAYS, AUDIT_PURGE_AFTER_DAYS, limit settings
├── app/
│   ├── main.py                           # + lifespan hook: background demo purge on startup
│   ├── settings.py                       # + secrets (required in every env, ≥ 32 chars, fail fast),
│   │                                     #   demo_mode, booking_purge_after_days, limits
│   ├── models.py                         # + DoctorLeave, ClinicHoliday, Appointment, IdempotencyKey,
│   │                                     #   RateLimitCounter, AuditLog; ClinicSettings booking columns
│   ├── errors.py                         # + BookingConflict, Forbidden, RequestRejected handlers/codes
│   ├── schemas.py                        # + Slot, SlotDay, DoctorSlots, AppointmentCreate/View, BookingConflict
│   ├── middleware/rate_limit.py          # client_ip(): X-Client-IP only with a valid proxy secret
│   ├── booking/                          # NEW domain package (pure logic first)
│   │   ├── clock.py                      # Clock dependency (UTC now), overridable in tests
│   │   ├── timeutil.py                   # to_utc() / utc_iso(): aware datetimes only (R5)
│   │   ├── slots.py                      # pure slot engine (data-model §9)
│   │   ├── validation.py                 # phone normalize, name/email/reason rules
│   │   ├── masking.py                    # A**** K****, 0300****567
│   │   ├── reference.py                  # Crockford base32 ×10, display/parse
│   │   ├── privacy.py                    # HMAC fingerprints, request hash
│   │   ├── limits.py                     # Postgres fixed-window limiter
│   │   ├── idempotency.py                # pre-check, in-transaction claim, cleanup
│   │   ├── audit.py                      # audit_log writer (no PII)
│   │   ├── retention.py                  # purge_demo_bookings(): one rule for startup/post-booking/CLI
│   │   ├── purge.py                      # `python -m app.booking.purge` (refuses when DEMO_MODE=false)
│   │   └── service.py                    # create_appointment(): the booking transaction
│   ├── repositories/availability.py      # sessions, leave, holidays, confirmed bookings in a window
│   ├── repositories/appointments.py      # insert, lookup by reference, active count
│   ├── routers/slots.py                  # GET /api/v1/doctors/{slug}/slots
│   ├── routers/appointments.py           # POST /api/v1/appointments, GET /api/v1/appointments/{reference}
│   └── seed/
│       ├── loader.py                     # + booking columns, sample leave/holiday (relative to seed date)
│       └── data/booking.json             # NEW sample leave/holiday offsets
├── migrations/versions/0002_booking.py   # NEW (reversible)
└── tests/
    ├── conftest.py                       # + fake secrets in settings_factory, frozen clock, committing_engine
    ├── unit/test_settings.py (fail-fast), test_timeutil.py, test_errors.py, test_privacy.py,
    │        test_client_ip.py, test_deps.py (secret + foreign-Origin), test_slots.py, test_validation.py,
    │        test_masking.py, test_reference.py, test_seed_validation.py, test_openapi_contract.py
    ├── api/test_slots_api.py, test_appointments_api.py (incl. audit rows), test_booking_concurrency.py,
    │       test_idempotency.py, test_booking_limits.py, test_retention.py, test_log_safety.py,
    │       test_seed_idempotency.py (extended)
    ├── perf/test_latency.py (slots), test_booking_concurrency_repeat.py
    └── migrations/test_migrations.py     # 0002 up/down, constraint present

frontend/
├── .env.example                          # + BOOKING_PROXY_SECRET
├── playwright*.config.ts                 # dummy BOOKING_PROXY_SECRET for test servers
├── src/
│   ├── instrumentation.ts                # NEW register(): refuse to start in production without a valid secret
│   ├── app/book-appointment/page.tsx     # ComingSoon → BookingFlow (+ BeforeYourVisit kept)
│   ├── app/book-appointment/confirmed/[reference]/page.tsx   # NEW dynamic, noindex, no-referrer
│   ├── app/api/booking/slots/[doctorSlug]/route.ts           # NEW GET proxy
│   ├── app/api/booking/appointments/route.ts                 # NEW POST proxy (Origin guard)
│   ├── app/doctors/[slug]/page.tsx       # Book → ?doctor=slug; remove "not available" note
│   ├── components/departments/DepartmentSections.tsx         # Book → ?department=slug
│   ├── components/booking/               # NEW BookingFlow, StepIndicator, DepartmentStep, DoctorStep,
│   │                                     #     DateStrip, SlotGrid, DetailsForm, SlotTakenNotice,
│   │                                     #     BookingUnavailable, ConfirmationCard
│   ├── lib/booking/                      # NEW backend.ts (server-only), schemas.ts (zod), phone.ts,
│   │                                     #     flowUrl.ts, labels.ts, idempotency.ts
│   ├── lib/api/schema.gen.ts             # regenerated from the merged contract
│   ├── lib/routes.ts                     # + bookingPath({ doctor | department })
│   ├── lib/pages.ts                      # book-appointment title + description updated
│   ├── components/coming-soon/           # DELETED (only the holding page used it)
│   └── data/legalContent.ts, faq.ts, aboutContent.ts   # booking copy made truthful (FR-056)
└── tests/
    ├── fixtures/catalog/doctors.ts       # dr-omar-sheikh Tuesday break (R11) → re-export + re-record
    ├── mock-api/server.mjs               # + slots/appointments, booking modes (fixtures computed in the mock)
    ├── unit/api-config, instrumentation, booking-backend, booking-slots-route, booking-appointments-route,
    │        booking-labels, booking-phone, booking-flow-url, booking-flow, booking-idempotency (+ updated
    │        single-fetch, no-api-url-in-client, mock-api, routes, legal, faq-group, about-content; coming-soon deleted)
    └── e2e/booking, booking-entry, booking-privacy (main); stateful/booking-race, booking-retry, booking-limits,
            booking-down; offline/site (extended); honesty, links, doctors, departments (updated)
```

**Structure Decision**: the existing web-application layout. The backend adds a `booking/` domain package so the pure logic (slot engine, validators, masking) is unit-testable without HTTP or the database. Routers and repositories follow the 003 layering.

## Key Decisions

ADRs: [ADR-0005 Booking integrity enforced by the database](../../history/adr/0005-booking-integrity-db-enforcement.md) covers decisions 1, 2, 5, 6, 9. [ADR-0006 Proxy trust and Postgres rate limiting](../../history/adr/0006-proxy-trust-and-postgres-rate-limiting.md) covers 3, 4, 7, 10.

1. **DB-enforced no-overlap (R1)**: a partial gist exclusion constraint on `tstzrange`; the service maps `23P01` to `409 slot_taken` with 5 alternatives computed after rollback.
2. **Booking transaction (R2, data-model §5–6)**: one transaction, in this order:
   1. `pg_advisory_xact_lock(hashtextextended('phone:'||hmac, 0))`;
   2. claim the idempotency key (`ON CONFLICT DO NOTHING` → replay);
   3. re-run the slot engine for that doctor and day and require `startsAt` to be a free slot;
   4. count active bookings for the phone, fail if ≥ max;
   5. insert the appointment (a new reference on a unique collision);
   6. link the key;
   7. write the audit row;
   8. commit.

   Rate counters are committed beforehand in their own transaction.
3. **Postgres rate limiting (R3)** for booking (per IP and per phone) and lookup (per IP). Slot reads keep the existing in-memory per-IP limit (60/min). Spec default updated.
4. **Trusted client IP via a proxy secret (R4)**: the same secret also authorizes the server-to-server POST.
5. **UTC storage and wire, clinic-zone rules (R5)**, with a `Clock` dependency for deterministic tests.
6. **Masked confirmation only (R6)**: the full personal data never leaves the server after the POST.
7. **Same-origin route handlers as the BFF (R7)**: no Server Actions, no rewrites.
8. **One service contract**: the 005 delta is merged into the 003 contract file. Backend `test_openapi_contract.py` and frontend `api-contract-drift` keep guarding both sides.
9. **Demo retention purge (R12)**: `ends_at < now() - 7 days` while `DEMO_MODE=true`. It runs from three places that share one function: a background task on startup, a capped run after each booking commit, and the `app.booking.purge` CLI. A purge failure is logged and never blocks startup. → ADR-0005.
10. **Fail fast on secrets (R13)**: settings validation stops the backend, seed and purge CLI. Website `instrumentation.ts` stops `next start` in production. Builds and `next dev` are unaffected. → ADR-0006.

## Phases (each ends with a checkpoint: listed checks green and a short summary to the user before continuing)

[tasks.md](./tasks.md) is the authoritative task list. Its phases match this table one-to-one.

| Phase | Goal | Main work | Checkpoint (must pass) |
|---|---|---|---|
| **1. Setup, baseline & contract** (T001–T007) | Record today's state; agree the API before code | Backend, frontend and Lighthouse baselines → `results.md`; merge `booking-api.openapi.yaml` into the 003 contract (v1.1.0, with `ErrorInfo`); `PENDING_BOOKING_OPERATIONS` in the contract test; `npm run api:types`; zod booking schemas; drift tests | Existing suites green; contract parses; drift tests fail on injected drift |
| **2. Foundational** (T008–T031) | Data, config and transport foundation (FR-001–004, FR-025, FR-055) | Fail-fast settings (secrets ≥ 32 chars, demo mode, purge days, limits) + `.env.example`; `timeutil`; models + `0002_booking` (exclusion constraint); clock, privacy hashes, error types, trusted client IP, `require_proxy_secret` (+ foreign-Origin rejection); seed break, leave and holiday; `committing_engine`; website `getProxySecret`, `instrumentation.ts`, `backend.ts`, guard tests; mock API booking support | Migration up/down + `23P01` test; fail-fast tests on both sides; `next build` with no env passes; seed idempotent and refuses production |
| **3. US4 Real slots** (T032–T041) | Server-computed slots (FR-010–014) | Pure slot engine, availability repo, `GET /doctors/{slug}/slots`, website slots route, labels | Slot table tests incl. break, leave, holiday, lead time, Karachi day boundary with a non-Karachi `TZ`; API no-store/no PII; p95 ≤ 300 ms |
| **4. US1 Book in under a minute 🎯 MVP** (T042–T068) | End-to-end booking (FR-020–025, 050–053, 070, 072–074) | Validation, masking, reference, audit, booking service, `POST /appointments` + lookup; website POST route with Origin guard; flow components, details form with the demo notice, confirmation page; replace the holding page, delete `ComingSoon`, update the holding-page tests | Backend API tests; Vitest; e2e keyboard-only booking < 60 s, axe clean, reduced motion respected |
| **5. US2 No double-booking** (T069–T074) | Race-proof booking (FR-030–032) | `23P01` → `409 slot_taken` + alternatives; `SlotTakenNotice` keeps details | 20-thread test: 1 × 201, 19 × 409, 1 row; 100-run perf job; stateful race e2e |
| **6. US3 Safe retries** (T075–T079) | Idempotency (FR-040–042) | Key precheck, claim, link, cleanup; browser key lifecycle; Confirm disabled while in flight; safe-retry message | Replay and concurrent same-key → 1 row; reused key → 409; double-click and timeout-retry e2e |
| **7. US6 Abuse protection** (T080–T083) | Shared limits (FR-060–062) | Postgres limiter (IP, phone, lookup), trap field, per-phone advisory lock + max active; flow messages | 429/409/400 tests incl. concurrency on max-active; counters hold only HMACs |
| **8. US7 Privacy, honesty & retention** (T084–T093) | FR-051–054, FR-056, FR-074 | Log-safety tests; 7-day booking purge + 90-day audit purge (startup, post-booking, CLI); truthful privacy/terms/FAQ/About/page copy; honesty e2e | No personal data in logs or URLs; retention tests with a frozen clock; copy grep test (SC-013) |
| **9. US5 Book from doctor pages** (T094–T100) | Entry points (FR-071) | `bookingPath()`; doctor profile + department Book buttons; pre-select handling; department note copy | Entry e2e incl. < 45 s from a doctor page; visual diffs reviewed |
| **10. Resilience, polish & proof** (T101–T106) | Principle V, performance, docs, final gate | Offline and booking-down e2e; Lighthouse; READMEs; `results.md` SC-001…SC-013 | Every gate green, incl. gitleaks; all SCs evidenced |

## Non-Functional Budgets and Operations

- **Latency**: slots ≤ 300 ms p95 and booking ≤ 500 ms p95 (server). Website proxy timeouts: slots 5 s, POST 15 s, lookup 5 s. A sleeping backend gives a friendly state, never a hang.
- **Reliability**: the booking is atomic, so a timeout means "unknown, safe to retry" (idempotency). Rate-limit and idempotency tables clean themselves up opportunistically (≤ 200 rows per request). The demo purge runs in the background at startup and never blocks or fails startup.
- **Configuration**: the backend and the website server fail fast on a missing or weak `BOOKING_PROXY_SECRET`, and the backend also on `PRIVACY_HASH_KEY`. Builds never need secrets.
- **Security**: secrets live only in env; constant-time secret comparison; HMAC-keyed fingerprints; no personal data in logs, counters, keys or audit; `Cache-Control: no-store` on every booking response.
- **Observability**: the existing structured access log (path only) plus request IDs end to end (website → backend). Audit rows record created and rejected bookings with their outcome.
- **Rollback**: `alembic downgrade 0001_catalog` drops the new tables and columns. Restoring the old `ComingSoon` page is a one-file revert. No feature flag is needed for a demo.

## Risks (top 3)

1. **Connection pool under concurrent bookings**: each booking holds a connection for a short transaction, and the concurrency test fires 20 at once against a pool of 10.
   - Mitigation: the test engine uses a larger pool; app transactions are short (no network calls inside); pool timeouts become `503` (existing handler), which the website reports as "safe to retry".
2. **The proxy secret leaks or is misconfigured**: a leaked secret would let an attacker spoof IPs for rate limiting; a misconfigured one shares a single IP bucket across visitors.
   - Mitigation: server-only env plus a bundle scan; the backend and the website server refuse to start without a valid secret (R13), so misconfiguration fails at deploy time; rotate by changing both env values and restarting both.
3. **Demo personal data retention**: real visitors may type real numbers.
   - Mitigation: the "Demo site: please don't enter real medical details" notice, masked lookup, no outbound messages, and the automatic 7-day purge (R12).
   - Residual risk: if the backend never restarts and nobody books, the purge waits. The `app.booking.purge` CLI can be scheduled on the host, which the deploy feature will configure.
   - Real-clinic deployments set `DEMO_MODE=false` and need their own retention policy.

## Complexity Tracking

No constitution violations.

- **Dependencies**: none added on either side.
- **Two rate-limiting mechanisms**: in-memory (existing, all GETs) and Postgres (booking/lookup). Justified: the shared store is needed only where limits protect scarce state; moving every GET to Postgres would add a write per catalog request.
- **Proxy secret**: a new shared secret. Justified by R4. Without it, either all visitors share one rate bucket or IPs can be spoofed, and the POST would have no server-to-server CSRF protection.
