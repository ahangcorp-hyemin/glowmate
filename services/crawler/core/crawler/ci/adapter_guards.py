"""어댑터 공용 CI 가드 3종 — `path-guard` · `dataset-lock` · `dataset-order`.

전부 **`services/crawler/adapters/*` 글롭**으로 동작한다. C2·C3 및 파생 어댑터 태스크가
`.github/workflows/crawler.yml` 을 수정하지 않아도 자기 디렉터리에 대해 검사가 걸린다는 뜻이다.
어댑터 디렉터리가 0개면 세 검사는 "대상 없음"으로 통과하되, 그 사실을 **출력에 남긴다** —
조용히 통과하면 나중에 검사가 죽었는지 대상이 없는지 구별할 수 없다.

각 검사가 집행하는 것 (C2 · C3 계약 본문):

  path-guard    — 어댑터 PR 의 diff 가 `adapters/<sid>/**` · `tests/adapters/<sid>/**` ·
                  `tests/fixtures/adapters/<sid>/**` 밖으로 나가면 exit 1.
                  특히 `core/**` · `pyproject.toml` · `docs/discovery/D3/**` 는 절대 금지다.
  dataset-lock  — `dataset_manifest.json` · `manifest.lock` · 라벨·홀드아웃 픽스처 diff 감지 시
                  `dataset-change-approved` 라벨 없으면 exit 1,
                  sha256(dataset_manifest.json) ≠ manifest.lock 이면 exit 1.
  dataset-order — `git log` 상 manifest.lock 최초 커밋 시각 ≤ `extract*.py` 최초 커밋 시각.
"""

from __future__ import annotations

import argparse
import hashlib
import re
import sys
from pathlib import Path

from ..d3 import repo_root
from ._common import (
    ADAPTERS_DIR,
    GuardError,
    Report,
    adapter_ids_in,
    changed_files,
    existing_adapter_ids,
    pr_labels,
    run_git,
)

DATASET_LABEL = "dataset-change-approved"

#: 어댑터 태스크가 건드릴 수 있는 경로 패턴 (`{sid}` 치환)
ADAPTER_ALLOWED_PATTERNS = (
    "services/crawler/adapters/{sid}/",
    "services/crawler/tests/adapters/{sid}/",
    "services/crawler/tests/fixtures/adapters/{sid}/",
)

#: 어떤 어댑터 PR 도 건드릴 수 없는 경로
ADAPTER_FORBIDDEN_PREFIXES = (
    "services/crawler/core/",
    "services/crawler/pyproject.toml",
    "services/crawler/config/",
    "docs/discovery/D3/",
    ".github/workflows/",
)

#: dataset-lock 이 감시하는 파일 (어댑터 디렉터리 기준 상대경로)
DATASET_GUARDED = ("dataset_manifest.json", "manifest.lock")
DATASET_GUARDED_DIR_HINTS = ("labels", "holdout", "fixtures")

MANIFEST_NAME = "dataset_manifest.json"
LOCK_NAME = "manifest.lock"

EXTRACT_GLOB = re.compile(r"^extract.*\.py$")


def _sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


# ── path-guard ───────────────────────────────────────────────────────────────


def check_adapter_paths(report: Report, root: Path, files: list[str]) -> None:
    ids = adapter_ids_in(files)
    if not ids:
        report.note(
            f"diff 에 `{ADAPTERS_DIR}/*` 변경이 없다 — 어댑터 경로 검사 대상 0건 "
            f"(현재 존재하는 어댑터: {', '.join(existing_adapter_ids(root)) or '없음'})"
        )
        return
    report.note(f"어댑터 diff 대상: {', '.join(ids)}")
    allowed_prefixes = [
        pattern.format(sid=sid) for sid in ids for pattern in ADAPTER_ALLOWED_PATTERNS
    ]
    for rel in files:
        if rel == ".github/pr-task" or rel == "pnpm-lock.yaml":
            continue
        for forbidden in ADAPTER_FORBIDDEN_PREFIXES:
            if rel.startswith(forbidden):
                report.fail(
                    f"어댑터 PR 이 공용 경로를 변경했다: {rel} — "
                    "등록은 C1 의 규약 기반 자동 발견으로만 이루어진다"
                )
                break
        else:
            if not any(rel.startswith(prefix) for prefix in allowed_prefixes):
                report.fail(
                    f"어댑터 PR 의 diff 가 자기 경로 밖이다: {rel} "
                    f"(허용: {', '.join(allowed_prefixes)})"
                )


# ── dataset-lock ─────────────────────────────────────────────────────────────


def _is_dataset_file(rel: str, sid: str) -> bool:
    prefix = f"{ADAPTERS_DIR}/{sid}/"
    if not rel.startswith(prefix):
        return False
    tail = rel[len(prefix) :]
    if tail in DATASET_GUARDED:
        return True
    return any(tail.startswith(hint + "/") or hint in tail for hint in DATASET_GUARDED_DIR_HINTS)


