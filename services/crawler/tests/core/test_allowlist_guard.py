"""FORBID-1 (b) — CI job `allowlist-guard` 의 단위 검증.

집행기 자체가 실제로 **빨간불을 켜는지**를 확인한다. 위반을 잡지 못하는 검사기는
있으나 마나이고, 그 상태는 아무도 눈치채지 못한다.
"""

from __future__ import annotations

import copy

import pytest
import yaml

from _helpers import REPO_ROOT
from crawler.ci._common import Report
from crawler.ci.allowlist_guard import ALLOWLIST_REL, check_transcription
from crawler.d3 import (
    D3_PINNED_SHA256,
    ProvenanceError,
    load_crawl_policy,
    load_d3_artifact,
    load_verdicts,
)


def _doc() -> dict:
    return yaml.safe_load((REPO_ROOT / ALLOWLIST_REL).read_text(encoding="utf-8"))


def _check(doc: dict) -> Report:
    report = Report("allowlist-guard")
    check_transcription(report, REPO_ROOT, doc)
    return report


def test_real_allowlist_passes_transcription_check() -> None:
    """정본 allowlist 는 D3 원천 대조를 통과한다."""
    report = _check(_doc())
    assert report.failures == [], "\n".join(report.failures)
    assert report.notes, "검사 노트가 0건이다 — 대조가 공허하다"


def test_guard_detects_raised_max_rps() -> None:
    doc = _doc()
    doc["sources"]["official_website"]["max_rps"] = 1.0
    report = _check(doc)
    assert any("max_rps" in f for f in report.failures), report.failures


def test_guard_detects_raised_concurrency() -> None:
    doc = _doc()
    doc["sources"]["official_website"]["per_host_concurrency"] = 4
    report = _check(doc)
    assert any("per_host_concurrency" in f for f in report.failures), report.failures


def test_guard_detects_approving_forbidden_source() -> None:
    doc = _doc()
    doc["sources"]["naver_place"]["approved"] = True
    report = _check(doc)
    assert any("verdict=forbidden" in f for f in report.failures), report.failures


def test_guard_detects_approving_pending_source() -> None:
    doc = _doc()
    doc["sources"]["daangn"]["approved"] = True
    report = _check(doc)
    assert any("verdict=pending" in f for f in report.failures), report.failures


def test_guard_detects_widened_path_globs() -> None:
    doc = _doc()
    doc["sources"]["official_website"]["allowed_path_globs"].append(
        "https://www.spoany.co.kr/admode/*"
    )
    report = _check(doc)
    assert any("allowed_path_globs" in f for f in report.failures), report.failures


def test_guard_detects_stray_host() -> None:
    doc = _doc()
    doc["sources"]["official_website"]["hosts"].append("www.manicure2004.com")
    report = _check(doc)
    assert any("근거가 없는 host" in f for f in report.failures), report.failures


def test_guard_detects_verdict_rewrite() -> None:
    doc = _doc()
    doc["sources"]["naver_place"]["verdict"] = "conditional"
    report = _check(doc)
    assert any("verdict 전사 불일치" in f for f in report.failures), report.failures


def test_guard_detects_missing_source() -> None:
    doc = _doc()
    del doc["sources"]["taling"]
    report = _check(doc)
    assert any("전사 누락" in f for f in report.failures), report.failures


def test_guard_detects_extra_source_not_in_d3() -> None:
    doc = _doc()
    doc["sources"]["some_new_site"] = {
        "verdict": "conditional",
        "approved": True,
        "hosts": ["new.example"],
        "allowed_path_globs": ["https://new.example/*"],
        "max_rps": 0.1,
        "per_host_concurrency": 1,
    }
    report = _check(doc)
    assert any("실사 없는 소스" in f for f in report.failures), report.failures


def test_guard_detects_provenance_drift() -> None:
    doc = _doc()
    doc["d3_provenance"]["verdicts.csv"] = "0" * 64
    report = _check(doc)
    assert any("d3_provenance" in f for f in report.failures), report.failures


def test_guard_detects_denied_source_with_hosts() -> None:
    doc = _doc()
    doc["sources"]["kakao_map"]["hosts"] = ["map.kakao.com"]
    report = _check(doc)
    assert any("요청 대상을 남기지 않는다" in f for f in report.failures), report.failures


def test_guard_detects_transcription_drift_in_user_agent() -> None:
    doc = _doc()
    doc["sources"]["official_website"]["user_agent"] = "Mozilla/5.0 (사칭)"
    report = _check(doc)
    assert any("user_agent 전사 불일치" in f for f in report.failures), report.failures


def test_guard_detects_transcription_drift_in_expiry_action() -> None:
    doc = _doc()
    doc["sources"]["official_website"]["expiry_action"] = "delete_row"
    report = _check(doc)
    assert any("expiry_action 전사 불일치" in f for f in report.failures), report.failures


