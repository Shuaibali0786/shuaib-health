<!--
Sync Impact Report
- Version change: (unfilled template) → 1.0.0
- Modified principles: none renamed (initial ratification; all 10 principles newly defined)
- Added sections: Core Principles I–X; Technology Stack & Deployment Constraints;
  Development Workflow & Quality Gates; Governance
- Removed sections: none (template placeholders replaced)
- Templates requiring updates:
  - ✅ .specify/templates/plan-template.md (Constitution Check gates listed)
  - ✅ .specify/templates/tasks-template.md (tests are mandatory per Principle IX, not optional)
  - ✅ .specify/templates/spec-template.md (reviewed; no change needed)
  - ✅ .specify/templates/phr-template.prompt.md (reviewed; no change needed)
  - ⚠ .specify/templates/commands/*.md (directory does not exist; nothing to update)
  - ⚠ README.md (does not exist yet; add link to this constitution when created)
- Follow-up TODOs: none deferred
-->
# Shuaib Health Constitution

Shuaib Health is a **portfolio-demo** premium multi-specialty clinic and diagnostic lab website
plus staff web app for Karachi, Pakistan. It is not a real clinic. Every rule below is written so
it can be verified by a test, a script, a code search, or a visual check. "MUST" and "MUST NOT"
are non-negotiable; "SHOULD" requires a written justification to skip.

## Core Principles

### I. Honesty (NON-NEGOTIABLE)
The product MUST NOT present anything fabricated as real.
- No fake reviews, ratings, testimonials, statistics, awards, accreditations, certifications, or
  other brands' names or logos. Sample doctors, prices, packages, and any numbers are allowed
  only when visibly labelled as sample/demo content.
- Every page (public site, patient area, staff app, login, error pages) MUST show the text
  "Portfolio demo — not a real clinic, not medical advice."
- The site footer and the staff login page MUST show "Designed & built by Shuaib Ali" linking to
  https://github.com/Shuaibali0786.

Rationale: a portfolio demo that imitates a real clinic could mislead visitors about medical
care. Honest labelling protects visitors and the author.

Test: a Playwright test visits every route and asserts the disclaimer; footer and staff login
tests assert the credit text and link `href`; a repo grep gate fails on words such as "rated",
"award", "accredited", "JCI", "ISO-certified" and on any third-party logo asset without an
allow-list entry.

### II. Health Data Privacy
Health data is treated as sensitive even though the data is demo data.
- Role-based access control with exactly these roles: `patient`, `receptionist`, `doctor`,
  `lab_staff`, `admin`. Authorization is enforced on the server for every protected endpoint.
- A patient MUST only ever read or change their own data.
- Lab reports are downloadable only by the owning patient and authorized staff roles, through an
  authenticated endpoint. Report files MUST NOT be served from public or guessable URLs.
- Important actions (login, failed login, booking/reschedule/cancel, status change, report
  view/download, role change) MUST write an audit log entry with actor, action, target, and
  timestamp.
- Logs MUST NOT contain medical data (diagnoses, results, notes) or secrets (passwords, tokens,
  cookies, connection strings).
- Auth, booking, and lookup endpoints MUST be rate limited.

Test: per-role authorization tests (a patient requesting another patient's record or report gets
403/404); audit-log tests for each listed action; a log-capture test asserting no secret or
medical field values appear; rate-limit tests returning 429 on auth, booking, and lookup.

### III. Server Is the Source of Truth
The server decides; clients only display and request.
- Slot generation, booking rules, prices, and statuses are computed and validated on the server.
  Client-supplied prices, statuses, or slot times MUST be ignored or rejected.
- Double-booking MUST be prevented at the database level (unique/exclusion constraint), not only
  in application code.
- All stored and exchanged times use the Asia/Karachi timezone (or UTC on the wire with explicit
  conversion to Asia/Karachi for display and slot rules). All prices are in PKR.

Test: a concurrency test firing simultaneous bookings for one slot yields exactly one success and
the rest 409; a request with a tampered price/status is rejected or overridden; slot tests cover
a Karachi day boundary and confirm no other timezone leaks into slot logic.

### IV. API-First
Booking, availability, reschedule, cancel, and status are one set of reusable APIs.
- The website, the staff app, and the future AI agent MUST call the same endpoints and are bound
  by the same rules. No client gets a private or looser code path.
- Every endpoint has a typed request/response schema (Pydantic/SQLModel on the backend, Zod plus
  TypeScript types on the frontend) and a documented error taxonomy.

Test: contract tests run the same booking scenarios through each client's API layer; the OpenAPI
schema is committed or generated in CI and diffed for breaking changes.

### V. Resilience
The frontend build MUST NOT fail if the backend is unreachable at build time.
- Build-time data fetches MUST catch failures and fall back to static or mock data, or defer to
  runtime.
- Runtime pages MUST show a friendly error or empty state when the backend is down.

Test: CI runs `next build` with the backend URL unset or pointing to a dead host and must pass;
a Playwright test with the API blocked asserts friendly fallbacks and no crash.

### VI. Security
- Passwords are hashed with Argon2. Plaintext or reversible storage is forbidden.
- Sessions use a JWT stored in an `httpOnly`, `Secure`, `SameSite` cookie; tokens MUST NOT be
  readable from JavaScript or stored in localStorage.
- State-changing requests MUST pass Origin/CSRF checks.
- The frontend on Vercel reaches the backend through a same-origin proxy (rewrites/route
  handlers), so the browser never calls the backend origin directly. Backend CORS is strict: an
  explicit allow-list of origins, no wildcard, no credentials for unknown origins.
- `.env` files and secrets MUST NOT be committed. Secrets MUST NOT be printed in logs, errors,
  test output, or chat. Only `.env.example` with placeholder values is committed.

Test: unit test asserts Argon2 hash prefix; cookie-flag test; cross-origin and missing-Origin
POST is rejected; CORS test with a disallowed origin gets no CORS headers; a secret-scan step
(e.g. gitleaks) plus `.gitignore` check runs in CI.

### VII. Databases
- Databases are Neon Postgres. The application uses the **pooled** connection URL; Alembic
  migrations use the **direct** (unpooled) URL.
- Development and production MUST use separate databases with separate credentials. Tests MUST
  NOT run against production.
- Schema changes go through Alembic migrations only, each reversible where practical.

Test: config validation fails at startup if the app URL is the direct URL or if the dev and prod
URLs are identical; CI applies migrations up and down on a scratch database.

### VIII. Design and Accessibility
- Look and feel: premium, calm, light theme. Headings use deep navy `#0B2545`; accents use teal
  `#14B8A6` with teal-to-blue gradients; rounded cards with soft shadows.
- Motion is subtle and MUST respect `prefers-reduced-motion` (disabled or reduced when set).
- Mobile-first layouts; WCAG 2.2 AA (contrast, focus visibility, keyboard operation, target
  size, labels, error identification).
- Performance: good Core Web Vitals (target LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 on a mid-range
  mobile profile). All images use `next/image` with sizes and alt text; fonts use `next/font`.
- Design tokens (colors, radii, shadows) live in one place (Tailwind v4 theme) and are reused.

Test: token check against the hex values above; axe-core assertions in Playwright on key pages;
a reduced-motion emulation test; Lighthouse CI budgets; lint rule/grep forbids raw `<img>`.

### IX. Quality
- TypeScript is `strict`; `any` is forbidden (lint error, with `@ts-expect-error` allowed only
  with a written reason). Python code is fully type-hinted and checked.
- Business logic (slot generation, booking rules, pricing, access rules, validators) MUST have
  unit tests. Key user flows (browse → book, cancel/reschedule, login per role, report
  download) MUST have Playwright tests.
- Changes are small and reviewable: one concern per change, no unrelated refactors.

Test: CI runs type-check, lint, unit tests, and Playwright, and blocks merge on failure.

### X. Build Order
Work proceeds in phases; a later phase MUST NOT start before the previous phase's acceptance
checks pass, except for explicitly approved spikes.
1. **Phase 1** — Frontend with mock data (clearly labelled).
2. **Phase 2** — Backend (FastAPI, database, auth, booking APIs).
3. **Phase 3** — Staff app.
4. **Phase 4** — Deploy (Vercel + Render) and polish.
5. **Phase 5** — AI chatbot agent with tool calling, using only the public APIs from Principle IV
   and bound by Principles I, II, and III (no medical advice, no cross-patient data).

Test: each phase has a checklist in its spec/plan; `tasks.md` items carry a phase label and
cannot reference a later phase's deliverables.

## Technology Stack & Deployment Constraints

- Monorepo with `frontend/` and `backend/`.
- Frontend: Next.js (App Router), TypeScript strict, Tailwind CSS v4, Framer Motion, Zustand,
  React Hook Form + Zod, lucide-react, `next/font`, `next/image`. Hosted on Vercel.
- Backend: FastAPI, SQLModel, Alembic, psycopg 3, managed and run with `uv`. Hosted on Render.
- Database: Neon Postgres (Principle VII).
- New runtime dependencies beyond this list require justification in the plan (Complexity
  Tracking). Configuration comes from environment variables documented in `.env.example`.

## Development Workflow & Quality Gates

- Spec-Driven Development: constitution → spec → plan → tasks → implementation. Every user
  prompt gets a Prompt History Record under `history/prompts/`.
- Every plan MUST pass the Constitution Check (see `.specify/templates/plan-template.md`) before
  research and again after design. Violations go in Complexity Tracking with justification.
- Architecturally significant decisions are proposed as ADRs (only with user consent).
- Merge gate: type-check, lint, unit tests, Playwright, secret scan, and the frontend build with
  the backend unreachable all pass.

## Governance

This constitution supersedes other practices in this repository. Amendments require: a written
change with rationale, an updated Sync Impact Report, an updated version and Last Amended date,
and a review of dependent templates for consistency. Versioning follows semantic versioning:
MAJOR for removing or redefining a principle in a backward-incompatible way, MINOR for adding a
principle or materially expanding guidance, PATCH for clarifications and wording. Compliance is
reviewed at each plan (Constitution Check) and each merge; reviewers MUST reject changes that
violate a principle unless an approved amendment or documented exception exists. Runtime agent
guidance lives in `CLAUDE.md`.

**Version**: 1.0.0 | **Ratified**: 2026-09-30 | **Last Amended**: 2026-09-30
