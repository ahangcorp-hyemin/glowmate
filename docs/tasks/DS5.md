# DS5 — 코어 컴포넌트 (업체 카드 · 니즈 태그 칩 · 필터 바 · 리스트)

> 계약 규격: [02-task-contract-spec.md](../02-task-contract-spec.md) §1
> 상태: 착수 대기 (DS3 완료 후) · ⛔G5 = **옵션 A** (shadcn/ui 기반)

## 설계 전제

강남언니형 **정보 밀도 높은 카드 리스트 · 필터 칩** 패턴을 seed 토큰 위에서 shadcn/ui 프리미티브로 구현한다.
레퍼런스는 관찰 대상일 뿐 코드 원천이 아니며, 산출물은 `import` 해서 쓰는 파일이다.
DS0 실사에서 seed 에 `Card` · `Table` · `Pagination` 이 전무함이 확인되었으므로(실사 §2.3),
이 카테고리는 shadcn 프리미티브 조합으로 직접 소유한다.

두 가지 경계가 이 태스크의 핵심이다.

1. **가격은 DS4 컴포넌트로만 그린다.** VenueCard 가 가격을 자체 포맷하는 순간 상태 구분 구현이 2개가 되고,
   리스트에서는 저신뢰 가격이 확정가처럼 보이는 사고가 상세와 무관하게 발생한다.
2. **태그 목록은 컴포넌트가 소유하지 않는다.** 니즈 태그의 단일 소스는 F4 온톨로지이며,
   칩은 props 로 받은 것만 그린다.

