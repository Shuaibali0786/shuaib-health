---
id: 001
title: Shuaib Health Constitution
stage: constitution
date: 2026-09-30
surface: agent
model: claude-sonnet-5-5
feature: none
branch: master
user: Shuaibali0786
command: /sp.constitution
labels: ["constitution", "honesty", "privacy", "security", "design", "build-order"]
links:
  spec: null
  ticket: null
  adr: null
  pr: null
files:
 - .specify/memory/constitution.md
 - .specify/templates/plan-template.md
 - .specify/templates/tasks-template.md
 - history/prompts/constitution/001-shuaib-health-constitution.constitution.prompt.md
tests:
 - none (documentation only)
---

## Prompt

/sp.constitution Create the constitution for "Shuaib Health", a portfolio-demo premium multi-specialty clinic + diagnostic lab website and staff web app in Karachi, Pakistan. Monorepo: frontend/ (Next.js App Router, TypeScript strict, Tailwind v4, Framer Motion, Zustand, React Hook Form + Zod, lucide-react, next/font, next/image) and backend/ (FastAPI, SQLModel, Alembic, psycopg3, run with uv, Neon Postgres). Deploy: Vercel (frontend) + Render (backend). Later phase: AI chatbot agent with tool calling.

Principles (make each one testable):
1. Honesty: no fake reviews, ratings, stats, awards, certifications or other brands' names/logos. All sample content is labelled. Every page shows "Portfolio demo — not a real clinic, not medical advice." Footer and staff login show "Designed & built by Shuaib Ali" linking to https://github.com/Shuaibali0786.
2. Health data privacy: role-based access (patient, receptionist, doctor, lab staff, admin); a patient sees only their own data; lab reports downloadable only by the right patient/staff; audit log for important actions; no medical data or secrets in logs; rate limiting on auth, booking and lookup endpoints.
3. Server is the source of truth: slot generation, booking rules, prices and statuses are enforced on the server; double-booking is prevented at the database level; all times use Asia/Karachi; prices in PKR.
4. API-first: booking, availability, reschedule, cancel and status APIs are reusable by the website, the staff app and the future AI agent with the same rules.
5. Resilience: the frontend build must never fail if the backend is unreachable at build time.
6. Security: Argon2 passwords, JWT in httpOnly cookie, origin/CSRF checks, same-origin proxy from Vercel to backend, strict CORS. Never commit .env or secrets; never print secrets.
7. Databases: Neon pooled URL for the app, direct URL for migrations; separate dev and production databases.
8. Design: premium, calm, light theme; deep navy #0B2545 headings, teal #14B8A6 accents with teal-to-blue gradients, rounded cards, soft shadows, subtle motion that respects prefers-reduced-motion. Mobile-first, WCAG 2.2 AA, fast (good Core Web Vitals), all images optimized via next/image.
9. Quality: TypeScript strict, no `any`; unit tests for logic and Playwright tests for key flows; small, reviewable changes.
10. Build order: Phase 1 frontend with mock data, 2 backend, 3 staff app, 4 deploy + polish, 5 AI agent.

Only write the constitution file now. Do not create any app code yet.

## Response snapshot

Wrote constitution v1.0.0 (ratified and amended 2026-09-30) with 10 principles, each with a concrete Test line, plus Technology Stack, Development Workflow, and Governance sections and a Sync Impact Report. Updated plan-template Constitution Check gates and made tests mandatory in tasks-template. No app code created.

## Outcome

- ✅ Impact: Project constitution ratified; plan template now gates on all 10 principles.
- 🧪 Tests: none (docs only); each principle defines its own verification.
- 📁 Files: constitution.md, plan-template.md, tasks-template.md, this PHR.
- 🔁 Next prompts: /sp.specify for Phase 1 (frontend with mock data).
- 🧠 Reflection: create-phr.sh not present, so PHR written agent-natively.

## Evaluation notes (flywheel)

- Failure modes observed: .specify/scripts/bash/create-phr.sh missing.
- Graders run and results (PASS/FAIL): manual placeholder check PASS.
- Prompt variant (if applicable): none
- Next experiment (smallest change to try): none
