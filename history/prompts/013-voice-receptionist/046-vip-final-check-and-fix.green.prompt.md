---
id: 046
title: VIP final check and fix
stage: green
date: 2026-11-14
surface: agent
model: Claude Sonnet 5.5
feature: 013-voice-receptionist
branch: 013-voice-receptionist
user: owner
command: VIP FINAL A-Z CHECK + FIX before go-live
labels: ["voice", "ayesha", "device-matrix", "b1-b11"]
links:
  spec: null
  ticket: null
  adr: null
  pr: 39
files:
  - docs/reports/vip-final-2026-11-09.md
tests:
  - vitest 2128 passed; device matrix 130/130; voice, hero and self-test e2e updated to the new flow
---

## Prompt

VIP FINAL A-Z CHECK + FIX before go-live (PR #39): Part A calm luxury receptionist, Part B bugs B1-B11, Part C device matrix, Part D 20 conversations; then "push. Update the 8 old tests to the new intended behaviour, fix the 1px Lab reports card, re-run, commit, push, wait for CI green, give the preview URL. No production, no merge, no promote."

## Response

Part A/B fixes, device matrix and 20 conversations done; old tests updated to the new greeting, doctor-list and apology wording; hero bar check now applies once scrolled. Report: docs/reports/vip-final-2026-11-09.md.
