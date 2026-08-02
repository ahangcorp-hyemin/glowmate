# DS1 — 토큰 레이어: seed 시맨틱 토큰 + glowmate 브랜드 오버레이

> 계약 규격: [02-task-contract-spec.md](../02-task-contract-spec.md) §1
> 상태: 착수 가능 (DS0 완료 · ⛔G5 = **옵션 A** 확정)
> 근거: [ds0-seed-design-실사.md](../ds0-seed-design-실사.md) §2.2 · §5.2 · §8 · §9.1

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

1. **carrot 교체는 선택이 아니라 의무다.** NOTICE 의 "당근과 관련 있는 것처럼 오인하게 하는 사용" 금지 조항
   (실사 §1.1 · §8-3)에 걸리고, 브랜드 아이덴티티 측면에서도 성립하지 않는다.
   *공식 교체 경로는 문서화되어 있지 않다*(실사 §9.3-1) — 그래서 본 태스크는 **실제 설치된 패키지 CSS 를 파싱해
   교체 대상 변수 집합을 실측**하고, 그 집합의 누락 0건을 기계로 판정한다.
2. **의미 토큰을 중복 신설하지 않는다.** seed 가 이미 `fg`/`bg`/`stroke` × `brand`/`critical`/`positive`/`warning`/
   `informative`/`neutral` × `solid`/`weak`/`pressed`/`contrast` 를 제공한다. 우리가 신설하는 것은
   seed 에 대응 개념이 **없는** 제품 고유 의미(가격 상태 4종)뿐이다.
3. **Style Dictionary 는 도입하지 않는다** (DS2 폐기). 생성 단계가 없으므로 원천은 CSS 파일 그 자체다.

**R-6 관련 고지** — 대비 평가 대상인 `pairs.json`(허용 fg×bg 페어 매트릭스)은 **본 태스크 구현자가 작성**한다.
따라서 "쉬운 페어만 골라 넣는" 자기 출제가 성립할 수 있다. 이를 막는 검사는 본 태스크가 아니라
**DS6-A11Y-GATE 가 수행**한다 — 실제 렌더에서 관측된 (fg,bg) 조합이 `pairs.json` 에 전부 등재되어 있지 않으면
게이트가 실패한다. 본 태스크는 그 대신 **전수 평가**(표본 아님)와 페어 삭제 금지(FORBID-4)를 책임진다.

