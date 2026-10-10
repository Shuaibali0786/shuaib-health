# Existing-test guards (H6) — T107

**Status: RESOLVED on 2026-10-10.** The owner approved option 1 (below). Per the task, no existing test was edited or loosened first; the fix is an add-only fixture.

## What was run (2026-10-10)

`backend/tests/api/test_rate_limit_api.py`, unchanged, as a whole file:

| Mode | How | Result |
|---|---|---|
| `memory` (code default) | no environment change | **7 passed** |
| `postgres` | `RATE_LIMIT_STORE=postgres` in the environment for the whole run | **5 passed, 2 failed** |

## The two failing assertions (postgres mode only)

1. `test_spoofed_forwarded_header_does_not_evade_the_limit`:
   `assert [429, 429, 429, 429] == [404, 404, 429, 429]` (the first two requests should be 404 but are already refused).
2. `test_admin_routes_are_counted_by_the_global_limiter`:
   `assert [429, 429, 429] == [403, 403, 403]`.

## Cause

Not a defect in the limiter. These tests build several apps in one file and never give them their own database, so in `postgres` mode every app counts into the **same real table** (the dev database from `backend/.env`) under the **same address** (the test client's fixed address) inside the same 60-second window. Earlier tests in the file use up that bucket, so the later tests start already over the limit. In `memory` mode each app has its own fresh counters, which is what the tests assume.

Proof: each failing test passes when run **on its own** with `RATE_LIMIT_STORE=postgres` (both re-run alone on 2026-10-10, 1 passed each).

Side effect to know about: the postgres-mode run wrote a few expiring rows into the **dev** database table `rate_limit_counter` (hashed buckets, 60-second windows). Nothing else was touched, and no production system was involved.

## What the shared limiter itself is proven by

The new tests in `backend/tests/api/test_rate_limit_shared.py` (two app instances sharing a database share the count; `/health` writes nothing; buckets hold a hash; the database-failure behaviour) all pass, and CI runs them.

## Options for the owner (pick one)

1. **Recommended: add a new autouse fixture, add-only, that runs `test_rate_limit_api.py` against the test database with its counters emptied before each test.** No existing assertion changes. It makes the file pass in both modes.
2. Keep `test_rate_limit_api.py` as a `memory`-mode test only (production's `postgres` limiter is covered by `test_rate_limit_shared.py`), and say so in the test file's docstring.
3. Change the two assertions. **Not recommended**; it would loosen existing tests.

Nothing in production depends on this choice: it only decides how the old test file is kept honest. It blocks the merge of PR-1 until decided (tasks.md, "Existing-test guards").

## Resolution (2026-10-10)

- Added the autouse fixture `rate_limit_api_own_counters` to `backend/tests/api/conftest.py`. It applies only to `test_rate_limit_api.py` and only when `RATE_LIMIT_STORE=postgres`: it points the limiter at the test database and empties `rate_limit_counter` before and after each test. In `memory` mode it does nothing.
- `backend/tests/api/test_rate_limit_api.py` is **unchanged** (git shows no diff).
- Result: `memory` 7 passed; `postgres` 7 passed. CI now also runs this file with `RATE_LIMIT_STORE=postgres`, so the guard stays in place.
