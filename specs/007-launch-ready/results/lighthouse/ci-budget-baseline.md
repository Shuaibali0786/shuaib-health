# Lighthouse CI budget baseline (T114)

Measured 2026-10-10 on the laptop: production build (`next build`, `NEXT_DIST_DIR=.next-lh`) against the recorded mock API,
`next start`, Lighthouse mobile emulation, 3 runs per page. Transfer sizes in KB (identical across the 3 runs).

| Page | script | stylesheet | image | font | document | total |
|---|---|---|---|---|---|---|
| `/` | 165.9 | 0 (CSS is inlined) | 71.5 | 74.5 | 55.9 | 402.2 |
| `/doctors` | 165.9 | 0 | 40.1 | 74.5 | 48.7 | 358.2 |

Budgets in `frontend/lighthouse-budget.json` = the larger value + 10%, rounded up:

| Type | Measured (max) | Budget |
|---|---|---|
| script | 165.9 | 183 |
| stylesheet | 0 | 5 (a small floor instead of 0, so one extra external CSS file does not turn the required check red) |
| image | 71.5 | 79 |
| total | 402.2 | 443 |

Category scores on the laptop (mobile emulation, throttled, noisy): Accessibility 1.00 / 0.98, Best Practices 1.00, Performance 0.58-0.89 (varies run to run; this is why Performance is a **warning** in CI and the live measurement T067 is the binding gate), SEO 0.69 (expected: the demo is noindex).

CI runs the same pages against the real API with demo data, so image and document sizes may differ slightly; the 10% margin covers that. If the first CI run shows a larger real baseline, record it here and tell the owner before changing a budget.
