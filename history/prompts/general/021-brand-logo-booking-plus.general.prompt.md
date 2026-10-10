---
id: 021
title: Brand logo Booking Plus into the product
stage: general
date: 2026-10-09
surface: agent
model: claude-sonnet-5-5
feature: none
branch: chore/brand-logo
user: Shuaibali0786
command: brand logo task (Safe-Change Playbook)
labels: ["brand", "logo", "visual-baseline", "admin", "slip", "favicon"]
links:
  spec: null
  ticket: null
  adr: null
  pr: see the PR opened from chore/brand-logo
files:
 - frontend/src/lib/brand-marks.ts (new: mark geometry and palette)
 - frontend/src/components/brand/wordmark-paths.ts (new: Cormorant Garamond 700 outlines)
 - frontend/src/components/brand/Logo.tsx, LogoMark.tsx, PoweredBy.tsx
 - frontend/src/components/brand/logo-paths.ts (removed: old mark)
 - frontend/src/components/layout/SiteFooter.tsx
 - frontend/src/admin/shell/Brand.tsx, AppShell.tsx, frontend/src/app/(admin)/admin/{admin.css,login/page.tsx}
 - frontend/src/app/icon.svg, apple-icon.tsx, tokens.css
 - frontend/src/lib/booking/slip.ts, src/components/booking/ConfirmationCard.tsx, src/lib/og.tsx
 - frontend/scripts/build-logo-svg.mjs, public/images/brand/logo-mark.svg
 - frontend/tests/unit/{logo,logo-mark,tokens,no-hardcoded-catalog}.test.*
 - frontend/tests/e2e/*-snapshots (135 regenerated baselines)
 - docs/brand-logo-pixel-diff.md
tests:
 - tsc, eslint, Vitest (1370), Playwright main + admin projects
---

## Prompt

New small task: put the chosen brand logo "Booking Plus" into the product. Follow docs/SAFE-CHANGE-PLAYBOOK.md.

Branch: chore/brand-logo from an up-to-date main. Do NOT touch the 007-launch-ready branch.

Logo marks (viewBox 0 0 64 64): LIGHT (default, >32px), NIGHT (same shapes, body #F7F5EF and plus #1E8F84), SMALL (32px and below, incl. favicon), ONE-COLOUR (print). Wordmark: "Shuaib" in the brand serif (Cormorant Garamond 700) navy, plus "Health" in #1E7F76; night mode white plus #5FD0C5.

Put it in: 1. one reusable Logo component (variants light / night / small / one-colour; with or without wordmark). 2. Public site header and footer. 3. Favicon app/icon.svg (SMALL) and a 180px apple-icon PNG if it can be generated locally without risky deps. 4. Admin Command Centre login page and sidebar, NIGHT in Night theme. 5. "Powered by Shuaib Health" line with the SMALL mark. 6. Slip (web + PDF): the brand mark in the slip header, keep the double-ring stamp unchanged.

Rules: decorative SVGs aria-hidden; logo links aria-label "Shuaib Health home"; do not change header height or layout beyond the logo; no red cross symbols. Run one suite at a time in the foreground: tsc, eslint, Vitest, backend tests that touch the PDF, Playwright main + admin. Regenerate only changed visual baselines and write a pixel-diff report; keep old baselines backed up. Write a PHR. Commit, push, open a PR. Do NOT merge.

(Full prompt as given by the user; the mark SVG markup is in frontend/src/lib/brand-marks.ts.)

## Response snapshot

- Asked one question: the wordmark font conflicts with ADR 0008 (no Cormorant on public pages). The user chose outlined SVG paths, so the public site loads no font and the isolation guard is untouched.
- Built Logo / LogoMark / PoweredBy from shared geometry in lib/brand-marks.ts; brand tokens added to tokens.css; icon.svg, apple-icon, OG card, public logo-mark.svg and the slip PDF draw the same shapes.
- Admin: the round monogram became the mark (Night colours on the always-navy sidebar and top bar; the sign-in card follows the theme through --logo-* variables).
- Found by the e2e suite: the wordmark at first size made the header wrap at 320 and 375 px; reduced the wordmark size until the header stayed one row.
- Backend: no backend test touches the PDF (it is built in the frontend), so none was run.

## Outcome

- ✅ Impact: new brand mark and wordmark across site, admin, favicon, slip, OG card.
- 🧪 Tests: tsc, eslint clean; Vitest 1370 pass; Playwright main + admin, see the PR.
- 📁 Files: see the list above.
- 🔁 Next prompts: Shuaib reviews the pixel-diff report and the PR; decide on the old-mark items listed in the PR.
- 🧠 Reflection: shared components cannot rely on Tailwind classes in the admin app (it scans only src/admin), so they use inline styles.

## Evaluation notes (flywheel)

- Failure modes observed: header wrapped at 320/375 px with the first wordmark size; a first "exit=0" came from tail, not Playwright.
- Graders run and results (PASS/FAIL): see the PR description.
- Prompt variant (if applicable): none
- Next experiment (smallest change to try): a header width budget test that names the logo width.
