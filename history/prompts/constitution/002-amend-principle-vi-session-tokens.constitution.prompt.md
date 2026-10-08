---
id: 002
title: Amend Principle VI Session Tokens
stage: constitution
date: 2026-10-05
surface: agent
model: claude-opus-5-5
feature: none
branch: 006-clinic-command-centre
user: Shuaibali0786
command: /sp.constitution
labels: ["constitution", "security", "sessions", "amendment"]
links:
  spec: specs/006-clinic-command-centre/spec.md
  ticket: null
  adr: history/adr/0007-staff-auth-opaque-sessions-and-policy-table.md
  pr: null
files:
 - .specify/memory/constitution.md
 - .specify/templates/plan-template.md
 - specs/006-clinic-command-centre/plan.md
tests:
 - none (documentation only)
---

## Prompt

Approved. Do these in order, then STOP:
1. Amend constitution Principle VI to "a JWT or an opaque server-side session token" via /sp.constitution (small amendment, bump version, sync dependent templates).
2. Create all 4 ADRs you listed.
3. Commit + push.
4. Build the design preview: Overview + Bookings, phone 390px and desktop 1440px, light and dark, demo data. Make TWO heading-font variants: (A) a luxury serif (Cormorant Garamond or similar) and (B) Plus Jakarta Sans like the website, so I can compare. Premium UK private-clinic feel, navy/teal/gold.
5. Save screenshots of every variant (PNG) in the design-preview folder and tell me exactly how to open the preview in my browser.
Do not write feature code. STOP after the preview and wait for my approval.

## Response snapshot

Step 1 of 5. Constitution 1.0.0 → 1.0.1 (PATCH, wording clarification). Principle VI session bullet now reads "Sessions use a JWT or an opaque server-side session token stored in an httpOnly, Secure, SameSite cookie"; added that opaque tokens are high-entropy and stored only as a hash. Sync Impact Report updated; plan-template VI gate reworded; Feature 006 plan.md Constitution Check VI flipped from deviation to pass and Complexity Tracking row marked resolved.

## Outcome

- ✅ Impact: Feature 006 auth design is now constitution-compliant without a recorded deviation.
- 🧪 Tests: none (documentation only)
- 📁 Files: constitution.md, plan-template.md, specs/006 plan.md
- 🔁 Next prompts: create ADRs 0007–0010; commit + push; design preview.
- 🧠 Reflection: PATCH chosen because no principle was added or removed; the change widens one implementation option.

## Evaluation notes (flywheel)

- Failure modes observed: none
- Graders run and results (PASS/FAIL): no unresolved placeholders; version line matches report — PASS
- Prompt variant (if applicable): null
- Next experiment (smallest change to try): null
