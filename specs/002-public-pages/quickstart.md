# Quickstart: Feature 002

**Feature**: 002-public-pages | **Date**: 2026-10-02

Windows CMD, from `D:\shuaib-health\frontend`. Nothing needs a backend, a database or any environment variable.

## Run

```bat
cd D:\shuaib-health\frontend
npm install
npm run dev
```

Open http://localhost:3000. (`npm install` pulls `react-hook-form`, `zod` and `@hookform/resolvers` after Phase A.)

## Checks (the merge gate)

```bat
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run images -- check
```

- `npm run build` must succeed with no environment variables set. It lists every static route and every detail page (`/doctors/<slug>` ×9, `/departments/<slug>` ×7, `/lab-tests/<slug>` ×24+, `/health-tips/<slug>` ×6) as prerendered.
- `npm run images -- check` must report 24 real images and 0 problems (17 from Feature 001 + 5 doctors + 2 tips).
- Optional: set `SITE_URL` (see `.env.example`) to see absolute URLs in `/sitemap.xml`. The default is `http://localhost:3000`.

## Manual walkthrough (per phase)

**P1 — Doctors and Departments**
1. `/doctors`: nine cards, each with "Sample profile". Choose Pediatrics → two doctors. Type `sana` → one. Type `dr.` alone → still all doctors. Choose a day with no session → "No doctors match your filters" and "Clear filters".
2. Open a doctor: schedule table (Asia/Karachi), fee in PKR, department link, "Book appointment" → "Booking coming soon".
3. `/departments` → seven cards; open each; confirm doctors and ≥ 3 related tests with working links.
4. `/doctors/nobody` → friendly not-found page.

**P2 — Lab tests and packages**
1. `/lab-tests`: search `sugar`, `hba1c`, `cbc`; click each category chip; open a test page and check the facts and the "Sample price" label.
2. `/health-packages`: five packages; compare "Sum of individual tests", "Package price", "Difference"; click an included test.

**P3 — Content and trust pages**
1. `/health-tips`: filter by category; open an article; the note "General information, not medical advice" and related articles appear.
2. `/about`, `/faq` (expand with Enter/Space; open `/faq#home-sample-collection`), `/privacy`, `/terms` (last updated 2 Oct 2026, demo notices).
3. `/contact`: submit empty, then invalid, then valid → "Messages are not sent in this demo yet"; open DevTools → Network: no request on submit. Press "Show map" → the only external request (OpenStreetMap).

**Everywhere**: 320 px and 390 px widths (no sideways scroll), keyboard only (skip link, focus visible), emulate "prefers-reduced-motion: reduce", and confirm the notice bar and the credit link.

## Performance (manual Lighthouse, mobile, production build)

Run `npm run build && npm run start`, then Lighthouse on `/doctors`, `/lab-tests`, `/contact`. Record here after Phase E: LCP ≤ 2.5 s, CLS ≤ 0.1, INP ≤ 200 ms; gzip first-load JS of `/contact` vs `/doctors` (the form libraries must not appear on other routes).

| Route | LCP | CLS | INP | First-load JS (gzip) |
|-------|-----|-----|-----|----------------------|
| `/doctors` | _to record_ | | | |
| `/lab-tests` | _to record_ | | | |
| `/contact` | _to record_ | | | |

## Images

The seven new photos are already in `frontend/public/images` (`doctors/` ×5, `tips/` ×2) and registered in `scripts/image-list.mjs`. The five doctor photos are referenced by `data/doctors.ts`. The two tip photos are listed in a `PENDING` allow-list in `images.test.ts` until the health tip records (US5, task T071) reference them.

Alt text for the doctor photos begins "Stock photo of a model presented as sample doctor …" (the photos are real models, not our staff); describe what is visible after that:

| File | Alt text |
|------|----------|
| `doctors/dr-maryam-baloch.jpg` | Stock photo of a model presented as sample doctor Dr. Maryam Baloch: a smiling woman with long dark hair in a white coat with a stethoscope around her neck |
| `doctors/dr-bilal-ansari.jpg` | Stock photo of a model presented as sample doctor Dr. Bilal Ansari: a man in teal scrubs with a stethoscope, reading a book |
| `doctors/dr-zainab-memon.jpg` | Stock photo of a model presented as sample doctor Dr. Zainab Memon: a woman in a white lab coat and gloves working at a laboratory bench |
| `doctors/dr-omar-sheikh.jpg` | Stock photo of a model presented as sample doctor Dr. Omar Sheikh: a bearded man in a white coat over a maroon shirt, hands in pockets |
| `doctors/dr-faisal-chaudhry.jpg` | Stock photo of a model presented as sample doctor Dr. Faisal Chaudhry: a smiling man in glasses and a white coat with a stethoscope, holding a measuring tape |
| `tips/hand-hygiene.jpg` | Hands being washed with soap under a running tap |
| `tips/managing-stress.jpg` | Woman sitting calmly with her eyes closed against a plain wall, breathing slowly |

## Troubleshooting

- **A page shows the old "Coming soon" text**: the path is still in the placeholder registry; it should be removed in that page's phase.
- **Build error "Missing Suspense boundary with useSearchParams"**: wrap the filter island in `<Suspense>` (see plan, List pages).
- **Map blank**: the visitor chose not to show it, or is offline; the text address is the fallback by design.
