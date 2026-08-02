# DS4 — 시그니처 컴포넌트: 회당 단가 비교 카드 ★

> 계약 규격: [02-task-contract-spec.md](../02-task-contract-spec.md) §1 (원칙 2.5 · R-6 · R-7 포함)
> 상태: **재작성본 (2차 감사 REJECT 반영)** · ⛔G5 = 옵션 A (shadcn/ui 기반)
> 어휘 정본: [03-task-dag.md](../03-task-dag.md) "가격 상태 어휘 정본 (정정 #10)"

## 설계 전제 — 이 컴포넌트는 "가격 신뢰"의 마지막 관문이다

### 0. 어휘는 F6 것이고, 이 계약은 그것을 그대로 쓴다

2차 감사에서 이 계약이 REJECT 된 이유는 시각 규격이 아니라 **어휘였다.**
DS4가 `unparseable`(= C4 의 *가격 유형* 값)을 표시 상태 이름으로 재사용해, F6·W3 와 동시에 만족하는 구현이
존재하지 않는 상태였다. 정본은 아래 두 축이며 **섞지 않는다.**

| 축 | 소유 | 값 |
|---|---|---|
| 가격 유형 | `C4-PRICE-NORMALIZER` | `per_session` · `period_pass` · `single_session` · `unparseable` |
| **표시 상태 (본 컴포넌트가 받는 값)** | `F6-PRICE-STATE` | **`confirmed` · `conflict` · `low_confidence` · `unavailable`** |

- `unparseable`(유형) ≠ `unavailable`(표시). 전자는 파싱 실패, 후자는 숫자를 못 내보내는 모든 사유의 합집합이다.
- `period_pass` 라도 **확정 가격이면 `confirmed`** 다. 회당 환산 불가를 이유로 `unavailable` 로 접으면
  기간권 업체의 가격이 영구히 표시되지 않는다(원칙 2.5 위반).
- **표시 상태의 단일 판정 소스는 `@glowmate/price-state`(F6) 다.** 본 컴포넌트는 소비만 하며
  판정도, 매핑도, 추론도 하지 않는다. `showNumeric` · `badgeKey` · `reasonKey` 역시 F6 가 산출한다.

> **F6 는 Phase 2(C4 의존)라 본 태스크의 `depends_on` 이 될 수 없다.** 그래서 이 계약은 어휘를
> **문서 레벨에서 정본에 고정**하고(REQ-1), F6 머지 후 타입 소스를 `@glowmate/price-state` 로 교체하는
> 후속 PR 을 done_when 에 상신 항목으로 남긴다. 그 사이에 매핑 테이블을 만드는 것은 FORBID-2 로 막는다.

### 1. 정확성이 시각 구분보다 앞선다

2차 감사가 찾아낸 가장 큰 구멍은 "미공개만 렌더"가 아니라 그 반대였다 —
**렌더된 금액이 props 금액과 같아야 한다는 요구가 없었다.** `Math.round(amount * 0.9)` 를 렌더해도
전 REQ 가 통과했다. REQ-5 가 그것을 막는다.

### 2. 구분은 4상태 상호 간이다

`(confirmed, X)` 3쌍만 보면 `conflict` 와 `unavailable` 을 똑같이 그려도 통과한다.
C4 가 8종 `failure_reason` 을 폐쇄 enum 으로 보존한 비용이 화면에서 1비트로 붕괴한다. → **6쌍 전부**(REQ-4).

### 3. 판정은 실제 브라우저 + 실제 CSS 번들에서 한다

jsdom 은 CSS 를 적용하지 않으므로 jsdom 스냅샷으로 "시각 구분"을 검사하면 언제나 통과하는 공허한 검사가 된다(R-7).

**기반 컴포넌트**: DS3 가 초기화한 shadcn/ui 프리미티브(Card · Badge) 조합.
seed 레시피 CSS 와 `@seed-design/react` 는 사용하지 않는다(DS3 FORBID-2).

