---
id: 011
title: Implement Phase 3 live catalog
stage: green
date: 2026-10-03
surface: agent
model: claude-sonnet-5-5
feature: 004-catalog-api-integration
branch: 004-catalog-api-integration
user: Shuaibali0786
command: /sp.implement
labels: ["us1","catalog-api","isr","pages","manifest","stateful-e2e"]
links:
  spec: specs/004-catalog-api-integration/spec.md
  ticket: null
  adr: history/adr/0004-catalog-caching-and-resilience-strategy.md
  pr: null
files:
 - frontend/src/lib/content.ts (catalog accessors read the cached API loaders; load* and get* variants)
 - frontend/src/lib/pages.ts (manifest takes a catalog argument; doctor/department/lab-test entry builders)
 - frontend/src/lib/packages.ts (skipMissing option)
 - frontend/src/app/ (doctors, departments, lab-tests, health-packages, home, sitemap; OG images)
 - frontend/src/components/ (DepartmentSections, DepartmentGrid, FeaturedDoctors, FactsBand, PackageCard, icons.toIconName)
 - frontend/src/data/homeContent.ts (buildFacts), frontend/src/types/content.ts (ScheduleSession.day widened)
 - frontend/src/data/{departments,doctors,labTests,healthPackages}.ts (shims deleted)
 - frontend/tests/unit/ (content-api.test.ts, helpers/catalog-api-mock.ts, imports moved to fixtures)
 - frontend/tests/e2e/ (imports moved to fixtures, departmentIdBySlug, stateful new-record and rename specs)
 - frontend/tests/fixtures/catalog/index.ts
 - specs/004-catalog-api-integration/tasks.md, results.md
tests:
 - npm run typecheck (pass)
 - npm run lint (pass)
 - npm test (583 passed, was 568)
 - npm run test:e2e (1011 passed, 11 skipped; visual baseline 62/62, zero diffs)
 - npm run test:e2e:stateful (3/3: cache-guard green, new-record, rename)
---

## Prompt

Feature 004 (specs/004-catalog-api-integration). Phases 1-2 are done. Do ONLY Phase 3 (US1 live catalog, T030-T047): switch pages to the API and remove hard-coded data. Visual baseline must have zero diffs and cache-guard must turn green. Run all tests, commit, push, then STOP with a short summary.

## Response snapshot

Completed T030-T047 and T083. Unit and e2e imports moved to the fixtures; new content-api unit tests and stateful new-record and rename specs. content.ts now reads departments, doctors, lab tests, categories and packages through the cached API loaders; every catalog page uses load* with DataUnavailable per section, revalidate 300, dynamicParams true. The page manifest takes the catalog as an argument, the sitemap is async, the four data shims are deleted. Visual baseline had zero diffs and cache-guard is green.

## Outcome

- Impact: the website serves the live catalog; records added or renamed after the build appear within the data window; no hard-coded catalog data remains in src.
- Tests: all suites green; first main e2e run failed 4 doctors.spec cases on hard-coded dept ids, fixed with an id lookup by slug.
- Files: see list above.
- Next prompts: Phase 4 (US2 resilience): resilience, partial-cold and offline specs, phone on DataUnavailable, safe metadata.
- Reflection: a few task texts conflicted (facts band needs the live department count, manifest is sync but its data is async); both resolved with a minimal parameter-passing change and noted in results.md.

## Evaluation notes (flywheel)

- Failure modes observed: sed over all e2e files rewrote line endings; the first rename spec compared all page text and tripped on the unchanged bio.
- Graders run and results (PASS/FAIL): PASS
- Prompt variant (if applicable): null
- Next experiment (smallest change to try): none
