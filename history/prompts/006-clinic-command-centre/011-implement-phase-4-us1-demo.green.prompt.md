---
id: 011
title: Implement Phase 4 US1 one-click demo
stage: green
date: 2026-10-06
surface: agent
model: claude-sonnet-5-5
feature: 006-clinic-command-centre
branch: 006-clinic-command-centre
user: Shuaibali0786
command: /sp.implement
labels: ["demo","generator","read-only","ribbon","bff","e2e"]
links:
  spec: specs/006-clinic-command-centre/spec.md
  ticket: null
  adr: history/adr/0009-demo-mode-deterministic-data-source.md
  pr: null
files:
 - backend/app/demo/
 - backend/app/routers/admin_auth.py
 - backend/app/routers/admin_staff.py
 - backend/tests/unit/test_demo_generator.py
 - backend/tests/api/test_demo_session.py
 - frontend/src/app/(admin)/admin/demo/start/route.ts
 - frontend/src/components/demo/DemoDashboardButton.tsx
 - frontend/src/admin/shell/DemoRibbon.tsx
 - frontend/src/admin/state/demoOverlay.ts
 - frontend/tests/e2e/admin-demo.spec.ts
 - specs/006-clinic-command-centre/results.md
tests:
 - backend demo tests, Vitest 1193 passed, Playwright admin 380 passed, main 982 passed + 62 baselines regenerated
---

## Prompt

/sp.implement Feature 006 (branch 006-clinic-command-centre): Phase 4 (US1 Demo) only, then stop at its checkpoint. First, one line: confirm the common-password list was enlarged in Phase 3 (entry count). Demo must feel alive and premium: realistic department-appropriate sample names, live clock, moving "Now" line, occasional simulated new-booking toast, clear "Demo mode — changes are not saved" ribbon; server strictly read-only for demo. Rules: commit + push after each logical group. Run pytest + Vitest fully, Playwright admin projects only (main e2e only if public pages/layouts changed — then run it). ruff + mypy + tsc + lint clean. Never print .env or secrets. Dev database only. No visual baselines regenerated without listing why. Use npm.cmd/npx.cmd. If a step hangs >15 min, stop and report. STOP with a short report: what was done, final test table, any issues, and how I can open the demo locally.

## Response

Implemented T068–T084: deterministic demo generator, POST /admin/demo/start with per-IP limit, sample staff, fixture exporter, demo route/button/ribbon/overlay store, mock API demo support, e2e. The Overview "Now" line and new-booking toast belong to US3 and were not built.
