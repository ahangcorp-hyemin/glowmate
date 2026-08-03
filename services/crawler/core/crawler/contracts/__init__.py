"""어댑터 공용 계약 3종의 공개 import 경로 (REQ-6).

    from crawler.contracts import SourceAdapter, FetchTarget, ExtractedRecord
    from crawler.contracts import ENVELOPE_SCHEMA, EXTRACTED_SCHEMA
    from crawler.contracts import validate_envelope, validate_extracted

레지스트리는 `crawler.registry`, 계약 스위트는 `crawler.adapter_contract_suite` 다.
이 경로들은 C2·C3 및 파생 어댑터 태스크가 그대로 import 하므로 **개명하지 않는다.**
"""

from __future__ import annotations

from .adapter import (
    ExtractedRecord,
    FetchTarget,
    SourceAdapter,
    adapter_id_of,
    adapter_version_of,
)
from .schemas import (
    ENVELOPE_SCHEMA,
    ENVELOPE_SCHEMA_PATH,
    EXTRACTED_SCHEMA,
    EXTRACTED_SCHEMA_PATH,
    build_envelope,
    envelope_errors,
    extracted_errors,
    validate_envelope,
    validate_extracted,
)

__all__ = [
    "ENVELOPE_SCHEMA",
    "ENVELOPE_SCHEMA_PATH",
    "EXTRACTED_SCHEMA",
    "EXTRACTED_SCHEMA_PATH",
    "ExtractedRecord",
    "FetchTarget",
    "SourceAdapter",
    "adapter_id_of",
    "adapter_version_of",
    "build_envelope",
    "envelope_errors",
    "extracted_errors",
    "validate_envelope",
    "validate_extracted",
]
