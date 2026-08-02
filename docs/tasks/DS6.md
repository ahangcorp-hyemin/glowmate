# DS6 — 3050 접근성 게이트 (대비 · 최소 폰트 · 터치타깃) **CI 강제**

> 계약 규격: [02-task-contract-spec.md](../02-task-contract-spec.md) §1
> 상태: 착수 가능 (DS1 완료 후) · ⛔G5 = **옵션 A** (컴포넌트 출처와 무관하게 동일 임계 집행)

## 설계 전제 — 이 태스크가 다른 태스크들의 `detect` 를 공급한다

DS4·DS5 와 이후 W2·W3 의 FORBID 다수가 "DS6 의 검사가 잡는다"를 탐지 수단으로 지목한다.
따라서 본 태스크의 실패 모드는 "검사가 미흡함"이 아니라 **"검사가 존재한다고 선언되었는데 실제로는 비어 있음"** 이다.

### 이 게이트가 비어 있게 되는 3가지 경로 — 전부 계약으로 막는다

| 경로 | 결과 | 차단 장치 |
|---|---|---|
| **① 검사 대상이 0건** | 케이스 파일이 없거나 탐색에 실패해도 exit 0 → 만점 게이트 | REQ-3 (하한 = 컴포넌트 디렉터리 수, 0 이면 실패) |
| **② 픽스처만 검사** | 컴포넌트는 통과하는데 실제 페이지는 미달 | REQ-6 실환경 하한 — 실행 중인 Next 라우트를 반드시 1개 이상 검사 (R-7) |
| **③ 시험지를 좁힘** | 구현자가 pairs.json 에 쉬운 조합만 등재 | REQ-5 — 실제 렌더에서 **관측된** (fg,bg) 조합이 pairs.json 에 전부 등재되어 있어야 함 (R-6) |

**R-6 고지** — 대비 평가의 "시험지"인 `pairs.json` 은 DS1 구현자가 작성한다(자기 출제).
본 태스크는 그 시험지를 **실제 렌더에서 관측한 조합**과 대조해, 등재되지 않은 조합이 화면에 존재하면
게이트를 실패시킨다. 즉 평가 대상은 구현자가 고른 표본이 아니라 **렌더된 화면 전수**다.

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
depends_on:    [DS1-TOKEN-LAYERS, DS3-BASE-WIRING]   # ⚠ DAG 수정 제안 — 아래 dag_amendment 참조
blocks:        [W2-DISCOVERY-LIST, W3-VENUE-DETAIL]
parallel_with: [DS4-PRICE-COMPARE-CARD, DS5-CORE-COMPONENTS]
gate:          null      # ⛔G5 와 독립. 컴포넌트 출처와 무관하게 동일 임계를 집행한다

