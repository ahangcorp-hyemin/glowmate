"""봉투·추출 스키마 로딩과 검증.

`jsonschema` 로 검증한다. 검증 실패는 예외이며, "일단 저장하고 나중에 고친다"는 경로를
두지 않는다 — 봉투가 깨진 채 저장되면 그 원문은 C4 재처리 대상에서 조용히 빠진다.
"""

from __future__ import annotations

import json
from importlib import resources
from typing import Any

from jsonschema import Draft202012Validator

ENVELOPE_SCHEMA_NAME = "source_envelope.schema.json"
EXTRACTED_SCHEMA_NAME = "extracted.schema.json"


def _load(name: str) -> dict[str, Any]:
    text = resources.files(__package__).joinpath(name).read_text(encoding="utf-8")
    return json.loads(text)


ENVELOPE_SCHEMA: dict[str, Any] = _load(ENVELOPE_SCHEMA_NAME)
EXTRACTED_SCHEMA: dict[str, Any] = _load(EXTRACTED_SCHEMA_NAME)

#: 리포 기준 경로 (README·CI 스크립트가 인용한다)
ENVELOPE_SCHEMA_PATH = f"services/crawler/core/crawler/contracts/{ENVELOPE_SCHEMA_NAME}"
EXTRACTED_SCHEMA_PATH = f"services/crawler/core/crawler/contracts/{EXTRACTED_SCHEMA_NAME}"

_ENVELOPE_VALIDATOR = Draft202012Validator(ENVELOPE_SCHEMA)
_EXTRACTED_VALIDATOR = Draft202012Validator(EXTRACTED_SCHEMA)


def envelope_errors(payload: object) -> list[str]:
    return [
        f"{'/'.join(str(p) for p in e.absolute_path) or '<root>'}: {e.message}"
        for e in _ENVELOPE_VALIDATOR.iter_errors(payload)
    ]


def extracted_errors(payload: object) -> list[str]:
    return [
        f"{'/'.join(str(p) for p in e.absolute_path) or '<root>'}: {e.message}"
        for e in _EXTRACTED_VALIDATOR.iter_errors(payload)
    ]


def validate_envelope(payload: object) -> None:
    errors = envelope_errors(payload)
    if errors:
        raise ValueError("source_envelope 스키마 위반:\n  " + "\n  ".join(errors))


def validate_extracted(payload: object) -> None:
    errors = extracted_errors(payload)
    if errors:
        raise ValueError("extracted 스키마 위반:\n  " + "\n  ".join(errors))


def build_envelope(
    *,
    blob_key: str,
    body_sha256: str,
    http_status: int,
    final_url: str,
    headers: dict[str, str],
    crawl_run_id: str,
    adapter_version: str,
    source_id: str,
    requested_url: str | None = None,
    body_bytes: int | None = None,
    fetched_at: str | None = None,
    extracted: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """봉투를 만들고 즉시 검증한다. 검증을 통과한 dict 만 반환된다."""
    envelope: dict[str, Any] = {
        "blob_key": blob_key,
        "body_sha256": body_sha256,
        "http_status": int(http_status),
        "final_url": final_url,
        "headers": {str(k).lower(): str(v) for k, v in headers.items()},
        "crawl_run_id": crawl_run_id,
        "adapter_version": adapter_version,
        "source_id": source_id,
    }
    if requested_url is not None:
        envelope["requested_url"] = requested_url
    if body_bytes is not None:
        envelope["body_bytes"] = int(body_bytes)
    if fetched_at is not None:
        envelope["fetched_at"] = fetched_at
    if extracted is not None:
        validate_extracted(extracted)
        envelope["extracted"] = extracted
    validate_envelope(envelope)
    return envelope
