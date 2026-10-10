"""Measure API latency.

Example: ``uv run python scripts/measure_latency.py --base-url https://... --target /health=5``

Each ``--target PATH=COUNT`` is requested COUNT times in a row (sequentially), and the script
prints p50, p95 and max per target. Use it for the cold-start gate (C4: run after 30 minutes idle)
and for the warm p95 check (FR-068, SC-003).

If the API is behind Vercel Deployment Protection, put the bypass token in the environment variable
``PROTECTION_BYPASS`` (never on the command line). Only the target paths, the status counts and the
timings are printed: no URL host, header, token or response body.
"""

import argparse
import math
import os
import sys
import time
import urllib.error
import urllib.request
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from typing import TextIO

TIMEOUT_SECONDS = 30.0
BYPASS_ENV = "PROTECTION_BYPASS"


@dataclass
class Result:
    path: str
    millis: list[float] = field(default_factory=list)
    statuses: dict[int, int] = field(default_factory=dict)


def percentile(sorted_values: Sequence[float], fraction: float) -> float:
    """Nearest-rank percentile of an ascending list."""
    if not sorted_values:
        raise ValueError("no samples")
    rank = max(1, math.ceil(fraction * len(sorted_values)))
    return sorted_values[rank - 1]


def summarise(result: Result) -> str:
    ordered = sorted(result.millis)
    statuses = ", ".join(f"{code}x{count}" for code, count in sorted(result.statuses.items()))
    return (
        f"{result.path}  n={len(ordered)}  p50={percentile(ordered, 0.5):.0f} ms  "
        f"p95={percentile(ordered, 0.95):.0f} ms  max={ordered[-1]:.0f} ms  [{statuses}]"
    )


def parse_target(text: str) -> tuple[str, int]:
    path, sep, count = text.rpartition("=")
    if not sep or not path.startswith("/") or not count.isdigit() or int(count) < 1:
        raise argparse.ArgumentTypeError("use PATH=COUNT, for example /health=5")
    return path, int(count)


def fetch_status(url: str, headers: dict[str, str]) -> int:
    request = urllib.request.Request(url, headers=headers)  # noqa: S310 - https URL from the operator
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:  # noqa: S310
            response.read()
            return int(response.status)
    except urllib.error.HTTPError as error:
        return int(error.code)
    except (urllib.error.URLError, TimeoutError):
        return 0  # no answer


def measure(
    base_url: str,
    targets: Sequence[tuple[str, int]],
    *,
    headers: dict[str, str],
    fetch: Callable[[str, dict[str, str]], int] | None = None,
    clock: Callable[[], float] = time.perf_counter,
) -> list[Result]:
    fetch = fetch or fetch_status
    results: list[Result] = []
    for path, count in targets:
        result = Result(path)
        for _ in range(count):
            started = clock()
            status = fetch(f"{base_url.rstrip('/')}{path}", headers)
            result.millis.append((clock() - started) * 1000)
            result.statuses[status] = result.statuses.get(status, 0) + 1
        results.append(result)
    return results


def main(argv: Sequence[str] | None = None, out: TextIO | None = None) -> int:
    out = out or sys.stdout
    parser = argparse.ArgumentParser(prog="measure_latency.py")
    parser.add_argument("--base-url", required=True, help="https://... (no trailing path)")
    parser.add_argument("--target", action="append", type=parse_target, required=True)
    parser.add_argument("--label", default="", help="for example cold or warm")
    args = parser.parse_args(argv)

    headers = {"accept": "application/json"}
    token = os.environ.get(BYPASS_ENV, "").strip()
    if token:
        headers["x-vercel-protection-bypass"] = token

    results = measure(args.base_url, args.target, headers=headers)
    if args.label:
        print(f"[{args.label}]", file=out)
    for result in results:
        print(summarise(result), file=out)
    failed = any(code != 200 for result in results for code in result.statuses)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
