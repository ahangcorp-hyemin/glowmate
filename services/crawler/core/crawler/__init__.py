"""C1-CRAWLER-CORE — 크롤러 코어 (스케줄 · 큐 · 재시도 · 원문 보관).

임포트 이름은 ``crawler`` 이고 소스는 ``services/crawler/core/crawler/`` 에 있다.
``core/`` 는 소스 루트이며, 계약 본문이 말하는 ``core/contracts/...`` ·
``core/blocking/markers.yaml`` 은 이 트리의 ``core/crawler/contracts/...`` ·
``core/crawler/blocking/markers.yaml`` 에 해당한다.

왜 한 단계 더 들어가는가: REQ-8 의 acceptance 가 ``python -m crawler.smoke`` 를 요구하므로
임포트 이름이 ``crawler`` 여야 하는데, hatchling 은 editable 설치에서 접두사를 **치환하는**
``sources`` 재작성을 지원하지 않는다("Dev mode installations are unsupported when any path
rewrite in the `sources` option changes a prefix rather than removes it"). 접두사 **제거**만
가능하므로 ``core/crawler`` → ``crawler`` 형태가 유일하게 성립하는 배치다.

공개 import 경로 (C2·C3 등 어댑터 태스크가 쓰는 고정 경로)는 README.md 를 참조한다.
"""

from __future__ import annotations

#: 이 코어의 버전. 봉투(envelope)의 adapter_version 기본값 계산에 쓰인다.
CORE_VERSION = "0.1.0"

__all__ = ["CORE_VERSION"]
