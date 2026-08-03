"""금지 심볼 스캐너 — FORBID-4 (접근통제 회피) · FORBID-6 (c) (원문 제거 우회).

두 검사를 한 스캐너로 돌린다. 대상은 `services/crawler/` 트리이며, 패턴 리터럴은
:mod:`crawler.ci.patterns` 에만 있다 (자기 자신이 스캔에 걸리지 않게).

FORBID-4
  · `pyproject.toml` 의 의존 목록에 스텔스·프록시 로테이션·랜덤 UA 패키지가 있으면 실패
  · `core/` 코드에 회피 심볼·프록시 로테이션 설정 키가 있으면 실패

FORBID-6 (c)
  · `source_record` 대상 UPDATE/DELETE SQL·ORM 호출이 `crawler.purge` 모듈 밖에 있으면 실패
  · blob 객체 삭제 호출이 파기 경로(purge·storage) 밖에 있으면 실패
"""

from __future__ import annotations

import argparse
import re
import sys
import tomllib
from dataclasses import dataclass
from pathlib import Path

from ..d3 import repo_root
from ._common import GuardError, Report
from .patterns import (
    BLOB_REMOVAL_PATTERNS,
    FORBIDDEN_CODE_SYMBOLS,
    FORBIDDEN_CONFIG_KEYS,
    FORBIDDEN_DEPENDENCIES,
    PURGE_ALLOWED_PATHS,
    SELF_EXCLUDED,
    SOURCE_RECORD_MUTATION_PATTERNS,
)

CRAWLER_DIR = "services/crawler"
CODE_ROOT = "services/crawler/core"
PYPROJECT = "services/crawler/pyproject.toml"

SCAN_SUFFIXES = {".py", ".toml", ".yaml", ".yml", ".cfg", ".ini", ".json"}
SKIP_DIR_PARTS = {
    ".git",
    ".venv",
    "venv",
    "__pycache__",
    ".pytest_cache",
    ".ruff_cache",
    "node_modules",
    "artifacts",
}


@dataclass(frozen=True, slots=True)
class Hit:
    rel: str
    line_no: int
    token: str
    why: str
    line: str


def scan_targets(base: Path, sub: str) -> list[Path]:
    root = base / sub
    if not root.exists():
        return []
    out = []
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(base)
        if SKIP_DIR_PARTS & set(rel.parts):
            continue
        if path.suffix not in SCAN_SUFFIXES:
            continue
        out.append(path)
    return out


def _is_self_excluded(rel: str) -> bool:
    return any(rel.endswith(suffix) for suffix in SELF_EXCLUDED)


def _scan(base: Path, paths: list[Path], patterns, *, allowed_paths=()) -> list[Hit]:
    hits: list[Hit] = []
    for path in paths:
        rel = str(path.relative_to(base))
        if _is_self_excluded(rel):
            continue
        if any(rel.endswith(allowed) for allowed in allowed_paths):
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        for line_no, line in enumerate(text.splitlines(), start=1):
            for token, why in patterns:
                if token in line:
                    hits.append(Hit(rel, line_no, token, why, line.strip()[:160]))
    return hits


def _normalize_dist(name: str) -> str:
    """PEP 503 정규화. `Fake_UserAgent` 와 `fake-useragent` 를 같은 것으로 본다."""
    return re.sub(r"[-_.]+", "-", name).strip().lower()


def declared_dependencies(text: str) -> list[str]:
    """`pyproject.toml` 의 실제 의존 목록. **주석은 대상이 아니다.**

    주석까지 문자열로 스캔하면 이 파일의 FORBID-4 경고 주석 자체가 위반으로 잡혀,
    검사기가 자기 문서를 죽이라고 요구하게 된다 (규격 §3.4 자기 차단 안티패턴).
    """
    data = tomllib.loads(text)
    project = data.get("project") or {}
    specs: list[str] = list(project.get("dependencies") or [])
    for extra in (project.get("optional-dependencies") or {}).values():
        specs.extend(extra)
    names = []
    for spec in specs:
        head = re.split(r"[\[<>=!~;\s]", str(spec), maxsplit=1)[0]
        if head:
            names.append(head)
    return names


