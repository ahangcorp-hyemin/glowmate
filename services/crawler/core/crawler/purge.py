"""`python -m crawler.purge` — 지정 파기 CLI (FORBID-6).

원문 제거의 **유일한 경로**다. 규칙은 셋이다.

  1. 티켓 ID(W8 파기 티켓 또는 법적 삭제 명령 문서 ID) 없이는 아무것도 지우지 않는다.
  2. 삭제 범위는 **blob 객체로 한정**한다. `source_record` 행은 남는다 —
     행이 사라지면 "이 가격이 언제 어디서 왔는가"를 증명할 수 없다.
  3. 실행 결과는 `audit/purge/<YYYY-MM-DD>.jsonl` 에 **append** 한다. 감사 로그를
     덮어쓰지 않는다.

행 UPDATE/DELETE 는 F2a 의 DB 트리거가 이미 거부한다. `--tombstone-record` 는 그 트리거가
허용하는 유일한 형태(`core.tombstone_source_record`)와 동형인 로컬 스토어 연산이다.

이 태스크는 파기 요청의 **접수·판단·회신**을 하지 않는다 (W7·W8 소관). 티켓 ID 를 입력으로
받는 실행 도구만 제공한다.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from .errors import PurgeError
from .storage.blob import BlobStore
from .storage.record import JsonlSourceRecordStore, utc_now_iso

AUDIT_SUBDIR = "purge"


@dataclass(frozen=True, slots=True)
class PurgeOutcome:
    ticket_id: str
    blob_key: str
    blob_state: str
    record_id: str | None
    record_tombstoned: bool
    audit_path: Path
    at: str


def audit_path_for(audit_root: str | Path, when: datetime | None = None) -> Path:
    day = (when or datetime.now(UTC)).strftime("%Y-%m-%d")
    return Path(audit_root) / AUDIT_SUBDIR / f"{day}.jsonl"


def purge_blob(
    *,
    ticket_id: str,
    blob_key: str,
    blob_root: str | Path,
    audit_root: str | Path,
    reason: str,
    records_path: str | Path | None = None,
    record_id: str | None = None,
    tombstone_record: bool = False,
    when: datetime | None = None,
) -> PurgeOutcome:
    """blob 1건을 파기하고 감사 로그를 남긴다."""
    if not ticket_id or not ticket_id.strip():
        raise PurgeError(
            "파기 티켓 ID 가 없다 — W8 파기 티켓 또는 "
            "법적 삭제 명령 문서 ID 없이는 원문을 지우지 않는다"
        )
    if not reason or not reason.strip():
        raise PurgeError("파기 사유가 없다 — 사유 없는 파기는 기록이 아니다")

    at = utc_now_iso()
    store = BlobStore(blob_root)
    state = store.tombstone(blob_key, ticket_id=ticket_id, reason=reason, at=at)

    record_tombstoned = False
    if tombstone_record:
        if not records_path or not record_id:
            raise PurgeError("--tombstone-record 에는 --records 와 --record-id 가 함께 필요하다")
        JsonlSourceRecordStore(records_path).tombstone(
            record_id, reason=f"{ticket_id}: {reason}", at=at
        )
        record_tombstoned = True

    apath = audit_path_for(audit_root, when)
    apath.parent.mkdir(parents=True, exist_ok=True)
    with apath.open("a", encoding="utf-8") as fh:
        fh.write(
            json.dumps(
                {
                    "at": at,
                    "ticket_id": ticket_id,
                    "blob_key": blob_key,
                    "blob_state": state.state,
                    "record_id": record_id,
                    "record_tombstoned": record_tombstoned,
                    "reason": reason,
                },
                ensure_ascii=False,
                sort_keys=True,
            )
            + "\n"
        )
    return PurgeOutcome(
        ticket_id=ticket_id,
        blob_key=blob_key,
        blob_state=state.state,
        record_id=record_id,
        record_tombstoned=record_tombstoned,
        audit_path=apath,
        at=at,
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="python -m crawler.purge",
        description="원문 blob 지정 파기 (W8 파기 티켓 또는 법적 삭제 명령 필수)",
    )
    parser.add_argument(
        "--ticket",
        required=True,
        help="W8 파기 티켓 ID 또는 법적 삭제 명령 문서 ID (필수)",
    )
    parser.add_argument("--blob-key", required=True, help="파기할 blob 객체 키")
    parser.add_argument("--blob-root", required=True, help="blob 스토어 루트")
    parser.add_argument("--audit-root", default="audit", help="감사 로그 루트 (기본: audit)")
    parser.add_argument("--reason", required=True, help="파기 사유")
    parser.add_argument("--records", help="source_record JSONL 경로")
    parser.add_argument("--record-id", help="대상 source_record 행 ID")
    parser.add_argument(
        "--tombstone-record",
        action="store_true",
        help="행은 남기고 raw_payload 만 비운다 (F2a core.tombstone_source_record 와 동형)",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        outcome = purge_blob(
            ticket_id=args.ticket,
            blob_key=args.blob_key,
            blob_root=args.blob_root,
            audit_root=args.audit_root,
            reason=args.reason,
            records_path=args.records,
            record_id=args.record_id,
            tombstone_record=args.tombstone_record,
        )
    except PurgeError as exc:
        print(f"purge 실패: {exc}", file=sys.stderr)
        return 1
    print(
        f"purge 완료 · ticket={outcome.ticket_id} blob={outcome.blob_key} "
        f"state={outcome.blob_state} audit={outcome.audit_path}"
    )
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
