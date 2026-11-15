---
id: 042
title: Owner test brain and booking fix
stage: green
date: 2026-11-08
surface: agent
model: claude-opus-5-5
feature: 013-voice-receptionist
branch: 013-voice-receptionist
user: Shuaibali0786
command: fix (owner real-test feedback)
labels: ["voice-agent","roman-urdu","understanding","booking","listening-language","regression-tests"]
links:
  spec: specs/013-voice-receptionist/spec.md
  ticket: null
  adr: null
  pr: https://github.com/Shuaibali0786/shuaib-health/pull/39
files:
 - frontend/src/voice/understand.ts (new: Roman Urdu / typo canonicalisation, fuzzy match, intent helpers)
 - frontend/src/voice/router.ts (canonical text, open-today, treatment, which-test, details before booking, book + test, options)
 - frontend/src/voice/bookingDialog.ts (lab test from any sentence, closed days, misses -> options, new wording)
 - frontend/src/voice/entities.ts (blood/khoon -> CBC, clinic day helpers, department words)
 - frontend/src/voice/session.ts (en-US first, switch to ur-PK on Roman Urdu or nonsense)
 - frontend/src/voice/language.ts, speechText.ts, parse/name.ts
 - frontend/src/agent/types.ts, knowledge.ts, normalize.ts, localEngine.ts (opening rules + time zone in the pack, Roman markers, allergy)
 - frontend/src/components/agent/AssistantPanel.tsx, voice/{Captions,VoiceMode,SummaryCard,BookedCard}.tsx
 - frontend/tests/voice/booking-scripts/12..20-*.json (owner messages), tests/unit/voice-*.test.ts*, tests/e2e/voice.spec.ts
tests:
 - vitest: 1,881 pass (all files)
 - playwright voice (desktop + mobile, workers=1): 32 pass, 2 skipped; assistant spec pass
---

## Prompt

My real test failed. Fix the assistant brain and booking flow properly, in one go. Use my real conversation (below) as regression tests.

ROOT PROBLEMS SEEN:
- Speech recognition listened in English, so Roman Urdu speech became nonsense ("CBC test karwana" -> "Qawwali", "blood test" -> "ladki dekh Khani").
- The brain only matches exact English keywords. Roman Urdu spellings and typos fail ("elaj/ilaj/ilaaj karwana", "test karwani", "bllod/blod/khoon", "boking", "kio").
- Booking got stuck repeating "Aap kis doctor ya department se milna chahte hain?" even after I said CBC/blood test.
- When I gave phone + email in one sentence, it answered with the clinic address.
- "Mujhe ilaaj karwana hai" got "Yeh mujhe nahi maloom".
- Duplicate welcome messages; the booking card offered Sunday although the clinic is closed on Sunday.

FIXES:
1. LISTENING LANGUAGE: start recognition in en-US; if the transcript looks like Urdu/Roman Urdu or confidence is low, switch to ur-PK (Chrome supports it) and understand Urdu-script text too. Show what was heard so the patient can correct it.
2. ROBUST UNDERSTANDING (free, no paid API): add a Roman Urdu + English intent layer with synonyms, common misspellings and fuzzy matching. Intents: greeting, timings/open today, location, doctors, departments, test info, packages, fees, book, cancel/never mind, treatment/symptom, emergency, provide name/phone/email/date/time, yes/no, correction. Examples to support: ilaj/elaj/ilaaj/treatment, test/tast/test karwani, blood/blod/bllod/khoon/CBC, booking/boking/book karo/appointment, haan/ha/ji/yes, nahi/no.
3. TREATMENT / SYMPTOM: "Mujhe ilaaj karwana hai" -> ask kindly what problem, and suggest the right department/doctor from public data (general guidance only, no diagnosis), e.g. fever -> General Medicine, teeth -> Dental, skin/allergy -> Dermatology, blood test -> Pathology Lab.
4. BOOKING STATE MACHINE (never stuck):
   - If a test is named (CBC/blood), set department = Pathology Lab and doctor automatically; do not ask again.
   - Extract any slot from ANY sentence: phone (Pakistani formats, spaces, spoken digits), email (incl. spoken "at the rate", "gmail dot com"), name, date ("aaj/kal/parson", weekdays), time.
   - Only offer real open days and free slots (never Sunday or closed hours); say the clinic is closed today if asked.
   - If the patient doesn't answer the asked item clearly twice, show 2-4 tappable options (e.g. next 3 free slots) instead of repeating.
   - Say "Ji, main aap ki booking kar rahi hoon, bas ek minute" while collecting; then show the filled card -> "Please check, then say haan or tap Confirm" -> book -> "Open my slip" button -> "Slip download karke mobile mein save karein aur clinic aate waqt saath laayein."
   - "Never mind / rehne do" cancels cleanly.
