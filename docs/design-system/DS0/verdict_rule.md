# DS0 / G5 판정 룰 — 실측 **이전에** 고정된다

> 계약: [`docs/tasks/DS0.md`](../../tasks/DS0.md) · REQ-1 · FORBID-5
> 이 파일은 `rule.lock` 에 sha256 으로 잠긴다. **잠긴 뒤에는 통과 기준을 고칠 수 없다.**
> 검증: `node scripts/design-system/validate_ds0.mjs --check rule-lock`

---

## 0. 이 파일이 먼저 존재해야 하는 이유

G5 는 "seed-design 컴포넌트를 직접 채택(option_b)할 것인가 / 토큰만 추출하고 컴포넌트는
직접 소유(option_a)할 것인가"를 가르는 **한 번뿐인 분기**이고, DS3~DS7 의 구현 방식 전부가 여기에 매달려 있다.

측정한 뒤에 기준을 정하면 그 기준은 "측정 결과"가 아니라 **"원하는 결론에 맞춘 숫자"**가 된다.
그래서 이 파일은 실측 산출물(`ssr_probe` 로그 · `coverage.csv` · `extracted_tokens.json`)보다
**앞선 커밋**으로 존재해야 하며, 그 순서 자체를 `validate_ds0.mjs --check rule-lock` 이 git 이력에서 검증한다.

## 0.1 사전 지식 고지 (숨기지 않는다)

이 룰의 작성자는 작성 시점에 선행 조사 보고서 [`docs/ds0-seed-design-실사.md`](../../ds0-seed-design-실사.md)(2026-08-03)를
읽은 상태였다. 즉 **완전한 블라인드 출제가 아니다.** 이 사실을 숨기면 룰 잠금 자체가 형식이 되므로 명시한다.

그 대신 아래 두 가지를 지킨다.

1. 각 임계값에는 **선행 보고서의 결론과 무관하게 성립하는 근거**를 붙인다 (§2 각 축의 "임계 근거").
   근거가 "그래야 원하는 답이 나오니까"인 임계는 하나도 없다.
2. **측정 정의는 관대한 쪽으로 고정한다.** 특히 커버리지에서 이름이 다른 동등물(alias)과
   하위 패키지 제공분을 전부 `present` 로 인정한다(§2.3). 측정 정의를 좁혀 충족률을 낮추는 방식으로
   결론을 만들 수 없게 하기 위한 것이다. 임계는 고정하되, 그 임계를 **넘기 쉬운 쪽으로** 측정 정의를 연다.

## 0.2 이 파일이 잠그는 것 / 잠그지 않는 것

| 잠근다 (수정 시 `--check rule-lock` 이 non-zero) | 잠그지 않는다 |
|---|---|
| 4개 축의 pass 기준과 임계값 | 실측값 그 자체 |
| 측정 정의(무엇을 세는가, 무엇을 present 로 인정하는가) | 근거 파일의 내용·개수 |
| hydration 경고로 셀 메시지 패턴 목록 | 판정 이후의 후속 계획(DS1·DS3 분기) |
| 축 판정 → G5 판정 매핑 | 부록(매핑표·대체계획표)의 행 구성 |

---

## 1. 판정 축과 rule_id

| axis | rule_id | 한 줄 기준 |
|---|---|---|
| `license` | `DS0-RULE-LICENSE-1` | 상업적 사용 · 수정 · 재배포 3항목이 **전부 `allowed`** 여야 pass |
| `ssr_compat` | `DS0-RULE-SSR-1` | `next build` exit 0 **그리고** hydration 경고 0건 **그리고** JS 비활성 HTML 에 probe 컴포넌트 라벨 전건 노출 |
| `coverage` | `DS0-RULE-COVERAGE-1` | 필요 컴포넌트 12종 충족률 **≥ 90.0%** (= 결손 1종 이하) |
| `token_extractability` | `DS0-RULE-TOKEN-1` | 재실행 가능한 단일 커맨드로 추출한 토큰 리프 **≥ 50개** 이고 `extraction_allowed=true` |

부속 룰:

| rule_id | 대상 |
|---|---|
| `DS0-RULE-EVIDENCE-1` | 근거 형식 요건 (FORBID-2) |
| `DS0-RULE-EVIDENCE-2` | option_b 의 근거 실재 요건 (FORBID-1) |
| `DS0-RULE-G5-1` | 축 판정 → G5 판정 매핑 |

---

## 2. 축별 통과 기준

### 2.1 `license` — `DS0-RULE-LICENSE-1`

