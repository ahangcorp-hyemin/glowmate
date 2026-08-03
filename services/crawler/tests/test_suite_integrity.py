"""services/crawler 트리에 대한 자기 검사 (F1 REQ-4 · FORBID-2).

지키는 것으로 끝내지 않고, 미래의 커밋이 어길 때 잡히도록 탐지 수단을 남긴다.

1. REQ-4 "pytest 수집 테스트 수 ≥ 1" — 그냥 개수를 세면 이 파일 자신 때문에 항상 참이 되므로,
   **REQ-4 의 핵심 assert 를 담은 테스트 노드 ID 가 실제로 수집되는지**를 확인한다.
   해당 테스트를 삭제·개명·비활성화하면 여기서 실패한다.
2. FORBID-2 "종료 코드 마스킹 / 검사 대상 축소" — tests/forbidden_idioms.txt 의 패턴 사전으로
   services/crawler 트리 전체를 스캔한다.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

#: 크롤러 컴포넌트 루트 (services/crawler)
CRAWLER_ROOT = Path(__file__).resolve().parents[1]

#: REQ-4 의 assert 를 담은 테스트. 이 노드가 사라지면 REQ-4 는 검증되지 않는다.
REQUIRED_TEST_FILE = "tests/test_extract_smoke.py"
REQUIRED_TEST_NAME = "test_extracts_single_text_from_local_fixture"
REQUIRED_TEST_NODE_ID = f"{REQUIRED_TEST_FILE}::{REQUIRED_TEST_NAME}"

#: 패턴 사전 자신과 이 스캐너는 위반 정의가 목적이므로 스캔 대상에서 제외한다
#: (F1 FORBID-2 when 절의 "검사기의 패턴 정의 파일" 예외).
SCAN_EXCLUDED_FILES = {
    "tests/forbidden_idioms.txt",
    "tests/test_suite_integrity.py",
}

SCAN_EXCLUDED_DIRS = {
    ".git",
    ".pytest_cache",
    ".ruff_cache",
    ".venv",
    "venv",
    "__pycache__",
    "node_modules",
    ".mypy_cache",
    "dist",
    "build",
}

SCAN_SUFFIXES = {".py", ".toml", ".cfg", ".ini", ".sh", ".yml", ".yaml", ".md", ".txt", ".html"}


def _load_forbidden_idioms() -> list[str]:
    path = CRAWLER_ROOT / "tests" / "forbidden_idioms.txt"
    lines = path.read_text(encoding="utf-8").splitlines()
    idioms = [line.strip() for line in lines if line.strip() and not line.startswith("#")]
    if not idioms:
        raise AssertionError(f"패턴 사전이 비었다: {path}")
    return idioms


def _scan_targets() -> list[Path]:
    targets: list[Path] = []
    for path in sorted(CRAWLER_ROOT.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(CRAWLER_ROOT)
        if SCAN_EXCLUDED_DIRS & set(rel.parts):
            continue
        if rel.as_posix() in SCAN_EXCLUDED_FILES:
            continue
        if path.suffix not in SCAN_SUFFIXES:
            continue
        targets.append(path)
    return targets


def test_required_req4_test_is_collected() -> None:
    """REQ-4 스모크 테스트가 수집 목록에 실재하는지 확인한다 (수집 수 ≥ 1 의 실질 판정)."""
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "--collect-only", "-q", "--no-header"],
        cwd=CRAWLER_ROOT,
        capture_output=True,
        text=True,
        timeout=180,
    )
    assert result.returncode == 0, (
        f"수집 실패 (exit={result.returncode})\n{result.stdout}\n{result.stderr}"
    )

    node_ids = [line.strip() for line in result.stdout.splitlines() if "::" in line]
    assert len(node_ids) >= 1, f"수집된 테스트가 0건이다\n{result.stdout}"
    assert REQUIRED_TEST_NODE_ID in node_ids, (
        f"REQ-4 스모크 테스트 {REQUIRED_TEST_NODE_ID} 가 수집되지 않았다.\n수집된 노드: {node_ids}"
    )


def test_no_exit_code_masking_idioms() -> None:
    """FORBID-2: 종료 코드 마스킹 / 검사 대상 축소 관용구가 트리에 없어야 한다."""
    idioms = _load_forbidden_idioms()
    targets = _scan_targets()
    assert targets, "스캔 대상 파일이 0건이다 — 검사가 공허하다"

    violations: list[str] = []
    for path in targets:
        try:
            content = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        rel = path.relative_to(CRAWLER_ROOT).as_posix()
        for lineno, line in enumerate(content.splitlines(), start=1):
            for idiom in idioms:
                if idiom in line:
                    violations.append(f"{rel}:{lineno}: {idiom!r} → {line.strip()}")

    assert not violations, "FORBID-2 위반:\n" + "\n".join(violations)
