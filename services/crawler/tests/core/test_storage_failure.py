"""FORBID-5 — 원문 저장 실패는 success 가 될 수 없다.

`pytest -k test_storage_failure_not_success`
"""

from __future__ import annotations

import random

import pytest

from _helpers import (
    FIXTURE_ORIGIN,
    FIXTURE_ROBOTS_URL,
    FIXTURE_SOURCE,
    html_response,
    robots_text,
)
from crawler.clock import FakeClock
from crawler.errors import BlobIntegrityError, BlobWriteError
from crawler.jobqueue import DownstreamQueue, JobQueue
from crawler.models import Job, JobStatus
from crawler.net.preflight import PreflightGate
from crawler.net.ratelimit import RateLimiterRegistry
from crawler.net.robots import RobotsEvaluator
from crawler.net.transport import RecordingTransport
from crawler.storage.blob import BlobStore, CorruptingBlobStore, FailingBlobStore, sha256_hex
from crawler.storage.record import JsonlSourceRecordStore
from crawler.worker import Worker, WorkerConfig

URL = f"{FIXTURE_ORIGIN}/venue/1"
BODY = b"<html><body>" + ("업체 상세. " * 300).encode("utf-8") + b"</body></html>"


def _run(tmp_path, fixture_allowlist, blob_store):
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
    downstream = DownstreamQueue()
    record_store = JsonlSourceRecordStore(tmp_path / "records.jsonl")
    queue = JobQueue()
    worker = Worker(
        queue=queue,
        allowlist=fixture_allowlist,
        preflight=PreflightGate(fixture_allowlist, robots),
        transport=RecordingTransport(responses={URL: html_response(BODY, URL)}),
        blob_store=blob_store,
        record_store=record_store,
        limiters=RateLimiterRegistry(clock=clock),
        clock=clock,
        rng=random.Random(11),
        downstream=downstream,
        config=WorkerConfig(max_retries=1, backoff_schedule=(60.0,)),
        crawl_run_id="run-storage",
    )
    job = Job(source_id=FIXTURE_SOURCE, target_key="fixture:1", url=URL)
    queue.enqueue(job)
    worker.run_until_empty()
    return job, downstream, record_store, worker


def test_storage_failure_not_success_write_error(tmp_path, fixture_allowlist) -> None:
    """시나리오 1 — blob write 예외."""
    job, downstream, record_store, worker = _run(
        tmp_path, fixture_allowlist, FailingBlobStore(tmp_path / "blobs")
    )
    assert job.status in {JobStatus.FAILED, JobStatus.DEAD_LETTER}, f"status={job.status}"
    assert job.status is JobStatus.DEAD_LETTER
    assert worker.stats.success == 0
    assert len(downstream) == 0, "원문 저장이 실패했는데 다운스트림에 결과가 전달됐다"
    assert record_store.count() == 0, "원문 없이 source_record 행이 생겼다"


def test_storage_failure_not_success_hash_mismatch(tmp_path, fixture_allowlist) -> None:
    """시나리오 2 — 저장 후 재조회 sha256 불일치."""
    job, downstream, record_store, worker = _run(
        tmp_path, fixture_allowlist, CorruptingBlobStore(tmp_path / "blobs")
    )
    assert job.status in {JobStatus.FAILED, JobStatus.DEAD_LETTER}
    assert job.status is JobStatus.DEAD_LETTER
    assert worker.stats.success == 0
    assert len(downstream) == 0
    assert record_store.count() == 0
    assert job.failure_reason is not None and "원문 저장 실패" in job.failure_reason


def test_storage_success_pushes_downstream(tmp_path, fixture_allowlist) -> None:
    """짝이 되는 정상 동작 — 저장이 검증되면 다운스트림에 전달된다."""
    job, downstream, record_store, worker = _run(
        tmp_path, fixture_allowlist, BlobStore(tmp_path / "blobs")
    )
    assert job.status is JobStatus.SUCCESS
    assert worker.stats.success == 1
    assert len(downstream) == 1
    assert record_store.count() == 1
    payload = downstream.items[0]
    assert payload["body_sha256"] == sha256_hex(BODY)


def test_blob_store_put_verifies_readback(tmp_path) -> None:
    store = BlobStore(tmp_path / "blobs")
    digest = store.put("s/r/key", BODY)
    assert digest == sha256_hex(BODY)
    assert store.get("s/r/key") == BODY


def test_failing_blob_store_raises(tmp_path) -> None:
    with pytest.raises(BlobWriteError):
        FailingBlobStore(tmp_path / "blobs").put("s/r/key", BODY)


def test_corrupting_blob_store_raises_integrity_error(tmp_path) -> None:
    with pytest.raises(BlobIntegrityError):
        CorruptingBlobStore(tmp_path / "blobs").put("s/r/key", BODY)


def test_blob_store_rejects_path_traversal(tmp_path) -> None:
    store = BlobStore(tmp_path / "blobs")
    for bad in ("/abs/key", "a/../../escape", ""):
        with pytest.raises(ValueError):
            store.put(bad, BODY)
