"""REQ-8 — CI job `crawler-smoke-verify` 의 판정 로직 검증.

실수집 자체는 `python -m crawler.smoke` 가 하고, 여기서는 **판정기가 실제로 떨어뜨리는지**를
확인한다. 리포트 부재·수집 미달·차단·간격 위반·신선도 초과가 각각 exit 1 로 이어져야 한다.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta

import pytest

from _helpers import REPO_ROOT
from crawler.ci.smoke_verify import verify
from crawler.errors import ConfigError
from crawler.smoke import evaluate_report, load_seeds

SEED_FILE = REPO_ROOT / "services/crawler/config/smoke_seeds.yaml"
NOW = datetime(2026, 8, 3, 12, 0, tzinfo=UTC)


def _report(**overrides) -> dict:
    base = {
        "schema": "glowmate.crawler.smoke/1",
        "generated_at": (NOW - timedelta(hours=2)).isoformat().replace("+00:00", "Z"),
        "source": "official_website",
        "crawl_run_id": "smoke-test",
        "seeds": 16,
        "records": 15,
        "sha256_mismatch": 0,
        "http_429_403": 0,
        "requests": 16,
        "min_interval_sec": 10.001,
        "policy_min_interval_sec": 10.0,
        "worker": {"escaped_exceptions": 0},
    }
    base.update(overrides)
    return base


def _write(tmp_path, data: dict):
    path = tmp_path / "smoke.json"
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return path


def _verify(tmp_path, data: dict):
    return verify(_write(tmp_path, data), root=REPO_ROOT, now=NOW)


def test_valid_report_passes(tmp_path) -> None:
    report = _verify(tmp_path, _report())
    assert report.failures == [], "\n".join(report.failures)
    assert report.emit() == 0


def test_missing_report_fails(tmp_path) -> None:
    report = verify(tmp_path / "absent.json", root=REPO_ROOT, now=NOW)
    assert any("리포트가 없다" in f for f in report.failures)
    assert report.emit() == 1


def test_records_below_threshold_fails(tmp_path) -> None:
    report = _verify(tmp_path, _report(records=9))
    assert any("records=9" in f for f in report.failures), report.failures


def test_zero_records_fails(tmp_path) -> None:
    """수집 0건은 '검사 대상 없음'이 아니라 실패다."""
    report = _verify(tmp_path, _report(records=0))
    assert any("records=0" in f for f in report.failures), report.failures


def test_sha256_mismatch_fails(tmp_path) -> None:
    report = _verify(tmp_path, _report(sha256_mismatch=1))
    assert any("sha256_mismatch" in f for f in report.failures), report.failures


def test_missing_sha256_field_fails(tmp_path) -> None:
    data = _report()
    del data["sha256_mismatch"]
    report = _verify(tmp_path, data)
    assert any("sha256_mismatch 가 없다" in f for f in report.failures), report.failures


def test_http_429_403_fails(tmp_path) -> None:
    report = _verify(tmp_path, _report(http_429_403=2))
    assert any("http_429_403=2" in f for f in report.failures), report.failures


def test_interval_below_policy_fails(tmp_path) -> None:
    """리포트가 자기 기준을 들고 와도 allowlist 정본으로 다시 판정한다."""
    report = _verify(tmp_path, _report(min_interval_sec=2.0, policy_min_interval_sec=1.0))
    assert any("min_interval_sec=2.0" in f for f in report.failures), report.failures


def test_stale_report_fails(tmp_path) -> None:
    stale = (NOW - timedelta(days=8)).isoformat().replace("+00:00", "Z")
    report = _verify(tmp_path, _report(generated_at=stale))
    assert any("기준 시점 대비" in f for f in report.failures), report.failures


def test_report_within_seven_days_passes(tmp_path) -> None:
    fresh = (NOW - timedelta(days=6, hours=23)).isoformat().replace("+00:00", "Z")
    report = _verify(tmp_path, _report(generated_at=fresh))
    assert report.failures == [], "\n".join(report.failures)


def test_future_report_fails(tmp_path) -> None:
    future = (NOW + timedelta(days=1)).isoformat().replace("+00:00", "Z")
    report = _verify(tmp_path, _report(generated_at=future))
    assert any("미래 시각" in f for f in report.failures), report.failures


def test_unknown_source_fails(tmp_path) -> None:
    report = _verify(tmp_path, _report(source="naver_place"))
    assert report.failures, "forbidden 소스의 스모크가 통과했다"


def test_escaped_exceptions_fail(tmp_path) -> None:
    report = _verify(tmp_path, _report(worker={"escaped_exceptions": 3}))
    assert any("격리되지 않은 예외" in f for f in report.failures), report.failures


# ── 스모크 러너의 자기 판정 ──────────────────────────────────────────────────


def test_evaluate_report_matches_ci_verdict() -> None:
    assert evaluate_report(_report()) == []
    assert evaluate_report(_report(records=3))
    assert evaluate_report(_report(http_429_403=1))
    assert evaluate_report(_report(min_interval_sec=1.0))


# ── 시드 파일 ────────────────────────────────────────────────────────────────


def test_smoke_seeds_are_within_d3_globs(real_allowlist) -> None:
    """시드가 전부 allowlist host + D3 글롭 안이다 (게이트에서 잘리면 하한 미달로 끝난다)."""
    seeds = load_seeds(SEED_FILE, "official_website")
    assert len(seeds) >= 10, f"시드가 {len(seeds)}건이다 — 수집 하한 10건을 채울 수 없다"
    policy = real_allowlist.get("official_website")
    assert policy is not None
    from urllib.parse import urlsplit

    for seed in seeds:
        host = (urlsplit(seed.url).hostname or "").lower()
        assert policy.allows_host(host), f"{seed.url}: host 가 allowlist 밖이다"
        assert policy.allows_url(seed.url), f"{seed.url}: D3 allowed_path_globs 밖이다"


def test_smoke_seeds_are_gangnam_three_districts() -> None:
    seeds = load_seeds(SEED_FILE, "official_website")
    allowed = {"강남구", "서초구", "송파구"}
    bad = [s.target_key for s in seeds if s.district not in allowed]
    assert bad == [], f"강남 3구 밖 시드: {bad}"


def test_smoke_seeds_reject_forbidden_source() -> None:
    with pytest.raises(ConfigError, match="시드가 없다"):
        load_seeds(SEED_FILE, "naver_place")
