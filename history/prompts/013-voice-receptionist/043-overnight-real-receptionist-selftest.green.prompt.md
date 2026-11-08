---
id: 043
title: Overnight real receptionist and patient self-test
stage: green
date: 2026-11-08
surface: agent
model: claude-opus-5-5
feature: 013-voice-receptionist
branch: 013-voice-receptionist
user: Shuaibali0786
command: overnight work (pasted brief)
labels: ["voice", "echo", "roman-urdu", "urdu-script", "self-test", "gemini", "home-page"]
links:
  spec: specs/013-voice-receptionist/spec.md
  ticket: null
  adr: null
  pr: https://github.com/Shuaibali0786/shuaib-health/pull/39
files:
 - frontend/src/voice/session.ts
 - frontend/src/voice/router.ts
 - frontend/src/voice/bookingDialog.ts
 - frontend/src/voice/language.ts
 - frontend/src/voice/problems.ts
 - frontend/src/voice/entities.ts
 - frontend/src/voice/brain.ts
 - frontend/src/lib/voiceBrainGemini.ts
 - frontend/src/lib/demo.ts
 - frontend/src/app/api/voice/brain/route.ts
 - frontend/src/app/(site)/book-appointment/confirmed/[reference]/page.tsx
 - frontend/src/app/(site)/layout.tsx
 - frontend/src/app/(site)/site.css
 - frontend/src/components/agent/AssistantLauncher.tsx
 - frontend/src/components/agent/AssistantPanel.tsx
 - frontend/src/components/agent/voice/BookedCard.tsx
 - frontend/src/components/agent/voice/SummaryCard.tsx
 - frontend/src/components/home/Hero.tsx
 - frontend/.env.example
 - docs/runbooks/voice-receptionist.md
 - docs/reports/voice-selftest-2026-11-08.md
 - docs/reports/hero-baseline-diff-2026-11-08/
 - specs/013-voice-receptionist/results.md
tests:
 - frontend/tests/e2e/voice-selftest.spec.ts (browser, 18/18 on final code)
 - frontend/tests/unit/voice-selftest-conversations.test.ts (18/18)
 - frontend/tests/unit/voice-selftest-regressions.test.ts
 - frontend/tests/unit/voice-brain.test.ts
 - frontend/tests/unit/voice-session.test.ts, voice-language-voice.test.ts, voice-widget.test.tsx, voice-qa.test.ts (updated)
 - frontend/tests/e2e/voice.spec.ts, voice-visual.spec.ts (updated)
 - whole unit suite 1,942 pass; voice e2e (flags on, desktop) 34 pass; default affected e2e 310 pass, 1 expected visual diff
---

## Prompt

OVERNIGHT WORK. I am asleep and cannot approve anything.
HARD RULES: work only on branch 013-voice-receptionist / PR #39. Do NOT merge, do NOT touch production or any Neon database, no migrations, no secrets in code. Push to PR #39 at the end.

CONTEXT: read specs/013-voice-receptionist/ (spec, plan, tasks, results.md) and docs/runbooks/voice-receptionist.md first.

GOAL: the voice receptionist must feel like a REAL, warm, luxury clinic receptionist. My real tests failed: it repeated "Maaf kijiye, main samajh nahi saki" again and again, pushed everything to CBC, did not understand fever/allergy/other problems, misread Urdu-script transcripts, wrote my name in Urdu script on the slip, and felt slow and robotic. Patients and clients will leave if this happens. Fix it properly, then PROVE it by testing it yourself as a patient.

