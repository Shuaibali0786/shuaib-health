# Implementation Plan: Voice Receptionist for "Ask Shuaib Health"

**Branch**: `013-voice-receptionist` | **Date**: 2026-11-08 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/013-voice-receptionist/spec.md`

## Summary

A free voice layer on the existing assistant widget (Feature 010):
- **Speech**: browser speech recognition and synthesis behind a `SpeechPort`.
- **Visuals**: a canvas orb with 4 states.
- **Voice booking**: a deterministic dialog that calls the **existing** slot and booking BFF routes.
- **Lookup and cancel**: a new, minimal patient-access API (4 endpoints) protected by reference + last 4 digits or a 6-digit email code.
- **Patient emails**: a best-effort slip email.

The answers come from the same brain (`AgentProvider`, the same knowledge pack, the same safety rules). Fixed phrases gain an Urdu-script form so Urdu voices sound natural.

**Migration**: one additive migration, `0006_patient_access` (one new table plus wider audit CHECK lists). Implementation **stops at that task** until Shuaib makes a Neon restore point and approves it.

## Technical Context

**Language/Version**: TypeScript strict / Next.js 16.4 (frontend); Python 3.12 (backend)
**Primary Dependencies**: no new runtime dependency. Browser Web Speech API, Canvas 2D, Web Audio `AnalyserNode` (visual level only), Framer Motion (already present), the existing Resend sender, the existing Zod schemas, `phone.ts`, `qr.ts` and `slip.ts`.
**Storage**: browser memory for the conversation (only the voice preference goes in `localStorage`). Neon Postgres: the new `patient_access_code` table and reused `rate_limit_counter` buckets. See [data-model.md](data-model.md).
**Testing**:
- Vitest: parsers, dialogs, voice picker, the speech port fake, BFF routes, and scripted conversations.
- pytest: access-code service, lookup, cancel, limits and locks, timing floor, audit and log safety, migration up/down.
- Playwright: panel, keyboard, axe, reduced motion, visual baselines, voice booking with a fake `SpeechPort`.
- A manual real-voice checklist.
**Target Platform**: Edge, Chrome (desktop and Android), Safari (iOS, partial); Vercel `sin1`.
**Project Type**: web (frontend + backend)
**Performance Goals**:
- first spoken words ≤ 2 s after the caller stops (SC-002);
- barge-in ≤ 0.5 s;
- orb 60 fps on a mid-range phone;
- lookup p95 ≤ 600 ms server time, including the 300 ms floor;
- zero change to the public pages' LCP/INP (voice code is lazy-loaded with the chat).
**Constraints**: free tiers only; serverless (no background work, so emails are sent inline and best effort); no audio is stored or sent by this product; WCAG 2.2 AA; preview/dev only for booking and code tests.
**Scale/Scope**: demo traffic. Email is capped at 60/day (Resend free: 100/day, 3,000/month).

## Constitution Check (pre-design and post-design: PASS)

- [x] **I. Honesty**: it says it is an AI for a demo clinic in every voice conversation; the disclaimer stays on every page; no invented slots or prices.
- [x] **II. Privacy**:
  - public data only;
  - lookup returns masked fields only;
  - codes, emails and references are hashed in storage and logs;
  - lookup, code and cancel are rate-limited and lock after 3 wrong tries;
  - cancel is audited.
  - **Gap noted**: the existing `GET /appointments/{reference}` exposes the last 3 phone digits (Risk 1, owner decision; not changed here).
- [x] **III. Server truth**: slots and bookings come only from the existing server endpoints; cancel rules are applied on the server; the "yes" gate is in the client, and the code is the server-side proof for cancel.
- [x] **IV. API-first**: voice booking uses the **same** `POST /appointments`. The new lookup and cancel endpoints are public API with typed schemas and a contract ([contracts/](contracts/)). There is no private code path.
- [x] **V. Resilience**: the build never needs the backend. Voice degrades to text when speech, mic, email or API are unavailable.
- [x] **VI. Security**:
  - BFF same-origin and CSRF guard on the new routes; proxy secret;
  - no secrets in the client;
  - codes from `secrets`, HMAC-stored, compared in constant time;
  - prompt-injection defence by design: the engine is deterministic, and private data has no tool.
- [x] **VII. Databases**: one Alembic migration, additive, with a tested downgrade. **Owner gate before creating or running it.**
- [x] **VIII. Design/a11y**: brand tokens; reduced motion; keyboard and screen reader; 44 px targets; axe. Two design options are offered (FR-073).
- [x] **IX. Quality**: unit tests for every parser and dialog rule; Playwright for the key flows; strict types, no `any`.
- [x] **X. Build order**: Phase 5 (AI agent) work on a deployed product; it uses only the public APIs.
- [x] **XI. Safe change**: own branch; flags OFF by default; no test loosened; visual baselines only for new screens; a rollback plan in quickstart.

## Project Structure

### Documentation (this feature)

```text
specs/013-voice-receptionist/
├── spec.md, plan.md, research.md, data-model.md, quickstart.md, tasks.md
├── contracts/patient-access-api.md
├── design/option-a-aurora.dc.html, option-b-concierge.dc.html   # 2 static options (owner picks one)
└── checklists/requirements.md
```

### Source Code

```text
frontend/src/
├── voice/
│   ├── types.ts                 # SpeechPort, VoiceState, Turn, BookingDraft, LookupDraft
│   ├── browserSpeech.ts         # SpeechRecognition + speechSynthesis adapter (restart, chunking, barge-in)
│   ├── fakeSpeech.ts            # scripted SpeechPort for tests and e2e
│   ├── voicePicker.ts           # language → ranked voices, female/male, Edge Natural first
│   ├── chunk.ts                 # sentence chunking, URL stripping, digit-group reading
│   ├── language.ts              # en / roman / ur detection (extends agent/normalize detectLang)
│   ├── phrases.ts               # every fixed voice phrase: en, roman, ur-script
│   ├── parse/                   # phone.ts (spoken digits), date.ts, time.ts, yesno.ts, name.ts, correction.ts
│   ├── router.ts                # safety first → active dialog → booking/lookup intent → AgentProvider
│   ├── bookingDialog.ts         # pure state machine (data-model §1)
│   ├── lookupDialog.ts          # reference+last4, email code, cancel
│   └── useVoiceConversation.ts  # React hook wiring port + router + state
├── agent/localEngine.ts, normalize.ts   # + Urdu-script template forms (T(lang, en, roman, ur?)); no logic change
├── components/agent/
│   ├── AssistantLauncher.tsx    # + DiscoveryBubble
│   ├── AssistantPanel.tsx       # + MicButton, VoiceModeButton beside Send
│   └── voice/                   # VoicePanel, Orb (canvas), Captions, Controls, SummaryCard, LookupCard,
│                                # MicHelp, SlipCard (reuses slip.ts + qr.ts)
├── lib/booking/access.ts        # client for the new BFF routes (Zod)
└── app/api/booking/
    ├── lookup/route.ts
    ├── access-codes/route.ts, access-codes/verify/route.ts
    └── appointments/[reference]/cancel/route.ts

