---
id: 013
title: Home Page Review Fixes
stage: green
date: 2026-10-03
surface: agent
model: claude-sonnet-5-5
feature: 002-public-pages
branch: 002-public-pages
user: Shuaibali0786
command: direct request
labels: ["home", "hero", "departments", "images"]
links:
  spec: specs/002-public-pages/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - frontend/src/components/home/Hero.tsx, FeaturedDoctors.tsx, DepartmentGrid.tsx, department-grid.ts
 - frontend/src/app/departments/page.tsx
 - frontend/tests/unit/home-sections.test.tsx, tests/e2e/home.spec.ts, tests/e2e/responsive.spec.ts
tests:
 - lint, typecheck, unit (451), build, playwright full suite (435 passed, 11 skipped)
---

## Prompt

Home page review fixes: (1) Featured doctors still shows the OLD Sana photo; make sure every place uses the new dr-sana-farooqui image and clear any stale image cache. (2) Departments grid: last row (3 cards) is left-aligned, centre it. (3) Hero: reduce the empty space above the headline, vertically balanced with the image. (4) Add a "View all doctors" link/button to Featured doctors, same style as "View all tips". Run lint, typecheck, tests and build, commit. Then continue with Phase 10 (Privacy and Terms) and stop at the checkpoint.

## Response snapshot

1. The data and the file on disk were already the new Sana photo (single reference in data/doctors.ts); the old picture came from Next's optimised-image cache (.next/cache/images) and the browser cache. Cleared the server cache and rebuilt; screenshot of the built Home shows the new photo. 2. Departments are a two-column grid up to tablets and a centred wrapping row from lg (shared classes, used on Home and /departments); verified 4 + 3 on xl. 3. Hero text is top-aligned with a 4 rem offset and the section padding trimmed: the headline now starts 120 px below the section top instead of 245 px. 4. View all doctors button added.
