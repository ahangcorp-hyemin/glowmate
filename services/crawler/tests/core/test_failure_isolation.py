"""REQ-7 — 잡 단위 격리 + 소스별 서킷 브레이커.

`pytest -k test_failure_isolation`
"""

from __future__ import annotations

import random

from _helpers import FIXTURE_SOURCE, SLOW_SOURCE, html_response, robots_text
from crawler.clock import FakeClock
from crawler.errors import TransportError
from crawler.jobqueue import JobQueue
from crawler.models import CircuitState, Job, JobStatus
from crawler.net.preflight import PreflightGate
from crawler.net.ratelimit import RateLimiterRegistry
from crawler.net.robots import RobotsEvaluator
from crawler.net.transport import RecordingTransport
from crawler.storage.blob import BlobStore
from crawler.storage.record import JsonlSourceRecordStore
from crawler.worker import Worker, WorkerConfig

BODY = b"<html><body>" + ("업체 상세 본문. " * 200).encode("utf-8") + b"</body></html>"

HOSTS = {
    FIXTURE_SOURCE: "fixture.example",
    SLOW_SOURCE: "slow.fixture.example",
}


def _robots_transport(clock) -> RobotsEvaluator:
    responses = {
        f"https://{host}/robots.txt": html_response(
            robots_text("allow_all").encode("utf-8"), f"https://{host}/robots.txt"
        )
        for host in (*HOSTS.values(), "alt.fixture.example")
    }
    return RobotsEvaluator(RecordingTransport(responses=responses), clock=clock)


class ScriptedTransport:
    """URL 별로 성공/실패를 미리 정한 트랜스포트."""

    def __init__(self, failing: set[str]) -> None:
        self.failing = failing
        self.calls: list[str] = []

    def get(self, url, *, user_agent, timeout=20.0):
        self.calls.append(url)
        if url in self.failing:
            raise TransportError(f"강제 실패: {url}")
        return html_response(BODY, url)


def _build(tmp_path, allowlist, clock, transport, *, config=None) -> tuple[Worker, JobQueue]:
    queue = JobQueue()
    worker = Worker(
        queue=queue,
        allowlist=allowlist,
        preflight=PreflightGate(allowlist, _robots_transport(clock)),
        transport=transport,
        blob_store=BlobStore(tmp_path / "blobs"),
        record_store=JsonlSourceRecordStore(tmp_path / "records.jsonl"),
        limiters=RateLimiterRegistry(clock=clock),
        clock=clock,
        rng=random.Random(42),
        config=config or WorkerConfig(max_retries=0, backoff_schedule=()),
        crawl_run_id="run-isolation",
    )
    return worker, queue


def test_failure_isolation_1000_jobs_30_percent_failure(tmp_path, fixture_allowlist) -> None:
    """1000 job 중 30% 강제 실패 — 프로세스 비정상 종료 0회 · 나머지는 전부 처리된다."""
    clock = FakeClock(start=0.0)
    urls = [f"https://fixture.example/venue/{i}" for i in range(1000)]
    rng = random.Random(20260803)
    failing = set(rng.sample(urls, 300))
    transport = ScriptedTransport(failing)
    worker, queue = _build(tmp_path, fixture_allowlist, clock, transport)

    for index, url in enumerate(urls):
        queue.enqueue(Job(source_id=FIXTURE_SOURCE, target_key=f"fixture:{index}", url=url))
    worker.run_until_empty()

    assert worker.stats.escaped_exceptions == 0, (
        f"격리되지 않은 예외 {worker.stats.escaped_exceptions}건 — 워커 루프가 죽는다"
    )
    assert worker.stats.processed == 1000
    assert worker.stats.success == 700, f"성공 {worker.stats.success} != 700"
    assert worker.stats.dead_letter == 300, f"dead_letter {worker.stats.dead_letter} != 300"
    assert len(queue.done) == 1000


def test_failure_isolation_adapter_exception_is_contained(tmp_path, fixture_allowlist) -> None:
    """어댑터가 예외를 던져도 워커 루프는 계속 돈다."""
    clock = FakeClock(start=0.0)
    urls = [f"https://fixture.example/venue/{i}" for i in range(20)]
    transport = ScriptedTransport(failing=set())

    class ExplodingAdapter:
        source_id = FIXTURE_SOURCE
        version = "boom-0.1"

        def seed_targets(self):
            return []

        def extract(self, target, body):
            raise RuntimeError("어댑터 폭발")

    queue = JobQueue()
    worker = Worker(
        queue=queue,
        allowlist=fixture_allowlist,
        preflight=PreflightGate(fixture_allowlist, _robots_transport(clock)),
        transport=transport,
        blob_store=BlobStore(tmp_path / "blobs"),
        record_store=JsonlSourceRecordStore(tmp_path / "records.jsonl"),
        limiters=RateLimiterRegistry(clock=clock),
        clock=clock,
        adapter_provider=lambda sid: ExplodingAdapter(),
        config=WorkerConfig(max_retries=0, backoff_schedule=()),
        crawl_run_id="run-adapter-boom",
    )
    for index, url in enumerate(urls):
        queue.enqueue(Job(source_id=FIXTURE_SOURCE, target_key=f"fixture:{index}", url=url))
    worker.run_until_empty()

    assert worker.stats.escaped_exceptions == 0
    assert worker.stats.processed == 20
    assert worker.stats.success == 0
    # 앞의 10건은 어댑터 예외로 dead_letter, 그 시점에 서킷이 열려 나머지는 요청 없이 스킵된다.
    dead = [job for job in queue.done if job.status is JobStatus.DEAD_LETTER]
    skipped = [job for job in queue.done if job.status is JobStatus.CIRCUIT_OPEN]
    assert len(dead) == 10, f"dead_letter {len(dead)}건"
    assert len(skipped) == 10, f"circuit_open {len(skipped)}건"
    assert all("어댑터 추출 실패" in (job.failure_reason or "") for job in dead)
    assert len(transport.calls) == 10, (
        f"서킷 오픈 후에도 {len(transport.calls)}회 요청했다 — "
        "어댑터 고장으로 사이트를 계속 두드린다"
    )


