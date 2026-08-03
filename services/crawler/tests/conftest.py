"""테스트 공통 설정.

픽스처 HTML 은 `file://` 로만 로드한다 — CI 재현성을 위해 테스트가 네트워크에 나가지 않는다.
"""

from __future__ import annotations

from pathlib import Path

import pytest

FIXTURES_DIR = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="session")
def venue_fixture_url() -> str:
    """고정 HTML 픽스처의 file:// URL."""
    path = FIXTURES_DIR / "venue_page.html"
    if not path.is_file():
        raise FileNotFoundError(f"픽스처가 없다: {path}")
    return path.as_uri()