```yaml
# ─── 식별 ───────────────────────────────
id:            DS4-PRICE-COMPARE-CARD
dag_id:        DS4
title:         회당 단가 비교 카드 — 표시 상태 4종(confirmed / conflict / low_confidence / unavailable) 시각 구분 + 금액 원본 결속
workstream:    web
owner_agent:   dev-web

# ─── 존재 이유 ──────────────────────────
traces_to:     [H4]
why:           "회당 단가를 비교 가능한 형태로 보여주는 유일한 표면이며, 여기서 금액이 원본과 어긋나거나
                미검증 가격이 확정가와 같아 보이면 C4·C7·F6·W3 가 지켜온 가격 신뢰가 화면 한 곳에서 붕괴한다."

# ─── DAG ────────────────────────────────
depends_on:    [DS3-BASE-WIRING, DS6-A11Y-GATE, D4-MEDICAL-AD-GUARDRAIL]
blocks:        [DS5-CORE-COMPONENTS, DS7-PREVIEW-DOCS, W3-VENUE-DETAIL]
parallel_with: [W1-SEO-FOUNDATION]
gate:          null      # ⛔G5 는 DS0 산출로 해소됨(옵션 A)

# ⚠ dag_amendment (팀 리드 승인 필요) — 2건
#   (1) DS6-A11Y-GATE 를 parallel_with → depends_on 으로 승격.
#       REQ-4 의 실브라우저 하네스, FORBID-4 의 lint 규칙, done_when 의 a11y:check 가 전부 DS6 산출물이다.
#       병렬로 두면 DS4 가 먼저 머지될 때 detect 2건과 acceptance 1건이 "존재하지 않는 명령"이 되어
#       공허하게 통과한다(2차 감사 P3).
#   (2) D4-MEDICAL-AD-GUARDRAIL 을 depends_on 에 추가.
#       FORBID-5 · REQ-8 이 D4 의 판정 함수(packages/legal/medical/src/index.ts)와
#       정본 발행물(packages/legal/medical/dist/exported_rules.json)을 호출한다. 대상 부재 시 공허 통과.
#   F6-PRICE-STATE 는 Phase 2 라 의존 불가 — 어휘를 문서 레벨에서 고정하는 것으로 대체한다(REQ-1).

# ─── 산출물 ─────────────────────────────
deliverable:
  pr_count:    1
  touches:
    - packages/ui/src/components/price/**              # PriceCompareCard · PriceRow · PriceStateBadge
    - packages/ui/src/components/price/*.cases.tsx     # 케이스 레지스트리 (DS6 하네스가 자동 탐색)
    - packages/ui/src/cases/types.ts                   # ↓ 공유 규약 참조
    - packages/ui/test/price/**
    - packages/ui/test/price/fixtures/**
  artifacts:
    - "PriceCompareCard — 정본 4상태 discriminated union props (shadcn Card/Badge 기반)"
    - "PriceStateBadge — 비확정 3상태의 가시 배지 (badgeKey → 문구 매핑 테이블은 본 태스크 소유)"
    - "상태 4종 × 동일 데이터 구성 케이스 4건이 등록된 *.cases.tsx"
    - "금액 원본 결속 검사 · 상태쌍 6개 시각 구분 검사(실브라우저) · conflict 부분집합 검사"
    - "medical_wellness 정상 표시 하한 검사 (D4 판정 함수 호출)"

# ─── 공유 규약 ──────────────────────────
shared_contract:
  - "케이스 레지스트리 규약: `packages/ui/src/**/*.cases.tsx` 가 default export 로
     `{ id: string; name: string; render: () => ReactElement }[]` 를 export 한다.
     `packages/ui/src/cases/types.ts` 는 DS4·DS5·DS6 중 **먼저 머지되는 PR** 이 생성하고
     나중 PR 은 import 만 한다(수정 금지)."
  - "표시 상태 판정·표시 규칙(showNumeric · badgeKey · reasonKey)의 단일 소스는 `@glowmate/price-state`(F6) 다.
     본 컴포넌트는 그 산출값을 props 로 받아 표시만 한다.
     **F6 머지 후 props 타입을 F6 export 타입으로 교체하는 후속 PR 을 상신한다**(done_when 참조)."
  - "가격 상태 시각 토큰(color.price.{confirmed,conflict,low_confidence,unavailable}.{fg,bg,stroke} 12개)은
     DS1 산출물이다. 본 태스크는 참조만 한다."
  - "medical 표기 판정의 정본은 D4 의 `packages/legal/medical/dist/exported_rules.json` 이며,
     인용은 `rule_id` 문자열로만 한다(파일명·자연어 인용 금지). 판정은 `packages/legal/medical/src/index.ts`
     의 함수 호출로 수행하고 사전 raw grep 을 하지 않는다."

# ─── 요구사항 ───────────────────────────
requirements:
  - id: REQ-1
    statement: >
      PriceCompareCard 의 state prop 유니온 리터럴 집합이 정본 4개
      {confirmed, conflict, low_confidence, unavailable} 와 문자열 단위로 정확히 일치한다.
    acceptance: >
      `pnpm test:ds-price-card --check vocabulary` — 유니온 리터럴 집합과 정본 배열(테스트에 하드코딩)의
      대칭차집합 = 0 assert + `test/price/fixtures/fifth-state.fail.tsx` 포함 시 `tsc --noEmit` exit ≠ 0
      (소진성 분기 부재 시 실패)

  - id: REQ-2
    statement: >
      4개 상태 각각의 렌더 결과 루트에 `data-price-state` 속성이 상태명과 동일한 값으로 존재한다.
    acceptance: "`pnpm test:ds-price-card --check states` — 4케이스 속성값 일치 assert, 검사 케이스 수를 stdout 출력(4 미만이면 exit 1)"

  - id: REQ-3
    statement: >
      비확정 3상태(conflict · low_confidence · unavailable) 각각이 가시 텍스트를 가진 배지 노드를
      1개 이상 렌더하고, 3상태의 배지 텍스트가 서로 다르다.
    acceptance: "`pnpm test:ds-price-card --check badge` — 3케이스 각각 배지 노드 ≥ 1 + 배지 텍스트 3개의 고유값 수 = 3 assert"

  - id: REQ-4
    statement: >
      실제 브라우저에서 앱 CSS 번들이 로드된 상태로 **동일 금액·동일 소스 수 구성**의 4상태 케이스를
      렌더했을 때, 상태쌍 6개 전부가 background-color · border-color · border-width 중
      최소 2개 축에서 계산값이 다르다. (실환경 하한 REQ · R-7)
    acceptance: >
      Playwright `--check distinction` — 6쌍 전부 상이 축 수 ≥ 2 assert.
      케이스 입력의 금액·소스 수가 4상태에서 동일함을 사전 assert(시각 차이가 데이터 차이에서 오는 것을 차단).
      jsdom 스냅샷은 판정 근거로 사용하지 않는다

  - id: REQ-5
    statement: >
      props.showNumeric 이 true 인 상태에서 회당 단가 슬롯(`[data-slot="price-per-session"]`)의
      텍스트에서 숫자 외 문자를 제거해 정수로 파싱한 값이 props.pricePerSession 과 정확히 일치한다.
    acceptance: >
      `pnpm test:ds-price-card --check amount-binding` — 금액 픽스처 12건(만 단위 경계·6자리·7자리 포함)
      전건 정수 일치 assert, 검사 건수 stdout 출력(0 이면 exit 1)

  - id: REQ-6
    statement: >
      props.showNumeric 이 false 인 상태 전건에서 회당 단가 슬롯의 textContent 에 숫자 문자가 0개다.
    acceptance: "`pnpm test:ds-price-card --check no-number` — showNumeric=false 케이스 수를 stdout 출력(0 이면 exit 1), 각 케이스 슬롯 텍스트가 정규식 `[0-9]` 에 매치되지 않음 assert"

  - id: REQ-7
    statement: >
      state 가 'conflict' 인 경우 렌더된 금액 숫자 집합이 props.candidates 의 amountKrw 값 집합의
      부분집합이며 금액 노드 수 ≥ 2 · 소스명 노드 수 ≥ 2 · `data-emphasis="primary"` 노드 수 = 0 이다.
    acceptance: "`pnpm test:ds-price-card --check conflict` — 부분집합 판정 true + 3개 카운트 조건 assert (금액 노드 0개면 부분집합이 자명 참이 되므로 ≥2 하한이 함께 요구된다)"

  - id: REQ-8
    statement: >
      category='medical_wellness' 이고 D4 판정 함수가 `show` 를 반환하는 고신뢰 픽스처 8건 전건에서
      금액 노드가 렌더된다. (숨김 FORBID 의 짝 · 원칙 2.5)
    acceptance: "`pnpm test:ds-price-card --check medical-render` — D4 `src/index.ts` 판정이 show 인 8건 전건에서 금액 노드 존재 assert, show 판정 건수가 8 미만이면 픽스처 오류로 exit 1"

# ─── 조건부 금지사항 ────────────────────
forbid:
  - id: FORBID-1
    when: >
      props.state 가 'confirmed' 가 아닌 값(conflict · low_confidence · unavailable)으로 전달된 경우
    must_not: >
      배지 없이 confirmed 와 동일한 배경·테두리로 렌더하거나, 카드 상단 대표가 슬롯
      (`[data-slot="headline-price"]`)에 그 값을 배치
    because: >
      C4·F6 가 비용을 들여 보존한 "확정되지 않음"이 화면에서 확정가처럼 보이면 사용자는 그 숫자를 믿고
      전화를 건다. 현장에서 다른 금액을 듣는 경험 한 번이 "가격이 틀린 사이트" 평판을 만들고,
      데이터를 고쳐도 평판은 회복되지 않는다. W3-VENUE-DETAIL 의 FORBID-1 이 화면 레벨에서
      우회되는 지점이 정확히 여기다.
    detect: >
      REQ-4 의 실브라우저 `--check distinction`(6쌍) + REQ-3 `--check badge` +
      위반 픽스처 `test/price/fixtures/nonconfirmed-as-confirmed.tsx` 가 반드시 두 검사를 실패시키는 메타 테스트
    on_violation: block_merge

  - id: FORBID-2
    when: >
      props.state 가 undefined 이거나 정본 4개 리터럴 밖의 문자열로 전달된 경우,
      또는 표시 상태를 다른 어휘(C4 의 price_unit_type 값 포함)로 변환해야 하는 상황이 발생한 경우
    must_not: >
      'confirmed' 로 폴백하거나, confidence 숫자·금액 유무로부터 상태를 추론하거나,
      컴포넌트 안에 상태 매핑 테이블(예: unparseable → unavailable)을 신설
      (불명 입력은 'unavailable' 로 강등하고, 어휘 변환이 필요하면 F6 변경을 요청할 것)
    because: >
      판정이나 매핑이 카드 안에 생기면 F6 가 막으려던 이중 판정이 그대로 재발명된다. 임계값이나
      어휘를 한 번 조정할 때 한쪽만 바뀌고, 같은 업체가 리스트에서는 확정가로 상세에서는 저신뢰로 보인다.
      어느 쪽이 맞는지 판정할 근거가 제품 안에 존재하지 않게 된다.
      (입력 검증 강등 분기는 이 금지의 **예외**이며 REQ-1 소진성 분기와 함께 허용된다)
    detect: >
      단위테스트 — undefined · null · 빈문자열 · 'unparseable' · 'estimated' · 오타 6종 입력에서
      data-price-state === 'unavailable' 이고 금액 슬롯 숫자 0건임을 assert +
      AST 규칙 `no-state-derivation` — props.state 외의 값에서 상태 리터럴을 산출하는 표현식
      (객체 리터럴 매핑 · switch on 다른 필드 · 조건식) 0건
    on_violation: block_merge

  - id: FORBID-3
    when: >
      state='conflict' 의 candidates 배열(길이 ≥ 2)을 렌더할 때
    must_not: >
      평균·중앙값·최저값 등 candidates 에 존재하지 않는 숫자를 생성하거나 한쪽 값만 노출
    because: >
      어느 소스에도 없는 숫자가 화면에 생기면 사용자가 업체에 확인했을 때 어떤 값도 맞지 않는다.
      이는 오차가 아니라 우리가 만들어낸 허위 정보이며 정보 수정·삭제 요청(S5)과 신뢰 붕괴로 직결된다.
    detect: >
      REQ-7 `--check conflict` — 렌더 숫자 집합 ⊆ candidates 금액 집합 + 금액/소스명 노드 수 ≥ 2
      (평균값 생성 시 부분집합 판정 실패, 0개 렌더 시 하한 실패)
    on_violation: block_merge

  - id: FORBID-4
    when: >
      카드 내부에서 seed·glowmate 토큰에 없는 색상·폰트 크기·간격 값이 필요해진 경우
    must_not: >
      Tailwind arbitrary value(`text-[13px]` · `bg-[#f5f5f5]`) · JSX `style` 속성 ·
      `--seed-color-palette-*` 원시 팔레트 변수 직접 참조로 값을 넣기
    because: >
      이 값들은 DS1 의 pairs.json 페어 매트릭스와 폰트 스케일 검사 밖이다. 대비 3:1 회색 캡션이나
      13px 부가 정보가 CI 초록 상태로 들어오고, 서비스의 시그니처 컴포넌트가 3050 가독성 기준을
      가장 먼저 깨는 곳이 된다. 팔레트 변수 직접 참조는 의미 계층을 건너뛰어 브랜드 교체에서도 누락된다.
    detect: >
      DS6-A11Y-GATE 가 제공하는 eslint 규칙 5종(`packages/config/eslint.design-system.cjs`)이
      packages/ui/src 에 적용되며, 위반 픽스처 `test/price/fixtures/arbitrary-value.tsx` 가
      반드시 lint 를 실패시키는 메타 테스트 (DS6 를 depends_on 으로 승격했으므로 머지 시점에 규칙이 실재한다)
    on_violation: block_merge

  - id: FORBID-5
    when: >
      props.category 가 'medical_wellness' 이고 D4 판정 함수가 해당 표기에 대해
      `hide` 또는 `needs_review` 를 반환하는 경우
    must_not: >
      금액 노드를 렌더하거나, 시술명·진료항목명 문자열과 금액을 하나의 텍스트 노드로 결합해 출력
    because: >
      비급여 진료비의 비교·유인 표시는 의료광고법 규제 대상이며, 위반 시 메디컬 웰니스 축이 아니라
      서비스 전체가 중단될 수 있다. 반대로 사전 전체를 무차별 grep 해 과차단하면 D4 가 `applies_to`
      스코핑으로 설계한 판정 체계를 어기고 정상 표시까지 사라진다(REQ-8 과 짝을 이룬다).
    detect: >
      `pnpm test:ds-price-card --check medical-guard` — D4 `packages/legal/medical/src/index.ts` 판정이
      hide/needs_review 인 픽스처 8건에서 금액 노드 0건 assert + 금액 노드와 시술명 노드가 서로 다른
      DOM 노드임을 assert. 판정은 함수 호출로만 수행하며 lexicon raw grep 을 사용하지 않는다
      (사용 시 메타 테스트가 실패)
    on_violation: block_merge

  - id: FORBID-6
    when: >
      카드 구현에 필요한 가격 상태 토큰이 DS1 산출물에 존재하지 않는 경우
    must_not: >
      packages/ui/styles/** 를 이 PR 에서 수정해 토큰을 추가 (DS1 변경을 요청하고 본 태스크는 중단할 것)
    because: >
      컴포넌트 PR 에 섞여 들어온 토큰은 DS1 의 대비 페어 검사와 상태 구분 검사를 우회한다.
      확정가와 구분되지 않는 색이 그렇게 들어오면 REQ-4 의 "상이 축 ≥ 2" 는 통과하면서
      실제로는 사람 눈에 같은 색인 상태가 만들어진다. 롤백 단위도 엉킨다.
    detect: >
      CI path guard — 이 PR 의 diff 에 packages/ui/styles/** 가 포함되면 exit 1 +
      컴포넌트 소스의 `--seed-color-palette-*` 직접 참조 grep 0건
    on_violation: block_merge

# ─── 경계 ───────────────────────────────
out_of_scope:
  - "표시 상태 판정 · showNumeric/badgeKey/reasonKey 산출 → F6-PRICE-STATE 소관 (본 태스크는 소비만 한다)"
  - "가격 유형(per_session·period_pass·single_session·unparseable) 분류 → C4-PRICE-NORMALIZER 소관"
  - "업체 상세 페이지 조립 · JSON-LD · API 연동 → W3-VENUE-DETAIL 소관"
  - "리스트 화면 가격 요약 → DS5-CORE-COMPONENTS 가 본 컴포넌트를 재사용"
  - "토큰 추가·수정 → DS1-TOKEN-LAYERS 소관"
  - "medical 표기 규칙 정의 → D4-MEDICAL-AD-GUARDRAIL 소관 (본 태스크는 판정 함수를 호출만 한다)"
  - "접근성 검사 하네스·린트 규칙 구현 → DS6-A11Y-GATE 소관"
  - "프리뷰/문서 페이지 → DS7-PREVIEW-DOCS 소관"
  - "가격 정렬·필터 로직 → W2-DISCOVERY-LIST 소관 / 환율·외화 표기 (MVP 비대상)"

rollback: >
  `git revert <merge-sha>` 로 packages/ui/src/components/price/** 와 테스트가 제거된다.
  DS5·DS7·W3 미머지 시점에는 소비자가 없어 하위 영향이 없다. W3 가 이미 머지된 뒤라면 상세 페이지 빌드가
  import 부재로 즉시 실패하므로 W3 배포를 직전 태그로 함께 되돌린다(부분 롤백 금지).
  cases/types.ts 를 본 PR 이 생성했다면 revert 시 DS5·DS6 케이스가 타입 부재로 실패하므로,
  그 경우 types.ts 만 남기는 후속 커밋을 즉시 올린다.

done_when:
  - "`pnpm test:ds-price-card --all` 이 8개 서브체크 전부 exit 0"
  - "유니온 리터럴이 03-task-dag.md 정본 4개와 일치함을 검사 로그로 확인 (C4 유형 값 미사용)"
  - "금액 원본 결속 검사 12건 · medical show 판정 8건 · showNumeric=false 케이스 수가 stdout 에 출력되고 전부 0 초과"
  - "실브라우저(실 CSS 번들) 기준 4상태 6쌍 계산 스타일 비교표가 PR 본문에 첨부됨"
  - "`pnpm a11y:check` 리포트에 price 케이스 4건 포함, 위반 0건 (회당 단가 숫자 24px 하한은 DS1 constraints.minHeadlinePricePx 로 집행)"
  - "FORBID-1~6 각각에 대응하는 위반 픽스처가 커밋되고 대응 검사를 실패시키는 것이 확인됨"
  - "**상신**: F6-PRICE-STATE 머지 후 props 타입을 `@glowmate/price-state` export 로 교체하는 후속 PR 을 팀 리드에 등록"
  - "touches 경로 밖 변경 파일 0개 (CI path guard 통과)"
```
