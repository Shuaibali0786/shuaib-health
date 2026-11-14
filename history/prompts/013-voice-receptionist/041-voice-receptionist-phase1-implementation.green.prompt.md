---
id: 041
title: Voice receptionist Phase 1 implementation
stage: green
date: 2026-11-08
surface: agent
model: claude-sonnet-5-5
feature: 013-voice-receptionist
branch: 013-voice-receptionist
user: Shuaibali0786
command: implement (owner decisions)
labels: ["voice-agent","phase-1","implementation","safety","booking","a11y"]
links:
  spec: specs/013-voice-receptionist/spec.md
  ticket: null
  adr: history/adr/0015-patient-access-codes-and-voice-provider-slot.md
  pr: null
files:
 - frontend/src/voice/* (session, router, safety, bookingDialog, parsers, speech adapters)
 - frontend/src/components/agent/voice/* (orb, captions, controls, mic help, summary card, slip card)
 - frontend/src/components/agent/AssistantPanel.tsx, AssistantLauncher.tsx
 - frontend/src/lib/demo.ts, frontend/src/agent/localEngine.ts (two small exports)
 - frontend/tests/unit/voice-*.test.ts*, frontend/tests/voice/*, frontend/tests/e2e/voice*.spec.ts
 - docs/runbooks/voice-receptionist.md, specs/013-voice-receptionist/results.md
tests:
 - vitest: 1,821 pass (217 voice)
 - playwright voice (desktop + mobile, workers=1): 20 pass; existing affected specs 99 pass
---

## Prompt

Owner decisions (2026-11-08):
1. Design: Option B (Concierge, in-chat, light), but use Option A's large glowing animated orb and its 4 states inside the B panel. On phones the panel may expand to full height.
2. Design polish: larger orb; a QR code (not a barcode) on the booked card to match the website slip; the booking summary card INSIDE the chat panel; raise contrast of small grey text to WCAG AA; live captions under the orb while the agent speaks.
3. Scope: PHASE 1 only now: discovery bubble, Mic dictation, Voice mode panel, voice Q&A in English + Roman Urdu (Patient and Clinic owner tabs), hands-free voice booking with read-back + spoken "yes", summary card, slip with QR + Download PDF, female/male voice, EN / Urdu toggle, all safety rules, the on/off switches (default OFF in production until approved).
4. NOT now (Phase 2 later): email-code lookup, cancel, the 0006 migration, the 4 new endpoints, Resend. Do not create or run any migration.
5. Leave the existing booking-view endpoint as it is for now; add it to the Phase 2 notes.
6. Record the ADR for the patient-access + pluggable providers decision (/sp.adr), marked "Phase 2".

Then implement Phase 1 tasks in order, committing as you go on branch 013-voice-receptionist. Run the affected tests (Playwright with --workers=1). Red-team and booking tests on dev/preview only. When Phase 1 is complete: push, open the PR, let CI run, and give me the Vercel PREVIEW link so I can try the voice myself. Do NOT merge. Report short and STOP. If you run out of context midway, stop at a clean point, commit, and tell me exactly which task is next.

## Response snapshot

Recorded ADR-0015 (Proposed, Phase 2). Built Phase 1 in the website only: speech port (browser + scripted), voice session (barge-in, echo guard, silence prompts, "yes" gate), safety guards, booking dialog (pure state machine), parsers (phone, date, time, yes/no, name, email), the orb (canvas engine outside React), captions, controls, mic help, summary card, slip card, dictation, discovery bubble, flag `VOICE_ENABLED`. 56 red-team prompts, 30 Q&A, 10 booking scripts, widget and browser tests, visual baselines (win32). No backend change, no migration.

## Outcome

- ✅ Impact: Phase 1 complete behind an OFF flag
- 🧪 Tests: see above; real-voice manual checklist ready
- 📁 Files: see list
- 🔁 Next prompts: owner tries the preview; approve production flag; Phase 2 (migration 0006 gate)
- 🧠 Reflection: bugs found by tests and screenshots: phone digits blocking date parsing, a sentence taken as a name, the 8-turn typed limit blocking a 10-turn booking, brand names in source, mock server clock vs phone clock, a log area squeezed to nothing on short screens

## Evaluation notes (flywheel)

- Failure modes observed: shell quoting stripped backslashes from regexes written via scripts (use the Edit tool for regexes)
- Graders run and results (PASS/FAIL): honesty, guards, tokens, a11y (axe) PASS
- Prompt variant (if applicable): null
- Next experiment (smallest change to try): null
