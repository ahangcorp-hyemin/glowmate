"""시계 추상화.

레이트 리미터·재시도 백오프를 **실제 대기 없이** 결정론적으로 검증하기 위한 최소 인터페이스다.
프로덕션은 :class:`SystemClock`, 테스트는 :class:`FakeClock` 을 주입한다.

주의: FakeClock 은 `sleep` 을 가상 시간 전진으로 처리한다. 프로덕션 경로에서 FakeClock 을
쓰면 rate limit 이 실제로는 지켜지지 않으므로, 아웃바운드 경로(`crawler.runner`)는
SystemClock 을 기본값으로 고정한다.
"""

from __future__ import annotations

import time
from typing import Protocol, runtime_checkable


@runtime_checkable
class Clock(Protocol):
    """단조 시계."""

    def now(self) -> float:
        """단조 증가하는 현재 시각(초)."""
        ...

    def sleep(self, seconds: float) -> None:
        """`seconds` 만큼 대기한다."""
        ...


class SystemClock:
    """실제 시계. 아웃바운드 경로의 기본값."""

    def now(self) -> float:
        return time.monotonic()

    def sleep(self, seconds: float) -> None:
        if seconds > 0:
            time.sleep(seconds)


class FakeClock:
    """가상 시계. `sleep` 은 즉시 반환하고 내부 시각만 전진시킨다."""

    def __init__(self, start: float = 0.0) -> None:
        self._t = float(start)
        #: 호출된 sleep 구간 기록 (테스트가 대기 시퀀스를 검증한다)
        self.sleeps: list[float] = []

    def now(self) -> float:
        return self._t

    def sleep(self, seconds: float) -> None:
        if seconds < 0:
            raise ValueError(f"음수 대기는 시계 오류다: {seconds}")
        self.sleeps.append(seconds)
        self._t += seconds

    def advance(self, seconds: float) -> None:
        if seconds < 0:
            raise ValueError(f"시계를 되돌릴 수 없다: {seconds}")
        self._t += seconds
