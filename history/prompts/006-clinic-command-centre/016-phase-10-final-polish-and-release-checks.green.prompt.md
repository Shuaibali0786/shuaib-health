---
id: 016
title: Phase 10 final polish and release checks
stage: green
date: 2026-10-08
surface: agent
model: claude-sonnet-5-5
feature: 006-clinic-command-centre
branch: 006-clinic-command-centre
user: Shuaibali0786
command: /sp.implement
labels: ["release-checks", "test-isolation", "mypy", "performance", "lighthouse", "gitleaks"]
links:
  spec: specs/006-clinic-command-centre/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - backend/tests/conftest.py
 - backend/app/repositories/command_centre.py
 - backend/app/command_centre/service.py
 - backend/migrations/versions/0002_booking.py
 - backend/migrations/versions/0003_command_centre.py
 - backend/pyproject.toml
 - backend/app/demo/export_fixture.py
 - backend/README.md
 - .gitleaksignore
 - specs/006-clinic-command-centre/results.md
 - specs/006-clinic-command-centre/quickstart.md
tests:
 - backend pytest full: 1025 passed, 1 skipped, 4 deselected
 - Playwright full: 1888 passed, 201 skipped
 - Vitest: 1355 passed
---

## Prompt

Feature 006 (branch 006-clinic-command-centre): /sp.implement Phase 10 (final polish & release checks), then STOP before creating any PR.
1. Run the full suites ONE AFTER ANOTHER, never in parallel against the same dev database: first full backend pytest alone, then full Playwright (admin + main) alone, then Vitest. Fix every failure and re-run until each full suite passes cleanly in a single run. Report the clean numbers.
2. Make tests safe for the future: suites must not collide when run together (e.g. a separate test database/schema per suite, or a lock). Explain what you chose.
3. Fix the 7 old mypy errors in migrations and the CLI test so mypy is fully clean.
4. Overview performance: reduce the ~10 sequential queries (combine or run concurrently) and report p95 again.
5. Release checks: gitleaks, npm audit + pip-audit (report, don't force-downgrade), Lighthouse mobile for Home, Book appointment and /admin (demo), admin isolation check, DEMO_ENABLED on/off check.
6. Update results.md and the quickstart; commit + push.
Rules: never print .env or secrets; dev database only; npm.cmd/npx.cmd; no lingering wait-loops; if a step hangs >15 min, stop and report.
STOP with a short report: final test table (each suite's single clean run), Lighthouse, audits, anything left.

## Response snapshot

Ran backend, Playwright and Vitest one after another, all green. Added a Postgres advisory lock (AUTOCOMMIT connection) to the pytest session so two runs cannot share the test database; a first version idled in a transaction and was killed by the server, which showed up as a teardown error and was fixed and re-run. mypy now covers migrations and is clean. Overview queries 10 to 8 (p95 1032 to 841 ms raw, 183 ms net). gitleaks: two fake test credentials allow-listed. npm audit: 7 high reported; pip-audit clean. Lighthouse and isolation recorded.

## Outcome

- ✅ Impact: Phase 10 gates run and recorded; tasks T148-T152, T154-T157 not completed and left unticked.
- 🧪 Tests: see front matter.
- 📁 Files: see front matter.
- 🔁 Next prompts: decide on Next 16.4.0 upgrade; remaining Phase 11 tasks (T148-T151, T152, T154-T157); then PR.
- 🧠 Reflection: a lock held on an idle connection needs AUTOCOMMIT; long-run teardown errors only show on a full run.

## Evaluation notes (flywheel)

- Failure modes observed: idle-in-transaction timeout dropped the lock connection after 22 minutes.
- Graders run and results (PASS/FAIL): all suites PASS in a single clean run.
- Prompt variant (if applicable): null
- Next experiment (smallest change to try): run the Overview reads on a connection pool in production only.