```yaml
# ─── 식별 ───────────────────────────────
id:            DS5-CORE-COMPONENTS
dag_id:        DS5
title:         코어 컴포넌트 — VenueCard · NeedsTagChip · FilterBar · VenueList
workstream:    web
owner_agent:   dev-web

# ─── 존재 이유 ──────────────────────────
traces_to:     [H5, S2, H4]
why:           "니즈 태그로 좁혀 보는 경험(H5)과 리스트에서의 가격 인지(H4)를 구성하는 최소 부품이 없으면
                W2·W5·W7 화면이 각자 카드를 만들게 되고 필터 사용률 측정이 UI 편차로 오염된다."

# ─── DAG ────────────────────────────────
depends_on:    [DS3-BASE-WIRING, DS4-PRICE-COMPARE-CARD]   # ⚠ DAG 수정 제안 — 아래 dag_amendment 참조
blocks:        [DS7-PREVIEW-DOCS, W2-DISCOVERY-LIST, W5-EDITOR-REPORT, W7-CORRECTION-REQUEST]
parallel_with: [DS6-A11Y-GATE]

# ⚠ dag_amendment (팀 리드 승인 필요)
#   03-task-dag.md 는 DS4 ‖ DS5 로 병렬 배치한다. 그러나 REQ-2·FORBID-1 이 "VenueCard 의 가격 영역은
#   DS4 컴포넌트로만 렌더한다"를 강제하므로, DS4 미머지 상태에서는 VenueCard 가 가격을 렌더할 수단이 없고
#   REQ-2 acceptance 가 구조적으로 불가능하다. 병렬을 유지하려면 DS5 가 자체 가격 렌더를 갖게 되는데,
#   그것이 정확히 FORBID-1 이 막으려는 상태다.
#   → DAG 에 DS4 → DS5 간선 추가를 제안한다. 승인 전까지는 DS4 머지 완료를 착수 조건으로 본다.
gate:          null      # ⛔G5 는 DS0 산출로 해소됨(옵션 A)

# ─── 산출물 ─────────────────────────────
deliverable:
  pr_count:    1
  touches:
    - packages/ui/src/components/venue/**              # VenueCard
    - packages/ui/src/components/tag/**                # NeedsTagChip
    - packages/ui/src/components/filter/**             # FilterBar
    - packages/ui/src/components/list/**               # VenueList
    - packages/ui/src/components/{venue,tag,filter,list}/*.cases.tsx
    - packages/ui/src/cases/types.ts                   # ↓ 공유 규약 참조
    - packages/ui/test/core/**
    - packages/ui/test/core/fixtures/**
  artifacts:
    - "코어 컴포넌트 4종 (shadcn Card/Badge/Button 프리미티브 조합)"
    - "컴포넌트별 최소 3개 상태 케이스가 등록된 *.cases.tsx"
    - "실브라우저 기준 선택 상태 비색상 구분 검사"
    - "태그 하드코딩 부재 검사 · SSR 카드 수 검사 · 가시 레이블 검사"

# ─── 공유 규약 (DS4 · DS6 와의 경계) ────
shared_contract:
  - "케이스 레지스트리 규약: `packages/ui/src/**/*.cases.tsx` 가 default export 로
     `{ id: string; name: string; render: () => ReactElement }[]` 를 export 한다.
     `packages/ui/src/cases/types.ts` 는 DS4·DS5·DS6 중 **먼저 머지되는 PR** 이 생성하고
     나중 PR 은 import 만 한다(수정 금지)."
  - "VenueCard 의 가격 영역은 DS4-PRICE-COMPARE-CARD 의 컴포넌트를 import 해 렌더한다."

# ─── 요구사항 ───────────────────────────
requirements:
  - id: REQ-1
    statement: >
      4개 컴포넌트 각각이 최소 3개 상태 케이스를 *.cases.tsx 에 등록하고(총 12케이스 이상),
      `pnpm a11y:check` 가 해당 케이스 전부에 대해 위반 0건으로 종료한다.
    acceptance: "`pnpm a11y:check` exit 0 + 리포트의 케이스 목록에 4개 컴포넌트 각각 ≥ 3건 존재 assert"

  - id: REQ-2
    statement: >
      VenueCard 의 가격 영역은 DS4 컴포넌트를 import 해 렌더하며,
      components/venue 소스 내 가격 상태 문자열 리터럴('confirmed' 등)과 금액 포맷 함수 정의가 0건이다.
    acceptance: "`pnpm test:ds-core --check price-delegation` — DS4 import 존재 assert + 상태 문자열/포맷 함수 grep 0건"

  - id: REQ-3
    statement: >
      packages/ui/src 전체에 니즈 태그 슬러그·라벨 배열 리터럴이 0건이며,
      NeedsTagChip 목록에 빈 배열을 전달하면 렌더되는 칩 수가 0 이다.
    acceptance: "`pnpm test:ds-core --check tag-source` — 태그 배열 리터럴 grep 0건 + 빈 배열 렌더 시 칩 노드 수 = 0 assert"

  - id: REQ-4
    statement: >
      실제 브라우저에서 앱 CSS 번들이 로드된 상태로 렌더했을 때 FilterBar 의 선택 항목은
      aria-pressed(또는 aria-checked) 값이 비선택 항목과 다르고, 계산 스타일이 border-width 또는
      표식 노드 유무 중 최소 1개 축에서 색상과 무관하게 다르다. (실환경 하한 REQ)
    acceptance: "Playwright 검사 `--check selection` — 실 CSS 로드 상태에서 aria 속성 상이 + 비색상 축 상이 ≥ 1 assert"

  - id: REQ-5
    statement: >
      4개 컴포넌트의 모든 인터랙티브 요소가 가시 텍스트 노드를 1개 이상 포함한다(아이콘 단독 요소 0건).
    acceptance: "`pnpm test:ds-core --check label` — 등록 케이스 전수에서 인터랙티브 노드마다 접근 가능한 이름 + 가시 텍스트 노드 존재 assert"

  - id: REQ-6
    statement: >
      VenueList 에 20건을 전달했을 때 서버 렌더 HTML 문자열에 카드 루트 노드가 20개 포함된다
      (클라이언트 지연 렌더 0건).
    acceptance: "`pnpm test:ds-core --check ssr-count` — renderToString 결과의 `data-component=\"venue-card\"` 매칭 수 = 20 assert"

  - id: REQ-7
    statement: >
      4개 컴포넌트 소스에 fetch · packages/api · packages/db · 상태관리 스토어 import 가 0건이며,
      모든 데이터는 props 로만 주입된다.
    acceptance: "CI job `boundary` — dependency-cruiser 규칙 `no-ui-to-data` 위반 0건 + fetch 호출 grep 0건"

