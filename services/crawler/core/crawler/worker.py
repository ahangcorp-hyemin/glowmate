"""워커 — 재시도 · dead_letter · 잡 단위 격리 · 소스별 서킷 브레이커.

한 잡의 처리 순서는 고정이다::

    서킷 확인 → 사전 판정 게이트 → 레이트 리미터 → 요청 → 차단 판정
              → blob 저장(+재조회 검증) → source_record insert → 다운스트림 push

**success 는 마지막 두 단계를 통과한 뒤에만 부여된다** (FORBID-5). blob write 가 실패하거나
재조회 sha256 이 봉투와 다르면 status ∈ {failed, dead_letter} 이고 다운스트림 적재는 0건이다.

── REQ-2 와 FORBID-4 의 우선순위 (중요) ──────────────────────────────────────
REQ-2 는 "네트워크 오류·5xx·**429**" 를 지수 백오프 재시도 대상으로 적고, FORBID-4 는
"http 401·403·429" 에서 status=blocked_access 이고 **아웃바운드 재요청 0회** 를 요구한다.
429 에서 두 조항이 정면으로 부딪힌다.

이 구현은 **FORBID-4 를 우선**한다. 429 는 상대 서버가 "그만"이라고 말한 것이고, 재시도는
간격을 벌리더라도 그 말을 무시하는 행위다. 한 번의 IP 차단이 이후 어떤 소스에서도 가격을
못 모으게 만든다(FORBID-3 because 와 같은 실패 경로). 따라서 429/403/401 은 즉시
blocked_access 로 끝나고 해당 소스의 서킷이 열린다. 지수 백오프는 네트워크 오류·5xx 에만
적용된다. 이 우선순위는 `tests/core/test_blocked_access.py::test_429_is_not_retried_precedence`
가 고정하고 있으므로, 조용히 뒤집을 수 없다.
"""

from __future__ import annotations

import random
from collections.abc import Callable
from dataclasses import dataclass, field

from .allowlist import Allowlist, resolve_concurrency, resolve_max_rps
from .blocking import BlockingDetector
from .clock import Clock, SystemClock
from .contracts.adapter import FetchTarget
from .contracts.schemas import build_envelope
from .errors import BlobIntegrityError, BlobWriteError, TransportError
from .jobqueue import DownstreamQueue, JobQueue
from .models import CircuitState, Job, JobStatus
from .net.preflight import PreflightGate
from .net.ratelimit import RateLimiterRegistry
from .net.transport import Transport
from .storage.blob import BlobStore, sha256_hex
from .storage.record import (
    SourceRecordRow,
    SourceRecordSink,
    new_record_id,
    utc_now_iso,
)

#: REQ-2 — 60s → 300s → 1500s
DEFAULT_BACKOFF_SCHEDULE: tuple[float, ...] = (60.0, 300.0, 1500.0)
DEFAULT_JITTER_RATIO = 0.2
DEFAULT_MAX_RETRIES = 3
#: REQ-7 — 동일 source 연속 실패 임계
DEFAULT_CIRCUIT_THRESHOLD = 10


@dataclass(frozen=True, slots=True)
class WorkerConfig:
    max_retries: int = DEFAULT_MAX_RETRIES
    backoff_schedule: tuple[float, ...] = DEFAULT_BACKOFF_SCHEDULE
    jitter_ratio: float = DEFAULT_JITTER_RATIO
    circuit_threshold: int = DEFAULT_CIRCUIT_THRESHOLD

    def __post_init__(self) -> None:
        if len(self.backoff_schedule) < self.max_retries:
            raise ValueError(
                f"백오프 스케줄({len(self.backoff_schedule)}단계)이 최대 재시도 횟수"
                f"({self.max_retries})보다 짧다"
            )
        if not 0 <= self.jitter_ratio < 1:
            raise ValueError(f"지터 비율이 범위 밖이다: {self.jitter_ratio}")


@dataclass(slots=True)
class SourceCircuit:
    consecutive_failures: int = 0
    state: CircuitState = CircuitState.CLOSED
    opened_at: float | None = None


@dataclass
class WorkerStats:
    processed: int = 0
    success: int = 0
    failed: int = 0
    dead_letter: int = 0
    blocked_access: int = 0
    blocked_robots: int = 0
    source_not_allowed: int = 0
    circuit_open_skips: int = 0
    #: 워커 루프 밖으로 새어 나간 예외 수. 0 이 아니면 격리 실패다 (REQ-7).
    escaped_exceptions: int = 0
    per_source_success: dict[str, int] = field(default_factory=dict)

    def record(self, source_id: str, status: JobStatus) -> None:
        self.processed += 1
        if status is JobStatus.SUCCESS:
            self.success += 1
            self.per_source_success[source_id] = self.per_source_success.get(source_id, 0) + 1
        elif status is JobStatus.FAILED:
            self.failed += 1
        elif status is JobStatus.DEAD_LETTER:
            self.dead_letter += 1
        elif status is JobStatus.BLOCKED_ACCESS:
            self.blocked_access += 1
        elif status is JobStatus.BLOCKED_ROBOTS:
            self.blocked_robots += 1
        elif status is JobStatus.SOURCE_NOT_ALLOWED:
            self.source_not_allowed += 1
        elif status is JobStatus.CIRCUIT_OPEN:
            self.circuit_open_skips += 1


