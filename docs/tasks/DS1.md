# DS1 — 토큰 레이어: seed 시맨틱 토큰 + glowmate 브랜드 오버레이

> 계약 규격: [02-task-contract-spec.md](../02-task-contract-spec.md) §1 (원칙 2.5 · R-6 · R-7 포함)
> 상태: **수정본 (2차 감사 REVISE 반영)** · ⛔G5 = **옵션 A** 확정
> 근거 정본: `docs/design-system/DS0/pinned.json` · `verdict.json` (DS0-FREEZE 산출)
> — 실사 보고서의 **절 번호 인용은 금지**한다. 절이 하나 삽입되면 인용이 조용히 어긋난다(2차 감사 DS0 항).

## 설계 전제 — 우리는 토큰을 만들지 않는다. 덮어쓴다

DS0 실사로 확정된 구성이다.

```
@seed-design/css            → --seed-color-palette-* (primitive) · --seed-color-{fg,bg,stroke}-* (semantic)
        ↓ (벤더 제공. 우리는 값을 재정의만 한다)
glowmate brand.css          → :root 에서 carrot 팔레트 계열을 glowmate 팔레트로 교체
        ↓
glowmate semantic.css       → 제품 고유 의미 토큰만 신설 (가격 상태 4종 등). 값은 seed 변수 참조
        ↓
@seed-design/tailwind4-theme + 우리 @theme  → Tailwind 유틸리티로 노출
        ↓
컴포넌트(DS4·DS5)는 유틸리티/시맨틱만 참조
```

**핵심 제약 3개**

1. **carrot 교체는 선택이 아니라 의무이며, "다른 색"의 정의는 지각 색차다.**
   seed NOTICE 는 "당근과 관련 있는 것처럼 오인하게 하는 사용"을 금지한다. 상표 리스크는 hex 문자열이 아니라
   **보이는 색**에서 발생하므로, `#FF6F0F → #FF6F0E` 같은 1비트 시프트는 교체가 아니다(2차 감사 A-1).
   → 본 계약은 **CIEDE2000 ΔE00 ≥ 20** 을 교체의 정의로 못박는다(REQ-2).
   공식 교체 경로가 문서화되어 있지 않으므로, 교체 **대상 집합**은 실제 설치된 패키지 CSS 를 파싱해 실측한다(REQ-1).
2. **의미 토큰을 중복 신설하지 않는다.** seed 가 이미 `fg`/`bg`/`stroke` × `brand`/`critical`/`positive`/`warning`/
   `informative`/`neutral` × `solid`/`weak`/`pressed`/`contrast` 를 제공한다. 우리가 신설하는 것은
   seed 에 대응 개념이 **없는** 제품 고유 의미(가격 상태 4종)뿐이다.
3. **Style Dictionary 는 도입하지 않는다** (DS2 폐기). 생성 단계가 없으므로 원천은 CSS 파일 그 자체다.

**R-6 대응 — 모집단 하한을 계약이 고정한다**

대비 평가 대상인 `pairs.json` 은 본 태스크 구현자가 작성하므로 "쉬운 페어만 2행 넣기"가 성립한다(2차 감사 A-3).
전수 평가는 **모집단이 구현자 소유일 때 아무 보증이 아니다.** 그래서 두 겹으로 막는다.

1. **모집단 하한을 본 계약이 REQ-7 로 고정** — 가격 상태 4쌍 전건 + DS3 이 도입할 shadcn 프리미티브 3종이
   쓰는 조합 전건이 `role` 지정과 함께 등재되어야 한다. 이 하한은 DS6 머지 이전에도 유효하다.
2. **관측 기반 누락 검사는 DS6-A11Y-GATE 가 수행** — 실제 렌더에서 관측된 (fg,bg) 조합이 `pairs.json` 에
   전부 등재되어 있지 않으면 게이트가 실패한다. **단 이 검사는 DS6 머지 이후에만 존재하므로**
   본 계약의 FORBID-4 detect 는 그것에 의존하지 않는다.

**7:1 실현 가능성 사전 검증** — `minContrastBody=7.0` 은 WCAG AAA 이고 seed 시맨틱 토큰은 AA 기준으로
설계되었을 가능성이 높다. 쓸 수 있는 페어가 없다는 사실을 DS4·DS5 단계에서 발견하면 유일한 탈출구가
임계 하향(FORBID-4 로 봉인됨)이 되어 워크스트림이 교착한다. → REQ-8 이 **seed 시맨틱 fg×bg 전수 대비 분포를
산출**하게 하고, 7.0 미달 조합은 `role=secondary` 로만 등재하도록 규정한다.

