# Implementation Plan: Clinic Command Centre — Staff Dashboard and Public One-Click Demo

**Branch**: `006-clinic-command-centre` | **Date**: 2026-10-05 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-clinic-command-centre/spec.md`

## Summary

Give clinic staff a private, premium **Command Centre** under `/admin` (Overview, Bookings, Insights, Doctors today, Activity, minimal Staff accounts) and give the public a **one-click, read-only demo** of it with deterministic synthetic data.

**Backend (FastAPI + Neon, migration `0003_command_centre`)**:
- **Auth**: opaque server-side sessions (random token → HMAC hash in `staff_session`), Argon2id, 30 min idle / 12 h absolute, max 3 sessions, per-email-HMAC lockout (5 in 15 min → 15 min) + per-IP Postgres limits, synchronizer CSRF token, and one `require_viewer(policy)` dependency on every admin endpoint, backed by a policy table that an introspection test checks route by route (R1–R6).
- **Trusted proxy (005 pattern)**: every admin endpoint requires the existing `X-Proxy-Secret`; client IP via `X-Client-IP` only with the secret. New `SESSION_SECRET` (fail fast).
- **Status flow**: `appointment.status` gains `arrived`, `no_show`; the no-overlap exclusion constraint widens to `status <> 'cancelled'`; `version` column for optimistic concurrency; `appointment_status_change` history; single-transaction change + history + audit; 10 s undo (R8, R9).
- **Audit**: Feature 005's `audit_log` extended with staff actor, role, booking reference, from/to status and new actions; still no personal-data columns.
- **Demo**: `demo_session` (2 h, Karachi date pinned) + an in-memory deterministic generator per Karachi date behind a `CommandCentreSource` seam (`RealSource` SQL vs `DemoSource` memory). Demo can never write and never sees real rows (R7).
- **First admin** only via `python -m app.auth.create_admin`; the seed never creates staff (R15).

**Website (Next.js 16)**:
- Public routes move into `app/(site)/` (URLs unchanged); the Command Centre gets its **own root layout** in `app/(admin)/admin/`, its own CSS entry and fonts, so no admin JS/CSS/font is in any public page graph — proven by a build-manifest check, a runtime Playwright scan for a sentinel string, and Lighthouse (R11, R12).
- Same-origin BFF: an allow-listed catch-all `app/api/admin/[...path]` plus dedicated session/demo handlers that own the `__Host-cc_session` cookie.
- Server components render first paint; small client islands for filters, drawer, confirm/undo, phone reveal; a browser-only **demo overlay** makes demo interactions feel real and vanish on reload.
- Hand-built accessible SVG charts (< 6 kB, no chart library) (R13). Brand tokens shared via `tokens.css`; serif display face (**Cormorant Garamond**, approved at the gate) + "navy night" dark theme scoped to admin (R14). Live feel: Karachi clock, 30 s polling of the Overview with new-booking notifications, moving "now" marker, KPI count-up (R19, FR-040…FR-044).

**Design gate (FR-039)**: right after this plan, a static design preview (Overview + Bookings; 390/1280/1366/1440 px; light/dark; demo data) is built under `specs/006-clinic-command-centre/design-preview/` and work **stops** for Shuaib's approval before any feature code (R18). **Approved 2026-10-06** with font A and the live changes (R18 outcome, R19).

## Technical Context

**Language/Version**: Python 3.12 (backend); TypeScript 6 strict, Node 24 (frontend)
**Primary Dependencies**:
- Backend: FastAPI 0.142, SQLModel 0.0.47, Alembic 1.20, psycopg 3.3, pydantic-settings (existing) + **`argon2-cffi`** (new, R2; required by constitution VI). `secrets`, `hmac`, `hashlib`, `random`, `zoneinfo`, `getpass` are stdlib.
- Frontend: Next.js 16.3.7, React 19.2, zod, lucide-react, framer-motion (existing). **No new dependency**: charts are hand-built SVG; the serif face comes through `next/font/google`; no state library (R11).

**Storage**: Neon Postgres. New tables `staff_account`, `staff_session`, `demo_session`, `login_throttle`, `appointment_status_change`; `appointment` and `audit_log` extended (data-model.md). Demo data is never stored.
**Testing**: pytest (unit: rules, KPIs, generator determinism, password policy, CSRF, masking; api: auth matrix, route-policy introspection, status/undo/concurrency, data separation, log safety; migrations up/down; perf with 30 k rows); Vitest (BFF allow-list and guards, cookie flags, schemas, overlay store, chart components, formatting); Playwright admin projects `admin-desktop` (1440×900), `admin-laptop-1366` (1366×768), `admin-laptop-1280` (1280×800) and `admin-mobile` (Pixel 7 / 390 px), visual baselines (light/dark × 390/1280/1366/1440, frozen clock), axe on every screen and state, keyboard-only journeys, reduced motion, isolation spec.
**Target Platform**: backend on Render-type host; website on Vercel/Node.
**Project Type**: Web application (`backend/` + `frontend/`).

**Performance Goals**:
- Overview fully readable ≤ 2.5 s on mid-range phone/4G, ≤ 1.5 s desktop (SC-001): server-rendered first paint; Overview API p95 ≤ 300 ms (real), ≤ 150 ms (demo, generator cached).
- Bookings search and every Insights range p95 ≤ 1 s at 30 k bookings (NFR-001); target ≤ 400 ms.
- Status change p95 ≤ 400 ms server.
- Admin client JS budget: ≤ 120 KB gzip for the Overview route (first load), charts ≤ 6 KB.
- Public pages: Lighthouse scores ≥ 005 baseline, zero admin bytes (SC-007).

**Constraints**: "today" = Asia/Karachi everywhere; UTC storage; no personal data in logs, URLs, audit or counters; demo never touches real data; dashboard failure/overload must not affect public booking (statement timeout 3 s on admin reads, demo generator cached, per-IP demo limit); build independent of backend (Principle V).
**Scale/Scope**: 1 clinic, ≤ 20 staff, ≤ 300 bookings/day, ≤ 30 k bookings in 90 days; 7 screens; ~20 admin endpoints.

No NEEDS CLARIFICATION remain: the spec's Clarifications session and the user's planning guidance resolved policy; the rest is decided in [research.md](./research.md) R1–R19. The serif display face was confirmed at the design gate: Cormorant Garamond (R14).

## Constitution Check

*Pre-design: PASS with one documented deviation (VI wording). Post-design: PASS (re-checked after data-model and contracts).*

- [x] **I. Honesty**: the admin root layout renders the "Portfolio demo — not a real clinic, not medical advice." notice on every admin page (incl. login and error states); the login page shows the "Designed & built by Shuaib Ali" credit link; demo records carry `isSample` and visible "Sample" cues; the demo ribbon. The honesty e2e is extended to every admin route. No fake stats: KPIs are computed from data; demo numbers are labelled sample.
- [x] **II. Privacy**: roles enforced server-side on every endpoint (R6, auth-matrix); this feature implements the `admin` and `receptionist` roles of the constitution's set (patient/doctor/lab_staff remain for later features); demo is a session kind, not a role. Audit: sign-in success/failure, lockout, sign-out, expiry, status change, undo, phone reveal, staff changes (role change included). No personal data in logs (extended log-capture test, SC-008). Rate limits on sign-in and demo start (R3). Phone/email masked by default; reveal audited.
- [x] **III. Server truth**: allowed transitions and time rules computed server-side (clock-injected); client sends only `to` + `expectedVersion`; `allowedNext` is server-computed; double-booking still prevented by the DB exclusion constraint (widened to non-cancelled, R8); Karachi day boundaries via bound zone parameter; fees in PKR.
- [x] **IV. API-first**: one admin API used by the staff UI and the demo (same shapes); contract delta merged into the 003 contract (1.2.0) with drift tests on both sides; typed pydantic + zod schemas; error taxonomy extended.
- [x] **V. Resilience**: admin pages are dynamic (no build-time fetch); `next build` with backend unreachable still passes (existing CI job covers it); admin screens show skeletons, then a calm "Can't reach the clinic system — retrying" with Retry; offline e2e extended to `/admin/login` and the demo entry.
- [x] **VI. Security**: Argon2id ✅; httpOnly + Secure + SameSite=Strict cookie, not readable by JS ✅; Origin + `Sec-Fetch-Site` + synchronizer CSRF token ✅; same-origin proxy, browser never calls backend, strict CORS unchanged ✅; secrets env-only, fail fast ✅. **Opaque server-side session tokens** (R1) are used because immediate revocation is a spec requirement. This was a deviation from constitution 1.0.0 ("Sessions use a JWT"), resolved by amendment **1.0.1** ("a JWT or an opaque server-side session token"); see ADR-0007.
- [x] **VII. Databases**: pooled URL for the app, direct for Alembic; `0003` reversible (refuses lossy downgrade, R8); tests on `TEST_DATABASE_URL` only; seed refuses production and never creates staff.
- [x] **VIII. Design/a11y**: tokens reused from one place (`tokens.css`, incl. `#0B2545`, `#14B8A6`); new dark/serif tokens added there; reduced motion respected; WCAG 2.2 AA with axe on all screens in both themes and widths; 44×44 px touch targets; charts with text + table alternatives; Core Web Vitals budgets. Note: constitution says "light theme" — the Command Centre defaults to **light**; "navy night" is an opt-in staff preference required by the spec (FR-032). The public site is unchanged.
- [x] **IX. Quality**: TS strict, no `any`; mypy strict, ruff; unit tests for every rule (transitions, time rules, KPIs, utilisation, generator, password policy, CSRF, lockout); Playwright for login per role, demo, find + change status; small phased diffs.
- [x] **X. Build order**: this is constitution **Phase 3 — Staff app**; Phase 2 (backend, booking APIs) was completed by 005. Deploy (Phase 4) and AI agent (Phase 5) are excluded.

