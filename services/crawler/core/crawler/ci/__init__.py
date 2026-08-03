"""CI 가드 잡 구현체.

`.github/workflows/crawler.yml` 이 호출하는 진입점은 전부 여기 있다. 워크플로에는 셸
로직을 두지 않는다 — 워크플로 안의 로직은 테스트할 수 없고, 테스트할 수 없는 검사는
다음 커밋에 조용히 무력화된다.

    python -m crawler.ci.allowlist_guard
    python -m crawler.ci.smoke_verify   --report artifacts/smoke.json
    python -m crawler.ci.adapter_guards --check path-guard | dataset-lock | dataset-order
    python -m crawler.ci.symbol_guard
"""

from __future__ import annotations

__all__: list[str] = []
