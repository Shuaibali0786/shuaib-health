---
id: 013
title: Implement Phase 6 US3 Overview live
stage: green
date: 2026-10-06
surface: agent
model: claude-sonnet-5-5
feature: 006-clinic-command-centre
branch: 006-clinic-command-centre
user: Shuaibali0786
command: /sp.implement
labels: ["overview","kpi","agenda","live-poll","notifications","demo-simulation"]
links:
  spec: specs/006-clinic-command-centre/spec.md
  ticket: null
  adr: history/adr/0009-demo-data-in-memory-source-seam.md
  pr: null
files:
 - backend/app/command_centre/metrics.py
 - backend/app/routers/admin_dashboard.py
 - backend/app/demo/demo_source.py
 - frontend/src/admin/overview/
 - frontend/src/admin/state/newBookings.ts
 - frontend/src/admin/state/demoSimulation.ts
 - frontend/tests/e2e/admin-overview.spec.ts
 - frontend/tests/e2e/admin-live.spec.ts
 - specs/006-clinic-command-centre/results.md
tests:
 - pytest 914 passed, Vitest 1286, Playwright admin projects 149 (targeted) + 494 (full, before fixes)
---

## Prompt

Feature 006 (branch 006-clinic-command-centre).
First: stop/cancel any /loop or scheduled wakeups — none should run from now on.
Then: loosen test_generation_is_fast to a safe limit (e.g. 0.5 s) with a comment explaining slow machines. Commit.
Then /sp.implement Phase 6 (US3 Overview, live) only, stop at its checkpoint. Overview must match the approved design preview: KPI cards with count-up, today's agenda by doctor with the moving gold "Now" line and hover/tap chips, Next patients up with Mark arrived, Today by status — all live (30s polling), demo realistic.
Rules: commit + push after each logical group. pytest + Vitest fully, Playwright admin projects (main e2e only if public pages changed). ruff + mypy + tsc + lint clean. Never print .env or secrets. Dev database only. Use npm.cmd/npx.cmd. If a step hangs >15 min, stop and report.
STOP with a short report: what was done, final test table, any issues.

## Response snapshot

Cancelled the one scheduled job, loosened the timing test (0.5 s), then built Phase 6: pure metrics and GET /admin/overview for the real and demo sources, the Overview island (KPIs with count-up, agenda timeline with Now line and tooltips, phone list, next patients with Mark arrived, status mix), the New-booking notification store on Overview and Bookings, demo simulation, mock API and tests. Open decision: WCAG target size of timeline chips.

## Outcome

- ✅ Impact: US3 Overview live for staff and demo; checkpoint 6 reached.
- 🧪 Tests: see results.md, Checkpoint 6.
- 📁 Files: backend metrics/route/sources, frontend overview components and state, specs and results.
- 🔁 Next prompts: decide the chip target-size option; Phase 7 (US5).
- 🧠 Reflection: the API's own now is the right clock for the Overview; shell heredocs with apostrophes were unreliable here, file tools were not.

## Evaluation notes (flywheel)

- Failure modes observed: a stale background log read as a fresh result; networkidle waits under a paused clock.
- Graders run and results (PASS/FAIL): all green at checkpoint.
- Prompt variant (if applicable): null
- Next experiment (smallest change to try): a unique log file per background run.