## Project Structure

### Documentation (this feature)

```text
specs/006-clinic-command-centre/
├── spec.md
├── plan.md                              # this file
├── research.md                          # R1–R19
├── data-model.md                        # tables, state machine, KPIs, demo dataset, validation
├── quickstart.md
├── contracts/
│   ├── command-centre-api.openapi.yaml  # delta → merged into specs/003-catalog-api/contracts/openapi.yaml (1.2.0)
│   ├── auth-matrix.md                   # endpoint × viewer matrix (SC-004)
│   └── website-admin.md                 # pages, cookie, BFF allow-list, isolation proofs, mock API
├── design-preview/                      # FR-039 gate — approved 2026-10-06 (font A + live changes)
│   ├── index.html, preview.html, preview.css, render.js, data.js, capture.mjs, README.md
│   └── screenshots/                     # 390/1280/1366/1440 × light/dark × Overview/Bookings states
├── checklists/requirements.md
└── tasks.md                             # /sp.tasks
```

### Source Code

```text
backend/
├── .env.example                          # + SESSION_SECRET and the optional auth/demo tunables
├── pyproject.toml / uv.lock              # + argon2-cffi
├── app/
│   ├── settings.py                       # + session_secret (≥ 32, fail fast), timeouts, limits, undo seconds
│   ├── models.py                         # + StaffAccount, StaffSession, DemoSession, LoginThrottle,
│   │                                     #   AppointmentStatusChange; Appointment.version + statuses;
│   │                                     #   AuditLog new columns/values; CONFIRMED_SQL → OCCUPYING_SQL
│   ├── errors.py                         # + new error codes (auth, csrf, demo, conflicts)
│   ├── main.py                           # + admin routers; access log gets role/outcome
│   ├── auth/                             # NEW
│   │   ├── passwords.py                  # Argon2id hash/verify/rehash, policy, dummy-hash timing
│   │   ├── data/common-passwords.txt
│   │   ├── tokens.py                     # token generation, HMAC hashing, CSRF derive/verify
│   │   ├── sessions.py                   # create/lookup/slide/end, max-3 eviction, expiry audit
│   │   ├── throttle.py                   # login_throttle upsert/lock + 005 limiter buckets
│   │   ├── policies.py                   # Policy enum + ENDPOINT_POLICIES table
│   │   ├── deps.py                       # require_viewer(policy), Viewer, get_source
│   │   ├── service.py                    # sign_in, sign_out, change_password, staff admin ops (last-admin lock)
│   │   └── create_admin.py               # `python -m app.auth.create_admin`
│   ├── command_centre/                   # NEW domain package (pure first)
│   │   ├── status.py                     # transition + time rules (pure)
│   │   ├── metrics.py                    # KPIs, utilisation, trends, insights, doctors-today (pure)
│   │   ├── source.py                     # CommandCentreSource protocol
│   │   ├── real_source.py                # SQL implementation (statement_timeout 3 s)
│   │   ├── service.py                    # change_status / undo / reveal transactions
│   │   └── masking.py                    # re-exports 005 masking + short name "Ayesha K."
│   ├── demo/                             # NEW
│   │   ├── generator.py                  # deterministic DemoDataset per Karachi date (seed v1)
│   │   ├── names.py                      # sample names (obviously sample)
│   │   └── demo_source.py                # in-memory CommandCentreSource (no DB imports — guarded)
│   ├── repositories/command_centre.py    # aggregate + search queries
│   ├── repositories/availability.py      # OCCUPYING_SQL
│   ├── routers/admin_auth.py             # sign-in, demo start, me, sign-out, change password
│   ├── routers/admin_bookings.py         # search, detail, status, undo, reveal
│   ├── routers/admin_dashboard.py        # lookups, overview, insights, doctors-today, activity
│   ├── routers/admin_staff.py            # list, create, reset, patch
│   └── booking/retention.py              # + staff/demo session purge
├── migrations/versions/0003_command_centre.py
└── tests/
    ├── unit/test_passwords.py, test_tokens.py, test_csrf.py, test_status_rules.py, test_metrics.py,
    │        test_demo_generator.py (determinism, distributions, day boundary), test_demo_import_guard.py,
    │        test_create_admin_cli.py, test_settings.py (extended)
    ├── api/test_auth_matrix.py, test_route_policies.py, test_sign_in.py (lockout, timing, fixation),
    │       test_sessions.py (idle/absolute/max-3/deactivate), test_status_change.py (incl. concurrency + undo),
    │       test_reveal_phone.py, test_overview_api.py, test_insights_api.py, test_doctors_today_api.py,
    │       test_activity_api.py, test_staff_admin.py (last admin race), test_demo_separation.py,
    │       test_log_safety.py (extended), test_slots_api.py (arrived blocks slot), test_seed_idempotency.py (no staff)
    ├── perf/test_command_centre_latency.py
    └── migrations/test_migrations.py      # 0003 up/down + lossy downgrade refusal

frontend/
├── next.config.ts                        # admin headers (no-store, noindex, no-referrer)
├── scripts/check-admin-isolation.mjs     # NEW build-manifest proof
├── src/
│   ├── app/
│   │   ├── tokens.css                    # NEW: @theme brand tokens (moved from globals.css) + navy-night + serif token
│   │   ├── (site)/layout.tsx, site.css   # existing chrome + public CSS entry (scoped @source)
│   │   ├── (site)/**                     # existing public routes moved with git mv (URLs unchanged)
│   │   ├── global-not-found.tsx          # required with multiple root layouts
│   │   ├── (admin)/admin/layout.tsx      # admin root layout: fonts, admin.css, theme cookie, noindex, disclaimer
│   │   ├── (admin)/admin/admin.css
│   │   ├── (admin)/admin/login/page.tsx
│   │   ├── (admin)/admin/demo/start/route.ts
│   │   ├── (admin)/admin/(app)/layout.tsx      # session guard (/me), shell, nav, demo ribbon
│   │   ├── (admin)/admin/(app)/page.tsx        # Overview
│   │   ├── (admin)/admin/(app)/{bookings,insights,doctors,activity,staff,account/password}/page.tsx
│   │   ├── api/admin/[...path]/route.ts        # allow-listed BFF
│   │   ├── api/admin/session/route.ts          # sign-in / sign-out
│   │   ├── api/admin/password/route.ts
│   │   └── robots.ts                           # + Disallow: /admin
│   ├── admin/                            # NEW: all Command Centre code (CSS scope root)
│   │   ├── marker.ts                     # __SH_COMMAND_CENTRE__ sentinel
│   │   ├── lib/bffRoutes.ts, server.ts (server-only), client.ts, schemas.ts (zod), format.ts (Karachi)
│   │   ├── state/demoOverlay.ts, undo.ts, theme.ts, clinicClock.ts, livePoll.ts, newBookings.ts (R19)
│   │   ├── shell/AppShell, SideNav, BottomNav, MobileTopBar, StatusBar, DemoRibbon, ThemeToggle, SessionExpiredDialog
│   │   ├── overview/KpiCard, KpiGrid, AgendaTimeline, AgendaList, NextUpList, StatusMix, NewBookingToast
│   │   ├── bookings/FilterBar, StickyFilters, BookingTable, BookingCard, BookingDrawer, StatusActions,
│   │   │           ConfirmDialog, UndoToast, PhoneReveal, StatusBadge, Pagination
│   │   ├── charts/ColumnChart, BarList, StatusBreakdown, HourHeatStrip, ChartFigure (summary + table)
│   │   ├── doctors/DoctorTodayCard; activity/ActivityFeed; staff/StaffTable, StaffForms
│   │   └── ui/Skeleton, EmptyState, ErrorState, Drawer, Dialog, VisuallyHidden
│   ├── components/layout/SiteFooter.tsx  # + DemoDashboardButton (plain form)
│   ├── components/demo/DemoDashboardButton.tsx   # server component, no JS
│   └── app/(site)/about/page.tsx         # + DemoDashboardButton
└── tests/
    ├── fixtures/admin/demo-day.json      # generated by backend generator for a fixed date, committed
    ├── mock-api/server.mjs               # + admin endpoints and failure modes
    ├── unit/admin-bff-route, admin-session-route, admin-demo-route, admin-schemas, demo-overlay,
    │        undo-store, admin-format (Karachi), charts (a11y summaries/tables), status-actions, phone-reveal,
    │        tokens (extended: dark pairs), guards/single-fetch/server-only-boundary (extended)
    └── e2e/admin-demo, admin-auth (per role, lockout message, expiry), admin-bookings (find → arrive → complete,
            undo, reveal, conflict), admin-overview, admin-insights, admin-doctors, admin-activity, admin-staff,
            admin-mobile (bottom nav, cards, sticky filters, 44px), admin-a11y (axe × screens × themes × widths,
            keyboard-only, reduced motion), admin-visual (baselines at 390/1280/1366/1440 + clipping check), admin-live (frozen clock: tick, poll, toast, now marker), admin-isolation, honesty (extended)
```

