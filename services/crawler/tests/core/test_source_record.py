"""REQ-3 — source_record 라운드트립 · 봉투 스키마 · source_license_status.

`pytest -k test_source_record_roundtrip`
`pytest -k test_license_status`
"""

from __future__ import annotations

import pytest

from _helpers import REPO_ROOT, body_files
from crawler.contracts import build_envelope, envelope_errors, validate_envelope
from crawler.contracts.schemas import ENVELOPE_SCHEMA
from crawler.d3 import load_verdicts
from crawler.errors import ConfigError
from crawler.storage.blob import BlobStore, sha256_hex
from crawler.storage.record import (
    JsonlSourceRecordStore,
    SourceRecordRow,
    new_record_id,
    utc_now_iso,
)

ENVELOPE_REQUIRED = (
    "blob_key",
    "body_sha256",
    "http_status",
    "final_url",
    "headers",
    "crawl_run_id",
    "adapter_version",
    "source_id",
)


def test_envelope_schema_requires_contract_fields() -> None:
    """계약이 열거한 8필드가 스키마의 required 집합과 정확히 같다."""
    assert set(ENVELOPE_SCHEMA["required"]) == set(ENVELOPE_REQUIRED)


def test_source_record_roundtrip_50_fixtures(tmp_path) -> None:
    """픽스처 50건 저장→복원 라운드트립: sha256 일치율 100% · jsonschema 위반 0건."""
    files = body_files()
    assert len(files) == 50, f"라운드트립 픽스처가 {len(files)}건이다 — 50건이어야 한다"

    blob_store = BlobStore(tmp_path / "blobs")
    record_store = JsonlSourceRecordStore(tmp_path / "source_record.jsonl")
    crawl_run_id = "run-roundtrip"

    matches = 0
    violations: list[str] = []
    for index, path in enumerate(files, start=1):
        body = path.read_bytes()
        digest = sha256_hex(body)
        url = f"https://fixture.example/venue/{index}"
        blob_key = BlobStore.make_key("fixture_source", crawl_run_id, digest)
        blob_store.put(blob_key, body)

        envelope = build_envelope(
            blob_key=blob_key,
            body_sha256=digest,
            http_status=200,
            final_url=url,
            headers={"Content-Type": "text/html"},
            crawl_run_id=crawl_run_id,
            adapter_version="core-only",
            source_id="fixture_source",
            requested_url=url,
            body_bytes=len(body),
            fetched_at=utc_now_iso(),
        )
        violations.extend(envelope_errors(envelope))
        record_store.insert(
            SourceRecordRow(
                id=new_record_id(),
                source_url=url,
                raw_payload=envelope,
                fetched_at=envelope["fetched_at"],
                source_license_status="conditional",
            )
        )

    assert violations == [], f"봉투 jsonschema 위반 {len(violations)}건: {violations[:5]}"

    rows = record_store.all()
    assert len(rows) == 50, f"복원된 행이 {len(rows)}건이다"
    for row in rows:
        payload = row.raw_payload
        assert payload is not None
        restored = blob_store.get(str(payload["blob_key"]))
        if sha256_hex(restored) == payload["body_sha256"]:
            matches += 1
    assert matches == 50, f"sha256 일치 {matches}/50 — 일치율 100% 여야 한다"


def test_envelope_rejects_missing_required_field() -> None:
    """필수 필드가 빠지면 통과하지 않는다 (검사가 공허하지 않다는 증명)."""
    base = {
        "blob_key": "s/r/" + "a" * 64,
        "body_sha256": "a" * 64,
        "http_status": 200,
        "final_url": "https://fixture.example/venue/1",
        "headers": {},
        "crawl_run_id": "run",
        "adapter_version": "v1",
        "source_id": "fixture_source",
    }
    validate_envelope(base)
    for field in ENVELOPE_REQUIRED:
        broken = {k: v for k, v in base.items() if k != field}
        assert envelope_errors(broken), f"{field} 가 빠졌는데 스키마가 통과시켰다"


def test_envelope_rejects_unknown_field() -> None:
    base = {
        "blob_key": "s/r/" + "a" * 64,
        "body_sha256": "a" * 64,
        "http_status": 200,
        "final_url": "https://fixture.example/venue/1",
        "headers": {},
        "crawl_run_id": "run",
        "adapter_version": "v1",
        "source_id": "fixture_source",
        "body": "<html>원문을 봉투에 직접 담는 경로</html>",
    }
    assert envelope_errors(base), "봉투에 임의 필드를 담는 것이 허용됐다"


def test_license_status_matches_d3_verdicts(real_allowlist) -> None:
    """source_license_status 값이 D3 verdicts.csv 의 verdict 와 일치하고 NULL 0건."""
    verdicts = load_verdicts(REPO_ROOT)
    assert verdicts, "D3 verdicts 를 얻지 못했다 — 대조 대상 0건은 통과가 아니다"

    nulls = 0
    for source_id, policy in real_allowlist.sources.items():
        assert source_id in verdicts, f"allowlist 의 {source_id} 가 D3 verdicts.csv 에 없다"
        if not policy.verdict:
            nulls += 1
        assert policy.verdict == verdicts[source_id], (
            f"{source_id}: allowlist verdict={policy.verdict!r} != D3 {verdicts[source_id]!r}"
        )
    assert nulls == 0, f"verdict 가 비어 있는 소스 {nulls}건"


def test_license_status_null_is_rejected_by_row(tmp_path) -> None:
    """행 생성 단계에서 NULL·enum 밖 값이 막힌다 (F2a NOT NULL + enum 과 동형)."""
    envelope = {
        "blob_key": "s/r/" + "a" * 64,
        "body_sha256": "a" * 64,
        "http_status": 200,
        "final_url": "https://fixture.example/venue/1",
        "headers": {},
        "crawl_run_id": "run",
        "adapter_version": "v1",
        "source_id": "fixture_source",
    }
    with pytest.raises(ConfigError, match="enum 밖"):
        SourceRecordRow(
            id=new_record_id(),
            source_url="https://fixture.example/venue/1",
            raw_payload=envelope,
            fetched_at=utc_now_iso(),
            source_license_status="",
        )
    with pytest.raises(ConfigError, match="enum 밖"):
        SourceRecordRow(
            id=new_record_id(),
            source_url="https://fixture.example/venue/1",
            raw_payload=envelope,
            fetched_at=utc_now_iso(),
            source_license_status="approved",
        )


def test_source_record_row_requires_payload_or_tombstone() -> None:
    """원문 없는 행을 만들 수 없다 (F2a source_record_payload_present)."""
    with pytest.raises(ConfigError, match="원문 없는 행"):
        SourceRecordRow(
            id=new_record_id(),
            source_url="https://fixture.example/venue/1",
            raw_payload=None,
            fetched_at=utc_now_iso(),
            source_license_status="conditional",
        )
