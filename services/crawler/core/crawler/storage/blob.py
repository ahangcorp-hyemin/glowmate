"""blob 스토어 — 응답 body 의 유일한 보관처.

`source_record.raw_payload` 에는 봉투만 넣고 body 는 여기 둔다. 키는
`<source_id>/<crawl_run_id>/<body_sha256>` 이며 **내용 주소 지정**이다 — 같은 본문을 두 번
저장해도 객체가 하나이므로, 재수집이 원문을 부풀리지 않는다.

FORBID-5: write 예외 또는 저장 후 재조회 sha256 불일치는 **예외로 올린다.** 호출자가
success 로 마킹할 방법이 없어야 한다는 뜻이며, 그래서 `put()` 은 실패를 반환값으로
돌려주지 않는다.

FORBID-6: 삭제는 `tombstone()` 하나뿐이고, 티켓 ID 없이는 호출할 수 없다. 객체는 사라지되
키는 tombstone 상태로 남아 "언제 왜 지웠는가"에 답할 수 있다.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path

from ..errors import BlobIntegrityError, BlobWriteError, PurgeError

TOMBSTONE_SUFFIX = ".tombstone.json"
OBJECT_SUFFIX = ".bin"


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


@dataclass(frozen=True, slots=True)
class BlobState:
    key: str
    present: bool
    tombstoned: bool
    tombstone: dict[str, str] | None = None

    @property
    def state(self) -> str:
        if self.tombstoned:
            return "tombstone"
        return "present" if self.present else "missing"


class BlobStore:
    """파일시스템 blob 스토어."""

    def __init__(self, root: str | Path) -> None:
        self.root = Path(root)

    def _paths(self, key: str) -> tuple[Path, Path]:
        if not key or key.startswith("/") or ".." in key.split("/"):
            raise ValueError(f"허용되지 않는 blob key: {key!r}")
        base = self.root / key
        return base.with_name(base.name + OBJECT_SUFFIX), base.with_name(
            base.name + TOMBSTONE_SUFFIX
        )

    @staticmethod
    def make_key(source_id: str, crawl_run_id: str, body_sha256: str) -> str:
        return f"{source_id}/{crawl_run_id}/{body_sha256}"

    def put(self, key: str, body: bytes) -> str:
        """body 를 저장하고 **재조회 검증까지 마친 뒤** sha256 을 돌려준다.

        write 실패는 :class:`BlobWriteError`, 재조회 불일치는 :class:`BlobIntegrityError`.
        어느 쪽도 반환값으로 흘리지 않는다 (FORBID-5).
        """
        digest = sha256_hex(body)
        obj, tomb = self._paths(key)
        if tomb.exists():
            raise BlobWriteError(f"tombstone 된 키에 다시 쓸 수 없다: {key}")
        try:
            obj.parent.mkdir(parents=True, exist_ok=True)
            tmp = obj.with_name(obj.name + ".part")
            tmp.write_bytes(body)
            tmp.replace(obj)
        except OSError as exc:
            raise BlobWriteError(f"blob write 실패: {key} ({exc})") from exc

        readback = self.get(key)
        actual = sha256_hex(readback)
        if actual != digest:
            raise BlobIntegrityError(
                f"blob 재조회 sha256 불일치: key={key} 기대={digest} 실제={actual} — "
                "원문 없는 파생 레코드를 남기지 않는다"
            )
        return digest

    def get(self, key: str) -> bytes:
        obj, tomb = self._paths(key)
        if tomb.exists() and not obj.exists():
            raise PurgeError(f"tombstone 된 blob 이다: {key}")
        if not obj.exists():
            raise BlobIntegrityError(f"blob 이 없다: {key}")
        return obj.read_bytes()

    def state(self, key: str) -> BlobState:
        obj, tomb = self._paths(key)
        tombstone = None
        if tomb.exists():
            tombstone = json.loads(tomb.read_text(encoding="utf-8"))
        return BlobState(
            key=key, present=obj.exists(), tombstoned=tomb.exists(), tombstone=tombstone
        )

    def exists(self, key: str) -> bool:
        return self._paths(key)[0].exists()

    def tombstone(self, key: str, *, ticket_id: str, reason: str, at: str) -> BlobState:
        """blob 객체를 지우고 tombstone 마커를 남긴다 (FORBID-6).

        티켓 ID 없이 호출하면 :class:`PurgeError`. **DB 행은 건드리지 않는다** —
        행 삭제는 F2a 의 트리거가 이미 거부하며, C1 은 blob 단위만 다룬다.
        """
        if not ticket_id or not ticket_id.strip():
            raise PurgeError(
                "파기 티켓 ID 없이 blob 을 지울 수 없다 — "
                "티켓 없는 삭제는 '언제 왜 지웠는가'에 답할 근거가 없다"
            )
        obj, tomb = self._paths(key)
        if not obj.exists() and not tomb.exists():
            raise PurgeError(f"파기 대상 blob 이 없다: {key}")
        if obj.exists():
            obj.unlink()
        tomb.parent.mkdir(parents=True, exist_ok=True)
        tomb.write_text(
            json.dumps(
                {"key": key, "ticket_id": ticket_id, "reason": reason, "tombstoned_at": at},
                ensure_ascii=False,
                sort_keys=True,
            ),
            encoding="utf-8",
        )
        return self.state(key)

    def keys(self) -> list[str]:
        if not self.root.exists():
            return []
        out = []
        for path in sorted(self.root.rglob("*")):
            if path.is_file() and path.name.endswith(OBJECT_SUFFIX):
                rel = path.relative_to(self.root)
                out.append(str(rel)[: -len(OBJECT_SUFFIX)])
        return out


class FailingBlobStore(BlobStore):
    """write 를 반드시 실패시키는 스토어 (FORBID-5 역케이스 검증용).

    코어가 소유하는 검증 도구다. 프로덕션 경로는 이 클래스를 참조하지 않는다.
    """

    def put(self, key: str, body: bytes) -> str:
        raise BlobWriteError(f"주입된 blob write 실패: {key} ({len(body)} 바이트)")


class CorruptingBlobStore(BlobStore):
    """디스크에 변조된 body 를 쓰는 스토어 (FORBID-5 역케이스 검증용).

    기대 해시는 **원본** body 로 계산하고 디스크에는 변조본을 쓴다. 따라서 `put()` 의
    재조회 검증에서 반드시 :class:`BlobIntegrityError` 가 난다.
    """

    def put(self, key: str, body: bytes) -> str:
        expected = sha256_hex(body)
        obj, tomb = self._paths(key)
        if tomb.exists():
            raise BlobWriteError(f"tombstone 된 키에 다시 쓸 수 없다: {key}")
        try:
            obj.parent.mkdir(parents=True, exist_ok=True)
            obj.write_bytes(body + b"<injected-corruption>")
        except OSError as exc:
            raise BlobWriteError(f"blob write 실패: {key} ({exc})") from exc
        actual = sha256_hex(self.get(key))
        if actual != expected:
            raise BlobIntegrityError(
                f"blob 재조회 sha256 불일치: key={key} 기대={expected} 실제={actual}"
            )
        return expected  # pragma: no cover - 도달 불가 (변조본은 항상 불일치)
