"""Server-side latency of the catalog endpoints (SC-003: p95 < 200 ms for normal page sizes).

Run on demand: ``uv run pytest -m perf -s``. The time is the server's own ``durationMs`` from the
access log, so it excludes the in-process test client. It includes the round trip to the
database, so it depends on the distance to the database region.
"""

import logging
import math
import statistics
from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient

pytestmark = [pytest.mark.perf, pytest.mark.db]

BUDGET_MS = 200.0
WARMUP = 5
REQUESTS = 50
PATHS = (
    "/api/v1/departments",
    "/api/v1/doctors",
    "/api/v1/doctors?department=cardiology",
    "/api/v1/doctors/dr-hassan-mirza",
    "/api/v1/lab-tests",
    "/api/v1/lab-tests?q=test",
    "/api/v1/health-packages",
    "/api/v1/health-packages/basic-health-check",
    "/api/v1/clinic",
    "/api/v1/clinic/rules",
)


class DurationCollector(logging.Handler):
    def __init__(self) -> None:
        super().__init__()
        self.durations: list[float] = []

    def emit(self, record: logging.LogRecord) -> None:
        value = getattr(record, "durationMs", None)
        if value is not None:
            self.durations.append(float(value))


def p95(values: list[float]) -> float:
    ordered = sorted(values)
    return ordered[max(0, math.ceil(0.95 * len(ordered)) - 1)]


def test_catalog_endpoints_stay_under_the_latency_budget(
    make_client: Callable[..., TestClient],
) -> None:
    client = make_client(rate_limit_per_minute=10000)
    logging.getLogger("httpx2").setLevel(logging.WARNING)  # the test client's own request log
    logging.getLogger("app.access").setLevel(logging.INFO)
    collector = DurationCollector()
    logger = logging.getLogger("app.access")
    logger.addHandler(collector)
    results: dict[str, list[float]] = {}
    try:
        for path in PATHS:
            for _ in range(WARMUP):
                assert client.get(path).status_code == 200
            collector.durations.clear()
            for _ in range(REQUESTS):
                assert client.get(path).status_code == 200
            results[path] = list(collector.durations)
    finally:
        logger.removeHandler(collector)

    print()
    print(f"{'endpoint':<50} {'median':>8} {'p95':>8} {'max':>8}   (ms)")
    for path, values in results.items():
        print(f"{path:<50} {statistics.median(values):8.1f} {p95(values):8.1f} {max(values):8.1f}")
    slow = {path: p95(v) for path, v in results.items() if p95(v) >= BUDGET_MS}
    assert not slow, f"p95 over {BUDGET_MS} ms: {slow}"


SLOTS_BUDGET_MS = 300.0


def test_slots_endpoint_stays_under_its_latency_budget(
    make_client: Callable[..., TestClient],
) -> None:
    """Slots for a seeded doctor over 14 days: p95 at most 300 ms (SC-008)."""
    client = make_client(rate_limit_per_minute=10000)
    path = "/api/v1/doctors/dr-omar-sheikh/slots"
    logging.getLogger("httpx2").setLevel(logging.WARNING)
    logging.getLogger("app.access").setLevel(logging.INFO)
    collector = DurationCollector()
    logger = logging.getLogger("app.access")
    logger.addHandler(collector)
    try:
        for _ in range(WARMUP):
            assert client.get(path).status_code == 200
        collector.durations.clear()
        for _ in range(REQUESTS):
            assert client.get(path).status_code == 200
        values = list(collector.durations)
    finally:
        logger.removeHandler(collector)

    print()
    print(f"{path}: median {statistics.median(values):.1f} ms, p95 {p95(values):.1f} ms")
    assert p95(values) < SLOTS_BUDGET_MS