5. SPEECH OUTPUT: never read URLs, link lists, markdown or "(sample price)" aloud; speak short, clean sentences; the links stay as buttons in the chat. Remove the duplicate welcome.
6. REGRESSION TESTS: add my exact messages below as automated tests (typed and as voice transcripts) and make each lead to the right answer or the next booking step: "hay Mujhe CBC ki test karwani Kya Meri booking kar sakti ho", "mujhy elaj karwana hia", "mujhy test karwani hia", "bllod ki", "boking karo blod ki test karnekiay", "kia aaj clenic off hia", "are booking karo blood Khooni", "Mera phone number 0324 5211332 aur email share@gmail.com hai", "yaar main aapko bol raha hun booking kyon nahin kar rahi ho". Plus 3 full end-to-end bookings (English, Roman Urdu typed, Roman Urdu voice) that reach the slip.

Run affected tests (--workers=1), push to PR #39, tell me when the preview is updated. Do NOT merge. Report short and STOP.

## Response snapshot

- Added `understand.ts`: one canonical spelling per word (closed variant list + one-letter fuzzy match on key words; digits, emails and names untouched), plus intent helpers (treatment, test wanted, open today, booking asked, frustration).
- Router: canonical text first; safety guards run on both the original and the canonical text. New answers: clinic open/closed today from the real opening rules; "ilaaj" asks the problem with department choices; "test karwani" asks which test; "blood/khoon" means CBC; booking + test books the lab straight away; phone/email before a booking start one and keep them; a day/time right after an offer starts the booking.
- Booking dialog: a test named in any sentence sets the lab and its doctor; closed days are refused even before a doctor is chosen; two misses (or a frustrated turn) apologise and show tappable options; new opener, confirm and slip wording.
- Session: listens in en-US first; Roman Urdu or a nonsense transcript switches to ur-PK (once, then asks again); Urdu-script words added. Captions show "I heard ..." with a correction hint. Speech never reads links, markdown or "(sample price)". The spoken welcome replaces the written one.
- Tests: 9 new scripts with the owner's messages, voice-transcript versions, listening-language tests, widget tests (options, one welcome), e2e FLOW 2 (owner's sentence by voice) and FLOW 4 (Roman Urdu typed to the slip). 1,881 unit tests and 32 voice e2e pass.

## Outcome

- ✅ Impact: every owner message now reaches the right answer or the next booking step; no stuck loop.
- 🧪 Tests: vitest 1,881 pass; playwright voice 32 pass (desktop + mobile, workers=1).
- 📁 Files: see list above.
- 🔁 Next prompts: owner re-test in real Chrome with a real microphone (ur-PK recognition quality is browser-side).
- 🧠 Reflection: understanding fixes live in one canonicalisation layer, so new spellings are one line each.

## Evaluation notes (flywheel)

- Failure modes observed: a fuzzy fix turned "bookings" into "booking" and hid a privacy guard; fixed by guarding both texts and skipping plurals.
- Graders run and results (PASS/FAIL): PASS (unit, e2e, lint, typecheck).
- Prompt variant (if applicable): none
- Next experiment (smallest change to try): log unknown voice turns (locally, no audio) to grow the variant list.
