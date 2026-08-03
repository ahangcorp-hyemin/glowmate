"""FORBID-6 — 지정 파기 CLI.

`pytest -k test_purge_requires_ticket`
`pytest -k test_purge_keeps_row`
"""

from __future__ import annotations

import json
from datetime import UTC, datetime

import pytest

from crawler.contracts import build_envelope
from crawler.errors import PurgeError
from crawler.purge import audit_path_for, purge_blob
from crawler.purge import main as purge_main
from crawler.storage.blob import BlobStore, sha256_hex
from crawler.storage.record import (
    JsonlSourceRecordStore,
    SourceRecordRow,
    new_record_id,
    utc_now_iso,
)

BODY = "<html><body>원문 스냅샷</body></html>".encode()
TICKET = "W8-2026-0001"


def _seed(tmp_path):
    """blob 1건 + source_record 1행."""
    blob_root = tmp_path / "blobs"
    store = BlobStore(blob_root)
    digest = sha256_hex(BODY)
    key = BlobStore.make_key("fixture_source", "run-purge", digest)
    store.put(key, BODY)

    records = tmp_path / "records.jsonl"
    record_store = JsonlSourceRecordStore(records)
    envelope = build_envelope(
        blob_key=key,
        body_sha256=digest,
        http_status=200,
        final_url="https://fixture.example/venue/1",
        headers={"content-type": "text/html"},
        crawl_run_id="run-purge",
        adapter_version="core-only",
        source_id="fixture_source",
    )
    row = SourceRecordRow(
        id=new_record_id(),
        source_url="https://fixture.example/venue/1",
        raw_payload=envelope,
        fetched_at=utc_now_iso(),
        source_license_status="conditional",
    )
    record_store.insert(row)
    return blob_root, store, key, records, record_store, row


def test_purge_requires_ticket_cli_exits_nonzero(tmp_path, capsys) -> None:
    """티켓 ID 없이 실행하면 non-zero exit · blob 삭제 0건 · 감사 로그 append 0건."""
    blob_root, store, key, _records, record_store, _row = _seed(tmp_path)
    audit_root = tmp_path / "audit"

    with pytest.raises(SystemExit) as exc:
        purge_main(
            [
                "--blob-key",
                key,
                "--blob-root",
                str(blob_root),
                "--audit-root",
                str(audit_root),
                "--reason",
                "리뷰 작성자 개인정보 파기 요구",
            ]
        )
    assert exc.value.code != 0, "티켓 없이 실행했는데 0 으로 끝났다"

    assert store.exists(key), "티켓 없는 실행이 blob 을 지웠다"
    assert store.get(key) == BODY
    assert not audit_root.exists(), "티켓 없는 실행이 감사 로그를 남겼다"
    assert record_store.count() == 1


def test_purge_requires_ticket_api_raises(tmp_path) -> None:
    blob_root, store, key, _records, _record_store, _row = _seed(tmp_path)
    for bad in ("", "   "):
        with pytest.raises(PurgeError, match="티켓"):
            purge_blob(
                ticket_id=bad,
                blob_key=key,
                blob_root=blob_root,
                audit_root=tmp_path / "audit",
                reason="사유",
            )
    assert store.exists(key)
    assert not (tmp_path / "audit").exists()


def test_purge_requires_reason(tmp_path) -> None:
    blob_root, store, key, *_ = _seed(tmp_path)
    with pytest.raises(PurgeError, match="사유"):
        purge_blob(
            ticket_id=TICKET,
            blob_key=key,
            blob_root=blob_root,
            audit_root=tmp_path / "audit",
            reason="  ",
        )
    assert store.exists(key)


