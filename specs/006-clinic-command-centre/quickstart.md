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
uv run mypy app && uv run ruff check .

# frontend
cd frontend
npm run typecheck && npm run lint && npm test
npm run build && node scripts/check-admin-isolation.mjs       # no admin code in public bundles
npm run test:e2e -- --project=admin-desktop --project=admin-mobile
npm run test:e2e -- tests/e2e/admin-isolation.spec.ts tests/e2e/admin-a11y.spec.ts
npm run test:e2e -- tests/e2e/admin-visual.spec.ts            # baselines (approved at the design gate)
```

## 5. Known limits

- In the portfolio deployment (`DEMO_MODE=true`) real bookings are deleted 7 days after the appointment, so real-data week-on-week trends and 30/90-day Insights are sparse; the public demo is unaffected.
- Undo lasts 10 seconds; final states (Completed, No-show, Cancelled) cannot be reopened after that.
- No password reset by email and no 2FA in this feature (out of scope); an admin resets passwords.
