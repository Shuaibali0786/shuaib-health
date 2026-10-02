---
id: 008
title: Implement Home Sections and Rename Images
stage: green
date: 2026-10-01
surface: agent
model: claude-sonnet-5-5
feature: 001-brand-home-page
branch: 001-brand-home-page
user: Shuaibali0786
command: /sp.implement
labels: ["implement", "home-sections", "images", "rename", "accessibility", "unit-tests"]
links:
  spec: specs/001-brand-home-page/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - frontend/public/images (17 files renamed, no -placeholder suffix)
 - frontend/src/components/home (QuickActions, DepartmentCard, DepartmentGrid, FactsBand, EmergencyCard, WhyChooseUs, DoctorCard, FeaturedDoctors, TipCard, HealthTips, CtaBand)
 - frontend/src/app/page.tsx
 - frontend/src/components/ui (Section spacing prop, Card focus style)
 - frontend/src/data (homeContent clinicImage; image paths in departments, doctors, healthTips)
 - frontend/scripts (image-list, images)
 - frontend/tests/unit (images, format, routes, home-sections, why-choose-us, hero)
 - specs/001-brand-home-page (tasks, image-manifest, plan, content-shapes)
tests:
 - npm run lint (pass)
 - npm run typecheck (pass)
 - npm run test (10 files, 188 tests pass)
 - npm run build (pass)
 - headless Chrome at 320/390/768/1280 px: order, counts, images, links, overflow, axe (0 violations)
---

## Prompt

Implement only Phase 4 (the other seven Home sections) from specs/001-brand-home-page/tasks.md, using the real images now in place. Also rename the image files to drop the "-placeholder" suffix and update references. Mark each task [X]. At the end run lint, typecheck, tests and build, fix errors, commit, and STOP at the checkpoint. Tell me what to check on mobile and desktop.

## Response snapshot

Renamed the 17 images with git mv and updated every reference (data, scripts, tests, specs). Implemented T052–T062: quick actions, departments, facts band, why choose us with the emergency card, featured doctors, health tips and the CTA band, composed in spec order with alternating backgrounds and progressive scroll reveals. Verified in headless Chrome at four widths (all counts correct, 16 images with none broken, 26 internal links returning 200, no overflow, 0 axe violations). Pulled forward tests T075, T076, T079, T084 (plus a why-choose-us test): 188 tests pass. A mutation check confirmed the new image guard fails when a referenced photo is missing. Stopped at the checkpoint.

## Outcome

- ✅ Impact: The Home page is complete (all eight sections) with real photos.
- 🧪 Tests: 188 unit tests, lint, typecheck, build all pass; browser checks clean.
- 📁 Files: see list.
- 🔁 Next prompts: review Checkpoint 4; then Phase 6 audits (Phase 5 is only link verification) and the remaining tests.
- 🧠 Reflection: async server components cannot be nested in a jsdom render, so one child is stubbed in a dedicated test file.

## Evaluation notes (flywheel)

- Failure modes observed: jsdom cannot render a server component that has an async server child.
- Graders run and results (PASS/FAIL): lint, typecheck, vitest 188/188, build, axe all PASS.
- Prompt variant (if applicable): none
- Next experiment (smallest change to try): none
