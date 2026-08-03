"""`python -m crawler.smoke` — 실수집 스모크 (REQ-8).

픽스처가 아니라 **실제 아웃바운드 수집**을 한다. 계약 규격 R-7 이 요구하는 실환경 하한이며,
이게 없으면 수집 0건인 구현이 전 CI 를 녹색으로 통과한다.

수집 경로는 프로덕션과 같다 — allowlist → robots(fail-closed) → per-host 리미터 →
차단 판정 → blob 저장 + 재조회 검증 → source_record. 스모크 전용 우회 경로는 없다.

종료 코드
  0  records ≥ 10 · sha256_mismatch = 0 · http_429_403 = 0 · 최소 간격 ≥ 정책값
  1  위 중 하나라도 어긋남 (수집 0건도 여기 해당한다 — 0건은 '통과'가 아니다)
"""

from __future__ import annotations

import argparse
import json
import statistics
import sys
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import yaml

from .allowlist import load_allowlist
from .blocking import BlockingDetector
from .clock import SystemClock
from .d3 import repo_root
from .errors import ConfigError
from .jobqueue import DownstreamQueue, JobQueue
from .models import Job, JobStatus
from .net.preflight import PreflightGate
from .net.ratelimit import RateLimiterRegistry
from .net.robots import RobotsEvaluator
from .net.transport import UrllibTransport
from .registry import discover_adapters
from .storage.blob import BlobStore
from .storage.record import JsonlSourceRecordStore
from .worker import Worker, WorkerConfig

#: REQ-8 하한
MIN_RECORDS = 10

DEFAULT_SEED_FILE = "services/crawler/config/smoke_seeds.yaml"
DEFAULT_REPORT = "artifacts/smoke.json"
DEFAULT_OUT_DIR = "artifacts/crawl"


@dataclass(frozen=True, slots=True)
class Seed:
    url: str
    target_key: str
    name: str
    district: str


