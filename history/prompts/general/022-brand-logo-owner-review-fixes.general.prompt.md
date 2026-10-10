---
id: 022
title: Brand logo owner review fixes
stage: general
date: 2026-10-10
surface: agent
model: claude-sonnet-5-5
feature: none
branch: chore/brand-logo
user: Shuaibali0786
command: owner review of PR #7
labels: ["brand", "logo", "wordmark", "watermark", "visual-baseline"]
links:
  spec: null
  ticket: null
  adr: null
  pr: https://github.com/Shuaibali0786/shuaib-health/pull/7
files:
 - frontend/src/components/brand/Logo.tsx, LogoMark.tsx, wordmark-paths.ts
 - frontend/src/components/layout/SiteFooter.tsx
 - frontend/src/components/booking/ConfirmationCard.tsx, frontend/src/lib/booking/slip.ts, frontend/src/lib/brand-marks.ts
 - frontend/tests/unit/logo.test.tsx, booking-slip.test.ts
 - frontend/tests/e2e/visual-baseline.spec.ts-snapshots (62), confirmation-slip-pdf.spec.ts-snapshots (1)
 - docs/brand-logo-pixel-diff.md
tests:
 - tsc, eslint, Vitest 1373, Playwright header checks, public projects, admin projects, full run
---

## Prompt

Owner review of PR #7. Fix 3 things on the same branch before merge: (1) the public wordmark is too thin and small next to the bold nav: use the true Cormorant Garamond 700 outlines and scale it so it reads as strongly as the old header logo; header height unchanged; 320/375/390 px on one row. (2) Spacing: everywhere must read "Shuaib Health" with a space. (3) Slip watermark (web + PDF): roughly halve the opacity and make the gold rings the same faint tone as the body; keep it clear of header, stamp, QR and text. Re-run only what is affected, one at a time; regenerate only changed baselines with a pixel-diff report; refresh the review images (01, 02, 06); push to PR #7; do not merge.

Follow-up from the owner: for the 1280 px header, leave it as is (no other changes). Re-run the header one-row checks, then public and admin specs, then the full run, one at a time; if all green, commit and push; do not merge.

## Response snapshot

- Wordmark outlines regenerated with the font's real space (weight 700 confirmed from the font's OS/2 table). Header logo has three steps: compact below 640 px, full 640 to 1279 px, compact from 1280 px where the row is full (about 175 px left for the logo). Footer logo is full size at every width.
- Measured, not assumed: hiding the phone caption frees only 1 px (the number is as wide as the caption), so that change and its aria-label were reverted. At 1280 px and up the wordmark is therefore not larger; the owner chose to leave it.
- Watermark: 2 % opacity on page and PDF, rings in the body colour (WATERMARK_COLOURS).
- A full run killed for low memory was discarded, not counted; the final runs used 2 workers.

## Outcome

- ✅ Impact: spacing and watermark fixed; wordmark larger on 640 to 1279 px and in the footer; unchanged at 1280 px and up.
- 🧪 Tests: header one-row 2 passed; public 1047 passed; admin 858 passed; full 1905 passed, 0 failed; Vitest 1373 passed; tsc and eslint clean.
- 📁 Files: see the list above.
- 🔁 Next prompts: owner decides whether to free header width at 1280 px and up.
- 🧠 Reflection: a quoted saving ("about 45 px") was unmeasured and wrong; measure before recommending.

## Evaluation notes (flywheel)

- Failure modes observed: an unmeasured width estimate drove a recommendation; two Vitest timeouts under CPU load, both passing alone and at 50 % workers.
- Graders run and results (PASS/FAIL): all PASS on the final code.
- Prompt variant (if applicable): none
- Next experiment (smallest change to try): a header width budget test that fails when the logo exceeds the space left at 1280 px.
