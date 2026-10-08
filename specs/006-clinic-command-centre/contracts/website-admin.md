# Website Contract: Command Centre routes, BFF and isolation

Companion to `command-centre-api.openapi.yaml`. Follows the 005 pattern (`specs/005-appointment-booking/contracts/website-booking.md`): same-origin route handlers, server-only backend calls, no Server Actions, no rewrites.

## 1. Pages (`src/app/(admin)/admin/…`, own root layout)

| URL | Access | Notes |
|---|---|---|
| `/admin/login` | public | email + password form; "View Demo Dashboard" button; disclaimer + "Designed & built by Shuaib Ali" credit (Principle I); no sign-up link anywhere |
| `/admin` | staff, demo | Overview |
| `/admin/bookings` | staff, demo | URL may hold only `from`, `to`, `doctor`, `department`, `status`, `page` (FR-021); search text is component state, sent by POST |
| `/admin/bookings?open=<reference>` | — | **not used**: the drawer state is not put in the URL (a reference is not personal, but keeping it out avoids leaking it in history/referrers) |
| `/admin/insights?range=7\|30\|90` | staff, demo | |
| `/admin/doctors` | staff, demo | Doctors today |
| `/admin/activity` | admin, demo (synthetic) | not in navigation for receptionists |
| `/admin/staff` | admin, demo (synthetic, writes disabled) | not in navigation for receptionists |
| `/admin/account/password` | staff | forced destination while `mustChangePassword` |

All admin pages: `export const dynamic = "force-dynamic"`, metadata `robots: { index: false, follow: false }`, response headers `Cache-Control: no-store`, `X-Robots-Tag: noindex`, `Referrer-Policy: no-referrer`. `robots.ts` adds `Disallow: /admin`. The sitemap never lists admin pages (test).

No session → `302 /admin/login?next=<pathname>` (pathname only; any query string is dropped). After sign-in the user returns to `next` if it is a same-site `/admin…` path (open-redirect guard), else `/admin`.

## 2. Session cookie

`__Host-cc_session=<token>; Secure; HttpOnly; SameSite=Strict; Path=/` (no `Domain`, no `Max-Age`). Token prefixes: `cs_` staff, `cd_` demo. In `next dev` over plain `http://localhost` the same attributes are used (Chromium/Firefox/WebKit treat localhost as a secure context); the e2e servers run on `localhost`, not `127.0.0.1`.

Theme preference: `cc_theme=light|dark|system; Path=/admin; SameSite=Lax; Max-Age=31536000` (not sensitive, readable by JS by design).

## 3. Route handlers

| Handler | Method | Backend call | Cookie effect |
|---|---|---|---|
| `app/api/admin/session/route.ts` | POST (sign-in, JSON) | `POST /admin/auth/sign-in` | set on 200; body to browser = `viewer` only (token stripped) |
| `app/api/admin/session/route.ts` | DELETE (sign-out) | `POST /admin/auth/sign-out` | cleared (always, even if backend fails) |
| `app/(admin)/admin/demo/start/route.ts` | POST (HTML form, `application/x-www-form-urlencoded`) | `POST /admin/demo/start` | set; `303 → /admin`; on 429 → `303 → /admin/login?demo=busy` |
| `app/api/admin/password/route.ts` | POST | `POST /admin/auth/change-password` | replaced with the new token |
| `app/api/admin/[...path]/route.ts` | GET/POST/PATCH | allow-list below | none |

**Allow-list** (`src/admin/lib/bffRoutes.ts`, one table used by the catch-all handler AND by `src/admin/lib/server.ts` for server components):

| Method | Browser path `/api/admin/…` | Backend path | Body limit | Timeout |
|---|---|---|---|---|
| GET | `me` | `/admin/auth/me` | – | 5 s |
| GET | `lookups` | `/admin/lookups` | – | 5 s |
| GET | `overview` | `/admin/overview` | – | 8 s |
| POST | `bookings/search` | `/admin/bookings/search` | 2 KB | 8 s |
| GET | `bookings/{ref}` | `/admin/bookings/{ref}` | – | 5 s |
| POST | `bookings/{ref}/status` | same | 1 KB | 10 s |
| POST | `bookings/{ref}/status/undo` | same | 1 KB | 10 s |
| POST | `bookings/{ref}/reveal-phone` | same | 0 | 5 s |
| GET | `insights?range=` | `/admin/insights?range=` (range validated 7/30/90) | – | 8 s |
| GET | `doctors-today` | `/admin/doctors-today` | – | 8 s |
| GET | `activity?action=&staffId=&page=` | same (params validated) | – | 8 s |
| GET | `staff` | `/admin/staff` | – | 5 s |
| POST | `staff` | `/admin/staff` | 2 KB | 10 s |
| POST | `staff/{id}/reset-password` | same | 1 KB | 10 s |
| PATCH | `staff/{id}` | same | 1 KB | 10 s |

`{ref}` must match `^[0-9A-HJKMNP-TV-Z]{10}$`, `{id}` a UUID; anything else → 404 before any backend call.

**Guards on every non-GET**: `isSameOrigin` (005), `Content-Type: application/json`, body limit; `X-CSRF-Token` from the browser is forwarded as-is (the backend validates it). **Headers added**: `X-Proxy-Secret`, `X-Client-IP` (005 `clientIpFrom`), `X-Request-ID`, `X-Session-Token` (from cookie). **Pass-through statuses**: 200, 201, 204, 401, 403, 404, 409, 422, 429, 503; 5xx → `502 upstream_error`; timeout → `504 timeout`. A backend `401` also clears the cookie. **Logging**: method + path template + status + duration + request id only.

## 4. Public-site entry points (zero admin code)

- `SiteFooter` and the About page get a "View Demo Dashboard" control rendered as `<form method="post" action="/admin/demo/start"><button>…</button></form>` — no `<Link>`, no client component, no prefetch (research R12). A small `DemoDashboardButton` server component is shared by both.
- The login page has the same form plus the sign-in form.

## 5. Isolation proofs (CI)

1. `npm run build && node scripts/check-admin-isolation.mjs` — no public route's JS/CSS manifest references an admin-only chunk; no admin class/marker in public CSS.
2. `tests/e2e/admin-isolation.spec.ts` — all public routes, idle + hover/scroll prefetch, no script/stylesheet response contains `__SH_COMMAND_CENTRE__`, no request to admin chunks, no admin font file requested.
3. Lighthouse on the 005 page set, same procedure; scores ≥ baseline in `results.md`.

## 6. Mock API (tests)

`tests/mock-api/server.mjs` gains the admin endpoints backed by the **same demo fixture JSON** the design preview uses (`tests/fixtures/admin/demo-day.json`, produced by the backend generator for a fixed date and committed), plus switchable modes: `admin-down`, `admin-slow`, `session-expired`, `booking-changed` (409), so e2e can cover offline/error states without the backend.
