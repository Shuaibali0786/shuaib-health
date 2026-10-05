# Research: Clinic Command Centre

**Feature**: 006-clinic-command-centre | **Date**: 2026-10-05 | **Plan**: [plan.md](./plan.md)

Each item uses the format Decision / Rationale / Alternatives considered. R-numbers are referenced from the plan, data model and contracts. Inputs: the spec (incl. its Clarifications), the user's planning guidance, the constitution, and the Feature 005 code (`backend/app/deps.py`, `backend/app/middleware/rate_limit.py`, `backend/app/booking/*`, `frontend/src/lib/booking/backend.ts`, `frontend/src/app/api/booking/*`, `frontend/src/app/globals.css`, `frontend/src/app/layout.tsx`).

---

## R1. Staff session mechanism: opaque server-side sessions (not JWT)

**Decision**: On sign-in the backend creates a `staff_session` row and returns a 256-bit random token (`secrets.token_urlsafe(32)`, prefixed `cs_`) **once**, to the website server only. The database stores only `token_hash = HMAC-SHA256(SESSION_SECRET, token)`. The website server sets it as the cookie `__Host-cc_session` (`Secure; HttpOnly; SameSite=Strict; Path=/`, no `Max-Age` → browser-session cookie; the server enforces expiry). Every admin request presents the token to the backend (`X-Session-Token` header, added by the website server from the cookie); the backend hashes it and loads the session in one indexed query.

- Idle expiry 30 min (`idle_expires_at`, slid forward at most once per 60 s to avoid a write on every request), absolute 12 h (`absolute_expires_at`), both checked server-side on every request.
- Sign-in always creates a **new** token (no fixation). Any previous cookie value (staff or demo) is ended on the server first.
- Max 3 active sessions per staff: the sign-in transaction locks the staff row (`SELECT … FOR UPDATE`) and ends the oldest active sessions beyond 2 before inserting the new one.
- Sign-out, password change, admin reset and deactivation set `ended_at` + `end_reason` on the affected sessions in the same transaction.

**Rationale**: The spec requires immediate revocation (sign-out, reset, deactivation, 4th-session eviction, idle timeout). A JWT cannot do that without a server-side denylist or session table — at which point it is an opaque session with extra crypto. HMAC (keyed) rather than plain SHA-256 means a database leak alone does not let anyone forge a lookup. One indexed lookup per request is trivial at ≤ 20 staff.

**Alternatives considered**:
- *JWT in cookie (constitution VI wording)*: rejected — revocation needs state anyway; long-lived signed tokens add key-rotation and clock-skew concerns with no benefit here. **This deviates from the constitution's wording** → Complexity Tracking + ADR candidate + a proposed PATCH/MINOR amendment ("JWT or opaque server-side session token").
- *Cookie set by the backend directly*: impossible without the browser calling the backend origin, which violates the same-origin proxy rule (constitution VI).
- *Plain SHA-256 of the token*: acceptable for high-entropy tokens, but HMAC costs nothing and adds defence in depth.

## R2. Password hashing and policy

**Decision**: `argon2-cffi` `PasswordHasher` with Argon2id, parameters `time_cost=3, memory_cost=65536 (64 MiB), parallelism=1` (OWASP-aligned; ~150–250 ms on a small Render instance — measured in Phase 2 and recorded). `check_needs_rehash` on successful sign-in upgrades old hashes. Policy: ≥ 12 characters, ≤ 128, not equal to/containing the email local part, not in a bundled common-password list (top 10 000 from SecLists, MIT, stored lower-cased as `backend/app/auth/data/common-passwords.txt`, loaded once into a `frozenset`).

**Timing equality**: for an unknown email the service still runs `verify` against a fixed dummy hash, so response time does not reveal whether the account exists.

**Rationale**: Constitution VI mandates Argon2; argon2-cffi is the reference binding (wheels for Windows/Linux). A local list avoids network calls (no HIBP API at sign-in).

**Alternatives considered**: `pwdlib[argon2]` (thin wrapper over argon2-cffi, extra layer); `passlib` (unmaintained); zxcvbn (large, overkill for staff accounts).

**New dependency**: `argon2-cffi` (backend) — justified in Complexity Tracking.

## R3. Sign-in throttling and lockout

