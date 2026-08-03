# [FIXTURE] G5 판정

| axis | value | rule_id | 실측 |
|---|---|---|---|
| coverage | fail | DS0-RULE-COVERAGE-1 | 83.3% (기준 ≥ 90.0%) |

<!-- DS0-VERDICT-BEGIN -->
```json
{
  "verdict": "option_a",
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
      "value": "fail",
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
      "evidence_ref": "coverage.csv",
      "sha256": "193ea1af22afa7dc18fa51e2c68af0ac030a3fd2e2e6c0c7c8507e40ef95a411",
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

<!-- DS0-APPENDIX-MAPPING-BEGIN -->
| seed 토큰 키 | glowmate primitive | 쓰임 |
|---|---|---|
| `--fx-token-001` | `fx.primitive.1` | 합성 |
| `--fx-token-002` | `fx.primitive.2` | 합성 |
| `--fx-token-003` | `fx.primitive.3` | 합성 |
| `--fx-token-004` | `fx.primitive.4` | 합성 |
| `--fx-token-005` | `fx.primitive.5` | 합성 |
| `--fx-token-006` | `fx.primitive.6` | 합성 |
| `--fx-token-007` | `fx.primitive.7` | 합성 |
| `--fx-token-008` | `fx.primitive.8` | 합성 |
| `--fx-token-009` | `fx.primitive.9` | 합성 |
| `--fx-token-010` | `fx.primitive.10` | 합성 |
| `--fx-token-011` | `fx.primitive.11` | 합성 |
| `--fx-token-012` | `fx.primitive.12` | 합성 |
| `--fx-token-013` | `fx.primitive.13` | 합성 |
| `--fx-token-014` | `fx.primitive.14` | 합성 |
| `--fx-token-015` | `fx.primitive.15` | 합성 |
| `--fx-token-016` | `fx.primitive.16` | 합성 |
| `--fx-token-017` | `fx.primitive.17` | 합성 |
| `--fx-token-018` | `fx.primitive.18` | 합성 |
| `--fx-token-019` | `fx.primitive.19` | 합성 |
| `--fx-token-020` | `fx.primitive.20` | 합성 |
| `--fx-token-021` | `fx.primitive.21` | 합성 |
| `--fx-token-022` | `fx.primitive.22` | 합성 |
| `--fx-token-023` | `fx.primitive.23` | 합성 |
| `--fx-token-024` | `fx.primitive.24` | 합성 |
<!-- DS0-APPENDIX-MAPPING-END -->