**Structure Decision**: existing web-application layout. Backend adds three domain packages (`auth/`, `command_centre/`, `demo/`) with pure logic separated from routers and repositories, following 005. Frontend splits into two root layouts via route groups, and puts all Command Centre code under `src/admin/` so CSS scoping, the isolation check and code review have one clear boundary.

## Key Decisions (ADR candidates)

1. **Opaque server-side sessions instead of JWT** (R1, R4): HMAC-hashed tokens, `__Host-` cookie, SameSite=Strict + Origin + synchronizer CSRF, per-email-HMAC lockout + per-IP limits, Argon2id. Deviates from constitution VI wording → amendment proposal.
2. **Policy-table authorization** (R6): one dependency, one table, introspection test, matrix test generated from the table.
3. **Command Centre isolation** (R11, R12): separate root layout + CSS entry + fonts, `src/admin/` boundary, allow-listed BFF, plain-form demo entry (no prefetch), build-manifest + runtime sentinel + Lighthouse proofs.
4. **Demo architecture** (R7): separate session kind and table, deterministic in-memory generator per Karachi date, `CommandCentreSource` seam with an import guard, browser-only overlay for demo interactions.
5. **Booking status model** (R8, R9): new statuses, exclusion constraint on non-cancelled, optimistic `version`, history table, single-transaction change + audit, time-boxed undo; refuse lossy downgrade.
6. **Hand-built SVG charts** (R13) and **admin-scoped serif + navy-night tokens** (R14).