**Decision** (two independent layers):
1. **Per sign-in identity**: a `login_throttle` table keyed by `subject_hash = HMAC(PRIVACY_HASH_KEY, "login:" + lower(email))` with `failed_count`, `window_started_at`, `locked_until`. A failure inside a 15-min window increments; the 5th sets `locked_until = now + 15 min` and writes `auth.lockout`. While locked, even a correct password is refused. Because the key is the *typed* email (not the account), **unknown emails lock exactly like real ones**, so the "Too many attempts — try again in 15 minutes" message (`429 account_locked`, `Retry-After`) never reveals whether an account exists. Success deletes the row. No email is stored (HMAC only). This table plays the role of the spec's "failed-attempt count and lock-until time" on Staff Account, moved to a keyed table for enumeration resistance.
2. **Per network address**: the Postgres fixed-window limiter from 005 (`booking/limits.py`) with buckets `login:ip:<hmac>` — 20 attempts / 15 min — and `demo:ip:<hmac>` — 10 demo starts / hour. Over the limit → `429 rate_limited` with `Retry-After`.

Every other failure returns the single generic `401 sign_in_failed` ("Email or password is incorrect"), including for deactivated accounts.

**Rationale**: Account lockout alone allows password spraying across accounts; IP limits alone allow distributed guessing on one account. Reusing the 005 limiter means no new infrastructure (no Redis), consistent with ADR-0006.

**Alternatives considered**: progressive delays (harder to test, keeps connections open); CAPTCHA (third-party dependency, poor a11y).

## R4. CSRF protection

**Decision**: three layers, all required for every state-changing request (and for `POST …/search`, which is a read sent as POST to keep personal search terms out of URLs):
1. **SameSite=Strict** session cookie.
2. **Website route handler guard** (reused from 005 `isSameOrigin`): `Origin` must equal the site origin and `Sec-Fetch-Site` must be `same-origin` (or absent).
3. **Synchronizer token**: `csrf = base64url(HMAC-SHA256(SESSION_SECRET, "csrf:" + session_id))`, returned by `GET /admin/auth/me` (and sign-in / demo start). The client sends it as `X-CSRF-Token`; the website forwards it; the backend recomputes and compares in constant time. It is bound to the session, so a new session invalidates the old token.

Sign-in itself (no session yet) is protected by layers 1–2 plus the backend's `require_proxy_secret` (foreign `Origin` refused), exactly as the 005 booking POST.

**Rationale**: Satisfies constitution VI ("Origin/CSRF checks") with defence in depth; stateless token (derived, not stored) means no extra table.

**Alternatives considered**: double-submit cookie (weaker if a subdomain can set cookies; `__Host-` mitigates but the HMAC-bound token is simpler to reason about); Origin-only (fails on some privacy proxies that strip `Origin`).

## R5. Trusted proxy: reuse the 005 pattern

**Decision**: Every `/api/v1/admin/*` endpoint requires `require_proxy_secret` (the existing dependency) **and** a session (except sign-in and demo start, which require only the proxy secret). The client IP comes from the existing `get_client_ip` (`X-Client-IP` honoured only with a valid `X-Proxy-Secret`). The secret keeps its name `BOOKING_PROXY_SECRET` (renaming would churn env files on two hosts for no security gain; the README documents that it now authorises all website-server → backend calls).

A new secret `SESSION_SECRET` (≥ 32 chars, fail-fast like the 005 secrets, R13 of 005) keys the session-token HMAC and the CSRF HMAC. It is **separate** from `PRIVACY_HASH_KEY` so rotating one does not invalidate the other (rotating `SESSION_SECRET` signs everybody out — documented).

**Rationale**: The browser never talks to the backend; the backend can therefore refuse any admin call that did not come through our website server, which shrinks the attack surface to the website's allow-listed routes.

## R6. Role enforcement: one dependency, one policy table, one introspection test

**Decision**: `app/auth/deps.py` exposes `require_viewer(policy: Policy)` where `Policy` is one of:

| Policy | No session | Demo | Receptionist | Admin |
|---|---|---|---|---|
| `READ` | 401 | 200 (synthetic) | 200 | 200 |
| `READ_ADMIN` | 401 | 200 (synthetic) | 403 | 200 |
| `WRITE` | 401 | 403 `demo_read_only` | 200 | 200 |
| `WRITE_ADMIN` | 401 | 403 `demo_read_only` | 403 | 200 |
| `SELF` (me, logout, change password) | 401 | 200 / n.a. | 200 | 200 |

Each admin route declares its policy with `dependencies=[Depends(require_viewer(Policy.X))]` **and** registers in `ENDPOINT_POLICIES` (method + path → policy). A pytest introspection test walks `app.routes`, and fails if any route under `/api/v1/admin` lacks a policy entry or its dependency, or if the table names a route that does not exist. The auth-matrix test is parametrised from the same table, so adding an endpoint without a matrix row is impossible.

