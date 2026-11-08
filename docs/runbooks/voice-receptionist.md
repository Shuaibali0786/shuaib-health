# Runbook: the voice receptionist (Feature 013, Phase 1)

Status: **built, OFF by default**. Production stays off until Shuaib approves. It costs **$0**: it uses the visitor's own browser for listening and speaking. No audio is recorded, stored or sent to any service this product controls.

## What Phase 1 is
- A glowing "Talk to us · English / اردو" bubble above "Ask us".
- Mic (dictation into the chat box) and Voice mode (the orb) beside Send.
- Voice Q&A in English and Roman Urdu, in the Patient and Clinic owner tabs, from the same free engine and public knowledge pack as the text chat.
- Hands-free **doctor booking** through the same public booking route as the website form: read-back, a spoken (or tapped) "yes", the slip with QR and Download PDF.
- Safety guards on every turn (emergencies first, no private data, no diagnosis or doses, no prompt reveal, no booking without the caller's own yes).

**No backend change and no migration.** Everything is in the website (`frontend/`).

## Not in Phase 1 (Phase 2, see ADR-0015)
Email-code lookup, cancel by voice, the slip email, the four patient-access endpoints and migration `0006_patient_access`. Until then the assistant says it cannot look up or change an existing booking and gives the clinic number.

## The switch
| Variable | Where | Meaning |
|---|---|---|
| `ASSISTANT_ENABLED` | website, build time | must already be `true` |
| `VOICE_ENABLED` | website, build time | `true` / `1` / `yes` / `on` turns voice on. Missing = off. |

Both are read at **build** time (like `ASSISTANT_ENABLED`), so change the value and **redeploy**.

### Turn on for the Vercel Preview only (to try it)
Vercel → `shuaib-health-web` → Settings → Environment Variables → add `VOICE_ENABLED=true` for **Preview** only → redeploy the preview. (Production is untouched.)

### Turn on in production (🔑 owner, after approval)
Add `VOICE_ENABLED=true` for **Production** and redeploy. First complete `frontend/tests/voice/manual-checklist.md` on a preview build.

### Roll back
Set `VOICE_ENABLED` to `false` (or remove it) and redeploy (about 1–2 minutes), or use Vercel **Instant Rollback**. The text chat is unaffected.

## How it works (for the next developer)
- `src/voice/session.ts`: one voice conversation (turn-taking, barge-in, echo guard, silence prompts, the "yes" gate). Framework-free, tested with a scripted speech port.
- `src/voice/router.ts`: safety guards first, then an active booking, then a new booking request, then the same `AgentProvider` as the text chat.
- `src/voice/safety.ts`: the guard patterns. `src/voice/bookingDialog.ts`: the booking state machine (pure; the network is injected).
- `src/voice/browserSpeech.ts`: the browser adapter. `src/voice/fakeSpeech.ts`: the scripted adapter for tests.
- `src/components/agent/voice/*`: the orb (`orbEngine.ts` draws, `Orb.tsx` mounts it), captions, controls, mic help, summary card, slip card.
- The booking uses `fetchSlots` and `postBooking` from `lib/booking/client.ts`: **the same endpoints and rules as the website form** (rate limits, idempotency, one active-booking cap). Nothing was added or loosened.

## Plugging in a paid provider later (by configuration)
- **Voice**: write another `SpeechPort` (see `src/voice/types.ts`), choose it where `createBrowserSpeech()` is called in `VoiceMode.tsx` and `useDictation.ts`. The conversation code does not change.
- **Codes by SMS or WhatsApp** (Phase 2): a new `CodeSender` on the backend, chosen by `LOOKUP_CODE_CHANNEL` (see ADR-0015 and `specs/013-voice-receptionist/contracts/patient-access-api.md`).

## Known limits
- Browser support: Edge and Chrome (desktop and Android) are best. Safari/iPhone recognition is partial. Firefox has none, so voice mode speaks only and asks people to type.
- Speech recognition in Chrome and Edge is done by the browser vendor's own service, so it needs an internet connection. The privacy line says "we never record or store your audio", which is true for this site.
- Replies are English or **Roman Urdu**, spoken by an English voice. Urdu-script replies with an Urdu voice are Phase 2.
- Dates and times are the clinic's days, taken from the server's slot list.

## Tests
`cd frontend && npx vitest run tests/unit/voice-*` (unit and scripted conversations), and
`ASSISTANT_ENABLED=true VOICE_ENABLED=true npx playwright test voice --workers=1` (browser, mock API, scripted Web Speech). Booking tests use the mock API, never production.
