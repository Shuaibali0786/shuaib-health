# Results: 008 Command Centre Completion

Run: unattended overnight, 6–7 Nov 2026, Windows laptop, Node 24. Mock API (no database touched).

## Gates (local)

| Check | Result |
|---|---|
| `npm run typecheck` | pass |
| `npm run lint` | pass |
| `npm test` (Vitest, full) | **1450 passed** (111 files) after one guard fix: the first run flagged hex colours in `admin.css`; replaced by tokens |
| New unit tests `tests/unit/admin-completion.test.tsx` | 8 passed (range maths incl. month/year/leap edges, chips, roles table vs nav rule, print button) |
| Playwright `admin-bookings admin-staff admin-a11y admin-visual admin-mobile admin-clipping` on admin-desktop, admin-laptop-1280, admin-mobile | **200 passed, 34 skipped, 12 failed — all 12 are visual baselines of the Bookings screen (expected change)** |

## Visual baselines (playbook rule 5) — owner decision needed

The 12 failing screenshots are `bookings-*`, `the Bookings drawer`, `the confirmation dialog` (desktop/1280: light + dark; mobile: Bookings light + dark). Cause: the new **quick-range chip row** and the **Print list** button on Bookings. Nothing else on the screen moved. Evidence (light theme): `results/visual-diff/bookings-light-{desktop,mobile}-{expected,actual,diff}.png` (desktop diff: 0.04 of pixels on mobile Bookings dark, see log).

Baselines were **not** regenerated (Windows or Linux) because the playbook requires the owner to see the diff first. To accept:
1. Windows: `cd frontend && npx playwright test admin-visual --update-snapshots` (only Bookings files change).
2. Linux: delete the matching `bookings-*-linux.png`, `bookings-drawer*`, `confirm*` Linux files on the branch and run the **Linux visual baselines** workflow on the branch, then commit the artifact.

Until then the `e2e` CI check is expected to fail on those 12 screenshots only.

## Not done
- T013 full e2e across all projects: run in CI.
- T014 baseline regeneration: waiting for owner approval (above).

## CI round 1 fix (7 Nov, same night)
CI also failed `admin-demo-polish.spec.ts` "one set of numbers" on every admin project. That test reads the first `.chips` row as the status chips, and the new date-range row had taken that place. The date-range row now has its own class (`.quick-ranges`, same look); the old test is unchanged. Local re-run of `admin-demo-polish admin-bookings admin-mobile admin-clipping admin-a11y` (admin-desktop, admin-mobile): **101 passed, 21 skipped**. The remaining CI failures should be only the 12 expected Bookings screenshots.
