# DS0 검사기 탐지력 픽스처

> `node scripts/design-system/validate_ds0.mjs --selftest` (그리고 `--all`) 이 이 트리를 사용한다.

## 왜 있는가

**검사기가 존재하는 것과 위반을 잡는 것은 다른 문제다.** `--check` 서브커맨드가 9개 있어도
그 중 하나가 조용히 통과만 하고 있으면 대응하는 FORBID 는 장식이다.
그래서 매 실행마다 **의도적 위반이 실제로 non-zero 로 잡히는지**를 증명한다.

## 변별력 — 통과만 확인하지 않는다

각 위반 픽스처는 두 가지를 동시에 만족해야 selftest 를 통과한다.

1. 대상 검사가 **그 픽스처에서 non-zero** 여야 한다 (미탐 방지)
2. **같은 검사가 baseline 에서는 exit 0** 이어야 한다 (오탐 방지 / 변별력)

2번이 없으면 "언제나 실패하는 검사"도 만점을 받는다.
baseline 2종은 **전 9개 검사를 통과**해야 하며, 하나라도 실패하면 selftest 가 실패한다.

## 트리

| 디렉터리 | 검사 | 대응 | 심어 둔 위반 |
|---|---|---|---|
| `baseline-option-a/` | 전 9종 | — | 없음 (정상 트리, coverage 83.3% → option_a) |
| `baseline-option-b/` | 전 9종 | — | 없음 (정상 트리, coverage 91.7% → option_b) |
| `forbid1-option-b-missing-evidence/` | `--check verdict` | FORBID-1 | option_b 인데 coverage 축 근거 파일이 실재하지 않음 |
| `forbid2-image-only-evidence/` | `--check evidence` | FORBID-2 | pass 축의 근거가 스크린샷(.png) 하나뿐 |
| `forbid3-vendored-source/` | `--check no-vendored` | FORBID-3 | option_a 인데 배제된 상류 컴포넌트 소스의 표지를 가진 파일이 남아 있음 |
| `forbid4-unclear-license-with-tokens/` | `--check license` | FORBID-4 | `redistribution=unclear` 인데 `extraction_allowed=true` + 토큰 커밋 |
| `forbid5-rule-tampered/` | `--check rule-lock` | FORBID-5 | 잠금 이후 커버리지 임계를 90.0% → 75.0% 로 낮춤 (sha256 불일치) |
| `forbid5-lock-after-measurement/` | `--check rule-lock` | FORBID-5 | 내용은 정상이나 **커밋 순서**가 뒤집힘 (실측이 먼저, rule.lock 이 나중) |

## 합성 데이터다 — 상류 자산을 담지 않는다

이 트리의 라이선스 원문·토큰·컴포넌트 이름·로그는 전부 **합성값**이다
(`example-ds/*`, `--fx-token-*`, `FX-PROBE-*`). 판정 근거로 인용해서는 안 된다.

`forbid3-vendored-source/vendored/action-button.tsx` 는 벤더링된 소스의 **표지만** 흉내 낸
4줄짜리 합성 파일이며 상류 코드를 복사한 것이 아니다. 이 파일이 없으면 FORBID-3 의 탐지력을
증명할 방법이 없다.

## `forbid5-lock-after-measurement` 가 다른 픽스처와 다른 점

이 픽스처만은 **git 이력 자체가 위반**이므로 파일 내용으로는 재현할 수 없다.
따라서 실제로 커밋 순서를 뒤집어 커밋했다 —
실측 산출물(`coverage.csv` 등)을 먼저 커밋하고, `verdict_rule.md` + `rule.lock` 을 그 다음 커밋에 넣었다.

```bash
git log --diff-filter=A --format='%ct %H %s' -- \
  docs/design-system/DS0/__fixtures__/forbid5-lock-after-measurement/rule.lock \
  docs/design-system/DS0/__fixtures__/forbid5-lock-after-measurement/coverage.csv
```

## 이 트리가 사각지대가 아닌 이유

리포 전체를 스캔하는 `--check no-vendored`(기본 root)는 이 트리를 제외한다.
위반을 의도적으로 담고 있으므로 제외하지 않으면 **자기 PR 이 자기 픽스처 때문에 red** 가 된다(P7 자기차단).

대신 `--selftest` 가 **픽스처 루트를 직접 지정해** 같은 검사를 돌린다.
즉 이 트리는 "검사되지 않는 곳"이 아니라 "다른 모드로 검사되는 곳"이다.
(`.github/ci-fixtures/**` 를 eslint ignores 에 두고 별도 런에서 평가하는 F1 의 방식과 같다.)
