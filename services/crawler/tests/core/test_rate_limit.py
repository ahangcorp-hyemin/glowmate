"""REQ-4 · FORBID-3 — per-host 레이트/동시성 리미터 + request_log 부하테스트.

`pytest -m load -k test_rate_limit_window`
"""

from __future__ import annotations

import random
import threading

import pytest

from _helpers import (
    FIXTURE_SOURCE,
    SLOW_SOURCE,
    html_response,
    make_robots,
    robots_text,
)
from crawler.clock import FakeClock
from crawler.jobqueue import JobQueue
from crawler.models import Job, JobStatus
from crawler.net.preflight import PreflightGate
from crawler.net.ratelimit import RateLimiter, RateLimiterRegistry
from crawler.net.transport import RecordingTransport
from crawler.storage.blob import BlobStore
from crawler.storage.record import JsonlSourceRecordStore
from crawler.worker import Worker

BODY = b"<html><body>" + ("업체 상세 본문. " * 200).encode("utf-8") + b"</body></html>"

HOSTS = ("fixture.example", "alt.fixture.example")


def _urls(count: int) -> list[str]:
    return [f"https://{HOSTS[i % len(HOSTS)]}/venue/{i}" for i in range(count)]


@pytest.mark.load
def test_rate_limit_window_500_jobs(tmp_path, fixture_allowlist) -> None:
    """500 job 부하 — host별 1초 윈도우 위반 0건 · in-flight 위반 0건 · 최소 간격 위반 0건."""
    clock = FakeClock(start=0.0)
    urls = _urls(500)

    robots_transport = RecordingTransport(
        responses={
            f"https://{host}/robots.txt": html_response(
                robots_text("allow_all").encode("utf-8"), f"https://{host}/robots.txt"
            )
            for host in HOSTS
        }
    )
    from crawler.net.robots import RobotsEvaluator

    gate = PreflightGate(fixture_allowlist, RobotsEvaluator(robots_transport, clock=clock))
    content = RecordingTransport(
        responses={url: html_response(BODY, url) for url in urls}
    )
    limiters = RateLimiterRegistry(clock=clock)
    queue = JobQueue()
    worker = Worker(
        queue=queue,
        allowlist=fixture_allowlist,
        preflight=gate,
        transport=content,
        blob_store=BlobStore(tmp_path / "blobs"),
        record_store=JsonlSourceRecordStore(tmp_path / "records.jsonl"),
        limiters=limiters,
        clock=clock,
        rng=random.Random(1),
        crawl_run_id="run-load",
    )
    for index, url in enumerate(urls):
        queue.enqueue(Job(source_id=FIXTURE_SOURCE, target_key=f"fixture:{index}", url=url))
    worker.run_until_empty()

    assert worker.stats.success == 500, f"성공 {worker.stats.success}/500"

    log = limiters.request_log
    assert len(log) == 500, f"request_log 항목이 {len(log)}건이다 — 요청 1건당 1행이어야 한다"

    policy = fixture_allowlist.get(FIXTURE_SOURCE)
    assert policy is not None
    violations = []
    for host in log.hosts():
        violations += log.window_violations(host, policy.max_rps)
        violations += log.concurrency_violations(host, policy.per_host_concurrency)
        violations += log.interval_violations(host, policy.min_interval_sec)
    assert violations == [], (
        f"슬라이딩 윈도우/동시성/간격 위반 {len(violations)}건: {violations[:5]}"
    )

    for entry in log.entries:
        assert entry.host in HOSTS
        assert entry.source_id == FIXTURE_SOURCE
        assert entry.ts_ms >= 0
        assert entry.in_flight >= 1


@pytest.mark.load
def test_rate_limit_window_detects_violation_when_limiter_bypassed() -> None:
    """리미터를 우회해 같은 초에 몰아 넣으면 위반이 실제로 잡힌다 (검사가 공허하지 않다)."""
    from crawler.models import RequestLogEntry
    from crawler.net.ratelimit import RequestLog

    log = RequestLog()
    for i in range(5):
        log.append(
            RequestLogEntry(
                host="fixture.example", source_id=FIXTURE_SOURCE, ts_ms=100 + i, in_flight=1
            )
        )
    assert log.window_violations("fixture.example", 1.0), "1초에 5요청인데 위반이 0건으로 나왔다"
    assert log.interval_violations("fixture.example", 1.0), "간격 위반이 0건으로 나왔다"

    log2 = RequestLog()
    log2.append(RequestLogEntry("fixture.example", FIXTURE_SOURCE, 0, in_flight=5))
    assert log2.concurrency_violations("fixture.example", 2), "in-flight 5 > 2 인데 위반이 0건이다"


