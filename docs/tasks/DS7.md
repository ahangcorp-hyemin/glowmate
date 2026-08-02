# DS7 — 프리뷰 / 문서화 (컴포넌트 갤러리 · 토큰 문서)

> 계약 규격: [02-task-contract-spec.md](../02-task-contract-spec.md) §1 (원칙 2.5 · R-6 · R-7 포함)
> 상태: **수정본 (2차 감사 REVISE 반영)** · ⛔G5 = 옵션 A

## 설계 전제 — 원천은 코드다

프리뷰와 문서는 **새로운 진실을 만들지 않는다.** 표시 대상은 이미 존재하는 두 가지뿐이다.

- 컴포넌트 예시 → DS4·DS5 가 등록한 **케이스 레지스트리**(`*.cases.tsx`)
- 토큰 값 → **실행 중인 페이지의 계산된 CSS 변수**
  (Style Dictionary 를 폐기했으므로 `tokens.ts` 같은 생성 상수 파일은 존재하지 않는다.
   `getComputedStyle(document.documentElement)` 로 `--seed-*` / `--color-*` 변수를 런타임 열거해 렌더한다 —
   화면에 실제로 적용된 값과 문서가 정의상 어긋날 수 없다)

이 규약이 깨지는 순간(프리뷰 전용 예시 데이터, 손으로 적은 색상 코드, 캡처 이미지)
문서는 코드와 다른 두 번째 원천이 되고, 개발자는 문서를 믿고 **검사받지 않은 조합**을 만든다.

**DS6 검사 대상 승계 — 프로덕션 라우트 수를 줄이지 않는다**

DS3 의 `wiring-smoke` 는 DS6 실환경 검사 대상(`targets.json`)의 초기 항목이다.
2차 감사가 지적한 두 결함을 함께 해소한다.

1. **자기 차단** — targets 에서 항목을 지우는 것은 DS6 FORBID-1 에 걸린다. 그대로 두면 개발 에이전트가
   `threshold-change-approved` 라벨로 우회하고, **임계 보호 장치를 무력화하는 관용구를 정상 작업에서 학습**한다.
   → DS6 FORBID-1 에 "(삭제 ≤ 추가) 이고 프로덕션 라우트 수 비감소인 **교체**는 허용" 예외를 넣었고,
   본 계약 REQ-6 이 그 조건을 검증한다.
2. **실환경 대상의 후퇴** — 승계 후 유일 항목이 비배포 프리뷰 앱이 되면 R-7 하한이 형식만 남는다.
   → REQ-6 은 길이가 아니라 **`is_production=true` 항목 수의 비감소**를 요구한다.
   프리뷰 라우트는 `is_production=false` 로 등재되므로 프로덕션 대상을 대체할 수 없다.

