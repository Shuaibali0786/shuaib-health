# ADR-0012: Specialty Presets as a Static, Demo-Only Showcase

- **Status:** Proposed (agent, unattended run 2026-11-07; needs owner acceptance)
- **Date:** 2026-11-07
- **Feature:** 009-specialty-presets
- **Context:**
  - Fiverr buyers are dental, aesthetic, lab and multi-speciality clinics; each must see "their" clinic.
  - The live site is statically rendered from the catalog API (revalidate 300 s), reaching Lighthouse mobile ≥ 90.
  - The product rule is one codebase; client differences are settings or flags, never copied code.

## Decision
- Presets are **data** (`frontend/src/presets/specialties.ts`), rendered by **one** shared showcase component at `/demo/specialties/[preset]`, statically generated for the four ids.
- Theme by a `data-preset` attribute and CSS custom properties built from `tokens.css`.
- Gated by the existing `DEMO_ENABLED` flag (404 when off), `noindex`, not in the sitemap.
- Booking, slip and dashboard are shown as labelled previews that link to the real flows.

## Consequences
- Positive: zero risk to live pages and baselines; static and fast; no DB/API change; easy to add a preset (one data record).
- Negative: the real booking flow and dashboard are not re-skinned per preset; a buyer sees previews, then the shared real demo.
- Later: when a real client is onboarded, the same preset record can seed their white-label settings (clinic name, accent) — a separate feature.

## Alternatives considered
1. **Whole-site re-skin by cookie**: every page becomes dynamic (no static cache), Lighthouse drops, and doctors/departments would need per-preset catalogs in Postgres. Rejected for risk and cost.
2. **Four separate demo deployments**: four Vercel projects and databases; breaks "one codebase", more free-tier usage. Rejected.
3. **Client-side theme switch on the home page**: hydration cost on the most important page and mixed real/preset data. Rejected.

## References
- `specs/009-specialty-presets/spec.md`, `plan.md`; ADR-0009 (demo mode); memory: demo clinic stays noindex.
