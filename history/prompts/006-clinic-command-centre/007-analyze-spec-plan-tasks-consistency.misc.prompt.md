---
id: 007
title: Analyze spec plan tasks consistency
stage: misc
date: 2026-10-06
surface: agent
model: claude-opus-5-5
feature: 006-clinic-command-centre
branch: 006-clinic-command-centre
user: Shuaibali0786
command: /sp.analyze
labels: ["analysis","coverage","security","design-gate","tasks"]
links:
  spec: specs/006-clinic-command-centre/spec.md
  ticket: null
  adr: history/adr/0007-staff-auth-opaque-sessions-and-policy-table.md
  pr: null
files:
 - specs/006-clinic-command-centre/tasks.md
 - specs/006-clinic-command-centre/plan.md
 - history/prompts/006-clinic-command-centre/007-analyze-spec-plan-tasks-consistency.misc.prompt.md
tests:
 - none (documentation-only analysis; no code)
---

## Prompt

Feature 006 (branch 006-clinic-command-centre). Check spec, plan and tasks are consistent, every requirement (FR/NFR/SC) has tasks, security tasks are complete (auth matrix, demo read-only, CSRF, lockout, audit), and the design-gate decisions (font A, live clock, polling, 1366px tests, sample names) are covered. Fix any issues found, commit + push, then STOP with a short summary.

## Response snapshot

Cross-checked spec (FR-001…FR-045, NFR-001…004, SC-001…010), plan, tasks, auth matrix and constitution 1.0.1. All requirements already had tasks; security core (auth matrix, demo read-only, CSRF, lockout) and design-gate items (font A, live clock, polling, 1366 px, sample names) were covered. Gaps fixed in tasks.md: no test that admin routes are rate limited (Constitution II) → T026; NFR-003 operator counts → T027; FR-037 no-store/noindex header assertions → T040; `auth.sign_out` audit → T052/T058; session-state variants in auth matrix → T053; missing admin-staff e2e → T057 + Checkpoint 3; demo 2 h expiry UX → T065/T074; tel: Call after reveal → T090/T103; Bookings refresh keeps drawer/focus → T092; new-booking toasts on Bookings screen (US3 AS8) → T112/T120; FR-045 clipping on every screen → T127; NFR-002 public booking unaffected → T151; SC-002 review evidence → T157; long-name/lane-scroll edge case → T110. Plan aligned: four Playwright projects, 390/1280/1366/1440 preview widths and actual preview files, phase order US4 before US3, shell/overview component lists, visual baseline scope.

## Outcome

- ✅ Impact: 0 critical; 14 coverage/consistency gaps closed by extending existing tasks (no renumbering, still 157 tasks)
- 🧪 Tests: none run (documentation only)
- 📁 Files: tasks.md, plan.md
- 🔁 Next prompts: /sp.implement Phase 1 (T001–T008)
- 🧠 Reflection: the global 005 per-IP middleware already covers admin routes; the gap was proof, not behaviour

## Evaluation notes (flywheel)

- Failure modes observed: plan drifted after the design gate (widths, preview files, story order)
- Graders run and results (PASS/FAIL): n/a
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): re-sync plan.md whenever a gate changes scope
