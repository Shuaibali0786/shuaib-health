---
id: 036
title: Approved push, photo replacement, Pexels credits
stage: general
date: 2026-11-08
surface: agent
model: claude-opus-5-5
feature: none
branch: chore/overnight-2026-11-07
user: Shuaibali0786
command: owner approval of overnight items A1-A4 (pasted)
labels: ["licences","photos","credits","visual-baselines","ci"]
links:
  spec: null
  ticket: null
  adr: null
  pr: https://github.com/Shuaibali0786/shuaib-health/pull/37
files:
 - CREDITS.md
 - frontend/public/images/doctors/dr-bilal-ansari.jpg
 - frontend/public/images/departments/general-medicine.jpg
 - backend/app/seed/data/catalog.json
 - frontend/tests/fixtures/api/doctors.json
 - frontend/tests/fixtures/catalog/doctors.ts
 - frontend/tests/fixtures/admin/demo-day.json
 - frontend/tests/e2e/responsive.spec.ts
 - frontend/tests/e2e/visual-baseline.spec.ts-snapshots/ (14 Linux baselines removed for regeneration)
 - specs/002-public-pages/quickstart.md
 - docs/reports/overnight-2026-11-07.md
tests:
 - vitest images + honesty (66 passed)
 - local e2e visual-baseline/responsive/seo/a11y/no-localhost desktop+mobile: 565 passed, 14 failed (expected photo baselines)
 - CI run 1: responsive selector failure (fixed); CI run 2: backend demo fixture etag (fixed) + 14 visual baselines (expected)
---

## Prompt

Approved. Do these in order:
1. Push chore/overnight-2026-11-07 and open the PR (preview build on the preview database is OK, nothing new to migrate).
2. Replace dr-bilal-ansari.jpg and general-medicine.jpg with free-licence photos from Pexels or Unsplash only (same size and style). Record photographer, page URL and licence in CREDITS.md.
3. For the other 22 photos: find each one's Pexels page and add the link to CREDITS.md. If you cannot find a photo's source in a few tries, replace it with a new Pexels/Unsplash photo and record it.
4. Run the browser tests for changed pages locally (close other heavy apps if memory is low), then let CI run.
5. If ALL checks are green: merge, check the live public pages show the new photos, smoke test /health. If anything fails: do not merge, STOP and report.
No production database changes. Report short and STOP.

## Response snapshot

PR #37 opened. Two photos replaced (Tran Nhu Tuan 15962798, RDNE Stock project 6129441). All 22 others traced to exact Pexels pages by matching pixel size plus a greyscale image comparison, and linked in CREDITS.md. CI not green: the 14 visual baselines for the 7 pages that show the new photos must be regenerated (Linux workflow dispatched; Windows update stopped by low memory). Not merged; stopped and reported.

## Outcome

- ✅ Impact: licence evidence for every photo; two unproven photos replaced
- 🧪 Tests: see list; visual baselines pending owner review of the pixel diff
- 📁 Files: see list
- 🔁 Next prompts: regenerate Windows baselines, commit Linux artifact, pixel-diff report, re-run CI, then merge
- 🧠 Reflection: the live alt text for Dr. Bilal comes from the database, so it stays old until an approved re-seed

## Evaluation notes (flywheel)

- Failure modes observed: background jobs killed for low memory (8 GB laptop); hidden coupling of seed catalog to the demo fixture etag
- Graders run and results (PASS/FAIL): vitest PASS; e2e FAIL (expected baselines only)
- Prompt variant (if applicable): none
- Next experiment (smallest change to try): run baseline updates on CI only (both platforms) to avoid local memory limits
