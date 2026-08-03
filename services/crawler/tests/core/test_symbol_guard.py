"""FORBID-4 (CI 금지 심볼 검사) · FORBID-6 (c) (원문 제거 우회 검사) 의 단위 검증.

트리 복사본에 위반을 **주입해** 검사기가 실제로 빨간불을 켜는지 확인한다.
"""

from __future__ import annotations

import shutil

from _helpers import REPO_ROOT
from crawler.ci._common import Report
from crawler.ci.patterns import (
    BLOB_REMOVAL_PATTERNS,
    FORBIDDEN_CODE_SYMBOLS,
    FORBIDDEN_DEPENDENCIES,
    SOURCE_RECORD_MUTATION_PATTERNS,
)
from crawler.ci.symbol_guard import (
    CODE_ROOT,
    PYPROJECT,
    check_code_symbols,
    check_dependencies,
    check_source_record_mutations,
    declared_dependencies,
    run_all,
)


def _sandbox(tmp_path):
    """리포 트리에서 검사 대상만 복사한 샌드박스."""
    base = tmp_path / "repo"
    (base / CODE_ROOT).parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(REPO_ROOT / CODE_ROOT, base / CODE_ROOT)
    (base / PYPROJECT).parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(REPO_ROOT / PYPROJECT, base / PYPROJECT)
    return base


def test_real_tree_passes_all_checks() -> None:
    report = run_all(REPO_ROOT)
    assert report.failures == [], "\n".join(report.failures)
    assert len(report.notes) == 3


def test_pattern_dictionaries_are_not_empty() -> None:
    """패턴 사전이 비면 검사가 영원히 녹색이다."""
    assert len(FORBIDDEN_DEPENDENCIES) >= 10
    assert len(FORBIDDEN_CODE_SYMBOLS) >= 10
    assert len(SOURCE_RECORD_MUTATION_PATTERNS) >= 8
    assert len(BLOB_REMOVAL_PATTERNS) >= 2


def test_declared_dependencies_ignores_comments() -> None:
    """주석 안의 금지 이름은 의존이 아니다 — 자기 문서를 죽이지 않는다."""
    text = (REPO_ROOT / PYPROJECT).read_text(encoding="utf-8")
    assert "playwright-stealth" in text, "FORBID-4 경고 주석이 사라졌다"
    names = declared_dependencies(text)
    assert "playwright-stealth" not in names
    assert "playwright" in names
    assert "PyYAML" in names


def test_guard_detects_stealth_dependency(tmp_path) -> None:
    base = _sandbox(tmp_path)
    path = base / PYPROJECT
    text = path.read_text(encoding="utf-8").replace(
        '  "jsonschema>=4.21",', '  "jsonschema>=4.21",\n  "playwright-stealth>=1.0",'
    )
    path.write_text(text, encoding="utf-8")
    report = Report("t")
    check_dependencies(report, base)
    assert any("playwright-stealth" in f for f in report.failures), report.failures


def test_guard_detects_random_user_agent_dependency(tmp_path) -> None:
    base = _sandbox(tmp_path)
    path = base / PYPROJECT
    text = path.read_text(encoding="utf-8").replace(
        '  "jsonschema>=4.21",', '  "jsonschema>=4.21",\n  "fake_useragent==1.5.1",'
    )
    path.write_text(text, encoding="utf-8")
    report = Report("t")
    check_dependencies(report, base)
    assert any("fake_useragent" in f for f in report.failures), report.failures


def test_guard_detects_proxy_rotation_config_key(tmp_path) -> None:
    base = _sandbox(tmp_path)
    (base / CODE_ROOT / "crawler" / "rotation.yaml").write_text(
        "proxies:\n  - http://10.0.0.1:8080\n  - http://10.0.0.2:8080\n", encoding="utf-8"
    )
    report = Report("t")
    check_code_symbols(report, base)
    assert any("proxies:" in f for f in report.failures), report.failures


def test_guard_detects_cookie_injection(tmp_path) -> None:
    base = _sandbox(tmp_path)
    (base / CODE_ROOT / "crawler" / "sneaky.py").write_text(
        "def build():\n    return HTTPCookieProcessor()\n", encoding="utf-8"
    )
    report = Report("t")
    check_code_symbols(report, base)
    assert any("HTTPCookieProcessor" in f for f in report.failures), report.failures


def test_guard_detects_source_record_delete_outside_purge(tmp_path) -> None:
    base = _sandbox(tmp_path)
    (base / CODE_ROOT / "crawler" / "cleanup.py").write_text(
        'SQL = "DELETE FROM core.source_record WHERE fetched_at < now() - interval \'90 days\'"\n',
        encoding="utf-8",
    )
    report = Report("t")
    check_source_record_mutations(report, base)
    assert any("DELETE FROM core.source_record" in f for f in report.failures), report.failures


def test_guard_detects_source_record_update_outside_purge(tmp_path) -> None:
    base = _sandbox(tmp_path)
    (base / CODE_ROOT / "crawler" / "fixup.py").write_text(
        'SQL = "UPDATE core.source_record SET raw_payload = NULL"\n', encoding="utf-8"
    )
    report = Report("t")
    check_source_record_mutations(report, base)
    assert any("UPDATE core.source_record" in f for f in report.failures), report.failures


def test_guard_detects_blob_removal_outside_purge(tmp_path) -> None:
    base = _sandbox(tmp_path)
    (base / CODE_ROOT / "crawler" / "gc.py").write_text(
        "import shutil\n\n\ndef sweep(path):\n    shutil.rmtree(path)\n", encoding="utf-8"
    )
    report = Report("t")
    check_source_record_mutations(report, base)
    assert any(".rmtree(" in f for f in report.failures), report.failures


def test_guard_allows_removal_inside_purge_path(tmp_path) -> None:
    """파기 경로 자신은 예외다 — 예외가 없으면 crawler.purge 가 자기 검사에 걸린다."""
    base = _sandbox(tmp_path)
    report = Report("t")
    check_source_record_mutations(report, base)
    assert report.failures == [], report.failures


def test_guard_fails_when_scan_target_is_empty(tmp_path) -> None:
    """검사 대상 0건은 통과가 아니다."""
    base = tmp_path / "empty-repo"
    base.mkdir()
    report = Report("t")
    check_code_symbols(report, base)
    assert any("공허하다" in f for f in report.failures), report.failures


def test_guard_fails_when_pyproject_missing(tmp_path) -> None:
    base = tmp_path / "no-pyproject"
    base.mkdir()
    report = Report("t")
    check_dependencies(report, base)
    assert any("없다" in f for f in report.failures), report.failures
