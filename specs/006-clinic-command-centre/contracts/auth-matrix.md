# Auth Matrix (SC-004)

Single source for `ENDPOINT_POLICIES` (backend `app/auth/policies.py`) and the parametrised test `backend/tests/api/test_auth_matrix.py`. An introspection test fails if any route under `/api/v1/admin` is missing from this table, lacks its `require_viewer` dependency, or if a row names a non-existent route (research R6).

Every row is ALSO tested with: no `X-Proxy-Secret` → 403; a foreign `Origin` → 403; and, for POST/PATCH, a missing or wrong `X-CSRF-Token` → 403 `csrf_failed` (except sign-in/demo start, which have no session yet).

Legend: ✅ 2xx · 401 `not_signed_in` · 403f `forbidden` · 403d `demo_read_only` · S = synthetic data only.

| Method | Path | Policy | No session | Demo | Receptionist | Admin | Must-change-password staff |
|---|---|---|---|---|---|---|---|
| POST | /admin/auth/sign-in | PUBLIC_PROXY | ✅ | ✅ (replaces demo) | ✅ (replaces) | ✅ | ✅ |
| POST | /admin/demo/start | PUBLIC_PROXY | ✅ | ✅ (fresh) | ✅ (staff session ended) | ✅ (staff session ended) | ✅ |
| GET | /admin/auth/me | SELF | 401 | ✅ | ✅ | ✅ | ✅ |
| POST | /admin/auth/sign-out | SELF | 401 | ✅ | ✅ | ✅ | ✅ |
| POST | /admin/auth/change-password | SELF_STAFF | 401 | 403d | ✅ | ✅ | ✅ |
| GET | /admin/lookups | READ | 401 | ✅ S | ✅ | ✅ | 403 `password_change_required` |
| GET | /admin/overview | READ | 401 | ✅ S | ✅ | ✅ | 403 pcr |
| POST | /admin/bookings/search | READ | 401 | ✅ S | ✅ | ✅ | 403 pcr |
| GET | /admin/bookings/{reference} | READ | 401 | ✅ S (real ref → 404) | ✅ | ✅ | 403 pcr |
| POST | /admin/bookings/{reference}/reveal-phone | READ (audited for staff) | 401 | ✅ S, nothing stored | ✅ + audit | ✅ + audit | 403 pcr |
| POST | /admin/bookings/{reference}/status | WRITE | 401 | 403d | ✅ | ✅ | 403 pcr |
| POST | /admin/bookings/{reference}/status/undo | WRITE | 401 | 403d | ✅ | ✅ | 403 pcr |
| GET | /admin/insights | READ | 401 | ✅ S | ✅ | ✅ | 403 pcr |
| GET | /admin/doctors-today | READ | 401 | ✅ S | ✅ | ✅ | 403 pcr |
| GET | /admin/activity | READ_ADMIN | 401 | ✅ S | 403f | ✅ | 403 pcr |
| GET | /admin/staff | READ_ADMIN | 401 | ✅ S | 403f | ✅ | 403 pcr |
| POST | /admin/staff | WRITE_ADMIN | 401 | 403d | 403f | ✅ | 403 pcr |
| POST | /admin/staff/{staffId}/reset-password | WRITE_ADMIN | 401 | 403d | 403f | ✅ | 403 pcr |
| PATCH | /admin/staff/{staffId} | WRITE_ADMIN | 401 | 403d | 403f | ✅ | 403 pcr |

**Session states also tested per READ/WRITE row**: expired idle (31 min, frozen clock) → 401 `session_expired`; expired absolute (12 h 1 min) → 401; ended by sign-out → 401; staff deactivated mid-session → 401; evicted 4th-session → 401; a demo token presented as staff (prefix swap) → 401; demo session past 2 h → 401.

**Data separation (SC-005)**, in the same suite: with real bookings in the DB, every READ endpoint called by a demo session returns only records with `isSample: true` and references starting `D`; every READ endpoint called by staff returns no demo reference; `DemoSource` module import guard (no DB/appointment imports).

**Website BFF matrix** (`frontend/tests/unit/admin-bff-route.test.ts`): every allow-listed route × {no cookie, cross-site Origin, `Sec-Fetch-Site: cross-site`, oversize body, non-JSON} → expected 401/403/413/415; any path not on the allow-list → 404; responses never include `token`; `Set-Cookie` only from sign-in/sign-out/demo/change-password handlers with `__Host-`, `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/`.
