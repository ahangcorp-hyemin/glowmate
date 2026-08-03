"""CI 가드 잡 공용 도구.

원칙: **판정 불가는 통과가 아니다.** git diff 를 얻지 못하거나 라벨을 조회하지 못하면
검사기는 exit 1 한다. F1 의 검사기들(`tools/ci-meta/**`)이 같은 규약을 쓴다.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
from dataclasses import dataclass, field
from pathlib import Path

from ..d3 import repo_root

#: 어댑터 태스크가 워크플로를 고치지 않아도 동작해야 하는 글롭의 기준 디렉터리
ADAPTERS_DIR = "services/crawler/adapters"


class GuardError(Exception):
    """검사 실패. 호출부가 exit 1 한다."""


@dataclass
class Report:
    name: str
    failures: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)

    def fail(self, message: str) -> None:
        self.failures.append(message)

    def note(self, message: str) -> None:
        self.notes.append(message)

    def emit(self) -> int:
        for note in self.notes:
            print(f"  · {note}")
        for failure in self.failures:
            print(f"  ✗ {failure}")
        if self.failures:
            print(f"{self.name}: 위반 {len(self.failures)}건 — exit 1")
            return 1
        print(f"{self.name}: 통과 (검사 {len(self.notes)}건)")
        return 0


def run_git(root: Path, args: list[str]) -> str:
    proc = subprocess.run(
        ["git", *args], cwd=root, capture_output=True, text=True, timeout=120, check=False
    )
    if proc.returncode != 0:
        raise GuardError(
            f"git {' '.join(args)} 실패 (exit={proc.returncode}): {proc.stderr.strip()} — "
            "diff 를 얻지 못한 것은 '변경 없음'이 아니다"
        )
    return proc.stdout


def resolve_base(root: Path, base: str | None = None) -> str:
    """비교 기준 커밋. 해석 실패는 예외 (조용한 전체 통과 금지)."""
    candidates = [base] if base else []
    candidates += [
        os.environ.get("GLOWMATE_BASE_REF"),
        os.environ.get("GITHUB_BASE_REF") and f"origin/{os.environ['GITHUB_BASE_REF']}",
        "origin/main",
        "main",
    ]
    for candidate in candidates:
        if not candidate:
            continue
        proc = subprocess.run(
            ["git", "rev-parse", "--verify", f"{candidate}^{{commit}}"],
            cwd=root,
            capture_output=True,
            text=True,
            check=False,
        )
        if proc.returncode == 0:
            return proc.stdout.strip()
    raise GuardError(
        "비교 기준 커밋을 해석할 수 없다 (시도: "
        + ", ".join(str(c) for c in candidates if c)
        + ") — 판정 불가를 통과로 처리하지 않는다"
    )


def changed_files(root: Path, base: str | None = None) -> list[str]:
    base_sha = resolve_base(root, base)
    out = run_git(root, ["diff", "--name-only", f"{base_sha}...HEAD"])
    files = [line.strip() for line in out.splitlines() if line.strip()]
    untracked = run_git(root, ["ls-files", "--others", "--exclude-standard"])
    files += [line.strip() for line in untracked.splitlines() if line.strip()]
    modified = run_git(root, ["diff", "--name-only"])
    files += [line.strip() for line in modified.splitlines() if line.strip()]
    return sorted(set(files))


def blob_at(root: Path, ref: str, rel: str) -> str | None:
    proc = subprocess.run(
        ["git", "show", f"{ref}:{rel}"], cwd=root, capture_output=True, text=True, check=False
    )
    if proc.returncode != 0:
        return None
    return proc.stdout


@dataclass(frozen=True, slots=True)
class LabelSet:
    labels: frozenset[str]
    origin: str

    def has(self, name: str) -> bool:
        return name in self.labels


def pr_labels(root: Path) -> LabelSet:
    """PR 라벨을 구한다.

    1. `GLOWMATE_PR_LABELS` (콤마 구분) — 로컬·테스트용 명시 주입
    2. `GITHUB_EVENT_PATH` 의 pull_request.labels — Actions 기본 경로
    3. `gh pr view --json labels`

    셋 다 실패하면 :class:`GuardError`. 라벨을 못 읽었다는 이유로 라벨 요구를
    면제하면 그 요구는 존재하지 않는 것과 같다.
    """
    env_labels = os.environ.get("GLOWMATE_PR_LABELS")
    if env_labels is not None:
        return LabelSet(
            frozenset(x.strip() for x in env_labels.split(",") if x.strip()),
            "GLOWMATE_PR_LABELS",
        )

    event_path = os.environ.get("GITHUB_EVENT_PATH")
    if event_path and Path(event_path).is_file():
        data = json.loads(Path(event_path).read_text(encoding="utf-8"))
        pull = data.get("pull_request")
        if isinstance(pull, dict):
            names = [str(item.get("name", "")) for item in pull.get("labels") or []]
            return LabelSet(frozenset(n for n in names if n), "GITHUB_EVENT_PATH")

    proc = subprocess.run(
        ["gh", "pr", "view", "--json", "labels"],
        cwd=root,
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode == 0:
        data = json.loads(proc.stdout or "{}")
        names = [str(item.get("name", "")) for item in data.get("labels") or []]
        return LabelSet(frozenset(n for n in names if n), "gh pr view")

    raise GuardError(
        "PR 라벨을 조회할 수 없다 "
        "(GLOWMATE_PR_LABELS · GITHUB_EVENT_PATH · gh pr view 전부 실패) — "
        "라벨 요구를 조회 실패로 면제하지 않는다"
    )


ADAPTER_DIR_RE = re.compile(rf"^{re.escape(ADAPTERS_DIR)}/([^/]+)/")


def adapter_ids_in(files: list[str]) -> list[str]:
    """diff 에서 건드린 어댑터 소스 ID 목록 (글롭 기반)."""
    ids = set()
    for rel in files:
        match = ADAPTER_DIR_RE.match(rel)
        if match:
            ids.add(match.group(1))
    return sorted(ids)


def existing_adapter_ids(root: Path | None = None) -> list[str]:
    base = repo_root(root)
    adir = base / ADAPTERS_DIR
    if not adir.is_dir():
        return []
    return sorted(
        child.name
        for child in adir.iterdir()
        if child.is_dir() and not child.name.startswith((".", "_"))
    )