def test_failure_isolation_circuit_opens_for_one_source_only(tmp_path, fixture_allowlist) -> None:
    """동일 source 연속 10회 실패 → 그 source 만 서킷 오픈. 타 source 처리량은 기준선과 동일."""
    clock = FakeClock(start=0.0)
    healthy_urls = [f"https://slow.fixture.example/venue/{i}" for i in range(20)]
    broken_urls = [f"https://fixture.example/venue/{i}" for i in range(30)]

    # 기준선: 건강한 소스만 돌렸을 때의 성공 건수
    baseline_transport = ScriptedTransport(failing=set())
    baseline_worker, baseline_queue = _build(
        tmp_path / "baseline", fixture_allowlist, FakeClock(start=0.0), baseline_transport
    )
    for index, url in enumerate(healthy_urls):
        baseline_queue.enqueue(Job(source_id=SLOW_SOURCE, target_key=f"slow:{index}", url=url))
    baseline_worker.run_until_empty()
    baseline_success = baseline_worker.stats.per_source_success[SLOW_SOURCE]
    assert baseline_success == 20

    # 본 실행: 고장난 소스와 건강한 소스를 번갈아 넣는다
    transport = ScriptedTransport(failing=set(broken_urls))
    worker, queue = _build(tmp_path / "mixed", fixture_allowlist, clock, transport)
    for index in range(max(len(healthy_urls), len(broken_urls))):
        if index < len(broken_urls):
            queue.enqueue(
                Job(source_id=FIXTURE_SOURCE, target_key=f"fixture:{index}", url=broken_urls[index])
            )
        if index < len(healthy_urls):
            queue.enqueue(
                Job(source_id=SLOW_SOURCE, target_key=f"slow:{index}", url=healthy_urls[index])
            )
    worker.run_until_empty()

    assert worker.stats.escaped_exceptions == 0, "워커 프로세스가 비정상 종료했다"
    open_sources = [
        sid for sid, circuit in worker.circuits.items() if circuit.state is CircuitState.OPEN
    ]
    assert open_sources == [FIXTURE_SOURCE], f"서킷 오픈 소스가 {open_sources} 다 — 1개여야 한다"
    assert worker.circuit_state(SLOW_SOURCE) is CircuitState.CLOSED

    assert worker.stats.per_source_success[SLOW_SOURCE] == baseline_success, (
        "타 source 의 완료 건수가 기준선과 다르다 — 격리가 되지 않았다"
    )
    assert worker.stats.circuit_open_skips > 0, (
        "서킷이 열렸는데 이후 잡이 스킵되지 않았다 — 계속 두드리고 있다"
    )
    # 서킷이 열린 뒤에는 그 소스로 요청이 나가지 않는다
    broken_calls = [c for c in transport.calls if c.startswith("https://fixture.example/")]
    assert len(broken_calls) == 10, (
        f"서킷 오픈 후에도 {len(broken_calls)}회 요청했다 — 10회에서 멈춰야 한다"
    )


def test_failure_isolation_success_resets_consecutive_counter(tmp_path, fixture_allowlist) -> None:
    """성공이 끼면 연속 실패 카운터가 초기화된다 (누적 실패로 서킷이 열리지 않는다)."""
    clock = FakeClock(start=0.0)
    urls = [f"https://fixture.example/venue/{i}" for i in range(30)]
    failing = {url for i, url in enumerate(urls) if i % 2 == 0}
    transport = ScriptedTransport(failing)
    worker, queue = _build(tmp_path, fixture_allowlist, clock, transport)
    for index, url in enumerate(urls):
        queue.enqueue(Job(source_id=FIXTURE_SOURCE, target_key=f"fixture:{index}", url=url))
    worker.run_until_empty()

    assert worker.circuit_state(FIXTURE_SOURCE) is CircuitState.CLOSED
    assert worker.stats.success == 15
    assert worker.stats.dead_letter == 15


def test_failure_isolation_unknown_source_id_does_not_kill_worker(
    tmp_path, fixture_allowlist
) -> None:
    """미등록 source_id 는 잡 하나로 끝난다."""
    clock = FakeClock(start=0.0)
    transport = ScriptedTransport(failing=set())
    worker, queue = _build(tmp_path, fixture_allowlist, clock, transport)
    queue.enqueue(
        Job(source_id="never_reviewed", target_key="x:1", url="https://fixture.example/venue/1")
    )
    queue.enqueue(
        Job(source_id=FIXTURE_SOURCE, target_key="fixture:1", url="https://fixture.example/venue/2")
    )
    worker.run_until_empty()
    assert worker.stats.escaped_exceptions == 0
    assert worker.stats.source_not_allowed == 1
    assert worker.stats.success == 1
