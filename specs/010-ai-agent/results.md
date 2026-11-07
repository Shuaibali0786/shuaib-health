# Results: 010 AI Agent v1

Run: unattended overnight, 7 Nov 2026, Windows laptop, mock API.

| Check | Result |
|---|---|
| typecheck, lint | pass |
| Vitest full | **1466 passed** (112 files; new: `agent-engine.test.ts` 21, `agent-widget.test.tsx` 3) |
| 40-question sample (SC-001, ≥ 90%) | passes the ≤ 4-miss threshold |
| Playwright with `ASSISTANT_ENABLED=true`: `assistant`, `home` (mobile + desktop) | 28 passed, 2 skipped (the flag-off check, by design) |
| Flag off (default) | no button, no pack in pages (layout loads nothing) |

Change from the plan: the knowledge pack is passed from the site layout to the widget as a prop, **not** fetched from a new `/api/assistant/knowledge` route. Reason: the project guard test forbids new `fetch()` call sites, and this removes a public endpoint. Cost: when the flag is on, every page carries the pack in its HTML (public catalog data, a few kB gzipped). When the flag is off, nothing is added.

The flag reader lives in `lib/demo.ts` (the guard tests allow env reads only there).

Not done: Lighthouse with the flag on; a server-side provider (by design, see `docs/runbooks/ai-provider.md`).
