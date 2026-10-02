---
id: 002
title: Plan Brand and Home Page
stage: plan
date: 2026-09-30
surface: agent
model: claude-sonnet-5-5
feature: 001-brand-home-page
branch: 001-brand-home-page
user: Shuaibali0786
command: /sp.plan
labels: ["plan", "nextjs", "tailwind-v4", "design-tokens", "accessibility", "testing"]
links:
  spec: specs/001-brand-home-page/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - specs/001-brand-home-page/plan.md
 - specs/001-brand-home-page/research.md
 - specs/001-brand-home-page/data-model.md
 - specs/001-brand-home-page/design-system.md
 - specs/001-brand-home-page/image-manifest.md
 - specs/001-brand-home-page/quickstart.md
 - specs/001-brand-home-page/contracts/routes.md
 - specs/001-brand-home-page/contracts/content-shapes.md
 - history/prompts/001-brand-home-page/002-plan-brand-and-home-page.plan.prompt.md
tests:
 - none (planning only; test strategy defined in plan.md)
---

## Prompt

/sp.plan Plan Feature 001 (brand, layout, Home page) using the constitution's stack.

Tech decisions:
- App lives in frontend/ (Vercel Root Directory = frontend later). Latest stable Next.js App Router + TypeScript strict, npm, Node 24.
- Tailwind v4 CSS-first: brand tokens in @theme (navy #0B2545, teal #14B8A6, blue accent, grey text #5B6B7F, surface colors, radius, shadows). No hard-coded hex values in components.
- Fonts via next/font: "Plus Jakarta Sans" for headings, "Inter" for body.
- Logo as an inline SVG React component (mark + wordmark variants), plus favicon/app icon from the same mark.
- Mock data: typed files in frontend/src/data (departments, doctors, healthTips, siteConfig for phone/address/hours) with TypeScript types in frontend/src/types shaped like future API responses (ids, slugs). All sample items flagged isSample.
- Images: frontend/public/images/{hero,departments,doctors,tips,clinic}/ with clearly named placeholder files; next/image everywhere with width/height/alt; list every image file name the page expects so I can add real photos later.
- Animations: Framer Motion, small fade/slide on scroll, fully disabled with prefers-reduced-motion.
- Icons: lucide-react.
- Routes: "/" Home, "Coming soon" placeholder routes for every nav/footer link not built yet, custom not-found page.
- The build must never call a backend in this feature.
- Tests: Vitest + React Testing Library for components/data, Playwright for Home on mobile and desktop (notice bar, nav, emergency number, credit link, no broken links). Add npm scripts: dev, build, lint, typecheck, test, test:e2e.
- Windows CMD friendly commands only.

Only write the plan and design docs now. Do not install packages or write app code yet.

## Response snapshot

Read-only research (npm view, Context7 docs, a contrast computation) then wrote plan.md, research.md, data-model.md, design-system.md, image-manifest.md, quickstart.md and two contract docs. Findings: TypeScript 7 / ESLint 10 are npm latest but unsupported by the lint plugins, so pin TypeScript ~6.0.3 and ESLint ^9.39.5; brand teal #14B8A6 is 2.49:1 on white, so it is decoration/background only (navy text 6.18:1) with teal-700 for text; placeholders via a single catch-all route and registry; async content accessors. Constitution check passes; two justified deviations (Lighthouse CI deferred to Phase 4, tooling pins). No packages installed, no app code written.

## Outcome

- ✅ Impact: Feature 001 has a complete, constitution-checked plan and design docs ready for /sp.tasks.
- 🧪 Tests: none run; unit, component and E2E strategy specified (Vitest, RTL, Playwright + axe).
- 📁 Files: 8 spec-folder docs plus this PHR.
- 🔁 Next prompts: /sp.tasks for Feature 001; optionally /sp.adr for the content-layer decision.
- 🧠 Reflection: update-agent-context.ps1 only prepended a BOM to CLAUDE.md (no real context added), so that change was reverted.

## Evaluation notes (flywheel)

- Failure modes observed: agent-context script produced a no-op BOM diff; create-phr.sh missing.
- Graders run and results (PASS/FAIL): Constitution Check PASS (pre and post design).
- Prompt variant (if applicable): none
- Next experiment (smallest change to try): none
