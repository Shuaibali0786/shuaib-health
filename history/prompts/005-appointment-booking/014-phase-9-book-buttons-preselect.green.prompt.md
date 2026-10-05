---
id: 014
title: Phase 9 book buttons pre-select
stage: green
date: 2026-10-05
surface: agent
model: claude-sonnet-5-5
feature: 005-appointment-booking
branch: 005-appointment-booking
user: Shuaibali0786
command: /sp.implement
labels: ["booking", "us5", "flaky-test", "visual-baselines", "focus"]
links:
  spec: specs/005-appointment-booking/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - frontend/src/lib/routes.ts
 - frontend/src/app/doctors/[slug]/page.tsx
 - frontend/src/components/departments/DepartmentSections.tsx
 - frontend/src/components/booking/BookingFlow.tsx
 - frontend/tests/e2e/booking-entry.spec.ts
 - frontend/tests/e2e/doctors.spec.ts
 - frontend/tests/e2e/departments.spec.ts
 - frontend/tests/unit/routes.test.ts
 - specs/005-appointment-booking/tasks.md
 - specs/005-appointment-booking/results.md
tests:
 - npm test 861 passed; e2e 1044 passed, 11 skipped; stateful 15 passed
---

## Prompt

/sp.implement Feature 005 (specs/005-appointment-booking). First, before Phase 9:
1) Explain why the main e2e count went from 1032 to 997; make sure no tests were deleted or skipped by mistake, restore any that were.
2) Review ALL 38 regenerated visual baseline screenshots (not just one): confirm each change is only the intended text change; fix anything that looks broken.
3) Make the flaky iPhone confirmation-slip test stable (find the real cause, no blind retries).
Then do ONLY Phase 9 (Book buttons on doctor and department pages pre-select the doctor/department). Run checks one at a time; if a step hangs over 15 minutes, STOP and tell me. Commit, push, then STOP with a short summary.

## Response

- 997 came from an incomplete earlier run; nothing was deleted (1047 listed, 1036 passed + 11 skipped before Phase 9).
- All 38 baselines compared pixel by pixel: only intended text changes and the layout shift they cause.
- Flake cause: the step-change effect stole focus from the first field on WebKit; now skipped when focus is already in a field (0 of 40 failures after, 5 of 30 before).
- Phase 9: `bookingPath`, Book buttons, unknown-doctor note, department on the date step, new `booking-entry` e2e, SC-001 timing annotation.
