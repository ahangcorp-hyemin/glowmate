"""크롤러 코어 예외.

원칙: **조용한 실패 금지.** 판정 불가·설정 부재·원천 부재는 기본값으로 대체하지 않고
예외로 올린다. 빈 결과를 돌려주면 그 순간 검사가 공허해진다.
"""

from __future__ import annotations


class CrawlerError(Exception):
    """크롤러 코어 공통 예외."""


class ConfigError(CrawlerError):
    """allowlist · 정책 · 마커 사전 등 설정 원천의 부재·불일치."""


class ProvenanceError(ConfigError):
    """D3 산출물(verdicts.csv · crawl_policy.yaml) 을 대조 원천으로 확보하지 못했다.

    fail-closed 다 — 대조 원천이 없으면 allowlist 를 '검증됨'으로 처리하지 않는다.
    """


class PolicyViolationError(CrawlerError):
    """정책 상한을 넘기려는 시도 (FORBID-3)."""


class TransportError(CrawlerError):
    """네트워크 계층 실패 (연결 실패 · 타임아웃 · 리셋)."""


class BlobWriteError(CrawlerError):
    """blob 스토어 write 실패 (FORBID-5)."""


class BlobIntegrityError(CrawlerError):
    """저장 후 재조회한 body 의 sha256 이 봉투와 불일치 (FORBID-5)."""


class AdapterContractError(CrawlerError):
    """어댑터가 SourceAdapter 계약을 위반했다."""


class AdapterNotRegisteredError(CrawlerError):
    """미등록 source_id 로 어댑터를 조회했다."""


class PurgeError(CrawlerError):
    """파기 실행 실패 (티켓 부재 · 대상 부재)."""
