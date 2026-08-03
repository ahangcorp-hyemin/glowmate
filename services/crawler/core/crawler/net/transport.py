"""트랜스포트 — 아웃바운드 HTTP 의 유일한 출구.

표준 라이브러리 `urllib.request` 만 쓴다. 세션·쿠키자·리다이렉트 커스터마이즈·프록시
로테이션·UA 무작위화 어느 것도 넣지 않는다 (FORBID-4). User-Agent 는 allowlist 에 기재된
**고정 문자열 1개**이며 연락처를 포함한다 — 상대 서버가 우리를 식별하고 연락할 수 있어야
한다는 것이 D3 실사의 전제다.

쿠키를 처리하지 않는 것은 누락이 아니라 설계다. `urllib` 의 기본 opener 는 쿠키를 저장하지
않으므로 세션 상태가 요청 사이에 흐르지 않는다.
"""

from __future__ import annotations

import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Protocol, runtime_checkable

from ..errors import TransportError
from ..models import HttpResponse

#: 응답 본문 상한. 이보다 큰 응답은 잘라서 저장하지 않고 실패로 올린다 —
#: 잘린 원문은 sha256 이 원본과 다르므로 "원문 보존"이 거짓이 된다.
MAX_BODY_BYTES = 16 * 1024 * 1024

DEFAULT_TIMEOUT_SEC = 20.0


@runtime_checkable
class Transport(Protocol):
    """HTTP GET 1건."""

    def get(
        self, url: str, *, user_agent: str, timeout: float = DEFAULT_TIMEOUT_SEC
    ) -> HttpResponse:
        ...


class UrllibTransport:
    """stdlib 기반 트랜스포트."""

    def __init__(self, max_body_bytes: int = MAX_BODY_BYTES) -> None:
        self.max_body_bytes = max_body_bytes

    def get(
        self, url: str, *, user_agent: str, timeout: float = DEFAULT_TIMEOUT_SEC
    ) -> HttpResponse:
        if not user_agent:
            raise TransportError(
                "user_agent 가 비었다 — 식별 불가능한 요청은 "
                "D3 실사의 전제(연락 가능한 크롤러)를 깬다"
            )
        request = urllib.request.Request(
            url,
            headers={
                "User-Agent": user_agent,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "ko,en;q=0.8",
            },
            method="GET",
        )
        if request.type not in ("http", "https"):
            raise TransportError(f"허용되지 않는 스킴: {request.type} ({url})")
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                body = response.read(self.max_body_bytes + 1)
                if len(body) > self.max_body_bytes:
                    raise TransportError(
                        f"응답 본문이 상한({self.max_body_bytes} 바이트)을 넘었다: {url} — "
                        "잘라 저장하면 sha256 이 원본과 달라져 '원문 보존'이 거짓이 된다"
                    )
                return HttpResponse(
                    status=int(response.status),
                    body=body,
                    headers={k.lower(): v for k, v in response.headers.items()},
                    final_url=response.geturl(),
                )
        except urllib.error.HTTPError as exc:
            # 4xx·5xx 도 응답이다. 본문을 읽어 차단 판정기에 넘긴다.
            body = exc.read() if exc.fp is not None else b""
            return HttpResponse(
                status=int(exc.code),
                body=body,
                headers={k.lower(): v for k, v in (exc.headers or {}).items()},
                final_url=exc.url or url,
            )
        except urllib.error.URLError as exc:
            raise TransportError(f"연결 실패: {url} ({exc.reason})") from exc
        except TimeoutError as exc:
            raise TransportError(f"타임아웃: {url}") from exc
        except OSError as exc:
            raise TransportError(f"네트워크 오류: {url} ({exc})") from exc


@dataclass
class RecordingTransport:
    """테스트용 트랜스포트. 호출 횟수와 URL 을 기록한다.

    프로덕션 코드가 아니라 코어가 소유하는 검증 도구다 — REQ-5 · FORBID-1 (a) · FORBID-2 의
    "mock transport 호출 횟수 0 assert" 가 이 기록을 근거로 판정한다.
    """

    responses: dict[str, HttpResponse | Exception] = field(default_factory=dict)
    default: HttpResponse | Exception | None = None
    calls: list[str] = field(default_factory=list)

    @property
    def call_count(self) -> int:
        return len(self.calls)

    def get(
        self, url: str, *, user_agent: str, timeout: float = DEFAULT_TIMEOUT_SEC
    ) -> HttpResponse:
        del user_agent, timeout
        self.calls.append(url)
        outcome = self.responses.get(url, self.default)
        if outcome is None:
            raise TransportError(
                f"RecordingTransport 에 {url} 에 대한 응답이 등록되지 않았다 — "
                "미등록 URL 을 조용히 성공시키지 않는다"
            )
        if isinstance(outcome, Exception):
            raise outcome
        return outcome
