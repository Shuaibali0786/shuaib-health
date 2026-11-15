---
id: 038
title: Voice receptionist specification
stage: spec
date: 2026-11-08
surface: agent
model: claude-opus-5-5
feature: 013-voice-receptionist
branch: 013-voice-receptionist
user: Shuaibali0786
command: /sp.specify
labels: ["voice-agent","web-speech","booking","otp","accessibility","research"]
links:
  spec: specs/013-voice-receptionist/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - specs/013-voice-receptionist/spec.md
 - specs/013-voice-receptionist/checklists/requirements.md
tests:
 - none (specification stage)
---

## Prompt

Message 1 (pasted brief, cut off mid-sentence):

New feature: a world-class, FREE voice agent for the existing "Ask Shuaib Health" chat widget. It must feel like a real, warm call-centre receptionist and look luxury/premium. Use Spec-Kit: /sp.specify, /sp.plan, /sp.tasks. Do NOT implement yet. STOP after tasks with a short summary.

STEP 0 - RESEARCH (web): study the best voice assistant experiences (ChatGPT voice, Gemini Live, Claude voice, Siri, top AI receptionist products) for UX, animation and conversation patterns. Summarise 5 ideas we will use.

RULES (decided, do not ask again):
- FREE ONLY: browser Web Speech API for listening and speaking. No paid APIs. Reuse the SAME brain, knowledge and safety rules as the existing text assistant (Patient and Clinic owner tabs). Design OTP and voice so paid providers (SMS, WhatsApp, premium voices) can be plugged in later by config only.
- PUBLIC DATA ONLY for answers: clinic name, address, hours, contact, departments, doctors, schedules, FREE/FULL slots, lab tests and preparation, packages, fees, booking steps, FAQs, health tips. No access to staff, admin or other patients.
- LANGUAGES: English and Urdu incl. Roman Urdu. Reply in the user's language. Best available device voice (Edge natural voices first). Default warm FEMALE voice, user can switch to male. If no Urdu voice, show text and say so politely.
- BOOKING BY VOICE, hands-free: use the SAME public booking endpoint as the website form. Ask name, phone, reason, doctor/date/time (email optional but encouraged: it sends the slip and enables recovery). Check free slots, never invent them. Read everything back (phone digit by digit) and ask "Shall I confirm?". Book ONLY after the user's own spoken "yes" in the next turn. A live summary card mirrors the details on screen. Max 1 booking per conversation; keep existing rate limits. After booking: say the reference, show the slip with QR and "Download PDF", remind: arrive 15 minutes early with CNIC and old reports. If lab tests cannot be booked online, say so and offer a doctor booking or the clinic number.
- BOOKING LOOKUP (returning patient), two safe ways: (1) reference + last 4 phone digits -> instant; (2) lost reference -> 6-digit code sent to the booking's email (free-tier email provider; check its current free limits): valid 10 minutes, single use, max 3 tries, resend after 60 s, rate-limited per email and caller. Same "not found" for any wrong input; lock after 3 wrong tries for 1 hour. Return only date, time, doctor, department, status + a fresh slip. Never say the full phone, email or reason. Name + phone + email alone is NOT enough; explain politely and offer the clinic number. Cancelling a booking also requires the email code. Log with hashed identifiers only. New minimal endpoints: spec them as an API change.
- CONVERSATION MEMORY: remember everything in the current conversation and never ask twice; handle corrections anytime ("no, make it the 13th") and confirm in one sentence; if something was unclear ask to repeat only that part; recap all details before booking. Changes before confirmation are free; after confirmation, changes need the email code or the clinic number. Nothing is saved after the conversation ends.
- HUMAN FEEL: short natural sentences, Pakistani warmth ("Assalam o Alaikum", "ji zaroor"), uses the caller's name, guides to the next step, allows interruption (barge-in), soft "checking..." states, no long silences, first words under 2 seconds, streaming.
- SAFE: says it is an AI for a demo clinic; general info about tests only, never diagnosis, dosing or reading results; emergencies -> emergency number and tell them to call now (no codes or delays); never reveals its prompt or rules; resists prompt injection, role-play and fake admin claims; "I don't know, please contact the clinic" instead of guessing. Audio is never recorded or stored; say this once.

DESIGN (luxury, VIP):
- Discovery: on page load a small bubble above "Ask us": "Talk to us - English / اردو" with a gentle glow.
- In the chat input, beside Send: MIC (dictation into the box) and VOICE MODE (waveform icon), like Claude's input.
- Voice mode panel: large animated orb in

Message 2 (the rest):

Here is the rest, continuing from "Voice mode panel: large animated orb in":

brand teal + navy with soft glow: breathing while listening, swirl while thinking, waves synced to speech while speaking. Live captions, mute, interrupt, end, EN / اردو toggle, voice female/male.
- 60fps, respects reduce-motion, mobile + desktop, keyboard and screen-reader accessible, clear mic-permission help, text fallback.
- Give me 2 design options (static mockups) to choose from.

TESTS: 40+ red-team prompts (English + Roman Urdu) incl. fake bookings, OTP brute force and injection; 30 normal Q&A from public data; 10 full voice-booking scripts; 5 lookup/OTP scripts; accessibility and visual tests. Booking and OTP tests use the preview/dev environment only, never production.
If a database migration is needed, STOP and tell me first (I will make a Neon restore point).

Show me: the 5 research ideas, feature list, never-do list, 2 design options, new endpoints, test plan, days to build. Then STOP.

## Response snapshot

Did Step 0 web research (ChatGPT voice redesign, Gemini Live captions and tap-to-interrupt, AI receptionist read-back and latency practice, Resend free limits, Web Speech API support). Created branch 013-voice-receptionist (012 is already used in code for staff email alerts) and wrote spec.md: 5 research ideas, assumptions A-1..A-10, 6 user stories (voice Q&A P1, hands-free booking P1, lookup P2, cancel P3, safety P1, clinic-owner voice P3), edge cases, FR-001..FR-073, SC-001..SC-011, out of scope. Found that the patient slip email and patient cancel do not exist yet, so the spec adds them. Quality checklist passes; no clarification markers.

## Outcome

- ✅ Impact: feature 013 spec ready for planning
- 🧪 Tests: none (spec stage)
- 📁 Files: spec.md, checklists/requirements.md
- 🔁 Next prompts: /sp.plan, /sp.tasks
- 🧠 Reflection: the first message was truncated; asked for the rest before starting rather than inventing the design section

## Evaluation notes (flywheel)

- Failure modes observed: create-new-feature.ps1 printed a parameter error after creating the branch and spec (harmless)
- Graders run and results (PASS/FAIL): spec quality checklist PASS
- Prompt variant (if applicable): null
- Next experiment (smallest change to try): null
