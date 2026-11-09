# Results: Voice Receptionist, Phase 1 (013)

Date: 2026-11-08 · Branch `013-voice-receptionist` · Status: **Phase 1 built, flag OFF by default, draft PR, not merged**

Owner decisions applied (2026-11-08): design **B (Concierge) with A's large glowing orb**; QR (not barcode) on the booked card; the summary card **inside** the chat panel; small grey text raised to AA; live captions under the orb; Phase 1 scope only. See the "Owner decisions" block at the end of [tasks.md](tasks.md).

## What was built
Discovery bubble · Mic dictation · Voice mode (orb with idle / listening / thinking / speaking, live captions, Mute, Interrupt, End, EN / اردو, Female / Male) · voice Q&A in English and Roman Urdu in both tabs · hands-free doctor booking with read-back and the "yes" gate · summary card · slip with QR and Download PDF · mic-permission help and a text fallback · all safety rules · the `VOICE_ENABLED` switch (default OFF).

No backend change. **No migration was created or run.** No new dependency.

## Test results
| Suite | Result |
|---|---|
| Whole unit suite (Vitest) | 132 files, **1,821 tests pass** |
| Voice unit tests (9 files) | **217 pass**: parsers, chunking, voice picker, session, booking dialog, widget |
| Red-team (English + Roman Urdu) | **56 prompts**, all pass; each also said mid-booking: 0 bookings |
| Normal Q&A from public data | **30**, all match the text assistant's facts; 3 "I don't know" cases |
| Voice booking scripts | **10**, all pass; 0 bookings without the caller's own yes |
| Browser tests (Playwright, `--workers=1`, desktop + mobile, mock API) | **voice: 20 pass** (booking end to end, keyboard, axe, blocked mic, no recognition, emergency, reduced motion, visual baselines) |
| Existing affected e2e (`assistant`, `a11y`, `home`) with the default build | **99 pass**, 5 flag-gated skips |
| Lint, typecheck | clean |

Booking tests ran against the **mock API / scripted routes only**, never production or the real preview database.

### Not run
- **Real devices and real voices** (sound, accents, echo): `frontend/tests/voice/manual-checklist.md` is ready for Shuaib to run on a preview build.
- **Lookup / code scripts (5)** and backend tests: Phase 2 (no backend change here).
- **Linux visual baselines** for the new voice screens: only `-win32` baselines exist. The voice specs skip when the flags are off, which is how CI builds, so CI is unaffected. Generate Linux ones with the `update-linux-baselines` workflow when voice is added to CI.

## Differences from the plan (all small)
1. **Replies are English or Roman Urdu, spoken by an English voice.** Urdu-script phrase forms and Urdu voices (plan R3, task T016) move to Phase 2. Listening in Urdu works (`ur-PK`, with an Urdu-script word list mapped to the words the free engine knows). A caller who picks Urdu on a device with no Urdu voice is told once, politely.
2. **Nothing is stored in the browser.** The repo's guards forbid `localStorage` / `sessionStorage`, so the bubble's "once per visit" and the voice/language choice live in the page's memory (they reset on a full reload).
3. **The email question is honest:** email slips and booking recovery are Phase 2, so the assistant asks "Would you like to add an email? It's optional, and it's saved with your booking for when email slips are switched on."
4. **A spoken or tapped "yes" accepts the clinic's booking rules** (the booking route requires acceptance). The read-back says so and the summary card repeats it. Please confirm this wording.
5. **Dates and times follow the server clock** (from the slot list), not the phone's.
6. **Voice turn limit** is 24 a minute (typed chat stays at 8): a booking takes about ten turns.
7. The assistant says it cannot look up or change an existing booking or accept codes (fixed, safe reply with the clinic number) until Phase 2.

