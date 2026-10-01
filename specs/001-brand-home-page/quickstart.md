# Quickstart: Feature 001 (Windows CMD)

**Feature**: 001-brand-home-page | **Date**: 2026-09-30

All commands are Windows CMD syntax and are run from the repository root `D:\shuaib-health` unless stated. **Nothing here has been run yet**: `/sp.plan` writes documents only. These are the steps the implementation tasks will follow, and the checks to confirm the feature works.

## 1. Prerequisites

```bat
node -v
npm -v
```

Expected: Node `v24.x`, npm 10 or newer. If Node is not 24, install Node 24 LTS before continuing.

## 2. Scaffold (implementation task, not run yet)

Confirm the current flag names first, because they can change between releases:

```bat
npx create-next-app@16.3.7 --help
```

Then create the app in `frontend` (TypeScript, Tailwind, ESLint, App Router, `src/` directory, `@/*` alias, npm):

```bat
npx create-next-app@16.3.7 frontend --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Pin the toolchain versions chosen in `research.md` R1 (the scaffolder may install newer majors):

```bat
cd frontend
npm install -D typescript@~6.0.3 eslint@^9.39.5
npm ls typescript eslint
```

Check for extra files the scaffolder created (for example `frontend\AGENTS.md`) and remove any that duplicate the repository-level guidance.

## 3. Install feature dependencies (implementation task)

```bat
cd frontend
npm install framer-motion@13.4.6 lucide-react@1.49.0
npm install -D vitest@5.0.2 vite@^8.3.1 @vitejs/plugin-react@6.1.1 vite-tsconfig-paths@6.1.1 jsdom@30.1.1 @testing-library/react@16.3.3 @testing-library/dom @testing-library/jest-dom@7.0.1 @testing-library/user-event@14.6.7 @playwright/test@1.63.0 @axe-core/playwright@4.13.0
npx playwright install chromium
```

Do NOT install Zustand, React Hook Form or Zod in this feature.

## 4. Set the npm scripts (implementation task)

`frontend\package.json` must contain these scripts, with no shell-specific syntax:

| Script | Command |
|--------|---------|
| `dev` | `next dev` |
| `build` | `next build` |
| `start` | `next start` |
| `lint` | `eslint .` |
| `typecheck` | `tsc --noEmit` |
| `test` | `vitest run` |
| `test:e2e` | `playwright test` |
| `images:placeholders` | `node scripts/generate-placeholder-images.mjs` |

and `"engines": { "node": "24.x" }`.

## 5. Generate placeholder images

```bat
cd frontend
npm run images:placeholders
dir public\images /s /b
```

Expected: the 17 files listed in [image-manifest.md](./image-manifest.md).

## 6. Run the app

```bat
cd frontend
npm run dev
```

Open http://localhost:3000. Stop with Ctrl+C. No environment file is needed: this feature reads no environment variables and calls no backend.

## 7. Quality gates (run all before merging)

```bat
cd frontend
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

`npm run test:e2e` builds the app and starts it on port 3100 by itself (see `playwright.config.ts`). If port 3100 is busy, stop the other process first.

### Resilience check (Constitution V)

Confirm the build works with no backend and no environment variables:

```bat
cd frontend
set NEXT_PUBLIC_API_URL=http://127.0.0.1:9
set BACKEND_URL=http://127.0.0.1:9
npm run build
set NEXT_PUBLIC_API_URL=
set BACKEND_URL=
```

Expected: the build succeeds. (`127.0.0.1:9` is a closed port. The feature does not read these variables at all; the check guards against a future accidental dependency.)

## 8. Manual verification checklist

Use Chrome DevTools device toolbar at 320, 390 and 1280 px wide.

- [ ] Notice bar reads exactly "Portfolio demo — not a real clinic, not medical advice." on `/`, `/doctors`, and a nonsense URL.
- [ ] 390 px: logo, call icon, Book button, menu button in the header; hero headline and both hero buttons visible without scrolling.
- [ ] 1280 px: eight nav links, emergency phone and Book Appointment visible; current page underlined.
- [ ] Menu: opens, Escape closes it and focus returns to the menu button.
- [ ] Tab from page load: "Skip to main content" is first, focus ring visible everywhere.
- [ ] Sections appear in order: Hero, How can we help you?, Departments (7), Facts band, Why choose us + Emergency card, Featured doctors (4, each "Sample"), Health Tips (3, each "Sample"), CTA band.
- [ ] Click every header, footer and Home link: none reaches a 404; unbuilt pages say "Coming soon".
- [ ] `/no-such-page` shows "Page not found" and returns 404 (DevTools Network).
- [ ] Footer credit "Designed & built by Shuaib Ali" links to https://github.com/Shuaibali0786.
- [ ] Windows Settings → Accessibility → Visual effects → Animation effects **off** (or DevTools Rendering → "Emulate prefers-reduced-motion: reduce"): nothing slides or scales.
- [ ] Zoom to 200%: content reflows, no horizontal scrollbar.

### Performance check (SC-008, manual for now)

In Chrome DevTools, open Lighthouse, choose Mobile and Performance, and run it against the production build (`npm run build` then `npm run start`, http://localhost:3000). Record LCP, INP or TBT, and CLS in the pull request. Targets: LCP ≤ 2.5 s, CLS ≤ 0.1. (Automated Lighthouse CI budgets arrive in Phase 4.)

## 9. Replacing placeholder images later

See [image-manifest.md](./image-manifest.md). In short, from `frontend\`:

```bat
npm run images -- check
npm run images -- fit "C:\Users\You\Downloads\doctor.jpg" hero-doctor
npm run images -- check
```

Then update the alt text in `frontend\src\data` for that image.

## 10. Cleanup helpers (CMD)

```bat
cd frontend
rmdir /s /q .next
rmdir /s /q node_modules
del package-lock.json
```

Only use the last two lines if you intend to reinstall from scratch.
