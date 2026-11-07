# Tasks: Command Centre Completion (008)

Input: [spec.md](./spec.md), [plan.md](./plan.md). Frontend only. `[P]` = can run in parallel.

## Phase 1 — Setup
- [x] T001 Branch `008-command-centre-completion` from `main` (a410845); spec, plan, tasks written

## Phase 2 — US1 Quick date ranges (P1)
- [x] T002 [P] [US1] Unit tests `tests/unit/admin-quick-ranges.test.ts`: `addDays` across month/year/leap day, `quickRanges`, `activeRange`
- [x] T003 [US1] `src/admin/lib/quickRanges.ts` (pure helpers)
- [x] T004 [US1] `QuickRangeChips` in `src/admin/bookings/FilterBar.tsx`; render in `FilterBar` (desktop) and `StickyFilters` (mobile)
- [x] T005 [US1] Unit test: chip click patches `{from,to,page:1}`, pressed state follows filters (`tests/unit/admin-completion-ui.test.tsx`)

## Phase 3 — US2 Roles and permissions (P2)
- [x] T006 [P] [US2] `src/admin/staff/permissions.ts` (`CAPABILITIES`)
- [x] T007 [US2] `src/admin/staff/PermissionsCard.tsx`, rendered in `StaffScreen`
- [x] T008 [US2] Unit tests: admin-only capabilities == `adminOnly` nav items; table caption, "Allowed"/"Not allowed" text

## Phase 4 — US3 Print list (P3)
- [x] T009 [US3] `PrintButton` in Bookings page head; print header (`.print-only`) with range and printed time
- [x] T010 [US3] `@media print` rules in `admin.css`
- [x] T011 [US3] Unit test: button calls `window.print` once

## Phase 5 — Polish and gates
- [x] T012 `npm run typecheck`, `npm run lint`, `npm test` green (results in `results.md`)
- [ ] T013 Playwright admin projects for Bookings/Staff + axe (run in CI on the draft PR; laptop run optional)
- [x] T014 Visual baselines for Bookings/Staff: review CI diff, regenerate only affected snapshots with a pixel-diff note (owner approval, playbook rule 5) — approved by Shuaib 7 Nov 2026 (chips + Print list); 17 Linux baselines from CI run 42281368553, 17 Windows regenerated locally
- [x] T015 Draft PR; no merge (see PR link in specs/MORNING-REPORT-2026-11-07.md)
