# [FIXTURE] G5 판정

| axis | value | rule_id | 실측 |
|---|---|---|---|
| coverage | pass | DS0-RULE-COVERAGE-1 | 91.7% (기준 ≥ 90.0%) |

<!-- DS0-VERDICT-BEGIN -->
```json
{
  "verdict": "option_b",
  "verdict_rule_id": "DS0-RULE-G5-1",
  "decided_at_utc": "2026-08-03",
  "axes": {
    "license": {
      "value": "pass",
      "rule_id": "DS0-RULE-LICENSE-1",
      "evidence_ref": "snapshots/license/EXAMPLE-LICENSE.txt"
    },
    "ssr_compat": {
      "value": "pass",
      "rule_id": "DS0-RULE-SSR-1",
      "evidence_ref": "probe/logs/build.log"
    },
    "coverage": {
      "value": "pass",
      "rule_id": "DS0-RULE-COVERAGE-1",
      "evidence_ref": "coverage.csv"
    },
    "token_extractability": {
      "value": "pass",
      "rule_id": "DS0-RULE-TOKEN-1",
      "evidence_ref": "extracted_tokens.json"
    }
  },
  "evidence": [
    {
      "axis": "license",
      "evidence_ref": "snapshots/license/EXAMPLE-LICENSE.txt",
      "sha256": "ef9956b39243684ac9469bd8b17fe003bbb0f19776ffd9b18cfa695b0a2b493f",
      "source": "https://example.invalid/EXAMPLE-LICENSE.txt"
    },
    {
      "axis": "ssr_compat",
      "evidence_ref": "probe/logs/build.log",
      "sha256": "ba12ef29da3419543292ec8a0248d7676ae351807cf05123259e5a34635e00a4",
      "source": "example-ds/react@1.0.0"
    },
    {
      "axis": "ssr_compat",
      "evidence_ref": "probe/logs/nojs.html",
      "sha256": "efb0fbdc5fbcdb8f6486eb657f50ba59d2dc1d0fee830f08761ec126dcff7ccc",
      "source": "example-ds/react@1.0.0"
    },
    {
      "axis": "coverage",
      "evidence_ref": "coverage-DELETED.csv",
      "sha256": "8b2e05c174f883d2578c448f9d851265c1fc73c0b6c139412854a44a46d233d6",
      "source": "example-ds/react@1.0.0"
    },
    {
      "axis": "token_extractability",
      "evidence_ref": "extracted_tokens.json",
      "sha256": "70a61dc8aca5ec89f02e79a492c2001fa0a8d4856770330eef1d131b3a6c724b",
      "source": "example-ds/css@1.0.0"
    }
  ]
}
```
<!-- DS0-VERDICT-END -->

# 부록

<!-- DS0-APPENDIX-FALLBACK-BEGIN -->
| 부재 컴포넌트 | 대체 계획 |
|---|---|
| Card | 자체 구현 (합성 픽스처의 대체 계획 셀) |
<!-- DS0-APPENDIX-FALLBACK-END -->
