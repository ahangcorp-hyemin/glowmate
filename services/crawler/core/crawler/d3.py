"""D3-SOURCE-DUE-DILIGENCE 산출물의 **대조 원천 확보기**.

C1 의 `sources.allowlist.yaml` 은 D3 의 `verdicts.csv` · `crawl_policy.yaml` 을 전사한 것이다
(계약 out_of_scope: "D3 산출물 전사만 수행"). 전사가 정말 전사인지 검사하려면 원본이 있어야
하는데, 원본은 태스크 브랜치 `feat/d3-source-dd` 에 있고 **머지 순서에 따라 워킹트리에 없을 수
있다.** 대상 부재를 통과로 처리하면 그 순간 allowlist 검사는 영원히 녹색이 된다.

그래서 해석 순서를 고정하고, **어느 경로로 얻든 내용의 sha256 이 고정 상수와 일치해야만**
대조 원천으로 인정한다.

  1. 워킹트리 `docs/discovery/D3/<name>`            ← D3 가 머지된 뒤의 정상 경로
  2. `git show <ref>:docs/discovery/D3/<name>`      ← D3 브랜치가 아직 안 머지된 중간 상태
  3. `services/crawler/tests/fixtures/core/d3/<name>` (전사 시점 사본)

3번 사본을 두는 이유는 1·2 가 모두 불가능한 환경(얕은 체크아웃 등)에서 검사가 **공허하게
통과**하는 것을 막기 위해서다. 사본은 sha256 상수로 봉인되어 있어 손대면 즉시 실패한다.
sha256 상수 자체는 이 파일에 있고, D3 정본이 개정되면 **반드시 여기와 allowlist 를 함께
고쳐야** 하며 그것이 FORBID-1 (b) 의 `d3-change-approved` 라벨 대상이다.
"""

from __future__ import annotations

import csv
import hashlib
import io
import subprocess
from dataclasses import dataclass
from pathlib import Path

from .errors import ProvenanceError

#: D3 정본 파일과 전사 시점 sha256. 값의 출처는 `git show feat/d3-source-dd:<path> | shasum -a 256`.
D3_PINNED_SHA256: dict[str, str] = {
    "verdicts.csv": "497eed691ced2a9bb4eeac1afae03691d60706bd78db4c8f738ffc616dd4eb36",
    "crawl_policy.yaml": "a899ebb063d99c5d117960dea89485fc5944a0ede3f06bae5dcec4ce0f03bb47",
}

#: D3 정본의 리포 내 경로 (해석 1번)
D3_DOC_DIR = "docs/discovery/D3"

#: D3 브랜치 후보 (해석 2번). 머지되면 1번이 먼저 잡히므로 이 목록은 자연히 죽는다.
D3_FALLBACK_REFS: tuple[str, ...] = (
    "origin/feat/d3-source-dd",
    "feat/d3-source-dd",
)

#: 전사 시점 사본 (해석 3번)
D3_PINNED_COPY_DIR = "services/crawler/tests/fixtures/core/d3"

#: D3 verdict 값 집합. F2a `core.source_license_status` enum 과 동일해야 한다.
VERDICT_VALUES = ("allowed", "conditional", "pending", "forbidden")

#: `verdict` 가 이 집합에 있으면 어떤 아웃바운드도 허용하지 않는다.
DENIED_VERDICTS = frozenset({"forbidden", "pending"})


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


@dataclass(frozen=True, slots=True)
class D3Artifact:
    name: str
    text: str
    sha256: str
    origin: str


def repo_root(start: Path | None = None) -> Path:
    """`.git` 이 있는 상위 디렉터리. 못 찾으면 예외 (조용한 기본값 금지)."""
    here = (start or Path(__file__)).resolve()
    for candidate in [here, *here.parents]:
        if (candidate / ".git").exists():
            return candidate
    raise ProvenanceError(
        f"리포지토리 루트(.git)를 찾지 못했다 — D3 대조 원천을 해석할 수 없다 (start={here})"
    )


