---
id: 040
title: Voice receptionist task list
stage: tasks
date: 2026-11-08
surface: agent
model: claude-opus-5-5
feature: 013-voice-receptionist
branch: 013-voice-receptionist
user: Shuaibali0786
command: /sp.tasks
labels: ["voice-agent","tasks","gates","tests"]
links:
  spec: specs/013-voice-receptionist/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - specs/013-voice-receptionist/tasks.md
tests:
 - none run (tasks stage); test tasks defined
---

## Prompt

/sp.tasks (no extra arguments; owner brief from PHR 038: STOP after tasks with a short summary).

## Response snapshot

The task list has 74 tasks in 10 phases:

| Phase | Tasks | Count |
|---|---|---|
| Setup | T001–T004 | 4 |
| Foundational | T005–T019 | 15 |
| US1 voice Q&A (MVP) | T020–T037 | 12 |
| US5 safety | T040–T043 | 4 |
| US2 voice booking | T044–T055 | 12 |
| US3 lookup | T060–T073 | 14 |
| US4 cancel | T075–T078 | 4 |
| US6 owner voice | T080 | 1 |
| Slip email | T085–T086 | 2 |
| Polish | T090–T095 | 6 |

Gates:
- G1: design pick before the panel UI.
- G2: STOP before migration 0006, for a Neon restore point and approval.
- G3: approval before pushing the migration commit, which runs it on preview.

MVP = US1 + US5 (no DB change); US2 also needs no DB change.

## Outcome

- ✅ Impact: an executable, dependency-ordered task list; the work stops here as the owner asked
- 🧪 Tests: 45 red-team, 30 Q&A, 10 booking scripts, 5 lookup scripts, a11y, visual and perf tasks defined
- 📁 Files: tasks.md
- 🔁 Next prompts: owner picks design A/B; approves the API change and migration 0006; optional /sp.adr patient-access-codes-and-voice-provider-slot; then /sp.implement
- 🧠 Reflection: voice Q&A and booking need no DB change, so they can ship before the migration gate

## Evaluation notes (flywheel)

- Failure modes observed: none
- Graders run and results (PASS/FAIL): format check PASS (checkbox, ID, story label, file path)
- Prompt variant (if applicable): null
- Next experiment (smallest change to try): null
