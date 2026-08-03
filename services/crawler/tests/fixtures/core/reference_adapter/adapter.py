"""레퍼런스 더미 어댑터 (C1 REQ-6).

C2·C3 및 파생 어댑터 태스크가 복사해 시작하는 최소 형태다. **파일 하나**로 등록이 끝난다 —
`core/` 도, `pyproject.toml` 도, 다른 어댑터 디렉터리도 건드리지 않는다.

레지스트리 규약:
  services/crawler/adapters/<source_id>/adapter.py 에서
  `ADAPTER` 상수 또는 `build_adapter()` 팩토리를 노출한다.

이 파일이 `tests/fixtures/core/` 에 있는 이유: C1 의 touches 에
`services/crawler/adapters/**` 가 없다. 계약이 "어댑터 디렉터리 추가만으로 등록된다"를
검증하라고 요구하므로, 테스트가 이 파일을 임시 디렉터리
`.../adapters/<source_id>/adapter.py` 로 복사해 **실제 규약 경로에서** 발견되는지 확인한다.
"""

from __future__ import annotations

import re

from crawler.contracts import ExtractedRecord, FetchTarget

SOURCE_ID = "fixture_source"

_NAME_RE = re.compile(r'id="venue-name"[^>]*>([^<]+)<', re.IGNORECASE)
_TYPE_RE = re.compile(r'id="venue-type"[^>]*>([^<]+)<', re.IGNORECASE)
_ADDR_RE = re.compile(r'id="road-address"[^>]*>([^<]+)<', re.IGNORECASE)
_TEL_RE = re.compile(r'id="landline"[^>]*>([^<]+)<', re.IGNORECASE)
_HOURS_RE = re.compile(r'id="hours"[^>]*>([^<]+)<', re.IGNORECASE)
_PRICE_RE = re.compile(r"<li>([^<]*원)</li>")


class ExtractionError(RuntimeError):
    """추출 실패. 빈 값이나 None 을 돌려주지 않는다."""


class ReferenceAdapter:
    source_id = SOURCE_ID
    version = "reference-0.1.0"

    def seed_targets(self) -> list[FetchTarget]:
        return [
            FetchTarget(
                url=f"https://fixture.example/venue/{idx}",
                target_key=f"fixture:{idx}",
                hints={"gu": "강남구"},
            )
            for idx in range(1, 4)
        ]

    def extract(self, target: FetchTarget, body: bytes) -> ExtractedRecord:
        text = body.decode("utf-8", errors="replace")
        name = _NAME_RE.search(text)
        if name is None:
            raise ExtractionError(
                f"상호를 찾지 못했다 (target={target.target_key}) — "
                "빈 값을 돌려주면 '수집했는데 이름이 없다'가 정상 상태가 된다"
            )
        tel = _TEL_RE.search(text)
        landline = tel.group(1).strip() if tel else None
        # D3 republish_policy — 01x 로 시작하는 번호는 개인 휴대전화이므로 저장하지 않는다.
        if landline and re.match(r"^01[016789]", landline.replace("-", "")):
            landline = None
        type_hit = _TYPE_RE.search(text)
        addr_hit = _ADDR_RE.search(text)
        hours_hit = _HOURS_RE.search(text)
        return ExtractedRecord(
            source_id=self.source_id,
            source_page_url=target.url,
            venue_name=name.group(1).strip(),
            venue_type_label=type_hit.group(1).strip() if type_hit else None,
            road_address=addr_hit.group(1).strip() if addr_hit else None,
            landline_number=landline,
            business_hours=hours_hit.group(1).strip() if hours_hit else None,
            price_texts=tuple(m.group(1).strip() for m in _PRICE_RE.finditer(text)),
            adapter_version=self.version,
        )


ADAPTER = ReferenceAdapter()
