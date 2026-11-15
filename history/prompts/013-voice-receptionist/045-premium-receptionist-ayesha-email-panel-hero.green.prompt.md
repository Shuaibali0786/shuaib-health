---
id: 045
title: Premium receptionist Ayesha, email, panel, hero
stage: green
date: 2026-11-09
surface: agent
model: claude-opus-5-5
feature: 013-voice-receptionist
branch: 013-voice-receptionist
user: Shuaibali0786
command: owner premium polish (pasted brief)
labels: ["voice", "persona", "small-talk", "email", "confirm-words", "panel-layout", "hero", "flaky-e2e", "self-test"]
links:
  spec: specs/013-voice-receptionist/spec.md
  ticket: null
  adr: null
  pr: https://github.com/Shuaibali0786/shuaib-health/pull/39
files:
 - frontend/src/voice/phrases.ts
 - frontend/src/voice/router.ts
 - frontend/src/voice/bookingDialog.ts
 - frontend/src/voice/language.ts
 - frontend/src/voice/parse/name.ts
 - frontend/src/voice/parse/yesno.ts
 - frontend/src/components/agent/AssistantPanel.tsx
 - frontend/src/components/agent/voice/VoiceMode.tsx
 - frontend/src/components/agent/voice/Captions.tsx
 - frontend/src/components/agent/voice/EmailField.tsx
 - frontend/src/components/home/Hero.tsx
 - frontend/tests/unit/voice-premium-2026-11-09.test.ts
 - frontend/tests/voice/booking-scripts/21-owner-yes-words.json
 - frontend/tests/voice/booking-scripts/22-email-by-voice.json
 - frontend/tests/e2e/voice.spec.ts
 - frontend/tests/e2e/voice-selftest.spec.ts
 - frontend/tests/e2e/hero-face.spec.ts
 - docs/reports/voice-selftest-2026-11-09.md
 - specs/013-voice-receptionist/results.md
tests:
 - vitest full suite 2027 pass
 - playwright voice/visual/hero flags on (desktop+mobile); FLOW 3 repeated 10/10
 - playwright self-test #4, #19-#24: 7/7
 - playwright home/assistant/a11y/hero-face/voice default build: 106 pass, 38 skipped
---

## Prompt

Context: read specs/013-voice-receptionist/results.md and docs/reports/ first. Branch 013-voice-receptionist, PR #39. Do NOT merge, no production, no database changes.

GOAL: the voice agent must feel like a premium US call-centre receptionist: warm, calm, confident, human. A client who talks to it should say "I want this for my company." Typed booking and the phone-number box already work; polish everything below in one go.

1. PERSONA AND SMALL TALK
   - On open, introduce herself in one warm line: EN "Hi, welcome to Shuaib Health! I'm Ayesha, your virtual assistant. How are you today?" / Roman Urdu "Assalam o Alaikum! Shuaib Health mein khush aamdeed, main Ayesha hoon, aap ki virtual assistant. Aap kaise hain?" (still disclose AI in the small subtitle).
   - Real small talk: "kaise hain aap / how are you / aap kaisi ho" -> "Main bilkul theek hoon, shukriya! Aap sunaiye, main aap ki kya madad karoon?"; "good morning" -> "Good morning to you too!"; thank-you, bye, "theek hoon" all get natural replies. Never answer small talk with "Sorry, I didn't catch that."
   - When a patient names an illness, do NOT say "Mujhe sun kar afsos hua". Use calm, reassuring lines like "Ji, fikar na karein, main abhi aap ki madad karti hoon." / "I'm sorry you're not feeling well, let's get you seen quickly." Vary them.
   - Premium US-style English: short, polite, confident sentences ("Absolutely.", "Perfect, I've got that.", "Just one moment while I check."). Roman Urdu: natural, polite, correct spelling. Never Urdu script on screen.

2. EMAIL BY VOICE: understand spoken emails like "Sohail gmail dot com", "sohail at the rate gmail dot com", "sohail khan at gmail", "suhail ka email gmail" -> sohail@gmail.com / sohailkhan@gmail.com. Read it back letter by letter for the name part ("s-o-h-a-i-l at gmail dot com, sahi hai?"). If not understood after one try, show an email input box in the chat (like the phone box). "Skip" still works.

3. YES WORDS: "ok", "ok hai", "ok hain sab kuch", "sab theek hai", "theek hai", "jee", "bilkul", "sure", "correct" = yes at the confirm step.

4. VOICE PANEL LAYOUT (it is cluttered: "Speaking...", "I heard...", the spoken line and the card overlap the mic/End buttons). Redesign cleanly:
   - Top: orb. Under it ONE small status pill (Listening / Thinking / Speaking).
   - Then the assistant's current line as one clear caption (max 2 lines).
   - "You said: ..." in small grey text under it, only after the patient speaks.
   - Then the two buttons (mic, End) with clear space; nothing overlaps them at any width.
   - The booking card lives in the scrolling chat below, never on top of the controls. Check 390px and 1366px.

5. HERO: move the "Lab reports online" card up so it sits inside the photo at the lower-left (about one third from the bottom), not at the very bottom edge; keep all cards off the face and away from Ask us. Before/after screenshots at 1920, 1366, 768, 390.

6. Fix the flaky voice e2e test (number + name change, then book) so it passes reliably.

SELF-TEST as a patient before reporting: 6 conversations (EN fever, Roman Urdu daant, small talk first then booking, email by voice, "ok hain sab kuch" confirm, mid-way correction). Each must reach the slip with no repeated sentence, no "afsos", and a clean panel. Save transcripts to docs/reports/voice-selftest-2026-11-09.md.

Run affected tests (--workers=1), push to PR #39, tell me when the preview is updated. Then tell me exactly how to turn on Gemini (VOICE_BRAIN) and Azure voice (VOICE_PROVIDER) in Vercel, step by step. Report short and STOP.

## Response snapshot

Persona "Ayesha" welcome and subtitle; small talk (how are you, fine, thanks, bye, greetings, mid-booking thanks); three varied reassuring lines instead of "afsos"; spoken email parsing (no "at", no ".com", "ka email") with a letter-by-letter check, an email box after one unclear try or a "no", Skip kept; owner yes words at the card only (strict elsewhere, overlap gate kept); voice panel rebuilt (orb, one pill, 2-line caption, "You said", buttons; block never shrinks); "Lab reports online" inside the photo a third up; flaky FLOW 3 fixed by waiting for a NEW reply (10/10 repeats). Self-test 7/7 after fixing two tone issues found by reading transcripts (odd email line, re-welcome after a name correction).

## Outcome

- ✅ Impact: premium persona, email by voice, cleaner panel, hero card moved; FR-045 relaxed at the card per owner decision.
- 🧪 Tests: unit 2027 pass; voice e2e (flags on) pass; self-test 7/7; default-build affected e2e 106 pass.
- 📁 Files: see list above.
- 🔁 Next prompts: owner tries Ayesha on a real phone (Chrome) on the preview; decide on Gemini / Azure keys.
- 🧠 Reflection: transcript reading still catches tone problems the automatic checks miss.

## Evaluation notes (flywheel)

- Failure modes observed: e2e helper matched old log text (race); default 30 s timeout too short once waits are real.
- Graders run and results (PASS/FAIL): PASS.
- Prompt variant (if applicable): none.
- Next experiment (smallest change to try): a real-device check of how Chrome writes spoken emails.
