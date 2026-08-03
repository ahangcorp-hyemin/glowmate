"""REQ-6 — adapter_contract_suite 15 케이스.

`pytest services/crawler/tests/core/test_adapter_contract.py` → passed=15, skipped=0

★ 이 파일에는 파라미터라이즈된 계약 테스트 **하나만** 둔다. 다른 테스트를 여기 추가하면
   계약 acceptance 의 `passed=15` 가 깨진다. 레지스트리·규약 검사는 test_registry.py 에 있다.
"""

from __future__ import annotations

import importlib.util
import sys

import pytest

from _helpers import REFERENCE_ADAPTER, SAMPLE_VENUE
from crawler.adapter_contract_suite import (
    CONTRACT_CASE_COUNT,
    CONTRACT_CASES,
    AdapterContractContext,
    run_contract_case,
)


def _load_reference_adapter():
    spec = importlib.util.spec_from_file_location(
        "glowmate_reference_adapter", REFERENCE_ADAPTER
    )
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module.ADAPTER


@pytest.mark.parametrize("case", CONTRACT_CASES, ids=[c.id for c in CONTRACT_CASES])
def test_adapter_contract(case, fixture_allowlist) -> None:
    assert len(CONTRACT_CASES) == CONTRACT_CASE_COUNT
    ctx = AdapterContractContext(
        adapter=_load_reference_adapter(),
        allowlist=fixture_allowlist,
        sample_body=SAMPLE_VENUE.read_bytes(),
    )
    run_contract_case(case, ctx)
