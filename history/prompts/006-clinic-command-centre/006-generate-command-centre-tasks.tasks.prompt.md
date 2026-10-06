---
id: 006
title: Generate Command Centre Tasks
stage: tasks
date: 2026-10-06
surface: agent
model: claude-opus-5-5
feature: 006-clinic-command-centre
branch: 006-clinic-command-centre
user: Shuaibali0786
command: /sp.tasks
labels: ["tasks", "command-centre", "auth", "demo", "live-updates", "visual-tests"]
links:
  spec: specs/006-clinic-command-centre/spec.md
  ticket: null
  adr: history/adr/0007-staff-auth-opaque-sessions-and-policy-table.md, history/adr/0008-command-centre-isolation-and-bff.md, history/adr/0009-demo-mode-deterministic-data-source.md, history/adr/0010-booking-status-lifecycle-and-concurrency.md
  pr: null
files:
 - specs/006-clinic-command-centre/tasks.md
tests:
 - none run (task generation only); format check: 157 tasks, all "- [ ] Tnnn" with sequential IDs and story labels in story phases
---

## Prompt

/sp.tasks (no extra arguments), run as the last step of: "Design APPROVED with font A (Cormorant Garamond headings). Before building, apply these and update the preview: … Then commit + push, run /sp.tasks, and STOP with a short summary."

## Response snapshot

Generated specs/006-clinic-command-centre/tasks.md: 157 tasks in 11 phases. Setup: 8 tasks (T001–T008). Foundational: 41 (T009–T049): migration, auth core, policy table + introspection, website route-group move and isolation proofs, admin shell, clinic clock and live-poll primitives. Then US2: 18 (T050–T067), US1: 17 (T068–T084), US4: 21 (T085–T105), US3: 18 (T106–T123, incl. live clock, greeting, 30 s polling, recentBookings toasts, count-up, chip tooltip), US5: 10 (T124–T133, incl. theme switch, clipping helper, visual baselines at 390/1280/1366/1440 with a paused clock), US6: 6, US7: 4, US8: 4, and Polish: 10 (T148–T157). 85 tasks are [P]. US4 is ordered before US3 because the Overview chips open the booking drawer and Mark arrived uses the status actions. Tests are written first in every story, per the spec and constitution IX.

## Outcome

- ✅ Impact: implementation-ready task list covering FR-001…FR-045, SC-001…SC-010 and every row of the auth matrix.
- 🧪 Tests: none run; test tasks are included per story.
- 📁 Files: specs/006-clinic-command-centre/tasks.md
- 🔁 Next prompts: /sp.analyze, then /sp.implement starting at Phase 1.
- 🧠 Reflection: putting the shared live primitives (clinicClock, livePoll) in Foundational lets the Overview and Bookings stories reuse them without depending on each other.

## Evaluation notes (flywheel)

- Failure modes observed: none.
- Graders run and results (PASS/FAIL): format check PASS (157/157 tasks match the checklist pattern; IDs sequential).
- Prompt variant (if applicable): null
- Next experiment (smallest change to try): run /sp.analyze to cross-check FR/SC coverage against tasks.