`must_change_password = true` narrows the viewer to `SELF` endpoints only (`403 password_change_required` elsewhere).

**Rationale**: Directly proves SC-004 ("100% of endpoints"); the UI hiding a control is never the protection (FR-009).

## R7. Demo mode: separate session kind, deterministic generator, data-source seam

**Decision**:
- **Session**: `POST /api/v1/admin/demo/start` (proxy secret + per-IP limit) creates a `demo_session` row (`token_hash`, `demo_date` = Karachi date at start, `expires_at` = +2 h) and returns a `cd_`-prefixed token. Same cookie name as staff (`__Host-cc_session`), so a browser is either demo or staff, never both; the prefix routes the lookup to the right table; a `cd_` token can never match a staff session ("cannot be upgraded"). Sign-in replaces it.
- **Data**: `app/demo/generator.py` builds a `DemoDataset` for a Karachi date with `random.Random(f"shuaib-health-demo:v1:{date.isoformat()}")` — deterministic (FR-011, Assumptions), versioned seed so a generator change can be rolled deliberately. It uses the **public** sample doctors, departments and weekly schedules (already public catalog data, labelled Sample) read once, and synthetic patients from a fixed list of obviously-sample names. It covers date−90 … date+14, realistic distributions (busier mornings, Mon/Sat peaks, ~8 % no-show, ~6 % cancellations, past days fully resolved, today split by "now"), and a synthetic activity feed and staff list. Cached with `functools.lru_cache(maxsize=2)` keyed by `(date, catalog_etag)`; ~ 6–9 k bookings generated in < 150 ms (budgeted and tested).
- **Seam**: every Command Centre read goes through a `CommandCentreSource` protocol with two implementations: `RealSource` (SQL, `app/command_centre/repositories/*`) and `DemoSource` (in-memory over `DemoDataset`). The viewer kind picks the source in one place (`get_source` dependency). `DemoSource`'s module is import-guarded by a test: it must not import `app.repositories.appointments`, the `Appointment` model or the DB session. KPI/insight maths are **pure functions** shared by both sources, so the demo exercises the exact same calculations.
- **"Now" in the demo**: the dataset is generated for the session's `demo_date`; statuses for today are derived relative to the request's clock (appointments before now are mostly Arrived/Completed), so the demo looks live all day but stays consistent on reload within the same day.
- **Writes**: refused server-side (`WRITE*` policies). The browser applies demo interactions to an in-memory overlay (R11); reload discards it.
- **Phone reveal in demo**: `POST …/reveal-phone` is `READ`-policy (it is an audited read for staff). For a demo viewer it returns the synthetic number from the dataset and writes **nothing** (no audit row, nothing stored) — consistent with FR-013/FR-014.

**Rationale**: SC-005 (zero mixing) is guaranteed structurally — demo rows are never in Postgres, and real rows are never read for a demo viewer. Determinism makes visual baselines and tests stable.

**Alternatives considered**: (a) demo rows in the `appointment` table with `is_demo` — rejected: one missed `WHERE` leaks real data or pollutes staff views, and demo rows would collide with the exclusion constraint and public slot availability; (b) generating the demo entirely in the browser — rejected: the user wants a server-side read-only demo session, the generator would ship to clients, and the server-side refusal (FR-014) would have nothing to refuse; (c) a separate demo database — operational overhead with no benefit.

## R8. Booking status extension (safe migration)

**Decision**: migration `0003_command_centre`:
- `appointment.status` CHECK becomes `IN ('confirmed','arrived','completed','no_show','cancelled')` (drop + add `ck_appointment_status_valid`; existing values remain valid, so no data change).
- **Exclusion constraint** changes from `WHERE status = 'confirmed'` to `WHERE status <> 'cancelled'`: an Arrived (or Completed/No-show) booking must keep its slot; only cancellation frees it (FR-026). Existing rows: only `confirmed` (and possibly `cancelled`) exist; no overlap can appear by widening to non-cancelled because no completed/arrived rows exist yet. The migration takes a short `ACCESS EXCLUSIVE` lock on a small table (≤ a few thousand rows in demo retention).
- `CONFIRMED_SQL` used by slot generation (`models.py`, `repositories/availability.py`) becomes `OCCUPYING_SQL = "status <> 'cancelled'"`; the 005 slot tests are extended with an Arrived booking blocking a slot. The max-active-per-phone index/count keeps `status = 'confirmed'` (upcoming bookings only).
- `appointment.version integer NOT NULL DEFAULT 1` for optimistic concurrency.
- Index `ix_appointment_starts_at` (btree) for date-range reads.