```yaml
# ─── 식별 ───────────────────────────────
id:            DS1-TOKEN-LAYERS
dag_id:        DS1
title:         seed 시맨틱 토큰 채택 + glowmate 브랜드 오버레이 (carrot 교체) + 가격 상태 토큰
workstream:    web
owner_agent:   dev-web

# ─── 존재 이유 ──────────────────────────
traces_to:     [H4, H5]
why:           "당근 오렌지를 그대로 노출하면 상표 리스크와 아이덴티티 붕괴가 동시에 발생하고,
                가격 상태 4종을 구분할 의미 토큰이 없으면 DS4 카드가 상태를 구분할 재료를 갖지 못한다."

# ─── DAG ────────────────────────────────
depends_on:    [DS0-SEED-DUE-DILIGENCE, F1-REPO-SCAFFOLD]
blocks:        [DS3-BASE-WIRING, DS6-A11Y-GATE]
parallel_with: [F2a-CORE-SCHEMA, F4-NEED-TAG-ONTOLOGY]
gate:          null      # G5 는 DS0 산출로 이미 해소(옵션 A). 본 태스크는 그 판정을 전제로 한다

# ⚠ dag_amendment (팀 리드 승인 필요)
#   F1-REPO-SCAFFOLD 를 parallel_with → depends_on 으로 이동.
#   본 계약은 packages/ui 를 신규 워크스페이스 패키지로 만들고 F1 이 고정한 패키지 수 기대값을 갱신한다.
#   F1 미머지 상태에서는 그 대상 파일도 CI job 도 존재하지 않아 touches 예외와 acceptance 가 공허해진다.

# ─── 산출물 ─────────────────────────────
deliverable:
  pr_count:    1
  touches:
    - packages/ui/styles/brand.css              # :root / dark 쌍에서 carrot 팔레트 재정의
    - packages/ui/styles/semantic.css           # @theme — 가격 상태 등 제품 고유 의미 토큰
    - packages/ui/styles/constraints.json       # 접근성 임계 상수 단일 소스 (DS6 가 읽어 집행)
    - packages/ui/styles/pairs.json             # 허용 (fg × bg) 페어 매트릭스 + role
    - packages/ui/styles/brand-palette.json     # glowmate 브랜드 팔레트 원본 값 (light/dark 쌍)
    - packages/ui/tokens/resolve.ts             # 설치된 seed CSS 파싱 + var() 체인 해석기
    - packages/ui/tokens/contrast.ts            # WCAG 상대 휘도/대비비 계산 (DS6 가 재사용)
    - packages/ui/tokens/delta-e.ts             # CIEDE2000 색차 계산 (REQ-2 판정)
    - packages/ui/third-party/seed-design/LICENSE   # Apache-2.0 사본 (§4 귀속 고지)
    - packages/ui/third-party/seed-design/NOTICE    # NOTICE 원문 사본 (carrot 교체 의무의 법적 근거)
    - packages/ui/test/tokens/**
    - packages/ui/package.json                  # 신규 워크스페이스 패키지 생성
    - packages/config/test/workspace.test.ts    # F1 이 고정한 워크스페이스 패키지 수 기대값 4→5 갱신 1건만
                                                #   (규칙 안의 명시적 예외 — 이 1건 외 F1 산출물 수정 금지)
  artifacts:
    - "brand.css — 실측된 carrot 계열 변수 전량의 glowmate 값 재정의 (light/dark)"
    - "semantic.css — color.price 4상태 × 3속성 = 12개 토큰 (@theme 노출)"
    - "constraints.json — minBodyFontPx / minFontPx / minContrastBody / minContrastSecondary / minTouchTargetPx"
    - "pairs.json — 허용 fg×bg 페어 매트릭스"
    - "resolve.ts — node_modules 의 실제 seed CSS 를 읽어 CSS 변수 체인을 hex 로 해석"
    - "delta-e.ts — CIEDE2000 ΔE00 계산 (brand 교체 판정용)"
    - "seed-design LICENSE · NOTICE 사본 (Apache-2.0 §4 귀속 고지)"
    - "`pnpm test:tokens` — brand-override / delta-e / palette-sync / price-states / state-distinction / constraints / pair-population / contrast 8개 서브체크"

# ─── 요구사항 ───────────────────────────
requirements:
  - id: REQ-1
    statement: >
      실제 설치된 node_modules/@seed-design/css 의 base CSS 를 파싱해 추출한
      `--seed-color-palette-carrot-*` 변수 집합 전체가 brand.css 의 light·dark 양 스코프에서
      재정의되며, 미재정의 변수 개수가 0 이다. (실환경 하한 REQ — 설치 산출물을 파싱한다)
    acceptance: >
      `pnpm test:tokens --check brand-override` — node_modules 실물 파싱 집합과 brand.css 재정의 집합의
      차집합 = 0 assert. **추출된 carrot 변수 개수를 stdout 에 출력하고 0 이면 exit 1**
      (파싱 실패가 "위반 0건"으로 둔갑하는 경로 차단)

  - id: REQ-2
    statement: >
      brand-palette.json 의 각 단계 색상이 대응하는 seed carrot 단계 색상 대비
      CIEDE2000 색차 ΔE00 ≥ 20 이다 (동일 hex 여부가 아니라 지각 거리로 판정).
    acceptance: >
      `pnpm test:tokens --check delta-e` — 단계별 ΔE00 을 delta-e.ts 로 계산해 전건 ≥ 20 assert,
      최소 ΔE00 값과 비교 단계 수를 stdout 출력(단계 수 0 이면 exit 1). 임계 20 은 테스트에 하드코딩

  - id: REQ-3
    statement: >
      brand.css 의 `--glowmate-palette-*` 원시 팔레트 선언값이 brand-palette.json 의 값과
      단계별로 문자열 일치한다 (팔레트 원천 이중화 방지).
    acceptance: "`pnpm test:tokens --check palette-sync` — 두 소스의 (단계, 값) 쌍 집합 대칭차집합 = 0 assert, 비교 단계 수 stdout 출력(0 이면 exit 1)"

  - id: REQ-4
    statement: >
      semantic.css 의 가격 상태 토큰이 정본 4상태(confirmed / conflict / low_confidence / unavailable)
      × 3속성(fg / bg / stroke) = 12개이며, 각 선언값이 `var(--…)` 참조이고 리터럴 색상값이 0건이다.
    acceptance: >
      `pnpm test:tokens --check price-states` — 토큰 수 = 12, 상태명 집합이 03-task-dag.md 정본 어휘
      4개와 대칭차집합 0(테스트에 하드코딩), 리터럴 0건, 미해결 참조 0건 assert

  - id: REQ-5
    statement: >
      4개 가격 상태의 bg 해석값이 상호 구분된다 — 상태쌍 6개 전부에서 대비비 ≥ 1.5:1 이다.
    acceptance: "`pnpm test:tokens --check state-distinction` — 6쌍 전부 대비 ≥ 1.5 assert (동일 참조 시 대비 1.0 이 되어 자동 실패), 비교 쌍 수 = 6 확인"

  - id: REQ-6
    statement: >
      constraints.json 이 6개 키를 정확한 값으로 갖는다 — minBodyFontPx=17, minFontPx=14,
      minContrastBody=7.0, minContrastSecondary=4.5, minTouchTargetPx=48, minHeadlinePricePx=24.
    acceptance: "`pnpm test:tokens --check constraints` — 6개 키 존재 및 값 일치 assert (테스트에 값 하드코딩)"

  - id: REQ-7
    statement: >
      pairs.json 이 모집단 하한을 충족한다 — REQ-4 의 가격 상태 4쌍(fg,bg) 전건과
      DS3 이 도입할 shadcn 프리미티브 3종(Button·Badge·Card)이 사용하는 (fg,bg) 조합 전건이
      `role` 값과 함께 등재되어 있다.
    acceptance: >
      `pnpm test:tokens --check pair-population` — 필수 조합 목록(테스트에 하드코딩)이 pairs.json 의
      부분집합인지 assert, 누락 조합 목록을 stdout 출력. 등재 행 수 하한 = 필수 조합 수

  - id: REQ-8
    statement: >
      pairs.json 에 등재된 페어 **전수**에 대해 role=body 는 대비 ≥ minContrastBody,
      role=secondary 는 ≥ minContrastSecondary 를 만족하고 해석 실패 페어가 0건이다.
    acceptance: >
      `pnpm test:tokens --check contrast` — 미달 1건이라도 있으면 exit 1. 검사 페어 수와 해석 실패 수를
      stdout 출력(페어 수 0 또는 해석 실패 > 0 이면 exit 1). 동일 실행이 seed 시맨틱 fg×bg 전수의
      대비 분포표를 파일로 산출하며, 7.0 미달 조합이 role=body 로 등재되어 있으면 실패

# ─── 조건부 금지사항 ────────────────────
forbid:
  - id: FORBID-1
    when: >
      설치된 @seed-design/css 에서 추출한 `--seed-color-palette-carrot-*` 변수 중 하나라도
      brand.css 에서 재정의되지 않았거나, ΔE00 < 20 인 단계가 1개 이상 존재하는 경우
    must_not: >
      그 상태로 머지하거나, seed LICENSE·NOTICE 사본 없이 packages/ui 를 구성
    because: >
      재정의 누락 변수는 화면에서 당근 오렌지로 렌더되고, ΔE00 이 작으면 hex 는 달라도 사람 눈에는
      당근 오렌지다. seed NOTICE 는 "당근과 관련 있는 것처럼 오인하게 하는 사용"을 금지하며,
      이는 라이선스 위반이 색인된 페이지 전체에 퍼진 뒤에야 발견된다. Apache-2.0 §4 는 배포물에
      LICENSE 사본과 NOTICE 동봉을 별도로 요구하므로 두 의무를 한 조항에서 함께 집행한다.
    detect: >
      `pnpm test:tokens --check brand-override` (차집합 = 0 · 추출 개수 > 0) +
      `--check delta-e` (전건 ΔE00 ≥ 20 · 비교 단계 수 > 0) +
      packages/ui/third-party/seed-design/{LICENSE,NOTICE} 파일 존재 assert
    on_violation: block_merge

  - id: FORBID-2
    when: >
      새로 신설하려는 glowmate 시맨틱 토큰의 해석값이 기존 seed 시맨틱 토큰
      (`--seed-color-{fg,bg,stroke}-*`) 중 하나와 ΔE00 < 2.0 인 경우 (지각적으로 같은 색)
    must_not: >
      그 토큰을 semantic.css 에 신설 (seed 토큰을 그대로 참조할 것)
    because: >
      같은 의미의 토큰이 2개가 되면 컴포넌트마다 참조 대상이 갈리고, seed 업그레이드 시 한쪽만
      값이 따라간다. 값 동일성으로 판정하면 1비트만 다른 값으로 신설해 우회할 수 있으므로
      지각 거리로 판정한다(REQ-2 와 동일 원리).
    detect: >
      `pnpm test:tokens --check no-duplicate-semantic` — 신설 토큰과 seed 시맨틱 토큰 전조합의
      ΔE00 을 계산해 2.0 미만 쌍의 개수 = 0 assert, 비교 조합 수 stdout 출력(0 이면 exit 1)
    on_violation: block_merge

  - id: FORBID-3
    when: >
      brand.css · semantic.css 의 선언 중 **`--glowmate-palette-*` 원시 팔레트 선언 블록 밖**에서
      색상값을 기술하는 경우
    must_not: >
      리터럴 색상값(#hex · rgb() · oklch())을 직접 기입 (`var(--…)` 참조를 쓸 것)
    because: >
      의미 계층에 박힌 리터럴은 브랜드 팔레트를 교체해도 그 토큰만 옛 색으로 남아 화면 일부만 바뀐
      상태가 된다. **다만 팔레트 원시값 자체는 어딘가에 리터럴로 존재해야 하고(DS2 폐기로 생성 단계가 없다),
      그 유일한 장소가 `--glowmate-palette-*` 블록이다** — 이 예외를 규칙 안에 두지 않으면
      계약이 자기 PR 을 차단하고 개발 에이전트가 우회 관용구를 학습한다(2차 감사 A-2 / P4).
    detect: >
      `pnpm test:tokens --check price-states` 및 `--check no-duplicate-semantic` —
      `--glowmate-palette-*` 선언 블록 밖 선언 중 값이 `var(--…)` 형식이 아닌 항목 수 = 0 assert.
      팔레트 블록 안 리터럴은 REQ-3 palette-sync 가 별도 검증 + 위반 픽스처(의미 토큰에 리터럴 기입)가
      반드시 실패하는 메타 테스트
    on_violation: block_merge

  - id: FORBID-4
    when: >
      이 PR 의 diff 가 constraints.json 값 하향, pairs.json 행 삭제, 또는 pairs.json 항목의
      role 을 body → secondary 로 변경하는 내용을 포함하는 경우
    must_not: >
      해당 변경으로 `--check contrast` 를 통과시키기 (브랜드 팔레트 값이나 토큰 매핑을 고칠 것)
    because: >
      이 숫자들은 성능 목표가 아니라 "3050이 읽을 수 있다"는 제품 정의다. 페어 삭제와 role 강등은
      더 나쁘다 — 그 조합이 화면에서는 계속 쓰이는데 평가 대상에서만 빠지거나 기준이 4.5 로 내려간다.
      시험지를 좁혀 통과하는 것과 같다.
    detect: >
      CI job `ds-tokens` — 위 3종 diff 패턴을 검출하고, 통과하려면 (a) PR 라벨
      `threshold-change-approved` **그리고** (b) GitHub API 조회로 확인한 CODEOWNERS 승인자가
      PR 작성자와 다를 것을 **모두** 요구한다. 라벨 단독은 작성자가 자기 PR 에 붙일 수 있어 무력하다
      (F6-PRICE-STATE FORBID-3 과 동일 강도)
    on_violation: block_merge

  - id: FORBID-5
    when: >
      `@seed-design/css` 또는 `@seed-design/tailwind4-theme` 의 버전을 package.json 에 기술할 때
    must_not: >
      range(`^` · `~` · `*` · `latest`)로 지정하거나, DS0 정본 `docs/design-system/DS0/pinned.json`
      에 기재된 버전과 다른 값을 기재
    because: >
      carrot 변수 집합은 seed 릴리스마다 늘어날 수 있고(저장소 주당 최대 48커밋), 우리 교체 검사는
      "설치 시점 실측 집합" 기준이다. range 면 개발자 머신과 CI 가 다른 버전을 설치해 한쪽에서만 통과하고,
      새로 추가된 carrot 변수가 재정의 누락인 채로 배포된다. 버전을 구현자가 임의로 고르면
      실사가 검증한 버전과 다른 것이 들어와 G5 판정의 근거가 무효가 된다.
    detect: >
      `pnpm test:tokens --check pin` — 두 패키지 버전 문자열이 정확한 x.y.z 이고,
      pinned.json 값 및 lockfile 해결 버전과 3자 문자열 일치 assert (pinned.json 부재 시 exit 1)
    on_violation: block_merge

# ─── 경계 ───────────────────────────────
out_of_scope:
  - "Style Dictionary · DTCG 변환 파이프라인 → DS2-TOKEN-BUILD 폐기 (재도입 조건은 해당 문서 참조)"
  - "seed CSS/theme 를 앱에 import · cascade layer 순서 · 폰트 → DS3-BASE-WIRING 소관"
  - "shadcn/ui 초기화 → DS3-BASE-WIRING 소관"
  - "컴포넌트 구현 → DS4-PRICE-COMPARE-CARD · DS5-CORE-COMPONENTS 소관"
  - "접근성 검사 CI 집행 · 린트 규칙 · 페어 누락 검사 → DS6-A11Y-GATE 소관 (본 태스크는 임계 상수와 계산 유틸까지)"
  - "seed 토큰 값 자체의 수정(node_modules 패치 · patch-package) — 우리는 :root 오버라이드만 한다"
  - "다크 모드 토글 UI (토큰의 light/dark 쌍 정의는 포함하나 전환 장치는 비대상)"
  - "F1 이 만든 CI 워크플로·경계 규칙 수정 (워크스페이스 패키지 수 기대값 1건 갱신은 예외로 허용)"

rollback: >
  `git revert <merge-sha>` 로 packages/ui/styles/** · tokens/** · 테스트가 함께 제거되고,
  F1 패키지 수 기대값도 4 로 복귀한다. 본 태스크 시점에는 토큰을 소비하는 앱 코드가 없으므로
  (DS3 미머지) 하위 영향이 없다. DS3 가 이미 머지된 상태라면 brand.css·semantic.css import 가
  사라져 앱 빌드가 즉시 실패하고 carrot 원색이 노출되므로, DS3 와 함께 되돌린다(부분 롤백 금지).

done_when:
  - "`pnpm test:tokens --all` 이 8개 서브체크 전부 exit 0"
  - "carrot 변수 실측 개수 · 재정의 개수 · 단계별 최소 ΔE00 이 PR 본문에 기재됨 (개수 동일, ΔE00 ≥ 20)"
  - "가격 상태 4종의 해석 색상값과 상태쌍 6개 대비표가 PR 본문에 첨부됨 (어휘는 정본 4개)"
  - "**seed 시맨틱 fg×bg 전수 대비 분포표**가 산출·첨부되고, 7.0 미달 조합이 role=body 로 등재된 건수 0"
  - "각 부정형 검사의 대상 수(carrot 변수 · ΔE00 비교 단계 · 팔레트 단계 · 페어 · 조합)가 stdout 에 출력되고 전부 0 초과"
  - "FORBID-1~5 각각에 대응하는 위반 픽스처(누락 재정의 · ΔE00 미달 · 지각 중복 · 의미층 리터럴 · role 강등 · range 버전)가 대응 검사를 실패시킴을 확인"
  - "seed 패키지 2종 버전이 pinned.json · package.json · lockfile 3자 일치"
  - "seed LICENSE·NOTICE 사본이 packages/ui/third-party/seed-design/ 에 존재 (Apache-2.0 §4)"
  - "touches 경로 밖 변경 파일 0개 (CI path guard 통과)"
```