def load_seeds(path: str | Path, source_id: str) -> list[Seed]:
    p = Path(path)
    if not p.is_file():
        raise ConfigError(f"시드 파일이 없다: {p}")
    data = yaml.safe_load(p.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ConfigError(f"시드 파일을 매핑으로 읽지 못했다: {p}")
    seeds_by_source = data.get("seeds")
    if not isinstance(seeds_by_source, dict):
        raise ConfigError(f"시드 파일에 seeds 매핑이 없다: {p}")
    raw = seeds_by_source.get(source_id)
    if not raw:
        raise ConfigError(
            f"시드 파일에 source={source_id!r} 의 시드가 없다: {p} — "
            "시드 0건을 '수집할 것이 없음'으로 처리하지 않는다"
        )
    seeds = []
    for item in raw:
        if not isinstance(item, dict) or not item.get("url") or not item.get("target_key"):
            raise ConfigError(f"시드 항목에 url/target_key 가 없다: {item!r}")
        seeds.append(
            Seed(
                url=str(item["url"]),
                target_key=str(item["target_key"]),
                name=str(item.get("name", "")),
                district=str(item.get("district", "")),
            )
        )
    keys = [s.target_key for s in seeds]
    dupes = sorted({k for k in keys if keys.count(k) > 1})
    if dupes:
        raise ConfigError(f"시드 target_key 중복: {dupes}")
    return seeds


def _percentile(values: list[float], q: float) -> float | None:
    if not values:
        return None
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    idx = min(len(ordered) - 1, max(0, round(q * (len(ordered) - 1))))
    return ordered[idx]


def run_smoke(
    *,
    source_id: str,
    seed_file: str | Path,
    out_dir: str | Path,
    allowlist_path: str | Path | None = None,
    root: Path | None = None,
    limit: int | None = None,
) -> dict:
    """실수집을 수행하고 리포트 dict 를 만든다."""
    base = repo_root(root)
    allowlist = load_allowlist(allowlist_path, root=root)
    policy = allowlist.get(source_id)
    if policy is None:
        raise ConfigError(f"allowlist 에 없는 소스다: {source_id}")
    if not policy.approved:
        raise ConfigError(
            f"{source_id} 는 approved=false (verdict={policy.verdict}) — "
            "D3 가 금지·보류한 소스로 실수집을 하지 않는다"
        )

    seeds = load_seeds(seed_file, source_id)
    if limit is not None:
        seeds = seeds[:limit]

    crawl_run_id = f"smoke-{datetime.now(UTC).strftime('%Y%m%dT%H%M%SZ')}-{uuid.uuid4().hex[:8]}"
    run_dir = Path(out_dir) / crawl_run_id
    run_dir.mkdir(parents=True, exist_ok=True)

    clock = SystemClock()
    content_transport = UrllibTransport()
    robots_transport = UrllibTransport()
    robots = RobotsEvaluator(robots_transport, clock=clock)
    gate = PreflightGate(allowlist, robots)
    limiters = RateLimiterRegistry(clock=clock)
    blob_store = BlobStore(run_dir / "blobs")
    record_store = JsonlSourceRecordStore(run_dir / "source_record.jsonl")
    downstream = DownstreamQueue()
    queue = JobQueue()

    try:
        registry = discover_adapters(allowlist=allowlist, root=root)

        def adapter_provider(sid: str):
            return registry.get(sid) if sid in registry else None
    except Exception:
        registry = None

        def adapter_provider(sid: str):
            del sid
            return None

    worker = Worker(
        queue=queue,
        allowlist=allowlist,
        preflight=gate,
        transport=content_transport,
        blob_store=blob_store,
        record_store=record_store,
        detector=BlockingDetector(),
        limiters=limiters,
        clock=clock,
        downstream=downstream,
        adapter_provider=adapter_provider,
        crawl_run_id=crawl_run_id,
        # 실수집에서 dead_letter 까지 40분 넘게 기다리지 않는다. 백오프 정책 자체는
        # WorkerConfig 기본값(60/300/1500)이 정본이고, 스모크는 재시도 1회로 제한한다.
        config=WorkerConfig(max_retries=1, backoff_schedule=(30.0,), jitter_ratio=0.0),
    )

    started_at = datetime.now(UTC)
    for seed in seeds:
        queue.enqueue(
            Job(
                source_id=source_id,
                target_key=seed.target_key,
                url=seed.url,
                crawl_run_id=crawl_run_id,
            )
        )
    worker.run_until_empty()
    finished_at = datetime.now(UTC)

    request_log = limiters.request_log
    per_host: dict[str, dict] = {}
    all_intervals: list[float] = []
    min_interval = None
    for host in request_log.hosts():
        intervals = request_log.intervals_sec(host)
        all_intervals.extend(intervals)
        per_host[host] = {
            "requests": len(request_log.for_host(host)),
            "intervals_sec": [round(v, 3) for v in intervals],
            "min_interval_sec": round(min(intervals), 3) if intervals else None,
        }
        if intervals:
            candidate = min(intervals)
            min_interval = candidate if min_interval is None else min(min_interval, candidate)

    rows = record_store.all()
    mismatches = 0
    verified = 0
    for row in rows:
        payload = row.raw_payload or {}
        key = str(payload.get("blob_key", ""))
        expected = str(payload.get("body_sha256", ""))
        try:
            from .storage.blob import sha256_hex

            actual = sha256_hex(blob_store.get(key))
        except Exception:
            mismatches += 1
            continue
        verified += 1
        if actual != expected:
            mismatches += 1

    outcomes = []
    blocked_statuses = {JobStatus.BLOCKED_ACCESS, JobStatus.BLOCKED_ROBOTS}
    http_429_403 = 0
    for job in queue.done:
        reason = job.failure_reason or ""
        if job.status is JobStatus.BLOCKED_ACCESS and (
            "http-429" in reason or "http-403" in reason
        ):
            http_429_403 += 1
        outcomes.append(
            {
                "target_key": job.target_key,
                "url": job.url,
                "status": str(job.status),
                "attempts": job.attempts,
                "failure_reason": job.failure_reason,
            }
        )

    report = {
        "schema": "glowmate.crawler.smoke/1",
        "generated_at": finished_at.isoformat(timespec="seconds").replace("+00:00", "Z"),
        "started_at": started_at.isoformat(timespec="seconds").replace("+00:00", "Z"),
        "source": source_id,
        "source_license_status": policy.verdict,
        "crawl_run_id": crawl_run_id,
        "out_dir": str(run_dir.relative_to(base)) if run_dir.is_relative_to(base) else str(run_dir),
        "seeds": len(seeds),
        "records": len(rows),
        "records_sha256_verified": verified,
        "sha256_mismatch": mismatches,
        "http_429_403": http_429_403,
        "blocked": sum(1 for j in queue.done if j.status in blocked_statuses),
        "dead_letter": len(queue.dead_letter),
        "requests": len(request_log),
        "min_interval_sec": round(min_interval, 3) if min_interval is not None else None,
        "policy_min_interval_sec": round(policy.min_interval_sec, 3),
        "policy_max_requests_per_min": policy.max_requests_per_min,
        "interval_distribution": {
            "count": len(all_intervals),
            "min": round(min(all_intervals), 3) if all_intervals else None,
            "p50": round(_percentile(all_intervals, 0.5), 3) if all_intervals else None,
            "p90": round(_percentile(all_intervals, 0.9), 3) if all_intervals else None,
            "max": round(max(all_intervals), 3) if all_intervals else None,
            "mean": round(statistics.fmean(all_intervals), 3) if all_intervals else None,
        },
        "per_host": per_host,
        "robots_fetches": robots.fetch_count,
        "user_agent": policy.user_agent,
        "adapters_loaded": list(registry.source_ids) if registry is not None else [],
        "outcomes": outcomes,
        "worker": {
            "success": worker.stats.success,
            "failed": worker.stats.failed,
            "dead_letter": worker.stats.dead_letter,
            "blocked_access": worker.stats.blocked_access,
            "blocked_robots": worker.stats.blocked_robots,
            "source_not_allowed": worker.stats.source_not_allowed,
            "escaped_exceptions": worker.stats.escaped_exceptions,
        },
    }
    return report


def evaluate_report(report: dict, *, min_records: int = MIN_RECORDS) -> list[str]:
    """리포트를 판정한다. 반환 리스트가 비어 있어야 통과다."""
    problems: list[str] = []
    records = int(report.get("records", 0))
    if records < min_records:
        problems.append(f"records={records} < 하한 {min_records} — 수집 0건·미달은 통과가 아니다")
    if int(report.get("sha256_mismatch", 1)) != 0:
        problems.append(f"sha256_mismatch={report.get('sha256_mismatch')} ≠ 0")
    if int(report.get("http_429_403", 1)) != 0:
        problems.append(
            f"http_429_403={report.get('http_429_403')} ≠ 0 — 차단 응답이 있었다. "
            "재시도로 뚫지 말고 중단하고 보고하라"
        )
    policy_min = report.get("policy_min_interval_sec")
    observed = report.get("min_interval_sec")
    if policy_min is None:
        problems.append("policy_min_interval_sec 가 없다 — 판정 기준 부재는 통과가 아니다")
    elif observed is None:
        problems.append("min_interval_sec 가 없다 (요청 간격을 관측하지 못했다)")
    elif float(observed) + 1e-6 < float(policy_min):
        problems.append(
            f"min_interval_sec={observed} < 정책값 {policy_min} — rate limit 위반"
        )
    if int(report.get("worker", {}).get("escaped_exceptions", 0)) != 0:
        problems.append("워커에서 격리되지 않은 예외가 있었다")
    return problems


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m crawler.smoke", description="실수집 스모크 (C1 REQ-8)"
    )
    parser.add_argument("--source", required=True, help="수집할 소스 ID (D3 verdict ≠ forbidden)")
    parser.add_argument("--seed-file", default=DEFAULT_SEED_FILE, help="시드 파일 경로")
    parser.add_argument("--report", default=DEFAULT_REPORT, help="리포트 JSON 출력 경로")
    parser.add_argument("--out-dir", default=DEFAULT_OUT_DIR, help="blob·source_record 출력 루트")
    parser.add_argument("--allowlist", default=None, help="allowlist 경로 (기본: 리포 정본)")
    parser.add_argument("--limit", type=int, default=None, help="시드 상한 (디버그용)")
    parser.add_argument(
        "--min-records", type=int, default=MIN_RECORDS, help=f"수집 하한 (기본 {MIN_RECORDS})"
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        report = run_smoke(
            source_id=args.source,
            seed_file=args.seed_file,
            out_dir=args.out_dir,
            allowlist_path=args.allowlist,
            limit=args.limit,
        )
    except ConfigError as exc:
        print(f"스모크 실패 (설정): {exc}", file=sys.stderr)
        return 1

    report_path = Path(args.report)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(
        json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )

    problems = evaluate_report(report, min_records=args.min_records)
    print(
        f"smoke · source={report['source']} records={report['records']} "
        f"requests={report['requests']} min_interval={report['min_interval_sec']}s "
        f"(정책 {report['policy_min_interval_sec']}s) "
        f"sha256_mismatch={report['sha256_mismatch']} http_429_403={report['http_429_403']}"
    )
    print(f"리포트: {report_path}")
    if problems:
        for problem in problems:
            print(f"  ✗ {problem}", file=sys.stderr)
        return 1
    print("  ✓ REQ-8 하한 충족")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
