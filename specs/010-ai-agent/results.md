# Results: 010 AI Agent v1

Run: unattended overnight, 7 Nov 2026, Windows laptop, mock API.

| Check | Result |
|---|---|
| typecheck, lint | pass |
| Vitest full | **1466 passed** (112 files; new: `agent-engine.test.ts` 21, `agent-widget.test.tsx` 3) |
| 40-question sample (SC-001, ≥ 90%) | passes the ≤ 4-miss threshold |
| Playwright with `ASSISTANT_ENABLED=true`: `assistant`, `home` (mobile + desktop) | 28 passed, 2 skipped (the flag-off check, by design) |
| Flag off (default) | no button, no pack in pages (layout loads nothing) |

Change from the plan: the knowledge pack is passed from the site layout to the widget as a prop, **not** fetched from a new `/api/assistant/knowledge` route. Reason: the project guard test forbids new `fetch()` call sites, and this removes a public endpoint. Cost: when the flag is on, every page carries the pack in its HTML (public catalog data, a few kB gzipped). When the flag is off, nothing is added.

The flag reader lives in `lib/demo.ts` (the guard tests allow env reads only there).

Not done: Lighthouse with the flag on; a server-side provider (by design, see `docs/runbooks/ai-provider.md`).

## v1.1 (2026-11-07): warmer free engine + optional Claude provider (OFF)

Owner's live test: "hi", "good morning" and "what do you do" all got "Sorry, I don't have an answer". Fixed:

| Change | Detail |
|---|---|
| Warm welcome | Greetings in English, Roman Urdu, Urdu and Arabic script (hi, hello, salam, assalam o alaikum, AOA, good morning/evening, marhaba, shukriya, thank you), each with a matching opener ("Wa alaikum assalam!", "Marhaba!"). The reply says who it is and what it does, with 4 quick replies: Book appointment, Find a doctor, Lab tests and fees, Timings and location |
| Small talk | who are you / what do you do / help / how are you / thanks / bye. A greeting plus a question ("hi, timings?") answers the question with a warm opener |
| Roman Urdu | kitni/kitne, kab, kahan, timing, booking, report, "ghar se sample" (home collection), and more. Replies follow the visitor's style: English stays English; Roman Urdu gets simple Roman Urdu |
| Symptom → department | No diagnosis. Stomach → General Medicine, tooth → Dental, skin rash → Dermatology, child + any symptom → Pediatrics, periods/pregnancy → Gynecology. Always followed by "This is not medical advice. If it is an emergency, call 1122 or 115 or go to the nearest emergency department." (The numbers come from the clinic time zone, so each white-label client gets its own country's.) |
| No "Sorry" | The fallback is friendly and shows the quick replies. Tested on all 100 questions |
| Matching fix | Topic words ("test", "price", "doctor") no longer pick an item, so "TSH test price" is the TSH test. These were silent misses before, allowed by the old ≥90% target |
| Accuracy set | **100 questions, 100% passing** (was 40 at ≥90%) |
| Claude Haiku provider | Prepared and **OFF**: free engine first, Claude only for unknown questions, grounded only in the public pack, 20/hour per address, 500/day, hard monthly cost cap (default $5), falls back to the free engine on any refusal. See `docs/runbooks/ai-provider.md` |

Tests: Vitest 1550 (119 files). Backend `test_assistant_ai.py` 14 (fake client, no real calls). Contract v1.4.0, 35 contract tests.
