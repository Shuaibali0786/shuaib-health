---
id: 005
title: Design Approved Live Preview Updates
stage: misc
date: 2026-10-06
surface: agent
model: claude-opus-5-5
feature: 006-clinic-command-centre
branch: 006-clinic-command-centre
user: Shuaibali0786
command: design gate approval + preview updates, then /sp.tasks
labels: ["design-gate", "preview", "live-updates", "polling", "accessibility", "visual-tests", "sample-data"]
links:
  spec: specs/006-clinic-command-centre/spec.md
  ticket: null
  adr: null
  pr: null
files:
 - specs/006-clinic-command-centre/design-preview/data.js
 - specs/006-clinic-command-centre/design-preview/render.js
 - specs/006-clinic-command-centre/design-preview/preview.css
 - specs/006-clinic-command-centre/design-preview/capture.mjs
 - specs/006-clinic-command-centre/design-preview/index.html
 - specs/006-clinic-command-centre/design-preview/README.md
 - specs/006-clinic-command-centre/design-preview/screenshots/*.png (46, replacing the 32 A/B shots)
 - specs/006-clinic-command-centre/spec.md
 - specs/006-clinic-command-centre/research.md
 - specs/006-clinic-command-centre/plan.md
 - specs/006-clinic-command-centre/data-model.md
 - specs/006-clinic-command-centre/contracts/command-centre-api.openapi.yaml
tests:
 - capture.mjs clipping check at 390/1280/1366/1440 px, light and dark: 0 clipped elements (it first caught "09:00–13:00" spilling under the timeline at 1280/1366, now fixed)
 - two consecutive frozen-clock captures: 44/46 PNGs byte-identical; the 2 desktop new-booking toast shots differ only by sub-pixel anti-aliasing (visually identical)
 - OpenAPI YAML parses
---

## Prompt

Design APPROVED with font A (Cormorant Garamond headings). Before building, apply these and update the preview:
1. Sample data realism: Gynecology patients female names; Pediatrics reads as children (parent-booked fine). Check every sample name fits its department.
2. Agenda chips: on hover/focus/tap show time + patient initials + status; tapping opens the booking drawer. Accessible (aria-labels).
3. Nothing clipped at 1280px and 1366px laptop widths; add 1366px to visual tests.
4. Make it feel LIVE and premium:
   - Live Asia/Karachi clock in the header with seconds (e.g. "11:20:45 PM · Karachi"), real time.
   - The "Now" line in the agenda moves by itself every minute; KPIs and lists refresh automatically (e.g. every 30-60s) with a subtle "Live" pulsing dot and "updated just now".
   - Time-based greeting ("Good morning / Good afternoon / Good evening").
   - KPI numbers count up gently on load; respect prefers-reduced-motion.
   - Elegant toast when a new booking arrives (real mode via polling; demo mode simulates one now and then).
   - Light / Night / Auto switch in the sidebar must really work and be remembered.
   - Tests must freeze the clock so screenshots stay stable.
Then commit + push, run /sp.tasks, and STOP with a short summary.

(Follow-up after a usage-limit pause: "CUNTINUE")

## Response snapshot

The preview is now a live prototype. Sample patients fit their department (Gynecology = women, Pediatrics = children booked by a parent, per-department reasons). Agenda chips are buttons with aria-labels: a hoverable, Esc-dismissible tooltip shows time, initials and status, and activating a chip opens the drawer (focus trapped, then returned). A Karachi clock ticks with seconds; the greeting follows the clinic hour; KPIs and lists refresh every 30 s with a pulsing Live indicator; the Now line moves each minute; KPIs count up; simulated new bookings show a toast and a chip glow; the Light/Night/Auto switch works and is remembered. All motion respects reduced motion. Laptop layout: narrower doctor column, KPIs in 3 columns below 1400 px. capture.mjs pauses the Playwright clock per shot, captures 46 PNGs at 390/1280/1366/1440 px, and fails on clipping. Spec gains FR-040…FR-045, US3 scenarios 7–9, and the FR-019/FR-038/SC-010 additions; research R14 records the approved font, and the new R19 covers polling, notifications and frozen-clock tests; the Overview contract gains recentBookings; the plan and data-model are updated.

## Outcome

- ✅ Impact: design gate closed with the owner's changes captured in the preview and in the spec artifacts that /sp.tasks reads.
- 🧪 Tests: clipping check passes at all widths; frozen-clock screenshots are stable except anti-aliasing on 2 toast shots (tolerance noted in plan).
- 📁 Files: 6 preview files + 46 screenshots; spec, plan, research, data-model, contract.
- 🔁 Next prompts: /sp.tasks (run next), then /sp.analyze, then /sp.implement.
- 🧠 Reflection: the first clipping check missed overflowing visible text; adding a leaf "spills out of itself" rule caught the real bug.

## Evaluation notes (flywheel)

- Failure modes observed: Playwright clock.install alone let time flow between shots; pauseAt per fresh page fixed it.
- Graders run and results (PASS/FAIL): clipping check PASS; screenshot stability PASS for 44/46 shots (toast anti-aliasing).
- Prompt variant (if applicable): null
- Next experiment (smallest change to try): use toHaveScreenshot maxDiffPixels for the toast shot in the real e2e suite.
