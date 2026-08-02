# DS6 — 3050 접근성 게이트 (대비 · 최소 폰트 · 터치타깃) **CI 강제**

> 계약 규격: [02-task-contract-spec.md](../02-task-contract-spec.md) §1 (원칙 2.5 · R-6 · R-7 포함)
> 상태: **수정본 (2차 감사 REVISE 반영)** · ⛔G5 = 옵션 A (컴포넌트 출처와 무관하게 동일 임계 집행)

## 설계 전제 — 이 태스크가 다른 태스크들의 `detect` 를 공급한다

DS4·DS5 와 이후 W2·W3 의 FORBID 다수가 "DS6 의 검사가 잡는다"를 탐지 수단으로 지목한다.
따라서 본 태스크의 실패 모드는 "검사가 미흡함"이 아니라 **"검사가 존재한다고 선언되었는데 실제로는 비어 있음"** 이다.

### 이 게이트가 비어 있게 되는 3가지 경로 — 전부 계약으로 막는다

| 경로 | 결과 | 차단 장치 |
|---|---|---|
| **① 검사 대상이 0건** | 케이스가 없거나 탐색 실패해도 exit 0 → 만점 게이트 | REQ-3 (디렉터리당 ≥2, 빈 케이스 0건) |
| **② 픽스처·dev 라우트만 검사** | 컴포넌트는 통과하는데 **사용자가 보는 화면은 검사되지 않음** | REQ-6 — targets 에 **is_production=true 라우트 ≥ 1** 필수 (R-7) |
| **③ 시험지를 좁힘** | 구현자가 pairs.json 에 쉬운 조합만 등재 | REQ-5 — **관측 규칙을 계약이 고정**하고 관측 조합 전건 등재 요구 (R-6) |

**2차 감사가 지적한 ②의 실질 미충족** — 이전 판은 "targets 가 **비어 있는** 상태"만 막았고
"targets 가 **의미 없는** 상태"는 막지 못했다. DS3 의 `(dev)` 스모크 라우트 1개 → DS7 의 비배포 프리뷰 앱으로
이어지는 동안 **W 계약 9건 중 targets 를 언급하는 것이 0건**이어서, 게이트는 프로덕션 화면을
영원히 보지 않게 되어 있었다. REQ-6 이 `is_production` 플래그로 그것을 막고,
W1 이 최초 프로덕션 라우트를 등재하도록 dag_amendment (3)으로 상신한다.

**R-6 고지** — 대비 평가의 "시험지"인 `pairs.json` 은 DS1 구현자가 작성한다(자기 출제).
본 태스크가 그것을 실제 렌더 관측 조합과 대조하는데, **관측 규칙 자체를 구현자가 정하면 채점 범위를 좁혀
같은 구멍으로 빠져나간다.** 그래서 관측 규칙을 REQ-5 본문에 계약으로 고정한다.

**임계 숫자의 단일 소스는 DS1 의 `packages/ui/styles/constraints.json` 이다.**
본 태스크는 그 값을 읽어 집행할 뿐 어디에도 숫자를 다시 적지 않는다.

| 항목 | 임계 | 근거 |
|---|---|---|
| 본문 대비 | ≥ 7.0:1 | WCAG AA(4.5:1)를 하한으로 하되, 40대 후반 대비 감도 저하를 반영한 3050 보정치 |
| 보조 텍스트 대비 | ≥ 4.5:1 | WCAG AA |
| 본문 폰트 / 스케일 최소 | ≥ 17px / ≥ 14px | 3050 가독성 |
| 터치 타깃 | ≥ 48×48 CSS px | WCAG 2.2 AAA(44px) 상회 |
| 리플로 | 375px × 200% 확대에서 가로 스크롤 0 | WCAG 1.4.10 |