## Update after the owner's preview test (2026-11-08, Edge on Windows)
1. **Voice quality:** natural voices first (Aria / Jenny, Guy / Andrew, Uzma / Asad); Roman Urdu and greetings go to the Urdu voice, English to the English voice; rate 0.95; short pauses between sentences; emojis, symbols, money, day names, time zones and phone numbers rewritten for speech; a **Voice menu** to try the voices on the device.
2. **Microphone:** our own `Permissions-Policy: microphone=()` header **was blocking it** for everyone. It is now `microphone=(self)` when voice is on. The permission request is made inside the tap, and a refusal shows Edge and Windows steps.
3. **"Clinic" name:** the preview of this branch had no `CATALOG_API_URL` (the existing ones are scoped to other branches), so the site fell back to the neutral name and booking could not work. Set for this branch; documented in the runbook.
4. **Footer:** the text chat and voice mode now show the same line: "…This is a demo: please use sample details only, never your real personal or medical information."

## Phase 2 notes (not done on purpose)
- Email-code lookup, cancel, slip email, 4 endpoints, migration `0006_patient_access`, Resend: see ADR-0015 and `contracts/patient-access-api.md`.
- **Existing booking-view endpoint left as it is:** `GET /appointments/{reference}` shows the last 3 phone digits (`0300****567`) to anyone holding the reference, so "reference + last 4" adds about one digit. Decide how to tighten it when Phase 2 starts (it changes the confirmation page).
- Urdu-script replies and Urdu voices; adopt the voice safety guards in the text chat too; add the voice e2e to CI with the flags on.

