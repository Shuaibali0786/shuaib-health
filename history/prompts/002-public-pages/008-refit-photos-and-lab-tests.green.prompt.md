---
id: 008
title: Refit Doctor Photos and Implement Lab Tests
stage: green
date: 2026-10-02
surface: agent
model: claude-sonnet-5-5
feature: 002-public-pages
branch: 002-public-pages
user: Shuaibali0786
command: /sp.implement (continuation)
labels: ["images", "lab-tests", "us3"]
links:
  spec: specs/002-public-pages/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - frontend/public/images/doctors/dr-bilal-ansari.jpg, dr-omar-sheikh.jpg, dr-sana-farooqui.jpg
 - frontend/src/data/doctors.ts (alt text)
 - specs/001-brand-home-page/image-manifest.md, specs/002-public-pages/quickstart.md
 - frontend/src/app/lab-tests/page.tsx, [slug]/page.tsx, [slug]/opengraph-image.tsx
 - frontend/src/components/lab-tests/LabTestBrowser.tsx, LabTestFacts.tsx
 - frontend/src/lib/routes.ts
 - frontend/tests/unit/lab-test-browser.test.tsx, routes.test.ts
 - frontend/tests/e2e/lab-tests.spec.ts, a11y.spec.ts
tests:
 - lint, typecheck, unit (362), build, playwright full suite (319 passed, 5 skipped), axe on four lab pages
---

## Prompt

Feature 002 (specs/002-...): Phases 1-4 are done and committed. assets/photos now has all 24 photos with correct names. New/changed: dr-bilal-ansari.jpg, dr-omar-sheikh.jpg, sana.jpg (white coat, light background). Update any references to the old "(1)…(7)" names, re-fit dr-bilal-ansari, dr-omar-sheikh and dr-sana-farooqui (faces not cut, consistent framing, trim any black borders), update their alt text, run the check and tests, and commit. Then continue with Phase 5 (Lab Tests) from tasks.md and stop at the checkpoint.

## Response snapshot

Photos: no text references to "(1)…(7)" existed. Trimmed black borders from Bilal's source (only 606x402 after trimming, so it is enlarged; the tool warned), fitted all three at 4:5 with faces whole, rewrote alt text and the image manifest, `images check` = 24 real, 0 problems. Committed eb0eb22.
Phase 5 (T050-T056): LabTestBrowser (search incl. also-known-as, category chips with counts and icons, URL-backed filters, empty state, no-JS fallback), LabTestFacts, /lab-tests, /lab-tests/[slug] with OG image, registry updated. The "Included in packages" block is left for T058. A stale `next start` on port 3100 served the old build and caused false e2e failures until stopped.

## Outcome

Phase 5 checkpoint reached; not yet committed at the time of writing.