```yaml
# ─── 식별 ───────────────────────────────
id:            DS7-PREVIEW-DOCS
dag_id:        DS7
title:         프리뷰/문서화 — 케이스 레지스트리 기반 컴포넌트 갤러리 + 런타임 토큰 문서
workstream:    web
owner_agent:   dev-web

# ─── 존재 이유 ──────────────────────────
traces_to:     [H4, H5]
why:           "W2·W3 를 구현할 에이전트가 컴포넌트의 상태별 정확한 사용법(특히 가격 상태 4종)을
                실행되는 형태로 확인하지 못하면, 각자 해석해 가격 상태 구분이 화면마다 달라진다."

# ─── DAG ────────────────────────────────
depends_on:    [DS4-PRICE-COMPARE-CARD, DS5-CORE-COMPONENTS, DS6-A11Y-GATE]   # ⚠ dag_amendment 참조
blocks:        []
parallel_with: [W1-SEO-FOUNDATION]
gate:          null      # ⛔G5 는 DS0 산출로 해소됨(옵션 A)

# ⚠ dag_amendment (팀 리드 승인 필요)
#   03-task-dag.md 는 DS7 을 DS6 와 병렬로 둔다. 그러나 REQ-6 이 DS6 산출물(targets.json)을 직접 수정하고
#   `a11y:check` 를 실행하며, DS6 FORBID-1 의 교체 예외 조건을 전제로 한다.
#   병렬로 두면 DS7 이 먼저 머지될 때 수정 대상 파일도 검사 명령도 존재하지 않는다(2차 감사 P3 / E).
#   → DAG 에 DS6 → DS7 간선 추가를 제안한다.

# ─── 산출물 ─────────────────────────────
deliverable:
  pr_count:    1
  touches:
    - apps/preview/**                                  # 독립 프리뷰 앱 (프로덕션 배포 대상 아님)
    - apps/preview/src/registry.ts                     # 케이스 레지스트리 자동 수집
    - apps/preview/src/pages/tokens.tsx                # 런타임 CSS 변수 열거 기반 토큰 문서
    - apps/preview/test/**
    - packages/ui/package.json                         # exports 키 추가만
    - packages/ui/a11y/targets.json                    # 프리뷰 라우트 등재 (대상 수 유지)
    - packages/config/test/workspace.test.ts           # 워크스페이스 패키지 수 기대값 +1 갱신 1건만
    - .github/workflows/ci.yml                         # job `preview-build` 추가만 (기존 job 수정 금지)
    - apps/web/src/app/(dev)/wiring-smoke/**           # DS3 임시 스모크 라우트 제거 (조건부 — REQ-6)
  artifacts:
    - "프리뷰 앱 — 케이스 레지스트리를 유일 데이터 소스로 하는 컴포넌트 갤러리"
    - "토큰 문서 페이지 — 실행 중 페이지에서 CSS 변수를 열거해 렌더 (하드코딩 0건)"
    - "레지스트리 ↔ 프리뷰 엔트리 일치 검사"
    - "프로덕션 미노출 검사 (빌드 라우트·sitemap·번들)"
    - "CI job `preview-build`"

# ─── 요구사항 ───────────────────────────
requirements:
  - id: REQ-1
    statement: >
      프리뷰 엔트리 id 집합과 packages/ui 케이스 레지스트리 id 집합의 대칭차집합이 0 이다.
    acceptance: "`pnpm test:preview --check parity` — 대칭차집합 크기 = 0 assert"

  - id: REQ-2
    statement: >
      수집된 케이스 수가 16 이상이다 (DS4 4건 + DS5 12건 하한). — 공집합에서 대칭차집합이
      자명하게 0 이 되는 경로 차단
    acceptance: "`pnpm test:preview --check registry-size` — 케이스 수 ≥ 16 assert, 실측 수 stdout 출력(0 이면 exit 1)"

  - id: REQ-3
    statement: >
      토큰 문서 페이지에 DS1 의 가격 상태 12개 토큰 전건과 glowmate 브랜드 팔레트 전 단계가
      행으로 렌더된다. (문서 내용 하한)
    acceptance: >
      Playwright `--check token-doc` — 렌더된 토큰 행의 키 집합이 semantic.css 의 가격 상태 12개와
      brand-palette.json 의 전 단계를 포함하는지 assert, 누락 키 목록 stdout 출력

  - id: REQ-4
    statement: >
      apps/preview 소스에 색상 리터럴·px 리터럴과 packages/ui 컴포넌트 직접 사용 JSX 가 0건이며,
      모든 예시가 케이스 render() 호출로만 생성된다.
    acceptance: "`pnpm test:preview --check no-local-fixtures` — 리터럴 grep 0건 + 컴포넌트 직접 JSX·createElement AST 검사 0건 (REQ-1 parity 가 실질 방어를 병행한다)"

  - id: REQ-5
    statement: >
      `next build` 로 생성한 apps/web 라우트 목록에 프리뷰 경로가 0건이고, sitemap 출력에
      프리뷰 URL 이 0건이며, apps/web 번들이 apps/preview 를 import 하지 않는다. (실환경 하한 REQ)
    acceptance: "`pnpm test:preview --check not-published` — 빌드 라우트 목록·sitemap 항목 grep 0건 + dependency-cruiser 로 web→preview import 0건, 검사한 라우트 총수 stdout 출력"

  - id: REQ-6
    statement: >
      wiring-smoke 라우트를 제거한 뒤 targets.json 의 `is_production=true` 항목 수가
      제거 전 이상이며, 프리뷰 라우트는 `is_production=false` 로 등재된다.
    acceptance: >
      `pnpm test:preview --check a11y-targets` — 제거 전후 is_production=true 항목 수 비교(감소 시 exit 1) +
      프리뷰 항목의 is_production === false assert + `pnpm a11y:check` exit 0

  - id: REQ-7
    statement: >
      각 컴포넌트 문서의 props 표가 TypeScript 타입에서 자동 생성되며 수기 props 표 마크업이 0건이다.
    acceptance: "`pnpm test:preview --check props-table` — 생성기 출력과 렌더된 표 행 집합 일치 + 수기 표 마크업 grep 0건"

  - id: REQ-8
    statement: >
      CI 워크플로에 job `preview-build` 가 존재해 PR 이벤트에서 실행되고, 실패 시 머지가 차단된다.
    acceptance: "워크플로 파싱 테스트 — job 존재 + pull_request 트리거 + continue-on-error 키 부재 assert + `.github/rulesets/main.json` 에 등재"

# ─── 조건부 금지사항 ────────────────────
forbid:
  - id: FORBID-1
    when: >
      프리뷰 또는 문서에 컴포넌트의 시각 예시를 추가할 때
    must_not: >
      정적 스크린샷 이미지(.png/.jpg/.webp) · Figma 임베드 · 디자인 파일 링크를 예시로 사용
    because: >
      코드가 바뀌어도 이미지는 그대로 남는다. W2·W3 를 구현할 에이전트가 이미지 기준으로 구현하면
      실제 컴포넌트와 다른 화면이 만들어지고, "원천은 코드"라는 이 워크스트림의 전제가 무너진다.
      특히 가격 상태 4종의 시각 구분이 이미지와 코드에서 어긋나면 어느 쪽이 맞는지 판정할 수 없다.
    detect: >
      `pnpm test:preview --check no-image-source` — apps/preview 소스 및 문서 마크다운에서
      이미지 확장자 참조와 figma.com URL 매칭 0건 assert
    on_violation: block_merge

  - id: FORBID-2
    when: >
      프리뷰에서만 필요한 여백·크기·배경 보정이 필요한 경우
    must_not: >
      packages/ui/src/components/** 또는 packages/ui/styles/** 를 수정 (프리뷰 쪽 래퍼로 해결할 것)
    because: >
      갤러리에서 보기 좋게 만들려고 넣은 여백이 제품 컴포넌트에 남아 W2 리스트에서 카드 간격이
      벌어지고, DS4 카드에서는 상태 배지 위치가 밀린다. 원인이 프리뷰 PR 이라는 사실은
      몇 주 뒤에는 아무도 기억하지 못한다.
    detect: >
      CI path guard — 이 PR 의 diff 에 packages/ui/src/components/** 또는 packages/ui/styles/**
      이 포함되면 exit 1
    on_violation: block_merge

  - id: FORBID-3
    when: >
      프리뷰를 apps/web 도메인 하위 라우트로 노출하거나 프로덕션 빌드에 포함시키는 경우
    must_not: >
      해당 라우트를 sitemap · robots 허용 · 정적 생성 대상에 포함
    because: >
      미완성 컴포넌트 갤러리가 색인되면 텍스트가 거의 없는 저품질 페이지 수십 개가 도메인 전체 평가를
      끌어내린다. 채널 1순위가 SEO 인 제품에서 이는 H3(롱테일 1페이지 진입) 가설의 측정 자체를 오염시키고,
      색인 제거에는 수 주가 걸린다.
    detect: >
      REQ-5 의 `--check not-published` — 실제 `next build` 라우트 목록·sitemap 출력에 프리뷰 경로 0건 +
      web→preview import 0건 assert. 검사한 라우트 총수를 stdout 출력해 빌드 실패로 목록이 비었을 때
      자명 통과하는 경로를 차단한다
    on_violation: block_merge

  - id: FORBID-4
    when: >
      케이스 레지스트리에 없는 조합(새 variant · 새 상태 조합)을 프리뷰에 보여주고 싶은 경우
    must_not: >
      apps/preview 안에 별도 예시 데이터를 정의해 렌더 (해당 조합을 *.cases.tsx 에 추가하도록
      DS4·DS5 소관 PR 을 요청할 것)
    because: >
      프리뷰에만 있는 조합은 DS6 의 접근성 검사(대비·터치타깃·리플로)와 페어 커버리지 검사를 받지 않는다.
      개발자는 "문서에 있으니 승인된 조합"이라 판단해 그대로 화면에 쓰고, 검사받지 않은 조합이
      제품에 들어간다. 검사망 밖의 예시를 공식 문서에 싣는 것이 가장 나쁜 형태의 우회다.
    detect: >
      REQ-1 `--check parity`(대칭차집합 0) **와 REQ-2 `--check registry-size`(케이스 ≥ 16)를 함께** 판정.
      parity 단독은 양쪽이 공집합일 때 자명 참이 되므로 크기 하한이 반드시 병행되어야 한다
    on_violation: block_merge

  - id: FORBID-5
    when: >
      apps/web 의 wiring-smoke 라우트를 제거하면서 targets.json 을 변경하는 경우
    must_not: >
      제거 후 `is_production=true` 항목 수를 제거 전보다 줄이거나, 프리뷰 라우트를
      `is_production=true` 로 등재해 프로덕션 대상을 대체한 것처럼 계상
    because: >
      wiring-smoke 는 DS6 실환경 검사(R-7)의 초기 대상이다. 프로덕션 대상 수가 줄면 게이트는
      픽스처와 비배포 앱만 검사하는 상태로 되돌아가고, "실제 페이지는 대비 미달인데 CI 는 초록"이
      가능해진다. 프리뷰 앱은 계약상 배포 대상이 아니므로 그것으로 프로덕션 표면을 대체하면
      하한이 형식만 남는다.
    detect: >
      REQ-6 `--check a11y-targets` — 제거 전후 is_production=true 항목 수 비교(감소 시 exit 1) +
      프리뷰 항목의 is_production === false assert. DS6 FORBID-1 의 교체 예외
      (삭제 ≤ 추가 · 프로덕션 수 비감소)와 동일 조건이라 라벨 우회 없이 정상 경로로 통과한다
    on_violation: block_merge

  - id: FORBID-6
    when: >
      문서에 3050 접근성 임계값(최소 폰트 · 대비비 · 터치 타깃)을 기술할 때
    must_not: >
      숫자를 문서 텍스트에 직접 적기 (constraints.json 값을 읽어 렌더할 것)
    because: >
      문서 숫자와 constraints.json 이 갈라지면 개발자는 문서를 믿고 미달 컴포넌트를 만들고,
      CI 에서 뒤늦게 막힌 뒤 "문서가 그렇게 되어 있다"며 임계 하향을 요구하게 된다.
      DS6-A11Y-GATE 의 FORBID-1 이 지키려는 임계가 문서 경유로 협상 대상이 된다.
    detect: >
      `pnpm test:preview --check threshold-prose` — 문서 소스에서 (a) 임계 숫자 리터럴,
      (b) 임계를 산문화하는 표현("AA" · "AAA" · "수준" · "기준" 이 대비·폰트·타깃 문맥에 인접)
      2종 패턴 grep 0건 + constraints.json 을 읽어 렌더하는 컴포넌트 사용 assert
    on_violation: block_merge

# ─── 경계 ───────────────────────────────
out_of_scope:
  - "컴포넌트 구현·수정 및 케이스 추가 → DS4-PRICE-COMPARE-CARD · DS5-CORE-COMPONENTS 소관"
  - "토큰 값·브랜드 팔레트 변경 → DS1-TOKEN-LAYERS 소관"
  - "접근성 검사 하네스 구현·임계 변경 → DS6-A11Y-GATE 소관 (본 태스크는 targets.json 에 라우트 1건 등재만)"
  - "프리뷰 앱의 외부 배포(URL 공개·인증 게이트 구성) — 본 태스크는 로컬/CI 빌드까지"
  - "디자인 가이드라인 산문 · 브랜드 스토리 · 일러스트"
  - "W 화면 스크린샷 · 사용자 플로우 문서"
  - "Chromatic 등 유료 시각 회귀 서비스 도입"

rollback: >
  `git revert <merge-sha>` 로 apps/preview 전체와 CI job 추가분이 제거되고,
  워크스페이스 패키지 수 기대값도 원복된다. 프리뷰는 프로덕션 배포 대상이 아니므로 사용자 영향이 없다.
  본 PR 이 제거한 DS3 의 wiring-smoke 라우트는 revert 시 함께 복구되며(noindex 라 색인 영향 없음),
  targets.json 도 이전 상태로 되돌아가므로 DS6 의 실환경 검사 대상이 공백이 되지 않는다.

done_when:
  - "`pnpm --filter @glowmate/preview build` exit 0"
  - "`pnpm test:preview --all` 이 6개 서브체크 전부 exit 0"
  - "프리뷰 엔트리 수 = 케이스 레지스트리 케이스 수 임이 검사 로그로 확인됨 (가격 상태 4종 포함)"
  - "실행 중인 토큰 페이지에서 열거된 CSS 변수 행 수가 1 이상임이 확인됨"
  - "apps/web 빌드 라우트 목록과 sitemap 에 프리뷰 경로가 0건임이 확인됨"
  - "wiring-smoke 제거 후 targets.json 길이 ≥ 1 이고 `pnpm a11y:check` 가 실라우트를 검사함이 확인됨"
  - "FORBID-1~6 각각에 대응하는 위반 픽스처가 커밋되고 대응 검사를 실패시키는 것이 확인됨"
  - "touches 경로 밖 변경 파일 0개 (CI path guard 통과)"
```