## Phases (each ends with a checkpoint: checks green + short summary to the user)

| Phase | Goal | Main work | Checkpoint |
|---|---|---|---|
| **0. Design preview — GATE** (FR-039) | Approve the look before code | Static HTML preview (Overview + Bookings incl. drawer/confirm), 390/1280/1366/1440 × light/dark, demo fixture; serif face options; screenshots; private preview link | **STOP until Shuaib approves** — ✅ approved 2026-10-06 (font A + live changes); approved screenshots = baseline reference |
| **1. Setup & contract** | Baselines; API agreed first | Record backend/frontend/Lighthouse/bundle baselines in `results.md`; merge OpenAPI delta (1.2.0); regenerate types; zod schemas; drift tests | Existing suites green; contract parses; drift tests catch injected drift |
| **2. Foundation: data + auth core** | FR-001–009 core | `0003` migration; settings (`SESSION_SECRET` fail fast); passwords, tokens, sessions, throttle, CSRF; `require_viewer` + policy table + introspection test; `create_admin` CLI; seed guard | Migration up/down + lossy-downgrade refusal; unit tests; introspection test green |
| **3. Website restructure & isolation** | FR-036 foundation | `git mv` public routes into `(site)`; `tokens.css`/`site.css`/`admin.css`; admin root layout + `global-not-found`; BFF allow-list + session/demo handlers; isolation script + sentinel e2e | All existing unit/e2e green unchanged; isolation proofs green; Lighthouse ≥ baseline |
| **4. US2 Sign-in & roles** 🎯 | Secure access | Login page, sign-out, expiry dialog, change password, staff screen (create/reset/deactivate/role, last-admin) | Full auth matrix green (SC-004); lockout/timing/fixation/expiry tests; e2e per role |
| **5. US1 Public demo** 🎯 | One-click demo | Generator + `DemoSource`; demo start (rate limited); ribbon; overlay; footer/About/login buttons | Determinism + separation tests (SC-005); demo e2e incl. reload reset and crafted-write refusal |
| **6. US4 Bookings** | Daily work | Search (POST), filters (URL-safe), pagination, drawer, status actions + confirm + undo, conflict, reveal (60 s), cancel frees slot | Status/undo/concurrency tests; reveal audit; e2e find → arrive → complete < 15 s (SC-003) |
| **7. US3 Overview** | Today at a glance, live | Metrics (pure), real/demo sources, KPI cards with trends, agenda timeline (chips open the US4 drawer), next-up + Mark arrived (US4 status actions), live clock, polling, new-booking notifications | Fixed-data KPI tests incl. 23:45 boundary with non-Karachi TZ (SC-009); overview + live e2e (frozen clock) |
| **8. US5 Mobile & polish** | Premium on phones | Bottom nav, cards, sticky filters, skeletons, empty/error states, themes, reduced motion | axe zero violations × screens × themes × widths (SC-006); keyboard-only journeys; visual baselines |
| **9. US6 Insights + US7 Doctors today** | P2 screens | SVG charts with summaries/tables; ranges; doctors today | Exact-value tests; perf 30 k rows p95 < 1 s (NFR-001) |
| **10. US8 Activity** | Accountability | Feed with filters; synthetic feed for demo | Event-order test; receptionist refused |
| **11. Resilience, privacy & proof** | Final gate | Offline/slow/expired e2e; log-safety (SC-008); honesty e2e; READMEs; `results.md` SC-001…SC-010; gitleaks | Every gate green; all SCs evidenced; visual baselines match approved preview (SC-010) |

