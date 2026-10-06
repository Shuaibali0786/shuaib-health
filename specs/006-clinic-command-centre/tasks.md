---
description: "Task list for Feature 006 — Clinic Command Centre (staff dashboard) and public one-click demo"
---

# Tasks: Clinic Command Centre — Staff Dashboard and Public One-Click Demo

**Input**: Design documents from `/specs/006-clinic-command-centre/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md) (R1–R19), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md), approved [design-preview/](./design-preview/), ADRs [0007](../../history/adr/0007-staff-auth-opaque-sessions-and-policy-table.md), [0008](../../history/adr/0008-command-centre-isolation-and-bff.md), [0009](../../history/adr/0009-demo-mode-deterministic-data-source.md), [0010](../../history/adr/0010-booking-status-lifecycle-and-concurrency.md)

**Tests**: REQUIRED by the spec (SC-004…SC-010) and constitution IX. Write each test task before the code it covers and see it fail first.

**Paths**: every path starts with `backend/`, `frontend/`, `specs/` or `history/`.
- Backend commands run from `backend/` with `uv run …`.
- Frontend commands run from `frontend/`, in Windows CMD.

**Before writing Next.js code**: read the relevant guide in `frontend/node_modules/next/dist/docs/` (per `frontend/AGENTS.md`), in particular route groups and multiple root layouts, `global-not-found`, route handlers, `cookies()`, `next/font`, metadata `robots`, and `loading.tsx`.

**Design reference**: the approved preview (`design-preview/preview.css`, `render.js`, `screenshots/`) is the visual source of truth. Port its tokens, spacing, components and behaviour (live clock, chip tooltip, toasts, laptop rules). Do not invent a different look.

**Constitution phase (Principle X)**: every task belongs to **Phase 3 — Staff app**. No task touches deploy (Phase 4) or the AI agent (Phase 5).

**Checkpoints**: each phase ends with a **CHECKPOINT**. Run the listed commands, then stop and report to the user (what changed, results, anything surprising) before the next phase.

**Database tests**: tests marked `db` need `TEST_DATABASE_URL` (never dev or prod). Concurrency tests use the 005 `committing_engine` fixture.

**Frozen clock**: every time-dependent test injects the clock. Backend tests use the 005 `Clock` (`backend/app/booking/clock.py`) with a fixed instant. Vitest uses fake timers. Playwright uses `page.clock.install()` + `page.clock.pauseAt(new Date("2026-10-05T06:20:45Z"))` (Mon 5 Oct 2026, 11:20:45 Karachi) and advances only with `page.clock.runFor()`.

## Format: `- [ ] [ID] [P?] [Story] Description with file path`

- **[P]**: can run in parallel (different files, no dependency on an unfinished task)
- **[USn]**: user story from spec.md:

  | Label | Story | Priority |
  |---|---|---|
  | US1 | One-click public demo | P1 |
  | US2 | Secure staff sign-in and role-based access | P1 |
  | US3 | Overview: today at a glance (incl. live experience FR-040…FR-043) | P1 |
  | US4 | Bookings: find, inspect, move through status | P1 |
  | US5 | Mobile-first premium experience (incl. theme FR-044, widths FR-045) | P1 |
  | US6 | Insights | P2 |
  | US7 | Doctors today | P2 |
  | US8 | Activity (audit) feed | P3 |

**Story order**: US2 → US1 → US4 → US3 → US5 → US6 → US7 → US8 (the plan's phase table matches). US4 comes before US3 because the Overview's agenda chips open the booking drawer and "Mark arrived" uses the status actions (FR-019), and both are built in US4. Building them first removes a forward dependency.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: baselines, dependency, contract first (Principle IV).

- [X] T001 Record "before" baselines in `specs/006-clinic-command-centre/results.md`: backend `uv run pytest -q` counts, frontend `npm test` and `npm run test:e2e` counts, Lighthouse scores for the 005 page set (same procedure as `specs/005-appointment-booking/results.md`), and public route JS/CSS sizes from `npm run build`
- [X] T002 [P] Add `argon2-cffi` to `backend/pyproject.toml` and refresh `backend/uv.lock` (`uv add argon2-cffi`)
- [X] T003 [P] Add `SESSION_SECRET` and the optional tunables from `quickstart.md` §1 (STAFF_IDLE_MINUTES … STATUS_UNDO_SECONDS) as placeholders to `backend/.env.example`
- [X] T004 Merge `specs/006-clinic-command-centre/contracts/command-centre-api.openapi.yaml` (incl. `Overview.recentBookings`) into `specs/003-catalog-api/contracts/openapi.yaml`, bump `info.version` to 1.2.0, and validate that it parses
- [X] T005 Regenerate `frontend/src/lib/api/schema.gen.ts` from the merged contract and extend `frontend/tests/unit/api-contract-drift.test.ts` to cover the admin paths
- [X] T006 [P] Add backend contract drift test `backend/tests/api/test_admin_contract.py`: every `/api/v1/admin/*` path, method and response schema in `app.openapi()` matches the merged contract (fails while routes are missing; it goes green story by story)
- [X] T007 [P] Add ESLint `no-restricted-imports` in `frontend/eslint.config.mjs`: nothing outside `src/admin/**` and `src/app/(admin)/**` may import `@/admin/*`
- [X] T008 [P] Add Playwright projects `admin-desktop` (1440×900), `admin-laptop-1366` (1366×768), `admin-laptop-1280` (1280×800) and `admin-mobile` (Pixel 7, 390 px) matching `tests/e2e/admin-*.spec.ts` in `frontend/playwright.config.ts`; keep the existing projects unchanged

**CHECKPOINT 1**: existing backend and frontend suites green; merged contract parses; `npm run lint` green; drift tests fail only for not-yet-built admin routes.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: data model, auth core, policy enforcement, website restructure and isolation, the admin shell, and the live-update primitives. **No user story starts before this phase is done.**

### Settings, migration and models

- [X] T009 [P] Write failing tests in `backend/tests/unit/test_settings.py`: the app refuses to start without `SESSION_SECRET` or with fewer than 32 characters; tunables default to the quickstart values
- [X] T010 Add `session_secret` (SecretStr, ≥ 32, fail fast) and the auth/demo/undo tunables to `backend/app/settings.py`
- [X] T011 [P] Write failing migration tests in `backend/tests/migrations/test_migrations.py` (`db`): `0003` upgrade creates every table, column, CHECK, index and the widened exclusion constraint of data-model §1–§7; downgrade restores 0002 when no `arrived`/`no_show` rows exist and **refuses** (raises) when they do
- [X] T012 Write `backend/migrations/versions/0003_command_centre.py` (down revision `0002_booking`) per data-model §1–§7
- [X] T013 Add `StaffAccount`, `StaffSession`, `DemoSession`, `LoginThrottle`, `AppointmentStatusChange`, `Appointment.version`, the new statuses and the new `AuditLog` columns/values to `backend/app/models.py`; rename `CONFIRMED_SQL` to `OCCUPYING_SQL = "status <> 'cancelled'"` and use it in `backend/app/repositories/availability.py` (max-active-per-phone keeps `status = 'confirmed'`)
- [X] T014 [P] Extend `backend/tests/api/test_slots_api.py` (`db`): an `arrived` booking still blocks its slot; a `cancelled` one frees it
- [X] T015 [P] Add the new error codes (`not_signed_in`, `session_expired`, `forbidden`, `demo_read_only`, `password_change_required`, `csrf_failed`, `sign_in_failed`, `account_locked`, `weak_password`, `email_taken`, `last_admin`, `transition_not_allowed`, `booking_changed`, `undo_unavailable`, `slot_taken`) to `backend/app/errors.py`

### Auth core (pure first)

- [X] T016 [P] Write failing tests `backend/tests/unit/test_passwords.py`: Argon2id hash/verify/needs-rehash, policy (≥ 12, ≤ 128, not in the common list, not containing the email local part, ≠ current), and a dummy-hash verify for unknown emails (equal timing)
- [X] T017 [P] Implement `backend/app/auth/passwords.py` and add `backend/app/auth/data/common-passwords.txt`
- [X] T018 [P] Write failing tests `backend/tests/unit/test_tokens.py` and `backend/tests/unit/test_csrf.py`: `cs_`/`cd_` token generation, HMAC-SHA256 hashing with `SESSION_SECRET`, CSRF derive/verify bound to the session, constant-time compares
- [X] T019 [P] Implement `backend/app/auth/tokens.py`
- [X] T020 Implement `backend/app/auth/sessions.py`: create, look up (route by prefix), slide `last_seen_at` at most once per 60 s, idle 30 min / absolute 12 h expiry with one `auth.session_expired` audit row, max-3 eviction, end with reason (data-model §2)
- [X] T021 Implement `backend/app/auth/throttle.py`: `login_throttle` upsert per failure (subject = HMAC of the lower-cased email, also for unknown emails), lock at 5 failures in 15 min for 15 min, delete on success, and per-IP buckets through the 005 limiter `backend/app/booking/limits.py`
- [X] T022 Implement `backend/app/auth/policies.py`: the `Policy` enum (`PUBLIC_PROXY`, `SELF`, `SELF_STAFF`, `READ`, `READ_ADMIN`, `WRITE`, `WRITE_ADMIN`) and `ENDPOINT_POLICIES`, transcribed row by row from `contracts/auth-matrix.md`
- [X] T023 Implement `backend/app/auth/deps.py`: `require_viewer(policy)` checks proxy secret, Origin, session cookie token from `X-Session-Token`, CSRF on non-GET, must-change-password, role and demo read-only. It returns a `Viewer` (kind, role, staff id, demo date). `get_source(viewer)` returns `RealSource` or `DemoSource`
- [X] T024 Write the introspection test `backend/tests/api/test_route_policies.py`: every route under `/api/v1/admin` appears in `ENDPOINT_POLICIES` with its `require_viewer` dependency, and every table row names a real route
- [X] T025 [P] Define the `CommandCentreSource` protocol in `backend/app/command_centre/source.py` (methods are added by each story) and the short-name masking (`"Ayesha K."`, initials `"A.K."`) re-exporting 005 masking in `backend/app/command_centre/masking.py`, with tests in `backend/tests/unit/test_masking_short.py`
- [X] T026 Implement `GET /admin/auth/me` (SELF) in `backend/app/routers/admin_auth.py` and register the admin routers under `/api/v1/admin` in `backend/app/main.py`; every admin read sets `SET LOCAL statement_timeout = '3s'` (helper in `backend/app/command_centre/real_source.py`). Extend `backend/tests/api/test_rate_limit_api.py`: `/api/v1/admin/*` routes are counted by the global per-IP limiter (Constitution II: auth, booking and lookup endpoints are rate limited), keyed by the proxy-supplied client IP, and the limit leaves headroom for 30 s polling (R19)
- [X] T027 [P] Extend `backend/app/middleware/access_log.py` with `role` (`admin|receptionist|demo|none`) and `outcome` for `/api/v1/admin/*` (R16); no query strings, no bodies. Emit structured events `auth.sign_in_failed`, `auth.lockout`, `request.refused` and `demo.started` (no personal data) so the operator can count them (NFR-003); test in `backend/tests/api/test_admin_access_log.py`

### Website restructure and isolation (pure move first)

- [X] T028 Move every public route into `frontend/src/app/(site)/` with `git mv` (layout.tsx, page.tsx, about … terms, robots/sitemap stay at the app root). Commit it as a **pure move** with URLs unchanged. Gate: `npm test`, `npm run test:e2e` and Lighthouse all equal the T001 baselines
- [X] T029 Extract the `@theme` brand tokens from `frontend/src/app/globals.css` into `frontend/src/app/tokens.css` (single source of hex values), rename the public entry to `frontend/src/app/(site)/site.css` (`@import "tailwindcss" source(none); @import "../tokens.css";` with `@source` limited to public sources), and update `frontend/tests/unit/tokens.test.ts` to scan `tokens.css`
- [X] T030 Add the approved admin tokens to `frontend/src/app/tokens.css`: `navy-950`, `gold-300`, the navy-night palette, the status colours for both themes, and `--font-display` (Cormorant Garamond, weight 600, scale 1.18), copying values from `design-preview/preview.css`. Extend `frontend/tests/unit/tokens.test.ts` with AA contrast pairs for both themes and 3:1 non-text pairs for status lines
- [X] T031 Move `frontend/src/app/not-found.tsx` content to `frontend/src/app/global-not-found.tsx` (required with multiple root layouts); the existing not-found e2e stays green
- [X] T032 Create the admin root layout `frontend/src/app/(admin)/admin/layout.tsx`. It loads Cormorant Garamond 500/600/700 and Inter via `next/font/google` and imports `admin.css`. It reads the `cc_theme` cookie and sets `data-theme` and `data-theme-pref` on `<html>`, so there is no flash. It sets metadata `robots: { index: false, follow: false }`, renders the portfolio disclaimer (Principle I), and imports `src/admin/marker.ts`
- [X] T033 [P] Create `frontend/src/app/(admin)/admin/admin.css` (`@import "tailwindcss" source(none); @import "../../tokens.css"; @source "../../../admin";`) and `frontend/src/admin/marker.ts` exporting `__SH_COMMAND_CENTRE__`
- [X] T034 [P] Add admin response headers (`Cache-Control: no-store`, `X-Robots-Tag: noindex`, `Referrer-Policy: no-referrer`, `frame-ancestors 'none'`) for `/admin/:path*` and `/api/admin/:path*` in `frontend/next.config.ts`; add `Disallow: /admin` to `frontend/src/app/robots.ts`; extend `frontend/tests/unit/seo` coverage so the sitemap never lists `/admin`
- [X] T035 Write failing tests `frontend/tests/unit/admin-bff-route.test.ts` per `contracts/auth-matrix.md` "Website BFF matrix": every allow-listed route × {no cookie, cross-site Origin, `Sec-Fetch-Site: cross-site`, oversize body, non-JSON} → 401/403/413/415; unknown path or bad `{ref}`/`{id}` → 404 before any backend call; `token` never in a response; 5xx → 502, timeout → 504; backend 401 clears the cookie
- [X] T036 Implement the allow-list `frontend/src/admin/lib/bffRoutes.ts` (contracts/website-admin.md §3) and the catch-all `frontend/src/app/api/admin/[...path]/route.ts` reusing the 005 `isSameOrigin`/`clientIpFrom` helpers from `frontend/src/lib/booking/backend.ts`; log method + path template + status + duration + request id only
- [X] T037 [P] Implement `frontend/src/admin/lib/server.ts` (`import "server-only"`, same allow-list, forwards the session cookie) and `frontend/src/admin/lib/client.ts` (browser fetch to `/api/admin/*`, adds `X-CSRF-Token`, maps error codes to typed errors); extend `frontend/tests/unit/` server-only boundary and single-fetch guards to cover `src/admin/lib`
- [X] T038 [P] Implement zod schemas `frontend/src/admin/lib/schemas.ts` from `schema.gen.ts` with tests `frontend/tests/unit/admin-schemas.test.ts`
- [X] T039 [P] Implement Karachi formatting `frontend/src/admin/lib/format.ts` (times, dates, "Mon 5 Oct", clock "11:20:45 AM", greeting by clinic hour: 05:00–11:59 morning, 12:00–16:59 afternoon, else evening) with tests `frontend/tests/unit/admin-format.test.ts` run under `TZ=America/New_York`
- [X] T040 Write the isolation proofs: `frontend/scripts/check-admin-isolation.mjs` (build manifests: no public route references an admin-only chunk; no admin marker or class in public CSS) and `frontend/tests/e2e/admin-isolation.spec.ts` (every public route, idle + hover/scroll prefetch, no JS/CSS response contains `__SH_COMMAND_CENTRE__`, no admin chunk or admin font requested; every `/admin` page and `/api/admin` response carries the T034 `no-store`, `noindex` and `no-referrer` headers, FR-037)
- [X] T041 Extend the mock API with an admin module `frontend/tests/mock-api/admin.mjs` wired from `frontend/tests/mock-api/server.mjs`: `me` for staff/demo cookies and switchable modes `admin-down`, `admin-slow`, `session-expired`, `booking-changed` (endpoints are added per story)

### Admin shell, UI primitives and live-update primitives

- [X] T042 [P] Implement `frontend/src/admin/ui/` `Skeleton`, `EmptyState`, `ErrorState` (calm copy + Retry), `Drawer` (side sheet ≥ 901 px, bottom sheet below; focus moves in, Tab trapped, Esc and scrim close, focus returns to the opener), `Dialog`/`AlertDialog`, `VisuallyHidden`, with tests `frontend/tests/unit/admin-ui.test.tsx`
- [X] T043 Implement `frontend/src/admin/shell/AppShell.tsx`, `SideNav.tsx` (role-aware items, Admin badges), `BottomNav.tsx` (≤ 900 px), `MobileTopBar.tsx` and the footer credit, matching the approved preview at 390/1280/1366/1440 px (laptop rules: doctor column 168 px and content padding 28 px at 901–1439 px)
- [X] T044 Write failing tests `frontend/tests/unit/clinic-clock.test.ts` (fake timers): the clock ticks every second in Asia/Karachi from a server-seeded offset (a wrong device clock does not change "now"); it emits minute boundaries, and a date change in clinic time emits "new day"
- [X] T045 Implement `frontend/src/admin/state/clinicClock.ts` (`useSyncExternalStore`, one shared 1 s interval) per R19
- [X] T046 Write failing tests `frontend/tests/unit/live-poll.test.ts` (fake timers): it polls every 30 s only while the tab is visible and refetches at once on becoming visible. It skips while a request is in flight, backs off 30→60→120 s after failures and resets on success, keeps the last good data on failure, and reports "updated just now / N s ago / N min ago"
- [X] T047 Implement `frontend/src/admin/state/livePoll.ts` per R19
- [X] T048 Implement `frontend/src/admin/shell/StatusBar.tsx`: eyebrow "Command Centre · Mon 5 Oct", live clock `11:20:45 AM · Karachi` (`<time>`, `aria-live="off"`), and the "Live · updated just now" pill with a pulsing dot (pulse only under `prefers-reduced-motion: no-preference`; on phones the word "updated" is hidden)
- [X] T049 Create the authenticated group layout `frontend/src/app/(admin)/admin/(app)/layout.tsx`: calls `/admin/auth/me` via `server.ts`; no session → `302 /admin/login?next=<pathname>` (pathname only); renders AppShell + StatusBar; `export const dynamic = "force-dynamic"`

**CHECKPOINT 2**: `uv run pytest tests/unit tests/migrations tests/api/test_route_policies.py tests/api/test_slots_api.py -q`, `uv run mypy app`, `uv run ruff check .`; `npm run typecheck && npm run lint && npm test`; `npm run build && node scripts/check-admin-isolation.mjs`; `npm run test:e2e` (all existing specs + admin-isolation) green; Lighthouse ≥ baseline.

---

## Phase 3: User Story 2 — Secure staff sign-in and role-based access (P1) 🎯

**Goal**: real staff sign in at `/admin/login`, roles are enforced on the server for every endpoint, and Admins manage staff accounts.

**Independent Test**: create the first admin with the CLI; sign in; create a receptionist; sign in as them; every endpoint refuses no-session, demo writes and receptionist admin-only calls (auth matrix); five wrong passwords lock the account for 15 minutes with a generic message.

### Tests for User Story 2 ⚠️

- [X] T050 [P] [US2] Write `backend/tests/unit/test_create_admin_cli.py`: prompts twice (or `--password-stdin`), enforces the policy, refuses an existing email, writes `staff.created` with actor `system`, prints only "Admin account created."
- [X] T051 [P] [US2] Write `backend/tests/api/test_sign_in.py` (`db`): success sets a new session (no fixation: any presented token is replaced), generic `sign_in_failed` for unknown email / wrong password / inactive, timing equalised, 5 failures in 15 min → `account_locked` for 15 min, per-IP limit → 429, audit rows `auth.sign_in`/`auth.sign_in_failed`/`auth.lockout` with no email or password
- [X] T052 [P] [US2] Write `backend/tests/api/test_sessions.py` (`db`, frozen clock): idle 31 min → 401 `session_expired` + one audit row; absolute 12 h 1 min → 401; sign-out ends it on the server and writes one `auth.sign_out` audit row; a 4th session evicts the oldest; password change, reset and deactivation end all sessions; must-change-password → 403 `password_change_required` on READ routes
- [X] T053 [P] [US2] Write `backend/tests/api/test_auth_matrix.py` (`db`), parametrised from `ENDPOINT_POLICIES` × {no session, demo, receptionist, admin, must-change-password} + missing proxy secret, foreign Origin and bad CSRF negatives, plus the session-state variants (idle and absolute expiry, ended by sign-out, deactivated mid-session, evicted 4th session, demo token presented as staff, demo past 2 h → 401) from contracts/auth-matrix.md. Rows for routes built in later stories are generated automatically once those routes exist
- [X] T054 [P] [US2] Write `backend/tests/api/test_staff_admin.py` (`db`): create (unique email, case-insensitive → 409 `email_taken`), reset sets a temporary password + `must_change_password` and ends that person's sessions, deactivate/reactivate, role change, last active admin cannot be deactivated or demoted (two concurrent demotions → exactly one 409 `last_admin`), audit rows for each
- [X] T055 [P] [US2] Extend `backend/tests/api/test_seed_idempotency.py`: after seeding, `staff_account` is empty, and the seed module tree does not import `app.auth` models
- [X] T056 [P] [US2] Write `frontend/tests/unit/admin-session-route.test.ts`: sign-in sets `__Host-cc_session` (Secure, HttpOnly, SameSite=Strict, Path=/, no Domain/Max-Age) and returns only `viewer`; sign-out always clears the cookie; the password route replaces the token
- [X] T057 [P] [US2] Write `frontend/tests/e2e/admin-auth.spec.ts` (mock API): sign in as admin and receptionist; receptionist sees no Activity/Staff nav and gets the refusal page by URL; wrong password → generic message; locked → "Too many attempts — try again in 15 minutes"; `?next=` returns to the path and rejects off-site paths; session-expired mode → dialog → sign in → back to the same screen; forced password change page. Also write `frontend/tests/e2e/admin-staff.spec.ts`: create a receptionist, reset shows the temporary password once, deactivate/reactivate, role change, last-admin error copy

### Implementation for User Story 2

- [X] T058 [US2] Implement `backend/app/auth/service.py`: `sign_in` (throttle, dummy-hash timing, rehash on verify, end any presented session, create session, audit), `sign_out` (audit `auth.sign_out`), `change_password` (policy, end other sessions, new token, audit `auth.password_changed`)
- [X] T059 [US2] Implement `POST /admin/auth/sign-in`, `POST /admin/auth/sign-out` and `POST /admin/auth/change-password` in `backend/app/routers/admin_auth.py` with their `ENDPOINT_POLICIES` rows
- [X] T060 [US2] Implement `backend/app/auth/create_admin.py` (`python -m app.auth.create_admin --email … [--name …] [--password-stdin]`)
- [X] T061 [US2] Implement staff administration (list, create, reset password, patch role/active with the last-admin lock `SELECT … FOR UPDATE`) in `backend/app/auth/service.py` and `backend/app/routers/admin_staff.py`; demo viewers get synthetic staff from US1's dataset once it exists (until then 403 `demo_read_only` on writes and an empty list)
- [X] T062 [P] [US2] Implement `frontend/src/app/api/admin/session/route.ts` (POST sign-in, DELETE sign-out) and `frontend/src/app/api/admin/password/route.ts`
- [X] T063 [US2] Build the login page `frontend/src/app/(admin)/admin/login/page.tsx` (email + password, generic errors, lockout copy, `?next=` handling with open-redirect guard, disclaimer and "Designed & built by Shuaib Ali" credit, no sign-up link; the demo button is added in US1)
- [X] T064 [P] [US2] Build `frontend/src/app/(admin)/admin/(app)/account/password/page.tsx` (forced while `mustChangePassword`; the group layout redirects there)
- [X] T065 [P] [US2] Build `frontend/src/admin/shell/SessionExpiredDialog.tsx`: any 401 from `client.ts` opens it, and signing in returns to the current pathname. For a demo viewer (added in US1) it instead says "The demo has ended" and offers a fresh demo through the plain demo form (FR-013)
- [X] T066 [US2] Build the Staff screen `frontend/src/app/(admin)/admin/(app)/staff/page.tsx` with `frontend/src/admin/staff/StaffTable.tsx` and `StaffForms.tsx` (create, reset with temporary password shown once, deactivate/reactivate, role; last-admin error copy); hidden from receptionists in SideNav/BottomNav
- [X] T067 [US2] Add the mock API admin auth and staff endpoints to `frontend/tests/mock-api/admin.mjs`

**CHECKPOINT 3 (US2)**: `uv run pytest tests/api/test_sign_in.py tests/api/test_sessions.py tests/api/test_auth_matrix.py tests/api/test_staff_admin.py tests/unit -q` green; `npm test` + `npm run test:e2e -- tests/e2e/admin-auth.spec.ts tests/e2e/admin-staff.spec.ts` green; report the auth matrix row count (SC-004 so far).

---

## Phase 4: User Story 1 — One-click public demo (P1)

**Goal**: "View Demo Dashboard" opens the Command Centre with no password, in a read-only demo session fed by deterministic, department-realistic synthetic data. Demo data and real data never mix.

**Independent Test**: from the footer, About page or login page press "View Demo Dashboard": the Command Centre opens with the "Demo mode — changes are not saved" ribbon; every crafted write from the demo cookie is refused by the server; a real booking reference returns 404 to the demo. (The Overview and Bookings screens that the demo fills are completed in US4/US3, which extend T077.)

### Tests for User Story 1 ⚠️

- [X] T068 [P] [US1] Write `backend/tests/unit/test_demo_generator.py`: same Karachi date → identical dataset (seed `shuaib-health-demo:v1:<date>`). Covers date−90 … date+14 with the data-model §9 distributions (busier mornings, Mon/Sat peak, ~8 % no-show, ~6 % cancelled, past days fully resolved, today split by "now", future 94/6). References start with `D`. **Patients fit their department (FR-038)**: every Gynecology patient is a woman aged 21–46, every Pediatrics patient is aged 0–12 with `bookedBy ∈ {mother, father}`, and every reason comes from that department's list. Generation of the full range takes < 150 ms
- [X] T069 [P] [US1] Write `backend/tests/unit/test_demo_import_guard.py`: `app.demo.demo_source` and `app.demo.generator` import neither `app.repositories.appointments`, the `Appointment` model nor the DB session
- [X] T070 [P] [US1] Write `backend/tests/api/test_demo_session.py` (`db`): `POST /admin/demo/start` returns a `cd_` token, `demo_date` = Karachi date, expiry 2 h; per-IP limit → 429; a `cd_` token never authenticates as staff (prefix swap → 401); sign-in replaces a demo session; demo start ends a staff session; no audit rows for demo; `demo.started` structured log event
- [X] T071 [P] [US1] Write `backend/tests/api/test_demo_separation.py` (`db`): with real bookings present, every READ route called by a demo session returns only `isSample: true` records with `D` references and a real reference → 404; every READ route called by staff returns no `D` reference (extended by later stories as routes appear)
- [X] T072 [P] [US1] Write `frontend/tests/unit/admin-demo-route.test.ts`: the form POST handler sets the cookie and `303 → /admin`; backend 429 → `303 → /admin/login?demo=busy`; cross-site POST refused
- [X] T073 [P] [US1] Write `frontend/tests/unit/demo-overlay.test.ts`: the overlay store applies local status changes and history on top of server data, keyed by reference; undo within 10 s; it lives in memory only (a new store instance is empty)
- [X] T074 [P] [US1] Write `frontend/tests/e2e/admin-demo.spec.ts` (mock API): the demo entry from the footer, About and login lands on `/admin` with the ribbon and its links; the public pages' demo control is a plain `<form>` (no `<Link>`, no prefetch request to `/admin`); a demo `fetch` to a write route gets 403 `demo_read_only`; an expired demo (mock `session-expired` mode) offers "Start a fresh demo", which lands on a new demo Overview

### Implementation for User Story 1

- [X] T075 [P] [US1] Implement sample name and reason lists in `backend/app/demo/names.py` (women's, men's, girls' and boys' first names, surname initials, per-department reasons; obviously sample, matching `design-preview/data.js`)
- [X] T076 [US1] Implement `backend/app/demo/generator.py` (`DemoDataset` per Karachi date from the public sample catalog, department-appropriate patients, synthetic leave, activity feed and staff "Sample Admin", "Sample Receptionist A/B"; `functools.lru_cache(maxsize=2)` keyed by `(date, catalog_etag)`)
- [X] T077 [US1] Implement `backend/app/demo/demo_source.py` (in-memory `CommandCentreSource`; read methods are added by each story) and wire `get_source` in `backend/app/auth/deps.py`
- [X] T078 [US1] Implement the demo session (`demo_session` create/lookup/expiry) in `backend/app/auth/sessions.py` and `POST /admin/demo/start` (PUBLIC_PROXY, per-IP limit `DEMO_LIMIT_PER_IP_PER_HOUR`) in `backend/app/routers/admin_auth.py`; `me` returns `kind: demo`, `clinicToday` = demo date
- [X] T079 [US1] Add a fixture exporter `backend/app/demo/export_fixture.py` (`uv run python -m app.demo.export_fixture --date 2026-10-05 --now 11:20`) and commit its output to `frontend/tests/fixtures/admin/demo-day.json`; add `frontend/tests/unit/admin-fixture-parity.test.ts` checking the fixture against the zod schemas
- [X] T080 [US1] Serve the demo fixture from `frontend/tests/mock-api/admin.mjs` for demo cookies (`/admin/demo/start`, `me`)
- [X] T081 [P] [US1] Implement `frontend/src/app/(admin)/admin/demo/start/route.ts` (form POST → backend → cookie → 303)
- [X] T082 [P] [US1] Implement the server component `frontend/src/components/demo/DemoDashboardButton.tsx` (plain `<form method="post" action="/admin/demo/start">`, no JS) and add it to `frontend/src/components/layout/SiteFooter.tsx`, `frontend/src/app/(site)/about/page.tsx` and the login page; show "The demo is busy — try again in a minute" for `?demo=busy`
- [X] T083 [P] [US1] Implement `frontend/src/admin/shell/DemoRibbon.tsx` ("Demo mode — changes are not saved." + "All names and numbers are sample data." + Back to website + Staff sign-in) rendered by the `(app)` layout for demo viewers
- [X] T084 [US1] Implement `frontend/src/admin/state/demoOverlay.ts` per T073 (status changes, undo, history, and simulated new bookings added in US3)

**CHECKPOINT 4 (US1)**: demo, separation and import-guard tests green; `npm run test:e2e -- tests/e2e/admin-demo.spec.ts tests/e2e/admin-isolation.spec.ts` green; Lighthouse for pages that gained the demo button ≥ baseline.

---

## Phase 5: User Story 4 — Bookings: find, inspect and move through status (P1)

**Goal**: staff search and filter bookings, open a detail drawer, and move a booking through Confirmed → Arrived → Completed / No-show / Cancelled with confirmation, a 10 s undo, conflict refusal and an audited phone reveal. The demo does the same in the browser only.

**Independent Test**: with fixed data, search by partial reference and by name, filter by doctor and status, open the drawer, mark Arrived (confirm), undo within 10 s, mark Arrived again then Completed; a second user's stale change is refused; Cancel frees the slot for public booking; reveal is audited and re-masks after 60 s.

### Tests for User Story 4 ⚠️

- [X] T085 [P] [US4] Write `backend/tests/unit/test_status_rules.py` (frozen clock): exactly the five allowed transitions (FR-023); Arrived from start−2 h; No-show from start; Cancel only before start; past-day tidy-up allowed except Cancel; `allowed_next` per status and time
- [X] T086 [P] [US4] Write `backend/tests/api/test_status_change.py` (`db`, committing engine): change + history + audit in one transaction (fault injected before the audit insert → nothing saved); two concurrent changes → one 200, one 409 `booking_changed` with the current booking; undo only for the latest change, same actor, ≤ 10 s + 2 s grace, unchanged version, else 409 `undo_unavailable`; undo writes `is_undo` history + `booking.status_undone`; Cancel → the slot reappears in public `GET /slots`; undoing a cancel after the slot was rebooked → 409 `slot_taken`; demo → 403 `demo_read_only`
- [X] T087 [P] [US4] Write `backend/tests/api/test_bookings_search_api.py` (`db`): partial reference and case-insensitive name search, `%`/`_`/`\` treated literally, filters by date range/doctor/department/status, page size 20 + total, validation errors (q > 80, span > 92 days, bad page) → 422, detail includes history and `allowedNext`, masked phone/email, patient age and "booked by" for Pediatrics in the demo
- [X] T088 [P] [US4] Write `backend/tests/api/test_reveal_phone.py` (`db`): staff reveal returns the full phone and writes `booking.phone_revealed` (reference only, no phone); demo reveal returns the synthetic number and writes nothing
- [X] T089 [P] [US4] Write `backend/tests/api/test_lookups_api.py` (`db`): doctors and departments (incl. inactive, flagged) for filters; demo gets the sample catalog
- [X] T090 [P] [US4] Write `frontend/tests/unit/undo-store.test.ts`, `frontend/tests/unit/status-actions.test.tsx` (only server `allowedNext` actions shown; confirm text "Mark Ayesha K. as arrived for 11:40?"; 409 shows "This booking was changed by someone else" and refreshes) and `frontend/tests/unit/phone-reveal.test.tsx` (re-masks on close or after 60 s, fake timers; a `tel:` "Call" link appears only while revealed)
- [X] T091 [P] [US4] Write `frontend/tests/unit/bookings-url.test.ts`: only `from`, `to`, `doctor`, `department`, `status`, `page` ever reach the address bar; search text never does (FR-021)
- [X] T092 [P] [US4] Write `frontend/tests/e2e/admin-bookings.spec.ts` (mock API, frozen clock, `admin-desktop` + `admin-mobile`): find by reference → open drawer (row name button / card) → Mark arrived → confirm → Undo toast → Mark arrived → Complete, timed under 15 s (SC-003). Also: reveal then auto re-mask after `runFor(60_000)`; `booking-changed` mode → conflict message; demo: the change shows instantly and is gone after reload; drawer focus trap, Esc and focus return; patient name in the table, card and phone agenda row opens the drawer; with the drawer open, `runFor(30_000)` refreshes the list without closing the drawer or moving focus (FR-041)

### Implementation for User Story 4

- [X] T093 [US4] Implement pure rules `backend/app/command_centre/status.py` (transitions, time rules, `allowed_next`)
- [X] T094 [US4] Implement `change_status`, `undo` and `reveal_phone` transactions in `backend/app/command_centre/service.py` (optimistic `version` UPDATE … RETURNING, history row, audit row; `23P01` → `slot_taken`)
- [X] T095 [US4] Implement search (POST body, escaped `ILIKE` on reference and `lower(patient_name)`, `LIMIT 20 OFFSET n` + `count(*) OVER ()`), detail with history, and lookups queries in `backend/app/repositories/command_centre.py`; add `search`, `detail` and `lookups` to `RealSource` (`backend/app/command_centre/real_source.py`) and `DemoSource`
- [X] T096 [US4] Implement `POST /admin/bookings/search`, `GET /admin/bookings/{reference}`, `POST …/status`, `POST …/status/undo`, `POST …/reveal-phone` in `backend/app/routers/admin_bookings.py` and `GET /admin/lookups` in `backend/app/routers/admin_dashboard.py`, each with its policy row
- [X] T097 [US4] Add bookings search/detail/status/undo/reveal/lookups to `frontend/tests/mock-api/admin.mjs` (staff fixture + demo fixture; `booking-changed` mode → 409)
- [X] T098 [P] [US4] Build `frontend/src/admin/bookings/StatusBadge.tsx` (icon + text, dashed no-show, struck-through cancelled; never colour alone) and `Pagination.tsx`
- [X] T099 [P] [US4] Build `frontend/src/admin/bookings/FilterBar.tsx` (search field, date range "Today, 5 Oct", doctor, department, status chips with counts) and `StickyFilters.tsx` (phone: sticky search + filter button + scrolling chips)
- [X] T100 [P] [US4] Build `frontend/src/admin/bookings/BookingTable.tsx` (time in display numerals, patient name as a button that opens the drawer, Sample tag, masked phone, doctor + department, reference, status, quick action) and `BookingCard.tsx` (whole card is a button)
- [X] T101 [US4] Build `frontend/src/admin/bookings/BookingDrawer.tsx` on the `Drawer` primitive, following the approved preview: reference eyebrow, full name, status + Sample badge, When, Doctor, Patient (age · "booked by mother/father"), Phone with Reveal, Email, Reason, Fee (PKR), Booked, status history, and a next-step footer driven by `allowedNext`
- [X] T102 [US4] Build `frontend/src/admin/bookings/StatusActions.tsx`, `ConfirmDialog.tsx` and `UndoToast.tsx` (10 s ring countdown) plus `frontend/src/admin/state/undo.ts`; in demo mode route the actions through `demoOverlay` instead of the server
- [X] T103 [P] [US4] Build `frontend/src/admin/bookings/PhoneReveal.tsx` (re-mask on close or after 60 s; `tel:` "Call" action while revealed, US4 AS9)
- [X] T104 [US4] Build the Bookings page `frontend/src/app/(admin)/admin/(app)/bookings/page.tsx` (server-rendered first page from URL-safe params; client island for search, filters, drawer). Results refresh every 30 s via `livePoll` (FR-041) without moving focus or closing the drawer; the header shows "Today · N bookings · clinic time (Karachi)"
- [X] T105 [US4] Extend `backend/tests/api/test_demo_separation.py` and `backend/tests/api/test_admin_contract.py` for the bookings and lookups routes

**CHECKPOINT 5 (US4)**: status, search, reveal, lookups, matrix and separation tests green; `npm run test:e2e -- tests/e2e/admin-bookings.spec.ts` green on desktop and mobile; report the SC-003 timing.

---

## Phase 6: User Story 3 — Overview: today at a glance, live (P1)

**Goal**: the Overview shows the six KPIs with week-on-week trends, today's agenda by doctor with a moving "now" marker and interactive chips, the next 5 patients with one-tap Mark arrived, and today by status. It feels live: clinic clock, greeting, 30 s refresh, KPI count-up and new-booking notifications.

**Independent Test**: with the clock paused at Mon 5 Oct 2026 11:20:45 Karachi and fixed data, the KPI values, trends, agenda chips and next patients match the expected values. Advancing the clock moves the seconds, the now marker (after 60 s) and the "updated" label. A booking created on the server appears as a notification after the next 30 s poll.

### Tests for User Story 3 ⚠️

- [ ] T106 [P] [US3] Write `backend/tests/unit/test_metrics.py` (frozen clock, process `TZ=America/New_York`): KPIs per data-model §8 (arrived counts arrived + completed), utilisation from the 005 slot grid minus leave and holidays ("—" when 0 slots), trends vs `d − 7` (points for utilisation), next-up (confirmed, starts ≥ now − 15 min, limit 5), a 23:45 Karachi booking counted on its Karachi date (SC-009)
- [ ] T107 [P] [US3] Write `backend/tests/api/test_overview_api.py` (`db`): real and demo responses match the contract. `recentBookings` holds the ≤ 5 newest by `created_at`, masked, with `bookedAt`, and is always empty for demo. A clinic holiday sets `clinicClosed`; a day with no bookings returns an empty agenda (empty state)
- [ ] T108 [P] [US3] Write `frontend/tests/unit/new-bookings.test.ts`: first load only records the newest `bookedAt`; later polls emit one notification per newer item, at most 3 visible, auto-hiding after 8 s, paused while hovered or focused; demo injection adds a booking into a free future slot at 50 s then every 75 s (seeded per demo date, never sent to the server)
- [ ] T109 [P] [US3] Write `frontend/tests/unit/kpi-count.test.tsx`: numbers count up (≈ 0.9 s on first load, 0.5 s on change); under reduced motion the final value shows at once; screen readers get only the final value
- [ ] T110 [P] [US3] Write `frontend/tests/unit/agenda-timeline.test.tsx`: each booking chip is a `<button>` with `aria-label` "11:40, patient K.N., Confirmed. Open booking."; the tooltip shows time, initials and status on hover, focus and pointer-down, stays while hovered (WCAG 1.4.13), closes on Esc, is clamped inside the timeline; the now marker is hidden outside 09:00–20:00; a doctor with many appointments scrolls within the lane and a very long doctor name truncates with the full name kept in the accessible name (edge cases)
- [ ] T111 [P] [US3] Write `frontend/tests/e2e/admin-overview.spec.ts` (mock API, clock paused at 11:20:45 Karachi): expected KPI values and trend phrases ("down 4 on last Mon"), "Good morning", agenda chips per doctor, focusing a chip shows "12:00 K.A. Confirmed", Enter opens the drawer and Esc returns focus to the chip, next-up "Mark arrived" opens the confirm dialog, empty-day state, holiday state
- [ ] T112 [P] [US3] Write `frontend/tests/e2e/admin-live.spec.ts` (mock API, paused clock): `runFor(1000)` advances the header clock to 11:20:46; greeting at 11:20 / 13:05 / 19:40 Karachi reads morning / afternoon / evening; `runFor(60_000)` moves the now marker to "Now 11:21"; after `runFor(30_000)` the "updated" label resets and a booking added to the mock API shows a "New booking" notification with "View booking" opening its drawer, and the same notification appears on the Bookings screen; a hidden tab makes no requests; demo mode shows a simulated booking after `runFor(50_000)`; reduced motion shows no count-up, pulse or slide

### Implementation for User Story 3

- [ ] T113 [US3] Implement pure metrics in `backend/app/command_centre/metrics.py` (KPIs, utilisation, trends, next-up) shared by both sources
- [ ] T114 [US3] Add Overview queries to `backend/app/repositories/command_centre.py` (one grouped count for today + last week, schedules/leave/holidays via the 005 availability repository, next-up, agenda, the 5 newest bookings by `created_at`) and `overview()` to `RealSource` and `DemoSource`
- [ ] T115 [US3] Implement `GET /admin/overview` (READ) in `backend/app/routers/admin_dashboard.py` incl. `now` and `recentBookings`
- [ ] T116 [US3] Add `overview` (staff + demo fixture, a test hook to append a booking for the live spec) to `frontend/tests/mock-api/admin.mjs`
- [ ] T117 [P] [US3] Build `frontend/src/admin/overview/KpiCard.tsx` and `KpiGrid.tsx` (6 columns ≥ 1400 px, 3 below, 2 on phones; label with icon, display numeral with count-up, trend chip + "vs last Mon" that wraps instead of clipping, sr-only phrase)
- [ ] T118 [US3] Build `frontend/src/admin/overview/AgendaTimeline.tsx` (doctor column, hour grid 09–20, off-hours hatching, chip buttons with 12 px status icons, shared tooltip, now marker driven by `clinicClock` minute ticks, legend, chip activation opens `BookingDrawer`, new-booking glow for 10 s) and the phone variant `AgendaList.tsx` (collapsible doctors, "Now 11:20" marker, rows are buttons; open panels survive refresh)
- [ ] T119 [P] [US3] Build `frontend/src/admin/overview/NextUpList.tsx` (time numerals, masked name, doctor · department, "Mark arrived" through `StatusActions`; empty copy "No more confirmed patients today.") and `StatusMix.tsx` (stacked bar with `role="img"` summary, list with pill, count and %, utilisation note)
- [ ] T120 [US3] Implement `frontend/src/admin/state/newBookings.ts` per T108 and `frontend/src/admin/overview/NewBookingToast.tsx` + a toast region (`aria-live="polite"`, max 3, eyebrow "New booking", "Mehwish H. with Dr. Rahman", "Gynecology · today 12:20 · booked just now", "View booking", Dismiss, progress line; top-right on desktop, below the top bar on phones). Mount the toast region on the Bookings page too, fed by `recentBookings` from `/api/admin/overview` in the same 30 s `livePoll` tick (US3 AS8, FR-042)
- [ ] T121 [US3] Add demo new-booking simulation to `frontend/src/admin/state/demoOverlay.ts` (free future slot, department-appropriate sample patient, 50 s then 75 s)
- [ ] T122 [US3] Build the Overview page `frontend/src/app/(admin)/admin/(app)/page.tsx` (server-rendered first paint; greeting h1 from clinic hour, sub "Today at the clinic · Monday 5 October 2026", actions "Find a booking"/"Open bookings"; a client island that polls `/api/admin/overview` every 30 s via `livePoll`, updates KPIs and lists without moving focus, feeds `newBookings`, and refetches on a new clinic day)
- [ ] T123 [US3] Extend `backend/tests/api/test_demo_separation.py` and `backend/tests/api/test_admin_contract.py` for `/admin/overview`

**CHECKPOINT 6 (US3)**: metrics and overview tests green (SC-009 incl. 23:45); `npm run test:e2e -- tests/e2e/admin-overview.spec.ts tests/e2e/admin-live.spec.ts` green; screenshot of the Overview at 1440 px compared side by side with `design-preview/screenshots/overview_desktop_light.png` in the report.

---

## Phase 7: User Story 5 — Mobile-first premium experience (P1)

**Goal**: phones get the bottom nav, cards and sticky filters. Every screen has skeletons, empty and error states. The Light / Night / Auto theme works and is remembered. WCAG 2.2 AA holds, and nothing is clipped at 390 / 1280 / 1366 / 1440 px.

**Independent Test**: run the main journeys at all four widths, light and dark, keyboard only: axe reports zero violations; the clipping check reports nothing; visual baselines (paused clock) match the approved preview; the theme choice survives a reload.

### Tests for User Story 5 ⚠️

- [ ] T124 [P] [US5] Write `frontend/tests/unit/theme.test.ts`: Light/Night/Auto writes `cc_theme` (`Path=/admin; SameSite=Lax; Max-Age=31536000`), applies `data-theme` at once, and in Auto follows `prefers-color-scheme` changes live; the mobile button cycles Light → Night → Auto with an accurate `aria-label`
- [ ] T125 [P] [US5] Write the clipping helper `frontend/tests/e2e/helpers/clipping.ts`, ported from `design-preview/capture.mjs` `findClipped`. It flags sideways page scroll, clipping boxes that hide content, and leaf text boxes that spill out of themselves. Add a unit self-test fixture page that must fail it
- [ ] T126 [P] [US5] Write `frontend/tests/e2e/admin-mobile.spec.ts`: bottom nav with 5 items, 44×44 px targets, booking cards, sticky filters while scrolling, bottom-sheet drawer, no sideways scroll
- [ ] T127 [P] [US5] Write `frontend/tests/e2e/admin-a11y.spec.ts`: axe (WCAG 2.2 AA tags) on Overview, Bookings (list, drawer, confirm, undo toast), Insights, Doctors today, Activity, Staff, Login, the new-booking toast and the chip tooltip, each in light and dark at 390/1280/1366/1440, with the T125 clipping helper run on every screen at every width (FR-045 covers all pages, not only the baselined ones); keyboard-only journeys (demo open → find booking → arrive → undo; chip → drawer → Esc); reduced motion
- [ ] T128 [P] [US5] Write `frontend/tests/e2e/admin-visual.spec.ts` (mock API demo fixture, clock paused at 11:20:45 Karachi, `animations: "disabled"`): Overview, Bookings, Bookings drawer, confirm dialog, chip tooltip and new-booking toast × light/dark × 390/1280/1366/1440. Each shot runs the clipping helper first (FR-045) and allows a small `maxDiffPixels` only for the toast shot. Baselines are reviewed against `design-preview/screenshots/` before approval (SC-010)
- [ ] T129 [P] [US5] Write `frontend/tests/e2e/admin-theme.spec.ts`: choosing Night persists across reload and navigation without a flash; Auto follows `page.emulateMedia({ colorScheme })` live

### Implementation for User Story 5

- [ ] T130 [US5] Implement `frontend/src/admin/state/theme.ts` and `frontend/src/admin/shell/ThemeToggle.tsx` (sidebar segmented Light/Night/Auto with `aria-pressed`; phone top-bar cycle button), writing the `cc_theme` cookie read by the root layout
- [ ] T131 [P] [US5] Add `loading.tsx` skeletons matching the final layout for every `(app)` route (`frontend/src/app/(admin)/admin/(app)/**/loading.tsx`) and `error.tsx` with the calm "Can't reach the clinic system — retrying" + Retry (auto-retry ×2 with backoff)
- [ ] T132 [P] [US5] Add designed empty states (no bookings today, no search match, too little Insights data, clinic closed) using `EmptyState` across Overview, Bookings and Insights components
- [ ] T133 [US5] Audit all motion behind `prefers-reduced-motion: no-preference` in `frontend/src/admin/**` (count-up, live pulse, chip glow, toast slide, now-marker transition, drawer) and fix anything found by T127/T128 (clipping, contrast, focus order) until all four widths pass

**CHECKPOINT 7 (US5)**: `npm run test:e2e -- tests/e2e/admin-mobile.spec.ts tests/e2e/admin-a11y.spec.ts tests/e2e/admin-visual.spec.ts tests/e2e/admin-theme.spec.ts` green on all admin projects; **show the new visual baselines to Shuaib and get approval before committing them** (SC-010).

---

## Phase 8: User Story 6 — Insights (P2)

**Goal**: bookings per day (7/30/90), by department, status breakdown and busiest hours, each with a summary sentence and a data table.

**Independent Test**: with fixed data each chart shows the exact expected totals for each range, and the text alternative lists the same numbers.

- [ ] T134 [P] [US6] Write insights cases in `backend/tests/unit/test_metrics.py` (zero-filled days ending today, by department with a cancelled column, all five statuses, busiest hours in clinic time, "too little data" < 5) and `backend/tests/api/test_insights_api.py` (`db`; range ∉ {7,30,90} → 422; demo totals)
- [ ] T135 [P] [US6] Write `backend/tests/perf/test_command_centre_latency.py`: with 30 k synthetic bookings, search and every Insights range p95 < 1 s (target 400 ms), Overview p95 < 300 ms (NFR-001)
- [ ] T136 [P] [US6] Write `frontend/tests/unit/charts.test.tsx`: each chart renders `<figure>` with `role="img"` + summary sentence, a "Show data table" `<details>` with a real `<table>`, focusable bars with value labels, patterns for no-show/cancelled; and `frontend/tests/e2e/admin-insights.spec.ts` (range switch 7/30/90 via `?range=`, keyboard through bars, empty state)
- [ ] T137 [US6] Implement insights in `backend/app/command_centre/metrics.py`, queries in `backend/app/repositories/command_centre.py`, `insights()` in both sources, and `GET /admin/insights` in `backend/app/routers/admin_dashboard.py`; add it to the mock API
- [ ] T138 [P] [US6] Build `frontend/src/admin/charts/ChartFigure.tsx`, `ColumnChart.tsx`, `BarList.tsx`, `StatusBreakdown.tsx`, `HourHeatStrip.tsx` (hand-built SVG, < 6 kB total, token colours, both themes)
- [ ] T139 [US6] Build `frontend/src/app/(admin)/admin/(app)/insights/page.tsx` (range in URL, server-rendered charts, empty state)

**CHECKPOINT 8 (US6)**: insights tests + perf test green; chart bundle size recorded.

---

## Phase 9: User Story 7 — Doctors today (P2)

**Goal**: who is in today, with sessions, booked vs free slots and utilisation; leave, not-in-today and holiday states.

**Independent Test**: with fixed schedules, leave and bookings, each doctor's booked, free and utilisation values match; on leave → "On leave"; holiday → "Clinic closed today".

- [ ] T140 [P] [US7] Write doctors-today cases in `backend/tests/unit/test_metrics.py` (free = scheduled − booked, passed free slots flagged, next free slot ≥ now, ordering by next free slot) and `backend/tests/api/test_doctors_today_api.py` (`db`; leave, not in today, holiday, demo)
- [ ] T141 [P] [US7] Write `frontend/tests/e2e/admin-doctors.spec.ts` (cards, "Not in today" collapsed by default, holiday state)
- [ ] T142 [US7] Implement doctors-today in `backend/app/command_centre/metrics.py`, both sources and `GET /admin/doctors-today` in `backend/app/routers/admin_dashboard.py`; add it to the mock API
- [ ] T143 [US7] Build `frontend/src/admin/doctors/DoctorTodayCard.tsx` and `frontend/src/app/(admin)/admin/(app)/doctors/page.tsx`

**CHECKPOINT 9 (US7)**: doctors-today tests green.

---

## Phase 10: User Story 8 — Activity (audit) feed (P3)

**Goal**: Admins see a newest-first, filterable, paged feed of security and operational events; receptionists cannot.

**Independent Test**: perform a sign-in, a status change, an undo and a reveal; the feed shows the four events in order; a receptionist gets 403.

- [ ] T144 [P] [US8] Write `backend/tests/api/test_activity_api.py` (`db`): newest first, filters by action and staff, paging, receptionist 403, demo gets the synthetic feed only, no password/phone/email/name/reason in any entry, 6-character network tag
- [ ] T145 [P] [US8] Write `frontend/tests/e2e/admin-activity.spec.ts` (filters, paging, not in receptionist navigation)
- [ ] T146 [US8] Implement the activity query in `backend/app/repositories/command_centre.py`, `activity()` in both sources, and `GET /admin/activity` (READ_ADMIN) in `backend/app/routers/admin_dashboard.py`; add it to the mock API
- [ ] T147 [US8] Build `frontend/src/admin/activity/ActivityFeed.tsx` and `frontend/src/app/(admin)/admin/(app)/activity/page.tsx`

**CHECKPOINT 10 (US8)**: activity tests green; `test_auth_matrix.py` now covers every row of `contracts/auth-matrix.md`.

---

## Phase 11: Polish, Resilience, Privacy and Proof

**Purpose**: cross-cutting gates and evidence for SC-001…SC-010.

- [ ] T148 [P] Extend `backend/tests/api/test_log_safety.py`: run the whole admin API suite and assert no patient name, phone, email, reason, search term, password or token appears in captured logs (SC-008)
- [ ] T149 [P] Extend `backend/app/booking/retention.py` to purge `staff_session` ended/expired > 30 days and `demo_session` expired > 1 day; tests in `backend/tests/api/test_retention.py`; audit purge stays demo-mode only (FR-031, R17)
- [ ] T150 [P] Extend `frontend/tests/e2e/honesty.spec.ts` to every admin route (disclaimer, credit on login, Sample cues, ribbon in demo)
- [ ] T151 [P] Extend the offline/slow/expired e2e (`frontend/tests/e2e/offline.spec.ts` and mock API modes) to `/admin/login`, the demo entry, Overview polling (last data kept, calm error, backoff) and a timed-out status change (re-fetched, never auto-retried). NFR-002: with the mock API in `admin-down` and `admin-slow` modes and the demo-start limit exhausted, the existing public booking e2e still passes
- [ ] T152 Run the full auth matrix and separation suites and confirm every row of `contracts/auth-matrix.md` is exercised (SC-004, SC-005); record counts in `specs/006-clinic-command-centre/results.md`
- [ ] T153 Re-measure Lighthouse on the 005 page set and public bundle sizes, run `node scripts/check-admin-isolation.mjs` and the isolation e2e, and record the results against T001 in `results.md` (SC-007); check the Overview route's first-load JS ≤ 120 KB gzip
- [ ] T154 Measure SC-001 (demo → Overview readable ≤ 2.5 s on throttled mobile / ≤ 1.5 s desktop) and SC-003 (< 15 s journey) and record them in `results.md`
- [ ] T155 [P] Update `backend/README.md` and `frontend/README.md` (create_admin CLI, SESSION_SECRET, demo, admin tests and visual baselines) and keep `specs/006-clinic-command-centre/quickstart.md` in sync
- [ ] T156 Run `/security-review` on the branch and gitleaks; fix findings
- [ ] T157 Run `specs/006-clinic-command-centre/quickstart.md` §2–§4 end to end on a clean checkout and fill the SC-001…SC-010 evidence table in `results.md`, including the SC-002 informal review (≥ 3 viewers incl. Shuaib: their words, and the unaided find-next-patient-and-mark-arrived time)

**CHECKPOINT 11 (final)**: every command in quickstart §4 green; all SCs evidenced in `results.md`; visual baselines match the approved preview.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)** → **Foundational (Phase 2)** → user stories → **Polish (Phase 11)**.
- Phase 2 blocks every story. Inside Phase 2, T028 (pure move) must land and be green before T029–T049.

### User story dependencies

| Story | Depends on | Why |
|---|---|---|
| US2 Sign-in & roles | Foundational | — |
| US1 Demo | Foundational (+ US2 sign-in replacing a demo session, T051/T070) | session kinds share one cookie |
| US4 Bookings | Foundational; uses US1 `DemoSource`/overlay for the demo path | the staff path is independent |
| US3 Overview | US4 (`BookingDrawer`, `StatusActions`), US1 (demo overlay for simulated bookings) | chips open the drawer; Mark arrived |
| US5 Mobile & polish | US3 + US4 screens exist | it tests and polishes them |
| US6 Insights, US7 Doctors today | Foundational (+ US1 for demo data) | independent of each other and of US3/US4 |
| US8 Activity | US2 (audit events from auth), US4 (status/reveal events) | it displays their audit rows |

### Within each story

Tests first (they must fail), then pure logic → repository/source → router → mock API → components → page, then extend the separation/contract tests.

## Parallel Examples

```text
# Phase 2, auth core tests together:
T016 test_passwords.py   T018 test_tokens.py + test_csrf.py   T009 test_settings.py   T011 test_migrations.py

# US2 tests together:
T050 create_admin CLI   T051 sign-in   T052 sessions   T053 auth matrix   T054 staff admin   T056 session route   T057 e2e

# US4 UI components together (after T097):
T098 StatusBadge/Pagination   T099 FilterBar/StickyFilters   T100 BookingTable/BookingCard   T103 PhoneReveal

# US3 tests together:
T106 metrics   T107 overview API   T108 newBookings   T109 count-up   T110 agenda timeline   T111 overview e2e   T112 live e2e

# After US5: US6 (T134–T139) and US7 (T140–T143) can run side by side.
```

## Implementation Strategy

1. **Foundation first** (Phases 1–2): contract, migration, auth core, policy table + introspection, website split with isolation proofs, shell, live primitives. Nothing user-visible yet, but every later story plugs into one seam each (policy row, source method, BFF allow-list row).
2. **Secure staff access (US2)**, then the **public demo (US1)**: the safety-critical parts land before any screen shows data.
3. **MVP = US2 + US1 + US4 + US3**: staff and demo visitors can run the day (Overview + Bookings) with the live feel. Stop, demo it to Shuaib, and check SC-002/SC-003 informally.
4. **US5** hardens all four widths, themes and accessibility, and freezes the approved visual baselines.
5. **US6, US7, US8** add the P2/P3 screens; **Phase 11** produces the evidence.

## Notes

- `[P]` = different files and no dependency on an unfinished task.
- Commit after each task or logical group; never mix the T028 pure move with other changes.
- Every new admin endpoint needs its `ENDPOINT_POLICIES` row in the same commit, or T024 fails.
- Only synthetic data in tests and fixtures (FR-038); demo patients must fit their department.
- Stop at every CHECKPOINT and report before continuing.
