# DS4 — 시그니처 컴포넌트: 회당 단가 비교 카드 ★

> 계약 규격: [02-task-contract-spec.md](../02-task-contract-spec.md) §1
> 상태: 착수 대기 (DS3 완료 후) · ⛔G5 = **옵션 A** (shadcn/ui 기반)

## 설계 전제 — 이 컴포넌트는 "가격 신뢰"의 마지막 관문이다

C4 는 파싱 실패를 `unparseable` 로, 소스 간 30% 이상 불일치를 `conflict` 로, 신뢰도 미달을 저신뢰로
**비용을 들여 보존**한다. C7 은 그것을 공개/비공개로 판정한다. W3 는 화면 규격으로 강제한다.
그 모든 보존이 최종적으로 **픽셀에서 구분되지 않으면 전부 무의미하다.**

1. **상태는 4개이고 4개 전부 시각적으로 다르다.** 색상 단독 구분은 구분이 아니다 —
   색각 이상 사용자에게는 없는 것과 같다. 구분 축은 계약이 고정한다(구현자가 정하지 않는다).
2. **이 컴포넌트는 상태를 판정하지 않는다.** 판정의 단일 소스는 W 레이어의 `lib/price-state.ts` 이며,
   카드는 전달받은 discriminated union 을 **표시만** 한다.
3. **판정은 실제 브라우저 + 실제 CSS 번들에서 한다.** jsdom 은 CSS 를 적용하지 않으므로
   jsdom 스냅샷으로 "시각 구분"을 검사하면 그 검사는 언제나 통과하는 공허한 검사가 된다(R-7).

**기반 컴포넌트**: DS3 가 초기화한 shadcn/ui 프리미티브(Card · Badge)를 조합한다.
seed 레시피 CSS(`@seed-design/css/recipes/*`)와 `@seed-design/react` 는 사용하지 않는다(DS3-FORBID-2).

