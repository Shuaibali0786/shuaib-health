---
id: 001
title: Specialty presets overnight build
stage: green
date: 2026-11-07
surface: agent
model: claude-opus-5-5
feature: 009-specialty-presets
branch: 009-specialty-presets
user: Shuaibali0786
command: unattended overnight run (Phase C, feature b)
labels: ["demo","presets","white-label","overnight"]
links:
  spec: specs/009-specialty-presets/spec.md
  ticket: null
  adr: history/adr/0012-specialty-presets-as-static-demo-showcase.md
  pr: null
files:
 - specs/009-specialty-presets/*
 - history/adr/0012-specialty-presets-as-static-demo-showcase.md
 - frontend/src/presets/specialties.ts
 - frontend/src/components/presets/PresetSwitcher.tsx
 - frontend/src/components/presets/PresetShowcase.tsx
 - frontend/src/app/(site)/demo/specialties/page.tsx
 - frontend/src/app/(site)/demo/specialties/[preset]/page.tsx
 - frontend/src/app/tokens.css
 - frontend/src/app/(site)/site.css
 - frontend/src/lib/pages.ts
 - frontend/tests/unit/specialty-presets.test.tsx
 - frontend/tests/e2e/specialties.spec.ts
 - frontend/tests/e2e/helpers.ts
tests:
 - Vitest full 1451 passed
 - Playwright specialties/pages/links/seo/honesty/images 330 passed
---

## Prompt

Feature (b): "'Choose your specialty' demo presets: Dental, Skin & Aesthetic, Diagnostic Lab, Multi-speciality. A visitor switches presets on the demo and the name, colours, departments, doctors and images change. Demo only, behind the existing demo flag." Build fully, tests, commit, push, DRAFT PR. (Full overnight prompt in history/prompts/general/024-overnight-phase-c-run.general.prompt.md.)

## Response snapshot

Static, demo-gated showcase at /demo/specialties/[preset] rendering one shared component from four preset data records; theme via data-preset + token CSS variables; monogram avatars; booking/slip/dashboard previews linking to the real flows; noindex, out of sitemap; ADR-0012.

## Outcome

- ✅ Impact: four specialty demos, zero change to existing pages
- 🧪 Tests: Vitest 1451 pass, e2e 330 pass
- 📁 Files: see list
- 🔁 Next prompts: decide where to link the showcase; Lighthouse run
- 🧠 Reflection: project guard tests (brand words, catalog names) caught real issues early

## Evaluation notes (flywheel)

- Failure modes observed: trade-mark word, duplicated catalog name
- Graders run and results (PASS/FAIL): typecheck PASS, lint PASS, vitest PASS, e2e PASS
- Prompt variant (if applicable): none
- Next experiment (smallest change to try): none