**pass 기준 문장:** `license.md` 의 `commercial_use` · `modification` · `redistribution` 세 항목이
**모두 `allowed`** 일 때에만 이 축은 `pass` 다. 하나라도 `denied` 또는 `unclear` 면 `fail` 이다.

- 판정값 enum: `allowed` | `denied` | `unclear` (3개 외 값·빈 값은 판정 불가 = fail)
- 근거는 **LICENSE/NOTICE 원문 스냅샷 파일**이어야 한다. 요약문·블로그·배지 이미지는 근거로 인정하지 않는다(`DS0-RULE-EVIDENCE-1`).
- 원문은 **저장소 커밋 SHA 40자로 고정된 URL**에서 취득하고, 스냅샷 파일의 sha256 을 함께 기록한다.

**임계 근거 (이진값인 이유):** 라이선스는 정도 문제가 아니다. `unclear` 를 pass 로 취급하면
"확인하지 못했다"가 "허용된다"와 같은 값이 되고, 그 차이는 배포·색인이 끝난 뒤에만 드러난다.
`unclear` 를 fail 로 두는 것은 되돌리는 비용이 작은 쪽(option_a)으로 기울이기 위한 의도적 비대칭이다.

### 2.2 `ssr_compat` — `DS0-RULE-SSR-1`

**pass 기준 문장:** Next.js App Router 최소 재현 앱에서 seed-design 컴포넌트를 **5종 이상** 서버 컴포넌트
트리에 렌더했을 때, ① `next build` 종료 코드 == 0, ② hydration mismatch 경고 == **0건**,
③ JS 비활성 HTML 에 노출된 probe 라벨 수 == probe 컴포넌트 수(즉 **누락 0**) 세 조건이
**전부** 성립할 때에만 `pass` 다.

측정 정의 (잠금):

- **컴포넌트 수** = `probe/manifest.json` 의 `components[]` 길이. 각 항목은 서버 컴포넌트 트리에서
  실제로 렌더되는 seed-design 컴포넌트 1종을 가리키며 고유 `label` 문자열을 가진다.
- **build_exit_code** = `probe/logs/build.log` 마지막의 `DS0_PROBE_BUILD_EXIT=<n>` 라인.
  이 라인은 빌드 실행기가 기록하며, 로그 본문에는 `next build` 원문 출력이 그대로 남는다.
- **hydration_mismatch_warnings** = `probe/logs/console.log` 의 라인 중 아래 패턴 하나 이상에
  매칭되는 라인 수 (대소문자 무시). 패턴 목록은 이 파일에 잠긴다 — 사후에 좁힐 수 없다.
  - `hydration failed`
  - `there was an error while hydrating`
  - `text content does not match`
  - `did not match`
  - `didn't match`
  - `hydration-mismatch`
  - `hydration error`
- **js_disabled_label_hits** = `probe/logs/nojs.html`(JS 실행 없이 HTTP 로 받은 원문)에서
  `probe/manifest.json` 의 각 `label` 문자열이 **문자 그대로** 발견된 개수.

**임계 근거 (경고 0건인 이유):** 최소 재현 앱은 페이지가 1장이다. 그 1장에서 나오는 hydration
mismatch 는 제품에서는 모든 페이지에서 나온다. "몇 건까지 허용"은 규모가 커지면 곱해지는 값이므로
최소 재현 단위에서는 0 이 유일하게 의미 있는 상한이다.

**임계 근거 (라벨 누락 0인 이유):** 이 제품의 유통 경로는 검색이다. JS 를 실행하지 않는 크롤러가
받는 HTML 에 텍스트가 하나라도 빠지면 그 컴포넌트가 놓인 화면은 색인에서 그만큼 비어 보인다.
부분 노출을 허용할 근거가 없다.

**컴포넌트 5종 하한 근거:** 계약 REQ-3 이 지정한 하한이며, 1~2종만 렌더하면 "우연히 동작한 것"과
"체계가 SSR 을 지원하는 것"을 구분할 수 없다. 5종은 서로 다른 하위 패키지에서 온 컴포넌트를
섞도록 요구하는 실질적 하한이다.

### 2.3 `coverage` — `DS0-RULE-COVERAGE-1`

**pass 기준 문장:** 웹 데스크톱 필요 컴포넌트 12종
(Button, Card, Badge, Chip, Input, Select, Checkbox, Radio, Tabs, Dialog, Tooltip, Pagination) 중
`present=true` 인 비율이 **90.0% 이상**일 때에만 `pass` 다. 12종 기준으로 이는 **결손 1종 이하**를 뜻한다.

