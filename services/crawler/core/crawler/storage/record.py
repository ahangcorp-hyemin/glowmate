"""`source_record` 기록기 (REQ-3).

F2a 가 소유하는 `core.source_record` 의 컬럼 4개를 그대로 쓴다:
`source_url` · `raw_payload` · `fetched_at` · `source_license_status`.
(+ F2a 가 정의한 tombstone 2컬럼 `tombstoned_at` · `tombstone_reason`)

**스키마·마이그레이션은 C1 의 out_of_scope 다.** 여기 있는 것은 그 행을 만드는 쪽이며,
싱크는 :class:`SourceRecordSink` 프로토콜로 분리해 두었다. 로컬 실행·테스트는
:class:`JsonlSourceRecordStore` 를 쓰고, Postgres 바인딩은 F2a 산출물을 쓰는 별도 태스크가
같은 프로토콜을 구현하면 코어 수정 없이 붙는다.

append-only 를 애플리케이션 쪽에서도 지킨다. DB 는 트리거로 이미 거부하지만(F2a REQ-5),
로컬 스토어까지 같은 규칙을 갖고 있어야 "테스트에서는 지워도 된다"는 관행이 생기지 않는다.
"""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Protocol, runtime_checkable

from ..contracts.schemas import validate_envelope
from ..d3 import VERDICT_VALUES
from ..errors import ConfigError, PurgeError

#: F2a `core.source_license_status` enum 과 같은 집합
LICENSE_STATUS_VALUES = VERDICT_VALUES


def utc_now_iso() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


@dataclass(frozen=True, slots=True)
class SourceRecordRow:
    """`core.source_record` 1행."""

    id: str
    source_url: str
    raw_payload: dict[str, Any] | None
    fetched_at: str
    source_license_status: str
    tombstoned_at: str | None = None
    tombstone_reason: str | None = None

    def __post_init__(self) -> None:
        if not self.source_url.strip():
            raise ConfigError("source_url 이 비었다 (F2a source_record_url_not_blank)")
        if self.source_license_status not in LICENSE_STATUS_VALUES:
            raise ConfigError(
                f"source_license_status={self.source_license_status!r} 가 enum 밖이다 "
                f"({', '.join(LICENSE_STATUS_VALUES)})"
            )
        if self.raw_payload is None and self.tombstoned_at is None:
            raise ConfigError(
                "raw_payload 가 NULL 인데 tombstoned_at 이 없다 "
                "(F2a source_record_payload_present) — 원문 없는 행을 만들지 않는다"
            )
        if self.tombstoned_at is not None and self.raw_payload is not None:
            raise ConfigError("tombstone 된 행은 raw_payload 가 반드시 NULL 이다 (F2a)")
        if (self.tombstoned_at is None) != (self.tombstone_reason is None):
            raise ConfigError("tombstoned_at 과 tombstone_reason 은 함께 있거나 함께 없다 (F2a)")

    def to_json(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "source_url": self.source_url,
            "raw_payload": self.raw_payload,
            "fetched_at": self.fetched_at,
            "source_license_status": self.source_license_status,
            "tombstoned_at": self.tombstoned_at,
            "tombstone_reason": self.tombstone_reason,
        }

    @staticmethod
    def from_json(data: dict[str, Any]) -> SourceRecordRow:
        return SourceRecordRow(
            id=str(data["id"]),
            source_url=str(data["source_url"]),
            raw_payload=data.get("raw_payload"),
            fetched_at=str(data["fetched_at"]),
            source_license_status=str(data["source_license_status"]),
            tombstoned_at=data.get("tombstoned_at"),
            tombstone_reason=data.get("tombstone_reason"),
        )


@runtime_checkable
class SourceRecordSink(Protocol):
    """`source_record` 싱크. Postgres 바인딩이 붙을 자리."""

    def insert(self, row: SourceRecordRow) -> SourceRecordRow: ...

    def get(self, record_id: str) -> SourceRecordRow: ...

    def all(self) -> list[SourceRecordRow]: ...


class JsonlSourceRecordStore:
    """append-only JSONL 스토어.

    행은 붙이기만 한다. tombstone 은 **효과 행**(같은 id 의 tombstone 이벤트)을 덧붙이는
    형태이며, 원 행을 고치지 않는다. 조회 시 마지막 상태를 합성한다 — 이력이 남는다.
    """

    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)

    def _read_all(self) -> list[dict[str, Any]]:
        if not self.path.exists():
            return []
        out = []
        for line in self.path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                out.append(json.loads(line))
        return out

    def _append(self, payload: dict[str, Any]) -> None:
        with self.path.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(payload, ensure_ascii=False, sort_keys=True) + "\n")

    def insert(self, row: SourceRecordRow) -> SourceRecordRow:
        if row.raw_payload is not None:
            validate_envelope(row.raw_payload)
        self._append({"op": "insert", **row.to_json()})
        return row

    def all(self) -> list[SourceRecordRow]:
        state: dict[str, dict[str, Any]] = {}
        order: list[str] = []
        for event in self._read_all():
            rid = str(event["id"])
            if event.get("op") == "insert":
                state[rid] = {k: v for k, v in event.items() if k != "op"}
                order.append(rid)
            elif event.get("op") == "tombstone":
                current = state.get(rid)
                if current is None:
                    raise PurgeError(f"존재하지 않는 행의 tombstone 이벤트: {rid}")
                current["raw_payload"] = None
                current["tombstoned_at"] = event["tombstoned_at"]
                current["tombstone_reason"] = event["tombstone_reason"]
        return [SourceRecordRow.from_json(state[rid]) for rid in order]

    def get(self, record_id: str) -> SourceRecordRow:
        for row in self.all():
            if row.id == record_id:
                return row
        raise PurgeError(f"source_record 행이 없다: {record_id}")

    def count(self) -> int:
        return len(self.all())

    def tombstone(self, record_id: str, *, reason: str, at: str | None = None) -> SourceRecordRow:
        """행은 남기고 raw_payload 만 비운다 (F2a `core.tombstone_source_record` 와 동형).

        사유 없는 파기는 거부한다.
        """
        if not reason or not reason.strip():
            raise PurgeError("tombstone 사유는 필수다 — 사유 없는 파기는 기록이 아니다")
        self.get(record_id)  # 부재 시 예외
        self._append(
            {
                "op": "tombstone",
                "id": record_id,
                "tombstoned_at": at or utc_now_iso(),
                "tombstone_reason": reason,
            }
        )
        return self.get(record_id)


def new_record_id() -> str:
    return str(uuid.uuid4())