def test_purge_keeps_row_and_appends_audit(tmp_path) -> None:
    """티켓 있는 purge 후: source_record 행 수 불변 · blob_key tombstone · 감사 로그 1행 추가."""
    blob_root, store, key, _records, record_store, row = _seed(tmp_path)
    audit_root = tmp_path / "audit"
    before_rows = record_store.count()

    exit_code = purge_main(
        [
            "--ticket",
            TICKET,
            "--blob-key",
            key,
            "--blob-root",
            str(blob_root),
            "--audit-root",
            str(audit_root),
            "--reason",
            "리뷰 작성자 개인정보 파기 요구",
        ]
    )
    assert exit_code == 0

    assert record_store.count() == before_rows, "파기가 source_record 행을 지웠다"
    kept = record_store.get(row.id)
    assert kept.raw_payload is not None, "blob 파기가 DB 행의 봉투까지 지웠다"
    assert kept.raw_payload["blob_key"] == key

    state = store.state(key)
    assert state.state == "tombstone", f"blob 상태가 {state.state} 다"
    assert not store.exists(key)
    assert state.tombstone is not None
    assert state.tombstone["ticket_id"] == TICKET

    apath = audit_path_for(audit_root)
    assert apath.is_file(), f"감사 로그가 없다: {apath}"
    lines = [line for line in apath.read_text(encoding="utf-8").splitlines() if line.strip()]
    assert len(lines) == 1, f"감사 로그가 {len(lines)}행이다 — 1행이 추가돼야 한다"
    entry = json.loads(lines[0])
    assert entry["ticket_id"] == TICKET
    assert entry["blob_key"] == key
    assert entry["blob_state"] == "tombstone"


def test_purge_audit_log_is_append_only(tmp_path) -> None:
    """두 번째 파기가 첫 기록을 덮어쓰지 않는다."""
    blob_root, store, key, *_rest = _seed(tmp_path)
    audit_root = tmp_path / "audit"
    body2 = "<html><body>다른 원문</body></html>".encode()
    key2 = BlobStore.make_key("fixture_source", "run-purge", sha256_hex(body2))
    store.put(key2, body2)

    purge_blob(ticket_id=TICKET, blob_key=key, blob_root=blob_root, audit_root=audit_root,
               reason="첫 번째")
    purge_blob(ticket_id="W8-2026-0002", blob_key=key2, blob_root=blob_root,
               audit_root=audit_root, reason="두 번째")

    apath = audit_path_for(audit_root)
    lines = [line for line in apath.read_text(encoding="utf-8").splitlines() if line.strip()]
    assert len(lines) == 2
    assert json.loads(lines[0])["reason"] == "첫 번째"


def test_purge_tombstone_record_keeps_row(tmp_path) -> None:
    """--tombstone-record 는 행을 남기고 raw_payload 만 비운다 (F2a 함수와 동형)."""
    blob_root, _store, key, records, record_store, row = _seed(tmp_path)
    outcome = purge_blob(
        ticket_id=TICKET,
        blob_key=key,
        blob_root=blob_root,
        audit_root=tmp_path / "audit",
        reason="법적 삭제 명령",
        records_path=records,
        record_id=row.id,
        tombstone_record=True,
    )
    assert outcome.record_tombstoned
    assert record_store.count() == 1, "tombstone 이 행을 삭제했다"
    kept = record_store.get(row.id)
    assert kept.raw_payload is None
    assert kept.tombstoned_at is not None
    assert kept.tombstone_reason is not None and TICKET in kept.tombstone_reason


def test_record_store_tombstone_requires_reason(tmp_path) -> None:
    *_head, _records, record_store, row = _seed(tmp_path)
    with pytest.raises(PurgeError, match="사유"):
        record_store.tombstone(row.id, reason="")
    assert record_store.get(row.id).raw_payload is not None


def test_purge_missing_blob_raises(tmp_path) -> None:
    blob_root = tmp_path / "blobs"
    with pytest.raises(PurgeError, match="대상 blob 이 없다"):
        purge_blob(
            ticket_id=TICKET,
            blob_key="fixture_source/run/deadbeef",
            blob_root=blob_root,
            audit_root=tmp_path / "audit",
            reason="사유",
        )


def test_audit_path_uses_date(tmp_path) -> None:
    when = datetime(2026, 8, 3, tzinfo=UTC)
    assert audit_path_for(tmp_path, when).name == "2026-08-03.jsonl"
    assert audit_path_for(tmp_path, when).parent.name == "purge"