# ⚠ dag_amendment (팀 리드 승인 필요)
#   03-task-dag.md 는 DS6 의 의존을 DS1 단독으로 둔다. 그러나 개정 규격 R-7(실환경 하한)을 충족하려면
#   REQ-6 이 "실행 중인 Next 라우트 최소 1개"를 검사해야 하고, 그 라우트는 DS3 이 만드는
#   wiring-smoke 가 최초 대상이다. DS3 없이 머지하면 targets.json 이 비어 REQ-6 이 구조적으로 불가능하고,
#   그 상태를 허용하면 정확히 "빈 게이트"(위 ② 경로)가 된다.
#   → DAG 에 DS3 → DS6 간선 추가를 제안한다. DS4·DS5 와의 병렬성은 그대로 유지된다.

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
    - .github/workflows/ci.yml                         # job `ds-a11y` 추가만 (기존 job 수정 금지)
    - .github/CODEOWNERS                               # constraints.json · pairs.json · manifest 보호 규칙 추가만
  artifacts:
    - "`pnpm a11y:check` — 케이스 자동 탐색 + 실행 중 라우트 검사, 위반 1건이면 exit ≠ 0"
    - "checks.manifest.json — DS4·DS5·W 계약이 detect 로 지목하는 검사 이름의 계약 목록"
    - "targets.json — 실환경 검사 대상 라우트 (최소 1개 필수)"
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
      packages/ui/a11y/ 아래 검사·테스트 소스의 임계 숫자 리터럴(7.0 · 4.5 · 17 · 14 · 48) 개수가 0 이다.
    acceptance: "변이 테스트 — constraints 의 5개 키를 각각 극단값으로 치환한 5회 실행이 전부 exit ≠ 0 + 숫자 리터럴 grep 0건"

  - id: REQ-3
    statement: >
      검사 대상 케이스는 `packages/ui/src/**/*.cases.tsx` 자동 탐색으로 수집되며, 수집된 케이스 수가
      packages/ui/src/components 하위 컴포넌트 디렉터리 수 이상이고,
      전체 검사 대상 수(케이스 + targets.json 라우트)가 1 이상이다.
      (본 태스크 머지 시점에는 DS4·DS5 미머지로 컴포넌트 디렉터리가 0 일 수 있으나,
       DS3 의 실라우트가 대상에 포함되므로 총합은 1 이상이어야 한다)
    acceptance: >
      `pnpm a11y:check --list` — 케이스 수 ≥ 컴포넌트 디렉터리 수 assert +
      (케이스 수 + 라우트 수) = 0 이면 exit 1

  - id: REQ-4
    statement: >
      대비 계산과 CSS 변수 해석은 DS1 의 contrast.ts · resolve.ts 를 import 해 사용하며,
      DS6 소스 내 상대 휘도 계수 리터럴(0.2126 · 0.7152 · 0.0722)이 0건이다.
    acceptance: "`pnpm a11y:selftest --check contrast-source` — 두 모듈 import assert + 계수 리터럴 grep 0건"

  - id: REQ-5
    statement: >
      검사 실행 중 실제 렌더에서 관측된 모든 (전경색, 배경색) 조합이 DS1 의 pairs.json 에 등재되어 있으며,
      미등재 조합 건수가 0 이다. (R-6 — 평가 대상을 구현자가 좁히지 못하게 한다)
    acceptance: "`pnpm a11y:check --check pair-coverage` — 관측 조합 집합 ⊆ pairs.json 조합 집합, 미등재 건수 = 0 assert (미등재 목록을 stdout 출력)"

  - id: REQ-6
    statement: >
      `next build && next start` 로 실행한 서버의 targets.json 등재 라우트(최소 1개)에 대해
      동일한 5개 검사가 실행되며, targets.json 이 비어 있으면 검사가 exit 1 로 종료한다. (실환경 하한 REQ)
    acceptance: "`pnpm a11y:check --check routes` — targets 길이 ≥ 1 assert + 각 라우트에서 5개 검사 실행 기록 존재, 빈 targets 로 실행 시 exit 1"

  - id: REQ-7
    statement: >
      eslint 규칙 세트가 packages/ui/src 와 apps/web/src 에서 (a) Tailwind arbitrary value,
      (b) JSX style 속성, (c) 색상 리터럴, (d) px 리터럴, (e) `--seed-color-palette-*` 직접 참조를
      오류로 판정한다.
    acceptance: "위반 픽스처 5종 각각에 대해 `pnpm lint` exit ≠ 0, 5종 제외 시 exit 0"

  - id: REQ-8
    statement: >
      CI 워크플로에 job `ds-a11y` 가 존재해 PR 이벤트에서 실행되고 브랜치 보호 필수 체크에 등록되며,
      axe 검사의 impact critical/serious 위반이 0건이다.
    acceptance: "워크플로 파싱 테스트(job 존재 · pull_request 트리거 · continue-on-error 키 부재) + `--check axe` critical/serious 카운트 0"

