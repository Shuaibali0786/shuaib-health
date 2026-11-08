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

## Phase 2 notes (not done on purpose)
- Email-code lookup, cancel, slip email, 4 endpoints, migration `0006_patient_access`, Resend: see ADR-0015 and `contracts/patient-access-api.md`.
- **Existing booking-view endpoint left as it is:** `GET /appointments/{reference}` shows the last 3 phone digits (`0300****567`) to anyone holding the reference, so "reference + last 4" adds about one digit. Decide how to tighten it when Phase 2 starts (it changes the confirmation page).
- Urdu-script replies and Urdu voices; adopt the voice safety guards in the text chat too; add the voice e2e to CI with the flags on.
