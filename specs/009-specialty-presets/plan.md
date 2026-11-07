# Implementation Plan: Specialty Demo Presets

**Branch**: `009-specialty-presets` | **Date**: 2026-11-07 | **Spec**: [spec.md](./spec.md) | **ADR**: [ADR-0012](../../history/adr/0012-specialty-presets-as-static-demo-showcase.md)

## Summary
A static, demo-only showcase at `/demo/specialties/[preset]` that renders one shared page component from four preset data records. Theme by `data-preset` + CSS custom properties. No API, database or env change; the existing `DEMO_ENABLED` flag gates it.

## Technical Context
Next.js 16.4 App Router (`generateStaticParams`, `dynamicParams = false`), Tailwind v4 tokens, `next/image`, lucide icons (already a dependency). Tests: Vitest (data + switcher), Playwright (`specialties.spec.ts`, mobile + desktop, axe).

## Constitution Check
| Principle | Status |
|---|---|
| I Honesty | "Sample clinic" + sample doctor badges; site disclaimer from the (site) layout; no ratings/awards (honesty grep test) |
| II Privacy | No personal data; fake contact `test@example.com`, `0300 1234567` |
| V Resilience | Static data, no fetch; works with API down |
| VIII Design | Tokens only; reduced motion respected; `next/image` with sizes/alt |
| XI Safe change | Demo flag gate, no existing page touched, noindex |

## Structure
```
frontend/src/presets/specialties.ts            # data: 4 presets (FR-001)
frontend/src/components/presets/PresetSwitcher.tsx
frontend/src/components/presets/PresetShowcase.tsx   # hero, services, doctors, previews
frontend/src/app/(site)/demo/specialties/page.tsx            # redirect → multi-speciality
frontend/src/app/(site)/demo/specialties/[preset]/page.tsx   # static, noindex, demo-gated
frontend/src/app/tokens.css                    # + rose/violet accent tokens if needed
frontend/src/app/(site)/site.css               # [data-preset] theme variables
frontend/src/lib/pages.ts                      # manifest entries, inSitemap: false (if required by tests)
```

## Decisions
- Static showcase vs. whole-site re-skin → ADR-0012 (performance, zero risk to live pages, no DB catalog per preset).
- Monogram avatars for preset doctors (honesty: no reused faces under new names).

## Risks
- Manifest/route tests may require every route listed: add entries with `inSitemap: false`.
- Honesty grep words (rated, award…) must not appear in preset copy.
