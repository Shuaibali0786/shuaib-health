---
id: 044
title: Owner Chrome test phone memory greeting hero
stage: green
date: 2026-11-09
surface: agent
model: claude-opus-5-5
feature: 013-voice-receptionist
branch: 013-voice-receptionist
user: Shuaibali0786
command: owner morning test fixes (pasted brief)
labels: ["voice", "phone-number", "memory", "greeting", "hero", "home-page"]
links:
  spec: specs/013-voice-receptionist/spec.md
  ticket: null
  adr: null
  pr: https://github.com/Shuaibali0786/shuaib-health/pull/39
files:
 - frontend/src/voice/parse/phone.ts
 - frontend/src/voice/bookingDialog.ts
 - frontend/src/voice/router.ts
 - frontend/src/components/agent/AssistantPanel.tsx
 - frontend/src/components/agent/voice/PhoneField.tsx
 - frontend/src/components/home/Hero.tsx
 - frontend/tests/unit/voice-owner-test-2026-11-09.test.ts
 - frontend/tests/unit/voice-widget.test.tsx
 - frontend/tests/voice/booking-scripts/05-unclear-digits-repeat-only-the-rest.json
 - frontend/tests/voice/booking-scripts/11-misheard-phone-number.json
 - frontend/tests/e2e/hero-face.spec.ts
 - docs/reports/hero-face-2026-11-09/
 - specs/013-voice-receptionist/results.md
tests:
 - frontend/tests/unit/voice-owner-test-2026-11-09.test.ts (23, the owner's exact misheard strings)
 - frontend/tests/unit/voice-widget.test.tsx (Save number field)
 - frontend/tests/e2e/hero-face.spec.ts (1920/1366/768/390, face and Ask us clear, reduced motion)
 - whole unit suite 139 files / 1,966 pass; lint and typecheck clean
 - e2e default build (desktop+mobile, --workers=1): 729 pass, 19 skip, 2 expected home visual-baseline diffs (not updated, saved for review)
 - e2e flags on: hero-face 5/5; voice.spec flaky on this PC (stuck Listening/Speaking), base commit fails the same test 3/3 too
---

## Prompt

Context: read specs/013-voice-receptionist/results.md and docs/reports/voice-selftest-2026-11-08.md first. Branch 013-voice-receptionist, PR #39. Do NOT merge, no production, no database changes.

My real test this morning (Chrome, real mic). Typed booking works perfectly. Fix these:

1. PHONE NUMBER BY VOICE FAILS. Chrome heard my digits as: "zero Thi two four five two double S Fa Ti Fa", "Z T2 Ffa2d6353", "Z T four Faio2d6", "zero zero three two four Faio2don". Partial digits also piled up wrongly ("0032 40245").
   - Add fuzzy spoken-digit mapping for English mishearings and Urdu words: zero/Z/sifar=0; one/won/ek=1; two/to/too/tu/do=2; three/thi/tree/ti/teen=3; four/for/fore/char/chaar=4; five/fa/faio/faiv/fife/paanch=5; six/S/siks/sics/chay/chhe=6; seven/saat=7; eight/ate/aath=8; nine/nain/nau=9; "double X" = XX; "triple X" = XXX.
   - When the agent asks for the mobile number, ALSO show a phone-number input field (numeric keypad on phones) inside the chat with a "Save number" button, and say "Aap number bol sakte hain ya neeche likh bhi sakte hain."
   - If the heard number is not 11 digits starting with 03, read back what was heard ONCE and offer the input field; never loop more than twice. "Phir se" or a new attempt clears the partial number.
2. MEMORY: if the patient already named a doctor (e.g. "Omar Sheikh") and then says "booking karo", keep that doctor; do not ask again.
3. GREETINGS: "good morning / good mroning / good evening / good afternoon / salam / AOA" get a warm greeting back, not "Could you tell me what the problem is".
4. HERO FIRST IMPRESSION (most important page): the "Lab reports online" card covers the doctor's face. The doctor's face must be fully visible on desktop, tablet and phone. Place "Open Mon-Sat" at the top-left edge of the photo, "Lab reports online" at the bottom-left edge, and "Home sample collection" at the bottom-right edge, all clear of the face and the Ask us button, with the gentle float animation (respect reduced motion). Take before/after screenshots at 1920, 1366, 768 and 390 px widths and show me.

Add tests for all of these (including my exact misheard phone strings). Run affected tests (--workers=1), push to PR #39, tell me when the preview is updated. Report short and STOP.

## Response snapshot

Fuzzy digit words only while the number is asked (letters split from digits, doubled letters squeezed, everyday words like "do"/"to" count only inside a number); the owner's first string now reads 0324 5266535. Mobile question shows a tel/numeric "Save number" field and the requested sentence; a failed try is read back once, the second asks to type, never a third "say again"; a new try or "phir se" replaces the partial; "0032…" is never kept. Last-named doctor remembered across side questions and a "nahi". Greeting-only turns (incl. "good mroning") answered warmly. Hero cards moved to the photo's edges at every width; desktop photo cropped from the bottom only so it fits 1366x768; new e2e checks the face and the Ask us button at 4 widths. Before/after in docs/reports/hero-face-2026-11-09/.

## Outcome

- ✅ Impact: phone by voice no longer loops; doctor kept; greetings warm; face visible on the hero at all widths.
- 🧪 Tests: see tests above.
- 📁 Files: see list above.
- 🔁 Next prompts: owner reviews the hero before/after and approves new home baselines; real-mic retest of the phone number in Chrome.
- 🧠 Reflection: `cn` does not merge classes, so Card's built-in `relative` silently beat `absolute`; the scroll check needed re-measuring because the header changes height on scroll.

## Evaluation notes (flywheel)

- Failure modes observed: CRLF files defeated multi-line string replacement in a Node edit script; smooth scrolling made a geometry test flaky until measured after settling.
- Graders run and results (PASS/FAIL): unit PASS; hero-face PASS.
- Prompt variant (if applicable): null
- Next experiment (smallest change to try): null
