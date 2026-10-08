# Quickstart: Clinic Command Centre

Assumes the Feature 005 quickstart works (backend on :8000, website on :3000, Neon dev + test databases).

## 1. New configuration

`backend/.env` (placeholders in `backend/.env.example`):

```dotenv
SESSION_SECRET=<at least 32 random characters>   # keys session-token and CSRF HMACs; rotating it signs everyone out
# optional overrides (defaults shown)
STAFF_IDLE_MINUTES=30
STAFF_ABSOLUTE_HOURS=12
STAFF_MAX_SESSIONS=3
LOGIN_LOCK_FAILURES=5
LOGIN_LOCK_MINUTES=15
LOGIN_LIMIT_PER_IP_PER_15MIN=20
DEMO_LIMIT_PER_IP_PER_HOUR=10
DEMO_SESSION_HOURS=2
DEMO_ENABLED=true            # false for a real clinic: no demo entry, no demo data (website: same name, set before build)
STATUS_UNDO_SECONDS=10
```

The backend refuses to start if `SESSION_SECRET` is missing or shorter than 32 characters (same rule as `BOOKING_PROXY_SECRET`). The website needs no new variable: it reuses `BOOKING_PROXY_SECRET` for every website-server → backend call.

## 2. Migrate and create the first admin

```bash
cd backend
uv run alembic upgrade head                     # 0003_command_centre
uv run python -m app.auth.create_admin --email owner@example.com --name "Clinic Owner"
# prompts twice for the password (≥ 12 chars, not common); prints only "Admin account created."
```

There is no default account and the seed never creates one. In production this command is the only way to bootstrap access.

## 3. Run

```bash
cd backend && uv run fastapi dev app/main.py
cd frontend && npm run dev
```

- Staff: <http://localhost:3000/admin/login> (use `localhost`, not `127.0.0.1`, so the `__Host-` cookie is accepted).
- Demo: press **View Demo Dashboard** in the site footer, the About page or the login page.

## 4. Verify

```bash
# backend
cd backend
uv run pytest tests/unit tests/api -q                        # incl. test_auth_matrix.py, test_route_policies.py
uv run pytest tests/migrations -q                            # 0003 up/down, refusal on lossy downgrade
uv run pytest tests/perf/test_command_centre_latency.py -q   # 30k bookings: search + insights p95 < 1 s
uv run mypy && uv run ruff check .

# frontend
cd frontend
npm run typecheck && npm run lint && npm test
npm run build && node scripts/check-admin-isolation.mjs       # no admin code in public bundles
npm run test:e2e -- --project=admin-desktop --project=admin-mobile
npm run test:e2e -- tests/e2e/admin-isolation.spec.ts tests/e2e/admin-a11y.spec.ts
npm run test:e2e -- tests/e2e/admin-visual.spec.ts            # baselines (approved at the design gate)
npm run test:e2e -- tests/e2e/admin-honesty.spec.ts tests/e2e/seo.spec.ts   # disclaimer/credit/ribbon; noindex only on /admin
npm run test:e2e:stateful -- tests/e2e/stateful/admin-resilience.spec.ts   # staff backend down/slow, public booking unaffected
```

Run the suites one after another (backend, then Playwright, then Vitest). A second pytest run waits for the first (advisory lock on the test database, see `backend/README.md` §6); Playwright and Vitest use the mock API and need no database, but share ports 3100/4010 and the `.next` build, so do not start two Playwright runs at once either.

Release checks (Phase 10):

```bash
gitleaks detect --source . --redact --no-banner               # fake test credentials are listed in .gitleaksignore
cd frontend && npm audit                                       # report only; do not use --force
cd backend && uv export --no-hashes --no-emit-project -o req.txt && uvx pip-audit -r req.txt --no-deps --disable-pip
cd frontend && npx lighthouse http://localhost:3150/ --preset=perf --form-factor=mobile   # after next build + next start --port 3150 on the mock API
```

For `/admin` in demo mode pass `--extra-headers headers.json` with `{"Cookie":"__Host-cc_session=cd_e2e-demo"}` (the mock API's demo session).

Measure Lighthouse with nothing else running (no test suite, no dev server): Lighthouse's simulated throttling multiplies whatever CPU contention there is, and a parallel pytest or Playwright run halves the scores (see `results.md`, "Lighthouse regression"). Take the median of 3 runs.

SEO: the demo clinic is `indexable: false` on purpose (fictional clinic, honesty), so Lighthouse SEO scores it about 66–69 (`is-crawlable`). To check a real clinic's SEO, build once with the clinic's `indexable` set to true (test only, e.g. a proxy in front of the mock API; never change the seed) and run `npx lighthouse <url> --only-categories=seo`: every public page scores 100.

## 5. Known limits

- In the portfolio deployment (`DEMO_MODE=true`) real bookings are deleted 7 days after the appointment, so real-data week-on-week trends and 30/90-day Insights are sparse; the public demo is unaffected.
- Undo lasts 10 seconds; final states (Completed, No-show, Cancelled) cannot be reopened after that.
- No password reset by email and no 2FA in this feature (out of scope); an admin resets passwords.
