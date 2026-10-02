---
id: 007
title: Add Real Photos
stage: green
date: 2026-10-01
surface: agent
model: claude-sonnet-5-5
feature: 001-brand-home-page
branch: 001-brand-home-page
user: Shuaibali0786
command: follow-up (no slash command)
labels: ["images", "pexels", "crop", "alt-text", "gitignore"]
links:
  spec: specs/001-brand-home-page/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - frontend/public/images (17 real photos, fitted)
 - frontend/scripts/images.mjs
 - frontend/src/data/homeContent.ts
 - frontend/src/data/departments.ts
 - frontend/src/data/doctors.ts
 - frontend/src/data/healthTips.ts
 - .gitignore
 - specs/001-brand-home-page/image-manifest.md
 - specs/001-brand-home-page/tasks.md
tests:
 - npm run images -- check (17 REAL, 0 problems)
 - npm run lint (pass)
 - npm run typecheck (pass)
 - npm run test (70 pass)
 - npm run build (pass)
 - hero spacing measured at 390, 768, 1024, 1280, 1440 px with the real hero
---

## Prompt

I copied 17 real photos (jpg, from Pexels) into D:\shuaib-health\assets\photos. Using our images tool from the frontend folder, fit each one, then run the check:
hero.jpg -> hero-doctor, clinic.jpg -> clinic-interior, general.jpg -> general-medicine, cardio.jpg -> cardiology, pediatrics.jpg -> pediatrics, gyne.jpg -> gynecology, derma.jpg -> dermatology, dental.jpg -> dental, lab.jpg -> pathology-lab, hassan.jpg -> dr-hassan-mirza, imran.jpg -> dr-imran-qureshi, sana.jpg -> dr-sana-farooqui, ayesha.jpg -> dr-ayesha-rahman, water.jpg -> staying-hydrated, sleep.jpg -> healthy-sleep-habits, food.jpg -> balanced-plate, walk.jpg -> daily-walk.
Choose the best crop for each (faces must not be cut). Update the hero alt text to describe the real photo. Add assets/photos/ to .gitignore (originals are ~30 MB; only the optimized images go to git). Then run lint, typecheck, tests, build, and commit. Tell me if any image has a warning.

## Response snapshot

Found the files are named *.jpg.jpg (hidden extension). Viewed all 17 on contact sheets, chose a focus point for each, and added a `--focus x,y` option to the images tool so tall portraits could become wide cards without cutting faces. Fitted all 17 (no tool warnings, check = 17 REAL, 0 problems, 22 to 109 KB each), then reviewed the results visually: faces are whole everywhere; minor notes on dermatology, Dr. Ayesha Rahman and the plate crop. Updated all alt texts (hero first). Added assets/photos/ to .gitignore. Lint, typecheck, 70 tests and build pass; hero spacing re-measured with the real photo. Fit settings recorded in image-manifest.md.

## Outcome

- ✅ Impact: Site now uses real photos; originals stay out of git.
- 🧪 Tests: all gates pass; images check clean.
- 📁 Files: see list.
- 🔁 Next prompts: Phase 4 (remaining Home sections).
- 🧠 Reflection: contact sheets of the results caught what a passing check cannot (face placement); `--focus` was needed for tall-to-wide crops.

## Evaluation notes (flywheel)

- Failure modes observed: user-listed names lacked the hidden double extension.
- Graders run and results (PASS/FAIL): lint, typecheck, tests, build, images check all PASS.
- Prompt variant (if applicable): none
- Next experiment (smallest change to try): none