# ─── 조건부 금지사항 ────────────────────
forbid:
  - id: FORBID-1
    when: >
      `pnpm a11y:check` 가 실패한 상태에서 이를 통과시키려는 변경을 만들 때
    must_not: >
      constraints.json 의 값을 낮추거나, 실패한 케이스 파일·pairs.json 페어·targets.json 라우트를
      삭제·skip 처리 (컴포넌트 또는 토큰 쪽을 고칠 것)
    because: >
      이 숫자들은 성능 목표가 아니라 "3050이 읽고 누를 수 있다"는 제품 정의 자체다. 낮추면 실패가
      사라지는 게 아니라 제품 대상이 조용히 바뀌고, 이후 H4·H5 가 낮게 나와도 원인이 가독성인지
      가설인지 영원히 구분할 수 없게 된다. 대상 삭제는 더 나쁘다 — 화면에는 그대로 있는데
      평가 대상에서만 빠지므로 시험지를 좁혀 통과하는 것과 같다.
    detect: >
      CI job `ds-a11y` — constraints.json · pairs.json · targets.json 이 CODEOWNERS 보호 경로이며,
      diff 에 임계 하향 또는 항목 삭제가 포함되고 PR 라벨 `threshold-change-approved` 가 없으면 exit 1.
      페어 삭제는 REQ-5 의 pair-coverage 검사가 별도로 잡는다
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
      변이 테스트 — constraints.json 의 각 키를 극단값으로 치환한 5회 실행이 각각 반드시 exit ≠ 0
      임을 검증 + a11y/ 소스의 임계 숫자 리터럴 grep 0건
    on_violation: block_merge

  - id: FORBID-3
    when: >
      등록된 케이스 또는 targets.json 라우트가 렌더 예외 · 타임아웃 · 404 · 모듈 로드 실패로
      검사되지 못한 경우
    must_not: >
      해당 항목을 통과로 집계하거나 건너뛰고 exit 0 으로 종료
    because: >
      렌더 실패가 곧 "검사 없음"이 되면, 가장 깨지기 쉬운 컴포넌트와 페이지가 자동으로 검사망을
      빠져나간다. 검사 대상이 줄어드는 방향의 실패는 리포트에서 초록으로 보이기 때문에
      누구도 알아채지 못하며, 게이트는 존재하지만 아무것도 막지 못하는 상태가 된다.
    detect: >
      `pnpm a11y:selftest` — 의도적으로 throw 하는 케이스 픽스처와 존재하지 않는 라우트를 포함한 실행이
      exit ≠ 0 이고 리포트에 error 로 집계되는지 검증 (검사 시도 수 = 발견 대상 수 assert)
    on_violation: block_merge

  - id: FORBID-4
    when: >
      CI 에서 job `ds-a11y` 가 실패했을 때
    must_not: >
      워크플로에 `continue-on-error: true` · `|| true` 를 추가하거나 job 을 필수 체크에서 해제,
      또는 eslint-disable 주석으로 규칙을 무력화
    because: >
      DS4·DS5 와 이후 W 태스크의 FORBID 다수가 이 job 을 유일한 탐지 수단으로 지목한다.
      우회 관용구가 한 번 허용되면 그 FORBID 들이 동시에 장식이 되고, 개발 에이전트는 다른 금지사항도
      협상 가능한 것으로 학습한다(F1-REPO-SCAFFOLD FORBID-2 와 동일한 실패 모드).
    detect: >
      CI job `lint` — 워크플로/소스 diff 에 continue-on-error · `|| true` · eslint-disable 신규 추가가
      있으면 실패 + 워크플로 파싱 테스트로 필수 체크 목록에 `ds-a11y` 존재 assert
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
      CI job `ds-a11y` — checks.manifest.json 에 등재된 모든 검사 이름이 러너에 실제로 존재하고
      해당 실행에서 1회 이상 수행되었는지 리포트로 대조, 1건이라도 부재하면 exit 1
      (매니페스트 자체가 CODEOWNERS 보호 대상)
    on_violation: block_merge

  - id: FORBID-6
    when: >
      DS1 의 contrast.ts · resolve.ts · constraints.json 의 동작이 검사에 맞지 않아 수정이 필요해진 경우
    must_not: >
      packages/ui/styles/** 또는 packages/ui/tokens/** 를 이 PR 에서 수정
      (DS1 변경을 요청하고 본 태스크는 중단할 것)
    because: >
      집행자가 자기가 집행할 기준과 계산기를 직접 고치기 시작하면, 통과하지 못하는 검사는
      언제나 계산기 쪽을 고쳐 통과시킬 수 있게 된다. 게이트와 기준이 같은 손에 있으면 게이트가 아니다.
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
  - "F1 이 만든 기존 CI job · eslint 프리셋의 수정 (신규 파일·job 추가만 허용)"

rollback: >
  `git revert <merge-sha>` 로 packages/ui/a11y/** · eslint 규칙 파일 · CI job · CODEOWNERS 규칙이
  함께 제거된다. 되돌리는 즉시 DS4·DS5 의 REQ(a11y:check 통과)와 다수 FORBID 의 탐지 수단이 사라지므로,
  DS4·DS5 가 이미 머지된 상태에서는 revert 대신 수정 PR 을 우선한다.
  불가피하게 되돌리는 경우 팀 리드에게 "탐지 공백 구간"을 명시적으로 보고하고,
  브랜치 보호 필수 체크에서 `ds-a11y` 를 함께 해제한다.

done_when:
  - "`pnpm a11y:check` 가 클린 상태에서 exit 0, 위반 픽스처 5종 각각에서 exit ≠ 0"
  - "`pnpm a11y:selftest` 가 렌더 실패 픽스처 · 존재하지 않는 라우트 · constraints 변이 5케이스에서 전부 실패를 재현"
  - "케이스 수 0 · targets 0 인 상태에서 실행이 exit 1 임을 확인 (빈 게이트 방지)"
  - "실행 중인 Next 라우트 최소 1개에서 5개 검사가 수행된 기록이 리포트에 존재"
  - "pair-coverage 검사가 관측 조합과 pairs.json 을 대조하고 미등재 목록을 출력함을 확인"
  - "eslint 위반 픽스처 5종이 각각 lint 를 실패시킴"
  - "checks.manifest.json 의 검사 이름이 러너에 실재하며 DS4·DS5 계약이 지목한 이름과 일치"
  - "CI job `ds-a11y` 가 브랜치 보호 필수 체크로 등록되고, constraints.json · pairs.json · targets.json · manifest 가 CODEOWNERS 보호 경로에 포함됨"
  - "touches 경로 밖 변경 파일 0개 (CI path guard 통과)"
```
