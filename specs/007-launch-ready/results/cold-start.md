# Cold-start gate (T059, condition C4) on the API preview, 2026-10-12

**Result: FAIL on one target. Stopped before any production deploy, as the task requires.**

Setup: API preview (Python Function, region sin1) and the Neon preview branch (Free plan, fixed 0.25 CU, scale to zero). Measured from the owner's laptop with `backend/scripts/measure_latency.py` and the automation bypass token. The preview database was seeded first (T109). Times are one request each, in the order listed.

## Targets
| Target | Result |
|---|---|
| Warm p95 under 1 s | **PASS** (below) |
| Cold catalog request within the website's timeout (3 s for catalog fetches) | **FAIL** |
| Friendly retry shown when it times out | not tested here (already covered by the website's unavailable state) |

## Round set A: 31 minutes idle, then `/health`, `/ready`, catalog (05:31 UTC), and two more rounds after 7 minutes idle
| Round | /health | /ready | /api/v1/clinic | /api/v1/doctors |
|---|---|---|---|---|
| 1 (31 min idle) | 3014 ms | 1331 ms | 383 ms | 434 ms |
| 2 (7 min idle) | 2977 ms | 1260 ms | 448 ms | 398 ms |
| 3 (7 min idle) | 2878 ms | 1228 ms | 365 ms | 397 ms |

`/health` went first in each round, so it paid the function's cold start (about 3 s) and the later requests found a warm function.

## Round set B: 7 minutes idle, then catalog FIRST (the real question)
| Round | /api/v1/doctors (first) | /api/v1/clinic | /ready | /health |
|---|---|---|---|---|
| 1 | **3982 ms** | 342 ms | 475 ms | 299 ms |
| 2 | **6029 ms** | 365 ms | 334 ms | 304 ms |
| 3 | **4358 ms** | 330 ms | 348 ms | 284 ms |

The first catalog request after a quiet period takes **4.0 to 6.0 s**. That is the function's cold start (about 3 s) plus waking Neon (about 1 to 3 s). Every request after it is about 0.3 to 0.5 s.

## Warm (immediately after, 5 samples each)
| Path | p50 | p95 | max |
|---|---|---|---|
| /health | 296 ms | 367 ms | 367 ms |
| /ready | 315 ms | 331 ms | 331 ms |
| /api/v1/clinic | 267 ms | 269 ms | 269 ms |
| /api/v1/doctors | 282 ms | 286 ms | 286 ms |
(An earlier 20-sample run gave /health p95 639 ms and /ready p95 347 ms.)

## What this means
- The website serves catalog pages from its own 5-minute cache, so a visitor normally gets cached pages and never waits for the API. The slow request happens when the cache refreshes after a quiet period, and the 3 s catalog timeout then fails that refresh (the page keeps showing the last good data, or the "temporarily unavailable" state on a brand-new instance).
- Other website timeouts: slots lookup 5 s (marginal against a 4 to 6 s cold start), booking submit 15 s (fine).
- Cold start has two parts, so there are two independent fixes (see the owner decision in the PR).

## Not measured
Cold start of the production API (same code and region, but a separate project and Neon branch). Re-measure after the chosen fix.

---

# After the fix (owner decision C), same day

Changes: catalog fetch and slots lookup timeouts raised to 8 s (PR #14); one UptimeRobot monitor, API `/health` every 5 minutes. Nothing keeps Neon awake, so the first database request after a quiet period still pays Neon's wake-up.

## 1. Website slots endpoint, first request after 7 minutes with nothing warming the API
This is the real end-to-end cold case: the website calls the cold API under its new 8 s limit.
| Round | Result |
|---|---|
| A1 | 200 in 3.26 s, 14 days of slots |
| A2 | 200 in 4.77 s, 14 days of slots |
Both succeeded inside 8 s. With the old 5 s limit the second was marginal and the 6.0 s case from the earlier test would have failed.

## 2. API catalog, first database request after a quiet period, with `/health` pinged every 5 minutes (simulating UptimeRobot)
The first attempt left a 6 minute gap after the last ping (longer than the 5 minute cadence), so it was not a fair test: 4.36 s and 3.91 s.
The corrected test probes 4.5 minutes after a ping, every 10 minutes, so Neon is asleep each time:
| Probe | `/health` ping just before | Catalog first request |
|---|---|---|
| 1 | 0.39 s (function warm) | **3.65 s** |
| 2 | 0.41 s | **1.54 s** |
| 3 | 0.40 s | **1.61 s** |
After the first ping every ping took about 0.4 s, so the function stayed warm. The first catalog request then costs only Neon's wake-up: about 1.5 s typically, 3.6 s once.

## Verdict
| Target | Result |
|---|---|
| Warm p95 under 1 s | PASS |
| Cold catalog within the website timeout | **PASS** (worst cold case seen: 6.0 s against 8 s; typical with the monitor: about 1.5 s) |
| Slots lookup after idle | PASS (3.3 s and 4.8 s against 8 s) |
Remaining risk: the 8 s limit leaves 2 s of margin over the worst cold time seen (6.0 s). If cold starts grow, the limit or the function's import time is the next thing to look at.
The monitor cannot be created yet: its URL is the production API, which does not exist until the production deploy (T060).