def check_dependencies(report: Report, base: Path) -> None:
    path = base / PYPROJECT
    if not path.is_file():
        report.fail(f"{PYPROJECT} 가 없다 — 의존 검사 대상 부재는 통과가 아니다")
        return
    declared = declared_dependencies(path.read_text(encoding="utf-8"))
    if not declared:
        report.fail(f"{PYPROJECT} 에서 의존을 하나도 읽지 못했다 — 파싱 실패는 통과가 아니다")
        return
    banned = {_normalize_dist(name) for name in FORBIDDEN_DEPENDENCIES}
    found = sorted({name for name in declared if _normalize_dist(name) in banned})
    if found:
        report.fail(
            f"{PYPROJECT} 에 접근통제 회피 의존이 있다: {found} (FORBID-4) — "
            "스텔스·프록시 로테이션·랜덤 UA 는 D3 실사의 전제(비로그인 공개 정보)를 파기한다"
        )
    else:
        report.note(
            f"{PYPROJECT}: 선언된 의존 {len(declared)}건 · 금지 목록 "
            f"{len(FORBIDDEN_DEPENDENCIES)}종 중 0건"
        )


def check_code_symbols(report: Report, base: Path) -> None:
    paths = scan_targets(base, CODE_ROOT)
    if not paths:
        report.fail(f"{CODE_ROOT} 스캔 대상이 0건이다 — 검사가 공허하다")
        return
    hits = _scan(base, paths, (*FORBIDDEN_CODE_SYMBOLS, *FORBIDDEN_CONFIG_KEYS))
    for hit in hits:
        report.fail(f"FORBID-4 {hit.rel}:{hit.line_no} `{hit.token}` — {hit.why} :: {hit.line}")
    if not hits:
        report.note(
            f"{CODE_ROOT}: 파일 {len(paths)}건 스캔 · 회피 심볼 "
            f"{len(FORBIDDEN_CODE_SYMBOLS) + len(FORBIDDEN_CONFIG_KEYS)}종 중 0건"
        )


def check_source_record_mutations(report: Report, base: Path) -> None:
    paths = scan_targets(base, CODE_ROOT)
    if not paths:
        report.fail(f"{CODE_ROOT} 스캔 대상이 0건이다 — 검사가 공허하다")
        return
    hits = _scan(
        base,
        paths,
        (*SOURCE_RECORD_MUTATION_PATTERNS, *BLOB_REMOVAL_PATTERNS),
        allowed_paths=PURGE_ALLOWED_PATHS,
    )
    for hit in hits:
        report.fail(
            f"FORBID-6(c) {hit.rel}:{hit.line_no} `{hit.token}` — {hit.why}. "
            f"원문 제거는 crawler.purge 를 통해서만 한다 :: {hit.line}"
        )
    if not hits:
        report.note(
            f"{CODE_ROOT}: 원문 변경·삭제 관용구 "
            f"{len(SOURCE_RECORD_MUTATION_PATTERNS) + len(BLOB_REMOVAL_PATTERNS)}종 중 "
            f"파기 경로({', '.join(PURGE_ALLOWED_PATHS)}) 밖 0건"
        )


def run_all(base: Path) -> Report:
    report = Report("crawler-symbol-guard")
    check_dependencies(report, base)
    check_code_symbols(report, base)
    check_source_record_mutations(report, base)
    return report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m crawler.ci.symbol_guard")
    parser.add_argument("--root", default=None, help="리포 루트 (기본: 자동 탐지)")
    args = parser.parse_args(argv)
    try:
        base = Path(args.root) if args.root else repo_root()
        report = run_all(base)
    except GuardError as exc:
        print(f"crawler-symbol-guard: 판정 불가 — {exc}", file=sys.stderr)
        return 1
    return report.emit()


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
