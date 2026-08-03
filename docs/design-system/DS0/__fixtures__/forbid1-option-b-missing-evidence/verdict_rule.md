# [FIXTURE] DS0 판정 룰 — 검사기 탐지력 증명용 합성 트리

> ⚠ 이 트리는 `scripts/design-system/validate_ds0.mjs --selftest` 전용 **합성 픽스처**다.
> 실제 판정 근거가 아니며, 상류 자산을 담지 않는다. 임계와 rule_id 는 정본과 동일하게 유지해
> "정상 픽스처는 통과하고 위반 픽스처만 실패한다"는 변별력을 측정할 수 있게 한다.

## 2.1 license — `DS0-RULE-LICENSE-1`

**pass 기준 문장:** 3항목(commercial_use · modification · redistribution)이 전부 `allowed` 일 때에만 pass 다.

## 2.2 ssr_compat — `DS0-RULE-SSR-1`

**pass 기준 문장:** 컴포넌트 5종 이상 · build exit 0 · hydration 경고 0 · JS 비활성 HTML 라벨 누락 0 일 때에만 pass 다.

## 2.3 coverage — `DS0-RULE-COVERAGE-1`

**pass 기준 문장:** 필요 컴포넌트 12종의 충족률이 90.0% 이상일 때에만 pass 다.

## 2.4 token_extractability — `DS0-RULE-TOKEN-1`

**pass 기준 문장:** 재실행 가능한 커맨드로 추출한 리프가 50개 이상이고 extraction_allowed=true 일 때에만 pass 다.

## 5. 기계 판독용 룰 블록

<!-- DS0-RULES-BEGIN -->
```json
{
  "rule_set_version": 1,
  "frozen_at_utc": "2026-08-03",
  "axes": {
    "license": {
      "rule_id": "DS0-RULE-LICENSE-1",
      "items": [
        "commercial_use",
        "modification",
        "redistribution"
      ],
      "enum": [
        "allowed",
        "denied",
        "unclear"
      ],
      "pass_requires_all": "allowed"
    },
    "ssr_compat": {
      "rule_id": "DS0-RULE-SSR-1",
      "min_components": 5,
      "required_build_exit_code": 0,
      "max_hydration_mismatch_warnings": 0,
      "required_label_hit_ratio": 1,
      "hydration_patterns": [
        "hydration failed",
        "there was an error while hydrating",
        "text content does not match",
        "did not match",
        "didn't match",
        "hydration-mismatch",
        "hydration error"
      ]
    },
    "coverage": {
      "rule_id": "DS0-RULE-COVERAGE-1",
      "required_components": [
        "Button",
        "Card",
        "Badge",
        "Chip",
        "Input",
        "Select",
        "Checkbox",
        "Radio",
        "Tabs",
        "Dialog",
        "Tooltip",
        "Pagination"
      ],
      "min_ratio_percent": 90,
      "ratio_decimals": 1
    },
    "token_extractability": {
      "rule_id": "DS0-RULE-TOKEN-1",
      "min_leaf_tokens": 50,
      "required_leaf_fields": [
        "original_key",
        "original_value"
      ],
      "requires_extraction_allowed": true
    }
  },
  "evidence": {
    "rule_id": "DS0-RULE-EVIDENCE-1",
    "required_fields": [
      "evidence_ref",
      "sha256",
      "source"
    ],
    "secondary_source_extensions": [
      "png",
      "jpg",
      "jpeg",
      "webp",
      "gif",
      "pdf"
    ]
  },
  "evidence_for_option_b": {
    "rule_id": "DS0-RULE-EVIDENCE-2",
    "requires_all_axes_evidence_exists": true
  },
  "verdict_mapping": {
    "rule_id": "DS0-RULE-G5-1",
    "option_b_requires_pass": [
      "license",
      "ssr_compat",
      "coverage"
    ],
    "option_a_requires_pass": [
      "token_extractability"
    ],
    "enum": [
      "option_a",
      "option_b"
    ]
  }
}
```
<!-- DS0-RULES-END -->