def check_dataset_lock(report: Report, root: Path, files: list[str]) -> None:
    ids = adapter_ids_in(files)
    if not ids:
        report.note("dataset-lock: 어댑터 diff 없음 — 대상 0건")
        return
    touched: dict[str, list[str]] = {}
    for sid in ids:
        hits = [rel for rel in files if _is_dataset_file(rel, sid)]
        if hits:
            touched[sid] = hits

    for sid in ids:
        adir = root / ADAPTERS_DIR / sid
        manifest = adir / MANIFEST_NAME
        lock = adir / LOCK_NAME
        if manifest.is_file() != lock.is_file():
            report.fail(
                f"{sid}: {MANIFEST_NAME} 와 {LOCK_NAME} 중 하나만 있다 "
                f"(manifest={manifest.is_file()}, lock={lock.is_file()})"
            )
            continue
        if not manifest.is_file():
            report.note(f"{sid}: 데이터셋 매니페스트 없음 (표집 대상 없는 어댑터)")
            continue
        expected = _sha256_file(manifest)
        actual = lock.read_text(encoding="utf-8").strip().split()[0]
        if actual != expected:
            report.fail(
                f"{sid}: sha256({MANIFEST_NAME})={expected} 가 {LOCK_NAME}={actual} 와 다르다"
            )
        else:
            report.note(f"{sid}: manifest.lock 재계산 일치")

    if not touched:
        report.note("dataset-lock: 데이터셋 파일 diff 없음 — 라벨 게이트 미발동")
        return

    labels = pr_labels(root)
    report.note(f"dataset-lock 라벨 원천: {labels.origin}")
    if not labels.has(DATASET_LABEL):
        flat = [rel for hits in touched.values() for rel in hits]
        report.fail(
            f"`{DATASET_LABEL}` 라벨 없이 데이터셋 파일 {len(flat)}건을 변경했다: {flat[:8]}"
        )


# ── dataset-order ────────────────────────────────────────────────────────────


def _first_commit_epoch(root: Path, rel: str) -> int | None:
    out = run_git(root, ["log", "--diff-filter=A", "--format=%ct", "--reverse", "--", rel])
    lines = [line.strip() for line in out.splitlines() if line.strip()]
    if not lines:
        return None
    return int(lines[0])


def check_dataset_order(report: Report, root: Path) -> None:
    ids = existing_adapter_ids(root)
    if not ids:
        report.note("dataset-order: 어댑터 디렉터리 0개 — 대상 없음")
        return
    for sid in ids:
        adir = root / ADAPTERS_DIR / sid
        lock_rel = f"{ADAPTERS_DIR}/{sid}/{LOCK_NAME}"
        if not (adir / LOCK_NAME).is_file():
            report.note(f"{sid}: {LOCK_NAME} 없음 — 순서 검사 대상 아님")
            continue
        lock_at = _first_commit_epoch(root, lock_rel)
        if lock_at is None:
            report.fail(
                f"{sid}: {LOCK_NAME} 의 최초 커밋 시각을 얻지 못했다 — "
                "미커밋 lock 은 선행 커밋 요건을 만족하지 않는다"
            )
            continue
        extract_files = [
            f"{ADAPTERS_DIR}/{sid}/{child.name}"
            for child in sorted(adir.iterdir())
            if child.is_file() and EXTRACT_GLOB.match(child.name)
        ]
        if not extract_files:
            report.note(f"{sid}: extract*.py 없음 — 순서 검사 대상 아님")
            continue
        for rel in extract_files:
            extract_at = _first_commit_epoch(root, rel)
            if extract_at is None:
                report.fail(f"{sid}: {rel} 의 최초 커밋 시각을 얻지 못했다")
                continue
            if lock_at > extract_at:
                report.fail(
                    f"{sid}: {LOCK_NAME} 최초 커밋({lock_at}) 이 "
                    f"{rel} 최초 커밋({extract_at}) 보다 늦다 — "
                    "표집을 뒤에 맞추면 홀드아웃이 홀드아웃이 아니다"
                )
            else:
                report.note(f"{sid}: {LOCK_NAME} 선행 커밋 확인 ({lock_at} ≤ {extract_at})")


CHECKS = {
    "path-guard": "어댑터 PR diff 경계",
    "dataset-lock": "매니페스트 잠금 + 라벨 게이트",
    "dataset-order": "manifest.lock 선행 커밋",
}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m crawler.ci.adapter_guards")
    parser.add_argument("--check", required=True, choices=sorted(CHECKS))
    parser.add_argument("--base", default=None)
    args = parser.parse_args(argv)

    report = Report(args.check)
    try:
        root = repo_root()
        if args.check == "dataset-order":
            check_dataset_order(report, root)
        else:
            files = changed_files(root, args.base)
            report.note(f"diff 파일 {len(files)}건")
            if args.check == "path-guard":
                check_adapter_paths(report, root, files)
            else:
                check_dataset_lock(report, root, files)
    except GuardError as exc:
        print(f"{args.check}: 판정 불가 — {exc}", file=sys.stderr)
        return 1
    return report.emit()


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
