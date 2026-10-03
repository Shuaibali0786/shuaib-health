# Results: Feature 004 — Connect the Public Website to the Catalog API

Evidence log. Sections are filled in as tasks complete.

## Baseline

Recorded on branch `004-catalog-api-integration` (commit `80cf275`), before any Feature 004 code change. Machine: Windows 11, Node 24.13, run from `frontend/`.

| Command | Result | Duration |
|---------|--------|----------|
| `npm run typecheck` | pass | 19 s |
| `npm run lint` | pass, 0 warnings | 88 s |
| `npm test` (Vitest) | **475 passed** (475) | 77 s (87 s wall) |
| `npm run test:e2e` (Playwright, mobile + desktop, production build) | **953 passed**, 11 skipped | 6.5 min (399 s wall incl. build) |

Visual baseline (T002): `tests/e2e/visual-baseline.spec.ts` — 31 routes × 2 projects = **62 snapshots** under `tests/e2e/visual-baseline.spec.ts-snapshots/`. Generated with `--update-snapshots`, then re-run without it: 62/62 passed (stable, no flake).

## Baseline — Lighthouse

Method: `npm run build && npm run start -- --port 3150`, then
`npx lighthouse <url> --preset=perf --form-factor=mobile --output=json` ×3 per page, **median** reported.
Lighthouse's default simulated mobile throttling was used.

| Page | Performance (3 runs) | Median perf | LCP (ms) | TBT (ms) | CLS | JS transferred (kB) |
|------|----------------------|-------------|----------|----------|-----|---------------------|
| `/` | 43 / 45 / 46 | 45 | 4615 | 2433 | 0.000 | 165.3 |
| `/doctors` | 47 / 43 / 47 | 47 | 4131 | 3225 | 0.000 | 172.7 |
| `/lab-tests` | 53 / 41 / 56 | 53 | 3515 | 3423 | 0.000 | 159.7 |
| `/health-packages` | 42 / 44 / 55 | 44 | 4530 | 1951 | 0.000 | 151.9 |

**Caveat — read before using these as SC-003 targets.** Scores are far below 90 and TBT is in the seconds, which points at this development laptop being CPU-bound (Lighthouse simulates a slow phone on top of the host's speed) rather than at the site. Run-to-run spread is large (e.g. `/lab-tests` 41–56). T074 must therefore be run on the same machine under the same conditions and compared against these numbers ("≥ baseline"). The "≥ 90 mobile" part of SC-003 cannot be demonstrated on this hardware and needs a faster machine or CI.
JS kB is the sum of `Script` transfer sizes from Lighthouse's network-requests audit.
