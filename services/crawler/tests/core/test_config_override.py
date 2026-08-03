"""FORBID-3 — allowlist 상한 초과 오버라이드는 ValueError.

계약 detect: "설정 로더 단위테스트(allowlist 상한 초과 오버라이드 시 ValueError)"
"""

from __future__ import annotations

import pytest

from _helpers import CORE_FIXTURES, DENIED_SOURCE, FIXTURE_SOURCE, REPO_ROOT
from crawler.allowlist import (
    ENV_CONCURRENCY_PREFIX,
    ENV_MAX_RPS_PREFIX,
    glob_match,
    load_allowlist,
    resolve_concurrency,
    resolve_max_rps,
)
from crawler.errors import ConfigError


def test_code_override_above_ceiling_raises(fixture_allowlist) -> None:
    policy = fixture_allowlist.get(FIXTURE_SOURCE)
    assert policy is not None and policy.max_rps == 1.0
    with pytest.raises(ValueError, match="FORBID-3"):
        resolve_max_rps(policy, override=1.0001)
    with pytest.raises(ValueError, match="FORBID-3"):
        resolve_max_rps(policy, override=10.0)
    with pytest.raises(ValueError, match="FORBID-3"):
        resolve_concurrency(policy, override=3)


def test_env_override_above_ceiling_raises(fixture_allowlist) -> None:
    policy = fixture_allowlist.get(FIXTURE_SOURCE)
    assert policy is not None
    env = {f"{ENV_MAX_RPS_PREFIX}{FIXTURE_SOURCE}": "5.0"}
    with pytest.raises(ValueError, match="FORBID-3"):
        resolve_max_rps(policy, env=env)
    env2 = {f"{ENV_CONCURRENCY_PREFIX}{FIXTURE_SOURCE}": "8"}
    with pytest.raises(ValueError, match="FORBID-3"):
        resolve_concurrency(policy, env=env2)


def test_override_below_ceiling_is_allowed(fixture_allowlist) -> None:
    """짝이 되는 정상 동작 — 낮추는 것은 언제나 허용한다."""
    policy = fixture_allowlist.get(FIXTURE_SOURCE)
    assert policy is not None
    assert resolve_max_rps(policy, override=0.2) == 0.2
    assert resolve_max_rps(policy, env={}) == policy.max_rps
    assert resolve_concurrency(policy, override=1) == 1
    assert resolve_concurrency(policy) == policy.per_host_concurrency


def test_min_interval_matches_policy(real_allowlist) -> None:
    policy = real_allowlist.get("official_website")
    assert policy is not None
    assert policy.max_requests_per_min == 6
    assert abs(policy.min_interval_sec - 10.0) < 1e-9


def test_load_rejects_approved_forbidden_source(tmp_path) -> None:
    """verdict=forbidden 인데 approved=true 인 allowlist 는 로드되지 않는다."""
    path = tmp_path / "bad.yaml"
    path.write_text(
        "schema_version: 1\n"
        "d3_provenance: {verdicts.csv: x}\n"
        "sources:\n"
        "  naver_place:\n"
        "    verdict: forbidden\n"
        "    approved: true\n"
        "    hosts: [map.naver.com]\n"
        "    allowed_path_globs: ['https://map.naver.com/*']\n"
        "    max_requests_per_min: 6\n"
        "    max_rps: 0.1\n",
        encoding="utf-8",
    )
    with pytest.raises(ConfigError, match="approved=true"):
        load_allowlist(path, root=REPO_ROOT)


def test_load_rejects_denied_source_with_hosts(tmp_path) -> None:
    path = tmp_path / "bad2.yaml"
    path.write_text(
        "schema_version: 1\n"
        "d3_provenance: {verdicts.csv: x}\n"
        "sources:\n"
        "  ok_source:\n"
        "    verdict: conditional\n"
        "    approved: true\n"
        "    hosts: [ok.example]\n"
        "    allowed_path_globs: ['https://ok.example/*']\n"
        "    max_requests_per_min: 6\n"
        "    max_rps: 0.1\n"
        "  daangn:\n"
        "    verdict: pending\n"
        "    approved: false\n"
        "    hosts: [www.daangn.com]\n"
        "    allowed_path_globs: []\n",
        encoding="utf-8",
    )
    with pytest.raises(ConfigError, match="비어 있지 않다"):
        load_allowlist(path, root=REPO_ROOT)


def test_load_rejects_zero_approved_sources(tmp_path) -> None:
    """approved 소스 0건은 '안전'이 아니라 파이프라인 정지다."""
    path = tmp_path / "empty.yaml"
    path.write_text(
        "schema_version: 1\n"
        "d3_provenance: {verdicts.csv: x}\n"
        "sources:\n"
        "  naver_place:\n"
        "    verdict: forbidden\n"
        "    approved: false\n"
        "    hosts: []\n"
        "    allowed_path_globs: []\n",
        encoding="utf-8",
    )
    with pytest.raises(ConfigError, match="approved=true 인 소스가 0건"):
        load_allowlist(path, root=REPO_ROOT)


def test_approved_sources_excludes_denied(fixture_allowlist) -> None:
    assert FIXTURE_SOURCE in fixture_allowlist.approved_sources
    assert DENIED_SOURCE not in fixture_allowlist.approved_sources
    assert DENIED_SOURCE in fixture_allowlist.sources


def test_glob_match_semantics() -> None:
    """`*` 는 경로 + 쿼리스트링 전체에 걸쳐 임의 문자열에 대응한다 (D3 규정)."""
    glob = "https://www.spoany.co.kr/branch_view.php?idx=*"
    assert glob_match("https://www.spoany.co.kr/branch_view.php?idx=26", glob)
    assert glob_match("https://www.spoany.co.kr/branch_view.php?idx=110", glob)
    assert not glob_match("https://www.spoany.co.kr/branch_view.php", glob)
    assert not glob_match("https://evil.example/branch_view.php?idx=26", glob)

    exact = "https://soonsoobeauty.com/"
    assert glob_match("https://soonsoobeauty.com/", exact)
    assert not glob_match("https://soonsoobeauty.com/admin", exact)


def test_policy_for_url_uses_approved_sources_only(fixture_allowlist) -> None:
    assert fixture_allowlist.policy_for_url("https://fixture.example/venue/1") is not None
    assert fixture_allowlist.policy_for_url("https://map.naver.com/x") is None


def test_test_allowlist_fixture_exists() -> None:
    assert (CORE_FIXTURES / "test_allowlist.yaml").is_file()
