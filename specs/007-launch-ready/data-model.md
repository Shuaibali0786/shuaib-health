# Data Model: 007 Launch Ready

**No database schema changes.** No new tables, columns or migrations. The entities below are **operational**: they live in host dashboards, config files and runbooks, not in Postgres.

## Environment

| Field | Values / rule |
|---|---|
| name | `local` · `ci` · `preview` · `production` |
| website host | laptop · GitHub runner · Vercel Preview · Vercel Production (`sin1`) |
| API host | laptop · GitHub runner · Vercel Preview (API project) · Vercel Production (`sin1`) |
| database | dev Neon project · Postgres service container · Neon prod project `preview` branch · Neon prod project `main` branch |
| `APP_ENV` | development · test · production (preview runs `production` so the production checks also run on previews) |
| demo switches | ON everywhere for this feature; **must be explicit** in production and preview |
| `indexable` | OFF everywhere |
| site URL | `http://localhost:3000` (local only) · preview deployment URL · production https URL |
| secrets | own set per environment; production secrets never in preview or CI |

**Preview data rule**: the Neon `preview` branch is created while the project is empty. It holds **demo data only** (guarded seed), is migrated by preview builds, and is never branched from production data.

**Rule**: one environment's database URL never appears in another environment's settings. The seed/admin guard refuses the dev URL when production is intended.

## Required setting

Fields: `name`, `tier` (website/API/both/backup-job), `required_in_production`, `secret`, `default`, `set_in` (Vercel env / GitHub secret / config file), `environments`, `redeploy_needed`. The full list is in [contracts/required-settings.md](./contracts/required-settings.md).

Validation:
- Production + required + missing → startup or build error naming the setting (never its value).
- Secret → never in a config file, log, CI output or `NEXT_PUBLIC_*`.
- New setting → added to `.env.example`, the required-settings contract and the new-env-var checklist in the same PR.

## Release

| Field | Rule |
|---|---|
| commit | one SHA deploys both Vercel projects |
| website deployment id / API deployment id | recorded by Vercel; rollback target = previous Production deployment of each |
| has_migration | true if `backend/alembic/versions/` changed |
| restore_point | **required** when has_migration (Neon snapshot or branch name) |
| smoke_result | pass/fail per checklist item |

State: `building → ready (live) → superseded | rolled-back`. A failed build (including a failed migration) never reaches `ready`.

## Monitor

| Target | Interval | Alerts |
|---|---|---|
| Website `/` | 5 min | push + email |
| API `/health` | 5 min | push + email |
| API `/ready` | 60 min | push + email |
| Website catalog page | 60 min | push + email |

## Backup

| Field | Rule |
|---|---|
| taken_at | daily ~02:00 Asia/Karachi |
| source | Neon prod `main`, read-only role, direct URL |
| format | `pg_dump -Fc`, then `age`-encrypted to the owner's public key |
| location | private repo `shuaib-health-backups`, workflow artifact |
| retention | 14 days (`retention-days: 14`) |
| verified | true for the copy used in the latest restore drill |

## Restore point
Neon snapshot or branch named `pre-<release-sha7>-<yyyymmdd>`. Created before a migration deploy; deleted after 14 days or when branches near the 10-branch limit.

## Incident note
`docs/incidents/<yyyy-mm-dd>-<slug>.md`: what broke, impact, timeline, cause, fix, prevention test.
