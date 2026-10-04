# Contract: Website Data-Access Layer

**Feature**: 004-catalog-api-integration
**Upstream contract (source of truth)**: [`specs/003-catalog-api/contracts/openapi.yaml`](../../003-catalog-api/contracts/openapi.yaml). This feature adds **no** API endpoints and changes none.

## 1. Module boundaries

```text
src/lib/api/
├── config.ts        server-only; reads CATALOG_API_URL, CLINIC_FALLBACK_JSON, CATALOG_DATA_REVALIDATE_SECONDS
├── schema.gen.ts    GENERATED from openapi.yaml (npm run api:types) — do not edit
├── schemas.ts       zod schemas, one per component schema used
├── http.ts          getJson(path, schema, signal?): the ONLY fetch() call; 3 s timeout by default; throws ApiError
├── paginate.ts      getAllPages(path, itemSchema): page 1, then pages 2..n in parallel, one shared 3 s signal
├── cached.ts        unstable_cache wrappers (revalidate getDataRevalidateSeconds() = 300 default, tags) — throw when no last good
└── load.ts          Loaded<T> wrappers: catch → { ok:false, reason }, log once
src/lib/content.ts   public accessors used by pages/components (existing file, same exports + load*)
```

Rules:
- Only `http.ts` calls `fetch`. Only `config.ts` reads `process.env` for the API. Each of `config.ts`, `http.ts`, `cached.ts` and `load.ts` starts with `import "server-only"`.
- Components never import `src/lib/api/*`; pages and server components use `src/lib/content.ts`.
- Client components receive data as props (e.g. `MapEmbed` gets `mapArea` and `address` from its server parent).

## 2. Functions

```ts
// http.ts
class ApiError extends Error {
  kind: "unconfigured" | "network" | "timeout" | "status" | "invalid";
  status?: number;       // for kind "status"
  requestId?: string;    // from X-Request-ID response header, for logs
}
function getJson<T>(path: `/${string}`, schema: z.ZodType<T>, signal?: AbortSignal): Promise<T>; // default AbortSignal.timeout(3000); throws ApiError

// paginate.ts
function getAllPages<T>(path: string, item: z.ZodType<T>): Promise<T[]>;   // pageSize=100; one AbortSignal.timeout(3000) for all pages; throws ApiError

// cached.ts  (each: unstable_cache(fn, ["api", key], { revalidate: getDataRevalidateSeconds(), tags: ["catalog", key] }))
const cachedClinic: () => Promise<ClinicSettings>;
const cachedClinicRules, cachedDepartments, cachedDoctors,
      cachedLabTestCategories, cachedLabTests, cachedHealthPackages: () => Promise<T[]>;

// load.ts
type Loaded<T> = { ok: true; data: T } | { ok: false; reason: "unconfigured" | "unavailable" };
function load<T>(name: string, fn: () => Promise<T>): Promise<Loaded<T>>;   // never throws
```

## 3. Error taxonomy → behaviour

| Condition | `ApiError.kind` | Cached last good exists | No last good |
|---|---|---|---|
| `CATALOG_API_URL` unset | `unconfigured` | n/a (never cached) | `Loaded{ok:false,"unconfigured"}` → fallback UI |
| DNS/connection refused | `network` | stale value served | `unavailable` → fallback UI |
| > 3 s for the resource (all pages together) | `timeout` | stale value served | `unavailable` → fallback UI |
| 404 on a list endpoint, 429, 5xx | `status` | stale value served | `unavailable` → fallback UI |
| Body fails zod | `invalid` | stale value served | `unavailable` → fallback UI |
| Slug not in a loaded list | — | — | `notFound()` (real 404) |

Logging (server only): one `console.warn` line per failure: `{"event":"catalog_api_unavailable","resource":"doctors","kind":"timeout","requestId":"…"}`. No URL query strings, no response bodies, no personal data (FR-016).

## 4. Configuration contract

| Variable | Scope | Required | Example | Notes |
|---|---|---|---|---|
| `CATALOG_API_URL` | server | no (unset ⇒ unavailable) | `http://localhost:8000` | Origin only; `/api/v1` appended. Must be `http(s)://`; invalid ⇒ treated as unset + warn. |
| `CLINIC_FALLBACK_JSON` | server | no | `{"name":"Shuaib Health",…}` | Full `ClinicSettings` JSON; validated; used only when clinic settings never loaded. |
| `CATALOG_DATA_REVALIDATE_SECONDS` | server | no | unset | **Tests only.** Integer 1–3600 overriding the 300 s data-cache window (the stateful e2e server uses 3). Invalid ⇒ 300 + warn. |
| `SITE_URL` | server | no | `http://localhost:3000` | Existing. |

Values per environment: local `.env.local`; preview/production set in the hosting dashboard (deploy feature). Neither variable is `NEXT_PUBLIC_*`.

## 5. Drift checks (must fail CI)

1. `schema.gen.ts` ≠ freshly generated output from `openapi.yaml`.
2. `z.infer<typeof XSchema>` ≠ generated `components["schemas"]["X"]` (type test).
3. Generated item type not assignable to the matching `src/types/content.ts` type.
4. A recorded fixture in `tests/fixtures/api/` fails its zod schema.
5. Recorded fixtures ≠ TS catalog fixtures (field by field, by slug, ignoring IDs/refs/additive fields).
