"""스케줄러 — 소스별 cron 정의를 읽어 job 을 enqueue 한다 (REQ-1).

cron 표현식은 `분 시 일 월 요일` 5필드이며, `*` · 숫자 · `*/n` · 콤마 목록을 지원한다.
전체 cron 문법을 구현하지 않는 이유: 소스별 수집 주기는 "매일 04:10", "6시간마다" 수준이고,
파서를 넓히면 그만큼 오해석 위험이 커진다. 지원하지 않는 표현은 **예외로 올린다** —
조용히 "매분 실행"으로 해석하면 rate limit 이 아니라 스케줄이 사이트를 때린다.

approved=false 소스는 스케줄에 실릴 수 없다. 실으려 하면 `ConfigError` 다.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from .allowlist import Allowlist
from .contracts.adapter import FetchTarget
from .errors import ConfigError
from .jobqueue import JobQueue
from .models import Job

CRON_FIELDS = ("minute", "hour", "day", "month", "weekday")
CRON_RANGES = {
    "minute": (0, 59),
    "hour": (0, 23),
    "day": (1, 31),
    "month": (1, 12),
    "weekday": (0, 6),
}


def _parse_field(name: str, token: str) -> set[int]:
    low, high = CRON_RANGES[name]
    values: set[int] = set()
    for part in token.split(","):
        part = part.strip()
        if part == "*":
            values |= set(range(low, high + 1))
        elif part.startswith("*/"):
            step = part[2:]
            if not step.isdigit() or int(step) < 1:
                raise ConfigError(f"cron {name} 필드의 step 이 잘못됐다: {part!r}")
            values |= set(range(low, high + 1, int(step)))
        elif part.isdigit():
            value = int(part)
            if not low <= value <= high:
                raise ConfigError(f"cron {name} 값이 범위 밖이다: {value} ({low}~{high})")
            values.add(value)
        else:
            raise ConfigError(
                f"지원하지 않는 cron 표현: {name}={part!r} — "
                "해석할 수 없는 표현을 '매번 실행'으로 넘기지 않는다"
            )
    return values


@dataclass(frozen=True, slots=True)
class CronSpec:
    raw: str
    fields: dict[str, frozenset[int]]

    @staticmethod
    def parse(expr: str) -> CronSpec:
        tokens = expr.split()
        if len(tokens) != len(CRON_FIELDS):
            raise ConfigError(
                f"cron 표현식은 5필드여야 한다 (분 시 일 월 요일): {expr!r} ({len(tokens)}필드)"
            )
        return CronSpec(
            raw=expr,
            fields={
                name: frozenset(_parse_field(name, token))
                for name, token in zip(CRON_FIELDS, tokens, strict=True)
            },
        )

    def matches(self, when: datetime) -> bool:
        return (
            when.minute in self.fields["minute"]
            and when.hour in self.fields["hour"]
            and when.day in self.fields["day"]
            and when.month in self.fields["month"]
            and (when.weekday() + 1) % 7 in self.fields["weekday"]
        )


@dataclass(frozen=True, slots=True)
class ScheduleEntry:
    source_id: str
    cron: CronSpec
    enabled: bool = True


@dataclass(frozen=True, slots=True)
class TickResult:
    fired_sources: tuple[str, ...]
    enqueued: int
    rejected_duplicates: int


class Scheduler:
    """cron → enqueue.

    대상 목록은 어댑터의 `seed_targets()` 에서 온다. 스케줄러는 URL 을 만들지 않는다 —
    만들기 시작하면 D3 글롭 밖 URL 이 코어에서 생겨난다.
    """

    def __init__(
        self,
        queue: JobQueue,
        allowlist: Allowlist,
        entries: list[ScheduleEntry],
        target_provider,
    ) -> None:
        self.queue = queue
        self.allowlist = allowlist
        self.target_provider = target_provider
        self.entries: list[ScheduleEntry] = []
        for entry in entries:
            policy = allowlist.get(entry.source_id)
            if policy is None:
                raise ConfigError(f"스케줄 대상 {entry.source_id} 가 allowlist 에 없다")
            if not policy.approved:
                raise ConfigError(
                    f"스케줄 대상 {entry.source_id} 가 approved=false 다 "
                    f"(verdict={policy.verdict}) — 승인되지 않은 소스는 스케줄에 실리지 않는다"
                )
            self.entries.append(entry)

    def enqueue_targets(
        self, source_id: str, targets: list[FetchTarget], crawl_run_id: str = ""
    ) -> int:
        enqueued = 0
        for target in targets:
            job = Job(
                source_id=source_id,
                target_key=target.target_key,
                url=target.url,
                crawl_run_id=crawl_run_id,
            )
            if self.queue.enqueue(job):
                enqueued += 1
        return enqueued

    def tick(self, when: datetime, crawl_run_id: str = "") -> TickResult:
        """`when` 시각에 발화하는 소스를 찾아 enqueue 한다."""
        before = self.queue.duplicate_rejections
        fired: list[str] = []
        total = 0
        for entry in self.entries:
            if not entry.enabled or not entry.cron.matches(when):
                continue
            fired.append(entry.source_id)
            total += self.enqueue_targets(
                entry.source_id, self.target_provider(entry.source_id), crawl_run_id
            )
        return TickResult(
            fired_sources=tuple(fired),
            enqueued=total,
            rejected_duplicates=self.queue.duplicate_rejections - before,
        )
