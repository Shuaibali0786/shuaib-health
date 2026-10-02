---
id: 004
title: Implement MVP Doctors and Booking Page
stage: green
date: 2026-10-02
surface: agent
model: claude-sonnet-5-5
feature: 002-public-pages
branch: 002-public-pages
user: Shuaibali0786
command: /sp.implement
labels: ["implement", "doctors", "filters", "foundation", "mvp"]
links:
  spec: specs/002-public-pages/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - frontend/src/** (types, data, lib, components, doctors and book-appointment routes, sitemap, robots, og)
 - frontend/tests/** (unit and e2e)
 - frontend/public/images/doctors/dr-bilal-ansari.jpg (book cover blurred)
 - specs/002-public-pages/tasks.md (T001-T044 marked)
tests:
 - npm run lint, npm run typecheck, npm test (22 files, 350 tests), npm run build, npm run images -- check (24 real, 0 problems)
 - npx playwright test (259 passed, 5 skipped by design)
---

## Prompt

Implement Phases 1 to 3 (MVP: doctors list, filters, profiles, booking-coming-soon) from specs for Feature 002. For T100: photos are approved — Zainab's lab bench and Faisal's tape measure are fine; for Bilal, if any readable title or brand shows on the book cover, crop or blur it. Mark tasks [X], run lint, typecheck, tests and build, commit, and STOP at the checkpoint. Tell me what to check on mobile and desktop.

## Response snapshot

Blurred the Cyrillic book cover in the Bilal photo and refitted it. Implemented T001-T044: form dependencies, types, nine doctors, lab test catalog, department fields, schedule and filter logic, page manifest, SEO helpers, sitemap, robots, Open Graph cards, shared UI (breadcrumbs, page header, filter controls, empty state), /doctors with URL-backed filters, /doctors/[slug] profiles, /book-appointment. Dropped the planned root loading.tsx after finding it hid page content without JavaScript. Stopped at the MVP checkpoint.

## Outcome

- Phases 1-3 complete and green; Phases 4+ not started.
