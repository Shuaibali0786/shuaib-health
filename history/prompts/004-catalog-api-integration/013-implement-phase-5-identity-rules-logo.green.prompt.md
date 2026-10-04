---
id: 013
title: Implement Phase 5 identity rules logo
stage: green
date: 2026-10-04
surface: agent
model: claude-sonnet-5-5
feature: 004-catalog-api-integration
branch: 004-catalog-api-integration
user: Shuaibali0786
command: /sp.implement
labels: ["us3","identity","neutral-identity","clinic-rules","logo","honesty-constants","visual-baseline"]
links:
  spec: specs/004-catalog-api-integration/spec.md
  ticket: null
  adr: history/adr/0004-catalog-caching-and-resilience-strategy.md
  pr: null
files:
 - frontend/src/lib/honesty.ts (DEMO_NOTICE, CREDIT constants)
 - frontend/src/lib/content.ts (neutral identity, getSiteConfig precedence, getClinicRules)
 - frontend/src/lib/seo.ts, pages.ts, og.tsx (take site as parameter, organizationJsonLd with logo)
 - frontend/src/app/ (layout, page, robots, opengraph-image, every generateMetadata, contact, book-appointment, about)
 - frontend/src/components/ (BeforeYourVisit, JsonLd, MapEmbed props, header, footer, notice bar, emergency card, hero, facts band, why-choose-us)
 - frontend/src/data/homeContent.ts (hours from clinic data), src/data/siteConfig.ts (deleted)
 - frontend/scripts/build-logo-svg.mjs, public/images/brand/logo-mark.svg
 - frontend/tests/ (site-config, logo-mark, before-your-visit, no-hardcoded-catalog, rules e2e, stateful rules-modes, offline neutral identity, 4 regenerated snapshots)
 - specs/004-catalog-api-integration/tasks.md
tests:
 - npm run typecheck (pass)
 - npm run lint (pass)
 - npm test (619 passed, was 586)
 - npm run test:e2e (1023 passed; baseline changed only for /contact and /book-appointment)
 - npm run test:e2e:stateful (11/11)
 - npm run test:e2e:offline (252 passed, test.fixme now a passing test)
---

## Prompt

Feature 004 (specs/004-catalog-api-integration). Phases 1-4 are done. First confirm the Phase 4 commit is pushed to GitHub. Then do ONLY Phase 5 (US3 identity, rules, logo, T058-T069), including the neutral identity so the test.fixme case passes. Run all checks one at a time; if any step hangs over 15 minutes or fails on network/Google Fonts, STOP and tell me. Commit, push, then STOP with a short summary.

## Response

Confirmed 65df04d was on origin. Implemented T058-T069 and T084: clinic identity, hours and map from data with API, then fallback JSON, then neutral identity; demo notice and credit from constants; rules section; logo SVG with generator; FR-002 guard. All checks green.
