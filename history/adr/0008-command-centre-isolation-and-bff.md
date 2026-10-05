# ADR-0008: Command Centre Isolation and Allow-Listed BFF

> **Scope**: Document decision clusters, not individual technology choices. Group related decisions that work together (e.g., "Frontend Stack" not separate ADRs for framework, styling, deployment).

- **Status:** Accepted
- **Date:** 2026-10-05
- **Feature:** 006-clinic-command-centre
- **Context:**
  - The staff Command Centre lives inside the same Next.js app as the public website, under `/admin`.
  - FR-036 requires that no admin JS, CSS or font ever loads on a public page, and that public Lighthouse scores do not drop.
  - Feature 005 showed that `<Link>` prefetch can pull a route's JS into pages that only link to it (005 `results.md`).
  - Public CSS is inlined (`inlineCss: true`), so any admin class that leaks into the public Tailwind scan makes every public page heavier.
  - The browser must never call the backend directly (constitution VI, ADR-0006); the website server must add the session, CSRF and proxy headers.

## Decision

- **Two root layouts**: public routes move with `git mv` (URLs unchanged) into `src/app/(site)/`. The Command Centre gets its own root layout in `src/app/(admin)/admin/` with its own `<html>`, fonts, theme attribute and `robots: noindex`. Crossing between them is a full page load. `global-not-found.tsx` replaces the single `not-found.tsx`, as Next 16 requires with multiple root layouts.
- **Code boundary**: all Command Centre code lives in `src/admin/`. ESLint `no-restricted-imports` forbids public code from importing `@/admin/*`.
- **Separate CSS entries**: `tokens.css` is the single source of brand hex values. `site.css` and `admin.css` each import Tailwind with `source(none)` and scan only their own trees.
- **Fonts**: admin fonts are loaded with `next/font` only in the admin root layout.
- **BFF**: one catch-all route `src/app/api/admin/[...path]/route.ts` with an explicit allow-list (method + path pattern → backend path, body limit, timeout). Anything else → 404. It reads the cookie, adds `X-Session-Token`, `X-CSRF-Token`, `X-Proxy-Secret`, `X-Client-IP` and `X-Request-ID`, enforces `isSameOrigin` on non-GET, sets `Cache-Control: no-store` and `X-Robots-Tag: noindex`, and logs path templates only. Sign-in, sign-out and demo start are dedicated handlers because they set or clear the cookie.
- **Rendering**: server components fetch the first view through a server-only helper using the same allow-list, then hand data to small client islands.
- **Demo entry**: the public "View Demo Dashboard" control is a plain `<form method="post">` button, never a `<Link>`, so it cannot be prefetched and works without JS.
- **Proof, in CI**: (1) `scripts/check-admin-isolation.mjs` reads the build manifests and fails if a public route references an admin-only chunk or its CSS contains an admin marker class; (2) a Playwright test visits every public route, triggers prefetch, and asserts no response contains the sentinel `__SH_COMMAND_CENTRE__`; (3) Lighthouse on public pages is re-measured against the 005 baseline.

## Consequences

### Positive

- Isolation is structural and proven twice (build output and real network traffic), not a convention.
- Public pages keep their current CSS size and performance.
- The backend's attack surface shrinks to the BFF allow-list; unknown admin paths are 404 at the website.
- Admin typography and the dark theme can change freely without touching the public site.

### Negative

- A large one-off file move in the website; it is done as a pure `git mv` commit gated by the full existing test suite.
- Two layouts and two CSS entries to maintain; shared tokens must stay in `tokens.css`.
- Moving from public pages to `/admin` is a full page load (acceptable: staff and demo visitors cross once).
- Every new admin endpoint needs an allow-list entry in the BFF as well as a backend policy (ADR-0007).

## Alternatives Considered

- **One root layout with client-side "hide site chrome on /admin"**: ships site chrome and fonts to admin and couples bundles. Rejected.
- **Separate Next.js app on a subdomain**: two deployments, duplicated tokens and cross-subdomain cookie scope. Rejected.
- **Server Actions instead of route handlers**: 005 chose route handlers; one pattern is easier to guard and test. Rejected.
- **Generic pass-through proxy (forward any `/api/admin/*`)**: simpler, but any backend endpoint becomes reachable from the browser. Rejected for the allow-list.

## References

- Feature Spec: [specs/006-clinic-command-centre/spec.md](../../specs/006-clinic-command-centre/spec.md) (FR-036, SC-007)
- Implementation Plan: [specs/006-clinic-command-centre/plan.md](../../specs/006-clinic-command-centre/plan.md) (Key Decision 3, Phase 3, Risks 1–2)
- Research: [research.md R11, R12](../../specs/006-clinic-command-centre/research.md); [contracts/website-admin.md](../../specs/006-clinic-command-centre/contracts/website-admin.md)
- Related ADRs: ADR-0004 (caching and resilience), ADR-0006 (proxy trust), ADR-0007 (staff auth)
- Evaluator Evidence: [history/prompts/006-clinic-command-centre/004-constitution-adrs-design-preview.misc.prompt.md](../prompts/006-clinic-command-centre/004-constitution-adrs-design-preview.misc.prompt.md)