## Testing Strategy (summary)

- **API auth matrix** (contracts/auth-matrix.md): every admin endpoint × {no session, demo, receptionist, admin, must-change-password} + session-state variants + CSRF/proxy/Origin negatives; generated from `ENDPOINT_POLICIES`; route introspection guarantees completeness (SC-004).
- **Unit**: transitions/time rules, KPIs/utilisation/trends/insights (fixed clock, non-Karachi `TZ`), generator determinism and distributions, password policy, token/CSRF, lockout windows, masking, Karachi formatting, overlay and undo stores, BFF guards.
- **Integration**: status change atomicity (fault injection between history and audit insert → rollback), concurrent changes (one 200, one 409), undo races, cancel → slot reappears in public slots, last-admin race, demo/real separation, log safety.
- **Playwright**: `admin-desktop`, `admin-laptop-1366`, `admin-laptop-1280` and `admin-mobile` projects; journeys per role and demo; keyboard-only; reduced motion; offline/slow/expired.
- **Visual baselines** (SC-010): Overview, Bookings (list, drawer, confirm), the agenda chip tooltip and the new-booking toast × light/dark × 390 / 1280 / 1366 / 1440 px on the deterministic demo fixture, with the Playwright clock paused (`clock.install` + `pauseAt`, advanced with `runFor`) and animations disabled; reviewed against the approved gate screenshots. A clipping check (no sideways scroll, no clipped or self-overflowing text) runs on **every** admin screen at every width (FR-045), inside the visual and a11y specs. The new-booking toast shot allows a small `maxDiffPixels` for anti-aliasing of its shadow layer.
- **Accessibility**: axe (WCAG 2.2 AA tags) on every screen/state in both themes and widths; focus-trap/return tests for drawer/dialogs; charts' summary + table.
- **Isolation**: build-manifest script, runtime sentinel scan with prefetch, Lighthouse vs baseline.

