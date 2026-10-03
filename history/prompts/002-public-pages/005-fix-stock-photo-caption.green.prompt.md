---
id: 005
title: Fix Stock Photo Caption
stage: green
date: 2026-10-02
surface: agent
model: claude-sonnet-5-5
feature: 002-public-pages
branch: 002-public-pages
user: Shuaibali0786
command: general request
labels: ["honesty", "caption", "doctor-profile"]
links:
  spec: specs/002-public-pages/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - frontend/src/components/ui/IllustrativeNote.tsx
 - frontend/tests/e2e/doctors.spec.ts
 - frontend/tests/unit/illustrative-note.test.tsx
tests:
 - npm run lint, typecheck, npm test (23 files, 353 tests); playwright doctors and honesty specs (151 passed)
---

## Prompt

Fix the photo caption on doctor profiles: these are real people (stock models from Pexels), so "not a real person" is untrue. Change it to: "Stock photo of a model. Sample profile — name and details are fictional." Check every place this caption appears, run tests, and commit.

## Response snapshot

The caption existed in one component (IllustrativeNote, person variant, used only on doctor profiles) and one e2e assertion. Changed both, added a unit test that also guards against the old wording, searched src, tests, specs and history for leftovers (none).
