"""Playwright 기반 스모크 추출기.

이 모듈은 "브라우저를 기동해 지정 셀렉터의 텍스트 1건을 꺼낸다"는 능력만 증명한다.
사이트별 셀렉터 사전·정규화·재시도 정책 등 어댑터 로직은 C1~C3 계약 소관이다.

실패 처리 원칙: 추출에 실패한 경우 빈 문자열이나 None 을 **정상값으로 반환하지 않는다.**
호출자가 "값이 없음"과 "추출이 깨짐"을 구분하지 못하면 수집 파이프라인이 조용히 0건을 쌓는다.
따라서 모든 실패 경로는 ExtractionError 로 올린다.
"""

from __future__ import annotations

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

DEFAULT_TIMEOUT_MS = 15_000

__all__ = ["DEFAULT_TIMEOUT_MS", "ExtractionError", "extract_text"]


class ExtractionError(RuntimeError):
    """추출 실패를 나타내는 예외.

    빈 문자열/None 반환으로 실패를 삼키지 않기 위해 존재한다.
    """

    def __init__(self, url: str, selector: str, reason: str) -> None:
        self.url = url
        self.selector = selector
        self.reason = reason
        super().__init__(f"{reason} (url={url!r}, selector={selector!r})")


def extract_text(url: str, selector: str, *, timeout_ms: int = DEFAULT_TIMEOUT_MS) -> str:
    """`url` 을 Chromium 으로 열어 `selector` 에 매칭되는 요소의 텍스트 1건을 반환한다.

    Args:
        url: 열 페이지 주소. 테스트는 네트워크에 나가지 않도록 `file://` 픽스처를 쓴다.
        selector: CSS 셀렉터. **정확히 1개** 요소에 매칭되어야 한다.
        timeout_ms: 페이지 로드 및 셀렉터 대기 타임아웃(밀리초).

    Returns:
        공백을 제거한 텍스트. 반환값은 항상 비어 있지 않다.

    Raises:
        ExtractionError: 페이지 로드 실패, 셀렉터 미매칭, 복수 매칭(모호),
            또는 매칭 요소의 텍스트가 공백뿐인 경우.
        ValueError: 인자 자체가 비어 있는 경우.
    """
    if not url:
        raise ValueError("url 이 비어 있다")
    if not selector:
        raise ValueError("selector 가 비어 있다")

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        try:
            page = browser.new_page()
            try:
                page.goto(url, wait_until="load", timeout=timeout_ms)
            except PlaywrightError as exc:
                raise ExtractionError(url, selector, "페이지 로드 실패") from exc

            locator = page.locator(selector)
            try:
                locator.first.wait_for(state="attached", timeout=timeout_ms)
            except PlaywrightTimeoutError as exc:
                raise ExtractionError(url, selector, "셀렉터에 매칭되는 요소가 없다") from exc

            matched = locator.count()
            if matched != 1:
                raise ExtractionError(
                    url, selector, f"셀렉터가 1건이 아니라 {matched}건에 매칭됐다"
                )

            text = locator.first.inner_text().strip()
            if not text:
                raise ExtractionError(url, selector, "매칭된 요소의 텍스트가 비어 있다")
            return text
        finally:
            browser.close()
