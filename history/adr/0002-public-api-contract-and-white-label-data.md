# ADR-0002: Public API Contract and White-Label Catalog Data

> **Scope**: Document decision clusters, not individual technology choices. Group related decisions that work together (e.g., "Frontend Stack" not separate ADRs for framework, styling, deployment).

- **Status:** Proposed
- **Date:** 2026-10-03
- **Feature:** 003-catalog-api
- **Context:** The website currently renders from typed mock files (`frontend/src/types/content.ts`, `frontend/src/data/*`). Feature 004 must switch it to the API without redesign, and later the booking flow, staff app and AI agent must read the same data through the same endpoints (Constitution IV). The product must also be white-label from day one: a different clinic is a different database, never a code change. This needs one stable wire contract, one error shape, and one trustworthy way to load the same sample data the site shows today.

## Decision

- **Versioned public API**: read-only `GET` endpoints under `/api/v1`; detail by slug; non-GET → 405.
- **Wire shape mirrors the frontend types**: separate Pydantic response schemas (never table models), camelCase via alias generator; every frontend field kept with the same name, type and meaning; new fields only additive (`slotMinutes`, `logo`, `brandColors`, package `tests`). `id` and ID references carry the internal UUIDs; slug references stay slugs.
- **Uniform lists**: every list (including rules and categories) returns `{ items, total, page, pageSize }`, `page` 1–10 000, `pageSize` 1–100 (default 20), deterministic ordering ending in `id`.
- **One error envelope**: `{ error: { code, message, requestId, details? } }` with codes `not_found` 404, `method_not_allowed` 405, `validation_error` 422, `rate_limited` 429, `internal_error` 500, `service_unavailable` / `not_configured` 503; never stack traces, SQL or echoed input.
- **Contract artefact**: `specs/003-catalog-api/contracts/openapi.yaml` committed; a test diffs the app's generated OpenAPI against it.
- **White-label as data**: all clinic identity (name, logo, colours, phones, emergency number, address, timezone, hours, demo notice, credit, rules) in `clinic_settings` (singleton) and `clinic_rule`; single-tenant (one database per clinic); a code search for the sample clinic name in backend source must find nothing.
- **Seed sourcing**: a frontend Node script exports the catalog mocks to committed `backend/app/seed/data/catalog.json`; a frontend Vitest test fails if JSON and mocks differ; values absent from the mocks live in `extras.json`. The seed upserts by natural key in one transaction, keeps existing UUIDs, replaces child/link rows of seeded parents, never deletes other rows, and refuses `APP_ENV=production`.

## Consequences

### Positive

- Feature 004 swaps data sources with minimal code: items are the same shapes; only list unwrapping (`items`) and ID values change.
- Every client and the AI agent get identical data, rules and errors; one fetch helper handles all errors.
- Rebranding or onboarding another clinic is a data load, not a fork.
- Mock/seed drift is caught mechanically; contract drift is caught by the OpenAPI diff test.
- Stable UUIDs across re-seeds keep ETags and caches stable.

### Negative

- The frontend currently remains the source of truth for sample content until Feature 004 flips the direction; two places hold the data for a while (guarded by the parity test).
- Mirroring frontend field names couples the API to today's UI vocabulary; renaming a field later needs `/api/v2` or a deprecation period.
- UUIDs replace the readable mock IDs, so any frontend code that hard-codes mock IDs must change in Feature 004.
- Paginating tiny fixed lists (rules, categories) adds an envelope with little practical value, accepted for consistency.
- A custom error envelope is not RFC 9457 `problem+json`; generic tooling won't recognise it.

## Alternatives Considered

- **Return SQLModel table objects directly**: less code, but leaks internal columns and ties the wire format to the schema. Rejected.
- **Bare arrays for lists / `{ data }` envelopes for details**: closest to today's arrays, but no room for totals and paging; or diverges from the frontend types. Rejected.
- **RFC 9457 `application/problem+json`**: standard, but nested `error` object is simpler for the frontend helper; can be revisited by a later ADR.
- **Clinic config in environment variables or a config file**: easy, but splits white-label data across deploy config and database and can't be edited by a future admin UI. Rejected.
- **Hand-ported Python seed data**: no Node dependency, but drifts silently. **Backend as source with generated TS**: right long-term, but changes Feature 002 now. Both rejected for this feature.
- **Truncate-and-reload seed**: simpler, but changes IDs every run and destroys non-sample rows. Rejected.

## References

- Feature Spec: [specs/003-catalog-api/spec.md](../../specs/003-catalog-api/spec.md)
- Implementation Plan: [specs/003-catalog-api/plan.md](../../specs/003-catalog-api/plan.md)
- Research: [research.md R5–R10, R13](../../specs/003-catalog-api/research.md); Contract: [contracts/openapi.yaml](../../specs/003-catalog-api/contracts/openapi.yaml); Data model: [data-model.md](../../specs/003-catalog-api/data-model.md)
- Related ADRs: ADR-0001, ADR-0003
- Evaluator Evidence: [history/prompts/003-catalog-api/002-plan-catalog-api.plan.prompt.md](../prompts/003-catalog-api/002-plan-catalog-api.plan.prompt.md)
