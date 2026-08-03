"""잡·요청로그·판정 결과의 값 객체.

F2a 가 소유하는 DB 스키마(`core.source_record`)를 재정의하지 않는다. 여기 있는 것은
큐·워커·리미터가 프로세스 안에서 주고받는 형태이며, DB 로 나가는 것은
`crawler.storage.record.SourceRecordRow` 4필드(+tombstone 2필드)뿐이다.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum


class JobStatus(StrEnum):
    """잡 상태.

    `success` 는 **원문이 blob 에 저장되고 sha256 이 일치한 뒤에만** 부여된다 (FORBID-5).
    """

    QUEUED = "queued"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"
    DEAD_LETTER = "dead_letter"
    SOURCE_NOT_ALLOWED = "source_not_allowed"
    BLOCKED_ROBOTS = "blocked_robots"
    BLOCKED_ACCESS = "blocked_access"
    CIRCUIT_OPEN = "circuit_open"


#: 큐에서 "미완료"로 간주되는 상태. 중복 enqueue 판정 기준 (REQ-1).
PENDING_STATUSES = frozenset({JobStatus.QUEUED, JobStatus.RUNNING})

#: 재시도 대상이 아닌 종료 상태 (사전 판정 게이트·차단 판정).
TERMINAL_NON_RETRY_STATUSES = frozenset(
    {
        JobStatus.SOURCE_NOT_ALLOWED,
        JobStatus.BLOCKED_ROBOTS,
        JobStatus.BLOCKED_ACCESS,
        JobStatus.CIRCUIT_OPEN,
    }
)


class CircuitState(StrEnum):
    CLOSED = "closed"
    OPEN = "open"


@dataclass(slots=True)
class Job:
    """크롤 잡 1건.

    `target_key` 는 소스 안에서 대상 1건을 식별하는 키다 (URL 또는 어댑터가 정한 ID).
    중복 판정은 `(source_id, target_key)` 로 한다 — URL 쿼리 순서만 바뀐 중복을
    같은 것으로 볼지는 어댑터가 `target_key` 로 결정한다.
    """

    source_id: str
    target_key: str
    url: str
    status: JobStatus = JobStatus.QUEUED
    attempts: int = 0
    enqueued_at: float = 0.0
    next_attempt_at: float = 0.0
    crawl_run_id: str = ""
    failure_reason: str | None = None
    #: 재시도 시각 시퀀스 (REQ-2 검증 대상)
    attempt_times: list[float] = field(default_factory=list)
    #: 이번 실패에 재시도가 예약됐는가. 워커가 큐 재적재 여부를 결정할 때만 쓴다.
    retry_scheduled: bool = False

    @property
    def dedup_key(self) -> tuple[str, str]:
        return (self.source_id, self.target_key)


@dataclass(frozen=True, slots=True)
class RequestLogEntry:
    """아웃바운드 요청 1건의 기록 (REQ-4).

    `in_flight` 는 **이 요청을 포함한** 동시 진행 요청 수다.
    """

    host: str
    source_id: str
    ts_ms: int
    in_flight: int


@dataclass(frozen=True, slots=True)
class HttpResponse:
    """트랜스포트가 돌려주는 최소 응답."""

    status: int
    body: bytes
    headers: dict[str, str]
    final_url: str


@dataclass(frozen=True, slots=True)
class PreflightDecision:
    """사전 판정 게이트 결과."""

    allowed: bool
    status: JobStatus | None
    reason: str

    @staticmethod
    def ok(reason: str = "allowlist+robots 통과") -> PreflightDecision:
        return PreflightDecision(allowed=True, status=None, reason=reason)

    @staticmethod
    def deny(status: JobStatus, reason: str) -> PreflightDecision:
        return PreflightDecision(allowed=False, status=status, reason=reason)
