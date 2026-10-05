---
id: 002
title: Plan appointment booking
stage: plan
date: 2026-10-04
surface: agent
model: claude-opus-5-5
feature: 005-appointment-booking
branch: 005-appointment-booking
user: Shuaibali0786
command: /sp.plan
labels: ["plan", "booking", "exclusion-constraint", "idempotency", "rate-limiting", "postgres", "privacy", "bff"]
links:
  spec: specs/005-appointment-booking/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - specs/005-appointment-booking/plan.md
 - specs/005-appointment-booking/research.md
 - specs/005-appointment-booking/data-model.md
 - specs/005-appointment-booking/quickstart.md
 - specs/005-appointment-booking/contracts/booking-api.openapi.yaml
 - specs/005-appointment-booking/contracts/website-booking.md
 - specs/005-appointment-booking/contracts/fixtures/phone-cases.json
 - specs/005-appointment-booking/spec.md
tests:
 - none (planning stage)
---

## Prompt

/sp.plan Use a PostgreSQL exclusion constraint (btree_gist, per doctor, time range, only active bookings) to make double-booking impossible, an idempotency-key table for retries, and rate-limit counters stored in Postgres (shared across instances, no Redis). Confirmation page shows only masked patient details (e.g. A**** K****, 0300****567) plus doctor, date and time. All times stored in UTC, shown in clinic time zone. Reuse Feature 003/004 patterns (API client, caching, mock API, tests). Phase-by-phase tasks with a checkpoint after each phase.

## Response snapshot

Wrote plan.md (technical context, Constitution Check passing on all 10 principles, structure, 8 key decisions, 9 phases 0–8 with checkpoints, NFR budgets, top 3 risks), plus research.md (R1–R12), data-model.md, the contract delta, the website proxy contract, the shared phone-cases fixture and quickstart.md.

Key design choices:
- **Double-booking**: partial gist exclusion constraint on `tstzrange` where status is confirmed.
- **Idempotency**: key rows written inside the booking transaction, with replay on `ON CONFLICT`.
- **Rate limits**: Postgres fixed-window counters keyed by HMAC, for booking per IP and per phone and for lookup.
- **Proxy trust**: a proxy secret both authorizes the server-to-server POST and lets the backend trust the visitor IP the website forwards.
- **Max active bookings**: a per-phone advisory lock.
- **Masked confirmation view**: Crockford base32 references.
- **Times**: stored and sent in UTC; rules applied in the clinic time zone through an injectable clock.
- **Website**: same-origin route handlers as a proxy, with flow state in the URL (non-personal fields only).
- **Breaks in the seed**: a Tuesday break added for dr-omar-sheikh.

The spec was updated to match the decisions:
- the confirmation view is masked everywhere;
- the lookup limit is 20/min, and slot reads fall under the general 60/min limit;
- a Clarifications section was added.

## Outcome

- ✅ Impact: Plan ready for /sp.tasks; no new dependencies on either side
- 🧪 Tests: none (planning stage); test strategy defined per phase
- 📁 Files: plan, research, data-model, quickstart, 2 contracts + fixture; spec updated
- 🔁 Next prompts: /sp.adr (booking integrity; proxy trust + rate limiting), then /sp.tasks
- 🧠 Reflection: The existing backend puts every visitor behind the website server's IP. Forwarding the client IP in a way the backend can trust was the main design issue the user's input did not cover.

## Evaluation notes (flywheel)

- Failure modes observed: update-agent-context.ps1 reported "updated" but produced no git diff in CLAUDE.md
- Graders run and results (PASS/FAIL): Constitution Check PASS (pre and post design)
- Prompt variant (if applicable): none
- Next experiment (smallest change to try): check that the agent-context markers exist in CLAUDE.md