PART 1 - FIX
1. ECHO LOOP: the mic hears the assistant's own voice ("Maaf kijiye" came back as "معاف کیجیے"). Never listen while the assistant speaks; ignore transcripts matching its recent speech; resume listening after it finishes.
2. NO REPETITION: never say the same sentence twice in a row; apologise at most once, then show tappable choices and wait calmly. Vary phrasing.
3. ALL TREATMENTS, NOT ONLY CBC: read our catalog and support EVERY department, doctor, test and package we have. Understand problems in English and Roman Urdu with misspellings (bukhar/fever, allergy, khansi/cough, zukam, sar dard, daant dard/daant ki safai, skin/khaarish/daane, pet dard, sugar/diabetes, BP, dil/heart, pregnancy, bachon ka doctor, aankh, kaan, haddi/joint, blood test, x-ray...). Map each only to departments/doctors/tests that exist in our data; never diagnose or suggest medicine. If unclear, ask kindly what the problem is.
4. URDU-SCRIPT TRANSCRIPTS: understand English words written in Urdu script and spoken numbers (سیٹرڈے, فرائیڈے, منڈے..., زیرو ٹو تھری فور فائیو..., ڈبل, پی ایم/اے ایم, "نمبر" after a date = November).
5. LANGUAGE ON SCREEN: chat text is ALWAYS Roman Urdu or English, never Urdu script. Transliterate names to English letters (شعیب علی -> Shuaib Ali) and ask "Spelling theek hai?". The slip is ALWAYS fully English.
6. RECEPTIONIST FLOW: greet warmly -> understand the problem -> suggest the right doctor/department with fee from our data -> "Kya main aap ki booking kar doon?" -> ask ONE item at a time: day/time (real free slots, closed days refused), name, mobile, email (optional) -> "Ji, main aap ki booking kar rahi hoon" -> show the filled card -> "Please check, then say haan or tap Confirm" -> book -> "Open my slip" button -> "Slip download karke mobile mein save karein aur clinic aate waqt saath laayein." Topic changes mid-way are understood. Patience: wait for the patient to finish speaking.
7. SPEECH: one warm female voice for the whole call, short clean sentences, never read links/markdown/"(sample price)".
8. AI BRAIN READY (OFF): add an optional Google Gemini free-tier brain behind VOICE_BRAIN=gemini (key server-side as GEMINI_API_KEY, tool calling over our public data, booking still done only by our code after Confirm, same safety rules, silent fallback to the rule brain). It stays OFF tonight; tell me in the morning exactly how to create the free key and where to put it.
9. HOME PAGE: hero cards ("Open Mon-Sat", "Lab reports online", "Home sample collection") must not overlap the chat button; give them a gentle up-down floating animation (respect reduced motion). Remove the separate "Talk to us - English / اردو" bubble; keep ONE "Ask us" button with the mic clearly inside. Disable the Vercel Toolbar on previews and fix its CSP warning.

PART 2 - TEST IT YOURSELF AS A PATIENT (most important)
Run at least 15 full scripted conversations end to end in the browser (typed and as voice transcripts, incl. Urdu-script transcripts and the echo case), covering every department we have, for example:
- "Assalam o Alaikum, mujhe bukhar hai, ilaaj karwana hai" -> General Medicine -> slip
- "Mujhe allergy hai" / "skin pe daane hain" -> right department -> slip
- "Daant ki safai karwani hai" -> Dental -> slip
- "I need a blood test" (English) -> CBC -> slip
- one heart/BP, one child, one package, one "aaj clinic khula hai?", one mid-way topic change, one wrong phone corrected, one "rehne do" cancel, one emergency ("seene mein dard") -> emergency number, one injection attempt -> refused.
For each, check: no repeated sentence, max one apology, right department, real slot, English slip, Roman Urdu chat, no stuck state, no console errors.
Fix every failure and RE-RUN until all pass. Save every conversation transcript to docs/reports/voice-selftest-2026-11-08.md (what the patient said, what the assistant said, PASS/FAIL, what you fixed).

PART 3 - FINISH
Run all affected tests (Playwright --workers=1), push to PR #39, and write a short morning report: what you fixed, the self-test results table, anything you could NOT verify (e.g. real microphone / real audio quality), and exactly what I should test first in Chrome. Then STOP.

## Response snapshot

Fixed all 9 Part 1 items in code (mic closed while speaking + Urdu-aware echo filter + end-of-turn wait; no-repeat/one-apology polish; problem lexicon over the catalog with honest "not offered"; packages bookable; Urdu-script English words, numbers, نمبر=November, name transliteration with spelling check; one voice; Gemini brain OFF behind VOICE_BRAIN; single Ask us button with mic, hero cards moved and floating). Ran 18 patient conversations in the browser and through the router over 7 rounds; found and fixed 7 product bugs; final browser run 18/18. Vercel Toolbar env var could not be set (permission denied) and is documented. Home desktop visual baseline intentionally not updated (playbook rule 5); diff saved for review. Pushed 3 commits to PR #39.

## Outcome

- ✅ Impact: voice receptionist behaves like a receptionist across all 7 departments and 5 packages; echo loop and repetition fixed.
- 🧪 Tests: unit 1,942 pass; voice e2e 34 pass; default affected e2e 310 pass + 1 intended visual diff; browser self-test 18/18.
- 📁 Files: see list above.
- 🔁 Next prompts: owner reviews hero baseline diff then regenerate win32 + Linux baselines; set VERCEL_PREVIEW_FEEDBACK_ENABLED=0; real-mic test in Chrome.
- 🧠 Reflection: reading the transcripts by eye caught tone bugs the automatic checks missed.

## Evaluation notes (flywheel)

- Failure modes observed: a doctor's first name inside an email changed the doctor; a symptom word matched a lab test name; duplicated text skewed language detection; PowerShell Get-Content/Set-Content corrupted Urdu text once (repaired).
- Graders run and results (PASS/FAIL): browser self-test PASS 18/18; unit PASS.
- Prompt variant (if applicable): none
- Next experiment (smallest change to try): run the self-test on the mobile project and with a real microphone in Chrome.