```yaml
# ─── 식별 ───────────────────────────────
id:            DS1-TOKEN-LAYERS
dag_id:        DS1
title:         seed 시맨틱 토큰 채택 + glowmate 브랜드 오버레이 (carrot 교체) + 가격 상태 토큰
workstream:    web
owner_agent:   dev-web

# ─── 존재 이유 ──────────────────────────
traces_to:     [H4, H5, S1]
why:           "당근 오렌지를 그대로 노출하면 상표 리스크와 아이덴티티 붕괴가 동시에 발생하고,
                가격 상태 4종을 구분할 의미 토큰이 없으면 DS4 카드가 상태를 구분할 재료를 갖지 못한다."

# ─── DAG ────────────────────────────────
depends_on:    [DS0-SEED-DUE-DILIGENCE]
blocks:        [DS3-BASE-WIRING, DS6-A11Y-GATE]
parallel_with: [F1-REPO-SCAFFOLD, F2a-CORE-SCHEMA]
gate:          null      # G5 는 DS0 산출로 이미 해소(옵션 A). 본 태스크는 그 판정을 전제로 한다

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
    - packages/ui/test/tokens/**
    - packages/ui/package.json                  # 신규 워크스페이스 패키지 생성
    - packages/config/test/workspace.test.ts    # F1 이 고정한 워크스페이스 패키지 수 기대값 4→5 갱신 1건만
  artifacts:
    - "brand.css — 실측된 carrot 계열 변수 전량의 glowmate 값 재정의 (light/dark)"
    - "semantic.css — color.price 4상태 × 3속성 = 12개 토큰 (@theme 노출)"
    - "constraints.json — minBodyFontPx / minFontPx / minContrastBody / minContrastSecondary / minTouchTargetPx"
    - "pairs.json — 허용 fg×bg 페어 매트릭스"
    - "resolve.ts — node_modules 의 실제 seed CSS 를 읽어 CSS 변수 체인을 hex 로 해석"
    - "`pnpm test:tokens` — brand-override / no-duplicate-semantic / price-states / constraints / typography / contrast / pin 7개 서브체크"

# ─── 요구사항 ───────────────────────────
requirements:
  - id: REQ-1
    statement: >
      실제 설치된 node_modules/@seed-design/css 의 base CSS 를 파싱해 추출한
      `--seed-color-palette-carrot-*` 변수 집합 전체가 brand.css 의 light·dark 양 스코프에서 재정의되며,
      미재정의 변수 개수가 0 이다. (실환경 하한 REQ — 픽스처가 아니라 설치 산출물을 파싱한다)
    acceptance: >
      `pnpm test:tokens --check brand-override` — node_modules 실물 파싱으로 얻은 carrot 변수 집합과
      brand.css 재정의 집합의 차집합 크기 = 0, 추출된 변수 개수를 stdout 에 출력(0 이면 실패 처리)

  - id: REQ-2
    statement: >
      brand-palette.json 의 glowmate 브랜드 값 중 어느 것도 seed 원본 carrot 값과 동일하지 않으며
      (동일 hex 0건), 브랜드 계열 색상 수가 seed carrot 단계 수와 같다.
    acceptance: "`pnpm test:tokens --check brand-override` — 원본/신규 값쌍 중 동일 hex 건수 = 0, 단계 수 일치 assert"

  - id: REQ-3
    statement: >
      semantic.css 의 가격 상태 토큰은 4상태(confirmed / low-confidence / conflict / unparseable) ×
      3속성(fg / bg / stroke) = 12개이며, 각 `$value` 가 `var(--seed-…)` 또는 브랜드 변수 참조 형식이고
      리터럴 색상 값이 0건이다.
    acceptance: "`pnpm test:tokens --check price-states` — 토큰 수 = 12, 리터럴 값 0건, 미해결 참조 0건 assert"

  - id: REQ-4
    statement: >
      4개 가격 상태는 서로 다른 참조를 가지며(bg 참조 중복 0건), 해석된 bg 색 간 대비비가 임의의 두 상태 쌍에서
      1.5:1 이상이고, stroke-width 토큰 값이 최소 2종으로 갈린다.
    acceptance: "`pnpm test:tokens --check price-states` — 참조 중복 0, 상태쌍 6개 전부 대비 ≥ 1.5, stroke-width 고유값 ≥ 2"

  - id: REQ-5
    statement: >
      constraints.json 이 5개 키를 정확한 값으로 갖는다 — minBodyFontPx=17, minFontPx=14,
      minContrastBody=7.0, minContrastSecondary=4.5, minTouchTargetPx=48.
    acceptance: "`pnpm test:tokens --check constraints` — 5개 키 존재 및 값 일치 assert (테스트에 값 하드코딩)"

  - id: REQ-6
    statement: >
      pairs.json 에 등재된 (fg, bg) 허용 페어 **전수**에 대해 role=body 페어 대비비 ≥ minContrastBody,
      role=secondary 페어 대비비 ≥ minContrastSecondary 이며, 해석 실패(미정의 변수) 페어가 0건이다.
    acceptance: >
      `pnpm test:tokens --check contrast` — 임계 미달 1건이라도 있으면 exit 1.
      평가는 표본이 아니라 pairs.json 전수이며, 검사 페어 수와 해석 실패 수를 stdout 출력(실패 수 > 0 이면 exit 1)

  - id: REQ-7
    statement: >
      본문/보조 텍스트에 쓰는 seed font-size 토큰의 해석값이 각각 minBodyFontPx · minFontPx 이상이며,
      기준 미달 토큰을 pairs.json 의 role 지정 대상에서 사용하지 않는다.
    acceptance: "`pnpm test:tokens --check typography` — 위반 토큰 0건, 검사 토큰 수 stdout 출력"

  - id: REQ-8
    statement: >
      `@seed-design/css` 와 `@seed-design/tailwind4-theme` 의 버전이 range 없이 정확한 x.y.z 로 고정되고
      lockfile 의 해결 버전과 문자열이 일치한다.
    acceptance: "`pnpm test:tokens --check pin` — package.json 버전 문자열이 `^`·`~`·`*`·`latest` 를 포함하지 않고 lock 해결 버전과 일치 assert"

# ─── 조건부 금지사항 ────────────────────
forbid:
  - id: FORBID-1
    when: >
      설치된 @seed-design/css 에서 추출한 `--seed-color-palette-carrot-*` 변수 중 하나라도
      brand.css 에서 재정의되지 않은 채 남아 있는 경우
    must_not: >
      그 상태로 머지 (전량 재정의하거나, 해당 변수를 쓰지 않음을 증명하는 대신 남겨두지 말 것)
    because: >
      재정의가 누락된 변수는 화면에서 당근 오렌지로 렌더된다. NOTICE 는 "당근과 관련 있는 것처럼
      오인하게 하는 사용"을 금지하며, 이는 라이선스 위반이 색인된 페이지 전체에 퍼진 뒤에야 발견된다.
      브랜드 색이 두 계열로 섞이면 아이덴티티도 함께 무너진다.
    detect: >
      `pnpm test:tokens --check brand-override` — node_modules 의 실제 seed CSS 를 파싱해 얻은
      carrot 변수 집합과 brand.css 재정의 집합의 차집합 = 0 assert (추출 개수 0 이면 파싱 실패로 간주해 exit 1)
    on_violation: block_merge

  - id: FORBID-2
    when: >
      새로 신설하려는 glowmate 시맨틱 토큰의 해석값이 기존 seed 시맨틱 토큰
      (`--seed-color-{fg,bg,stroke}-*`) 중 하나와 동일한 경우
    must_not: >
      그 토큰을 semantic.css 에 신설 (seed 토큰을 그대로 참조할 것)
    because: >
      같은 의미의 토큰이 2개가 되면 컴포넌트마다 참조 대상이 갈리고, seed 를 업그레이드했을 때 한쪽만
      값이 따라간다. 두 색이 미세하게 어긋난 상태는 리뷰에서 잡히지 않으며, 어느 쪽이 정본인지
      판정할 근거가 제품 안에 존재하지 않게 된다.
    detect: >
      `pnpm test:tokens --check no-duplicate-semantic` — semantic.css 신설 토큰의 해석값이
      seed 시맨틱 토큰 해석값 집합과 일치하는 항목 수 = 0 assert
    on_violation: block_merge

  - id: FORBID-3
    when: >
      brand.css 또는 semantic.css 에서 토큰 값을 기술할 때 (brand-palette.json 의 원시 팔레트 정의는 제외)
    must_not: >
      리터럴 색상값(#hex · rgb() · oklch() 리터럴)을 직접 기입 (팔레트 변수 또는 seed 변수를 참조할 것)
    because: >
      의미 계층에 박힌 리터럴은 브랜드 팔레트를 교체해도 그 토큰만 옛 색으로 남는다. 화면 일부만 바뀐
      상태는 "만들다 만 사이트"로 보이고, 원인을 찾으려면 빌드된 CSS 를 역추적해야 한다.
    detect: >
      `pnpm test:tokens --check price-states` 및 `--check no-duplicate-semantic` — 두 CSS 의
      선언 값이 `var(--…)` 참조 형식이 아닌 항목 수 = 0 assert + 위반 픽스처가 반드시 실패하는 메타 테스트
    on_violation: block_merge

  - id: FORBID-4
    when: >
      `--check contrast` 또는 `--check typography` 가 실패한 상태에서 이를 통과시키려는 변경을 만들 때
    must_not: >
      constraints.json 의 값을 낮추거나 pairs.json 에서 실패한 페어를 삭제·주석 처리
      (브랜드 팔레트 값이나 토큰 매핑을 고칠 것)
    because: >
      이 숫자들은 성능 목표가 아니라 "3050이 읽을 수 있다"는 제품 정의다. 낮추면 실패가 사라지는 게 아니라
      제품 대상이 조용히 바뀐다. 페어 삭제는 더 나쁘다 — 실제로는 그 조합이 화면에 계속 쓰이는데
      평가 대상에서만 빠지므로, 시험지를 좁혀 통과하는 것과 같다.
    detect: >
      CI job `ds-tokens` — constraints.json · pairs.json diff 에 임계 하향 또는 페어 삭제가 포함되고
      PR 라벨 `threshold-change-approved` 가 없으면 exit 1. 삭제된 페어가 실제 렌더에서 관측되면
      DS6-A11Y-GATE 의 페어 누락 검사가 별도로 실패한다
    on_violation: block_merge

  - id: FORBID-5
    when: >
      `@seed-design/css` 또는 `@seed-design/tailwind4-theme` 의 버전을 package.json 에 기술할 때
    must_not: >
      `^` · `~` · `*` · `latest` 등 range 로 지정
    because: >
      carrot 변수 집합은 seed 릴리스마다 늘어날 수 있는데(저장소 주당 최대 48커밋), 우리 교체 검사는
      "설치 시점 실측 집합"을 기준으로 한다. range 로 두면 개발자 머신과 CI 가 서로 다른 버전을 설치해
      한쪽에서만 통과하고, 새로 추가된 carrot 변수가 재정의 누락인 채로 배포되어 당근 오렌지가 노출된다.
    detect: >
      `pnpm test:tokens --check pin` — 두 패키지 버전 문자열이 정확한 x.y.z 이고 lockfile 해결 버전과
      일치하는지 assert
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
  - "`pnpm test:tokens --all` 이 7개 서브체크 전부 exit 0"
  - "설치된 @seed-design/css 에서 실측한 carrot 변수 개수와 재정의 개수가 PR 본문에 기재됨 (동일해야 함)"
  - "가격 상태 4종의 해석 색상값·상태쌍 대비·stroke-width 분포표가 PR 본문에 첨부됨"
  - "`--check contrast` 가 검사한 페어 수와 해석 실패 0건이 stdout 로 확인됨"
  - "FORBID-1~5 각각에 대응하는 위반 픽스처(누락 재정의 · 중복 시맨틱 · 리터럴 값 · 페어 삭제 · range 버전)가 대응 검사를 실패시킴을 확인"
  - "seed 패키지 2종의 고정 버전이 PR 본문에 기재되고 lockfile 과 일치"
  - "touches 경로 밖 변경 파일 0개 (CI path guard 통과)"
```
