---
id: 001
title: Catalog API Spec
stage: spec
date: 2026-10-03
surface: agent
model: claude-opus-5-5
feature: 003-catalog-api
branch: 003-catalog-api
user: Shuaibali0786
command: /sp.specify
labels: ["spec", "backend", "catalog-api", "white-label", "security-baseline", "seed-data"]
links:
  spec: specs/003-catalog-api/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - specs/003-catalog-api/spec.md
 - specs/003-catalog-api/checklists/requirements.md
tests:
 - none (specification only)
---

## Prompt

/sp.specify Feature 003: Backend foundation + read-only clinic catalog API for Shuaib Health (Phase 2, first backend piece). Follow the constitution (API-first, server is source of truth, security, privacy, honesty, Asia/Karachi, PKR).

Goal: a real, secure FastAPI backend that serves the clinic's public catalog from Postgres, so the website (Feature 004) and later the booking flow, staff app and AI agent all read the SAME data through the SAME API. No writes, no login, no booking in this feature.

Stack: backend/ folder, FastAPI, SQLModel, Alembic, psycopg3, run with uv, Neon Postgres (dev database only for now). Pooled connection URL for the app, direct URL for migrations. Settings from environment variables; .env never committed; commit a .env.example with placeholder values only. Windows CMD friendly commands.

White-label from day 1: nothing about the clinic is hard-coded in backend code. Name, logo, colours, address, phones, emergency number, timezone, hours, demo-notice text and clinic rules all come from the database. One database per clinic (single-tenant deployment).

Data (catalog only):
- ClinicSettings (one row), ClinicRule (ordered, active flag, text; e.g. arrive 15 min early, cancel 2h before, no-show policy after 3, test preparation, emergencies not via booking).
- Department, Doctor (public slug, qualifications, languages, experience years, fee in PKR, photo key, isSample, active), DoctorWeeklySchedule (weekday, start time, end time, slot length in minutes; Asia/Karachi).
- LabTest (slug, category, aka names, price PKR, sample type, report time, preparation, home collection yes/no), HealthPackage with its included tests.
- Internal IDs are non-guessable (UUID); public URLs use slugs. Money stored as integer PKR. Timestamps stored with timezone.

Public read-only API under /api/v1:
- GET /clinic, GET /clinic/rules
- GET /departments, GET /departments/{slug}
- GET /doctors (filter by department, search by name, day of week), GET /doctors/{slug} (with weekly schedule)
- GET /lab-tests (search, category filter), GET /lab-tests/{slug}
- GET /health-packages, GET /health-packages/{slug}
- Response shapes match the frontend's existing TypeScript types / contracts from Features 001–002 so the frontend can switch without redesign. Lists are paginated. Unknown slug → 404 in a consistent error format.
- GET /health (liveness) and GET /ready (database reachable).

Seed: an idempotent seed command that loads exactly the same sample data as the frontend mock files (all marked isSample), safe to run many times.

Security and privacy baseline (applies to every later feature):
- Strict CORS allowlist from settings; security headers; consistent JSON error format; no stack traces or SQL errors sent to clients.
- Rate limiting on all public endpoints (per IP), returning 429 with Retry-After.
- Request ID on every request; structured logs that never contain personal data, medical data, secrets or full connection strings.
- Database connections use SSL; credentials only from environment.
- Input validation on every query parameter (lengths, enums, page size limits).

Performance: list endpoints respond fast (target under 200 ms on the dev database for normal page sizes), indexes on slugs and foreign keys, Cache-Control/ETag on public catalog responses.

Quality: pytest unit and API tests against a separate test database, migration upgrade/downgrade test, lint and type checks, a README section on how to run backend locally on Windows.

Out of scope: any write endpoints, authentication, OTP, booking, availability/slots calculation, notifications, file storage, staff app, connecting the frontend (Feature 004), deployment.

## Response snapshot

Created branch `003-catalog-api` and `specs/003-catalog-api/spec.md` with 5 prioritized user stories (P1 doctors/departments, P1 lab tests/packages, P2 clinic settings/rules, P2 idempotent seed, P2 safe operations), edge cases, FRs grouped by white-label, endpoints, errors (taxonomy 404/405/422/429/500/503), health/readiness, seed, security baseline, caching, quality; key entities; 8 measurable success criteria; constraints; assumptions; out of scope. No clarification markers; judgement calls recorded as assumptions: random UUIDs returned as `id`, 15-minute sample `slotMinutes` (additive), `{items,total,page,pageSize}` envelope, extra `GET /lab-test-categories`, 60 req/min default, 5-minute cache, seed adds 5 sample rules, seed refuses production. Checklist at `specs/003-catalog-api/checklists/requirements.md` all passing.

## Outcome

- ✅ Impact: Feature 003 spec ready for /sp.clarify or /sp.plan
- 🧪 Tests: none (specification only)
- 📁 Files: spec.md, checklists/requirements.md
- 🔁 Next prompts: /sp.clarify (optional, to confirm assumptions) or /sp.plan
- 🧠 Reflection: frontend mock IDs are readable strings while the spec requires UUIDs; resolved by returning UUIDs as `id` and comparing by slug in contract tests.

## Evaluation notes (flywheel)

- Failure modes observed: create-new-feature.ps1 created the branch and spec file but then reported a parameter-binding error; outputs verified manually.
- Graders run and results (PASS/FAIL): spec quality checklist PASS
- Prompt variant (if applicable): null
- Next experiment (smallest change to try): null
