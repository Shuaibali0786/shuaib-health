---
id: 006
title: Sample Label and Image Tooling
stage: green
date: 2026-10-01
surface: agent
model: claude-sonnet-5-5
feature: 001-brand-home-page
branch: 001-brand-home-page
user: Shuaibali0786
command: follow-up (no slash command)
labels: ["follow-up", "honesty", "images", "tooling", "hero-spacing"]
links:
  spec: specs/001-brand-home-page/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - frontend/src/components/layout/SiteHeader.tsx
 - frontend/src/components/layout/MobileMenu.tsx
 - frontend/tests/unit/header.test.tsx
 - frontend/scripts/image-list.mjs
 - frontend/scripts/images.mjs
 - frontend/scripts/generate-placeholder-images.mjs
 - frontend/package.json
 - frontend/public/images (17 placeholders regenerated with a marker)
 - specs/001-brand-home-page/image-manifest.md
 - specs/001-brand-home-page/quickstart.md
 - specs/001-brand-home-page/tasks.md
tests:
 - npm run lint (pass)
 - npm run typecheck (pass)
 - npm run test (70 pass)
 - npm run build (pass)
 - images check and fit exercised with a synthetic landscape photo, then placeholders restored
 - hero spacing measured at 390, 768, 1024, 1280, 1440 px with a non-placeholder image
---

## Prompt

Phase 3 looks great (screenshot attached). Small notes: 1) add "(sample)" next to the emergency number, 2) check hero top spacing after the real image. Now guide me to add the real images one by one (hero doctor first) before Phase 4.

## Response snapshot

Added "(sample)" to the emergency number label in the header and mobile menu (placed on the label line because the 1280 px header has no spare width). Built `npm run images -- check` and `npm run images -- fit` so real photos can be dropped in one at a time and cropped to the exact manifest size; placeholders now carry an EXIF marker. Measured hero spacing with a real-style image at five widths (no layout shift, 80 px above and below the photo on desktop, no overflow). Documented the workflow in image-manifest.md and quickstart.md. The screenshot did not arrive (text only). No real photo exists yet, so the hero spacing needs a final look once the real hero image is placed.

## Outcome

- ✅ Impact: Emergency number is labelled sample; adding real photos is a two-command workflow.
- 🧪 Tests: lint, typecheck, 70 unit tests, build pass; tooling verified end to end.
- 📁 Files: see list.
- 🔁 Next prompts: user adds the hero photo; then check spacing; then Phase 4.
- 🧠 Reflection: the shell mangled backslashes in a heredoc again; use the Edit tool for Windows paths in docs.

## Evaluation notes (flywheel)

- Failure modes observed: attachment not delivered; backslash escaping in a node -e string.
- Graders run and results (PASS/FAIL): all PASS.
- Prompt variant (if applicable): none
- Next experiment (smallest change to try): none
