"""C1 코어 테스트 픽스처. 상수·헬퍼는 `_helpers.py` 에 있다."""

from __future__ import annotations

import pytest

from _helpers import REPO_ROOT, TEST_ALLOWLIST, make_robots, robots_text
from crawler.allowlist import Allowlist, load_allowlist
from crawler.blocking import BlockingDetector
from crawler.clock import FakeClock
from crawler.net.preflight import PreflightGate
from crawler.net.ratelimit import RateLimiterRegistry
from crawler.net.transport import RecordingTransport


@pytest.fixture
def fixture_allowlist() -> Allowlist:
    return load_allowlist(TEST_ALLOWLIST, root=REPO_ROOT)


@pytest.fixture
def real_allowlist() -> Allowlist:
    """리포 정본 allowlist. D3 전사 대조 테스트가 쓴다."""
    return load_allowlist(root=REPO_ROOT)


@pytest.fixture
def fake_clock() -> FakeClock:
    return FakeClock(start=1_000.0)


@pytest.fixture
def allow_gate(fixture_allowlist: Allowlist, fake_clock: FakeClock):
    """robots 가 Allow 인 사전 판정 게이트 + 콘텐츠 트랜스포트."""
    robots, _ = make_robots(robots_text("allow_all"), fake_clock)
    return PreflightGate(fixture_allowlist, robots), RecordingTransport()


@pytest.fixture
def detector() -> BlockingDetector:
    return BlockingDetector()


@pytest.fixture
def limiters(fake_clock: FakeClock) -> RateLimiterRegistry:
    return RateLimiterRegistry(clock=fake_clock)