def _git_show(root: Path, ref: str, rel: str) -> bytes | None:
    try:
        proc = subprocess.run(
            ["git", "show", f"{ref}:{rel}"],
            cwd=root,
            capture_output=True,
            timeout=30,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if proc.returncode != 0:
        return None
    return proc.stdout


def load_d3_artifact(name: str, root: Path | None = None) -> D3Artifact:
    """D3 산출물 1건을 해석 순서대로 확보한다.

    sha256 이 :data:`D3_PINNED_SHA256` 과 다르면 **경로와 무관하게 실패**한다.
    D3 정본이 개정된 상태에서 C1 이 전사를 갱신하지 않은 것이므로, 통과시키면
    allowlist 가 낡은 판정을 근거로 요청을 내보내게 된다.
    """
    if name not in D3_PINNED_SHA256:
        raise ProvenanceError(f"D3 대조 대상이 아니다: {name}")
    expected = D3_PINNED_SHA256[name]
    base = repo_root(root)
    attempts: list[str] = []

    worktree = base / D3_DOC_DIR / name
    candidates: list[tuple[str, bytes]] = []
    if worktree.is_file():
        candidates.append((f"worktree:{D3_DOC_DIR}/{name}", worktree.read_bytes()))
    else:
        attempts.append(f"worktree:{D3_DOC_DIR}/{name} (없음)")

    if not candidates:
        for ref in D3_FALLBACK_REFS:
            blob = _git_show(base, ref, f"{D3_DOC_DIR}/{name}")
            if blob is None:
                attempts.append(f"git:{ref} (해석 실패)")
                continue
            candidates.append((f"git:{ref}:{D3_DOC_DIR}/{name}", blob))
            break

    if not candidates:
        pinned = base / D3_PINNED_COPY_DIR / name
        if pinned.is_file():
            candidates.append((f"pinned:{D3_PINNED_COPY_DIR}/{name}", pinned.read_bytes()))
        else:
            attempts.append(f"pinned:{D3_PINNED_COPY_DIR}/{name} (없음)")

    if not candidates:
        raise ProvenanceError(
            "D3 대조 원천을 확보하지 못했다 — 판정 불가를 통과로 처리하지 않는다.\n"
            f"  대상: {name}\n  시도: " + "\n        ".join(attempts)
        )

    origin, blob = candidates[0]
    actual = sha256_hex(blob)
    if actual != expected:
        raise ProvenanceError(
            f"D3 산출물 {name} 의 sha256 이 전사 시점과 다르다 (origin={origin}).\n"
            f"  기대: {expected}\n  실제: {actual}\n"
            "  D3 정본이 개정된 것이다. `sources.allowlist.yaml` 전사와 "
            "`crawler.d3.D3_PINNED_SHA256` 을 함께 갱신하고 `d3-change-approved` 라벨을 붙여라."
        )
    return D3Artifact(name=name, text=blob.decode("utf-8"), sha256=actual, origin=origin)


def load_verdicts(root: Path | None = None) -> dict[str, str]:
    """`verdicts.csv` → {source: verdict}. 값 검증은 fail-closed."""
    art = load_d3_artifact("verdicts.csv", root)
    rows = list(csv.DictReader(io.StringIO(art.text)))
    if not rows:
        raise ProvenanceError("verdicts.csv 에 행이 0건이다 — 대조가 공허하다")
    out: dict[str, str] = {}
    for row in rows:
        source = (row.get("source") or "").strip()
        verdict = (row.get("verdict") or "").strip()
        if not source:
            raise ProvenanceError(f"verdicts.csv 에 source 가 빈 행이 있다: {row}")
        if verdict not in VERDICT_VALUES:
            raise ProvenanceError(
                f"verdicts.csv 의 verdict 값이 허용 집합 밖이다: {source}={verdict!r} "
                f"(허용: {', '.join(VERDICT_VALUES)})"
            )
        out[source] = verdict
    return out


def load_crawl_policy(root: Path | None = None) -> dict[str, dict[str, object]]:
    """`crawl_policy.yaml` → {source: policy}. yaml 파서로 읽는다."""
    import yaml  # 지연 임포트: d3 모듈은 CI 스크립트에서도 단독으로 쓰인다

    art = load_d3_artifact("crawl_policy.yaml", root)
    data = yaml.safe_load(art.text)
    if not isinstance(data, dict) or not data:
        raise ProvenanceError("crawl_policy.yaml 을 매핑으로 읽지 못했다 — 대조가 공허하다")
    for source, policy in data.items():
        if not isinstance(policy, dict):
            raise ProvenanceError(f"crawl_policy.yaml 의 {source} 항목이 매핑이 아니다")
    return data
