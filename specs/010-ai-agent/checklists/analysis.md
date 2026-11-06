# /sp.analyze report — 010 AI Agent v1

| ID | Category | Severity | Finding | Resolution |
|---|---|---|---|---|
| A1 | Inconsistency | Medium | Plan said a `/api/assistant/knowledge` JSON route; guard tests forbid new `fetch()` sites | Pack passed as a prop from the layout (results.md). Plan T007 updated |
| A2 | Constitution I | Low | "google" keyword tripped the brand gate | Replaced with "search" |
| A3 | Constitution X | Info | Phase 5 asks for tool calling over public APIs | v1 has no tool calling (no model); the remote slot documents it |
| A4 | FR-005 rate limit | Medium | Client-side only | Accepted for v1 (no server call). Server limit mandatory for remote provider (runbook) |
| A5 | Dependency | Info | Product-guide links point to `/demo/specialties/*` from PR 009 | Merge 009 before 010 |

Coverage: FR-001→T002, FR-002→T003–T006, FR-003→T007, FR-004→T009/T013, FR-005→T005, FR-006→T008/T010, FR-007→T007 allow-list test. No CRITICAL issues.