```yaml
# ─── 식별 ───────────────────────────────
id:            DS6-A11Y-GATE
dag_id:        DS6
title:         3050 접근성 게이트 — 대비 · 최소 폰트 · 터치타깃 · 리플로 · 토큰 우회 차단 (CI 강제)
workstream:    web
owner_agent:   dev-platform

# ─── 존재 이유 ──────────────────────────
traces_to:     [H4, H5]
why:           "가격 비교 블록(H4)과 니즈 태그 필터(H5)를 3050이 실제로 읽고 누를 수 있어야 두 가설이
                측정 가능해지며, 이 기준을 CI 로 강제하지 않으면 컴포넌트가 늘어날 때마다 조용히 무너진다."

# ─── DAG ────────────────────────────────
depends_on:    [DS1-TOKEN-LAYERS, DS3-BASE-WIRING, F1-REPO-SCAFFOLD]   # ⚠ dag_amendment 참조
blocks:        [DS4-PRICE-COMPARE-CARD, DS5-CORE-COMPONENTS, DS7-PREVIEW-DOCS, W2-DISCOVERY-LIST, W3-VENUE-DETAIL, W4-COMBO-LANDING, W5-EDITOR-REPORT, W7-CORRECTION-REQUEST]
parallel_with: []          # REQ-6 이 W1 의 프로덕션 라우트를 요구하므로 W1 과도 병렬이 아니다 (amendment (4))
gate:          null      # ⛔G5 와 독립. 컴포넌트 출처와 무관하게 동일 임계를 집행한다

# ⚠ dag_amendment (팀 리드 승인 필요)
#   03-task-dag.md 는 DS6 의 의존을 DS1 단독으로 둔다. 그러나 개정 규격 R-7(실환경 하한)을 충족하려면
#   REQ-6 이 "실행 중인 Next 라우트 최소 1개"를 검사해야 하고, 그 라우트는 DS3 이 만드는
#   wiring-smoke 가 최초 대상이다. DS3 없이 머지하면 targets.json 이 비어 REQ-6 이 구조적으로 불가능하고,
#   그 상태를 허용하면 정확히 "빈 게이트"(위 ② 경로)가 된다.
#   → DAG 에 DS3 → DS6 간선 추가를 제안한다. DS4·DS5 와의 병렬성은 그대로 유지된다.
#   (2) F1-REPO-SCAFFOLD 를 depends_on 에 추가. FORBID-4 의 detect(우회 관용구 diff 검사)는
#       F1 이 소유한 `lint` job 에서 수행되어야 하는데, 본 계약의 out_of_scope 가 F1 job 수정을 배제한다.
#       F1 의존을 명시하고 F1 이 제공하는 job 이름을 인용하는 것으로 소유권을 정렬한다.
#   (3) DS4·DS5·DS7 이 본 태스크를 depends_on 으로 승격했으므로 blocks 를 대칭 갱신했다.
#       "다른 태스크의 detect 를 공급하는 태스크는 병렬일 수 없다"(2차 감사 P3)는 지적을 DAG 가 따른다.
#   (4) **W1-SEO-FOUNDATION 에 "프로덕션 라우트 1개를 targets.json 에 등재" REQ 신설을 상신한다.**
#       현재 W1~W9 중 targets.json·a11y:check 를 언급하는 계약이 0건이라(2차 감사 실측),
#       이 상신이 반영되지 않으면 REQ-6 을 충족할 수 있는 라우트가 리포에 존재하지 않는다.
#       DS6 는 W1 머지 이후에 머지된다 — blocks 관계가 역전되므로 팀 리드 결재가 필수다.

# ─── 산출물 ─────────────────────────────
deliverable:
  pr_count:    1
  touches:
    - packages/ui/a11y/runner.mjs                      # 케이스 자동 탐색 + 실라우트 검사 + 5개 체크 실행
    - packages/ui/a11y/checks/**                       # contrast · font-size · touch-target · reflow · axe
    - packages/ui/a11y/checks.manifest.json            # 다른 계약이 detect 로 지목하는 검사 이름의 계약 목록
    - packages/ui/a11y/targets.json                    # 실환경 검사 대상 라우트 목록 (R-7 대상)
    - packages/ui/a11y/test/**
    - packages/ui/a11y/test/fixtures/**                # 의도적 위반 · 렌더 실패 · 임계 변이 픽스처
    - packages/ui/src/cases/types.ts                   # ↓ 공유 규약 참조
    - packages/config/eslint.design-system.cjs         # 신규 파일 추가만 (F1 프리셋 수정 금지)
    - packages/ui/package.json                         # scripts 키 `a11y:check` · `a11y:selftest` 추가만
    - .github/workflows/ci.yml                         # job `ds-a11y` 추가 + F1 `lint` job 에 우회 관용구 diff 스텝 추가
    - .github/rulesets/main.json                       # required_status_checks 에 `ds-a11y` 등재 (브랜치 보호 파일화)
    - .github/CODEOWNERS                               # constraints.json · pairs.json · targets.json · manifest 보호 규칙 추가만
  artifacts:
    - "`pnpm a11y:check` — 케이스 자동 탐색 + 실행 중 라우트 검사, 위반 1건이면 exit ≠ 0"
    - "checks.manifest.json — DS4·DS5·W 계약이 detect 로 지목하는 검사 이름의 계약 목록"
    - "targets.json — `{app, path, is_production}` 스키마. is_production=true 항목 ≥ 1 필수"
    - "eslint 규칙 세트 — arbitrary value · style 속성 · 색상/px 리터럴 · 팔레트 변수 직접 참조 금지"
    - "하네스 자기검사 (위반 픽스처 · 렌더 실패 픽스처 · constraints 변이 테스트)"
    - "CI job `ds-a11y` + 임계·페어·매니페스트 CODEOWNERS 보호"

# ─── 공유 규약 (DS4 · DS5 와의 경계) ────
shared_contract:
  - "케이스 레지스트리 규약: `packages/ui/src/**/*.cases.tsx` 가 default export 로
     `{ id: string; name: string; render: () => ReactElement }[]` 를 export 한다.
     `packages/ui/src/cases/types.ts` 는 DS4·DS5·DS6 중 **먼저 머지되는 PR** 이 생성하고
     나중 PR 은 import 만 한다(수정 금지)."
  - "임계 상수(constraints.json) · 페어 매트릭스(pairs.json) · 대비 계산(contrast.ts) ·
     CSS 변수 해석기(resolve.ts)는 DS1-TOKEN-LAYERS 산출물이다. 본 태스크는 읽고 재사용만 한다."
  - "본 태스크의 자기검사용 케이스는 packages/ui/a11y/test/fixtures/ 아래에만 둔다
     (packages/ui/src/components/** 에 케이스를 추가하지 않는다)."

# ─── 요구사항 ───────────────────────────
requirements:
  - id: REQ-1
    statement: >
      `pnpm a11y:check` 단일 커맨드가 5개 검사(contrast · font-size · touch-target · reflow · axe)를
      실제 브라우저에서 실행하고, 위반이 1건이라도 있으면 exit code ≠ 0 으로 종료한다.
    acceptance: "위반 픽스처 5종을 각각 포함시킨 5회 실행이 모두 exit ≠ 0, 클린 상태 실행이 exit 0"

  - id: REQ-2
    statement: >
      모든 임계값은 packages/ui/styles/constraints.json 에서 읽으며,
      packages/ui/a11y/ 아래 검사·테스트 소스의 임계 숫자 리터럴(7.0 · 4.5 · 17 · 14 · 48 · 24)이 0건이다.
    acceptance: "변이 테스트 — constraints 6개 키를 각각 극단값으로 치환한 6회 실행이 전부 exit ≠ 0 + 숫자 리터럴 grep 0건"

  - id: REQ-3
    statement: >
      케이스는 `packages/ui/src/**/*.cases.tsx` 자동 탐색으로 수집되며, 컴포넌트 디렉터리당
      케이스 수가 2 이상이고 렌더 노드 수가 0 인 케이스가 0건이다.
    acceptance: "`pnpm a11y:check --list` — 디렉터리별 케이스 수 ≥ 2 assert + 렌더 노드 0 케이스 수 = 0 assert, 총 케이스 수 stdout 출력"

  - id: REQ-4
    statement: >
      대비 계산과 CSS 변수 해석은 DS1 의 contrast.ts · resolve.ts 를 import 해 사용하며,
      DS6 소스 내 상대 휘도 계수 리터럴(0.2126 · 0.7152 · 0.0722)이 0건이다.
    acceptance: "`pnpm a11y:selftest --check contrast-source` — 두 모듈 import assert + 계수 리터럴 grep 0건"

  - id: REQ-5
    statement: >
      계약이 고정한 관측 규칙 — **관측 대상은 렌더 트리의 모든 텍스트 노드의 최근접 요소이고,
      배경은 비투명 배경을 만날 때까지 조상 체인을 합성하며, 이미지·그라디언트 배경은 `unknown_bg` 로
      분류한다** — 에 따라 수집한 (전경색, 배경색) 조합이 DS1 pairs.json 에 전부 등재되어 있고
      `unknown_bg` 건수가 0 이다. (R-6 — 채점 범위를 구현자가 좁히지 못하게 한다)
    acceptance: >
      `pnpm a11y:check --check pair-coverage` — 관측 조합 집합 ⊆ pairs.json 이고 미등재 건수 = 0,
      `unknown_bg` 건수 = 0, **관측 조합 총수를 stdout 출력(0 이면 exit 1)**.
      관측 규칙 위반 픽스처(투명 배경 중첩·이미지 배경)가 반드시 실패시키는 메타 테스트 포함

  - id: REQ-6
    statement: >
      targets.json 은 `{app, path, is_production}` 스키마를 따르며 **is_production=true 인 항목
      (= apps/web 의 `(dev)` 세그먼트가 아니고 noindex 가 아닌 라우트)을 1개 이상 포함**하고,
      각 항목에 대해 해당 앱을 `next build && next start` 로 기동해 5개 검사를 실행한다.
      (실환경 하한 REQ · R-7)
    acceptance: >
      `pnpm a11y:check --check routes` — 스키마 검증 + is_production=true 항목 수 ≥ 1 assert
      (0 이면 exit 1) + 각 라우트에서 5개 검사가 실행된 기록이 리포트에 존재.
      **W1-SEO-FOUNDATION 이 최초 프로덕션 라우트를 등재할 때까지는 DS6 를 머지할 수 없다**
      (dag_amendment (4) 참조 — 미승인 시 본 REQ 가 착수 차단 사유가 된다)

  - id: REQ-7
    statement: >
      eslint 규칙 세트가 packages/ui/src 와 apps/web/src 에서 (a) Tailwind arbitrary value,
      (b) JSX style 속성, (c) 색상 리터럴, (d) px 리터럴, (e) `--seed-color-palette-*` 직접 참조,
      (f) Tailwind 기본 팔레트 유틸리티(`bg-gray-*` · `text-{xs,sm,base,lg}` 등 토큰 외 유틸리티)를
      오류로 판정한다.
    acceptance: "위반 픽스처 6종 각각에 대해 `pnpm lint` exit ≠ 0, 6종 제외 시 exit 0"

  - id: REQ-8
    statement: >
      CI 워크플로에 job `ds-a11y` 가 존재해 PR 이벤트에서 실행되고,
      `.github/rulesets/main.json` 에 해당 job 이 필수 체크로 등재되어 있다.
    acceptance: >
      워크플로 파싱 테스트(job 존재 · pull_request 트리거 · continue-on-error 키 부재) +
      **ruleset 파일 파싱으로 required_status_checks 에 `ds-a11y` 존재 assert**
      (워크플로 파싱만으로는 브랜치 보호를 판정할 수 없으므로 리포지토리 ruleset 을 파일로 커밋한다)

# ─── 조건부 금지사항 ────────────────────
forbid:
  - id: FORBID-1
    when: >
      이 PR 의 diff 가 (a) constraints.json 값 하향, (b) `*.cases.tsx` 케이스 삭제 또는 skip 디렉티브 추가,
      (c) pairs.json 행 삭제 또는 role 을 body → secondary 로 강등, (d) targets.json 에서
      is_production=true 항목 삭제 중 하나 이상을 포함하는 경우
    must_not: >
      해당 변경으로 `a11y:check` 를 통과시키기 (컴포넌트 또는 토큰 쪽을 고칠 것).
      **예외 — DS7-PREVIEW-DOCS 의 targets 승계처럼 (삭제 건수 ≤ 추가 건수) 이고
      교체 후 is_production=true 항목 수가 줄지 않는 항목 교체는 허용한다.**
    because: >
      이 숫자들은 성능 목표가 아니라 "3050이 읽고 누를 수 있다"는 제품 정의다. 대상 삭제와 role 강등은
      더 나쁘다 — 화면에는 그대로 있는데 평가에서만 빠지거나 기준이 4.5 로 내려간다.
      **예외를 규칙 안에 두는 이유**: DS7 이 정상 작업(스모크 라우트 승계)에서 이 금지에 걸리면
      개발 에이전트가 라벨 우회를 학습하고, 그 관용구가 진짜 임계 하향에도 그대로 쓰인다(2차 감사 D-1 / P4).
    detect: >
      CI job `ds-a11y` — 위 4종 diff 패턴 검출 + 교체 예외 조건(삭제 ≤ 추가, 프로덕션 항목 수 비감소)
      자동 판정. 예외에 해당하지 않으면 (a) PR 라벨 `threshold-change-approved` **그리고**
      (b) GitHub API 조회로 확인한 CODEOWNERS 승인자 ≠ PR 작성자 를 **모두** 요구한다
      (라벨 단독은 작성자 자가 부여가 가능해 무력하다)
    on_violation: block_merge

  - id: FORBID-2
    when: >
      검사 로직·테스트에서 임계 숫자가 필요한 경우
    must_not: >
      숫자를 소스에 리터럴로 기술 (constraints.json 을 읽어 사용할 것)
    because: >
      숫자가 두 곳에 존재하면 constraints 를 올려도 검사는 옛 값으로 통과한다. 화면은 미달인데
      CI 는 초록인 상태가 만들어지고, 그 상태는 사용자 제보가 오기 전까지 아무도 탐지하지 못한다.
    detect: >
      변이 테스트 — constraints.json 의 6개 키를 각각 극단값으로 치환한 6회 실행이 각각 반드시
      exit ≠ 0 임을 검증 + a11y/ 소스의 임계 숫자 리터럴 grep 0건
    on_violation: block_merge

  - id: FORBID-3
    when: >
      등록된 케이스 또는 targets.json 라우트가 렌더 예외 · 타임아웃 · 404 · 앱 미지정으로
      검사되지 못한 경우
    must_not: >
      해당 항목을 통과로 집계하거나 건너뛰고 exit 0 으로 종료
    because: >
      렌더 실패가 곧 "검사 없음"이 되면 가장 깨지기 쉬운 컴포넌트와 페이지가 자동으로 검사망을
      빠져나간다. 검사 대상이 줄어드는 방향의 실패는 리포트에서 초록으로 보여 아무도 알아채지 못하고,
      게이트는 존재하지만 아무것도 막지 못하는 상태가 된다. 특히 targets 항목의 `app` 필드를
      해석하지 못했을 때 skip 하는 구현은 이 금지의 정면 위반이다.
    detect: >
      `pnpm a11y:selftest` — throw 하는 케이스 픽스처 · 존재하지 않는 라우트 · 미지정 app 필드를
      포함한 실행이 exit ≠ 0 이고 리포트에 error 로 집계되는지 검증
      (검사 시도 수 = 발견 대상 수 assert)
    on_violation: block_merge

  - id: FORBID-4
    when: >
      CI 에서 job `ds-a11y` 가 실패한 상태에서 워크플로 또는 소스 diff 에
      `continue-on-error: true` · `|| true` · `eslint-disable` 이 신규 추가되거나
      `.github/rulesets/main.json` 의 required_status_checks 에서 `ds-a11y` 가 제거되는 경우
    must_not: >
      그 변경으로 머지 (원인 수정 또는 태스크 반려로 대응)
    because: >
      DS4·DS5 와 이후 W 태스크의 FORBID 다수가 이 job 을 유일한 탐지 수단으로 지목한다.
      우회 관용구가 한 번 허용되면 그 FORBID 들이 동시에 장식이 되고, 개발 에이전트는 다른 금지사항도
      협상 가능한 것으로 학습한다(F1-REPO-SCAFFOLD FORBID-2 와 동일한 실패 모드).
    detect: >
      F1 `lint` job 에 **본 PR 이 추가하는 diff 스텝**(out_of_scope 의 명시적 예외) — 3종 우회 관용구
      신규 추가 검출 시 실패 + ruleset 파일 파싱으로 required_status_checks 에 `ds-a11y` 존재 assert.
      브랜치 보호를 파일로 커밋했으므로 워크플로 파싱만으로 판정 불가라는 문제가 해소된다
    on_violation: block_merge

  - id: FORBID-5
    when: >
      checks.manifest.json 에 등재된 검사 항목을 자동 판정이 어렵다는 이유로 제거하려는 경우
    must_not: >
      해당 항목을 리뷰 체크리스트 문서로 이관하고 러너에서 삭제
    because: >
      DS4-PRICE-COMPARE-CARD 의 FORBID-1·4 와 DS5-CORE-COMPONENTS 의 FORBID-3 가 이 매니페스트의
      검사 이름을 detect 로 지목하고 있다. 항목이 문서로 빠지는 순간 그 FORBID 들이 동시에
      탐지 불능이 되고, 계약서에는 여전히 "검사가 잡는다"고 적힌 채로 남는다.
    detect: >
      CI job `ds-a11y` — 매니페스트 등재 검사 이름이 러너에 실재하고 해당 실행에서 1회 이상
      수행되었는지 리포트로 대조, 1건이라도 부재하면 exit 1 (매니페스트는 CODEOWNERS 보호 대상)
    on_violation: block_merge

  - id: FORBID-6
    when: >
      DS1 의 contrast.ts · resolve.ts · constraints.json · pairs.json 이 검사에 맞지 않아
      수정이 필요해진 경우
    must_not: >
      packages/ui/styles/** 또는 packages/ui/tokens/** 를 이 PR 에서 수정
      (DS1 변경을 요청하고 본 태스크는 중단할 것)
    because: >
      집행자가 자기가 집행할 기준과 계산기를 직접 고치기 시작하면, 통과하지 못하는 검사는 언제나
      계산기 쪽을 고쳐 통과시킬 수 있게 된다. 게이트와 기준이 같은 손에 있으면 게이트가 아니다.
    detect: >
      CI path guard — 이 PR 의 diff 에 packages/ui/styles/** 또는 packages/ui/tokens/** 가
      포함되면 exit 1
    on_violation: block_merge

# ─── 경계 ───────────────────────────────
out_of_scope:
  - "임계 상수 값의 결정·변경 → DS1-TOKEN-LAYERS 소관. 본 태스크는 읽어서 집행만 한다"
  - "대비 계산·CSS 변수 해석 구현 → DS1-TOKEN-LAYERS 소관. 재구현 금지"
  - "pairs.json 페어 추가·수정 → DS1-TOKEN-LAYERS 소관 (본 태스크는 미등재 조합을 탐지해 실패시킬 뿐이다)"
  - "컴포넌트 구현·수정 → DS4-PRICE-COMPARE-CARD · DS5-CORE-COMPONENTS 소관"
  - "프리뷰/문서 사이트 → DS7-PREVIEW-DOCS 소관"
  - "W 화면 라우트 구현 → W1~W7 소관 (본 태스크는 존재하는 라우트를 targets.json 에 등재해 검사만 한다)"
  - "스크린리더 실사용 테스트 · 사용자 조사 (자동 검사 범위 밖)"
  - "F1 이 만든 eslint 프리셋의 수정 (신규 규칙 파일 추가만 허용). **단 F1 `lint` job 에 우회 관용구 diff 스텝을 추가하는 것은 FORBID-4 집행에 필요하므로 규칙 안의 명시적 예외로 허용한다**"

rollback: >
  `git revert <merge-sha>` 로 packages/ui/a11y/** · eslint 규칙 파일 · CI job · CODEOWNERS 규칙이
  함께 제거된다. 되돌리는 즉시 DS4·DS5 의 REQ(a11y:check 통과)와 다수 FORBID 의 탐지 수단이 사라지므로,
  DS4·DS5 가 이미 머지된 상태에서는 revert 대신 수정 PR 을 우선한다.
  불가피하게 되돌리는 경우 팀 리드에게 "탐지 공백 구간"을 명시적으로 보고하고,
  브랜치 보호 필수 체크에서 `ds-a11y` 를 함께 해제한다.

done_when:
  - "`pnpm a11y:check` 가 클린 상태에서 exit 0, 위반 픽스처 5종 각각에서 exit ≠ 0"
  - "`pnpm a11y:selftest` 가 렌더 실패 · 존재하지 않는 라우트 · 미지정 app · constraints 변이 6케이스에서 전부 실패를 재현"
  - "케이스 수 0 · is_production 라우트 0 인 상태에서 실행이 exit 1 임을 확인 (빈 게이트 방지)"
  - "**is_production=true 인 apps/web 라우트 최소 1개**에서 5개 검사가 수행된 기록이 리포트에 존재"
  - "pair-coverage 가 계약 고정 관측 규칙으로 조합을 수집하고, 관측 조합 총수 · 미등재 목록 · unknown_bg 건수를 출력함을 확인"
  - "eslint 위반 픽스처 6종이 각각 lint 를 실패시킴 (Tailwind 기본 팔레트 유틸리티 포함)"
  - "checks.manifest.json 의 검사 이름이 러너에 실재하며 DS4·DS5 계약이 지목한 이름과 일치"
  - "`.github/rulesets/main.json` 의 required_status_checks 에 `ds-a11y` 가 등재되고 파싱 테스트가 통과"
  - "constraints.json · pairs.json · targets.json · checks.manifest.json 이 CODEOWNERS 보호 경로에 포함됨"
  - "**상신**: W1-SEO-FOUNDATION 계약에 프로덕션 라우트 등재 REQ 신설, W2·W3·W4 done_when 에 자기 라우트 등재 항목 추가를 팀 리드에 등록"
  - "touches 경로 밖 변경 파일 0개 (CI path guard 통과)"
```
