"""FORBID-4 — 차단 응답 처리.

`pytest -k test_blocked_access`

마커 픽스처 · 401/403/429 · 빈 본문(200) 각 케이스에서 status=blocked_access 이고
아웃바운드 **재요청 0회** 임을 확인한다.
"""

from __future__ import annotations

import random

import pytest

from _helpers import (
    BLOCKED_DIR,
    FIXTURE_ORIGIN,
    FIXTURE_ROBOTS_URL,
    FIXTURE_SOURCE,
    html_response,
    robots_text,
)
from crawler.blocking import BLOCKED_HTTP_STATUSES, BlockingDetector, load_markers
from crawler.clock import FakeClock
from crawler.errors import ConfigError
from crawler.jobqueue import JobQueue
from crawler.models import Job, JobStatus
from crawler.net.preflight import PreflightGate
from crawler.net.ratelimit import RateLimiterRegistry
from crawler.net.robots import RobotsEvaluator
from crawler.net.transport import RecordingTransport
from crawler.storage.blob import BlobStore
from crawler.storage.record import JsonlSourceRecordStore
from crawler.worker import Worker

URL = f"{FIXTURE_ORIGIN}/venue/1"

MARKER_FIXTURES = [
    "login_gate.html",
    "captcha.html",
    "cloudflare.html",
    "access_denied.html",
]


def _run(fixture_allowlist, tmp_path, response_or_exc):
    clock = FakeClock(start=0.0)
    robots = RobotsEvaluator(
        RecordingTransport(
            responses={
                FIXTURE_ROBOTS_URL: html_response(
                    robots_text("allow_all").encode("utf-8"), FIXTURE_ROBOTS_URL
                )
            }
        ),
        clock=clock,
    )
    content = RecordingTransport(responses={URL: response_or_exc})
    queue = JobQueue()
    worker = Worker(
        queue=queue,
        allowlist=fixture_allowlist,
        preflight=PreflightGate(fixture_allowlist, robots),
        transport=content,
        blob_store=BlobStore(tmp_path / "blobs"),
        record_store=JsonlSourceRecordStore(tmp_path / "records.jsonl"),
        limiters=RateLimiterRegistry(clock=clock),
        clock=clock,
        rng=random.Random(5),
        crawl_run_id="run-blocked",
    )
    job = Job(source_id=FIXTURE_SOURCE, target_key="fixture:1", url=URL)
    queue.enqueue(job)
    worker.run_until_empty()
    return job, content, worker


@pytest.mark.parametrize("fixture_name", MARKER_FIXTURES)
def test_blocked_access_marker_fixtures(tmp_path, fixture_allowlist, fixture_name: str) -> None:
    body = (BLOCKED_DIR / fixture_name).read_bytes()
    job, content, worker = _run(fixture_allowlist, tmp_path, html_response(body, URL))
    assert job.status is JobStatus.BLOCKED_ACCESS, f"{fixture_name}: status={job.status}"
    assert content.call_count == 1, (
        f"{fixture_name}: 요청 {content.call_count}회 — 차단 후 재요청이 나갔다"
    )
    assert worker.stats.blocked_access == 1
    assert job.failure_reason is not None and "marker:" in job.failure_reason


@pytest.mark.parametrize("status", sorted(BLOCKED_HTTP_STATUSES))
def test_blocked_access_http_statuses(tmp_path, fixture_allowlist, status: int) -> None:
    body = (BLOCKED_DIR / "login_gate.html").read_bytes()
    job, content, _worker = _run(
        fixture_allowlist, tmp_path, html_response(body, URL, status=status)
    )
    assert job.status is JobStatus.BLOCKED_ACCESS
    assert content.call_count == 1, f"HTTP {status}: 재요청 {content.call_count - 1}회"
    assert job.failure_reason is not None and f"http-{status}" in job.failure_reason


def test_blocked_access_empty_body_with_200(tmp_path, fixture_allowlist) -> None:
    """(c) 200 인데 본문이 하한 미만 — 정상 응답으로 간주하지 않는다."""
    body = (BLOCKED_DIR / "empty_shell.html").read_bytes()
    job, content, worker = _run(fixture_allowlist, tmp_path, html_response(body, URL))
    assert job.status is JobStatus.BLOCKED_ACCESS
    assert content.call_count == 1
    assert job.failure_reason is not None and "min-body-bytes" in job.failure_reason
    assert worker.stats.success == 0


