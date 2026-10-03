# Shuaib Health — frontend

Portfolio demo website for a fictional clinic and diagnostic lab in Karachi. It is not a real clinic and gives no medical advice.

Next.js (App Router), TypeScript strict, Tailwind CSS v4. Requires Node 24.

Commands (run from this folder, Windows CMD friendly):

```bat
npm install
npm run dev
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
npm run images:placeholders
```

Feature specs, plan and quickstart live in `..\specs\001-brand-home-page\`. Project rules are in `..\.specify\memory\constitution.md`.

## What changed in Feature 002 (public pages)

- New routes: `/about`, `/doctors` (+ 9 profiles), `/departments` (+ 7), `/lab-tests` (+ all tests), `/health-packages`, `/health-tips` (+ articles), `/contact`, `/faq`, `/privacy`, `/terms`. `/book-appointment` stays a holding page. Unknown paths return the friendly 404.
- Every page is listed in `src/lib/pages.ts` (the page manifest); metadata, the sitemap and the link and title tests all read it.
- Optional `SITE_URL` sets the base for canonical links, Open Graph and the sitemap (default `http://localhost:3000`). Crawlers are still asked to stay out (`siteConfig.indexable` is false).
- New dependencies: `react-hook-form`, `@hookform/resolvers` and `zod`, used only by the `/contact` form.
