# Quickstart: Website + Catalog API (Windows CMD)

**Feature**: 004-catalog-api-integration

## 1. Run the API (Feature 003)

```cmd
cd backend
uv run alembic upgrade head
uv run python -m app.seed
uv run uvicorn app.main:app --port 8000
```

Check it: open `http://localhost:8000/api/v1/clinic`.

## 2. Configure the website

```cmd
cd frontend
copy .env.example .env.local
```

Edit `.env.local`:

```ini
CATALOG_API_URL=http://localhost:8000
# Optional: shown only if clinic settings have never loaded and the API is down
CLINIC_FALLBACK_JSON={"name":"Shuaib Health", ...}
```

## 3. Run the website

```cmd
npm install
npm run dev
```

Open `http://localhost:3000`. Pages look exactly as before; the data now comes from the API.

## 4. See white-label changes

Change the clinic name in the database (or re-seed with edited `backend/app/seed/data/extras.json`). After about 5 minutes (or restart `npm run dev`, which clears the dev cache), every page shows the new name.

## 5. See resilience

```cmd
REM build with no API at all - must succeed
set CATALOG_API_URL=
npm run build
npm run start
```

Catalog sections show "temporarily unavailable"; header, footer and demo notice still render.

## 6. Tests (no API needed)

```cmd
npm run typecheck
npm run lint
npm test
npm run test:e2e            REM production build, mock API in ok mode
npm run test:e2e:stateful   REM one worker, next dev, mock mode switches (down/slow/rename/rebrand...)
npm run test:e2e:offline    REM production builds with the API dead or unset
```

## 7. When the API contract changes

```cmd
npm run api:types     REM regenerate src/lib/api/schema.gen.ts from specs/003-catalog-api/contracts/openapi.yaml
npm run api:record    REM re-record tests/fixtures/api/*.json from a locally seeded API (step 1)
npm test              REM contract tests show any remaining drift
```
