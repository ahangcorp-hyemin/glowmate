"""F1-REPO-SCAFFOLD REQ-4 스모크 테스트.

핵심 assert: "Playwright 브라우저(Chromium) 기동 후
로컬 고정 HTML 에서 지정 셀렉터 텍스트 1건 추출".

Playwright 나 브라우저 바이너리가 없으면 이 테스트는 **skip 이 아니라 실패**한다.
(pytest 의 skip/xfail 마크는 F1 FORBID-2 의 금지 관용구다. 설치 절차는 README.md 참고.)
"""

from __future__ import annotations

from pathlib import Path

import pytest

from glowmate_crawler import ExtractionError, extract_text

VENUE_NAME_SELECTOR = '[data-testid="venue-name"]'
EXPECTED_VENUE_NAME = "글로우메이트 테스트 매장"


def test_extracts_single_text_from_local_fixture(venue_fixture_url: str) -> None:
    """REQ-4: 브라우저 기동 → 로컬 고정 HTML → 지정 셀렉터 텍스트 1건 추출."""
    # 네트워크에 나가지 않음을 계약으로 못박는다.
    assert venue_fixture_url.startswith("file://"), venue_fixture_url

    text = extract_text(venue_fixture_url, VENUE_NAME_SELECTOR)

    assert text == EXPECTED_VENUE_NAME


def test_missing_selector_raises_instead_of_returning_empty(venue_fixture_url: str) -> None:
    """조용한 실패 금지: 미매칭 시 빈 문자열이 아니라 예외."""
    with pytest.raises(ExtractionError) as excinfo:
        extract_text(venue_fixture_url, '[data-testid="does-not-exist"]', timeout_ms=2_000)

    assert "매칭되는 요소가 없다" in str(excinfo.value)


def test_ambiguous_selector_raises(venue_fixture_url: str) -> None:
    """조용한 실패 금지: 복수 매칭 시 임의의 1건을 고르지 않고 예외."""
    with pytest.raises(ExtractionError) as excinfo:
        extract_text(venue_fixture_url, ".decoy", timeout_ms=2_000)

    assert "2건에 매칭됐다" in str(excinfo.value)


def test_blank_text_raises(venue_fixture_url: str) -> None:
    """조용한 실패 금지: 공백뿐인 텍스트를 성공으로 반환하지 않는다."""
    with pytest.raises(ExtractionError) as excinfo:
        extract_text(venue_fixture_url, '[data-testid="blank-text"]', timeout_ms=2_000)

    assert "텍스트가 비어 있다" in str(excinfo.value)


def test_unreachable_page_raises(tmp_path: Path) -> None:
    """조용한 실패 금지: 로드 실패를 성공으로 처리하지 않는다."""
    missing = (tmp_path / "nope.html").as_uri()

    with pytest.raises(ExtractionError) as excinfo:
        extract_text(missing, VENUE_NAME_SELECTOR, timeout_ms=2_000)

    assert "페이지 로드 실패" in str(excinfo.value)
