"""CI job `allowlist-guard` — FORBID-1 (b) 집행기.

두 층으로 본다.

**(A) D3 원천 대조 — diff 여부와 무관하게 항상**
  · `sources.allowlist.yaml` 의 모든 항목이 `verdicts.csv` 의 verdict 와 일치
  · `max_rps` ≤ `crawl_policy.yaml` 의 `max_requests_per_min` / 60
  · `per_host_concurrency` ≤ `max_concurrency`
  · `approved=true` 인 소스는 verdict ∉ {forbidden, pending}
  · `allowed_path_globs` 가 D3 글롭 집합의 **부분집합** (넓히는 것은 금지, 좁히는 것은 허용)
  · `user_agent` · `retry_backoff_sec` · `raw_retention_days` · `expiry_action` 전사 일치
  · allowlist 의 `d3_provenance` sha256 이 `crawler.d3.D3_PINNED_SHA256` 과 일치

**(B) 라벨 게이트 — allowlist 의 `approved` · `max_rps` · `per_host_concurrency` 가 바뀐 diff**
  · `d3-change-approved` 라벨이 없으면 exit 1
  · D3 산출물(`verdicts.csv` · `crawl_policy.yaml`)이 같은 diff 에서 갱신되지 않았으면 exit 1
  · **base 에 allowlist 파일이 없으면(=최초 도입 커밋) (B) 는 대상 제외.**
    이 예외가 없으면 이 계약의 자기 PR 이 자기 FORBID 에 걸린다
    (규격 §3.4 "계약이 자기 PR 을 차단" 안티패턴).
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

import yaml

from ..d3 import D3_DOC_DIR, D3_PINNED_SHA256, load_crawl_policy, load_verdicts, repo_root
from ..errors import ProvenanceError
from ._common import GuardError, Report, blob_at, changed_files, pr_labels, resolve_base

ALLOWLIST_REL = "services/crawler/config/sources.allowlist.yaml"
LABEL = "d3-change-approved"

#: (B) 가 감시하는 키
GUARDED_KEYS = ("approved", "max_rps", "per_host_concurrency")

D3_FILES = ("verdicts.csv", "crawl_policy.yaml")


def _load_yaml(text: str) -> dict:
    data = yaml.safe_load(text)
    if not isinstance(data, dict):
        raise GuardError("allowlist 를 매핑으로 읽지 못했다")
    return data


def _guarded_values(doc: dict) -> dict[tuple[str, str], object]:
    out: dict[tuple[str, str], object] = {}
    for source_id, entry in (doc.get("sources") or {}).items():
        if not isinstance(entry, dict):
            continue
        for key in GUARDED_KEYS:
            if key in entry:
                out[(str(source_id), key)] = entry[key]
    return out


def check_transcription(report: Report, root: Path, doc: dict) -> None:
    """(A) D3 원천 대조."""
    verdicts = load_verdicts(root)
    policies = load_crawl_policy(root)
    report.note(f"D3 verdicts.csv {len(verdicts)}건 · crawl_policy.yaml {len(policies)}건 대조")

    provenance = {str(k): str(v) for k, v in (doc.get("d3_provenance") or {}).items()}
    for name, expected in D3_PINNED_SHA256.items():
        actual = provenance.get(name)
        if actual != expected:
            report.fail(
                f"d3_provenance[{name}]={actual!r} 가 "
                f"crawler.d3.D3_PINNED_SHA256({expected}) 와 다르다 — "
                "전사 시점 고정값이 흔들리면 대조가 무의미해진다"
            )

    sources = doc.get("sources") or {}
    if not sources:
        report.fail("allowlist 의 sources 가 비었다 — 검사 대상 0건은 통과가 아니다")
        return

    for source_id in verdicts:
        if source_id not in sources:
            report.fail(
                f"D3 verdicts.csv 의 소스 {source_id} 가 allowlist 에 없다 — "
                "전사 누락은 검사 대상 축소다"
            )

    for source_id, entry in sources.items():
        sid = str(source_id)
        if sid not in verdicts:
            report.fail(
                f"allowlist 의 {sid} 가 D3 verdicts.csv 에 없다 — 실사 없는 소스는 넣지 않는다"
            )
            continue
        verdict = verdicts[sid]
        declared = str(entry.get("verdict", ""))
        if declared != verdict:
            report.fail(f"{sid}: verdict 전사 불일치 (allowlist={declared!r}, D3={verdict!r})")
        approved = bool(entry.get("approved", False))
        if approved and verdict in ("forbidden", "pending"):
            report.fail(
                f"{sid}: approved=true 인데 D3 verdict={verdict} 다 — "
                "실사 판정을 코드에서 뒤집지 않는다"
            )
        if not approved:
            for key in ("hosts", "allowed_path_globs"):
                if entry.get(key):
                    report.fail(
                        f"{sid}: approved=false 인데 {key} 가 비어 있지 않다 "
                        f"({len(entry[key])}건) — 금지·보류 소스에 요청 대상을 남기지 않는다"
                    )
            continue

        policy = policies.get(sid)
        if policy is None:
            report.fail(
                f"{sid}: approved=true 인데 D3 crawl_policy.yaml 에 준수 파라미터가 없다"
            )
            continue

        rpm = float(policy.get("max_requests_per_min", 0) or 0)
        max_rps = float(entry.get("max_rps", 0) or 0)
        ceiling = rpm / 60.0
        if max_rps > ceiling + 1e-9:
            report.fail(
                f"{sid}: max_rps={max_rps} > D3 상한 {ceiling:.6f} "
                f"(max_requests_per_min={rpm}/60) — 코드 diff 없이 부하를 배가시키는 변경이다"
            )
        else:
            report.note(f"{sid}: max_rps={max_rps} ≤ {ceiling:.6f}")

        concurrency = int(entry.get("per_host_concurrency", 0) or 0)
        max_concurrency = int(policy.get("max_concurrency", 0) or 0)
        if concurrency > max_concurrency:
            report.fail(
                f"{sid}: per_host_concurrency={concurrency} > D3 max_concurrency={max_concurrency}"
            )
        else:
            report.note(f"{sid}: per_host_concurrency={concurrency} ≤ {max_concurrency}")

        declared_rpm = float(entry.get("max_requests_per_min", 0) or 0)
        if abs(declared_rpm - rpm) > 1e-9:
            report.fail(f"{sid}: max_requests_per_min 전사 불일치 ({declared_rpm} ≠ {rpm})")

        for key in ("user_agent", "expiry_action"):
            if str(entry.get(key, "")) != str(policy.get(key, "")):
                report.fail(
                    f"{sid}: {key} 전사 불일치 "
                    f"(allowlist={entry.get(key)!r}, D3={policy.get(key)!r})"
                )
        for key in ("retry_backoff_sec", "raw_retention_days"):
            if int(entry.get(key, -1)) != int(policy.get(key, -2)):
                report.fail(
                    f"{sid}: {key} 전사 불일치 (allowlist={entry.get(key)}, D3={policy.get(key)})"
                )

        d3_globs = {str(g) for g in policy.get("allowed_path_globs") or ()}
        own_globs = {str(g) for g in entry.get("allowed_path_globs") or ()}
        extra = sorted(own_globs - d3_globs)
        if extra:
            report.fail(
                f"{sid}: D3 allowed_path_globs 에 없는 글롭 {len(extra)}건: {extra[:5]} — "
                "실사에서 요청해 본 적 없는 경로를 넓히지 않는다"
            )
        else:
            report.note(f"{sid}: allowed_path_globs {len(own_globs)}건이 D3 글롭의 부분집합")

        # 글롭에서 host 를 뽑아 hosts 전사와 대조한다 (도메인 임의 추가 차단)
        glob_hosts = set()
        for glob in own_globs:
            match = re.match(r"^https?://([^/]+)/", glob)
            if match:
                glob_hosts.add(match.group(1).lower())
        declared_hosts = {str(h).lower() for h in entry.get("hosts") or ()}
        stray = sorted(declared_hosts - glob_hosts)
        if stray:
            report.fail(
                f"{sid}: allowed_path_globs 에 근거가 없는 host {stray} — "
                "D3 실증 경로가 없는 도메인은 allowlist 에 올리지 않는다"
            )


def check_label_gate(report: Report, root: Path, base: str | None) -> None:
    """(B) 라벨 게이트."""
    base_sha = resolve_base(root, base)
    base_text = blob_at(root, base_sha, ALLOWLIST_REL)
    if base_text is None:
        report.note(
            f"base({base_sha[:8]}) 에 {ALLOWLIST_REL} 가 없다 — 최초 도입 커밋이므로 "
            "라벨 게이트 대상 제외 (계약 자기 차단 방지)"
        )
        return

    files = changed_files(root, base)
    if ALLOWLIST_REL not in files:
        report.note(f"{ALLOWLIST_REL} diff 없음 — 라벨 게이트 미발동")
        return

    head_text = (root / ALLOWLIST_REL).read_text(encoding="utf-8")
    before = _guarded_values(_load_yaml(base_text))
    after = _guarded_values(_load_yaml(head_text))
    changes = []
    for key in sorted(set(before) | set(after)):
        old = before.get(key)
        new = after.get(key)
        if old != new:
            changes.append(f"{key[0]}.{key[1]}: {old!r} → {new!r}")
    if not changes:
        report.note(
            f"{ALLOWLIST_REL} 가 바뀌었으나 {', '.join(GUARDED_KEYS)} 값 변경은 0건 — "
            "라벨 게이트 미발동"
        )
        return

    report.note(f"감시 대상 값 변경 {len(changes)}건: " + " · ".join(changes))
    labels = pr_labels(root)
    report.note(f"라벨 원천: {labels.origin} ({', '.join(sorted(labels.labels)) or '없음'})")
    if not labels.has(LABEL):
        report.fail(
            f"`{LABEL}` 라벨 없이 approved·max_rps·per_host_concurrency 를 변경했다: "
            + " · ".join(changes)
        )
    d3_touched = [f for f in files if f.startswith(f"{D3_DOC_DIR}/")]
    if not d3_touched:
        report.fail(
            "allowlist 의 승인·상한 값이 바뀌었는데 "
            "D3 산출물(docs/discovery/D3/**) 갱신이 diff 에 없다 — "
            "실사 없이 숫자만 올리는 것이 가장 싼 지름길이고, "
            "그 변경은 대상 서버 부하를 즉시 배가시킨다"
        )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m crawler.ci.allowlist_guard")
    parser.add_argument("--base", default=None, help="비교 기준 ref")
    parser.add_argument(
        "--skip-label-gate",
        action="store_true",
        help="(A) 전사 대조만 수행. 로컬에서 라벨 조회 없이 돌릴 때 쓴다",
    )
    args = parser.parse_args(argv)

    report = Report("allowlist-guard")
    try:
        root = repo_root()
        path = root / ALLOWLIST_REL
        if not path.is_file():
            print(f"allowlist-guard: {ALLOWLIST_REL} 가 없다 — exit 1", file=sys.stderr)
            return 1
        doc = _load_yaml(path.read_text(encoding="utf-8"))
        check_transcription(report, root, doc)
        if args.skip_label_gate:
            report.note("라벨 게이트 생략 (--skip-label-gate)")
        else:
            check_label_gate(report, root, args.base)
    except (GuardError, ProvenanceError) as exc:
        print(f"allowlist-guard: 판정 불가 — {exc}", file=sys.stderr)
        return 1
    return report.emit()


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