def test_guard_fails_on_empty_sources() -> None:
    report = _check({"d3_provenance": {}, "sources": {}})
    assert any("검사 대상 0건" in f for f in report.failures), report.failures


# ── D3 원천 확보기 자체 ──────────────────────────────────────────────────────


def test_d3_artifacts_resolve_and_match_pinned_sha() -> None:
    for name, expected in D3_PINNED_SHA256.items():
        artifact = load_d3_artifact(name, REPO_ROOT)
        assert artifact.sha256 == expected
        assert artifact.text.strip(), f"{name} 이 비었다"
        assert artifact.origin


def test_d3_verdicts_and_policy_load() -> None:
    verdicts = load_verdicts(REPO_ROOT)
    assert verdicts["official_website"] == "conditional"
    assert verdicts["naver_place"] == "forbidden"
    assert verdicts["daangn"] == "pending"
    policy = load_crawl_policy(REPO_ROOT)
    assert policy["official_website"]["max_requests_per_min"] == 6


def test_d3_unknown_artifact_is_rejected() -> None:
    with pytest.raises(ProvenanceError, match="대조 대상이 아니다"):
        load_d3_artifact("republish_policy.md", REPO_ROOT)


def test_d3_pinned_copy_is_byte_identical(monkeypatch) -> None:
    """전사 시점 사본이 봉인 sha256 과 같다 — 손대면 즉시 실패한다."""
    import crawler.d3 as d3

    monkeypatch.setattr(d3, "D3_DOC_DIR", "docs/discovery/__absent__")
    monkeypatch.setattr(d3, "D3_FALLBACK_REFS", ())
    for name, expected in D3_PINNED_SHA256.items():
        artifact = d3.load_d3_artifact(name, REPO_ROOT)
        assert artifact.origin.startswith("pinned:")
        assert artifact.sha256 == expected


def test_d3_missing_everything_is_fail_closed(monkeypatch, tmp_path) -> None:
    """세 경로가 모두 실패하면 예외 — 대조 원천 부재를 통과로 처리하지 않는다."""
    import crawler.d3 as d3

    (tmp_path / ".git").write_text("gitdir: /nowhere\n", encoding="utf-8")
    monkeypatch.setattr(d3, "D3_DOC_DIR", "docs/discovery/__absent__")
    monkeypatch.setattr(d3, "D3_FALLBACK_REFS", ())
    monkeypatch.setattr(d3, "D3_PINNED_COPY_DIR", "no/such/dir")
    with pytest.raises(ProvenanceError, match="확보하지 못했다"):
        d3.load_d3_artifact("verdicts.csv", tmp_path)


def test_d3_sha_mismatch_is_rejected(monkeypatch, tmp_path) -> None:
    """D3 정본이 개정되면(=sha 변동) 전사 갱신 전까지 실패한다."""
    import crawler.d3 as d3

    (tmp_path / ".git").write_text("gitdir: /nowhere\n", encoding="utf-8")
    fake_dir = tmp_path / "fixtures"
    fake_dir.mkdir()
    (fake_dir / "verdicts.csv").write_text("source,verdict\nofficial_website,allowed\n",
                                           encoding="utf-8")
    monkeypatch.setattr(d3, "D3_DOC_DIR", "docs/discovery/__absent__")
    monkeypatch.setattr(d3, "D3_FALLBACK_REFS", ())
    monkeypatch.setattr(d3, "D3_PINNED_COPY_DIR", "fixtures")
    with pytest.raises(ProvenanceError, match="sha256 이 전사 시점과 다르다"):
        d3.load_d3_artifact("verdicts.csv", tmp_path)


def test_allowlist_provenance_matches_module_constant() -> None:
    doc = _doc()
    for name, expected in D3_PINNED_SHA256.items():
        assert doc["d3_provenance"][name] == expected


def test_real_allowlist_transcribes_all_d3_sources() -> None:
    doc = _doc()
    verdicts = load_verdicts(REPO_ROOT)
    assert set(doc["sources"]) == set(verdicts), (
        f"allowlist 소스 집합과 D3 소스 집합이 다르다: "
        f"{sorted(set(doc['sources']) ^ set(verdicts))}"
    )


def test_deepcopy_helper_does_not_mutate_real_file() -> None:
    """이 테스트 파일이 정본을 건드리지 않는다는 자기검사."""
    original = (REPO_ROOT / ALLOWLIST_REL).read_text(encoding="utf-8")
    doc = _doc()
    mutated = copy.deepcopy(doc)
    mutated["sources"]["official_website"]["max_rps"] = 99
    assert (REPO_ROOT / ALLOWLIST_REL).read_text(encoding="utf-8") == original
