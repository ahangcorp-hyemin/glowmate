"""REQ-5 · FORBID-1 (a) · FORBID-2 — 사전 판정 게이트.

`pytest -k test_preflight_gate`

세는 것은 **콘텐츠 트랜스포트 호출 수**다. robots 취득은 별도 트랜스포트로 나가며,
그래서 Allow 케이스의 기대값이 계약 문면대로 정확히 1이 된다.
"""

from __future__ import annotations

import random

import pytest

from _helpers import (
    DENIED_SOURCE,
    FIXTURE_ORIGIN,
    FIXTURE_ROBOTS_URL,
    FIXTURE_SOURCE,
    html_response,
    robots_text,
)
from crawler.clock import FakeClock
from crawler.errors import TransportError
from crawler.jobqueue import JobQueue
from crawler.models import HttpResponse, Job, JobStatus
from crawler.net.preflight import PreflightGate
from crawler.net.ratelimit import RateLimiterRegistry
from crawler.net.robots import ROBOTS_TTL_SEC, RobotsEvaluator
from crawler.net.transport import RecordingTransport
from crawler.storage.blob import BlobStore
from crawler.storage.record import JsonlSourceRecordStore
from crawler.worker import Worker

ALLOWED_URL = f"{FIXTURE_ORIGIN}/venue/1"
BODY = b"<html><body>" + ("업체 상세. " * 200).encode("utf-8") + b"</body></html>"


def _robots_transport(outcome) -> RecordingTransport:
    return RecordingTransport(responses={FIXTURE_ROBOTS_URL: outcome})


def _run(fixture_allowlist, robots_outcome, jobs, *, clock=None):
    """게이트 + 워커를 돌리고 (콘텐츠 트랜스포트, 잡 목록) 을 돌려준다."""
    clock = clock or FakeClock(start=0.0)
    robots = RobotsEvaluator(_robots_transport(robots_outcome), clock=clock)
    gate = PreflightGate(fixture_allowlist, robots)
    content = RecordingTransport(
        responses={job.url: html_response(BODY, job.url) for job in jobs}
    )
    queue = JobQueue()
    import tempfile

    tmp = tempfile.mkdtemp()
    worker = Worker(
        queue=queue,
        allowlist=fixture_allowlist,
        preflight=gate,
        transport=content,
        blob_store=BlobStore(f"{tmp}/blobs"),
        record_store=JsonlSourceRecordStore(f"{tmp}/records.jsonl"),
        limiters=RateLimiterRegistry(clock=clock),
        clock=clock,
        rng=random.Random(3),
        crawl_run_id="run-preflight",
    )
    for job in jobs:
        queue.enqueue(job)
    worker.run_until_empty()
    return content, jobs, worker


ALLOW_ROBOTS = html_response(robots_text("allow_all").encode("utf-8"), FIXTURE_ROBOTS_URL)


# ── 대조군: Allow 케이스는 콘텐츠 요청 1회 ────────────────────────────────────


def test_preflight_gate_allow_case_makes_exactly_one_request(fixture_allowlist) -> None:
    job = Job(source_id=FIXTURE_SOURCE, target_key="fixture:1", url=ALLOWED_URL)
    content, _, _ = _run(fixture_allowlist, ALLOW_ROBOTS, [job])
    assert content.call_count == 1, f"Allow 케이스의 콘텐츠 요청이 {content.call_count}회다"
    assert job.status is JobStatus.SUCCESS


# ── (a) allowlist 미등재 / approved=false ────────────────────────────────────


