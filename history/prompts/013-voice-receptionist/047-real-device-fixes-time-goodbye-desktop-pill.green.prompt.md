---
id: 047
title: Real device fixes time goodbye desktop pill
stage: green
date: 2026-11-15
surface: agent
model: Claude Opus 5.5
feature: 013-voice-receptionist
branch: 013-voice-receptionist
user: owner
command: real-device test fixes on PR #39
labels: ["voice", "booking-time", "goodbye", "edge", "launcher"]
links:
  spec: null
  ticket: null
  adr: null
  pr: 39
files:
  - frontend/src/voice/parse/time.ts
  - frontend/src/voice/parse/date.ts
  - frontend/src/voice/bookingDialog.ts
  - frontend/src/voice/router.ts
  - frontend/src/voice/session.ts
  - frontend/src/components/agent/voice/Captions.tsx
  - frontend/src/components/agent/voice/MicHelp.tsx
  - frontend/src/components/agent/AssistantLauncher.tsx
  - frontend/src/app/(site)/layout.tsx
tests:
  - frontend/tests/unit/voice-realdevice-2026-11-14.test.ts (37)
  - frontend/tests/unit/voice-captions-2026-11-14.test.tsx
  - voice-session goodbye + Edge retry tests; voice e2e desktop Chrome, Edge 1920, Android 360
---

## Prompt

My real-device test on the new preview found these. Fix the root cause of each, on PR #39.
1. CRITICAL - TIME PICKED WITHOUT ASKING ("18 #2 PM" booked 6:00 PM; always offer free times and wait; read doctor, day, date, time, fee before confirm).
2. "18 #2 PM", "18 at 2", "eighteen two pm", "18 tareekh 2 baje" = day 18 + 2:00 PM.
3. "Sure, null." after "No, it's wrong" to the name; never null/undefined/NaN.
4. "Hi, good morning" got "Glad to hear that!".
5. "You said:" -> "I heard:" / "Maine suna:".
6. Edge mid-call listening-service box, duplicate sentence: retry silently, then one short line.
7. Goodbye like a real receptionist, then end the call (slip stays).
8. Desktop floating button: horizontal pill bottom-right, not a tall vertical pill over the hero.
Unit tests per fix; related unit + voice e2e (desktop Chrome + Edge, mobile 360px); push once. No Production env vars, no merge, no promote.

## Response

Root causes fixed: the day number "18" was read as 18:00 and the time was kept with no understood day; time now kept only with a day, said back, and the read-back states doctor/date/time/fee. Name rejection re-asks with sorry; null guard on every reply. Greeting regex accepts a leading "hi". Captions label, Edge silent retries + one-line notice, goodbye + endCall, horizontal pill from 1700 px (bar below).
