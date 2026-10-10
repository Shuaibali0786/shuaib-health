"""The latency script computes percentiles and never prints the URL, a header or the token."""

import io

import pytest

from scripts import measure_latency as ml


def test_percentile_is_nearest_rank() -> None:
    values = [float(n) for n in range(1, 21)]  # 1..20
    assert ml.percentile(values, 0.5) == 10.0
    assert ml.percentile(values, 0.95) == 19.0
    assert ml.percentile([7.0], 0.95) == 7.0


def test_parse_target_needs_a_path_and_a_positive_count() -> None:
    assert ml.parse_target("/health=5") == ("/health", 5)
    assert ml.parse_target("/api/v1/x?date=2026-01-01=3") == ("/api/v1/x?date=2026-01-01", 3)
    for bad in ("health=5", "/health", "/health=0", "/health=x"):
        with pytest.raises(Exception, match="PATH=COUNT"):
            ml.parse_target(bad)


def test_measure_times_each_request_and_counts_statuses() -> None:
    ticks = iter([0.0, 0.1, 1.0, 1.3])  # two requests: 100 ms and 300 ms
    calls: list[str] = []

    def fetch(url: str, headers: dict[str, str]) -> int:
        calls.append(url)
        return 200

    [result] = ml.measure(
        "https://api.example.org/",
        [("/health", 2)],
        headers={},
        fetch=fetch,
        clock=lambda: next(ticks),
    )
    assert calls == ["https://api.example.org/health"] * 2
    assert [round(ms) for ms in result.millis] == [100, 300]
    assert result.statuses == {200: 2}
    assert "p50=100 ms" in ml.summarise(result)


def test_output_has_no_host_header_or_token(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    seen: dict[str, str] = {}

    def fetch(url: str, headers: dict[str, str]) -> int:
        seen.update(headers)
        return 200

    monkeypatch.setenv("PROTECTION_BYPASS", "tok-secret-123")
    monkeypatch.setattr(ml, "fetch_status", fetch)
    out = io.StringIO()
    code = ml.main(
        [
            "--base-url",
            "https://secret-host.example.org",
            "--target",
            "/health=2",
            "--label",
            "warm",
        ],
        out,
    )
    printed = out.getvalue()
    assert code == 0
    assert seen["x-vercel-protection-bypass"] == "tok-secret-123"
    assert "tok-secret-123" not in printed
    assert "secret-host" not in printed
    assert "[warm]" in printed and "/health" in printed


def test_a_non_200_makes_the_exit_code_non_zero(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(ml, "fetch_status", lambda _url, _headers: 503)
    code = ml.main(["--base-url", "https://x.example.org", "--target", "/ready=1"], io.StringIO())
    assert code == 1