def test_preflight_gate_unlisted_hosts_make_zero_requests(fixture_allowlist) -> None:
    """FORBID-1 (a) — 미등재 host 20건 입력 시 큐 적재 0건 · 요청 0건."""
    queue = JobQueue()
    urls = [f"https://not-allowlisted-{i}.example/venue/{i}" for i in range(20)]
    jobs = [
        Job(source_id=FIXTURE_SOURCE, target_key=f"outside:{i}", url=url)
        for i, url in enumerate(urls)
    ]
    clock = FakeClock(start=0.0)
    robots = RobotsEvaluator(_robots_transport(ALLOW_ROBOTS), clock=clock)
    gate = PreflightGate(fixture_allowlist, robots)

    # (1) 게이트 판정만으로 20건 전부 거부되는가
    for job in jobs:
        result = gate.check(job.source_id, job.url)
        assert not result.decision.allowed
        assert result.decision.status is JobStatus.SOURCE_NOT_ALLOWED

    # (2) 스케줄러 경로에서 큐에 실리더라도 요청은 0건인가
    content, _, worker = _run(fixture_allowlist, ALLOW_ROBOTS, jobs)
    assert content.call_count == 0, f"미등재 host 로 {content.call_count}회 요청이 나갔다"
    assert worker.stats.source_not_allowed == 20
    assert all(job.status is JobStatus.SOURCE_NOT_ALLOWED for job in jobs)
    assert len(queue) == 0


def test_preflight_gate_unapproved_source_makes_zero_requests(fixture_allowlist) -> None:
    """approved=false 소스는 요청 0건."""
    job = Job(source_id=DENIED_SOURCE, target_key="denied:1", url=ALLOWED_URL)
    content, _, _ = _run(fixture_allowlist, ALLOW_ROBOTS, [job])
    assert content.call_count == 0
    assert job.status is JobStatus.SOURCE_NOT_ALLOWED


def test_preflight_gate_unknown_source_makes_zero_requests(fixture_allowlist) -> None:
    job = Job(source_id="never_reviewed", target_key="x:1", url=ALLOWED_URL)
    content, _, _ = _run(fixture_allowlist, ALLOW_ROBOTS, [job])
    assert content.call_count == 0
    assert job.status is JobStatus.SOURCE_NOT_ALLOWED


def test_preflight_gate_url_outside_path_globs_makes_zero_requests(fixture_allowlist) -> None:
    """host 는 등재됐지만 D3 실증 글롭 밖인 URL 은 통과하지 못한다."""
    job = Job(
        source_id=FIXTURE_SOURCE,
        target_key="outside-glob",
        url=f"{FIXTURE_ORIGIN}/admin/secret",
    )
    content, _, _ = _run(fixture_allowlist, ALLOW_ROBOTS, [job])
    assert content.call_count == 0
    assert job.status is JobStatus.SOURCE_NOT_ALLOWED
    assert job.failure_reason is not None
    assert "allowed_path_globs" in job.failure_reason


# ── (b) robots Disallow ──────────────────────────────────────────────────────


@pytest.mark.parametrize("robots_name", ["disallow_all", "disallow_branch", "searchbot_only"])
def test_preflight_gate_robots_disallow_makes_zero_requests(
    fixture_allowlist, robots_name: str
) -> None:
    body = robots_text(robots_name)
    if robots_name == "disallow_branch":
        url = f"{FIXTURE_ORIGIN}/venue/1"
        body = "User-agent: *\nDisallow: /venue/\nAllow: /\n"
    else:
        url = ALLOWED_URL
    job = Job(source_id=FIXTURE_SOURCE, target_key="fixture:1", url=url)
    content, _, _ = _run(
        fixture_allowlist, html_response(body.encode("utf-8"), FIXTURE_ROBOTS_URL), [job]
    )
    assert content.call_count == 0, f"{robots_name}: 콘텐츠 요청이 {content.call_count}회 나갔다"
    assert job.status is JobStatus.BLOCKED_ROBOTS


# ── (c) robots 취득 실패 = fail-closed (FORBID-2) ─────────────────────────────


@pytest.mark.parametrize(
    ("label", "outcome"),
    [
        ("503", html_response(b"maintenance", FIXTURE_ROBOTS_URL, status=503)),
        ("404", html_response(b"not found", FIXTURE_ROBOTS_URL, status=404)),
        ("timeout", TransportError("타임아웃: robots.txt")),
        ("connection-reset", TransportError("연결 실패: connection reset by peer")),
    ],
)
def test_preflight_gate_robots_fetch_failure_is_fail_closed(
    fixture_allowlist, label: str, outcome
) -> None:
    """FORBID-2 — robots 취득 실패를 '제한 없음'으로 간주하지 않는다."""
    job = Job(source_id=FIXTURE_SOURCE, target_key="fixture:1", url=ALLOWED_URL)
    content, _, _ = _run(fixture_allowlist, outcome, [job])
    assert content.call_count == 0, f"{label}: fail-open 으로 {content.call_count}회 요청이 나갔다"
    assert job.status is JobStatus.BLOCKED_ROBOTS
    assert job.failure_reason is not None


