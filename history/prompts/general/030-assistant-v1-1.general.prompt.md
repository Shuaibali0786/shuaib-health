---
id: 030
title: Assistant v1.1 warm and Roman Urdu
stage: general
date: 2026-11-07
surface: agent
model: claude-opus-5-5
feature: 010-ai-agent
branch: feat/assistant-v1-1
user: Shuaibali0786
command: improve the free assistant (v1.1) + prepare Claude Haiku provider (off)
labels: ["assistant","roman-urdu","greetings","symptoms","claude","haiku","cost-cap"]
links:
  spec: specs/010-ai-agent/spec.md
  ticket: null
  adr: history/adr/0013-ai-agent-provider-interface-and-local-engine.md
  pr: null
files:
 - frontend/src/agent/{localEngine,normalize,knowledge,types,registry,remoteProvider}.ts
 - frontend/src/components/agent/{AssistantPanel,AssistantLauncher}.tsx
 - frontend/src/app/api/assistant/route.ts, frontend/src/app/(site)/layout.tsx, frontend/src/lib/demo.ts
 - backend/app/assistant/claude.py, backend/app/routers/assistant.py, backend/app/{settings,schemas,errors,main}.py
 - specs/003-catalog-api/contracts/openapi.yaml (1.4.0), docs/runbooks/ai-provider.md
tests:
 - vitest 1550 (incl. 100-question set at 100%, provider fallback, route)
 - backend test_assistant_ai.py 14, contract tests 35
---

## Prompt

Great work. Next: improve the free assistant (v1.1), one PR, same merge process. Include the uncommitted PHR files.

Feedback from my live test: "hi", "good morning" and "what do you do" all got "Sorry, I don't have an answer". That feels bad.
1. Warm VIP welcome: greetings in English, Roman Urdu, Urdu and Arabic (hi, hello, salam, assalam o alaikum, aoa, good morning/evening, marhaba, shukriya, thank you). Reply warmly, say who it is (the clinic's assistant), what it can do, and show quick-reply buttons: Book appointment, Find a doctor, Lab tests and fees, Timings and location.
2. Small talk: "what do you do", "who are you", "help", "thanks", "bye" get friendly, useful answers.
3. Roman Urdu understanding for common words: test, fees, kitni, kab, doctor, booking, timing, kahan, report, ghar se sample.
4. Symptom to department guide (no diagnosis): stomach pain -> General Medicine, tooth pain -> Dental, skin rash -> Dermatology, child fever -> Paediatrics. Always add: not medical advice; emergency -> call 1122/115 or go to the nearest emergency.
5. Reply in the user's style: English -> English, Roman Urdu -> simple Roman Urdu.
6. Never start with "Sorry". Fallback: friendly, show the quick-reply buttons.
7. Grow the accuracy test set to 100 questions, keep 100% passing.

Also prepare, but keep OFF: a Claude Haiku provider in the existing provider slot, with a hard monthly cost cap, rate limits, and a system prompt that answers only from clinic data, in the user's language. It needs an API key I will add later.
Report short and STOP.

## Response snapshot

The free engine was rewritten for greetings and small talk (English, Roman Urdu, Urdu and Arabic script), more Roman Urdu, replies in the visitor's style, symptom → department with the safety line, quick replies, and a friendly fallback with no "Sorry". A matching fix stops generic words from picking items. The accuracy set is now 100 questions at 100%. The Claude Haiku 5.5 provider was added OFF: hybrid (free engine first), backend endpoint with per-IP/day limits and a monthly cost cap in Postgres (no migration), grounding prompt, fallback on any failure, contract v1.4.0, runbook.

## Outcome

- ✅ Impact: the assistant greets warmly and understands Roman Urdu; the AI path is ready but costs nothing until switched on
- 🧪 Tests: see files above
- 🧠 Reflection: the old ≥90% target hid real matching bugs; 100% on a larger set surfaced them
