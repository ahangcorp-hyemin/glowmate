"""glowmate 크롤러 패키지.

F1-REPO-SCAFFOLD REQ-4 범위: Playwright 툴체인이 실제로 동작하는지 증명하는
스모크 추출기 1개까지다. 사이트별 어댑터/파싱 규칙은 C1~C3 소관이므로 여기에 두지 않는다.
"""

from glowmate_crawler.extract import DEFAULT_TIMEOUT_MS, ExtractionError, extract_text

__all__ = ["DEFAULT_TIMEOUT_MS", "ExtractionError", "extract_text"]
