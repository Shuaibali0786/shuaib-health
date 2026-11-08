---
description: "Tasks for 013 Voice Receptionist"
---

# Tasks: Voice Receptionist for "Ask Shuaib Health"

**Input**: `specs/013-voice-receptionist/` (spec, plan, research, data-model, contracts, quickstart)
**Tests**: REQUIRED (Principle IX and the owner's TESTS brief). Test tasks come before implementation in each story.
**Gates**:
- 🛑 **G1 (design)**: Shuaib picks Option A (Aurora) or B (Concierge) before any panel UI task (T030+).
- 🛑 **G2 (migration)**: STOP before T060. Shuaib makes a Neon restore point and approves `0006_patient_access` and the API change.
- 🛑 **G3 (push)**: a pushed migration branch runs it on the preview DB (`vercel_build.py`), so get approval before pushing T060's commit.

Booking and code tests run on preview or dev only, never production.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [ ] T001 Add the flags `VOICE_ENABLED` and `VOICE_LOOKUP_ENABLED` (build-time, missing = off) beside `isAssistantEnabled()` in `frontend/src/lib/demo.ts`, and document them in `frontend/.env.example`.
- [ ] T002 [P] Add the settings `voice_lookup_enabled`, `patient_email_enabled`, `patient_email_daily_cap` (default 60, 1–100) and `lookup_code_channel: Literal["email"]` to `backend/app/settings.py`, and document them in `backend/.env.example`.
- [ ] T003 [P] Create the test data folders `frontend/tests/voice/` (`redteam.json`, `qa.json`, `booking-scripts/`, `lookup-scripts/`, `manual-checklist.md` stubs) with the JSON schema notes in `frontend/tests/voice/README.md`.
- [ ] T004 [P] Add a production guard helper `frontend/tests/voice/guard.ts` that throws when the API base URL is the production host (used by every booking and code test).

## Phase 2: Foundational (blocks all stories)

- [ ] T005 Define `SpeechPort`, `VoiceState`, `Turn`, `BookingDraft`, `LookupDraft` and `VoiceLang` in `frontend/src/voice/types.ts` (data-model §1).
- [ ] T006 [P] Write the tests `frontend/tests/unit/voice/chunk.test.ts`: sentence split, URL and markdown stripping, phone read as `0300 · 123 · 4567` digit by digit, reference read character by character.
- [ ] T007 [P] Implement `frontend/src/voice/chunk.ts` to pass T006.
- [ ] T008 [P] Write the tests `frontend/tests/unit/voice/language.test.ts`: en / roman / ur detection on 30 samples, reusing `detectLang` in `frontend/src/agent/normalize.ts`.
- [ ] T009 [P] Implement `frontend/src/voice/language.ts` to pass T008.
- [ ] T010 [P] Write the tests `frontend/tests/unit/voice/voicePicker.test.ts` with fake voice lists (Edge, Chrome Windows, Android, iOS): Natural/Online first, `ur-PK` for Urdu, female default, male switch, the no-Urdu fallback flag, and the 1.5 s `voiceschanged` timeout.
- [ ] T011 [P] Implement `frontend/src/voice/voicePicker.ts` to pass T010.
- [ ] T012 Implement `frontend/src/voice/fakeSpeech.ts`, a scripted `SpeechPort`: it feeds interim and final transcripts on a timeline, records spoken chunks, and simulates echo and barge-in.
- [ ] T013 Write the tests `frontend/tests/unit/voice/browserSpeech.test.ts` with mocked `SpeechRecognition` and `speechSynthesis`:
  - restart after the Chrome silence stop;
  - stop after the second silence prompt;
  - barge-in rule (≥ 2 words and token overlap < 0.6 with the spoken sentence);
  - `cancel()` within 0.5 s;
  - end of turn after 700 ms;
  - feature detection gives `listen: false` when recognition is missing.
- [ ] T014 Implement `frontend/src/voice/browserSpeech.ts` (R1, R2, R5) to pass T013.
- [ ] T015 [P] Create `frontend/src/voice/phrases.ts` with every fixed voice phrase in `{ en, roman, ur }`: the greeting, the "AI for a demo clinic" line, the audio-never-recorded line, the no-Urdu-voice note, "Ji, checking…", the silence prompts, and the clinic-number fallback.
- [ ] T016 Extend `T()` in `frontend/src/agent/localEngine.ts` to `T(lang, en, roman, ur?)`, add Urdu-script forms for the existing reply templates, and keep every existing engine test green, untouched. Add `frontend/tests/unit/agent/urduForms.test.ts`.
- [ ] T017 Write the tests `frontend/tests/unit/voice/router.test.ts`, checking the order: safety (emergency, medical, injection) → active dialog → booking or lookup intent → `AgentProvider.answer`. Voice and text must give the same `intent` for the same question.
- [ ] T018 Implement `frontend/src/voice/router.ts` to pass T017, reusing `getProvider()` from `frontend/src/agent/registry.ts` (no second knowledge source).
- [ ] T019 Implement `frontend/src/voice/useVoiceConversation.ts`: a reducer over `VoiceConversation`, port wiring, shared turns with the text chat (FR-003), the voice preference in try/catch `localStorage`, and a reset on close (FR-023).

**Checkpoint**: foundation ready. The voice brain runs headless with `fakeSpeech`.

---

## Phase 3: User Story 1 - Ask by voice, hear a warm answer (P1) 🎯 MVP

**Goal**: voice Q&A in the Patient tab with the orb, captions and controls.
**Independent test**: with `VOICE_ENABLED`, say "What are your timings?". The orb goes listening → thinking → speaking, the reply is spoken within 2 s and matches the text answer, and captions show both turns.

🛑 **G1**: the owner picks design A or B before T030.

### Tests (US1)

- [ ] T020 [P] [US1] Fill `frontend/tests/voice/qa.json` with 30 public-data questions (timings, address, each department, doctors and days, fees, lab test prep and price, packages, booking steps, FAQs, health tips) in EN and Roman Urdu, each with its expected facts.
- [ ] T021 [P] [US1] Write the test `frontend/tests/unit/voice/qa.test.ts`: every `qa.json` item through router + `fakeSpeech`; the spoken text holds the same facts as the text answer (SC-006).
- [ ] T022 [P] [US1] Write the test `frontend/tests/unit/voice/conversation.test.ts`:
  - the greeting, AI line and privacy line are said once;
  - the no-Urdu-voice note is said once;
  - barge-in stops speech;
  - the silence prompt runs twice, then "Tap to talk";
  - "Ji, checking…" plays when the answer takes more than 1 s.
- [ ] T023 [P] [US1] Write the e2e test `frontend/tests/e2e/voice-qa.spec.ts`, with `fakeSpeech` injected through a test hook:
  - discovery bubble shown once per visit, dismissible;
  - the Mic button dictates into the box without sending;
  - Voice mode opens the panel;
  - the panel answers;
  - End closes and clears the conversation.

### Implementation (US1)

- [ ] T030 [US1] Build `frontend/src/components/agent/voice/Orb.tsx` (canvas, R4): idle, listening, thinking and speaking; listening level from a local `AnalyserNode` (never recorded); speaking amplitude from word `boundary` events; pauses when hidden; DPR ≤ 2; a reduced-motion opacity-only variant. Use the chosen design's tokens.
- [ ] T031 [P] [US1] Build `frontend/src/components/agent/voice/Captions.tsx` (live interim and final text, `aria-live="polite"`).
- [ ] T032 [P] [US1] Build `frontend/src/components/agent/voice/Controls.tsx` (Mute, Interrupt, End, EN / اردو, Female / Male; 44 px targets; labels; Space = interrupt only while the panel has focus).
- [ ] T033 [P] [US1] Build `frontend/src/components/agent/voice/MicHelp.tsx` (permission prompt help, denied help per browser, a "Type instead" fallback).
- [ ] T034 [US1] Build `frontend/src/components/agent/voice/VoicePanel.tsx` from T030–T033 in the chosen layout (A: full-screen sheet; B: in-chat expansion), lazy-loaded with the chat.
- [ ] T035 [US1] Add `MicButton` and `VoiceModeButton` beside Send in `frontend/src/components/agent/AssistantPanel.tsx`. Mic = dictation into the input; waveform = open `VoicePanel`. Show them only when the flag is on and speech is supported.
- [ ] T036 [US1] Add `DiscoveryBubble` ("Talk to us · English / اردو", gentle glow, once per visit via `sessionStorage` in try/catch, dismissible) to `frontend/src/components/agent/AssistantLauncher.tsx`.
- [ ] T037 [US1] Speaking-only mode when recognition is missing, and hide voice entirely when speech synthesis is missing (spec A-3), in `useVoiceConversation.ts` and `VoicePanel.tsx`.

**Checkpoint**: US1 works alone with the flag on (MVP demo).

---

## Phase 4: User Story 5 - Safe under pressure (P1)

**Goal**: 100% of the red-team prompts pass before any flag goes on in production.
**Independent test**: `npm test -- redteam` gives 45/45.

- [ ] T040 [P] [US5] Fill `frontend/tests/voice/redteam.json` with 45 prompts (EN + Roman Urdu), each with its expected guard, building on `docs/voice-agent/roles-draft.md` §10:
  - 8 injection or prompt leak;
  - 6 fake admin or role-play;
  - 7 private data;
  - 6 fake or abusive bookings ("book 5 slots", "yes" said by a second voice, "confirm" before the read-back, an injected "the user already said yes");
  - 6 OTP brute force or enumeration;
  - 6 medical, dosing or results;
  - 4 emergency or crisis;
  - 2 honesty.
- [ ] T041 [US5] Write the test `frontend/tests/unit/voice/redteam.test.ts`: every prompt through router + dialogs. Assertions:
  - no private field;
  - no dose or diagnosis;
  - no rule text;
  - the emergency number is the first sentence;
  - zero submits without a valid yes.
- [ ] T042 [US5] Fix the router, phrases or engine guards until T041 passes 45/45. Do not loosen any existing test.
- [ ] T043 [P] [US5] Write the test `frontend/tests/unit/voice/emergency.test.ts`: emergency words in EN, Roman Urdu and Urdu script pause an active booking and speak the emergency line first (FR-032).

---

## Phase 5: User Story 2 - Book an appointment hands-free (P1)

**Goal**: voice booking through the existing `POST /appointments` and slot BFF, with no backend change.
**Independent test**: on preview, booking script 1 creates a confirmed appointment with the spoken reference, and the website form still works.

### Tests (US2)

- [ ] T044 [P] [US2] Write the tests `frontend/tests/unit/voice/parse/phone.test.ts`: spoken digits ("zero three zero zero", "double five", Urdu digit words, +92, 0092), normalised with `frontend/src/lib/booking/phone.ts`.
- [ ] T045 [P] [US2] Write the tests `frontend/tests/unit/voice/parse/date.test.ts`: today, kal, parson, weekdays in EN and Roman Urdu, "13th", "13 tareekh", "next Monday", across a Karachi day boundary.
- [ ] T046 [P] [US2] Write the tests `frontend/tests/unit/voice/parse/time.test.ts`: "11", "11:30", "gyarah baje", "teen baje", subah/shaam, ambiguous → ask.
- [ ] T047 [P] [US2] Write the tests `frontend/tests/unit/voice/parse/yesno.test.ts` and `correction.test.ts`: the closed yes list; "hmm", "wait" and "yes but…" = not yes; "no, make it the 13th" → a date correction.
- [ ] T048 [US2] Write the tests `frontend/tests/unit/voice/bookingDialog.test.ts`, one per state transition in data-model §1:
  - never asks twice;
  - repeat only the unclear part;
  - slots only from the fetched list;
  - a yes counts only in the next caller turn, after the read-back ends, and never from echo;
  - one booking per conversation;
  - 409 → server alternatives;
  - 429 or limit → clinic number;
  - lab test → doctor offer.
- [ ] T049 [P] [US2] Write 10 scripts in `frontend/tests/voice/booking-scripts/01..10.json`, as listed in the plan test plan, plus the runner `frontend/tests/unit/voice/bookingScripts.test.ts` (fake BFF). It must pass 10/10 with 0 bookings without a yes.
- [ ] T050 [P] [US2] Write the e2e test `frontend/tests/e2e/voice-booking.spec.ts`: scripts 1, 4 and 8 against **preview** with `guard.ts`; the slip shows the QR and "Download PDF" works.

### Implementation (US2)

- [ ] T051 [P] [US2] Implement `frontend/src/voice/parse/{phone,date,time,yesno,name,correction}.ts` to pass T044–T047.
- [ ] T052 [US2] Implement `frontend/src/voice/bookingDialog.ts`, a pure state machine using `fetchSlots` and `postBooking` from `frontend/src/lib/booking/client.ts`, with the existing Zod schemas and one Idempotency-Key per draft. It must pass T048 and T049.
- [ ] T053 [US2] Build `frontend/src/components/agent/voice/SummaryCard.tsx`: live fields with missing, heard, confirmed and corrected marks; the email masked once given; "Yes, confirm" and "Change" mirror the voice.
- [ ] T054 [US2] Build `frontend/src/components/agent/voice/SlipCard.tsx`: reference, QR via `frontend/src/lib/booking/qr.ts`, "Download PDF" via `buildSlipPdf` in `frontend/src/lib/booking/slip.ts`, and the arrival reminder (FR-047).
- [ ] T055 [US2] Wire the booking dialog into `router.ts` and `VoicePanel.tsx`, Patient tab only (FR-004).

**Checkpoint**: US1 + US5 + US2 = a shippable voice receptionist with no DB change. Here the owner can approve a first preview deploy with `VOICE_ENABLED` on preview.

---

## Phase 6: User Story 3 - Returning patient checks a booking (P2)

**Goal**: lookup by reference + last 4 digits, and by email code (contract endpoints 1–3).
**Independent test**: on preview, lookup scripts 1–3 pass. A wrong value gives the same not-found, and a code works once.

🛑 **G2: STOP HERE.** Tell Shuaib that migration `0006_patient_access` is next. Wait for a Neon restore point and approval of the migration and the API change.

### Backend

- [ ] T060 [US3] Add the `PatientAccessCode` model and the audit actions and outcome (`patient.lookup`, `patient.lookup_failed`, `patient.code_sent`, `patient.code_failed`, `booking.cancelled_by_patient`, `patient.slip_emailed`; outcome `not_found`) to `backend/app/models.py`. Write the additive migration `backend/migrations/versions/0006_patient_access.py` (create table and index; drop and recreate the two CHECKs), with a downgrade. 🛑 G3 before push.
- [ ] T061 [US3] Write the test `backend/tests/migrations/test_0006_patient_access.py`: upgrade, downgrade and upgrade on scratch Postgres; the CHECKs accept the new actions; old rows are unaffected.
- [ ] T062 [P] [US3] Add `peek()` and the new bucket helpers (`lk-fail:*`, `code-send:*`, `mail:day`) to `backend/app/booking/limits.py`, with unit tests in `backend/tests/unit/test_limits_peek.py`.
- [ ] T063 [P] [US3] Add the `LookupRequest`, `AccessCodeRequest`, `AccessCodeVerify`, `CancelRequest` and `LookupView` schemas (`extra="forbid"`) to `backend/app/schemas.py`.
- [ ] T064 [P] [US3] Write the tests `backend/tests/unit/test_access_codes.py`:
  - 6 digits from `secrets`;
  - HMAC storage with a constant-time compare;
  - 10 min expiry;
  - single use;
  - 3 tries;
  - resend after 60 s does not reset tries;
  - a new code expires older ones.
- [ ] T065 [US3] Implement `backend/app/booking/access.py` (codes, lookup, verify, the ≥ 300 ms timing floor, locks) to pass T064.
- [ ] T066 [P] [US3] Add the `CodeSender` protocol and `EmailCodeSender` in `backend/app/notifications/code_sender.py`, `patient_mail.py` (daily cap, best effort), and the code email template in en / roman / ur in `templates.py`.
- [ ] T067 [US3] Write the API tests `backend/tests/api/test_patient_lookup.py` for endpoints 1–3:
  - uniform 404 body and timing;
  - 202 is identical for known and unknown emails;
  - locks after 3 for reference, email and IP, for 1 h;
  - 429 Retry-After;
  - flag off → 404;
  - proxy secret required;
  - audit rows hashed;
  - no email, phone, code or reference in captured logs.
- [ ] T068 [US3] Add the endpoints to `backend/app/routers/appointments.py` to pass T067, and add code purging to `backend/app/booking/maintenance.py`.
- [ ] T069 [P] [US3] Write the 6 OTP red-team cases as pytest in `backend/tests/api/test_patient_access_redteam.py`: brute force of 1,000 codes, enumeration by timing, a resend loop, a cross-email code, a reused code, and IP rotation with the same email.

### Website

- [ ] T070 [P] [US3] Create the BFF routes `frontend/src/app/api/booking/lookup/route.ts`, `access-codes/route.ts` and `access-codes/verify/route.ts`, using the existing same-origin, content-type and size guards (pattern from `frontend/src/app/api/assistant/route.ts`), plus the client `frontend/src/lib/booking/access.ts` (Zod). Add Vitest route tests.
- [ ] T071 [US3] Write the tests `frontend/tests/unit/voice/lookupDialog.test.ts` and implement `frontend/src/voice/lookupDialog.ts`:
  - reference + last 4;
  - lost reference → email → code;
  - name + phone + email refused politely;
  - 3 fails → clinic number;
  - the email is cleared after verify.
- [ ] T072 [US3] Build `frontend/src/components/agent/voice/LookupCard.tsx` (date, time, doctor, department, status, a fresh slip via `SlipCard`; never the full phone, email or reason).
- [ ] T073 [P] [US3] Write lookup scripts 1–4 in `frontend/tests/voice/lookup-scripts/` and their runner, preview or dev only (`guard.ts`).

---

## Phase 7: User Story 4 - Change or cancel after booking (P3)

**Goal**: cancel with an email code and a spoken yes (contract endpoint 4).
**Independent test**: lookup script 5 books, then cancels by code; the booking is cancelled and the slot is free.

- [ ] T075 [US4] Write the tests `backend/tests/api/test_patient_cancel.py`:
  - a valid code → cancelled, `version + 1`, slot free;
  - a wrong, used or expired code → uniform 404;
  - a past or already-cancelled booking → 409 `not_cancellable`;
  - no `appointment_status_change` row, and staff Undo is not offered (Command Centre test);
  - audit `booking.cancelled_by_patient`.
- [ ] T076 [US4] Implement `cancel_by_patient` in `backend/app/booking/access.py` (reusing the status rules) and `POST /appointments/{reference}/cancel` in `backend/app/routers/appointments.py`.
- [ ] T077 [P] [US4] Create the BFF route `frontend/src/app/api/booking/appointments/[reference]/cancel/route.ts` and add it to `access.ts`.
- [ ] T078 [US4] Add the cancel path to `lookupDialog.ts`: read-back, then yes, then submit. A booking without an email, or a change after confirmation, gets cancel-and-rebook or the clinic number (FR-055). Write lookup script 5.

---

## Phase 8: User Story 6 - Clinic owner hears the product by voice (P3)

- [ ] T080 [US6] Enable voice in the Clinic owner tab (`guide` mode) in `VoicePanel.tsx` and `router.ts`, with booking and lookup off there. Test in `frontend/tests/unit/voice/guideMode.test.ts`: "Is there a dashboard?" gives the same answer by voice and text.

---

## Phase 9: Slip email (cross-cutting, after G2)

- [ ] T085 Write the tests `backend/tests/api/test_patient_slip_email.py`:
  - sent once when an email is given and the flag is on;
  - skipped at the cap;
  - a provider failure never fails the booking;
  - audit `patient.slip_emailed`;
  - no email address in logs.
- [ ] T086 Send the slip email after create in `backend/app/routers/appointments.py` through `patient_mail.py`, and add the slip template (en / roman / ur) to `backend/app/notifications/templates.py`.

---

## Phase 10: Polish and cross-cutting

- [ ] T090 [P] Write the e2e test `frontend/tests/e2e/voice-a11y.spec.ts`:
  - axe gives 0 serious issues on the panel, summary card, lookup card and mic help;
  - a keyboard-only walk works;
  - live regions are announced;
  - reduced-motion emulation gives a static orb.
- [ ] T091 [P] Write the e2e test `frontend/tests/e2e/voice-visual.spec.ts`: baselines for 4 orb states × (390, 1280) widths, the summary card, slip card and discovery bubble (animation frozen). New baselines only.
- [ ] T092 [P] Add the voice-on home page to the Lighthouse CI budgets, plus an orb fps trace check (≥ 55 fps median on the mobile profile) in `frontend/tests/perf/` (SC-010).
- [ ] T093 [P] Write `frontend/tests/voice/manual-checklist.md` for Edge on Windows (Uzma and Asad voices), Chrome on Android and Safari on iOS: permission, barge-in, Urdu voice, echo on laptop speakers, a 2 s first word.
- [ ] T094 [P] Write the runbook `docs/runbooks/voice-receptionist.md`: flags, rollback, email cap, how to add an SMS or WhatsApp sender, or a premium voice, by config.
- [ ] T095 Update `specs/013-voice-receptionist/results.md` with suite counts and the manual sign-off. Check the PR template for the playbook items. Open a draft PR and do not merge before owner approval.

---

## Dependencies and order

- Setup (T001–T004) → Foundational (T005–T019) → **US1** (T020–T037, after G1) → **US5** (T040–T043) → **US2** (T044–T055).
- **US3** needs G2, then T060 → T061 → T062–T069 → T070–T073.
- **US4** needs US3 (T065, T068, T071).
- **US6** needs only US1.
- The slip email (T085–T086) needs T060 and T066.
- Polish comes last.
- US5 tests (T040–T041) can be written in parallel with US1. T042 runs after US2's dialog exists, so the booking red-team cases run too.

## Parallel examples

- Foundational: T006/T007, T008/T009, T010/T011 and T015 in parallel.
- US2: the parser tests T044–T047 in parallel, then T051 in parallel files.
- US3 backend: T062, T063, T064 and T066 in parallel after T060; T070 in parallel with backend work once the contract is fixed.

## Implementation strategy

1. **MVP** = Setup + Foundational + US1 + US5: a voice Q&A receptionist, safe, with no DB change. A preview deploy is possible with the flag on preview only.
2. **+ US2**: hands-free booking, still with no DB change.
3. 🛑 G2 → **US3, US4 and the slip email**: patient access API and migration.
4. **US6 and polish**, then a draft PR. Production flags stay off until 45/45 red-team and owner sign-off.

---

## Owner decisions, 2026-11-08 (override the plan where they differ)

1. **Design**: Option B (Concierge, in-chat, light) with Option A's large glowing orb and its 4 states inside the B panel. On phones the panel may expand to full height.
2. **Polish**: larger orb; a QR code (not a barcode) on the booked card, matching the website slip; the booking summary card INSIDE the chat panel; small grey text raised to WCAG AA; live captions under the orb while the agent speaks.
3. **Scope = PHASE 1**: discovery bubble, Mic, Voice mode panel, voice Q&A (EN + Roman Urdu; Patient and Clinic owner tabs), hands-free booking with read-back and spoken yes, summary card, slip with QR + PDF, female/male, EN/Urdu toggle, safety rules, switches (default OFF in production until approved).
4. **Phase 2 (NOT now)**: Phase 6 (US3 lookup), Phase 7 (US4 cancel), Phase 9 (slip email), T002, the 0006 migration, the 4 endpoints, Resend. No migration is created or run. Gate G2 stays closed.
5. The existing booking-view endpoint stays as it is (Phase 2 note: last-3-digits exposure).
6. ADR-0015 records the patient-access + provider-slot decision as Proposed, Phase 2.