# ─── 조건부 금지사항 ────────────────────
forbid:
  - id: FORBID-1
    when: >
      VenueCard 가 회당 단가 또는 가격 미공개 문구를 표시해야 하는 경우
    must_not: >
      DS4 컴포넌트를 우회해 price_per_session 숫자를 자체 포맷·렌더하거나
      자체 상태 분기(if confidence < …)를 구현
    because: >
      가격 상태의 시각 구분 구현이 리스트와 상세 두 곳에 생기면, 한쪽만 수정된 시점부터
      같은 업체가 리스트에서는 확정가로 보이고 상세에서는 저신뢰로 보인다. 사용자는 리스트 숫자를 믿고
      전화를 걸고, W6 이 계측할 "가격 블록 노출 코호트"(H4)의 정의 자체가 어긋나 가설 판정이 불가능해진다.
    detect: >
      `pnpm test:ds-core --check price-delegation` — VenueCard 렌더 트리의 `data-price-state` 노드가
      DS4 컴포넌트에서만 생성되는지 검증 + 상태 문자열/금액 포맷 함수 grep 0건
    on_violation: block_merge

  - id: FORBID-2
    when: >
      니즈 태그의 슬러그 목록이나 한국어 라벨이 컴포넌트에서 필요해진 경우
    must_not: >
      태그 슬러그·라벨 배열을 컴포넌트 소스에 하드코딩하거나 F4 온톨로지 패키지를 packages/ui 에서 import
    because: >
      F4 온톨로지가 갱신되면 UI 만 옛 태그를 계속 보여준다. W2 가 강제하는
      "UI 태그 집합 = 온톨로지 집합" 검사가 packages/ui 를 경유해 우회되고,
      존재하지 않는 태그로 필터한 세션이 집계되어 필터 사용률(H5) 측정이 오염된다.
    detect: >
      `pnpm test:ds-core --check tag-source` — 태그 배열 리터럴 grep 0건 +
      빈 배열 전달 시 칩 0개 렌더 assert(내장 목록이 있으면 실패) +
      dependency-cruiser 로 packages/ui → F4 온톨로지 패키지 import 금지
    on_violation: block_merge

  - id: FORBID-3
    when: >
      FilterBar 칩 또는 리스트 항목의 선택 상태를 표현할 때
    must_not: >
      배경색·글자색 변경만으로 선택 상태를 구분 (테두리 굵기 변화 · 체크 표식 · aria 속성 중
      최소 1개를 함께 변경할 것)
    because: >
      색상 단독 구분은 색각 이상 사용자와 대비 감도가 낮아진 4050 사용자에게는 구분이 없는 것과 같다.
      선택했는지 알 수 없으면 필터를 껐다 켰다 반복하거나 아예 쓰지 않게 되고,
      H5(필터 사용률 25%)가 가설의 문제인지 UI 결함인지 구분할 수 없는 숫자로 나온다.
    detect: >
      REQ-4 의 실브라우저 `--check selection` — 선택/비선택 케이스 간 aria 속성 상이 +
      border-width 또는 표식 노드 유무 중 최소 1개 축 상이 assert (jsdom 판정 금지)
    on_violation: block_merge

  - id: FORBID-4
    when: >
      VenueList 가 20건 이상의 항목을 렌더하는 경우
    must_not: >
      가상 스크롤 · IntersectionObserver 지연 렌더 · 클라이언트 페이지네이션으로
      첫 HTML 의 카드 수를 전달받은 항목 수보다 적게 만들기
    because: >
      첫 HTML 에 업체명과 가격이 없으면 검색 엔진이 수집하지 못한다. 채널 1순위가 SEO 인 제품에서
      이는 색인 규모(H3) 자체를 깎아먹고, W2 의 "JS 비활성 HTML 에 20건 노출" 요구가
      컴포넌트 레벨에서 미리 깨진 상태로 전달된다.
    detect: >
      `pnpm test:ds-core --check ssr-count` — renderToString 결과 카드 노드 수 = 입력 수 assert +
      가상 스크롤 라이브러리(react-window · virtua · react-virtuoso) 의존성 허용목록 위반 검사
    on_violation: block_merge

  - id: FORBID-5
    when: >
      전화 · 지도 · 저장 · 공유 등 액션 요소를 컴포넌트에 추가하는 경우
    must_not: >
      가시 텍스트 레이블 없이 아이콘 단독 변형(variant)을 제공
    because: >
      3050 대상 사용자는 아이콘 관용구 해석 실패율이 높다. North Star 인 리드 액션이 아이콘 단독이면
      눌리지 않고, W6 의 계측 결과가 "수요가 없다"로 오독되어 UVP 피봇 같은 잘못된 판단으로 이어진다.
      한 번 내려진 피봇 결정은 UI 를 고쳐도 되돌아오지 않는다.
    detect: >
      `pnpm test:ds-core --check label` — 등록 케이스 전수에서 인터랙티브 노드마다
      접근 가능한 이름과 가시 텍스트 노드가 모두 존재함을 assert
    on_violation: block_merge

  - id: FORBID-6
    when: >
      코어 컴포넌트 구현에 필요한 토큰이 없거나 DS4 컴포넌트의 동작을 바꿔야 하는 경우
    must_not: >
      packages/ui/styles/** 또는 packages/ui/src/components/price/** 를 이 PR 에서 수정
    because: >
      토큰 변경은 DS1 의 대비 검사를, 가격 컴포넌트 변경은 DS4 의 상태 구분 검사를 각각 리뷰 없이 우회한다.
      특히 가격 컴포넌트를 리스트 사정에 맞춰 손대면 상세 화면의 상태 구분이 조용히 약해지고,
      되돌릴 때 어느 PR 을 revert 해야 하는지 판정할 수 없게 된다.
    detect: >
      CI path guard — 이 PR 의 diff 에 packages/ui/styles/** 또는
      packages/ui/src/components/price/** 가 포함되면 exit 1
    on_violation: block_merge

# ─── 경계 ───────────────────────────────
out_of_scope:
  - "가격 표시 컴포넌트 구현·수정 → DS4-PRICE-COMPARE-CARD 소관 (본 태스크는 재사용만 한다)"
  - "니즈 태그 온톨로지 정의 → F4-NEED-TAG-ONTOLOGY 소관"
  - "필터 상태의 URL 직렬화 · 쿼리 · 정렬 로직 → W2-DISCOVERY-LIST 소관 (본 태스크는 표현과 콜백까지)"
  - "리스트 페이지 조립 · 데이터 페칭 · 페이지네이션 라우팅 → W2-DISCOVERY-LIST 소관"
  - "토큰 추가·수정 → DS1-TOKEN-LAYERS 소관"
  - "접근성 검사 하네스·린트 규칙 구현 → DS6-A11Y-GATE 소관"
  - "프리뷰/문서 페이지 → DS7-PREVIEW-DOCS 소관"
  - "지도 · 이미지 갤러리 · 애니메이션 라이브러리 도입"

rollback: >
  `git revert <merge-sha>` 로 4개 컴포넌트 디렉터리와 테스트가 함께 제거된다.
  W2·W5·W7 미머지 시점에는 소비자가 없어 하위 영향이 없다. W 화면이 이미 머지된 뒤라면
  import 부재로 빌드가 즉시 실패하므로 해당 W 배포를 직전 태그로 함께 되돌린다(부분 롤백 금지).
  cases/types.ts 를 본 PR 이 생성했다면 revert 시 DS4·DS6 케이스가 타입 부재로 실패하므로,
  그 경우 types.ts 만 남기는 후속 커밋을 즉시 올린다.

done_when:
  - "`pnpm test:ds-core --all` 이 6개 서브체크 전부 exit 0"
  - "`pnpm a11y:check` 리포트에 4개 컴포넌트 각각 ≥ 3케이스가 포함되고 위반 0건"
  - "실브라우저 기준 선택/비선택 계산 스타일 비교표가 PR 본문에 첨부됨"
  - "VenueCard 렌더 트리의 data-price-state 노드가 DS4 컴포넌트 유래임이 테스트로 확인됨"
  - "FORBID-1~6 각각에 대응하는 위반 픽스처가 커밋되고 대응 검사를 실패시키는 것이 확인됨"
  - "20건 입력 시 SSR HTML 카드 수 20 이 확인됨"
  - "touches 경로 밖 변경 파일 0개 (CI path guard 통과)"
```
