# /sp.analyze report — 008 Command Centre Completion

Run: 2026-11-07 (agent, unattended). Non-destructive cross-check of spec.md, plan.md, tasks.md against the constitution.

| ID | Category | Severity | Location | Finding | Resolution |
|---|---|---|---|---|---|
| A1 | Coverage | Low | FR-007 | Axe/keyboard check maps only to T013 (e2e, CI) | Accepted: existing `admin-a11y.spec.ts` covers Bookings and Staff in all admin projects |
| A2 | Ambiguity | Low | US3 | "clinic name" in the print header: the Bookings screen does not receive the clinic name | Print header shows range + printed time; the shell's brand and the disclaimer remain on paper. Spec wording adjusted in results |
| A3 | Constitution II | Info | US3 | Print could leak phones | Covered: masked as on screen, no reveal in print (A-2) |
| A4 | Constitution II roles list | Medium | A-1 | Constitution names `doctor` and `lab_staff` roles; product still has 2 | Out of scope; listed in QUESTIONS-FOR-SHUAIB.md (needs migration + policies) |
| A5 | Visual baselines | Medium | T014 | New chips/card change Bookings/Staff screenshots | Playbook rule 5: owner-approved regeneration with pixel-diff note |

Coverage: FR-001..FR-006 each map to ≥ 1 task (FR-001/2/3 → T002–T005, FR-004 → T006–T008, FR-005 → T009–T011, FR-006 → no-backend diff). No unmapped tasks. No CRITICAL issues.