## Update 2 (owner feedback, 2026-11-08): simple luxury voice, real booking, premium voice provider
- **Controls:** one big mic button (tap to talk / stop) and End; Mute, Interrupt, EN/Urdu, Female/Male and the Voice menu were removed. Barge-in is automatic. Status: Listening... / Thinking... / Speaking...
- **One voice per conversation** (warm female), chosen from the welcome's language; **automatic language**, never mixed in a reply. Short welcome, then it listens.
- **Booking conversation** for voice and typing: lab test explanation → offer → day, time, name, phone, email one at a time → read-back → yes → card with the website slip link. Lab tests are booked as a Pathology Lab visit with the test as the reason (same public booking route).
- **Edge listening error:** "Voice listening works most reliably in the Chrome browser… You can also type below." (The word "Google" is blocked by the repo's brand-name rule.)
- **Premium voice (Azure Speech F0), OFF until keys are added:** new API endpoint `POST /api/v1/speech/token` (rate-limited, key server-side), website route `/api/speech/token`, Speech SDK 1.53.0 (MIT, loaded only when used), CSP for the speech domains only when on, silent fallback to the browser voice. New dependency justified: browser recognition fails in Edge and on many phones; real-time neural speech needs the SDK's WebSocket protocol.
- **Tests:** 11 booking scripts (English booking, Roman Urdu booking, mid-way correction, misheard phone number, Edge error in session and e2e), Azure adapter with a fake SDK, token route, CSP, backend token endpoint (7). Unit 1,850 pass; voice e2e 26 pass; affected default e2e 101 pass.

## Update 3 (overnight 2026-11-08): a real receptionist, proven by a self-test as a patient
Owner's failed real test: repeated "Maaf kijiye, main samajh nahi saki", everything pushed to CBC, fever/allergy not understood, Urdu-script transcripts misread, the name in Urdu letters on the slip, slow and robotic.
- **Echo loop:** the mic is closed while the assistant speaks and opens about 0.4 s after; its own words heard back (also in Urdu letters, compared by consonants across sentences) are ignored; a tap on the mic still cuts in. It waits ~1.3 s for the patient to finish a sentence.
- **No repetition:** never the same sentence twice in a row (other wordings for every question; a sentence with the clinic's number is reworded, never dropped); at most one apology per conversation, then calm tappable choices.
- **Every department:** `src/voice/problems.ts` maps problems in English and Roman Urdu (with typos) only to departments we have, with doctors and fees; eyes, ears, bones and X-ray are said honestly as not offered (General Medicine offered for a first check-up). Health packages are offered and booked at the lab (card, read-back, slip). A problem word picks a lab test only when the patient talks about a test.
- **Urdu-script transcripts:** English words in Urdu letters (سیٹرڈے, زیرو ٹو تھری, ڈبل, پی ایم), Urdu numbers to 31, "نمبر" after a day = November; any unknown word is written in English letters.
- **Language on screen:** the chat (including the patient's own words) is always in English letters; a name heard in Urdu letters is written in English letters with "Spelling theek hai?"; the slip is English.
- **Receptionist flow:** greeting back, problem → department with fees → "Kya main aap ki booking kar doon?" (a plain "ji", "ok", "kar do" accepts the offer) → day/time from real slots → name → mobile → email → "Ji, main aap ki booking kar rahi hoon" + the card → haan or Confirm → Open my slip. Topic changes mid-way move the booking and keep the details. "Rehne do" stops it.
- **One voice:** one warm female voice for the whole call (Neerja, en-IN, when present: it reads English and Roman Urdu; otherwise Uzma for a Roman Urdu call or the English female voice).
- **AI brain (OFF):** `VOICE_BRAIN=gemini` + server-side `GEMINI_API_KEY`; only for turns the rules did not understand; tool calling over the public catalog, validated twice; never books; silent fallback. Runbook has the free-key steps.
- **Home page:** one "Ask us" button with the mic inside (bubble removed); hero cards moved clear of it with a gentle float (still with reduced motion). The Vercel Toolbar needs `VERCEL_PREVIEW_FEEDBACK_ENABLED=0` on Preview (owner step; not changed overnight).
- **Self-test:** 18 full conversations as a patient, browser and router; 7 product bugs found and fixed; final browser run 18/18. Report: `docs/reports/voice-selftest-2026-11-08.md`.

## Update 4 (owner's real Chrome test, 2026-11-09 morning)
- **Phone number by voice:** while the number is asked, Chrome's mishearings count as digits (Z/Thi/Ti/T/Fa/Faio/S/won/to/for/ate/nain, letters stuck to digits such as "Ffa2d6353", "double S" = 66) and Urdu digit words. Outside that question these words keep their ordinary meaning, and a run of only everyday words ("bata do") is not a number. "Zero Thi two four five two double S Fa Ti Fa" is read as 0324 5266535.
- **The mobile question shows a "Save number" field** (type tel, numeric keypad on phones, the website's own mobile rule checked before sending) and says "Aap number bol sakte hain ya neeche likh bhi sakte hain."
- **No loops:** a wrong try is read back once ("Maine 0325 263 53 suna. Mobile number 11 digits ka hota hai aur 03 se shuru hota hai."), the second asks calmly to type it in the box, never a third "say it again". A new try (starting with 0) or "phir se" replaces the partial number; digits that cannot begin a mobile number ("0032…") are never kept to pile on.
- **Memory:** a doctor the patient named ("Omar Sheikh") is kept for a later "booking karo", also after a side question, a "nahi" to the offer, or "booking karo bukhar hai" (same department). A different department named with the booking wins.
- **Greetings:** good morning / good mroning / good afternoon / good evening get the same greeting back; salam / AOA get "Wa alaikum assalam!"; then "How can I help you today?", never "what is the problem".
- **Hero:** the doctor's face is clear at 1920, 1366, 768 and 390 px. "Open Mon–Sat" on the photo's top-left edge, "Lab reports online" bottom-left, "Home sample collection" bottom-right, clear of the Ask us button (first screen, and on tablet/phone also with the whole photo scrolled into view). Gentle float kept, still with reduced motion. On desktop the photo is cropped a little from the bottom (desk only) so all of it fits a 1366 x 768 screen. Before/after: `docs/reports/hero-face-2026-11-09/`. Guarded by `frontend/tests/e2e/hero-face.spec.ts`.
- **Tests:** `tests/unit/voice-owner-test-2026-11-09.test.ts` (the owner's exact strings), a widget test for the field, two booking scripts updated to the new read-back wording.
