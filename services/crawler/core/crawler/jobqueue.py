"""잡 큐 — 중복 enqueue 차단 (REQ-1) · dead_letter 보관.

중복 판정 키는 `(source_id, target_key)` 이며, **미완료 상태(queued|running)의 동일 키가
있으면 새 잡을 만들지 않는다.** 완료된 잡과 같은 키는 다시 넣을 수 있다 — 그게 재수집이다.

`enqueue()` 는 적재 여부를 반환한다. 반환값을 무시해도 중복이 생기지 않으므로, 호출부가
"이미 있나?"를 먼저 물어보는 경합 창을 만들 필요가 없다.
"""

from __future__ import annotations

import threading
from collections import deque
from dataclasses import dataclass, field

from .models import PENDING_STATUSES, Job, JobStatus


@dataclass
class JobQueue:
    """스레드 안전 FIFO 큐 + 중복 인덱스."""

    _pending: deque[Job] = field(default_factory=deque)
    _by_key: dict[tuple[str, str], Job] = field(default_factory=dict)
    _done: list[Job] = field(default_factory=list)
    _lock: threading.RLock = field(default_factory=threading.RLock)
    #: 중복이라서 버려진 enqueue 시도 수 (REQ-1 의 관측치)
    duplicate_rejections: int = 0

    def enqueue(self, job: Job) -> bool:
        """적재. 미완료 동일 키가 있으면 False 를 돌려주고 아무것도 하지 않는다."""
        with self._lock:
            existing = self._by_key.get(job.dedup_key)
            if existing is not None and existing.status in PENDING_STATUSES:
                self.duplicate_rejections += 1
                return False
            job.status = JobStatus.QUEUED
            self._by_key[job.dedup_key] = job
            self._pending.append(job)
            return True

    def dequeue(self) -> Job | None:
        with self._lock:
            while self._pending:
                job = self._pending.popleft()
                if job.status is JobStatus.QUEUED:
                    job.status = JobStatus.RUNNING
                    return job
            return None

    def complete(self, job: Job, status: JobStatus) -> None:
        with self._lock:
            job.status = status
            if status not in PENDING_STATUSES:
                self._done.append(job)
                if self._by_key.get(job.dedup_key) is job:
                    del self._by_key[job.dedup_key]

    def requeue(self, job: Job) -> None:
        """재시도 적재. 같은 잡 객체를 다시 큐에 넣는다 (새 잡을 만들지 않는다)."""
        with self._lock:
            job.status = JobStatus.QUEUED
            self._by_key[job.dedup_key] = job
            self._pending.append(job)

    # ── 관측 ────────────────────────────────────────────────────────────────

    @property
    def pending(self) -> list[Job]:
        with self._lock:
            return [j for j in self._pending if j.status in PENDING_STATUSES]

    @property
    def done(self) -> list[Job]:
        with self._lock:
            return list(self._done)

    def by_status(self, status: JobStatus) -> list[Job]:
        with self._lock:
            return [j for j in [*self._pending, *self._done] if j.status is status]

    @property
    def dead_letter(self) -> list[Job]:
        return self.by_status(JobStatus.DEAD_LETTER)

    def duplicate_count(self) -> int:
        """큐 안에 존재하는 (source_id, target_key) 중복 건수. 정상 상태에서 0 이다."""
        with self._lock:
            keys = [j.dedup_key for j in self._pending if j.status in PENDING_STATUSES]
        return len(keys) - len(set(keys))

    def __len__(self) -> int:
        return len(self.pending)


@dataclass
class DownstreamQueue:
    """후속 파이프라인(C4·C5)로 넘기는 큐.

    FORBID-5 의 "후속 파이프라인 큐에 결과를 전달" 금지를 검사할 대상이다.
    원문 저장이 확인된 잡만 여기 들어온다.
    """

    items: list[dict] = field(default_factory=list)

    def push(self, payload: dict) -> None:
        self.items.append(payload)

    def __len__(self) -> int:
        return len(self.items)
