"""REQ-6 — 규약 기반 자동 발견 레지스트리.

`pytest -k test_registry_convention`

핵심 주장: **`services/crawler/adapters/<source_id>/adapter.py` 파일 추가만으로 등록된다.**
`core/` · `pyproject.toml` · 타 어댑터 디렉터리의 diff 는 0건이어야 한다.
"""

from __future__ import annotations

import shutil
import subprocess

import pytest

from _helpers import (
    DENIED_SOURCE,
    FIXTURE_SOURCE,
    REFERENCE_ADAPTER,
    REPO_ROOT,
    SAMPLE_VENUE,
)
from crawler.adapter_contract_suite import (
    CONTRACT_CASE_COUNT,
    CONTRACT_CASES,
    AdapterContractContext,
    run_contract_case,
)
from crawler.errors import AdapterContractError, AdapterNotRegisteredError
from crawler.registry import ADAPTERS_ROOT, discover_adapters

WATCHED_PATHS = (
    "services/crawler/core",
    "services/crawler/pyproject.toml",
)


def _install_reference(adapters_root, source_id: str = FIXTURE_SOURCE):
    target = adapters_root / source_id
    target.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(REFERENCE_ADAPTER, target / "adapter.py")
    return target / "adapter.py"


def _git_diff_names(paths: tuple[str, ...]) -> list[str]:
    proc = subprocess.run(
        ["git", "diff", "--name-only", "HEAD", "--", *paths],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert proc.returncode == 0, f"git diff 실패: {proc.stderr}"
    return [line.strip() for line in proc.stdout.splitlines() if line.strip()]


def test_registry_convention_file_drop_registers_adapter(tmp_path, fixture_allowlist) -> None:
    """어댑터 디렉터리 추가만으로 레지스트리 조회가 성공한다."""
    adapters_root = tmp_path / ADAPTERS_ROOT
    before = discover_adapters(adapters_root=adapters_root, allowlist=fixture_allowlist,
                               root=REPO_ROOT)
    assert FIXTURE_SOURCE not in before

    baseline = _git_diff_names(WATCHED_PATHS)
    _install_reference(adapters_root)

    after = discover_adapters(adapters_root=adapters_root, allowlist=fixture_allowlist,
                              root=REPO_ROOT)
    adapter = after.get(FIXTURE_SOURCE)
    assert adapter.source_id == FIXTURE_SOURCE
    assert adapter.version
    assert FIXTURE_SOURCE in after
    assert len(after) == 1

    # 등록 과정에서 core/ · pyproject.toml 변경이 필요 없었다
    assert _git_diff_names(WATCHED_PATHS) == baseline, (
        "어댑터 등록이 공용 파일 변경을 요구했다 — 규약 기반 자동 발견이 성립하지 않는다"
    )


def test_registry_convention_registered_adapter_passes_contract_suite(
    tmp_path, fixture_allowlist
) -> None:
    """규약으로 등록된 어댑터가 15 케이스를 전부 통과한다 (skip 0건)."""
    adapters_root = tmp_path / ADAPTERS_ROOT
    _install_reference(adapters_root)
    registry = discover_adapters(
        adapters_root=adapters_root, allowlist=fixture_allowlist, root=REPO_ROOT
    )
    ctx = AdapterContractContext(
        adapter=registry.get(FIXTURE_SOURCE),
        allowlist=fixture_allowlist,
        sample_body=SAMPLE_VENUE.read_bytes(),
    )
    assert len(CONTRACT_CASES) == CONTRACT_CASE_COUNT
    for case in CONTRACT_CASES:
        run_contract_case(case, ctx)


def test_registry_does_not_load_unapproved_source(tmp_path, fixture_allowlist) -> None:
    """approved=false 소스의 어댑터는 로드되지 않는다 (done_when)."""
    adapters_root = tmp_path / ADAPTERS_ROOT
    _install_reference(adapters_root, source_id=DENIED_SOURCE)
    registry = discover_adapters(
        adapters_root=adapters_root, allowlist=fixture_allowlist, root=REPO_ROOT
    )
    assert DENIED_SOURCE not in registry
    assert registry.source_ids == ()
    assert DENIED_SOURCE in registry.rejected
    with pytest.raises(AdapterNotRegisteredError, match="approved=false"):
        registry.get(DENIED_SOURCE)


def test_registry_rejects_source_id_mismatch(tmp_path, fixture_allowlist) -> None:
    """디렉터리 이름과 어댑터의 source_id 가 다르면 등록되지 않는다."""
    adapters_root = tmp_path / ADAPTERS_ROOT
    target = adapters_root / "alt_fixture"
    target.mkdir(parents=True)
    source = REFERENCE_ADAPTER.read_text(encoding="utf-8")
    (target / "adapter.py").write_text(source, encoding="utf-8")

    # allowlist 에 alt_fixture 를 추가하지 않았으므로 approved=false 취급 → 로드 안 함
    registry = discover_adapters(
        adapters_root=adapters_root, allowlist=fixture_allowlist, root=REPO_ROOT
    )
    assert "alt_fixture" in registry.rejected


def test_registry_rejects_module_without_adapter_symbol(tmp_path, fixture_allowlist) -> None:
    adapters_root = tmp_path / ADAPTERS_ROOT
    target = adapters_root / FIXTURE_SOURCE
    target.mkdir(parents=True)
    (target / "adapter.py").write_text("VALUE = 1\n", encoding="utf-8")
    with pytest.raises(AdapterContractError, match="ADAPTER"):
        discover_adapters(adapters_root=adapters_root, allowlist=fixture_allowlist,
                          root=REPO_ROOT)


def test_registry_empty_directory_is_not_an_error(tmp_path, fixture_allowlist) -> None:
    """어댑터 0건은 오류가 아니다 (G3 상 C2·C3 보류) — 다만 로드된 어댑터도 0건이다."""
    registry = discover_adapters(
        adapters_root=tmp_path / ADAPTERS_ROOT, allowlist=fixture_allowlist, root=REPO_ROOT
    )
    assert len(registry) == 0
    with pytest.raises(AdapterNotRegisteredError, match="미등록 source_id"):
        registry.get(FIXTURE_SOURCE)


def test_contract_suite_detects_a_broken_adapter(tmp_path, fixture_allowlist) -> None:
    """계약 스위트가 실제로 위반을 잡는다 — 잡지 못하면 15 케이스는 장식이다."""
    adapters_root = tmp_path / ADAPTERS_ROOT
    target = adapters_root / FIXTURE_SOURCE
    target.mkdir(parents=True)
    (target / "adapter.py").write_text(
        "from crawler.contracts import ExtractedRecord, FetchTarget\n"
        "\n"
        "class Broken:\n"
        "    source_id = 'fixture_source'\n"
        "    version = 'broken-0.1'\n"
        "\n"
        "    def seed_targets(self):\n"
        "        return [FetchTarget(url='https://evil.example/venue/1', target_key='x')]\n"
        "\n"
        "    def extract(self, target, body):\n"
        "        return ExtractedRecord(source_id='fixture_source',\n"
        "                               source_page_url=target.url, venue_name='이름')\n"
        "\n"
        "ADAPTER = Broken()\n",
        encoding="utf-8",
    )
    registry = discover_adapters(
        adapters_root=adapters_root, allowlist=fixture_allowlist, root=REPO_ROOT
    )
    ctx = AdapterContractContext(
        adapter=registry.get(FIXTURE_SOURCE),
        allowlist=fixture_allowlist,
        sample_body=SAMPLE_VENUE.read_bytes(),
    )
    failed = []
    for case in CONTRACT_CASES:
        try:
            run_contract_case(case, ctx)
        except AdapterContractError:
            failed.append(case.id)
    assert "hosts_in_allowlist" in failed, "allowlist 밖 host 를 스위트가 통과시켰다"
    assert "urls_in_path_globs" in failed, "D3 글롭 밖 URL 을 스위트가 통과시켰다"
    assert "extract_fails_loudly" in failed, "조용한 실패(항상 성공 반환)를 스위트가 통과시켰다"
