# Tasks: Specialty Demo Presets (009)

## Phase 1 — Setup
- [x] T001 Branch `009-specialty-presets` from `main`; spec, plan, tasks, ADR-0012

## Phase 2 — Foundation
- [x] T002 [P] `src/presets/specialties.ts` with 4 presets + `getPreset(id)` + `PRESET_IDS`
- [x] T003 [P] Unit test `tests/unit/specialty-presets.test.ts`: 4 ids, unique names, 4–6 services, 3 doctors, images exist in `public/`, no honesty-banned words, sample contact only
- [x] T004 Theme tokens (`tokens.css`) and `[data-preset]` variables (`site.css`)

## Phase 3 — US1 Switch specialty (P1)
- [x] T005 `PresetSwitcher` (links, `aria-current`), unit test
- [x] T006 `PresetShowcase` hero, services, doctors
- [x] T007 Routes: `/demo/specialties` (shows Multi-speciality; see analysis A1), `[preset]` static page, demo gate (404), noindex metadata
- [x] T008 Page manifest entries if route tests need them

## Phase 4 — US2 Previews (P2)
- [x] T009 Booking preview, slip preview, dashboard preview panels with links

## Phase 5 — Verify
- [x] T010 Playwright `tests/e2e/specialties.spec.ts`: switch presets, 404 unknown, disclaimer, axe, no horizontal overflow at 360 px
- [x] T011 typecheck, lint, Vitest full, targeted e2e; results in `results.md`
- [x] T012 Draft PR; no merge