@pytest.mark.load
def test_rate_limit_slow_source_min_interval(tmp_path, fixture_allowlist) -> None:
    """max_rps=0.1(=분당 6회) 소스에서 연속 요청 간격이 10초 이상이다."""
    clock = FakeClock(start=0.0)
    urls = [f"https://slow.fixture.example/venue/{i}" for i in range(12)]
    robots, _ = make_robots(
        robots_text("allow_all"), clock, origin="https://slow.fixture.example"
    )
    gate = PreflightGate(fixture_allowlist, robots)
    content = RecordingTransport(responses={url: html_response(BODY, url) for url in urls})
    limiters = RateLimiterRegistry(clock=clock)
    queue = JobQueue()
    worker = Worker(
        queue=queue,
        allowlist=fixture_allowlist,
        preflight=gate,
        transport=content,
        blob_store=BlobStore(tmp_path / "blobs"),
        record_store=JsonlSourceRecordStore(tmp_path / "records.jsonl"),
        limiters=limiters,
        clock=clock,
        crawl_run_id="run-slow",
    )
    for index, url in enumerate(urls):
        queue.enqueue(Job(source_id=SLOW_SOURCE, target_key=f"slow:{index}", url=url))
    worker.run_until_empty()

    assert worker.stats.success == 12
    intervals = limiters.request_log.intervals_sec("slow.fixture.example")
    assert intervals, "간격을 관측하지 못했다"
    assert min(intervals) >= 10.0 - 1e-6, f"최소 간격 {min(intervals)}s < 10s"


def test_concurrency_limiter_blocks_third_request() -> None:
    """per_host_concurrency=2 에서 세 번째 동시 요청은 대기한다."""
    limiter = RateLimiter(max_rps=1000.0, per_host_concurrency=2)
    entered = threading.Semaphore(0)
    release = threading.Event()
    observed: list[int] = []

    def hold() -> None:
        with limiter.acquire("https://fixture.example/venue/1", FIXTURE_SOURCE) as entry:
            observed.append(entry.in_flight)
            entered.release()
            release.wait(timeout=5)

    threads = [threading.Thread(target=hold) for _ in range(2)]
    for thread in threads:
        thread.start()
    assert entered.acquire(timeout=5)
    assert entered.acquire(timeout=5)

    third_done = threading.Event()

    def third() -> None:
        with limiter.acquire("https://fixture.example/venue/2", FIXTURE_SOURCE):
            third_done.set()

    third_thread = threading.Thread(target=third)
    third_thread.start()
    assert not third_done.wait(timeout=0.3), "동시성 상한을 넘겨 세 번째 요청이 즉시 나갔다"

    release.set()
    for thread in threads:
        thread.join(timeout=5)
    third_thread.join(timeout=5)
    assert third_done.is_set()
    assert max(entry.in_flight for entry in limiter.request_log.entries) <= 2


def test_worker_marks_status_for_every_job(tmp_path, fixture_allowlist) -> None:
    """부하 경로에서도 잡마다 상태가 남는다 — 상태 없는 잡은 '조용히 사라진 요청'이다."""
    clock = FakeClock(start=0.0)
    urls = _urls(10)
    robots_transport = RecordingTransport(
        responses={
            f"https://{host}/robots.txt": html_response(
                robots_text("allow_all").encode("utf-8"), f"https://{host}/robots.txt"
            )
            for host in HOSTS
        }
    )
    from crawler.net.robots import RobotsEvaluator

    queue = JobQueue()
    worker = Worker(
        queue=queue,
        allowlist=fixture_allowlist,
        preflight=PreflightGate(fixture_allowlist, RobotsEvaluator(robots_transport, clock=clock)),
        transport=RecordingTransport(responses={url: html_response(BODY, url) for url in urls}),
        blob_store=BlobStore(tmp_path / "blobs"),
        record_store=JsonlSourceRecordStore(tmp_path / "records.jsonl"),
        limiters=RateLimiterRegistry(clock=clock),
        clock=clock,
        crawl_run_id="run-status",
    )
    for index, url in enumerate(urls):
        queue.enqueue(Job(source_id=FIXTURE_SOURCE, target_key=f"fixture:{index}", url=url))
    worker.run_until_empty()
    assert all(job.status is JobStatus.SUCCESS for job in queue.done)
    assert len(queue.done) == 10
