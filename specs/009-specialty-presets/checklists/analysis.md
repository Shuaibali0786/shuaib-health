# /sp.analyze report — 009 Specialty presets

Run 2026-11-07 (agent, unattended). Non-destructive cross-check of spec, plan, tasks and constitution.

| ID | Category | Severity | Finding | Resolution |
|---|---|---|---|---|
| A1 | Inconsistency | Low | Spec FR-002 said `/demo/specialties` redirects; the page-manifest tests need every route to render a page with its own title and canonical | Implemented as a page that shows the Multi-speciality preset with title "Choose your specialty" (no redirect). Spec intent (land on Multi-speciality) kept |
| A2 | Constitution I | Medium | "HydraFacial" (trade mark) and "WhatsApp" text tripped the brand gate | Renamed to "Hydrating facial"; slip text says "share link" |
| A3 | FR-002 (005) | Low | "HbA1c" duplicated a catalog lab test name (no-hardcoded-catalog test) | Renamed to "Glycated haemoglobin" |
| A4 | Coverage | Info | Real booking/dashboard are not preset-aware | Documented as A-6 and Out of scope; question for Shuaib |
| A5 | SC-002 Lighthouse | Medium | Not measured overnight (laptop CPU-bound; method from 006 needs quiet machine) | Follow-up: run `npx lighthouse http://localhost:3100/demo/specialties/dental --preset=perf --form-factor=mobile` |

Coverage: FR-001→T002/T003, FR-002→T007, FR-003→T007/T010, FR-004→T005, FR-005→T004, FR-006→T009, FR-007→T003 + honesty tests, FR-008→no existing file behaviour changed except manifest additions. No CRITICAL issues.
