"""REQ-1 — 스케줄러 중복 enqueue 차단.

`pytest services/crawler/tests/core/test_scheduler.py -k dedup`
"""

from __future__ import annotations

from datetime import datetime

import pytest

from _helpers import DENIED_SOURCE, FIXTURE_SOURCE
from crawler.contracts import FetchTarget
from crawler.errors import ConfigError
from crawler.jobqueue import JobQueue
from crawler.models import Job, JobStatus
from crawler.scheduler import CronSpec, ScheduleEntry, Scheduler

TARGETS = [
    FetchTarget(url=f"https://fixture.example/venue/{i}", target_key=f"fixture:{i}")
    for i in range(1, 6)
]


def _scheduler(allowlist, cron: str = "*/10 * * * *") -> tuple[Scheduler, JobQueue]:
    queue = JobQueue()
    scheduler = Scheduler(
        queue=queue,
        allowlist=allowlist,
        entries=[ScheduleEntry(source_id=FIXTURE_SOURCE, cron=CronSpec.parse(cron))],
        target_provider=lambda sid: TARGETS,
    )
    return scheduler, queue


def test_dedup_1000_repeated_ticks_leaves_no_duplicates(fixture_allowlist) -> None:
    """1000회 반복 enqueue 후 큐 내 (source_id, target_key) 중복 0건."""
    scheduler, queue = _scheduler(fixture_allowlist)
    when = datetime(2026, 8, 3, 4, 10)

    for _ in range(1000):
        scheduler.tick(when, crawl_run_id="run-dedup")

    assert queue.duplicate_count() == 0, "큐 안에 동일 (source_id, target_key) 잡이 2건 이상 있다"
    assert len(queue) == len(TARGETS), (
        f"미완료 잡 수가 대상 수와 다르다: {len(queue)} != {len(TARGETS)}"
    )
    assert queue.duplicate_rejections == 999 * len(TARGETS), (
        "중복으로 거부된 횟수가 기대와 다르다 — 거부가 조용히 사라졌을 수 있다"
    )


def test_dedup_direct_enqueue_1000_times(fixture_allowlist) -> None:
    """스케줄러를 거치지 않는 직접 enqueue 에서도 중복 0건."""
    queue = JobQueue()
    accepted = 0
    for _ in range(1000):
        job = Job(
            source_id=FIXTURE_SOURCE,
            target_key="fixture:1",
            url="https://fixture.example/venue/1",
        )
        if queue.enqueue(job):
            accepted += 1
    assert accepted == 1, f"동일 키가 {accepted}회 적재됐다"
    assert queue.duplicate_count() == 0
    assert len(queue) == 1


def test_dedup_allows_requeue_after_completion(fixture_allowlist) -> None:
    """완료된 잡과 같은 키는 다시 적재된다 — 그게 재수집이다 (dedup 이 재수집을 막으면 안 된다)."""
    scheduler, queue = _scheduler(fixture_allowlist)
    when = datetime(2026, 8, 3, 4, 10)
    scheduler.tick(when)
    assert len(queue) == len(TARGETS)

    while (job := queue.dequeue()) is not None:
        queue.complete(job, JobStatus.SUCCESS)
    assert len(queue) == 0

    result = scheduler.tick(when)
    assert result.enqueued == len(TARGETS), "완료 후 재적재가 막혔다 — 재수집이 불가능해진다"
    assert queue.duplicate_count() == 0


def test_dedup_running_job_is_not_re_enqueued(fixture_allowlist) -> None:
    """running 상태의 잡도 미완료다 — 그 사이 들어온 동일 키는 거부된다."""
    scheduler, queue = _scheduler(fixture_allowlist)
    scheduler.tick(datetime(2026, 8, 3, 4, 10))
    job = queue.dequeue()
    assert job is not None
    assert job.status is JobStatus.RUNNING

    assert scheduler.enqueue_targets(FIXTURE_SOURCE, TARGETS) == 0
    assert queue.duplicate_count() == 0


def test_scheduler_rejects_unapproved_source(fixture_allowlist) -> None:
    with pytest.raises(ConfigError, match="approved=false"):
        Scheduler(
            queue=JobQueue(),
            allowlist=fixture_allowlist,
            entries=[ScheduleEntry(source_id=DENIED_SOURCE, cron=CronSpec.parse("0 4 * * *"))],
            target_provider=lambda sid: [],
        )


def test_cron_rejects_unsupported_expression() -> None:
    """해석할 수 없는 표현을 '매번 실행'으로 넘기지 않는다."""
    with pytest.raises(ConfigError, match="지원하지 않는 cron 표현"):
        CronSpec.parse("0-30 * * * *")
    with pytest.raises(ConfigError, match="5필드"):
        CronSpec.parse("0 4 * *")


def test_cron_matches_expected_times() -> None:
    spec = CronSpec.parse("10 4 * * *")
    assert spec.matches(datetime(2026, 8, 3, 4, 10))
    assert not spec.matches(datetime(2026, 8, 3, 4, 11))
    assert not spec.matches(datetime(2026, 8, 3, 5, 10))
