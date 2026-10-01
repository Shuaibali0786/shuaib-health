---
id: 009
title: Phone Layout Swipe Rows
stage: green
date: 2026-10-01
surface: agent
model: claude-sonnet-5-5
feature: 001-brand-home-page
branch: 001-brand-home-page
user: Shuaibali0786
command: follow-up (no slash command)
labels: ["mobile", "swipe-row", "snap-scroll", "accessibility", "keyboard", "compact-cards"]
links:
  spec: specs/001-brand-home-page/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - frontend/src/components/ui/swipe-row.ts
 - frontend/src/components/ui/SwipeList.tsx
 - frontend/src/components/home/DepartmentGrid.tsx
 - frontend/src/components/home/DepartmentCard.tsx
 - frontend/src/components/home/QuickActions.tsx
 - frontend/src/components/home/FeaturedDoctors.tsx
 - frontend/src/components/home/HealthTips.tsx
 - frontend/src/components/home/DoctorCard.tsx
 - frontend/src/components/home/TipCard.tsx
 - frontend/tests/unit/home-sections.test.tsx
 - frontend/tests/unit/swipe-list.test.tsx
 - specs/001-brand-home-page/design-system.md
 - specs/001-brand-home-page/tasks.md
tests:
 - npm run lint (pass)
 - npm run typecheck (pass)
 - npm run test (11 files, 197 tests pass)
 - npm run build (pass)
 - headless Chrome at 320, 390, 768, 1280 px (columns, peek, snap, keyboard focus, overflow, axe)
---

## Prompt

Yes, make it shorter on phones: departments and quick actions in 2 columns (compact cards), doctors and health tips as a horizontal swipe row (snap scrolling, next card peeking). Keep desktop as is. Keep accessibility (keyboard + focus rings). Then run lint, typecheck, tests, build and commit.

## Response snapshot

Below 640 px: departments and quick actions are compact 2-column cards; doctors and health tips are snap-scrolling swipe rows with 78%-wide cards so the next card peeks (79 px at 390 px). Everything from sm up is unchanged (desktop page height identical at 6,024 px). Page height on a 390 px phone dropped from 13,100 px to 8,138 px. The browser check found a real keyboard bug (Tab only revealed the small link inside an off-screen card), fixed with a tiny SwipeList client component that scrolls the whole focused card into view only when the row is scrollable. Padding keeps focus rings and shadows from being clipped. 197 tests pass; axe reports 0 violations at all widths.

## Outcome

- ✅ Impact: Home page is 38% shorter on phones with desktop and tablet untouched.
- 🧪 Tests: lint, typecheck, 197 unit tests, build pass; browser checks clean.
- 📁 Files: see list.
- 🔁 Next prompts: Phase 5 link verification, Phase 6 audits, remaining tests.
- 🧠 Reflection: only a real keyboard run revealed that the browser scrolls to the focused link, not the card.

## Evaluation notes (flywheel)

- Failure modes observed: a scripted multi-edit aborted at its first mismatch without applying anything (nothing was left half-edited).
- Graders run and results (PASS/FAIL): lint, typecheck, vitest 197/197, build, axe all PASS.
- Prompt variant (if applicable): none
- Next experiment (smallest change to try): none
