"""`SourceAdapter` 프로토콜과 값 객체.

어댑터가 하는 일은 두 가지뿐이다.

  * `seed_targets()` — 이 소스에서 수집할 대상 목록을 낸다 (URL + target_key)
  * `extract(target, response_body)` — 응답 본문에서 `extracted` 공통 필드를 뽑는다

어댑터는 **직접 요청하지 않는다.** 요청은 코어의 사전 판정 게이트 → 레이트 리미터 →
트랜스포트 경로로만 나간다. 어댑터가 자기 소켓을 열면 allowlist·robots·rate limit 전부를
우회하게 되므로, 계약 스위트가 `fetch`·`request`·`urlopen` 계열 속성의 부재를 검사한다.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol, runtime_checkable


@dataclass(frozen=True, slots=True)
class FetchTarget:
    """수집 대상 1건."""

    url: str
    target_key: str
    #: 어댑터가 붙이는 임의 메타 (구·업종 힌트 등). 코어는 해석하지 않는다.
    hints: dict[str, str] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not self.url:
            raise ValueError("FetchTarget.url 이 비었다")
        if not self.target_key:
            raise ValueError(
                "FetchTarget.target_key 가 비었다 — "
                "중복 판정 키가 없으면 REQ-1 이 성립하지 않는다"
            )


@dataclass(frozen=True, slots=True)
class ExtractedRecord:
    """`extracted.schema.json` 에 대응하는 값 객체.

    C1 은 이 형태만 정의하고 값을 채우지 않는다 (out_of_scope).
    """

    source_id: str
    source_page_url: str
    venue_name: str
    road_address: str | None = None
    venue_type_label: str | None = None
    landline_number: str | None = None
    business_hours: str | None = None
    price_texts: tuple[str, ...] = ()
    extracted_at: str | None = None
    adapter_version: str | None = None

    def to_dict(self) -> dict[str, object]:
        data: dict[str, object] = {
            "source_id": self.source_id,
            "source_page_url": self.source_page_url,
            "venue_name": self.venue_name,
        }
        optional = {
            "road_address": self.road_address,
            "venue_type_label": self.venue_type_label,
            "landline_number": self.landline_number,
            "business_hours": self.business_hours,
            "extracted_at": self.extracted_at,
            "adapter_version": self.adapter_version,
        }
        for key, value in optional.items():
            if value is not None:
                data[key] = value
        if self.price_texts:
            data["price_texts"] = list(self.price_texts)
        return data


@runtime_checkable
class SourceAdapter(Protocol):
    """소스별 어댑터가 만족해야 하는 계약."""

    #: allowlist 의 소스 ID 와 정확히 같아야 한다
    source_id: str
    #: 봉투의 adapter_version 으로 기록된다
    version: str

    def seed_targets(self) -> list[FetchTarget]:
        """수집 대상 목록. 네트워크 접근 없이 순수하게 만들 수 있어야 한다."""
        ...

    def extract(self, target: FetchTarget, body: bytes) -> ExtractedRecord:
        """응답 본문에서 공통 필드를 뽑는다. 실패는 예외로 올린다 (빈 값 반환 금지)."""
        ...


def adapter_id_of(adapter: object) -> str:
    value = getattr(adapter, "source_id", None)
    if not isinstance(value, str) or not value:
        raise ValueError(f"어댑터에 source_id 가 없다: {adapter!r}")
    return value


def adapter_version_of(adapter: object) -> str:
    value = getattr(adapter, "version", None)
    if not isinstance(value, str) or not value:
        raise ValueError(f"어댑터에 version 이 없다: {adapter!r}")
    return value
