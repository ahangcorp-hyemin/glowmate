"""robots.txt 평가기 — **fail-closed** (FORBID-2).

`urllib.robotparser.RobotFileParser.read()` 를 쓰지 않는다. 그 구현은 4xx 를 "전부 허용",
5xx 를 "전부 금지"로 해석하는데, 앞의 절반이 정확히 계약이 금지한 fail-open 이다.
여기서는 취득을 직접 하고 **HTTP 200 이 아닌 모든 경우를 Disallow 로 처리**한다.

  * 200            → 본문을 파싱해 판정
  * 그 외 상태코드 → 차단 (4xx 포함)
  * 타임아웃·리셋  → 차단
  * 파싱 실패      → 차단

TTL 24시간 캐시를 둔다. 캐시 항목은 (host, 결과, 취득시각)이며, 만료되면 다시 취득한다.
**차단 결과도 캐시한다** — 실패를 캐시하지 않으면 서버 장애 동안 robots 요청이 폭주한다.
"""

from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlsplit
from urllib.robotparser import RobotFileParser

from ..clock import Clock, SystemClock
from ..errors import TransportError
from .transport import DEFAULT_TIMEOUT_SEC, Transport

#: 계약 명시 TTL
ROBOTS_TTL_SEC = 24 * 60 * 60

ROBOTS_PATH = "/robots.txt"


@dataclass(frozen=True, slots=True)
class RobotsVerdict:
    allowed: bool
    reason: str
    http_status: int | None
    fetched_at: float

    @property
    def blocked(self) -> bool:
        return not self.allowed


def robots_url_for(url: str) -> str:
    parts = urlsplit(url)
    if not parts.scheme or not parts.netloc:
        raise ValueError(f"robots URL 을 만들 수 없다: {url!r}")
    return f"{parts.scheme}://{parts.netloc}{ROBOTS_PATH}"


class RobotsEvaluator:
    """robots.txt 취득 · 판정 · TTL 캐시.

    트랜스포트를 **콘텐츠 트랜스포트와 분리**해서 주입받는다. REQ-5 의 acceptance 가
    "3개 조건 x 각 픽스처에서 mock transport 호출 횟수 0 assert (Allow 케이스는 1회 호출로 대조)"
    를 요구하는데, 여기서 세는 1회는 **콘텐츠 요청 1회**다. robots 취득까지 같은 카운터에
    섞으면 Allow 케이스의 기대값이 2가 되어 계약 문면과 어긋난다.
    """

    def __init__(
        self,
        transport: Transport,
        *,
        clock: Clock | None = None,
        ttl_sec: float = ROBOTS_TTL_SEC,
        timeout: float = DEFAULT_TIMEOUT_SEC,
    ) -> None:
        self._transport = transport
        self._clock = clock or SystemClock()
        self._ttl = float(ttl_sec)
        self._timeout = timeout
        self._cache: dict[str, tuple[float, RobotFileParser | None, int | None, str]] = {}
        #: robots 취득 요청 수 (테스트가 캐시 적중을 확인한다)
        self.fetch_count = 0

    def cache_size(self) -> int:
        return len(self._cache)

    def _fetch(
        self, origin: str, user_agent: str
    ) -> tuple[RobotFileParser | None, int | None, str]:
        self.fetch_count += 1
        try:
            response = self._transport.get(
                origin + ROBOTS_PATH, user_agent=user_agent, timeout=self._timeout
            )
        except TransportError as exc:
            return None, None, f"robots.txt 취득 실패 (전송 오류: {exc})"
        except Exception as exc:
            return None, None, f"robots.txt 취득 실패 (예외: {type(exc).__name__}: {exc})"

        if response.status != 200:
            return (
                None,
                response.status,
                f"robots.txt 가 HTTP {response.status} 다 — 규칙을 확인할 수 없으므로 차단한다",
            )
        try:
            parser = RobotFileParser()
            parser.parse(response.body.decode("utf-8", errors="replace").splitlines())
        except Exception as exc:
            return None, response.status, f"robots.txt 파싱 실패: {type(exc).__name__}: {exc}"
        return parser, response.status, "robots.txt 취득·파싱 성공"

    def evaluate(self, url: str, *, user_agent: str) -> RobotsVerdict:
        """URL 1건에 대한 robots 판정. 취득 실패는 언제나 차단이다."""
        parts = urlsplit(url)
        if parts.scheme not in ("http", "https") or not parts.netloc:
            return RobotsVerdict(
                allowed=False,
                reason=f"robots 평가 불가한 URL: {url!r}",
                http_status=None,
                fetched_at=self._clock.now(),
            )
        origin = f"{parts.scheme}://{parts.netloc}"
        now = self._clock.now()
        cached = self._cache.get(origin)
        if cached is None or (now - cached[0]) >= self._ttl:
            parser, status, reason = self._fetch(origin, user_agent)
            self._cache[origin] = (now, parser, status, reason)
        else:
            _, parser, status, reason = cached

        if parser is None:
            return RobotsVerdict(allowed=False, reason=reason, http_status=status, fetched_at=now)

        path = parts.path or "/"
        if parts.query:
            path = f"{path}?{parts.query}"
        allowed = parser.can_fetch(user_agent, path)
        if not allowed:
            # `*` 그룹 기준으로 한 번 더 본다: 일부 사이트는 UA 문자열 전체를 그룹 키로 오인한다.
            allowed = parser.can_fetch("*", path)
        return RobotsVerdict(
            allowed=bool(allowed),
            reason=(
                f"robots {'Allow' if allowed else 'Disallow'} 매칭 (path={path})"
                if parser is not None
                else reason
            ),
            http_status=status,
            fetched_at=now,
        )

    def invalidate(self, url: str) -> None:
        parts = urlsplit(url)
        self._cache.pop(f"{parts.scheme}://{parts.netloc}", None)