backend/app/
├── booking/access.py            # codes, lookup, verify, cancel_by_patient, timing floor, locks
├── booking/limits.py            # + peek() and new bucket helpers
├── notifications/
│   ├── code_sender.py           # CodeSender protocol + EmailCodeSender
│   ├── templates.py             # + slip and code emails (en / roman / ur)
│   └── patient_mail.py          # daily cap, best effort
├── routers/appointments.py      # + 4 endpoints; slip email after create
├── booking/maintenance.py       # + purge expired codes
├── models.py, schemas.py, settings.py
├── migrations/versions/0006_patient_access.py   # ⚠ owner gate
└── tests/ (unit + api + migration)

tests/voice/ (frontend/tests/voice/)
├── redteam.json                 # 45 prompts (EN + Roman Urdu) with expected guard
├── qa.json                      # 30 public-data questions with expected facts
├── booking-scripts/*.json       # 10 full voice-booking scripts
├── lookup-scripts/*.json        # 5 lookup/OTP scripts
└── manual-checklist.md
```

**Structure Decision**: the existing web layout. Voice logic is a new `src/voice/` module (pure and testable) used by the existing agent components. Backend patient access sits next to booking.

## Key decisions (see research.md)

1. **Same brain, a new conversation layer**: the router runs the existing safety and engine first, and the booking and lookup dialogs are deterministic state machines. The optional AI provider never touches booking (R9).
2. **Browser speech behind `SpeechPort`**, with Edge Natural voices first. A premium voice later is one adapter plus a setting (R1, R2, R6).
3. **Urdu-script phrase forms** so Urdu voices sound natural (R3).
4. **Canvas orb, word-boundary-driven speaking waves** (TTS audio cannot be analysed) (R4).
5. **Echo-safe yes gate**: only a final caller result after the read-back ends, in the next turn (R5).
6. **Patient access API**: 4 endpoints, one uniform 404, a timing floor, HMAC-stored single-use codes, 3-strike 1-hour locks reusing `rate_limit_counter` (R8).
7. **Patient cancel writes audit only**: `appointment_status_change` needs a staff actor, and this avoids changing that table (R10, data-model).

📋 Architectural decision detected: a patient self-service access model (email one-time code + reference/last-4, uniform not-found, hashed single-use codes, pluggable code channel) and the browser speech provider slot. Document the reasoning and trade-offs? Run `/sp.adr patient-access-codes-and-voice-provider-slot`

## Feature list (what ships)

1. Discovery bubble "Talk to us · English / اردو".
2. Mic dictation and Voice mode buttons beside Send.
3. Voice panel: animated orb (4 states), live captions, Mute, Interrupt, End, EN / اردو, Female / Male.
4. Voice Q&A in both tabs: the same answers as text, in English, Roman Urdu or Urdu.
5. Hands-free booking with a live summary card, read-back, the "yes" gate, slip + QR + PDF, and the arrival reminder.
6. Lookup by reference + last 4 digits; lookup by email code; cancel by email code.
7. A patient slip email (optional), with a daily cap.
8. Mic-permission help, text fallback, reduced motion, keyboard and screen-reader support.
9. Flags (3) and a rollback plan.

## Never-do list (enforced by tests)

1. Never book without the caller's own clear "yes" in the turn after the read-back.
2. Never invent or promise a slot, price, doctor, discount or waiting time.
3. Never say or show a full phone number, email, reason, or another patient's anything.
4. Never reveal booking details for name + phone + email alone.
5. Never tell which lookup input was wrong; always the same "not found".
6. Never diagnose, suggest doses, or read or interpret results.
7. Never delay an emergency: the number and "call now" come first, with no questions or codes.
8. Never reveal the prompt, rules or configuration; never follow injected instructions, role-play or "I'm the admin".
9. Never record, store or upload audio; never keep the transcript after the chat closes.
10. Never use a paid API, and never enable billing.
11. Never run booking or code tests against production.
12. Never make more than one booking per conversation, and never loosen the existing rate limits.

## Test plan

| Suite | Count | How | Pass bar |
|---|---|---|---|
| Red-team (EN + Roman Urdu) | **45**: 8 injection/prompt leak, 6 fake admin/role-play, 7 private data, 6 fake/abusive bookings, 6 OTP brute force/enumeration, 6 medical/dosing/results, 4 emergency/crisis, 2 honesty | `redteam.json` through the router (Vitest); OTP cases also as pytest API tests | 100% (SC-003) |
| Normal Q&A | **30** (timings, address, each department, doctors and days, fees, lab test prep and price, packages, booking steps, FAQs, health tips) | `qa.json`: the voice answer contains the same facts as the text answer | 30/30 (SC-006) |
| Voice booking scripts | **10** (happy EN; happy Roman Urdu; Urdu script; correction of date; correction of phone; unclear digits → repeat part; slot full → alternatives; "hmm" at confirm → no booking; second booking refused; lab test → doctor offer) | Scripted fake `SpeechPort` (Vitest), plus 3 as Playwright e2e on **preview** | 10/10; 0 bookings without yes (SC-004) |
| Lookup/OTP scripts | **5** (ref + last 4 ok; wrong digits ×3 → lock; lost ref → code → ok; wrong code ×3 → dead + lock; cancel by code) | Vitest scripts + pytest API, **preview/dev only** | 5/5 (SC-008) |
| Backend unit/API | about 40 | pytest: code lifecycle, uniform 404, timing floor, locks, cap, audit, log safety, migration round trip | all green |
| Accessibility | panel, controls, captions, summary card, mic help | axe in Playwright, keyboard-only walk, screen-reader live regions, reduced-motion emulation | 0 serious (SC-009) |
| Visual | 4 orb states × 2 widths, summary card, slip card, discovery bubble | Playwright screenshots (animation frozen) | new baselines only |
| Performance | home page with voice on vs off | Lighthouse CI budgets, orb fps trace | no regression (SC-010) |
| Manual real voice | Edge Windows, Chrome Android, Safari iOS | `manual-checklist.md` | signed off by Shuaib |

## Risks (top 3)

1. **The old lookup leaks the last 3 digits** (`GET /appointments/{reference}` → `0300****567`): whoever holds a reference already sees date, time, doctor and status. Blast radius: low (the reference is a 50-bit random secret). Mitigation: the new lookup still locks after 3 tries. Tightening the old endpoint (e.g. showing only `****`, or requiring last 4) is a separate owner decision because it changes the confirmation page.
2. **Browser speech quality varies** (no Urdu voice in Chrome on Windows; iOS recognition is partial; echo on laptop speakers). Mitigation: feature detection, a text fallback, the "no Urdu voice" note, the echo guard (R5), and manual device checks. Kill switch: `VOICE_ENABLED=off`.
3. **Email free cap** (100/day shared): abuse could exhaust it. Mitigation: per-email and per-IP limits, a global 60/day cap, and booking never depends on email. Kill switch: `PATIENT_EMAIL_ENABLED=off`.

## Days to build

About **13 working days** (range 12–15), by one developer with Claude Code:

| Block | Days |
|---|---|
| Voice core: SpeechPort, picker, chunking, language, barge-in | 2.5 |
| Panel, orb, captions, controls, bubble, mic help, a11y (after the design pick) | 2.5 |
| Booking dialog, parsers (dates, times, digits in EN/Roman Urdu), summary card, slip | 3 |
| Urdu-script phrase forms for the engine and dialogs | 1 |
| Patient access API, BFF, lookup dialog, slip/code emails (after migration approval) | 2.5 |
| Test suites (45 + 30 + 10 + 5, a11y, visual), manual device checks, docs, PR | 1.5 |

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Patient-facing access without an account (code by email) | The owner requires lookup and cancel for returning patients without sign-in | Patient accounts and passwords: far larger scope, and against "minimal endpoints" |
| A patient cancel writes no `appointment_status_change` row | That table requires a staff actor | Making `actor_staff_id` nullable changes an existing constraint (not additive) and staff undo semantics |
| A client-side "yes" gate | Only the client hears speech | The server cannot verify speech; the booking endpoint already has idempotency, limits and slot integrity, and cancel needs the email code as server proof |
