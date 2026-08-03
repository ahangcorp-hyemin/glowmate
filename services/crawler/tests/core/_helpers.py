"""C1 코어 테스트 공용 상수·헬퍼.

`conftest.py` 가 아니라 별도 모듈에 두는 이유: `services/crawler/tests/conftest.py`(F1 소유)와
이름이 겹쳐 `import conftest` 가 어느 쪽을 가리키는지 모호해지고, 상대 임포트를 쓰려면
테스트 디렉터리를 패키지로 만들어야 하는데 그 패키지 이름(`core`)이 소스 루트 `core/` 와
충돌한다. pytest 가 `tests/core` 를 sys.path 에 얹으므로 `from _helpers import ...` 가 성립한다.

**네트워크에 나가지 않는다.** 실제 아웃바운드는 `crawler.smoke` 만 하며, 그 결과는
`artifacts/smoke.json` 과 CI job `crawler-smoke-verify` 로 판정한다.
"""

from __future__ import annotations

from pathlib import Path

from crawler.clock import FakeClock
from crawler.models import HttpResponse
from crawler.net.robots import RobotsEvaluator
from crawler.net.transport import RecordingTransport

CORE_FIXTURES = Path(__file__).resolve().parents[1] / "fixtures" / "core"
REPO_ROOT = Path(__file__).resolve().parents[4]

TEST_ALLOWLIST = CORE_FIXTURES / "test_allowlist.yaml"
ROBOTS_DIR = CORE_FIXTURES / "robots"
BODIES_DIR = CORE_FIXTURES / "bodies"
BLOCKED_DIR = CORE_FIXTURES / "blocked"
REFERENCE_ADAPTER = CORE_FIXTURES / "reference_adapter" / "adapter.py"
SAMPLE_VENUE = CORE_FIXTURES / "adapter_sample_venue.html"

FIXTURE_SOURCE = "fixture_source"
SLOW_SOURCE = "slow_source"
DENIED_SOURCE = "denied_source"
FIXTURE_HOST = "fixture.example"
FIXTURE_ORIGIN = f"https://{FIXTURE_HOST}"
FIXTURE_ROBOTS_URL = f"{FIXTURE_ORIGIN}/robots.txt"


def robots_text(name: str) -> str:
    return (ROBOTS_DIR / f"{name}.txt").read_text(encoding="utf-8")


def body_files() -> list[Path]:
    return sorted(BODIES_DIR.glob("body_*.html"))


def html_response(body: bytes, url: str, status: int = 200) -> HttpResponse:
    return HttpResponse(
        status=status,
        body=body,
        headers={"content-type": "text/html; charset=utf-8"},
        final_url=url,
    )


def make_robots(
    transport_body: str,
    clock: FakeClock | None = None,
    origin: str = FIXTURE_ORIGIN,
) -> tuple[RobotsEvaluator, RecordingTransport]:
    """robots 전용 트랜스포트를 가진 평가기.

    콘텐츠 트랜스포트와 분리한다 — REQ-5 의 "mock transport 호출 0/1" 판정은
    **콘텐츠 요청** 수를 세는 것이기 때문이다.
    """
    url = f"{origin}/robots.txt"
    transport = RecordingTransport(
        responses={url: html_response(transport_body.encode("utf-8"), url)}
    )
    return RobotsEvaluator(transport, clock=clock), transport
