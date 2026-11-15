# Quickstart: Voice Receptionist (013)

## Flags (all OFF by default; missing = off)

| Flag | Where | Turns on |
|---|---|---|
| `VOICE_ENABLED` | website (build time) | Discovery bubble, Mic and Voice mode buttons, voice Q&A and voice booking. Requires `ASSISTANT_ENABLED`. |
| `VOICE_LOOKUP_ENABLED` | website + backend | Lookup by reference + last 4, code lookup, cancel by code. |
| `PATIENT_EMAIL_ENABLED` | backend | Slip email after booking, code emails. Needs the existing `EMAIL_API_KEY` and a from-address. |
| `PATIENT_EMAIL_DAILY_CAP` | backend | Default 60 (Resend free tier: 100/day, 3,000/month, shared with clinic alerts). |
| `LOOKUP_CODE_CHANNEL` | backend | `email` (the only v1 value). |

Rollback: set the flag to off and redeploy (about 1–2 min), or use Vercel Instant Rollback (playbook rule 7).

## Migration gate

1. **STOP.** Tell Shuaib that `0006_patient_access` is ready. **Do not run it yet.**
2. Shuaib creates a Neon restore point (dev project first, then the prod `preview` branch).
3. With approval, apply it on the dev database: `uv run alembic upgrade head` (direct URL), then `alembic downgrade -1` and `upgrade head` again (round trip).
4. A pushed branch runs migrations on the **preview** database through `vercel_build.py`. Get approval before pushing the migration commit (memory rule).
5. Production waits for a separate approval at merge time.

Until step 2 is approved, build and test everything that does not need the table: the voice UI, the dialogs, voice booking (it uses existing endpoints), and the red-team set on Q&A.

## Run locally

```bash
cd backend && uv run uvicorn app.main:app --reload
cd frontend && VOICE_ENABLED=1 ASSISTANT_ENABLED=1 npm run dev
```

Open the site in **Edge** (best voices: Urdu "Uzma" and "Asad") and in Chrome. Allow the mic, then tap "Talk to us".

## Test runs

- Unit: `cd frontend && npm test -- voice`; `cd backend && uv run pytest tests -k "access or lookup or patient"`.
- Scripted conversations (no mic; a fake `SpeechPort` feeds the transcripts): `npm test -- voice-scripts`.
- E2E and a11y: `npx playwright test voice` (with a fake speech port injected, plus axe).
- Real-voice checks: a manual checklist in `tests/voice/manual-checklist.md`, on Edge (Windows), Chrome (Android) and Safari (iOS).
- **Booking and code tests only on preview or dev, never production.** The test helpers refuse to run when the API base URL is the production host.
