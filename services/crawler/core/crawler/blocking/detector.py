"""차단 응답 판정기 (FORBID-4).

세 축을 본다.

  (a) `markers.yaml` 의 로그인·캡차·차단 마커 매칭
  (b) HTTP 401 · 403 · 429
  (c) HTTP 200 인데 body 길이가 소스 `min_body_bytes` 미만

세 축 중 하나라도 걸리면 잡은 `blocked_access` 로 끝난다. **재요청하지 않는다.**
로그인·쿠키 주입·UA 무작위화·프록시 로테이션으로 다시 시도하는 경로는 코드에 존재하지
않으며, 존재하게 되면 `crawler.ci.forbidden_symbols` 가 CI 에서 잡는다.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from importlib import resources
from typing import Any

import yaml

from ..errors import ConfigError

MARKERS_FILENAME = "markers.yaml"
MARKERS_PATH = f"services/crawler/core/crawler/blocking/{MARKERS_FILENAME}"

#: FORBID-4 (b)
BLOCKED_HTTP_STATUSES = frozenset({401, 403, 429})

DEFAULT_KEY = "_default"


@dataclass(frozen=True, slots=True)
class Marker:
    id: str
    kind: str
    pattern: str
    evidence: str

    def matches(self, text: str) -> bool:
        if self.kind == "substring":
            return self.pattern.lower() in text.lower()
        if self.kind == "regex":
            return re.search(self.pattern, text, re.IGNORECASE | re.DOTALL) is not None
        raise ConfigError(f"마커 {self.id}: 알 수 없는 kind={self.kind!r} (substring|regex)")


@dataclass(frozen=True, slots=True)
class MarkerSet:
    version: str
    min_body_bytes: int
    markers: tuple[Marker, ...]


@dataclass(frozen=True, slots=True)
class BlockDecision:
    blocked: bool
    rule: str
    detail: str

    @staticmethod
    def clear() -> BlockDecision:
        return BlockDecision(blocked=False, rule="", detail="")


def _parse_markers(raw: object, source_id: str) -> tuple[Marker, ...]:
    if not isinstance(raw, list) or not raw:
        raise ConfigError(
            f"{MARKERS_PATH}: {source_id} 의 markers 가 비었다 — "
            "마커 0건은 '차단 없음'이 아니라 사전 결손이다"
        )
    out = []
    for item in raw:
        if not isinstance(item, dict):
            raise ConfigError(
                f"{MARKERS_PATH}: {source_id} 의 marker 항목이 매핑이 아니다: {item!r}"
            )
        missing = [k for k in ("id", "kind", "pattern", "evidence") if not item.get(k)]
        if missing:
            raise ConfigError(
                f"{MARKERS_PATH}: {source_id} 의 marker 에 필수 키가 없다: {missing} ({item!r}) — "
                "evidence 없는 마커는 추측이며, 추측 마커는 오탐으로 정상 수집을 죽인다"
            )
        out.append(
            Marker(
                id=str(item["id"]),
                kind=str(item["kind"]),
                pattern=str(item["pattern"]),
                evidence=str(item["evidence"]),
            )
        )
    return tuple(out)


def load_markers(text: str | None = None) -> dict[str, MarkerSet]:
    """마커 사전을 읽는다. 부재·파싱 실패·`_default` 부재는 전부 예외 (fail-closed)."""
    if text is None:
        try:
            text = (
                resources.files(__package__)
                .joinpath(MARKERS_FILENAME)
                .read_text(encoding="utf-8")
            )
        except (FileNotFoundError, OSError) as exc:
            raise ConfigError(
                f"{MARKERS_PATH} 를 읽을 수 없다: {exc} — "
                "마커 사전 부재를 '차단 없음'으로 처리하지 않는다"
            ) from exc
    try:
        data: Any = yaml.safe_load(text)
    except yaml.YAMLError as exc:
        raise ConfigError(f"{MARKERS_PATH} YAML 파싱 실패: {exc}") from exc
    if not isinstance(data, dict):
        raise ConfigError(f"{MARKERS_PATH} 를 매핑으로 읽지 못했다")

    version = str(data.get("version") or "")
    if not version:
        raise ConfigError(f"{MARKERS_PATH}: version 이 없다 — 마커 사전은 버전 관리 대상이다")
    if DEFAULT_KEY not in data:
        raise ConfigError(
            f"{MARKERS_PATH}: `{DEFAULT_KEY}` 항목이 없다 — "
            "소스별 항목이 없는 소스가 상속할 기본 마커가 사라진다"
        )

    out: dict[str, MarkerSet] = {}
    for key, value in data.items():
        if key == "version":
            continue
        if not isinstance(value, dict):
            raise ConfigError(f"{MARKERS_PATH}: {key} 항목이 매핑이 아니다")
        min_bytes = int(value.get("min_body_bytes", 0))
        if min_bytes < 1:
            raise ConfigError(
                f"{MARKERS_PATH}: {key} 의 min_body_bytes 가 {min_bytes} 다 — "
                "1 미만이면 (c) 크기 하한 검사가 무력화된다"
            )
        out[str(key)] = MarkerSet(
            version=version,
            min_body_bytes=min_bytes,
            markers=_parse_markers(value.get("markers"), str(key)),
        )
    return out


class BlockingDetector:
    """소스별 차단 판정기."""

    def __init__(self, marker_sets: dict[str, MarkerSet] | None = None) -> None:
        self._sets = marker_sets if marker_sets is not None else load_markers()
        if DEFAULT_KEY not in self._sets:
            raise ConfigError(f"마커 집합에 `{DEFAULT_KEY}` 가 없다 (fail-closed)")

    @property
    def version(self) -> str:
        return self._sets[DEFAULT_KEY].version

    def marker_set_for(self, source_id: str) -> MarkerSet:
        """소스별 실효 마커 집합.

        `_default` 를 **상속**한다 — 소스 항목은 기본 마커를 대체하지 않고 더한다.
        대체 방식이면 소스 항목을 추가하는 순간 로그인·캡차 마커가 조용히 사라진다.
        `min_body_bytes` 는 두 값 중 큰 쪽이다.
        """
        base = self._sets[DEFAULT_KEY]
        own = self._sets.get(source_id)
        if own is None or source_id == DEFAULT_KEY:
            return base
        seen = {m.id for m in own.markers}
        merged = (*own.markers, *(m for m in base.markers if m.id not in seen))
        return MarkerSet(
            version=base.version,
            min_body_bytes=max(base.min_body_bytes, own.min_body_bytes),
            markers=merged,
        )

    def min_body_bytes(self, source_id: str, allowlist_min: int = 0) -> int:
        """실효 하한. allowlist 값과 마커 사전 값 중 **큰 쪽**을 쓴다."""
        return max(int(allowlist_min), self.marker_set_for(source_id).min_body_bytes)

    def evaluate(
        self,
        *,
        source_id: str,
        http_status: int,
        body: bytes,
        allowlist_min_body_bytes: int = 0,
    ) -> BlockDecision:
        """차단 여부 판정. (b) → (c) → (a) 순으로 본다."""
        if http_status in BLOCKED_HTTP_STATUSES:
            return BlockDecision(
                blocked=True,
                rule=f"http-{http_status}",
                detail=(
                    f"HTTP {http_status} — 접근통제 응답이다. 재요청하지 않는다 "
                    "(로그인·쿠키·UA 무작위화·프록시 로테이션 어느 것으로도)"
                ),
            )

        floor = self.min_body_bytes(source_id, allowlist_min_body_bytes)
        if http_status == 200 and len(body) < floor:
            return BlockDecision(
                blocked=True,
                rule="min-body-bytes",
                detail=(
                    f"HTTP 200 인데 body {len(body)} 바이트 < 하한 {floor} — "
                    "마커 사전에 없는 신종 차단 페이지는 200 + 빈 본문으로 온다"
                ),
            )

        text = body.decode("utf-8", errors="replace")
        for marker in self.marker_set_for(source_id).markers:
            if marker.matches(text):
                return BlockDecision(
                    blocked=True,
                    rule=f"marker:{marker.id}",
                    detail=f"차단 마커 매칭 ({marker.kind}) — 근거: {marker.evidence}",
                )
        return BlockDecision.clear()