class Worker:
    """단일 스레드 워커. 잡 하나의 실패가 루프를 죽이지 않는다."""

    def __init__(
        self,
        *,
        queue: JobQueue,
        allowlist: Allowlist,
        preflight: PreflightGate,
        transport: Transport,
        blob_store: BlobStore,
        record_store: SourceRecordSink,
        detector: BlockingDetector | None = None,
        limiters: RateLimiterRegistry | None = None,
        clock: Clock | None = None,
        rng: random.Random | None = None,
        downstream: DownstreamQueue | None = None,
        adapter_provider: Callable[[str], object | None] | None = None,
        config: WorkerConfig | None = None,
        crawl_run_id: str = "run-local",
    ) -> None:
        self.queue = queue
        self.allowlist = allowlist
        self.preflight = preflight
        self.transport = transport
        self.blob_store = blob_store
        self.record_store = record_store
        self.detector = detector if detector is not None else BlockingDetector()
        self.clock = clock or SystemClock()
        self.limiters = limiters if limiters is not None else RateLimiterRegistry(clock=self.clock)
        self.rng = rng or random.Random(0)
        self.downstream = downstream if downstream is not None else DownstreamQueue()
        self.adapter_provider = adapter_provider
        self.config = config or WorkerConfig()
        self.crawl_run_id = crawl_run_id
        self.stats = WorkerStats()
        self.circuits: dict[str, SourceCircuit] = {}

    # ── 서킷 ────────────────────────────────────────────────────────────────

    def circuit(self, source_id: str) -> SourceCircuit:
        circuit = self.circuits.get(source_id)
        if circuit is None:
            circuit = SourceCircuit()
            self.circuits[source_id] = circuit
        return circuit

    def circuit_state(self, source_id: str) -> CircuitState:
        return self.circuit(source_id).state

    def _record_failure(self, source_id: str) -> None:
        circuit = self.circuit(source_id)
        circuit.consecutive_failures += 1
        if (
            circuit.consecutive_failures >= self.config.circuit_threshold
            and circuit.state is CircuitState.CLOSED
        ):
            circuit.state = CircuitState.OPEN
            circuit.opened_at = self.clock.now()

    def _record_success(self, source_id: str) -> None:
        circuit = self.circuit(source_id)
        circuit.consecutive_failures = 0

    # ── 백오프 ──────────────────────────────────────────────────────────────

    def backoff_delay(self, attempt_index: int) -> float:
        """`attempt_index` 는 0-base 재시도 회차. ±jitter_ratio 지터를 적용한다."""
        base = self.config.backoff_schedule[attempt_index]
        ratio = self.config.jitter_ratio
        return base * (1.0 + self.rng.uniform(-ratio, ratio))

    # ── 처리 ────────────────────────────────────────────────────────────────

    def process(self, job: Job) -> JobStatus:
        """잡 1건 처리. **어떤 예외도 밖으로 내보내지 않는다** (REQ-7)."""
        job.retry_scheduled = False
        try:
            status = self._process_inner(job)
        except BaseException as exc:
            if isinstance(exc, (KeyboardInterrupt, SystemExit)):
                raise
            self.stats.escaped_exceptions += 1
            job.failure_reason = f"격리되지 않은 예외: {type(exc).__name__}: {exc}"
            status = self._fail_or_dead_letter(job)

        if status is JobStatus.FAILED and job.retry_scheduled:
            # 재시도 예약 — 큐에서 빼지 않고 다시 넣는다. `complete()` 를 부르면 중복 인덱스에서
            # 키가 빠져 같은 대상의 새 잡이 들어올 수 있게 되므로 부르지 않는다 (REQ-1).
            job.retry_scheduled = False
            self.queue.requeue(job)
        else:
            self.queue.complete(job, status)
        self.stats.record(job.source_id, status)
        return status

    def _terminal(self, job: Job, status: JobStatus, reason: str) -> JobStatus:
        job.failure_reason = reason
        return status

    def _fail_or_dead_letter(self, job: Job) -> JobStatus:
        """재시도 가능한 실패의 후처리. 한도를 넘으면 dead_letter.

        큐 재적재는 하지 않는다 — :meth:`process` 가 `retry_scheduled` 를 보고 결정한다.
        여기서 requeue 하면 그 직후 `complete()` 가 상태를 덮어써 재시도가 조용히 사라진다.
        """
        self._record_failure(job.source_id)
        if job.attempts > self.config.max_retries:
            return JobStatus.DEAD_LETTER
        delay = self.backoff_delay(job.attempts - 1)
        job.next_attempt_at = self.clock.now() + delay
        job.attempt_times.append(job.next_attempt_at)
        job.retry_scheduled = True
        return JobStatus.FAILED

    def _process_inner(self, job: Job) -> JobStatus:
        job.attempts += 1

        circuit = self.circuit(job.source_id)
        if circuit.state is CircuitState.OPEN:
            return self._terminal(
                job,
                JobStatus.CIRCUIT_OPEN,
                f"{job.source_id} 서킷 오픈 "
                f"(연속 실패 {circuit.consecutive_failures}회) — 요청하지 않는다",
            )

        result = self.preflight.check(job.source_id, job.url)
        if not result.decision.allowed:
            assert result.decision.status is not None
            # 사전 판정 거부는 **재시도 대상이 아니다.** 서킷 카운터도 올리지 않는다 —
            # 정책 거부를 소스 장애로 집계하면 정상 소스가 장애로 보인다.
            return self._terminal(job, result.decision.status, result.decision.reason)

        policy = result.policy
        assert policy is not None
        limiter = self.limiters.for_source(
            job.source_id,
            max_rps=resolve_max_rps(policy),
            per_host_concurrency=resolve_concurrency(policy),
        )

        try:
            with limiter.acquire(job.url, job.source_id):
                response = self.transport.get(
                    job.url, user_agent=policy.user_agent
                )
        except TransportError as exc:
            job.failure_reason = f"전송 실패: {exc}"
            return self._fail_or_dead_letter(job)

        decision = self.detector.evaluate(
            source_id=job.source_id,
            http_status=response.status,
            body=response.body,
            allowlist_min_body_bytes=policy.min_body_bytes,
        )
        if decision.blocked:
            # FORBID-4 — 재요청 없이 끝낸다. 서킷은 연다 (같은 소스로 계속 두드리지 않기 위해).
            self._record_failure(job.source_id)
            return self._terminal(
                job, JobStatus.BLOCKED_ACCESS, f"{decision.rule}: {decision.detail}"
            )

        if response.status >= 500:
            job.failure_reason = f"HTTP {response.status}"
            return self._fail_or_dead_letter(job)
        if response.status >= 400:
            # 404 등: 재시도해도 달라지지 않는다.
            # 서킷 카운터는 올린다(대량 404 는 사이트 개편 신호).
            self._record_failure(job.source_id)
            return self._terminal(job, JobStatus.FAILED, f"HTTP {response.status}")

        return self._store(job, policy, response)

    def _store(self, job: Job, policy, response) -> JobStatus:
        body_sha = sha256_hex(response.body)
        blob_key = BlobStore.make_key(job.source_id, self.crawl_run_id, body_sha)

        try:
            stored_sha = self.blob_store.put(blob_key, response.body)
        except (BlobWriteError, BlobIntegrityError) as exc:
            job.failure_reason = f"원문 저장 실패: {exc}"
            return self._fail_or_dead_letter(job)

        if stored_sha != body_sha:
            job.failure_reason = (
                f"blob sha256 불일치: 봉투={body_sha} 저장소={stored_sha}"
            )
            return self._fail_or_dead_letter(job)

        adapter_version = "core-only"
        extracted = None
        adapter = self.adapter_provider(job.source_id) if self.adapter_provider else None
        if adapter is not None:
            adapter_version = getattr(adapter, "version", adapter_version)
            try:
                record = adapter.extract(
                    FetchTarget(url=job.url, target_key=job.target_key), response.body
                )
                extracted = record.to_dict()
            except Exception as exc:
                job.failure_reason = f"어댑터 추출 실패: {type(exc).__name__}: {exc}"
                return self._fail_or_dead_letter(job)

        fetched_at = utc_now_iso()
        envelope = build_envelope(
            blob_key=blob_key,
            body_sha256=body_sha,
            http_status=response.status,
            final_url=response.final_url,
            headers=response.headers,
            crawl_run_id=self.crawl_run_id,
            adapter_version=adapter_version,
            source_id=job.source_id,
            requested_url=job.url,
            body_bytes=len(response.body),
            fetched_at=fetched_at,
            extracted=extracted,
        )
        row = SourceRecordRow(
            id=new_record_id(),
            source_url=job.url,
            raw_payload=envelope,
            fetched_at=fetched_at,
            # D3 verdict 전사값. allowlist 가 D3 원천과 맞는지는 allowlist-guard 가 대조한다.
            source_license_status=policy.verdict,
        )
        self.record_store.insert(row)
        self.downstream.push(
            {
                "source_record_id": row.id,
                "source_id": job.source_id,
                "target_key": job.target_key,
                "blob_key": blob_key,
                "body_sha256": body_sha,
            }
        )
        self._record_success(job.source_id)
        return JobStatus.SUCCESS

    # ── 루프 ────────────────────────────────────────────────────────────────

    def run_until_empty(self, max_iterations: int = 100_000) -> WorkerStats:
        iterations = 0
        while iterations < max_iterations:
            job = self.queue.dequeue()
            if job is None:
                break
            iterations += 1
            wait = job.next_attempt_at - self.clock.now()
            if wait > 0:
                self.clock.sleep(wait)
            self.process(job)
        else:
            raise RuntimeError(
                f"워커 루프가 {max_iterations} 회를 넘겼다 — 무한 재시도 가능성이 있어 중단한다"
            )
        return self.stats
