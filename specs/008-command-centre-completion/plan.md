# Implementation Plan: Command Centre Completion

**Branch**: `008-command-centre-completion` | **Date**: 2026-11-07 | **Spec**: [spec.md](./spec.md)

## Summary

Three frontend-only gap fills on the Feature 006 Command Centre: quick date-range chips on Bookings, a role-permission table on Staff, and a print-friendly Bookings list. No backend, contract, migration or env change.

## Technical Context

- TypeScript strict, Next.js 16.4 App Router, React 19, Tailwind v4 tokens + `admin.css` (Feature 006 styles).
- Tests: Vitest + Testing Library (unit), Playwright admin projects against the mock API (e2e).
- Constraints: admin code must not reach public bundles (`scripts/check-admin-isolation.mjs`); WCAG 2.2 AA; light + navy-night themes.

## Constitution Check

| Principle | Status |
|---|---|
| I Honesty | Pass: disclaimer stays visible in print |
| II Privacy | Pass: print keeps phones masked; no new data leaves the app; no audit change |
| III Server truth | Pass: ranges only set filters; server validates them as today |
| IV API-first | Pass: uses existing `bookings/search` |
| V Resilience | Pass: no new fetches |
| VI Security | Pass: no new endpoints |
| VIII Design/a11y | Planned: chips reuse `.chip` style, axe checked |
| IX Quality | Planned: unit tests for pure helpers |
| XI Safe change | Own branch, draft PR, no deleted tests |

## Design

### 1. Quick ranges (`src/admin/lib/quickRanges.ts`, new)
- `addDays(iso, n)`: UTC-noon arithmetic on `YYYY-MM-DD` (no local TZ drift).
- `quickRanges(today)` → `[{id:"today"},{id:"tomorrow"},{id:"next7"},{id:"last7"}]` each with `from`/`to`.
- `activeRange(filters, today)` → id or null.
- UI: `QuickRangeChips` in `FilterBar.tsx`, rendered by both desktop and mobile filter areas in `BookingsScreen` via the existing `onChange` (patch `{from,to,page:1}`).

### 2. Permissions (`src/admin/staff/permissions.ts` + `PermissionsCard.tsx`, new)
- `CAPABILITIES`: `{ id, label, roles: Role[] }[]`. Admin-only entries: `activity`, `staff`.
- Unit test asserts the Admin-only capabilities equal the `adminOnly` nav items (`NAV_ITEMS`), so the explanation cannot drift from the app's rule.
- Rendered under the staff table as a `<table>` with `<caption>`.

### 3. Print (`PrintButton` in `BookingsScreen` toolbar + `@media print` in `admin.css`)
- Button calls `window.print()`.
- Print CSS hides `.side, .bottom-nav, .m-top, .filters, .chips-slot, button, .pager`; shows a `.print-only` header (clinic + range + printed time).

## Decisions

- No ADR: all three are small, reversible UI additions inside an existing pattern (fails the "cross-cutting / long-term" test).

## Risks

- Visual baselines for Bookings/Staff will change (new chips, new card). Follow playbook rule 5: update only affected baselines and record the pixel-diff reason in `results.md`. If baselines cannot be regenerated reliably on this laptop overnight, leave them and let CI report; note it.
