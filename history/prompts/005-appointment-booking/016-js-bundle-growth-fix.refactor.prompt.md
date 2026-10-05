---
id: 016
title: JS bundle growth cause and fix
stage: refactor
date: 2026-10-05
surface: agent
model: claude-opus-5-5
feature: 005-appointment-booking
branch: 005-appointment-booking
user: Shuaibali0786
command: none
labels: ["performance", "bundle-size", "zod", "prefetch", "dynamic-import", "lighthouse"]
links:
  spec: specs/005-appointment-booking/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - frontend/src/lib/booking/schemas.ts
 - frontend/src/lib/booking/form.ts
 - frontend/src/lib/routes.ts
 - frontend/src/components/ui/Button.tsx
 - frontend/src/components/home/QuickActions.tsx
 - frontend/src/components/layout/SiteFooter.tsx
 - frontend/src/components/booking/ConfirmationActions.tsx
 - frontend/src/lib/booking/slip.ts
 - frontend/src/lib/booking/labels.ts
 - frontend/src/lib/booking/whatsapp.ts
 - frontend/tests/unit/routes.test.ts
 - frontend/tests/unit/booking-confirmation-actions.test.tsx
 - frontend/tests/unit/booking-slip.test.ts
 - specs/005-appointment-booking/results.md
tests:
 - vitest 863 passed (68 files)
 - pytest 430 passed, 1 skipped, 3 deselected
 - playwright main 1044 passed, 11 skipped; no screenshot baselines changed
 - lighthouse mobile before/after for / and /book-appointment (3 runs each)
---

## Prompt

Feature 005, branch 005-appointment-booking. Before the PR, investigate the JS bundle growth: booking page 169 kB → 271 kB, doctors page → 292 kB.

1. Run a production build with a bundle analyzer and find exactly which package or shared import caused the growth (check the PDF library, QR code, the calendar/.ics code, and anything imported into the root layout or shared components).
2. Heavy code that is only needed after a click (PDF download, share, print) must load on demand with dynamic import(), not on page load.
3. Nothing booking-specific may load on pages like /doctors or the home page.
4. Fix it, then re-measure: show a before/after table for the JS size of each page, plus Lighthouse mobile for /book-appointment and Home.
5. Run all tests (unit, pytest, Playwright main suite). Everything must be green. Do not regenerate any screenshot baselines without showing me which ones changed and why.
6. Also run quickstart.md on a clean checkout (fresh clone in a temp folder) and report whether it worked.
7. Commit and push to the branch. Do NOT create the PR and do NOT merge. STOP and give me a short report.

## Response

Cause (next experimental-analyze + network trace): (1) `import { z } from "zod"` in the booking schemas bundled every zod locale and the JSON Schema converters (zod 131 kB per-module gzip on the booking route); (2) every "Book appointment" <Link> prefetched the static /book-appointment route including its JS, so home/doctors/departments downloaded ~132 kB of booking chunks after load. PDF/QR/.ics code was not the cause (confirmation page only, ~9 kB). Fix: namespace zod import; `linkPrefetch()` turns prefetch off for booking links (Button, footer, home quick actions); PDF/.ics builders load via import() on click, WhatsApp link split into whatsapp.ts. Results: home 280.6 → 162.1 kB, /doctors 287.7 → 169.2, booking 267.5 → 218.2; Lighthouse JS home 284.7 → 165.4, booking 271.2 → 221.9 (scores 85/85, TBT-bound, still < 90).
