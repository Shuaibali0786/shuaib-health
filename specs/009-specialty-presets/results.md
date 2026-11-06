# Results: 009 Specialty presets

Run: unattended overnight, 7 Nov 2026, Windows laptop, mock API, demo on.

| Check | Result |
|---|---|
| typecheck, lint | pass |
| Vitest full | **1451 passed** (new `specialty-presets.test.tsx`: 9 tests) after two guard fixes (brand word, catalog name) |
| Playwright `specialties pages links seo honesty images` (mobile + desktop) | **330 passed** (316 + 14 after one strict-locator fix in the new spec) |
| Visual baselines | none changed (no existing page touched) |
| Lighthouse mobile | not measured overnight (see analysis A5) |

Screenshots: `docs/showcase/` (feature 5 branch).

Routes: `/demo/specialties` (Multi-speciality first), `/demo/specialties/{dental,skin-aesthetic,diagnostic-lab,multi-speciality}`. 404 with `DEMO_ENABLED=false` or an unknown id. `noindex`, not in the sitemap.
