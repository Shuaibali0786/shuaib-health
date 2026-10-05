---
id: 004
title: Generate tasks appointment booking
stage: tasks
date: 2026-10-04
surface: agent
model: claude-opus-5-5
feature: 005-appointment-booking
branch: 005-appointment-booking
user: Shuaibali0786
command: /sp.tasks
labels: ["tasks", "booking", "phased", "checkpoints", "tdd"]
links:
  spec: specs/005-appointment-booking/spec.md
  ticket: null
  adr: history/adr/0005-booking-integrity-db-enforcement.md, history/adr/0006-proxy-trust-and-postgres-rate-limiting.md
  pr: null
files:
 - specs/005-appointment-booking/tasks.md
 - specs/005-appointment-booking/research.md
 - specs/005-appointment-booking/data-model.md
 - specs/005-appointment-booking/plan.md
 - history/adr/0005-booking-integrity-db-enforcement.md
tests:
 - none (task generation); 104 tasks, test tasks written before the code they cover
---

## Prompt

3) Then run /sp.tasks.
Stop after tasks and show the phase table.

(Part of the same message that asked for ADR-0005/0006 and the plan additions: demo purge after 7 days, the form notice "Demo site: please don't enter real medical details", and failing fast when the proxy secret is missing.)

## Response snapshot

Generated tasks.md with 104 tasks in 10 phases. Each phase ends with a checkpoint where the work stops and is reported to the user.

| Phase | Content |
|---|---|
| 1 | Setup, baseline and contract |
| 2 | Foundational: settings with fail-fast, migration 0002 with the exclusion constraint, helpers, trusted client IP, seed break/leave/holiday, website proxy module, `instrumentation.ts`, mock API |
| 3 | US4: slots |
| 4 | US1: booking flow (MVP) |
| 5 | US2: race |
| 6 | US3: idempotency |
| 7 | US6: abuse protection |
| 8 | US7: privacy and the 7-day demo purge |
| 9 | US5: Book from doctor pages |
| 10 | Resilience, polish and proof |

Tasks per story: US1 27, US2 6, US3 5, US4 10, US5 7, US6 4, US7 8. 45 tasks are marked [P].

Fixed the plan's `timezone=UTC` connection setting, which is not reliable under PgBouncer transaction mode. The code now uses aware datetimes and normalizes to UTC on read, with a test that sets the session to `Asia/Tokyo`. ADR-0005, research and data-model were updated to match.

## Outcome

- ✅ Impact: tasks.md ready for /sp.implement, phase by phase
- 🧪 Tests: concurrency (20 threads, plus a 100-run perf job), idempotency, limits, retention, log safety, fail-fast, e2e in all 3 Playwright configs
- 📁 Files: tasks.md; plan, research, data-model and ADR-0005 corrected
- 🔁 Next prompts: /sp.analyze (optional), then /sp.implement starting with Phase 1
- 🧠 Reflection: three files are touched by several stories (`service.py`, `BookingFlow.tsx`, the contract test), so tasks.md lists them as places where parallel work must not happen

## Evaluation notes (flywheel)

- Failure modes observed: a wrong cross-reference (T041/T061 instead of T038/T058) was caught by self-review and fixed
- Graders run and results (PASS/FAIL): format check PASS (104/104 match `- [ ] T###`, sequential IDs, story labels only in story phases)
- Prompt variant (if applicable): none
- Next experiment (smallest change to try): generate the cross-references after the IDs are assigned