측정 정의 (잠금 — 관대한 쪽으로 고정한다):

- 판정 원천은 **`@seed-design/react` 의 npm tarball 실물**이다. 문서 사이트·블로그·스크린샷은 원천이 아니다.
- 다음 중 하나면 `present=true` 로 인정한다.
  1. 패키지 최상위 export 심볼로 존재 (evidence_ref = 심볼명)
  2. tarball 내부 경로로 존재 (evidence_ref = `lib/components/<Name>/...` 형태의 경로)
  3. **이름이 다른 동등물(alias)** 이 위 1·2 로 존재하고, 동일한 UI 역할을 수행 (evidence_ref = 그 심볼명)
  4. **하위 패키지(`@seed-design/react-*`)** 를 통해 제공 (evidence_ref = `패키지명@버전` 또는 그 심볼명)
- 충족률 = `present=true 행수 / 12 × 100`, 소수 첫째 자리까지 비교한다.

**임계 근거 (90.0% 인 이유):** 이 12종은 "있으면 좋은 것"이 아니라 목록·상세·비교 화면의 골격이며,
계약이 **필요 컴포넌트**로 지정한 집합이다. 컴포넌트 레이어를 한 라이브러리에서 가져온다는 것은
이 골격을 그 라이브러리의 규약(스타일 주입 방식·slot 구조·상태 API) 위에 세운다는 뜻이다.

- **100% 를 요구하지 않는 이유:** 어떤 라이브러리도 한 제품의 필요 목록을 전부 덮지 않는다.
  1종 결손은 그 라이브러리 규약 위에서 1개를 직접 만들면 되므로 채택을 무효화하지 않는다.
- **75% 같은 낮은 값을 쓰지 않는 이유:** 3종 이상 결손이면 골격의 1/4 을 라이브러리 **밖에서**
  소유하게 된다. 그 순간 두 개의 컴포넌트 체계(라이브러리 규약 + 자체 규약)를 동시에 유지해야 하고,
  이것은 "컴포넌트 레이어를 어디서 가져올지 하나로 정한다"는 G5 의 목적 자체를 무효화한다.
- 12개 항목에서 결손 1종(11/12 = 91.7%)과 결손 2종(10/12 = 83.3%) 사이의 유일한 절단점이 90.0% 다.

### 2.4 `token_extractability` — `DS0-RULE-TOKEN-1`

**pass 기준 문장:** ① `token_extraction.md` 에 **재실행 가능한 단일 커맨드 문자열**이 기재되어 있고,
② 그 결과인 `extracted_tokens.json` 의 리프 토큰 수가 **50개 이상**이며,
③ 각 리프가 **원본 키 경로와 원본 값 문자열을 그대로** 보존하고,
④ `token_extraction.md` 의 `extraction_allowed` 가 `true` 일 때에만 `pass` 다.

- `extraction_allowed=true` 는 `license` 축 3항목이 전부 `allowed` 일 때에만 기록할 수 있다 (FORBID-4).
- "원본 그대로"의 판정: 각 리프는 `original_key`(추출 원본에서의 키 문자열)와
  `original_value`(추출 원본에서의 값 문자열)를 가진다. 리네이밍·단위 변환·색공간 변환 결과를
  `original_value` 에 기록하면 이 축은 fail 이다.

**임계 근거 (50개인 이유):** 계약 REQ-5 가 지정한 하한이다. 토큰 체계는 색/치수/타이포/모션의
최소 조합만으로도 수십 개가 나오므로, 50개 미만이면 "체계를 가져온 것"이 아니라
"몇 개 값을 베낀 것"이다. 후자는 DS1 의 3계층 설계를 지탱하지 못한다.

---

## 3. 근거 형식 요건

### 3.1 `DS0-RULE-EVIDENCE-1` (FORBID-2)

모든 evidence 항목은 **(리포 상대 파일 경로 · sha256 · 취득 URL 또는 패키지 버전)** 3요소를 갖는다.
확장자가 `png` · `jpg` · `jpeg` · `webp` · `gif` · `pdf` 인 파일이 **유일 근거**인 축은 `pass` 를 받을 수 없다.

**근거:** 이 워크스트림의 원천은 코드다. 2차 자료로 판정하면 실제 패키지에 없는 컴포넌트를
있다고 세게 되고, 부풀려진 충족률이 option_b 를 만든 뒤 DS3 구현 단계에서야 부재가 드러난다.