## Non-Functional Budgets and Operations

- **Latency**: see Performance Goals. BFF timeouts 5–10 s; a slow backend shows skeleton → "Can't reach the clinic system — retrying" (auto-retry ×2 with backoff, then Retry button); writes never auto-retry (the user decides; a timed-out status change is re-fetched to show the truth).
- **Isolation from public booking (NFR-002)**: admin reads `SET LOCAL statement_timeout = '3s'`; demo generator cached per date (no DB per demo request beyond the session lookup); per-IP demo limit; status writes are short transactions.
- **Security**: secrets env-only; constant-time compares; HMAC-keyed tokens/fingerprints; cookies `__Host-`/Secure/HttpOnly/Strict; `no-store` + `noindex` + `no-referrer` on all admin responses; CSP unchanged from site baseline plus `frame-ancestors 'none'` on admin.
- **Observability (NFR-003)**: access log with route template, role, outcome, duration, request id; structured events for auth failures, lockouts, refused requests, demo starts.
- **Rollback**: `alembic downgrade 0002_booking` (refuses if arrived/no_show rows exist — operator first resolves them, documented); website: revert the route-group commit; the demo button can be removed from the public site independently.

## Risks (top 3)

1. **Route-group move breaks public pages or tests** (many files move; static guards reference paths).
   - Mitigation: Phase 3 is a pure move commit first (`git mv`, no content change) with the full existing unit + e2e + Lighthouse suites as the gate, before any admin code is added; `global-not-found.tsx` covered by the existing not-found e2e.
