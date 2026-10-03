---
id: 002
title: Fit Photos and Plan Public Pages
stage: plan
date: 2026-10-02
surface: agent
model: claude-sonnet-5-5
feature: 002-public-pages
branch: 002-public-pages
user: Shuaibali0786
command: /sp.plan
labels: ["plan", "images", "public-pages", "research", "contracts"]
links:
  spec: specs/002-public-pages/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - frontend/public/images/doctors/ (5 new fitted photos)
 - frontend/public/images/tips/ (2 new fitted photos)
 - frontend/scripts/image-list.mjs
 - specs/002-public-pages/plan.md
 - specs/002-public-pages/research.md
 - specs/002-public-pages/data-model.md
 - specs/002-public-pages/quickstart.md
 - specs/002-public-pages/contracts/routes.md
 - specs/002-public-pages/contracts/content-shapes.md
tests:
 - npm run images -- check (24 real, 0 problems)
---

## Prompt

I added the 7 new photos to D:\shuaib-health\assets\photos with the exact file names from the spec table (dr-maryam-baloch, dr-bilal-ansari, dr-zainab-memon, dr-omar-sheikh, dr-faisal-chaudhry, hand-hygiene, managing-stress — all .jpg). Fit them into the right folders with our images tool (faces not cut, consistent framing with the existing doctor photos), run the check, and commit. Then continue with /sp.plan for Feature 002.

## Response snapshot

Found the photos under browser-duplicate names "dr-maryam-baloch (1..7).jpg" (matched to the right subjects by file size against the correctly named copies in Downloads), registered the 7 keys in image-list.mjs, fitted with face-focus crops, check = 24 real / 0 problems, committed spec and images. Then produced plan.md, research.md (18 decisions), data-model.md, contracts/routes.md, contracts/content-shapes.md, quickstart.md. Constitution Check passes; no violations. Agent-context script only added a BOM to CLAUDE.md, reverted.

## Outcome

- Ready for /sp.tasks. Note: images.test "no unreferenced file" is red until data records reference the new photos (Phases B and D).
