# Runbook: the voice receptionist (Feature 013, Phase 1)

Status: **built, OFF by default**. Production stays off until Shuaib approves. With the default browser voice it costs **$0**: the visitor's own browser listens and speaks. The optional premium voice (Azure Speech, free F0 tier) is OFF until keys are added. No audio is ever recorded or stored by this product.

## What Phase 1 is
- **One "Ask us" button with a round mic inside it** (the mic opens voice mode straight away). The separate "Talk to us" bubble was removed (owner, 2026-11-08). Mic (dictation) and Voice mode beside Send in the chat.
- **Receptionist behaviour (owner test fixes, 2026-11-08):** the mic is closed while the assistant speaks and its own words heard back (also in Urdu letters) are ignored; it waits about 1.3 s for the patient to finish; it never says the same sentence twice in a row and apologises at most once per conversation (then shows choices); problems in English and Roman Urdu are mapped only to departments we have, with doctors and fees; eyes, ears, bones and X-ray are honestly "not offered here"; health packages can be booked; English words in Urdu letters, spoken digits and "نمبر" after a date (= November) are understood; the chat is always in English letters and a name heard in Urdu letters is written in English letters with "Spelling theek hai?"; the slip is always English.
- **Voice mode, simple and calm:** the orb, a status line ("Listening...", "Thinking...", "Speaking..."), live captions, **one big mic button** (tap to talk / tap again to stop) and a red **End** button. Talking over the assistant stops it automatically (barge-in). "Audio is never recorded" is small text in the header.
- **Short welcome, then it listens by itself.** English: "Welcome to Shuaib Health! I'm your AI assistant. How can I help you today?" Roman Urdu (when the browser prefers Urdu): "Assalam o Alaikum! Shuaib Health mein khush aamdeed. Main aap ki AI assistant hoon, bataiye kya madad karoon?"
- **One warm female voice for the whole conversation**, chosen once from the welcome's language and never switched. **Automatic language:** English in, English out; Roman Urdu in, Roman Urdu out; never mixed in one reply.
- **A real booking conversation, by voice or by typing** (one conversation, one memory): "mujhe CBC test karwana hai" → what the test is, preparation, report time, price and the lab (from the public catalog) → "Kya main aap ki booking kar doon?" → one item at a time: day and time (real free slots), full name, phone, email (optional) → read-back (phone digit by digit) → books only after the patient's own "haan / yes" → a card with the reference and **"View / Download slip"**, which opens the **same slip page the website form creates** → "Is link ko tap karein, slip download karein, aur clinic aate waqt saath laayein." Doctor and department questions end with the same offer.
- Lab tests are booked as a visit to the Pathology Lab (the lab's doctor), with the test as the reason, through the same public booking route as the website form.
- Safety guards on every turn (emergencies first, no private data, no diagnosis or doses, no prompt reveal, no booking without the caller's own yes).

## Not in Phase 1 (Phase 2, see ADR-0015)
Email-code lookup, cancel by voice, the slip email, the four patient-access endpoints and migration `0006_patient_access`. Until then the assistant says it cannot look up or change an existing booking and gives the clinic number.

## The switches
| Variable | Project | Meaning |
|---|---|---|
| `ASSISTANT_ENABLED` | website (`shuaib-health-web`), build time | must already be `true` |
| `VOICE_ENABLED` | website, build time | `true` turns voice on. Missing = off. |
| `VOICE_PROVIDER` | website, build time | `browser` (default, free) or `azure` (premium voice; falls back to the browser silently) |
| `AZURE_SPEECH_KEY` | API (`shuaib-health-api`), **Sensitive** | the Speech resource's Key 1. Never reaches the browser. |
| `AZURE_SPEECH_REGION` | API | the resource's region, for example `southeastasia` |
| `SPEECH_TOKEN_PER_IP_PER_HOUR` | API, optional | tokens per visitor per hour (default 30) |
| `VOICE_BRAIN` | website, build time | `rules` (default, free, local) or `gemini` (optional AI brain, see below) |
| `GEMINI_API_KEY` | website, **Sensitive**, server only | Google AI Studio key (free tier, no billing). Never reaches the browser. |
| `GEMINI_MODEL` | website, optional | default `gemini-2.5-flash` |
| `VERCEL_PREVIEW_FEEDBACK_ENABLED` | website, Preview | `0` hides the Vercel Toolbar on previews (and its CSP warning) |

Website variables are read at **build** time: change the value and **redeploy**.

### Turn on for the Vercel Preview only (to try it)
Add for **Preview**, scoped to the branch (`vercel env add NAME preview <branch>`), then redeploy the preview. Production is untouched.

| Variable | Value |
|---|---|
| `ASSISTANT_ENABLED` | `true` |
| `VOICE_ENABLED` | `true` |
| `CATALOG_API_URL` | the **API project's preview alias for that branch** (`https://shuaib-health-api-git-<branch>-…vercel.app`). Without it the site shows the neutral name "Clinic" and booking cannot work. |

`BOOKING_PROXY_SECRET` and `API_PROTECTION_BYPASS` already exist for all Previews. Delete the branch-scoped variables when the branch is done.

### The premium voice (Azure Speech, free F0) — 🔑 owner
1. Azure portal → **Create a resource** → **Speech** (Azure AI services). Pricing tier **Free F0**. Region **Southeast Asia** (close to our Vercel region `sin1`; it has `en-US-JennyNeural` and `ur-PK-UzmaNeural`). A subscription can have only one free Speech resource.
2. Resource → **Keys and Endpoint** → copy **Key 1** and the **Location/Region**.
3. Vercel → `shuaib-health-api` → Environment Variables: `AZURE_SPEECH_KEY` (Sensitive) and `AZURE_SPEECH_REGION` (`southeastasia`), for Preview first. Redeploy the API.
4. Vercel → `shuaib-health-web`: `VOICE_PROVIDER=azure` (Preview first). Redeploy the website.
5. Check on the preview: the voice is Jenny (English) or Uzma (Roman Urdu); listening works in Edge.
6. To switch off: remove `VOICE_PROVIDER` (or set `browser`) and redeploy. Removing the key also switches it off (the token endpoint answers 404 and the browser voice takes over).

**Free F0 limits** (Microsoft, checked 2026-11-08; [pricing](https://azure.microsoft.com/pricing/details/speech/), [quotas](https://learn.microsoft.com/azure/ai-services/speech-service/speech-services-quotas-and-limits)):
- Speech to text: **5 audio hours a month**. Text to speech (neural): **0.5 million characters a month**.
- **Only 1 listening session at a time** (real-time speech to text, not adjustable on F0). A second visitor listening at the same moment is handed to the browser's own listening, silently.
- Text to speech: **20 requests per 60 seconds** (not adjustable on F0). Each reply is one request.
- On F0 nothing is billed: past the limits the service refuses, and this site falls back to the browser voice. Never switch the resource to S0 (paid) without approval.

How it is wired: the API endpoint `POST /api/v1/speech/token` (proxy secret, rate-limited per hashed IP) asks Azure for a 10-minute token; the website route `POST /api/speech/token` passes only that token to the browser. The Speech SDK loads only when voice mode opens with `VOICE_PROVIDER=azure`. The CSP then allows only `https://*.tts.speech.microsoft.com`, `wss://*.tts.speech.microsoft.com`, `wss://*.stt.speech.microsoft.com` and `media-src blob:` (for the audio).

### The optional AI brain (Google Gemini, free tier), OFF — 🔑 owner
The free rule brain answers first, always. With the AI brain on, only a patient turn the rules did **not** understand is sent (from our own server, never from the browser) to Gemini, which must pick ONE action from a closed list over our public catalog: suggest a department, offer a lab test, offer a package, a short clinic answer, or "ask what the problem is". Every choice is checked against the catalog on the server and again in the browser. **It never books**: booking is still done only by our code after the patient's own "haan" or Confirm. Any failure (no key, limit, timeout) silently keeps the rule brain's reply.

1. Go to **https://aistudio.google.com** and sign in with a Google account.
2. Click **Get API key** → **Create API key** (in a new project is fine). **Do not** add a billing account to that Google Cloud project: without billing it stays on the free tier and is never charged; past the free limits Google just refuses and the site uses the rules.
3. Copy the key.
4. Vercel → **`shuaib-health-web`** (the website project, because the route is `/api/voice/brain` on the website) → Settings → Environment Variables → add for **Preview** (branch `013-voice-receptionist` first):
   - `GEMINI_API_KEY` = the key, type **Sensitive**
   - `VOICE_BRAIN` = `gemini`
   - optional `GEMINI_MODEL` (default `gemini-2.5-flash`; change it only if Google renames the free model)
5. Redeploy the preview. Check: say something unusual the rules do not know (for example "mujhe neend nahi aati"); the reply should name a real department from our catalog.
6. To switch off: remove `VOICE_BRAIN` (or set `rules`) and redeploy. Removing the key also switches it off (the route answers 404).

Free-tier limits change; check them at https://ai.google.dev/gemini-api/docs/rate-limits before turning it on for production. Note: on the free tier Google may use the prompts to improve its products, so this stays a demo with sample details only (the footer already says so).

Code: `src/voice/brain.ts` (contract and browser call), `src/lib/voiceBrainGemini.ts` (server: prompt, tools, validation), `src/app/api/voice/brain/route.ts` (same-origin, 1 KB cap, 404 when off).

### The Vercel Toolbar on previews — 🔑 owner (one variable)
The toolbar is injected by Vercel on preview deployments; our Content-Security-Policy blocks its script, which is the console warning. Turn it off for previews: Vercel → `shuaib-health-web` → Environment Variables → **Preview** → `VERCEL_PREVIEW_FEEDBACK_ENABLED` = `0`, then redeploy. (Claude Code was not permitted to change Vercel settings overnight.)

### Turn on in production (🔑 owner, after approval)
Add `VOICE_ENABLED=true` for **Production** and redeploy. First complete `frontend/tests/voice/manual-checklist.md` on a preview build.

### Roll back
Set `VOICE_ENABLED` to `false` (or remove it) and redeploy (about 1–2 minutes), or use Vercel **Instant Rollback**. The text chat is unaffected.

## Microphone and the Permissions-Policy header
The site sends `Permissions-Policy: microphone=()` (blocked) by default. With `VOICE_ENABLED` on it sends `microphone=(self)`: only this site's own pages may ask, never a frame or another origin (`src/lib/security-headers.ts`, set in `next.config.ts`). The permission request is made inside the tap that opens voice mode. If the browser refuses, the panel shows step-by-step help for Edge and Windows. If Edge cannot reach its own listening service, the panel says listening works most reliably in Chrome and that typing works (until the premium voice is on).

## How it works (for the next developer)
- `src/voice/router.ts`: safety guards first, then an active booking, then offers and new booking requests (lab test → explanation → offer), then the same `AgentProvider` as the text chat. `Conversation` holds one conversation's memory, shared by typing and voice.
- `src/voice/session.ts`: one voice conversation (welcome, one locked voice, turn-taking, barge-in, echo guard, silence prompts, the "yes" gate).
- `src/voice/bookingDialog.ts`: the booking state machine (pure; the network is injected). Order: doctor, day, time, name, phone, email.
- `src/voice/speechPort.ts` chooses `browserSpeech.ts` or `azureSpeech.ts` (which falls back to the browser). `fakeSpeech.ts` is the scripted adapter for tests.
- `src/components/agent/voice/*`: the orb, captions, mic help, summary card, booked card.

## Known limits
- Browser listening: Chrome (desktop and Android) is best; Edge's own service is often unreachable on Windows; Safari/iPhone is partial; Firefox has none (voice mode then speaks only and asks people to type). The premium voice removes these limits.
- The one voice is chosen from the welcome's language (the browser's preferred language). A Roman Urdu caller on an English browser gets Roman Urdu replies read by the English voice; with the premium voice and an Urdu browser, Uzma reads everything.
- Roman Urdu is rewritten into Urdu script only for an Urdu voice (`src/voice/urduSpeech.ts`, a starter word list).

## Tests
`cd frontend && npx vitest run tests/unit/voice-*` (unit, scripted conversations, Azure adapter with a fake SDK),
`ASSISTANT_ENABLED=true VOICE_ENABLED=true npx playwright test voice --workers=1` (browser, mock API, scripted Web Speech), and
`cd backend && uv run pytest tests/api/test_speech_token.py`. Booking tests use the mock API, never production.

### The AI brain through OpenRouter (free ":free" models) — recommended over Gemini
The Gemini free tier proved unusable (about 20 requests a day, 429 "for a region"), so `VOICE_BRAIN=openrouter` is the working option. Same job and rules as the Gemini brain (rules answer first; only a turn they did not understand is sent, from our server, to a model that must pick ONE tool over our public catalog; every choice is checked on the server and again in the browser; it never books).
- **Free models only.** A model id must end in `:free`; anything else in `OPENROUTER_MODEL` is dropped, and every request carries `provider.max_price = 0`, so a paid model cannot be reached.
- Variables on `shuaib-health-web` (Preview first): `OPENROUTER_API_KEY` (**Sensitive**), `VOICE_BRAIN=openrouter`, optional `OPENROUTER_MODEL` = up to three `:free` ids separated by commas, tried in order (default: `google/gemma-4-31b-it:free`, `google/gemma-4-26b-a4b-it:free`, `nvidia/nemotron-3.5-lightning:free`, all with tool calling on 2026-11-09; check https://openrouter.ai/models?supported_parameters=tools&max_price=0).
- Any error, 429 or timeout (the whole call is capped at 5.5 s) tries the next model, then the rule brain answers silently. The server log shows only `[voice-brain] <model> failed: HTTP <status> <reason>` or `<model> answered`: never the key, never the patient's words. Read it with `vercel logs -d <preview-url> --expand`.
- OpenRouter's free models have their own daily limits (higher with a small credit balance on the account, which this project does not require); when they run out the rules answer.
- To switch off: remove `VOICE_BRAIN` (or set `rules`) and redeploy.