2. **Admin code leaking into public bundles** (shared components, `<Link>` prefetch, Tailwind scanning).
   - Mitigation: `src/admin/` boundary + ESLint `no-restricted-imports` (public code may not import `@/admin/*`); plain-form demo button; scoped `@source`; build-manifest + runtime sentinel proofs in CI.
3. **Auth implementation flaws** (fixation, CSRF gaps, enumeration, missing role check on a new endpoint).
   - Mitigation: policy-table + introspection test makes an unguarded endpoint fail CI; matrix tests incl. CSRF/Origin/proxy negatives; timing-equalised failures; per-email-HMAC lockout that treats unknown emails identically; `/security-review` before merge.

## Complexity Tracking

| Item | Why needed | Simpler alternative rejected because |
|---|---|---|
| **Opaque server-side sessions instead of JWT** (was a VI deviation; resolved by constitution 1.0.1) | Spec requires immediate revocation (sign-out, reset, deactivation, max 3 sessions, idle timeout) | JWT would still need a server-side session/denylist table, adding signing-key management with no benefit; VI amended to allow either |
| New backend dependency `argon2-cffi` | Constitution VI mandates Argon2 | Implementing Argon2 by hand is unsafe; `pwdlib`/`passlib` only wrap it |
| New secret `SESSION_SECRET` | Keys token and CSRF HMACs, rotatable independently of `PRIVACY_HASH_KEY` | Reusing `PRIVACY_HASH_KEY` would sign everyone out whenever privacy fingerprints rotate and couple unrelated purposes |
| Two root layouts + two CSS entries | Hard guarantee that admin JS/CSS/fonts never load on public pages (FR-036) and public inlined CSS does not grow | A shared root layout ships site chrome to admin and admin classes into the inlined public CSS |
| Demo data source seam (`RealSource`/`DemoSource`) | Structural guarantee of zero real/demo mixing (SC-005) | Demo rows in the real table depend on every query remembering a filter and would interfere with slot availability |

## ADR Suggestions

📋 Architectural decision detected: staff authentication via opaque server-side sessions (HMAC-hashed tokens, `__Host-` cookie, SameSite=Strict + synchronizer CSRF, per-email-HMAC lockout, Argon2id) and policy-table authorization — deviates from constitution VI's "JWT" wording. Document reasoning and tradeoffs? Run `/sp.adr staff-auth-opaque-sessions-and-policy-table`

📋 Architectural decision detected: Command Centre isolation (separate root layout, CSS entry, fonts and `src/admin/` boundary; allow-listed BFF; build + runtime isolation proofs). Document reasoning and tradeoffs? Run `/sp.adr command-centre-isolation-and-bff`

📋 Architectural decision detected: demo mode as a separate read-only session kind with a deterministic in-memory generator behind a data-source seam. Document reasoning and tradeoffs? Run `/sp.adr demo-mode-deterministic-data-source`

📋 Architectural decision detected: booking status model extension (arrived/no_show, exclusion on non-cancelled, optimistic version, status history, undo window). Document reasoning and tradeoffs? Run `/sp.adr booking-status-lifecycle-and-concurrency`

Also recommended: `/sp.constitution` PATCH amendment to Principle VI ("Sessions use a JWT **or an opaque server-side session token** stored in an `httpOnly`, `Secure`, `SameSite` cookie").