```yaml
# ─── 식별 ───────────────────────────────
id:            DS4-PRICE-COMPARE-CARD
dag_id:        DS4
title:         회당 단가 비교 카드 — 가격 상태 4종(확정 / 저신뢰 / 충돌 / 파싱실패) 시각 구분
workstream:    web
owner_agent:   dev-web

# ─── 존재 이유 ──────────────────────────
traces_to:     [H4, S1, KM-qualified-lead]
why:           "회당 단가를 비교 가능한 형태로 보여주는 유일한 표면이며, 여기서 미검증 가격이 확정가와
                같아 보이면 C4·C7·W3 가 지켜온 가격 신뢰가 화면 한 곳에서 통째로 붕괴한다."

# ─── DAG ────────────────────────────────
depends_on:    [DS3-BASE-WIRING]
blocks:        [DS5-CORE-COMPONENTS, DS7-PREVIEW-DOCS, W3-VENUE-DETAIL]
parallel_with: [DS6-A11Y-GATE]   # DS5 는 가격 영역을 본 태스크에 위임하므로 후행 (DS5 의 dag_amendment 참조)
gate:          null      # ⛔G5 는 DS0 산출로 해소됨(옵션 A). DS3 가 shadcn 기반을 이미 초기화했다

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
    - "PriceCompareCard — state 4종 discriminated union props (shadcn Card/Badge 기반)"
    - "PriceStateBadge — 비확정 상태 3종의 가시 배지"
    - "상태 4종 × 최소 4개 케이스가 등록된 *.cases.tsx"
    - "실브라우저 계산 스타일 기반 상태 구분 검사"
    - "conflict 부분집합 검사 · 숫자 미노출 검사 · 타입 소진 검사"

# ─── 공유 규약 (DS5 · DS6 와의 경계) ────
shared_contract:
  - "케이스 레지스트리 규약: `packages/ui/src/**/*.cases.tsx` 가 default export 로
     `{ id: string; name: string; render: () => ReactElement }[]` 를 export 한다.
     타입 정의 파일 `packages/ui/src/cases/types.ts` 는 DS4·DS5·DS6 중 **먼저 머지되는 PR** 이 생성하고,
     나중 PR 은 import 만 한다(수정 금지)."
  - "가격 상태 판정 로직은 본 태스크가 소유하지 않는다. W2·W3 가 공유하는 apps/web/src/lib/price-state.ts 가
     단일 소스이며, 본 컴포넌트는 그 판정 결과를 props 로 받는다."
  - "가격 상태 시각 토큰(color.price.* 12개)은 DS1 산출물이다. 본 태스크는 참조만 한다."

# ─── 요구사항 ───────────────────────────
requirements:
  - id: REQ-1
    statement: >
      PriceCompareCard 의 props 는 state 필드로 판별되는 discriminated union
      ('confirmed' | 'low_confidence' | 'conflict' | 'unparseable') 이며,
      5번째 상태를 추가하면 `tsc --noEmit` 이 소진성(exhaustiveness) 오류를 낸다.
    acceptance: "타입 메타 테스트 — `test/price/fixtures/fifth-state.fail.tsx` 포함 시 tsc exit ≠ 0, 제외 시 exit 0"

  - id: REQ-2
    statement: >
      4개 상태 각각의 렌더 결과 루트에 `data-price-state` 속성이 상태명과 동일한 값으로 존재하고,
      confirmed 를 제외한 3개 상태는 가시 텍스트를 가진 배지 노드를 1개 이상 렌더한다.
    acceptance: "`pnpm test:ds-price-card --check states` — 4케이스 속성값 일치 + 비확정 3케이스 배지 노드 ≥ 1 assert"

  - id: REQ-3
    statement: >
      실제 브라우저에서 앱 CSS 번들(seed base + brand + tailwind)이 로드된 상태로 렌더했을 때,
      (confirmed, X) 상태쌍 3개 각각이 background-color · border-color · border-width 중
      최소 2개 축에서 계산값이 다르고 배지 노드 유무가 다르다. (실환경 하한 REQ)
    acceptance: >
      Playwright 검사 `--check distinction` — 실 CSS 로드 상태에서 3쌍 전부
      (상이 축 수 ≥ 2 AND 배지 유무 상이) assert. jsdom 스냅샷은 판정 근거로 사용하지 않는다

  - id: REQ-4
    statement: >
      state 가 'unparseable' 또는 'low_confidence' 인 경우 회당 단가 슬롯
      (`[data-slot="price-per-session"]`)의 textContent 에 숫자 문자가 0개다.
    acceptance: "`pnpm test:ds-price-card --check no-number` — 두 케이스의 슬롯 텍스트가 정규식 `[0-9]` 에 매치되지 않음 assert"

  - id: REQ-5
    statement: >
      state 가 'conflict' 인 경우 렌더된 금액 숫자 집합이 props.candidates 의 amountKrw 값 집합의
      부분집합이며, 금액 노드 수 ≥ 2 · 소스명 노드 수 ≥ 2 · `data-emphasis="primary"` 노드 수 = 0 이다.
    acceptance: "`pnpm test:ds-price-card --check conflict` — 부분집합 판정 true + 3개 카운트 조건 전부 assert"

  - id: REQ-6
    statement: >
      실브라우저 렌더에서 state='confirmed' 의 회당 단가 숫자 노드 계산 font-size 가 24px 이상이다.
    acceptance: "Playwright 검사 — getComputedStyle(priceNode).fontSize 파싱값 ≥ 24 assert"

  - id: REQ-7
    statement: >
      본 컴포넌트의 4개 상태 케이스가 *.cases.tsx 에 등록되어 DS6 하네스에 자동 포함되며,
      `pnpm a11y:check` 가 해당 케이스들에 대해 위반 0건으로 종료한다.
    acceptance: "`pnpm a11y:check` exit 0 이고, 리포트의 검사 케이스 목록에 price 케이스 4건이 존재함 assert"

  - id: REQ-8
    statement: >
      컴포넌트 소스에 신뢰도 임계 숫자 리터럴(0.7 등)과 상태 추론 분기가 0건이며,
      fetch · packages/api · packages/db 에 대한 import 가 0건이다.
    acceptance: "`pnpm test:ds-price-card --check purity` — 숫자 임계 리터럴 grep 0건 + dependency-cruiser 규칙 `no-ui-to-data` 위반 0건"

# ─── 조건부 금지사항 ────────────────────
forbid:
  - id: FORBID-1
    when: >
      props.state 가 'confirmed' 가 아닌 값('low_confidence' | 'conflict' | 'unparseable')으로 전달된 경우
    must_not: >
      배지 없이 confirmed 와 동일한 배경·테두리로 렌더하거나, 카드 상단 대표가 슬롯
      (`[data-slot="headline-price"]`)에 그 값을 배치
    because: >
      C4 가 비용을 들여 보존한 "모름"이 화면에서 확정가처럼 보이면 사용자는 그 숫자를 믿고 전화를 건다.
      현장에서 다른 금액을 듣는 경험 한 번이 "가격이 틀린 사이트" 평판을 만들고, 데이터를 고쳐도
      평판은 회복되지 않는다. W3-VENUE-DETAIL 의 FORBID-1 이 화면 레벨에서 우회되는 지점이 정확히 여기다.
    detect: >
      REQ-3 의 실브라우저 `--check distinction` + `--check states` 회귀 테스트 +
      위반 픽스처(비확정 상태를 confirmed 스타일로 렌더하는 변형)가 반드시 실패하는 메타 테스트
    on_violation: block_merge

  - id: FORBID-2
    when: >
      props.state 가 undefined 이거나 union 밖의 문자열로 전달된 경우
    must_not: >
      'confirmed' 로 폴백하거나, confidence 숫자·금액 유무로부터 상태를 컴포넌트 내부에서 추론
    because: >
      상태 판정이 lib/price-state.ts 와 카드 두 곳에 존재하면 임계값을 한 번 조정할 때 한쪽만 바뀌고,
      같은 업체가 리스트에서는 확정가로 상세에서는 저신뢰로 보인다. 어느 쪽이 맞는지 판정할 근거가
      제품 안에 존재하지 않게 된다. 불명 입력은 반드시 가장 보수적인 상태로 강등해야 한다.
    detect: >
      단위테스트 — undefined · null · 빈문자열 · 오타 문자열 등 6종 입력에서
      data-price-state === 'unparseable' 이고 금액 슬롯 숫자 0건임을 assert
    on_violation: block_merge

  - id: FORBID-3
    when: >
      state='conflict' 의 candidates 배열(길이 ≥ 2)을 렌더할 때
    must_not: >
      평균·중앙값·최저값 등 candidates 에 존재하지 않는 숫자를 생성하거나 한쪽 값만 노출
    because: >
      어느 소스에도 없는 숫자가 화면에 생기면 사용자가 업체에 확인했을 때 어떤 값도 맞지 않는다.
      이는 단순 오차가 아니라 우리가 만들어낸 허위 정보이며, 정보 수정·삭제 요청(S5)과
      신뢰 붕괴로 직결된다.
    detect: >
      `pnpm test:ds-price-card --check conflict` — 렌더된 숫자 집합 ⊆ candidates 금액 집합 판정
      (평균값 생성 시 부분집합 판정 실패) + 금액/소스명 노드 수 ≥ 2 assert
    on_violation: block_merge

  - id: FORBID-4
    when: >
      카드 내부에서 seed·glowmate 토큰에 없는 색상·폰트 크기·간격 값이 필요해진 경우
    must_not: >
      Tailwind arbitrary value(`text-[13px]` · `bg-[#f5f5f5]`) · JSX `style` 속성 ·
      `--seed-color-palette-*` 원시 팔레트 변수 직접 참조로 값을 넣기
    because: >
      이 값들은 DS1 의 pairs.json 페어 매트릭스와 폰트 스케일 검사 밖이다. 대비 3:1 짜리 회색 캡션이나
      13px 부가 정보가 CI 초록 상태로 들어오고, 서비스의 시그니처 컴포넌트가 3050 가독성 기준을
      가장 먼저 깨는 곳이 된다. 팔레트 변수 직접 참조는 의미 계층을 건너뛰어 브랜드 교체에서도 누락된다.
    detect: >
      DS6-A11Y-GATE 의 린트 규칙(arbitrary value 금지 · style 속성 금지 · 팔레트 변수 직접 참조 금지)이
      packages/ui/src 에 적용되며, 위반 픽스처 `test/price/fixtures/arbitrary-value.tsx` 가
      반드시 lint 를 실패시키는 메타 테스트
    on_violation: block_merge

  - id: FORBID-5
    when: >
      props.category 가 'medical_wellness' 인 카드를 렌더할 때
    must_not: >
      시술명·진료항목명 문자열과 금액을 하나의 텍스트 노드로 결합해 출력하거나,
      최저가·할인율·타 업체 대비 표현을 렌더하는 변형을 제공
    because: >
      비급여 진료비의 비교·유인 표시는 의료광고법 규제 대상이며, 위반 시 메디컬 웰니스 축이 아니라
      서비스 전체가 중단될 수 있다(D4 가드레일). 컴포넌트가 결합 렌더 경로를 제공하면
      W3 의 렌더 스캔이 통과해도 다른 화면에서 그 경로가 쓰인다.
    detect: >
      `pnpm test:ds-price-card --check medical` — medical_wellness 픽스처 렌더 시 금액 노드와
      시술명 노드가 서로 다른 DOM 노드이고, 결합 문자열 및 D4 금칙어 사전 매칭이 0건임을 assert
      (D4 사전 파일 경로를 하드 참조해 사전 갱신 시 자동 재검사)
    on_violation: block_merge

  - id: FORBID-6
    when: >
      카드 구현에 필요한 가격 상태 토큰(예: color.price.conflict.stroke)이 존재하지 않는 경우
    must_not: >
      packages/ui/styles/** 를 이 PR 에서 수정해 토큰을 추가 (DS1 변경을 요청하고 본 태스크는 중단할 것)
    because: >
      컴포넌트 PR 에 섞여 들어온 토큰은 DS1 의 대비 페어 검사와 상태 중복 검사를 우회한다.
      확정가와 구분되지 않는 색이 그렇게 들어오면 REQ-3 의 "상이 축 ≥ 2" 는 통과하면서
      실제로는 사람 눈에 같은 색인 상태가 만들어진다. 롤백 단위도 엉킨다.
    detect: >
      CI path guard — 이 PR 의 diff 에 packages/ui/styles/** 가 포함되면 exit 1 +
      컴포넌트 소스의 `--seed-color-palette-*` 직접 참조 grep 0건
    on_violation: block_merge

# ─── 경계 ───────────────────────────────
out_of_scope:
  - "가격 상태 판정 규칙(임계값·conflict 기준) 정의 → C4-PRICE-NORMALIZER · C7-QUALITY-GATE 산출값과 W2·W3 의 lib/price-state.ts 소관"
  - "업체 상세 페이지 조립 · JSON-LD · API 연동 → W3-VENUE-DETAIL 소관"
  - "리스트 화면에서의 가격 요약 표기 → DS5-CORE-COMPONENTS 가 본 컴포넌트를 재사용"
  - "토큰 추가·수정 → DS1-TOKEN-LAYERS 소관"
  - "접근성 검사 하네스·린트 규칙 구현 → DS6-A11Y-GATE 소관 (본 태스크는 케이스 등록과 통과까지)"
  - "프리뷰/문서 페이지 → DS7-PREVIEW-DOCS 소관"
  - "가격 정렬·필터 로직 → W2-DISCOVERY-LIST 소관"
  - "환율·외화 표기 (MVP 비대상)"

rollback: >
  `git revert <merge-sha>` 로 packages/ui/src/components/price/** 와 테스트가 제거된다.
  DS7·W3 미머지 시점에는 소비자가 없어 하위 영향이 없다. W3 가 이미 머지된 뒤라면 상세 페이지 빌드가
  import 부재로 즉시 실패하므로 W3 배포를 직전 태그로 함께 되돌린다(부분 롤백 금지).
  cases/types.ts 를 본 PR 이 생성했다면 revert 시 DS5·DS6 의 케이스 파일이 타입 부재로 실패하므로,
  그 경우 types.ts 만 남기는 후속 커밋을 즉시 올린다.

done_when:
  - "`pnpm test:ds-price-card --all` 이 6개 서브체크 전부 exit 0"
  - "실브라우저(실 CSS 번들 로드) 기준 상태 4종 계산 스타일 비교표가 PR 본문에 첨부됨"
  - "`pnpm a11y:check` 리포트에 price 케이스 4건이 포함되고 위반 0건"
  - "FORBID-1~6 각각에 대응하는 위반 픽스처가 커밋되고 대응 검사를 실패시키는 것이 확인됨"
  - "타입 메타 테스트로 5번째 상태 추가 시 tsc 오류가 발생함을 확인"
  - "touches 경로 밖 변경 파일 0개 (CI path guard 통과)"
```
