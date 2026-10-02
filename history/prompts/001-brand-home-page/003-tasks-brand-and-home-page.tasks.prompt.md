---
id: 003
title: Tasks Brand and Home Page
stage: tasks
date: 2026-09-30
surface: agent
model: claude-sonnet-5-5
feature: 001-brand-home-page
branch: 001-brand-home-page
user: Shuaibali0786
command: /sp.tasks
labels: ["tasks", "nextjs", "checkpoints", "windows-cmd", "vitest", "playwright"]
links:
  spec: specs/001-brand-home-page/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - specs/001-brand-home-page/tasks.md
 - history/prompts/001-brand-home-page/003-tasks-brand-and-home-page.tasks.prompt.md
tests:
 - none (task list only; 18 unit and 6 Playwright test tasks defined)
---

## Prompt

Break Feature 001 into small, ordered, testable tasks grouped by user story. Start with setup (Next.js app in frontend/, Tailwind v4 tokens, fonts, lint/typecheck/test scripts), then the MVP: site layout (notice bar, header, mobile menu, footer with credit) + Hero, then the remaining Home sections, then Coming soon + not-found pages, then tests and a final check (build, lint, typecheck, unit, Playwright). Mark tasks that can run in parallel with [P]. Put exact file paths in every task. Add a checkpoint after each phase where I run the site and review it before continuing. Use Windows CMD commands. Only write tasks.md now; do not write app code.

## Response snapshot

Wrote `specs/001-brand-home-page/tasks.md`: 102 tasks (T001–T102) in 8 phases in the requested order, each ending with a review checkpoint. Phases: Setup (T001–T014), Foundational (T015–T037), US1 shell + Hero MVP (T038–T051), US4 remaining Home sections (T052–T062), US2 Coming soon and not-found (T063–T066), US3/US5 honesty and accessibility hardening (T067–T073), Tests (T074–T093), Final check (T094–T102). Includes dependency graph, parallel groups, MVP-first strategy. Format validated: all 102 tasks match the checklist format. No app code written.

## Outcome

- ✅ Impact: Feature 001 is ready for /sp.implement, with checkpoints for user review after every phase.
- 🧪 Tests: none run; tests are grouped in Phase 7 at the user's request (constitution IX does not require test-first).
- 📁 Files: tasks.md and this PHR.
- 🔁 Next prompts: start implementation at T001; optionally /sp.analyze first.
- 🧠 Reflection: initial draft had an empty phase; removed and renumbered with Node because Python is not installed.

## Evaluation notes (flywheel)

- Failure modes observed: python missing on this machine; create-phr.sh missing.
- Graders run and results (PASS/FAIL): task format check PASS (102/102).
- Prompt variant (if applicable): none
- Next experiment (smallest change to try): none
