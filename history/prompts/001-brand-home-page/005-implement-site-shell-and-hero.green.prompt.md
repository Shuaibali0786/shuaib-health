---
id: 005
title: Implement Site Shell and Hero
stage: green
date: 2026-10-01
surface: agent
model: claude-sonnet-5-5
feature: 001-brand-home-page
branch: 001-brand-home-page
user: Shuaibali0786
command: /sp.implement
labels: ["implement", "mvp", "logo", "header", "footer", "hero", "accessibility", "unit-tests"]
links:
  spec: specs/001-brand-home-page/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - specs/001-brand-home-page/tasks.md
 - frontend/src/app/layout.tsx
 - frontend/src/app/page.tsx
 - frontend/src/app/globals.css
 - frontend/src/app/icon.svg
 - frontend/src/app/apple-icon.tsx
 - frontend/src/app/theme-color.ts
 - frontend/src/components/brand (logo-paths, LogoMark, Logo)
 - frontend/src/components/layout (SkipLink, NoticeBar, NavLinks, MobileMenu, SiteHeader, SiteFooter, Container)
 - frontend/src/components/home/Hero.tsx
 - frontend/src/components/ui (Button size prop, ImageWithFallback preload)
 - frontend/src/data/homeContent.ts
 - frontend/src/lib/routes.ts
 - frontend/vitest.config.mts
 - frontend/package.json
 - frontend/package-lock.json
 - frontend/tests/unit (tokens, logo, header, footer-and-notice, hero)
tests:
 - npm run lint (pass)
 - npm run typecheck (pass)
 - npm run test (5 files, 70 tests pass)
 - npm run build (pass)
 - headless Chrome at 320/390/768/1280 px (layout, computed styles, fonts, menu, overflow)
 - axe WCAG 2.2 AA on /, /doctors, /no-such-page at 390 and 1280 px (0 violations)
---

## Prompt

Implement only Phase 3 (the MVP user story: site shell + Hero) from specs/001-brand-home-page/tasks.md. Include the SVG logo component and favicon/app icon from the same mark. Hero uses the placeholder images from image-manifest.md for now. Check the brand tokens and fonts are really applied (navy headings, teal buttons, Plus Jakarta Sans / Inter). Mark each task [X]. At the end run lint, typecheck, unit tests and build, fix errors, commit, and STOP at the checkpoint. Tell me what to check on mobile and desktop. Do not start the other Home sections.

## Response snapshot

Implemented T038–T051: logo geometry (rounded plus with a point-symmetric heartbeat "S"), LogoMark and Logo components, icon.svg and apple-icon from the same paths, skip link, notice bar, NavLinks with aria-current, MobileMenu, sticky SiteHeader, four-column SiteFooter with credit, full root layout and metadata, and the Hero with the placeholder photo. Verified in headless Chrome: h1 navy rgb(11,37,69) in Plus Jakarta Sans 800, body Inter, Book Appointment buttons are the teal gradient with navy text. The browser check found a real bug (header overflowed 31 px at 1280 px), fixed with a wider header container. Also pulled forward five test files (70 tests) because unit tests were requested. Lint, typecheck, tests and build pass. Stopped at Checkpoint 3 without starting the other Home sections.

## Outcome

- ✅ Impact: Feature 001 MVP (shell plus Hero) is working and verified on mobile and desktop.
- 🧪 Tests: 70 unit tests pass; axe reports 0 violations; manual browser checks at four widths.
- 📁 Files: see list; about 30 files changed or added.
- 🔁 Next prompts: review Checkpoint 3, then implement Phase 4 (the remaining Home sections).
- 🧠 Reflection: real browser checks found issues unit tests could not (overflow at 1280, deprecated Image priority prop, accessible-name computation).

## Evaluation notes (flywheel)

- Failure modes observed: jsdom import.meta.url is not a file URL; dom-accessibility-api trimmed a leading space in an sr-only span; header overflow at 1280 px.
- Graders run and results (PASS/FAIL): lint PASS, typecheck PASS, vitest 70/70 PASS, build PASS, axe PASS.
- Prompt variant (if applicable): none
- Next experiment (smallest change to try): none