Downgrade: map `arrived→confirmed`, `no_show→cancelled`? **No** — a lossy downgrade could silently free slots. Downgrade **refuses** (raises) if any row has `arrived`/`no_show`, otherwise restores the old CHECK and constraint. The up/down migration test covers both paths.

**Alternatives considered**: Postgres ENUM type (harder to alter in Alembic, needs `ALTER TYPE … ADD VALUE` outside transactions); a separate `status_v2` column (double-write complexity).

## R9. Status change transaction, undo and concurrency

**Decision**: `app/command_centre/status.py` (pure rules) + `service.change_status()` (transaction):
1. Pure rule check: allowed transition (FR-023), time rules with the injected `Clock` (Arrived ≥ start−2 h; No-show ≥ start; Cancel < start).
2. `UPDATE appointment SET status=:to, version=version+1, updated_at=now() WHERE reference=:ref AND version=:expected AND status=:from RETURNING …` — 0 rows → `409 booking_changed` with the current booking.
3. Insert `appointment_status_change` (from, to, actor staff, `is_undo=false`, `undo_expires_at = now+10 s`).
4. Insert `audit_log` (`booking.status_changed`, from/to, reference).
5. Commit (NFR-004: all or nothing).

**Undo**: `POST …/status/undo {changeId}` — allowed only if that change is the booking's latest change, by the same staff member, `now ≤ undo_expires_at + 2 s grace` (network latency), and `version` still equals the version the change produced; otherwise `409 undo_unavailable` ("This booking was changed by someone else" / "Undo time has passed"). Undoing a cancellation re-occupies the slot; if a public booking took it in between, the exclusion constraint raises `23P01` → `409 slot_taken`. Undo is recorded as its own status-change row (`is_undo=true`, `undoes_change_id`) and audit event `booking.status_undone`.

**Rationale**: Optimistic locking is the natural fit for "refuse if it changed since you saw it" (FR-025) and needs no long locks.

## R10. Time zone, KPIs and aggregates

**Decision**: Reuse 005's `Clock`, `timeutil` and UTC storage. "Today" = `datetime.now(UTC).astimezone(ZoneInfo(clinic.timezone)).date()`. Day ranges are converted to UTC half-open intervals in Python; SQL groups by `(starts_at AT TIME ZONE 'Asia/Karachi')` with the zone **as a bound parameter**, never relying on the session `TimeZone` (PgBouncer transaction mode, 005 R5). Hours for "busiest hours" use the same expression. The 23:45 boundary test runs with the server `TZ=America/New_York`.

**Chair utilisation**: `booked_non_cancelled_today / scheduled_slots_today`, where scheduled slots come from the **005 slot grid** (pure `slots.py` grid generation for each working doctor, minus leave, zero on a holiday) **without** the "past" and "lead time" filters. "—" when the denominator is 0.

**Trend**: the same metric for `today − 7 days`, delta as an integer (or percentage points for utilisation).

**Performance (NFR-001)**: Overview = 3 queries (today+last-week counts by status in one grouped query; schedules/leave/holidays via the existing availability repo; next-up list). Insights = one grouped query per chart on `starts_at` range (index) — ≤ 30 k rows → well under 1 s. Search = `ILIKE` with escaped wildcards on reference and `lower(patient_name)` within the date range + filters, `LIMIT 20 OFFSET n` plus `count(*) OVER ()`. Measured in a perf test with 30 k synthetic rows; `pg_trgm` is the documented fallback if p95 > 500 ms.

Every admin read runs with `SET LOCAL statement_timeout = '3s'` so a slow dashboard query cannot hold pool connections the public booking flow needs (NFR-002).

## R11. Frontend architecture: isolated route group, BFF and data flow