def test_blocked_access_zero_length_body(tmp_path, fixture_allowlist) -> None:
    job, content, _ = _run(fixture_allowlist, tmp_path, html_response(b"", URL))
    assert job.status is JobStatus.BLOCKED_ACCESS
    assert content.call_count == 1


def test_429_is_not_retried_precedence(tmp_path, fixture_allowlist) -> None:
    """★ REQ-2 와 FORBID-4 의 우선순위 고정.

    REQ-2 는 429 를 재시도 대상으로 적고 FORBID-4 는 429 에서 재요청 0회를 요구한다.
    구현은 FORBID-4 를 우선한다 — 429 는 상대 서버가 '그만'이라고 말한 것이고, 간격을
    벌린 재시도도 그 말을 무시하는 행위다. 이 테스트를 고치는 것이 우선순위를 뒤집는
    유일한 경로가 되도록 여기에 못박아 둔다.
    """
    body = (BLOCKED_DIR / "login_gate.html").read_bytes()
    job, content, worker = _run(fixture_allowlist, tmp_path, html_response(body, URL, status=429))
    assert job.status is JobStatus.BLOCKED_ACCESS
    assert job.attempts == 1, f"429 에서 {job.attempts}회 시도했다 — 재시도 없이 끝나야 한다"
    assert content.call_count == 1
    assert worker.stats.dead_letter == 0

    assert worker.circuit(FIXTURE_SOURCE).consecutive_failures == 1


def test_blocked_access_does_not_write_source_record(tmp_path, fixture_allowlist) -> None:
    """차단 응답은 원문 레코드를 만들지 않는다 — 만들면 '수집 성공'으로 집계된다."""
    body = (BLOCKED_DIR / "captcha.html").read_bytes()
    _run(fixture_allowlist, tmp_path, html_response(body, URL))
    store = JsonlSourceRecordStore(tmp_path / "records.jsonl")
    assert store.count() == 0


def test_normal_body_is_not_flagged(tmp_path, fixture_allowlist) -> None:
    """오탐 방지 — 정상 본문은 차단으로 잡히지 않는다."""
    body = b"<html><body>" + ("정상 업체 상세 본문. " * 200).encode("utf-8") + b"</body></html>"
    job, _content, worker = _run(fixture_allowlist, tmp_path, html_response(body, URL))
    assert job.status is JobStatus.SUCCESS
    assert worker.stats.blocked_access == 0


def test_markers_inherit_default_set() -> None:
    """소스별 항목이 있어도 `_default` 마커가 사라지지 않는다."""
    detector = BlockingDetector()
    default_ids = {m.id for m in detector.marker_set_for("_default").markers}
    official_ids = {m.id for m in detector.marker_set_for("official_website").markers}
    assert default_ids <= official_ids, (
        f"official_website 에서 기본 마커가 사라졌다: {sorted(default_ids - official_ids)}"
    )
    assert "ow-empty-shell" in official_ids


def test_markers_min_body_bytes_is_max_of_two_sources() -> None:
    detector = BlockingDetector()
    assert detector.min_body_bytes("official_website", allowlist_min=1) == 8192
    assert detector.min_body_bytes("official_website", allowlist_min=99999) == 99999


MARKER = "[{id: a, kind: substring, pattern: x, evidence: y}]"

FAIL_CLOSED_CASES = [
    ("version", f"_default:\n  min_body_bytes: 10\n  markers: {MARKER}\n"),
    ("_default", f"version: '1'\nofficial_website:\n  min_body_bytes: 10\n  markers: {MARKER}\n"),
    ("min_body_bytes", f"version: '1'\n_default:\n  min_body_bytes: 0\n  markers: {MARKER}\n"),
    ("markers 가 비었다", "version: '1'\n_default:\n  min_body_bytes: 10\n  markers: []\n"),
    (
        "필수 키",
        "version: '1'\n_default:\n  min_body_bytes: 10\n"
        "  markers: [{id: a, kind: substring, pattern: x}]\n",
    ),
    ("매핑으로 읽지 못했다", "- 1\n- 2\n"),
]


@pytest.mark.parametrize(
    ("expected", "text"), FAIL_CLOSED_CASES, ids=[c[0] for c in FAIL_CLOSED_CASES]
)
def test_markers_load_is_fail_closed(expected: str, text: str) -> None:
    """마커 사전 결손을 '차단 없음'으로 처리하지 않는다."""
    with pytest.raises(ConfigError, match=expected):
        load_markers(text)
