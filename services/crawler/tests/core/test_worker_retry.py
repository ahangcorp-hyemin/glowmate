"""REQ-2 — 지수 백오프 재시도 + dead_letter 전이.

`pytest -k test_retry_backoff`
"""

from __future__ import annotations

import random

from _helpers import FIXTURE_ORIGIN, FIXTURE_SOURCE, html_response, make_robots, robots_text
from crawler.clock import FakeClock
from crawler.errors import TransportError
from crawler.jobqueue import JobQueue
from crawler.models import Job, JobStatus
from crawler.net.preflight import PreflightGate
from crawler.net.ratelimit import RateLimiterRegistry
from crawler.net.transport import RecordingTransport
from crawler.storage.blob import BlobStore
from crawler.storage.record import JsonlSourceRecordStore
from crawler.worker import DEFAULT_BACKOFF_SCHEDULE, Worker

URL = f"{FIXTURE_ORIGIN}/venue/1"


def _worker(tmp_path, allowlist, clock: FakeClock, outcome, *, jitter: float = 0.2) -> tuple:
    robots, _ = make_robots(robots_text("allow_all"), clock)
    gate = PreflightGate(allowlist, robots)
    transport = RecordingTransport(responses={URL: outcome})
    queue = JobQueue()
    worker = Worker(
        queue=queue,
        allowlist=allowlist,
        preflight=gate,
        transport=transport,
        blob_store=BlobStore(tmp_path / "blobs"),
        record_store=JsonlSourceRecordStore(tmp_path / "records.jsonl"),
        limiters=RateLimiterRegistry(clock=clock),
        clock=clock,
        rng=random.Random(20260803),
        crawl_run_id="run-retry",
    )
    if jitter != 0.2:  # pragma: no cover - 기본값 외 설정은 쓰지 않는다
        raise AssertionError("지터 비율은 계약 고정값이다")
    return worker, queue, transport


def test_retry_backoff_network_error_reaches_dead_letter(tmp_path, fixture_allowlist) -> None:
    """네트워크 오류 4회 → 재시도 시각 3개 + 최종 dead_letter."""
    clock = FakeClock(start=0.0)
    worker, queue, transport = _worker(
        tmp_path, fixture_allowlist, clock, TransportError("connection reset")
    )
    job = Job(source_id=FIXTURE_SOURCE, target_key="fixture:1", url=URL)
    queue.enqueue(job)
    worker.run_until_empty()

    assert job.status is JobStatus.DEAD_LETTER, f"최종 상태가 {job.status} 다"
    assert job.attempts == 4, f"시도 횟수가 {job.attempts} 다 (최초 1회 + 재시도 3회)"
    assert len(job.attempt_times) == 3, (
        f"재시도 시각 시퀀스가 {len(job.attempt_times)}개다 — 3개여야 한다"
    )
    assert len(queue.dead_letter) == 1
    assert transport.call_count == 4, f"요청 횟수가 {transport.call_count} 다"

    # 각 재시도 간격이 60/300/1500 의 ±20% 밴드 안에 있는지
    previous = 0.0
    pairs = zip(DEFAULT_BACKOFF_SCHEDULE, job.attempt_times, strict=True)
    for index, (base, at) in enumerate(pairs):
        delay = at - previous
        low, high = base * 0.8, base * 1.2
        assert low <= delay <= high, (
            f"{index + 1}번째 백오프 {delay:.1f}s 가 밴드 [{low}, {high}] 밖이다"
        )
        previous = at


def test_retry_backoff_5xx_is_retried(tmp_path, fixture_allowlist) -> None:
    """5xx 도 재시도 대상이다."""
    clock = FakeClock(start=0.0)
    worker, queue, transport = _worker(
        tmp_path, fixture_allowlist, clock, html_response(b"oops", URL, status=503)
    )
    job = Job(source_id=FIXTURE_SOURCE, target_key="fixture:1", url=URL)
    queue.enqueue(job)
    worker.run_until_empty()

    assert job.status is JobStatus.DEAD_LETTER
    assert transport.call_count == 4
    assert len(job.attempt_times) == 3


def test_retry_backoff_jitter_is_applied(tmp_path, fixture_allowlist) -> None:
    """지터가 실제로 붙는다 — 고정 간격이면 여러 워커가 같은 초에 몰린다."""
    clock = FakeClock(start=0.0)
    worker, queue, _ = _worker(
        tmp_path, fixture_allowlist, clock, TransportError("connection reset")
    )
    job = Job(source_id=FIXTURE_SOURCE, target_key="fixture:1", url=URL)
    queue.enqueue(job)
    worker.run_until_empty()

    delays = []
    previous = 0.0
    for at in job.attempt_times:
        delays.append(at - previous)
        previous = at
    jittered = zip(delays, DEFAULT_BACKOFF_SCHEDULE, strict=True)
    assert any(abs(d - base) > 1e-6 for d, base in jittered), (
        "모든 백오프가 기준값과 정확히 같다 — 지터가 적용되지 않았다"
    )


def test_retry_backoff_success_on_second_attempt(tmp_path, fixture_allowlist) -> None:
    """첫 시도 실패 후 성공하면 dead_letter 로 가지 않는다."""
    clock = FakeClock(start=0.0)
    robots, _ = make_robots(robots_text("allow_all"), clock)
    body = b"<html><body>" + b"x" * 2048 + b"</body></html>"

    class FlakyTransport(RecordingTransport):
        def get(self, url, *, user_agent, timeout=20.0):
            self.calls.append(url)
            if len(self.calls) == 1:
                raise TransportError("first attempt fails")
            return html_response(body, url)

    transport = FlakyTransport()
    queue = JobQueue()
    worker = Worker(
        queue=queue,
        allowlist=fixture_allowlist,
        preflight=PreflightGate(fixture_allowlist, robots),
        transport=transport,
        blob_store=BlobStore(tmp_path / "blobs"),
        record_store=JsonlSourceRecordStore(tmp_path / "records.jsonl"),
        limiters=RateLimiterRegistry(clock=clock),
        clock=clock,
        rng=random.Random(7),
        crawl_run_id="run-retry-ok",
    )
    job = Job(source_id=FIXTURE_SOURCE, target_key="fixture:1", url=URL)
    queue.enqueue(job)
    worker.run_until_empty()

    assert job.status is JobStatus.SUCCESS
    assert job.attempts == 2
    assert transport.call_count == 2
    assert len(queue.dead_letter) == 0
