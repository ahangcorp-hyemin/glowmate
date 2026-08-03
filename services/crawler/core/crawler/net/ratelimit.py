"""per-host 레이트 리미터 · 동시성 리미터 · request_log (REQ-4 / FORBID-3).

두 가지를 동시에 강제한다.

  * **요청 간 최소 간격** — 같은 host 로 나가는 연속 요청은 `1/max_rps` 초 이상 벌어진다.
    D3 `crawl_policy.yaml` 의 `60/max_requests_per_min` 과 같은 값이다.
  * **동시 in-flight 상한** — host 당 `per_host_concurrency` 를 넘지 않는다.

재시도·백필·수동 트리거는 리미터를 우회하는 사유가 아니다. 우회 경로를 두지 않기 위해
리미터는 `acquire()` 없이는 요청을 만들 수 없는 컨텍스트 매니저로만 노출된다.

`request_log` 는 (host, source_id, ts_ms, in_flight) 4필드다. 롤백 절차에서도 보존한다 —
대상 사이트에 대한 요청 이력 증빙이기 때문이다.
"""

from __future__ import annotations

import threading
from contextlib import contextmanager
from dataclasses import dataclass, field
from itertools import pairwise
from urllib.parse import urlsplit

from ..clock import Clock, SystemClock
from ..errors import PolicyViolationError
from ..models import RequestLogEntry


def host_of(url: str) -> str:
    host = (urlsplit(url).hostname or "").lower()
    if not host:
        raise ValueError(f"host 를 뽑을 수 없는 URL: {url!r}")
    return host


@dataclass(slots=True)
class _HostState:
    last_start: float = float("-inf")
    in_flight: int = 0


@dataclass
class RequestLog:
    """아웃바운드 요청 기록."""

    entries: list[RequestLogEntry] = field(default_factory=list)

    def append(self, entry: RequestLogEntry) -> None:
        self.entries.append(entry)

    def __len__(self) -> int:
        return len(self.entries)

    def for_host(self, host: str) -> list[RequestLogEntry]:
        return [e for e in self.entries if e.host == host]

    def window_violations(self, host: str, max_rps: float, window_ms: int = 1000) -> list[dict]:
        """1초 슬라이딩 윈도우 위반 목록.

        허용 상한은 `max(1, floor(max_rps * window))` 다. max_rps < 1 인 정책(우리 정책은
        0.1)에서 상한을 0 으로 두면 어떤 요청도 위반이 되어 검사가 무의미해지므로,
        "한 건은 언제나 허용하되 그 이상은 rate 로 제한한다"는 형태를 쓴다.
        간격 자체의 하한은 :meth:`interval_violations` 가 따로 본다.
        """
        limit = max(1, int(max_rps * window_ms / 1000))
        stamps = sorted(e.ts_ms for e in self.for_host(host))
        out: list[dict] = []
        left = 0
        for right, ts in enumerate(stamps):
            while stamps[left] <= ts - window_ms:
                left += 1
            count = right - left + 1
            if count > limit:
                out.append({"host": host, "window_end_ms": ts, "count": count, "limit": limit})
        return out

    def interval_violations(self, host: str, min_interval_sec: float) -> list[dict]:
        """연속 요청 간격이 최소 간격 미만인 쌍."""
        stamps = sorted(e.ts_ms for e in self.for_host(host))
        floor_ms = min_interval_sec * 1000
        out: list[dict] = []
        for prev, cur in pairwise(stamps):
            gap = cur - prev
            if gap + 1e-9 < floor_ms:
                out.append({"host": host, "gap_ms": gap, "floor_ms": floor_ms})
        return out

    def concurrency_violations(self, host: str, limit: int) -> list[dict]:
        return [
            {"host": host, "ts_ms": e.ts_ms, "in_flight": e.in_flight, "limit": limit}
            for e in self.for_host(host)
            if e.in_flight > limit
        ]

    def intervals_sec(self, host: str) -> list[float]:
        stamps = sorted(e.ts_ms for e in self.for_host(host))
        return [(b - a) / 1000.0 for a, b in pairwise(stamps)]

    def hosts(self) -> list[str]:
        return sorted({e.host for e in self.entries})


class RateLimiter:
    """per-host 최소 간격 + 동시성 리미터."""

    def __init__(
        self,
        *,
        max_rps: float,
        per_host_concurrency: int,
        clock: Clock | None = None,
        request_log: RequestLog | None = None,
    ) -> None:
        if max_rps <= 0:
            raise PolicyViolationError(f"max_rps 는 0 보다 커야 한다: {max_rps}")
        if per_host_concurrency < 1:
            raise PolicyViolationError(
                f"per_host_concurrency 는 1 이상이어야 한다: {per_host_concurrency}"
            )
        self.max_rps = float(max_rps)
        self.per_host_concurrency = int(per_host_concurrency)
        self.min_interval = 1.0 / self.max_rps
        self._clock = clock or SystemClock()
        self.request_log = request_log if request_log is not None else RequestLog()
        self._states: dict[str, _HostState] = {}
        self._lock = threading.Lock()
        self._cv = threading.Condition(self._lock)

    def _state(self, host: str) -> _HostState:
        state = self._states.get(host)
        if state is None:
            state = _HostState()
            self._states[host] = state
        return state

    @contextmanager
    def acquire(self, url: str, source_id: str):
        """요청 1건의 슬롯을 잡는다. 간격·동시성 상한을 모두 만족할 때까지 대기한다."""
        host = host_of(url)
        with self._cv:
            while True:
                state = self._state(host)
                if state.in_flight >= self.per_host_concurrency:
                    # 동시성 포화. 단일 스레드 실행에서는 발생하지 않으며, 멀티스레드에서만
                    # 대기가 필요하다. 대기 없이 요청을 내보내는 경로는 존재하지 않는다.
                    self._cv.wait(timeout=self.min_interval)
                    continue
                now = self._clock.now()
                wait = state.last_start + self.min_interval - now
                if wait > 0:
                    self._clock.sleep(wait)
                    continue
                state.last_start = self._clock.now()
                state.in_flight += 1
                entry = RequestLogEntry(
                    host=host,
                    source_id=source_id,
                    ts_ms=round(state.last_start * 1000),
                    in_flight=state.in_flight,
                )
                self.request_log.append(entry)
                break
        try:
            yield entry
        finally:
            with self._cv:
                self._state(host).in_flight -= 1
                self._cv.notify_all()


class RateLimiterRegistry:
    """소스별 리미터 보관소. 소스마다 정책이 다르므로 리미터도 소스마다 하나다."""

    def __init__(self, clock: Clock | None = None, request_log: RequestLog | None = None) -> None:
        self._clock = clock or SystemClock()
        self.request_log = request_log if request_log is not None else RequestLog()
        self._limiters: dict[str, RateLimiter] = {}

    def for_source(
        self, source_id: str, *, max_rps: float, per_host_concurrency: int
    ) -> RateLimiter:
        limiter = self._limiters.get(source_id)
        if limiter is None:
            limiter = RateLimiter(
                max_rps=max_rps,
                per_host_concurrency=per_host_concurrency,
                clock=self._clock,
                request_log=self.request_log,
            )
            self._limiters[source_id] = limiter
        return limiter