**Decision**:
- **Two root layouts**. Public routes move (with `git mv`, URLs unchanged) into `src/app/(site)/` with today's `layout.tsx` (header, footer, notice bar, Jakarta/Inter fonts, `site.css`). The Command Centre lives in `src/app/(admin)/admin/` with its **own root layout** (`<html>`/`<body>`, admin fonts, `admin.css`, theme attribute, `robots: noindex`). Navigating between the two is a full page load, which is exactly the isolation we want: no admin JS, CSS or font is part of any public page's graph. Next 16 requires `global-not-found.tsx` when there are multiple root layouts; the current `not-found.tsx` content moves there.
- **Separate CSS entries**. `tokens.css` holds the `@theme` brand tokens (single source of hex values — tokens test updated to scan it). `site.css` = `@import "tailwindcss" source(none); @import "./tokens.css"; @source "../components"…` scoped to public sources; `admin.css` scoped to `src/admin/**`. Public CSS (inlined, `inlineCss: true`) therefore does not grow with admin classes. Admin code lives in `src/admin/` (components, lib, state) so the scoping globs are simple.
- **BFF**: `src/app/api/admin/[...path]/route.ts` with an explicit **allow-list** (method + path pattern → backend path, body limit, timeout). Anything not on the list → 404. It reads the cookie, adds `X-Session-Token`, `X-CSRF-Token`, `X-Proxy-Secret`, `X-Client-IP`, `X-Request-ID`, enforces `isSameOrigin` on non-GET, sets `Cache-Control: no-store`, `X-Robots-Tag: noindex`, and never logs bodies or query strings (path templates only). Sign-in, sign-out and demo start are dedicated route handlers because they set/clear the cookie.
- **Rendering**: admin pages are server components that fetch initial data through `src/admin/lib/server.ts` (server-only, same allow-list helper) so first paint is complete (SC-001), then hand it to small client islands (filters, drawer, status actions, charts' interactivity). The `(app)` layout calls `/admin/auth/me`; no session → redirect to `/admin/login?next=<path>` (path only, never query values with personal data).
- **Client state**: React state + `useSyncExternalStore` stores in `src/admin/state/`; no Zustand needed (consistent with 005 R8). The **demo overlay** is a store keyed by booking reference holding local status/history changes, applied on top of server data; it lives in memory only (reload resets, FR-013).
- **Theme**: `data-theme="light|dark"` on `<html>` from a non-sensitive `cc_theme` cookie read in the admin root layout → no flash, works without JS; "system" uses `prefers-color-scheme` via CSS. **Default: light** (constitution VIII says "light theme"; dark is an opt-in staff preference — see Constitution Check).

**Alternatives considered**: a single root layout with a client-side "hide chrome on /admin" switch (ships site chrome to admin and couples bundles); a separate Next app on a subdomain (two deployments, duplicated tokens, cookie scope complications); Server Actions (005 R7 chose route handlers; keeping one pattern).

## R12. Proving no admin code on public pages

**Decision** (two independent checks, both in CI):
1. **Build manifest check** `frontend/scripts/check-admin-isolation.mjs` (run after `next build`): reads the per-route client reference / build manifests, collects the chunk set of every `(admin)` route and every public route, and fails if any public route references a chunk that appears **only** under admin routes, or if any public route's CSS file contains an admin-only class marker.
2. **Runtime check** `tests/e2e/admin-isolation.spec.ts`: visits every public route (from `lib/pages.ts` + sitemap), waits for idle, hovers/scrolls so `<Link>` prefetch fires, records every `.js`/`.css` response and asserts none contains the sentinel string `__SH_COMMAND_CENTRE__` (a constant exported from `src/admin/marker.ts` and referenced by the admin root layout client entry, so it survives minification) and none has a URL under an admin chunk from check 1.

**Prefetch trap (lesson from 005 `results.md`)**: the "View Demo Dashboard" control on public pages is a plain HTML `<form method="post" action="/admin/demo/start">` with a `<button>` — not a `<Link>` — so Next can never prefetch the admin route, and it works without JS. The staff-login link (if any on public pages) uses `prefetch={false}`.

**Lighthouse**: public pages are re-measured with the same procedure as 004/005 and recorded in `results.md` (SC-007, FR-036).

## R13. Charts: hand-built SVG

**Decision**: four small server-renderable components in `src/admin/charts/` with no dependency: `ColumnChart` (bookings per day; 7/30/90 bars, thinned axis labels), `BarList` (by department, horizontal bars with values), `StatusBreakdown` (single stacked bar + legend with counts and %), `HourHeatStrip` (24 cells, clinic hours only shown). Each renders `<figure>` with `role="img"` + `aria-labelledby` summary sentence (e.g. "Bookings per day, last 30 days: total 812, busiest Monday 6 October with 41"), a visible "Show data table" disclosure (`<details>`) containing a real `<table>`, value labels on hover/focus via focusable bars (`tabindex=0`, `aria-label`), status never by colour alone (labels + patterns for no-show/cancelled), respects reduced motion. Colours come from tokens; both themes checked for 3:1 non-text contrast.

**Alternatives considered**: Recharts (~100 kB gz + d3 deps), Chart.js (canvas → poor a11y, ~70 kB), uPlot (~45 kB, canvas). Hand-built SVG is < 6 kB for four simple chart types and gives full control over a11y.

## R14. Design system: brand tokens, "serif headings" and dark "navy night"

**Finding**: the website's headings use **Plus Jakarta Sans** (sans-serif), not a serif; gold exists only as a restrained accent (`gold-500`, `gold-700`). The spec and the guidance ask for serif headings.

**Decision (proposal, confirmed at the design gate)**: keep the website's tokens (navy, teal, gold, radii, shadows) as the single source; the Command Centre adds a **serif display face for headings and KPI numerals only**, loaded with `next/font` in the admin root layout (so it never loads on public pages). Proposed face: **Fraunces** (variable, optical sizing, legible at small sizes); fallback option **Cormorant Garamond** (more "Harley Street", weaker at small sizes). Body stays Inter. The public website is **not** changed in this feature.

**Navy night**: dark theme tokens derived from the brand: background `navy-950` (new, darker than `navy-900`), surfaces `navy-900`/`navy-800`, text near-white, teal-300 for accent text, gold-500 hairlines. New tokens live in `tokens.css` (single source rule). Contrast verified by an extended `tokens.test.ts` (AA text pairs for both themes).

## R15. First admin CLI and seed safety

**Decision**: `uv run python -m app.auth.create_admin --email <email> [--name <display name>]` prompts twice with `getpass` (or reads one line from stdin with `--password-stdin` for automation/tests), validates the policy (R2), refuses if an account with that email exists, creates an Admin, writes `staff.created` audit (actor `system`), prints only "Admin account created." It is allowed in every environment (it is the only way to bootstrap production). The seed (`app.seed`) never touches `staff_account`; a test asserts the seed module tree does not import `app.auth` models, and that after seeding the table is empty. The seed's existing production refusal is kept.

## R16. Observability and log safety

**Decision**: Extend the existing structured access log with `role` (`admin|receptionist|demo|none`) and `outcome` for `/api/v1/admin/*` (from a request-state value set by the auth dependency); no query strings, no bodies. Counters for sign-in failures, lockouts, refused requests (401/403 by policy) and demo starts are emitted as structured log events (`event=auth.failure` etc.) — the operator aggregates them from logs (no metrics backend in scope). The 005 log-capture test is extended: run the whole admin API suite, assert no patient name, phone, email, reason, search term, password or token appears in captured logs (SC-008). The website BFF logs path templates only (`/admin/bookings/{reference}`).

## R17. Retention

**Decision**: one purge function extended (`booking/retention.py` → also `staff_session` ended/expired > 30 days, `demo_session` expired > 1 day). `appointment_status_change` rows cascade with their appointment (demo-mode 7-day booking purge). Audit retention per FR-031: the existing 90-day purge runs **only** when `DEMO_MODE=true` (unchanged); when `DEMO_MODE=false` nothing purges audit rows, which satisfies "at least 1 year". Settings validation is extended: `AUDIT_PURGE_AFTER_DAYS` is ignored (and a warning logged) when not in demo mode.

**Known limit**: in the demo-mode deployment, real bookings are deleted 7 days after the appointment, so the real-data "same weekday last week" trend is computed from partially purged data and 30/90-day Insights look sparse for real data (spec Edge Cases). The public demo is unaffected. Documented in quickstart and the Overview's trend tooltip ("Comparison limited by the 7-day demo retention").

## R18. Design preview gate (FR-039)

**Decision**: immediately after this plan (before `/sp.tasks` implementation code), build a **static** preview in `specs/006-clinic-command-centre/design-preview/`: plain HTML + the compiled brand tokens + the proposed serif face, showing **Overview** and **Bookings** (incl. drawer open and a confirm dialog) at 390 px and 1440 px, light and navy night, filled with a fixture produced from the planned demo distributions. Playwright captures 8 screenshots (`design-preview/screenshots/`); the preview is also published as a private page for viewing on a phone. Work STOPS until Shuaib approves. Approved screenshots become the reference for the visual baselines (SC-010). No file under `frontend/src` or `backend/app` is written before approval.

**Rationale**: zero feature code and zero build impact; fast to iterate on look; the decisions it fixes (serif face, density, dark palette, card vs table, ribbon style) are cheap to change there and expensive later.
