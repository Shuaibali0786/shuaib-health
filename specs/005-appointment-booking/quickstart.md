# Quickstart: Appointment Booking (Feature 005)

## Prerequisites

- The Feature 003/004 setup works: `backend/.env` has the dev and test database URLs, and `frontend/.env.local` has `CATALOG_API_URL`.
- New settings. Generate the secret values locally and never commit them:

  | File | Settings |
  |---|---|
  | `backend/.env` | `BOOKING_PROXY_SECRET`, `PRIVACY_HASH_KEY` (both required, at least 32 characters); optional `DEMO_MODE=true`, `BOOKING_PURGE_AFTER_DAYS=7`, `AUDIT_PURGE_AFTER_DAYS=90`, `BOOKING_LIMIT_PER_IP_PER_HOUR=10`, `BOOKING_LIMIT_PER_PHONE_PER_DAY=5`, `LOOKUP_LIMIT_PER_IP_PER_MINUTE=20` |
  | `frontend/.env.local` | `BOOKING_PROXY_SECRET`, with the same value as the backend |

  Without the secrets, the backend exits at startup and `next start` refuses to start, both naming the missing setting. `next build` and `next dev` still work.

  To generate a value:

  ```bash
  python -c "import secrets; print(secrets.token_urlsafe(32))"
  ```

## Run locally

```bash
cd backend
uv run alembic upgrade head          # applies 0002_booking (direct URL)
uv run python -m app.seed            # sample schedules, leave and holiday; refuses when APP_ENV=production
uv run uvicorn app.main:app --port 8000 --no-access-log

cd ../frontend
npm run dev                          # http://localhost:3000/book-appointment
```

Try it:
- Open `/doctors/dr-omar-sheikh` and press **Book appointment**. On a Tuesday there is no slot between 17:00 and 18:00 (the seeded break).
- Book a slot. The confirmation page shows `A**** K****`-style masking and a `XXXXX-XXXXX` reference.
- Book the same slot again in a second tab. You get "this slot was just taken" with alternatives.

## Tests

```bash
cd backend
uv run pytest                                   # unit + db (needs TEST_DATABASE_URL)
uv run pytest -k concurrency                    # 20 simultaneous bookings → exactly 1 success
uv run pytest -m perf -k concurrency_repeat     # SC-002: 100 runs (on demand)
uv run ruff check . && uv run mypy

cd ../frontend
npm run typecheck && npm run lint && npm test
npm run test:e2e                                # booking happy path, a11y on each step
npm run test:e2e:stateful                       # race, retry, rate-limited, backend down
npm run test:e2e:offline                        # build + booking page with the API dead
```

## Useful SQL (dev database only)

```sql
-- Prove the constraint: the second insert must fail with 23P01 exclusion_violation
-- (copy an existing confirmed row's doctor_id/starts_at/ends_at).

-- What the automatic demo purge will remove next (R12)
SELECT count(*) FROM appointment WHERE ends_at < now() - interval '7 days';
```

To run the demo purge on demand, or from a host scheduler:

```bash
uv run python -m app.booking.purge    # prints the number deleted; refuses when DEMO_MODE=false
```

## Troubleshooting

| Symptom | Cause |
|---|---|
| Backend or `next start` exits with "BOOKING_PROXY_SECRET is required" | the secret is missing or shorter than 32 characters |
| `403 forbidden` on booking | `BOOKING_PROXY_SECRET` differs between frontend and backend |
| No slots at all | the clinic time zone or lead time pushes today past the last session; check the next days. Also check that `booking_window_days` is not 1 |
