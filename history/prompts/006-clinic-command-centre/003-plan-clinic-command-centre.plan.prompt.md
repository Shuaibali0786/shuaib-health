---
id: 003
title: Plan Clinic Command Centre
stage: plan
date: 2026-10-05
surface: agent
model: claude-opus-5-5
feature: 006-clinic-command-centre
branch: 006-clinic-command-centre
user: Shuaibali0786
command: /sp.plan
labels: ["plan","auth","sessions","demo","dashboard","isolation","charts","migrations","design-gate"]
links:
  spec: specs/006-clinic-command-centre/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - specs/006-clinic-command-centre/plan.md
 - specs/006-clinic-command-centre/research.md
 - specs/006-clinic-command-centre/data-model.md
 - specs/006-clinic-command-centre/quickstart.md
 - specs/006-clinic-command-centre/contracts/command-centre-api.openapi.yaml
 - specs/006-clinic-command-centre/contracts/auth-matrix.md
 - specs/006-clinic-command-centre/contracts/website-admin.md
tests:
 - none (planning only)
---

## Prompt

/sp.plan Plan Feature 006 using our existing stack (Next.js App Router + TypeScript + Tailwind, FastAPI + SQLModel + Alembic, Neon Postgres). Guidance:
- Auth: server-side sessions (opaque random token in a Secure, httpOnly, SameSite cookie; only a hash stored in DB), Argon2, CSRF protection, lockout, roles enforced in a FastAPI dependency on every endpoint. Reuse the trusted-proxy pattern from 005.
- Dashboard lives under /admin as its own route group; its JS must never load on public pages. Prove it with a bundle check.
- Charts: lightweight (hand-built SVG or a very small library), accessible, no heavy chart library.
- Demo: deterministic generator per Karachi date, kept fully separate from real data; demo session server-side read-only.
- Migrations: extend booking statuses safely (Arrived, No-show), audit log extension, staff + session tables. Seed never in production; first admin via CLI only.
- Design system: reuse the website's brand tokens (navy, teal, gold, serif headings); luxury feel; light + dark.
- Testing plan: API auth matrix (no session / demo / receptionist / admin for every endpoint), unit, Playwright desktop + mobile, visual baselines, axe accessibility.
Record big decisions as ADR candidates. Remember the design gate: preview comes right after planning, before feature code. Write the plan, then STOP with a short summary.

## Response snapshot

Wrote plan.md, research.md (R1–R18), data-model.md, quickstart.md and three contracts (OpenAPI delta 1.2.0, auth matrix, website BFF/isolation). Key decisions: opaque HMAC-hashed server sessions in a `__Host-` SameSite=Strict cookie with synchronizer CSRF, per-email-HMAC lockout + per-IP Postgres limits, Argon2id (argon2-cffi), policy-table `require_viewer` dependency with route-introspection test; 005 proxy secret on every admin endpoint; migration 0003 (arrived/no_show, exclusion on non-cancelled, version column, status history, audit extension, staff/session/demo/throttle tables, refuse lossy downgrade); demo as a separate session kind with a deterministic in-memory generator behind a RealSource/DemoSource seam; two root layouts + scoped CSS + `src/admin/` boundary, allow-listed BFF, plain-form demo button, build-manifest + runtime sentinel isolation proofs; hand-built SVG charts. Flagged: constitution VI says JWT (deviation recorded, amendment proposed); website headings are sans-serif, so a serif face is proposed for admin only and confirmed at the design gate. Phase 0 = design preview gate; stopped for approval.

## Outcome

- ✅ Impact: Complete Phase 0/1 planning artifacts for Feature 006; 4 ADR candidates and 1 constitution amendment proposed.
- 🧪 Tests: none run (planning only); test strategy defined.
- 📁 Files: plan.md, research.md, data-model.md, quickstart.md, contracts/*; agent-context script ran (CLAUDE.md content unchanged).
- 🔁 Next prompts: build the static design preview (FR-039) and await approval; /sp.adr for the 4 decisions; /sp.constitution PATCH for VI; then /sp.tasks.
- 🧠 Reflection: Reading 005 results surfaced the Link-prefetch trap, which shaped the plain-form demo entry.

## Evaluation notes (flywheel)

- Failure modes observed: none.
- Graders run and results (PASS/FAIL): Constitution Check PASS with one documented deviation (VI).
- Prompt variant (if applicable): null
- Next experiment (smallest change to try): null
