# Research: Voice Receptionist (013)

Date: 2026-11-08. Product research (the 5 UX ideas) is in [spec.md](spec.md#research-basis-step-0-2026-11-08). This file records the technical decisions.

## R1. Listening: browser speech recognition

- **Decision**: Use the browser's `SpeechRecognition` / `webkitSpeechRecognition` with `continuous = true` and `interimResults = true`, and `lang` set to `en-PK`/`en-US` or `ur-PK` from the EN / اردو toggle. Feature-detect it at runtime. If it is missing (Firefox, some in-app browsers), fall back to speaking-only mode with a text box (spec A-3).
- **Rationale**: free, no key, and good in Chrome and Edge, which together cover most Pakistani desktop and Android traffic. It handles `ur-PK` in Chrome (cloud-backed by the browser vendor). The privacy text therefore says "we never record or store your audio", which is true for this product, and does not claim on-device processing.
- **Alternatives**: Whisper in the browser (WASM, about 40–150 MB download, too slow on mid-range phones); Vosk WASM (no good Urdu model); cloud STT (paid, against the rules). All three can plug in later behind `SpeechPort` (R6).
- **Known limits, handled in code**: Chrome stops continuous recognition after about 60 s of silence or on network loss. The adapter restarts it while voice mode is open, and stops after the second silence prompt (spec edge case). iOS Safari has partial support, so the adapter runs feature tests, not browser sniffing.

## R2. Speaking: browser speech synthesis and voice choice

- **Decision**: `speechSynthesis` with a ranked voice picker:
  1. language match (`ur-PK`/`ur-*` for Urdu-script replies; `en-PK`, `en-IN`, `en-GB`, `en-US` for English and Roman Urdu);
  2. names containing "Natural" or "Online" (Microsoft neural voices in Edge, e.g. "Microsoft Uzma Online (Natural) - Urdu (Pakistan)" and "Asad" male);
  3. "Google" voices;
  4. local voices.
  The gender is taken from a small known-names table plus heuristics; when unknown, the switch steps through voices for that language. Voices load asynchronously, so the picker waits for `voiceschanged` (with a 1.5 s timeout).
- **Rationale**: Edge's natural voices are the best free voices available and include Urdu. Chrome on Windows usually has no Urdu voice, which the "no Urdu voice" path covers (FR-014).
- **Chunking**: replies are split into sentences, and each sentence is a separate utterance, so the first words start at once (SC-002) and barge-in can cancel between or inside chunks. Chrome's known bug that cuts long utterances after about 15 s is avoided by keeping chunks short.

## R3. Urdu speech needs Urdu script

- **Decision**: An Urdu voice cannot read Roman Urdu well (Latin letters are read with English rules). So every fixed phrase in the voice dialogs, and the free engine's templates, gets a third form in Urdu script: `T(lang, en, roman, ur?)`. When the reply language is Urdu:
  - the caption shows the caller's own style (Roman or Urdu script);
  - speech uses the Urdu-script form with an Urdu voice;
  - if a template has no Urdu-script form yet, or no Urdu voice exists, the Roman text is spoken with the best `en-IN`/`en-PK` voice and the "no Urdu voice" note is said once.
- **Rationale**: this is the only free way to sound natural in Urdu. It keeps one brain: the strings live beside the existing ones.
- **Alternatives**: automatic Roman-to-Urdu transliteration (unreliable for names and medical words); speaking only English (against the language rule).

## R4. The orb: animation and "waves synced to speech"

- **Decision**: one `<canvas>` (2D) drawn with `requestAnimationFrame`, using brand tokens (navy `#0B2545`, teal `#14B8A6`, teal-to-blue gradient) and a soft glow. It has 4 states: idle (slow drift), listening (breathing), thinking (swirl), speaking (waves).
  - **Listening level**: from a local `AnalyserNode` on a `getUserMedia` stream, used only for the visual level, never recorded. If that stream is refused, a synthetic breath is used.
  - **Speaking level**: `speechSynthesis` output cannot be routed into Web Audio. The wave amplitude is therefore driven by the utterance's `boundary` (word) events plus a per-word envelope, which looks synced. If a browser fires no boundary events, a speech-rate estimate is used instead.
  - **Performance**: the canvas uses device pixel ratio up to 2, pauses when hidden (`visibilitychange`, IntersectionObserver), and does no layout work per frame.
  - **Reduced motion**: a static orb with an opacity-only pulse and a text state label.
- **Rationale**: canvas holds 60 fps on mid-range phones, which a heavy SVG filter or CSS blur stack does not. There is no WebGL dependency and no new library. Framer Motion (already in the stack) is used only for panel open and close.
- **Alternatives**: Lottie (new dependency, cannot react to live levels); WebGL shader (best visuals, but risky on low-end Android GPUs); CSS-only (cannot show live levels).

## R5. Turn-taking, barge-in and echo

- **Decision**:
  - Recognition keeps running while the assistant speaks.
  - An interim result counts as **barge-in** when it has at least 2 words and is not a fuzzy match (token overlap below 0.6) of the sentence being spoken. Then `speechSynthesis.cancel()` runs and the reply chunk is marked interrupted.
  - The Interrupt button and the Space key always barge in.
  - End of turn: a final result plus 700 ms of silence.
  - The confirming "yes" (FR-045) is accepted only from a **final** result that started **after** the read-back utterance ended, and arrived in the next caller turn.
- **Rationale**: browsers apply echo cancellation to the mic by default, but speakerphone echo still leaks on some laptops. Text matching against what the assistant is saying is a free and reliable second guard, and it also guarantees that the assistant's own "yes" can never confirm a booking.

## R6. Pluggable providers ("by config only")

- **Decision**: three small interfaces, each with one v1 implementation chosen by an env setting:
  - `SpeechPort` (browser): `listen`, `stop`, `speak(chunks)`, `cancel`, `voices`. v1 = `browser`. Future = premium TTS/STT behind a same-origin route.
  - `CodeSender` (backend): `send(channel_target, code, lang)`. v1 = `email` (Resend). Future = `sms`, `whatsapp`. Selected by `LOOKUP_CODE_CHANNEL`.
  - The existing `AgentProvider` (Feature 010) for answers, unchanged.
- **Rationale**: matches ADR-0013's provider-slot pattern. Adding a paid provider later is a new class plus a setting, with no conversation changes.

## R7. Email provider and free limits

- **Decision**: reuse the existing Resend sender (`app/notifications/sender.py`) for two new patient emails: the booking slip summary and the 6-digit code. Resend free tier (checked 2026-11-08): **3,000 per month, 100 per day**, shared with clinic alerts. Guards:
  - a global daily cap `PATIENT_EMAIL_DAILY_CAP` (default 60), Postgres counter;
  - 3 code emails per email per hour;
  - 5 code requests per caller (IP) per hour.
  When the cap is reached, the booking still succeeds with no email, and the code path says "please call the clinic".
- **Note**: the slip email carries no PDF attachment in v1. It holds the reference, date, time, doctor and a link to the confirmation page. This keeps the function fast and the email small.

## R8. Lookup and code security

- **Decision**:
  - Codes are 6 digits from `secrets.randbelow`, stored only as `HMAC-SHA256(privacy_hash_key, challenge_id ‖ code)`, and compared in constant time.
  - A code lasts 10 minutes, is used once, allows 3 tries, and can be resent after 60 s. A resend replaces the code and does **not** reset the try budget for that target.
  - Lock: 3 failures within an hour for a target (hashed reference, hashed email, or hashed caller IP) block that target for 1 hour. Reuse `rate_limit_counter`, with a new "peek" read so only failures count.
  - All failures return the same 404 `not_found` body, with a minimum response time floor (about 300 ms), so timing does not tell which part was wrong.
  - "Send code" always returns 202 with the same body.
- **Finding (owner decision needed, not changed here)**: the existing `GET /appointments/{reference}` already returns date, time, doctor, status and `mobileMasked` (`0300****567`, the **last 3 digits**) to anyone holding a reference. So for someone who has the reference, "reference + last 4" adds about one digit (1 in 10, 3 tries ≈ 30%). The reference itself is a 50-bit random value and stays the real secret. The new lookup is still the right voice path (it is rate-limited and locks), but tightening the old endpoint is a separate, owner-approved change (it would affect the confirmation page). See plan Risk 1.

## R9. Booking dialog understanding (no paid AI)

- **Decision**: a deterministic slot-filling state machine in the browser, with small parsers:
  - phone: reuse `lib/booking/phone.ts`, plus spoken forms "double five", "zero three zero zero", Urdu digit words;
  - dates: today, kal, parson, weekday names in English and Roman Urdu, "13th", "13 tareekh", "next Monday";
  - times: "11", "11:30", "gyarah baje", "teen baje", "subah"/"shaam" disambiguation;
  - yes and no: a closed list in each language; anything else is "unclear";
  - names: free text after "my name is" / "mera naam";
  - corrections: "no / nahi + new value", or a field keyword plus a value.
  Slots come from the existing `fetchSlots` BFF and booking from the existing `postBooking`, with the same Zod schemas and Idempotency-Key.
- **Rationale**: free, testable with unit tests and scripts, and with no hallucinated slots. The optional AI provider stays off and is never on the booking path.

## R10. Patient cancel rules

- **Decision**: a new `cancel_by_patient(reference, code)` reuses the existing status rules (`rules.is_allowed(confirmed → cancelled, starts_at, now)`, which allows only future, confirmed bookings). It records an `appointment_status_change` row with a system/anonymous actor, frees the slot (the existing `OCCUPYING_SQL` excludes cancelled bookings), and writes audit `booking.cancelled_by_patient`.