### 3.2 `DS0-RULE-EVIDENCE-2` (FORBID-1)

verdict 가 `option_b` 인 경우, 4개 축 **전부**에 대해 evidence_ref 가 비어 있지 않고
그 경로의 파일이 실재해야 한다. 1건이라도 누락이면 `option_b` 를 기록할 수 없다.

**근거:** 미확인 상태의 채택은 되돌리는 비용이 가장 큰 방향이다. 미확인은 option_a 쪽으로 기울인다.

---

## 4. G5 판정 매핑 — `DS0-RULE-G5-1`

```
option_b  ⟺  license=pass ∧ ssr_compat=pass ∧ coverage=pass
option_a  ⟺  위가 거짓
```

- 이 3축은 PRD §4 의 G5 조건 3가지(SSR 동작 · 라이선스 · 데스크톱 웹 커버)와 1:1 대응한다.
- `token_extractability` 는 **option_a 의 성립 조건**이다. 위 3축 중 하나라도 fail 이어서 option_a 로
  기울었는데 `token_extractability` 마저 fail 이면, 두 옵션 모두 성립하지 않는 상태다.
  이때는 **verdict 를 기록하지 않는다** — `validate_ds0.mjs --check verdict` 는 이 상태를
  통과가 아니라 **판정 불가(exit 1)** 로 처리하고, G5 는 `undecided` 로 남는다.
- verdict enum 은 `option_a` | `option_b` 2개뿐이다. 세 번째 값을 만들어 회피할 수 없다.

---

## 5. 기계 판독용 룰 블록

아래 블록이 `validate_ds0.mjs` 의 **유일한** 임계값 원천이다. 검사기는 임계를 하드코딩하지 않고
이 블록을 읽는다. 따라서 이 파일을 고치면 `rule.lock` 과 sha256 이 어긋나 `--check rule-lock` 이 non-zero 가 된다.

<!-- DS0-RULES-BEGIN -->
```json
{
  "rule_set_version": 1,
  "frozen_at_utc": "2026-08-03",
  "axes": {
    "license": {
      "rule_id": "DS0-RULE-LICENSE-1",
      "items": ["commercial_use", "modification", "redistribution"],
      "enum": ["allowed", "denied", "unclear"],
      "pass_requires_all": "allowed"
    },
    "ssr_compat": {
      "rule_id": "DS0-RULE-SSR-1",
      "min_components": 5,
      "required_build_exit_code": 0,
      "max_hydration_mismatch_warnings": 0,
      "required_label_hit_ratio": 1.0,
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
        "Button", "Card", "Badge", "Chip", "Input", "Select",
        "Checkbox", "Radio", "Tabs", "Dialog", "Tooltip", "Pagination"
      ],
      "min_ratio_percent": 90.0,
      "ratio_decimals": 1
    },
    "token_extractability": {
      "rule_id": "DS0-RULE-TOKEN-1",
      "min_leaf_tokens": 50,
      "required_leaf_fields": ["original_key", "original_value"],
      "requires_extraction_allowed": true
    }
  },
  "evidence": {
    "rule_id": "DS0-RULE-EVIDENCE-1",
    "required_fields": ["evidence_ref", "sha256", "source"],
    "secondary_source_extensions": ["png", "jpg", "jpeg", "webp", "gif", "pdf"]
  },
  "evidence_for_option_b": {
    "rule_id": "DS0-RULE-EVIDENCE-2",
    "requires_all_axes_evidence_exists": true
  },
  "verdict_mapping": {
    "rule_id": "DS0-RULE-G5-1",
    "option_b_requires_pass": ["license", "ssr_compat", "coverage"],
    "option_a_requires_pass": ["token_extractability"],
    "enum": ["option_a", "option_b"]
  }
}
```
<!-- DS0-RULES-END -->

---

## 6. 재판정 트리거

이 판정은 영구적이지 않다. 아래 중 하나가 참이 되면 G5 를 재판정한다.

- 실사 기준일(2026-08-03)로부터 **12주 경과**
- `@seed-design/css` 의 **메이저 버전 변경**
- `coverage.csv` 의 결손 컴포넌트가 상류에서 추가되어 충족률이 90.0% 이상이 되는 경우

재판정 시에도 **이 파일을 고치지 않는다.** 새 룰이 필요하면 `verdict_rule.md` 를 대체하는 것이 아니라
`rule_set_version` 을 올린 새 파일과 새 lock 을 만들고, 이전 판정과의 차이를 명시한다.
