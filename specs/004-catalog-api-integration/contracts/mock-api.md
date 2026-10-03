# Contract: Mock Catalog API (tests only)

**Location**: `frontend/tests/mock-api/server.mjs` (Node built-ins only, no new dependency)
**Purpose**: Playwright cannot intercept fetches made by the Next server, so end-to-end tests point `CATALOG_API_URL` at this server.

## Behaviour

- Serves `GET /api/v1/{clinic, clinic/rules, departments, doctors, lab-test-categories, lab-tests, health-packages}` from `tests/fixtures/api/*.json`, honouring `page`/`pageSize` and returning the envelope from the OpenAPI contract, `Content-Type: application/json` and an `X-Request-ID` header.
- Listens on `127.0.0.1:${MOCK_API_PORT:-4010}`.

## Control endpoint

`POST /__mode` with body `{ "mode": "<mode>", "resources"?: string[] }`. Returns `204`. `GET /__mode` returns the current mode.

| Mode | Effect on catalog endpoints (or only `resources` if given) |
|---|---|
| `ok` | fixtures, 200 |
| `down` | socket destroyed immediately (connection reset) |
| `slow` | responds correctly after 60 s (simulates a sleeping host) |
| `error500` | `500` with the standard error JSON |
| `malformed` | 200 with a body missing a required field |
| `partial` | `departments` → 500, everything else `ok` |
| `extra` | `doctors` gains `dr-test-new` (first department) |
| `rename` | the first featured doctor's `fullName` becomes "Dr Renamed Test" |
| `rules-empty` | `clinic/rules` returns `items: []` |
| `rebrand` | `clinic` gets a different name and emergency number; `clinic/rules` gains a 6th rule |

`POST /__reset` sets the mode back to `ok` and clears the request log. The starting mode comes from `MOCK_API_MODE` (default `ok`). `GET /__log` returns `{ [resource]: count }`, the catalog requests since the last reset. The control endpoints exist only in this test server.

## Use in Playwright

- **Main** (`playwright.config.ts`): `webServer` = [mock API on 4010 (mode `ok`), `next build && next start` with `CATALOG_API_URL=http://127.0.0.1:4010`]. Existing specs run unchanged against seeded fixture data and never switch modes. `tests/e2e/stateful/**` and `tests/e2e/offline/**` are ignored.
- **Stateful** (`playwright.stateful.config.ts`, 1 worker): a mock on 4011 + `next dev` on 3300 with `CATALOG_DATA_REVALIDATE_SECONDS=3`, and a cold pair (mock on 4012 started with `MOCK_API_MODE=partial` + `next dev` on 3301 with an emptied build folder). Specs switch modes, wait past the 3 s data window, and assert through `/__log` that the API was called after the switch. They check last good data within 4 s with status 200, recovery, new/renamed records, and rules/rebrand.
- **Offline** (`playwright.offline.config.ts`): two production builds in separate `NEXT_DIST_DIR` folders, one with `CATALOG_API_URL=http://127.0.0.1:9` (nothing listening) and one with the variable unset. They assert the build succeeds, every public route returns 200 with `DataUnavailable` in catalog sections, header/footer render, the demo notice and credit text/`href` are present, and the emergency number is visible when `CLINIC_FALLBACK_JSON` is set.