def test_robots_evaluator_never_fails_open_on_unexpected_exception(fixture_allowlist) -> None:
    """트랜스포트가 예상 밖 예외를 던져도 Allow 로 넘어가지 않는다."""

    class ExplodingTransport:
        calls = 0

        def get(self, url, *, user_agent, timeout=20.0):
            type(self).calls += 1
            raise RuntimeError("예상하지 못한 예외")

    clock = FakeClock(start=0.0)
    robots = RobotsEvaluator(ExplodingTransport(), clock=clock)
    verdict = robots.evaluate(ALLOWED_URL, user_agent="glowmate-crawler/0.1")
    assert verdict.blocked
    assert "예외" in verdict.reason


# ── robots TTL 캐시 ──────────────────────────────────────────────────────────


def test_robots_cache_ttl_24h(fixture_allowlist) -> None:
    clock = FakeClock(start=0.0)
    transport = _robots_transport(ALLOW_ROBOTS)
    robots = RobotsEvaluator(transport, clock=clock)

    for _ in range(5):
        assert robots.evaluate(ALLOWED_URL, user_agent="glowmate-crawler/0.1").allowed
    assert robots.fetch_count == 1, f"캐시가 동작하지 않는다 (취득 {robots.fetch_count}회)"

    clock.advance(ROBOTS_TTL_SEC - 1)
    robots.evaluate(ALLOWED_URL, user_agent="glowmate-crawler/0.1")
    assert robots.fetch_count == 1, "TTL 이내인데 재취득했다"

    clock.advance(2)
    robots.evaluate(ALLOWED_URL, user_agent="glowmate-crawler/0.1")
    assert robots.fetch_count == 2, "TTL 만료 후 재취득하지 않았다"


def test_robots_failure_is_cached_not_retried_in_a_storm(fixture_allowlist) -> None:
    """실패도 캐시한다 — 실패를 캐시하지 않으면 서버 장애 동안 robots 요청이 폭주한다."""
    clock = FakeClock(start=0.0)
    transport = _robots_transport(html_response(b"", FIXTURE_ROBOTS_URL, status=503))
    robots = RobotsEvaluator(transport, clock=clock)
    for _ in range(50):
        assert robots.evaluate(ALLOWED_URL, user_agent="glowmate-crawler/0.1").blocked
    assert robots.fetch_count == 1, f"실패 캐시가 없어 {robots.fetch_count}회 재취득했다"


def test_robots_evaluator_uses_query_string_in_path() -> None:
    """쿼리스트링을 포함한 경로로 판정한다 (branch_view.php?idx= 형태 대응)."""
    clock = FakeClock(start=0.0)
    body = "User-agent: *\nDisallow: /venue/1?secret=1\nAllow: /\n"
    transport = _robots_transport(html_response(body.encode("utf-8"), FIXTURE_ROBOTS_URL))
    robots = RobotsEvaluator(transport, clock=clock)
    blocked = robots.evaluate(
        f"{FIXTURE_ORIGIN}/venue/1?secret=1", user_agent="glowmate-crawler/0.1"
    )
    allowed = robots.evaluate(f"{FIXTURE_ORIGIN}/venue/2", user_agent="glowmate-crawler/0.1")
    assert blocked.blocked
    assert allowed.allowed


def test_recording_transport_rejects_unregistered_url() -> None:
    """검증 도구 자신이 조용히 성공하지 않는다."""
    transport = RecordingTransport()
    with pytest.raises(TransportError, match="등록되지 않았다"):
        transport.get("https://fixture.example/venue/1", user_agent="ua")


def test_http_response_dataclass_is_frozen() -> None:
    response = HttpResponse(status=200, body=b"x", headers={}, final_url="https://x/")
    with pytest.raises((AttributeError, TypeError)):
        response.status = 500  # type: ignore[misc]
