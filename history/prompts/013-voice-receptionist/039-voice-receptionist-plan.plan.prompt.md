---
id: 039
title: Voice receptionist implementation plan
stage: plan
date: 2026-11-08
surface: agent
model: claude-opus-5-5
feature: 013-voice-receptionist
branch: 013-voice-receptionist
user: Shuaibali0786
command: /sp.plan
labels: ["voice-agent","plan","patient-access-api","migration-gate","design-options"]
links:
  spec: specs/013-voice-receptionist/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - specs/013-voice-receptionist/plan.md
 - specs/013-voice-receptionist/research.md
 - specs/013-voice-receptionist/data-model.md
 - specs/013-voice-receptionist/contracts/patient-access-api.md
 - specs/013-voice-receptionist/quickstart.md
 - specs/013-voice-receptionist/design/option-a-aurora.dc.html
 - specs/013-voice-receptionist/design/option-b-concierge.dc.html
 - CLAUDE.md
tests:
 - none (plan stage)
---

## Prompt

/sp.plan (no extra arguments; continues the owner brief recorded in PHR 038: plan, then tasks, then STOP; show research ideas, feature list, never-do list, 2 design options, new endpoints, test plan, days to build; STOP before any database migration).

## Response snapshot

Plan written. Constitution Check passes (I–XI). Research R1–R10:
- browser speech behind SpeechPort, Edge Natural voices first;
- Urdu-script phrase forms, needed for Urdu voices;
- a canvas orb whose speaking waves follow word-boundary events (speech synthesis audio cannot be analysed);
- an echo-safe yes gate;
- pluggable CodeSender;
- Resend free tier 100/day, 3,000/month, so a cap of 60/day;
- HMAC single-use codes, a uniform 404, a timing floor, 3-strike 1-hour locks reusing rate_limit_counter;
- a deterministic booking dialog;
- patient cancel through the existing status rules (audit only, because status_change needs a staff actor).

Contract: 4 new endpoints (lookup, access-codes, access-codes/verify, cancel). Migration 0006_patient_access is needed (a new patient_access_code table and wider audit CHECK lists), with an owner gate before it is created or run. Finding: the existing GET /appointments/{reference} exposes the last 3 phone digits (Risk 1, owner decision). Two design options were published to the canvas https://claude.ai/artifact/RLHiTnmnNGc1FthbHmhtqF and saved in design/. Estimate: about 13 working days.

## Outcome

- ✅ Impact: plan and design artifacts ready for task generation
- 🧪 Tests: test plan defined (45 red-team, 30 Q&A, 10 booking scripts, 5 lookup scripts, a11y, visual, perf, manual)
- 📁 Files: plan, research, data-model, contract, quickstart, 2 mockups, CLAUDE.md context
- 🔁 Next prompts: /sp.tasks; owner picks design A or B; owner approves migration 0006 and the API change; optional /sp.adr
- 🧠 Reflection: checking real code changed the design: no patient email or cancel existed, status_change needs a staff actor, and the masked phone shows the last 3 digits

## Evaluation notes (flywheel)

- Failure modes observed: Artifact publish was refused on the 8.3 short scratchpad path; the long path worked
- Graders run and results (PASS/FAIL): Constitution Check PASS
- Prompt variant (if applicable): null
- Next experiment (smallest change to try): null
