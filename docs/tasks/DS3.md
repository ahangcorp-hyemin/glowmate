# DS3 — Pretendard self-host + seed CSS/theme 연결 + shadcn/ui 초기화

> 계약 규격: [02-task-contract-spec.md](../02-task-contract-spec.md) §1 (원칙 2.5 · R-6 · R-7 포함)
> 상태: **수정본 (2차 감사 REVISE 반영)** · ⛔G5 = **옵션 A** 확정
> 근거 정본: `docs/design-system/DS0/pinned.json` · `verdict.json` (DS0-FREEZE 산출) — 절 번호 인용 금지

## 설계 전제 — 실사가 실증한 구성을 그대로 옮긴다

당근 docs 앱(Next.js 16 App Router + React 19)에서 실증된 패턴(실사 §9.2)이 그대로 목표 구성이다.

```
app/layer-order.css   @layer theme, base, seed-base, components, seed-components, utilities;
app/layout.tsx        import "./layer-order.css"
                      import "@seed-design/css/base.layered.min.css"   // 55.4 KB (all.css 366 KB 대신)
                      import "./globals.css"
app/globals.css       @import "tailwindcss";
                      @import "@seed-design/tailwind4-theme";
                      + DS1 의 brand.css / semantic.css
```

옵션 A 이므로 `@seed-design/react` 를 쓰지 않는다 → `transpilePackages` 불필요, Turbopack condition 이슈 미발생
(실사 §9.2 말미). 컴포넌트 레이어는 **shadcn/ui (Radix + Tailwind v4)** 로 소유한다.

**폰트 결정 — `next/font/local` 단일 파일이 아니라 다이나믹 서브셋 self-host**

실사 §6.3~§6.4 실측: 풀 가변 `PretendardVariable.woff2` = **1.96 MB 단일 다운로드**,
가변 다이나믹 서브셋 chunk = **약 33 KB × 필요한 개수**(한국어 UI 한 페이지 기준 수 개). 약 60배 차이다.
SEO/LCP 가 채널 1순위인 제품에서 1.96 MB 를 첫 로드에 거는 선택은 성립하지 않는다.
→ **92개 가변 서브셋 chunk 를 self-host 하고 `pretendardvariable-dynamic-subset.css` 의 경로만 재작성한다.**
폰트 파일은 **무수정**이므로 OFL 의 Reserved Font Name 문제가 발생하지 않는다(실사 §6.2).

```yaml
# ─── 식별 ───────────────────────────────
id:            DS3-BASE-WIRING
dag_id:        DS3
title:         Pretendard 다이나믹 서브셋 self-host + seed CSS/theme 연결 + shadcn/ui 초기화
workstream:    web
owner_agent:   dev-web

# ─── 존재 이유 ──────────────────────────
traces_to:     [H3, H4, H5]
why:           "토큰과 폰트가 앱 렌더 경로에 연결되지 않으면 DS4·DS5 가 참조할 대상이 없고,
                폰트를 1.96MB 단일 파일로 걸면 LCP 저하가 색인·순위(H3)에 직접 반영된다."

# ─── DAG ────────────────────────────────
depends_on:    [DS0-SEED-DUE-DILIGENCE, F1-REPO-SCAFFOLD, DS1-TOKEN-LAYERS]
blocks:        [DS4-PRICE-COMPARE-CARD, DS5-CORE-COMPONENTS, DS6-A11Y-GATE, W1-SEO-FOUNDATION]
parallel_with: [F2a-CORE-SCHEMA, F4-NEED-TAG-ONTOLOGY]   # DS6 는 실라우트 검사 때문에 본 태스크 이후로 이동
gate:          null      # ⛔G5 는 DS0 산출로 해소됨(옵션 A). 본 태스크가 그 판정을 코드에 반영한다

# ─── 산출물 ─────────────────────────────
deliverable:
  pr_count:    1
  touches:
    - apps/web/src/app/layer-order.css
    - apps/web/src/app/globals.css
    - apps/web/src/app/layout.tsx                      # import 3줄 + font 클래스 적용만
    - apps/web/public/fonts/pretendard/**              # 가변 다이나믹 서브셋 chunk + OFL 고지
    - apps/web/src/styles/pretendard.css               # @font-face 92개 (src 경로만 재작성)
    - apps/web/src/app/(dev)/wiring-smoke/page.tsx     # SSR 스모크 라우트 (noindex)
    - apps/web/components.json                         # shadcn/ui 설정
    - packages/ui/src/primitives/**                    # shadcn 생성 Button · Badge · Card
    - packages/ui/test/wiring/**
    - packages/ui/package.json                         # exports · scripts 키 추가만
    - apps/web/package.json                            # seed CSS/theme · Radix 의존성 추가 (버전은 DS0 pinned.json 인용)
    - .github/workflows/ci.yml                         # job `ds-wiring` 추가만 (기존 job 수정 금지)
  artifacts:
    - "cascade layer 순서 선언 + seed base.layered.min.css / tailwind4-theme 연결"
    - "Pretendard 가변 다이나믹 서브셋 self-host (chunk 92개 + 무결성 체크섬 목록 + OFL 고지)"
    - "shadcn/ui 초기화 + 프리미티브 3종 (Button · Badge · Card)"
    - "CSS 변수 정의 출처 화이트리스트 검사"
    - "실브라우저 스모크 검사 (폰트 네트워크 · 브랜드 색 실측 · JS 비활성 HTML)"

# ─── 요구사항 ───────────────────────────
requirements:
  - id: REQ-1
    statement: >
      layer-order.css 의 `@layer` 선언이 `theme, base, seed-base, components, seed-components, utilities`
      순서와 정확히 일치한다.
    acceptance: "`pnpm test:wiring --check layers` — 레이어 이름 배열 정확 일치 + layout.tsx 의 CSS import 등장 인덱스가 (layer-order → seed base.layered → globals) 오름차순 assert"

  - id: REQ-2
    statement: >
      커밋된 Pretendard chunk 파일의 sha256 이 **pinned.json 에 고정된 `pretendard` 패키지 정확 버전**의
      tarball 에서 재생성한 목록과 전건 일치하며, 재생성 스크립트가 CI 에서 재실행 가능하다.
    acceptance: >
      `pnpm test:wiring --check font-integrity` — pinned.json 의 버전·tarball integrity 로 원본을 내려받아
      해시 목록을 **재생성**한 뒤 커밋본과 대조, 불일치 0건 assert. 대조 파일 수를 stdout 출력(0 이면 exit 1).
      커밋된 목록을 그대로 신뢰하지 않는다

  - id: REQ-3
    statement: >
      실행 중인 스모크 라우트에서 본문 텍스트 노드의 계산 font-family 첫 항목이 `Pretendard Variable`
      이고 폰트 전송 바이트 합계가 30,000 바이트 이상이다. (실환경 하한 REQ · 원칙 2.5)
    acceptance: "Playwright — computed fontFamily 첫 토큰 문자열 일치 assert + 폰트 리소스 transferSize 합 ≥ 30000, 실측치 stdout 출력"

  - id: REQ-4
    statement: >
      동일 로드에서 외부 폰트 도메인(jsdelivr · unpkg · cdnjs · fonts.g*) 요청이 0건이고
      폰트 전송 바이트 합계가 300,000 바이트 이하이다. (예산 상한)
    acceptance: "Playwright 네트워크 계측 — 외부 폰트 요청 0건 assert + transferSize 합 ≤ 300000"

  - id: REQ-5
    statement: >
      스모크 라우트가 한글 음절 300자 이상, brand 계열 시맨틱 토큰을 사용하는 노드 1개 이상,
      shadcn 프리미티브 3종(Button·Badge·Card)을 모두 포함한다. (측정 대상 하한 · R-6)
    acceptance: >
      `pnpm test:wiring --check smoke-content` — 렌더 텍스트의 한글 음절 수 ≥ 300 ·
      brand 토큰 사용 노드 수 ≥ 1 · 프리미티브 3종 노드 존재 assert (REQ-3·REQ-4·REQ-8 의 측정 대상을
      구현자가 축소하지 못하게 계약이 고정한다)

  - id: REQ-6
    statement: >
      빌드된 앱 CSS 에서 커스텀 프로퍼티를 정의하는 출처가 허용목록
      (`tailwindcss` · `@seed-design/css` · `@seed-design/tailwind4-theme` · DS1 brand.css · DS1 semantic.css)
      안에 있으며, `apps/web/**` 및 `packages/ui/src/**` 소스 파일의 `--*` 정의 건수가 0 이다.
    acceptance: "`pnpm test:wiring --check css-origin` — 우리 소스 파일의 변수 정의 grep 0건 assert + 허용목록 밖 패키지 유래 정의 0건 (Tailwind v4 기본 `@theme` 는 허용목록에 포함되어 정상 구현이 위반이 되지 않는다)"

  - id: REQ-7
    statement: >
      shadcn 기본 테마 심볼 15종(`--background` · `--foreground` · `--card` · `--card-foreground` ·
      `--popover` · `--popover-foreground` · `--muted` · `--muted-foreground` · `--accent` ·
      `--accent-foreground` · `--destructive` · `--border` · `--input` · `--ring` · `--radius`)과
      `--chart-*` · `--sidebar-*` 패턴이 빌드 CSS 전체에서 정의 0건이다.
    acceptance: >
      `pnpm test:wiring --check no-shadcn-theme` — 심볼 목록(테스트에 하드코딩)과 2개 패턴에 대해
      빌드 CSS 전문에서 정의 발생 0건 assert. **심볼 기준 검사이므로 출처 파일 귀속에 의존하지 않는다**

  - id: REQ-8
    statement: >
      실행 중인 스모크 라우트에서 읽은 `--seed-color-palette-carrot-*` 계산값 전량이
      DS1 brand-palette.json 값과 일치하고, 페이지 계산 스타일에 seed 원본 carrot hex 가 0건이다.
      (실환경 하한 REQ — 브랜드 교체의 런타임 실증)
    acceptance: >
      Playwright — 변수별 값 일치 전건 assert, 대조한 변수 개수를 stdout 출력(0 이면 exit 1) +
      원본 carrot hex 매칭 0건. REQ-5 가 brand 토큰 사용 노드를 보장하므로 자명 통과가 아니다

# ─── 조건부 금지사항 ────────────────────
forbid:
  - id: FORBID-1
    when: >
      빌드된 앱 CSS 에 REQ-7 의 shadcn 기본 테마 심볼(또는 `--chart-*` · `--sidebar-*` 패턴)이
      정의된 경우 — shadcn CLI 가 생성한 globals.css 테마 블록을 그대로 둔 경우가 대표적이다
    must_not: >
      그 정의를 남긴 채 머지 (해당 심볼을 제거하고 컴포넌트가 seed·glowmate 토큰을 참조하도록 매핑할 것)
    because: >
      토큰 소스가 2개가 되면 컴포넌트마다 참조 대상이 갈린다. DS1 이 carrot 을 전량 교체해도
      shadcn 기본 팔레트를 보는 컴포넌트는 그대로 남아 브랜드 교체가 절반만 적용된 화면이 만들어지고,
      어느 컴포넌트가 어느 세트를 보는지는 빌드 CSS 를 역추적해야만 알 수 있다.
      **심볼 기준으로 금지하는 이유**: "정의 출처 파일 특정"은 minified 벤더 CSS 에서 신뢰할 수 없고,
      그 검사를 쓰면 구현자가 검사 범위를 자기 소스로 좁히는 방향으로 압력을 받는다(2차 감사 A-1).
    detect: >
      `pnpm test:wiring --check no-shadcn-theme` — 심볼 15종 + 2개 패턴의 정의 발생 0건 assert +
      위반 픽스처(shadcn 기본 테마 블록을 포함한 CSS)를 넣으면 반드시 실패하는 메타 테스트
    on_violation: block_merge

  - id: FORBID-2
    when: >
      `@seed-design/react` 또는 `@seed-design/css/recipes/*`(컴포넌트 레시피 CSS)를
      의존성에 추가하거나 소스에서 import 하려는 경우
    must_not: >
      해당 패키지·경로를 도입 (컴포넌트는 shadcn/ui 로 소유한다)
    because: >
      G5 옵션 A 판정의 근거가 "카탈로그 방향 불일치 + 레시피 클래스를 이기려면 cascade layer 순서 제어가
      필요하고 그 기능이 공식 Experimental"이라는 실측이다. 레시피 CSS 가 들어오면 우리 Tailwind 유틸리티가
      레시피에 지고, 커스텀할 때마다 Experimental 기능에 제품이 묶인다. all.css 경로를 타면
      366 KB 가 첫 로드에 실려 LCP 가 무너진다.
    detect: >
      CI job `ds-wiring` (**본 PR 이 .github/workflows/ci.yml 에 추가한다**) —
      package.json 의존성 허용목록 검사(`@seed-design/react` 차단) + 소스 전체에서
      `@seed-design/css/recipes` · `@seed-design/react` import grep 0건 요구
    on_violation: block_merge

  - id: FORBID-3
    when: >
      Pretendard 를 로드할 때
    must_not: >
      jsDelivr · unpkg · cdnjs 등 외부 CDN URL 을 참조하거나 `@fontsource/pretendard` 패키지를 사용하거나,
      pretendard.css 를 커밋만 하고 layout.tsx 에서 import 하지 않은 채 두기
    because: >
      `@fontsource/pretendard` 는 `subsets: ["latin"]` 표기와 달리 실제로는 한글 포함 풀 폰트이며
      unicode-range 가 비어 있어 weight 당 766 KB 를 통째로 받는다(SHA-256 대조 실측).
      외부 CDN 은 지연·차단 시 시스템 폰트로 폴백된다. **import 누락도 같은 결과다** —
      "외부 요청 0건 · 전송 ≤300KB"는 폰트를 아예 안 받아도 충족되므로, 그 상태에서 DS6 의 최소 폰트
      검사는 Pretendard 기준으로 통과하는데 사용자 화면은 시스템 폰트로 깨진다.
    detect: >
      REQ-3 의 **하한**(computed font-family = Pretendard Variable · 전송 ≥ 30,000 바이트) +
      REQ-4 의 상한을 함께 판정. 상한만으로는 무로드가 만점이 된다
    on_violation: block_merge

  - id: FORBID-4
    when: >
      폰트 용량을 줄이기 위해 Pretendard 파일을 직접 서브셋·최적화하려는 경우
    must_not: >
      자체 생성한 폰트 파일에 `font-family: Pretendard` 이름을 유지한 채 사용하거나,
      해시 목록을 자체 생성 파일에서 뽑아 커밋 (공식 배포본을 무수정으로 쓸 것)
    because: >
      SIL OFL FAQ 2.6 은 서브셋을 Modified Version 으로 규정하며 Reserved Font Name 사용을 허용하지 않는다.
      직접 만든 서브셋에 원래 이름을 붙이면 라이선스 위반이고 배포된 폰트를 회수할 수단이 없다.
      **해시 목록을 자기 파일에서 생성하면 대조가 순환**이 되어(자기 채점) 이 금지의 유일한 탐지 수단이 무력해진다.
    detect: >
      REQ-2 `--check font-integrity` — pinned.json 의 상류 tarball 에서 해시 목록을 **재생성**해 대조하며,
      대조 파일 수가 0 이면 exit 1. 커밋된 목록 자체는 신뢰 대상이 아니다
    on_violation: block_merge

  - id: FORBID-5
    when: >
      앱에서 필요한 색상·치수 토큰이 seed·glowmate 토큰 집합에 없는 경우
    must_not: >
      apps/web 또는 packages/ui/src 에서 CSS 커스텀 프로퍼티를 새로 **정의**하거나
      (`@theme` 블록이든 `:root` 블록이든 형태 불문) packages/ui/styles/** 를 이 PR 에서 수정
      (DS1 변경을 요청하고 본 태스크는 중단할 것)
    because: >
      앱 로컬 값은 DS1 의 pairs.json 페어 매트릭스에 등재되지 않아 대비 검사를 받지 않는다.
      대비 3:1 회색 캡션이 CI 초록 상태로 들어온다. `@theme` 구문만 금지하면 `:root { --x: … }` 로
      우회되므로 **정의 행위 자체**를 대상으로 한다. 또 연결 태스크가 토큰을 고치면 롤백 단위가 엉킨다.
    detect: >
      REQ-6 `--check css-origin` — `apps/web/**` · `packages/ui/src/**` 의 `--*` 정의 0건 assert
      (구문 이름이 아니라 정의 패턴 기준) + CI path guard 로 diff 에 packages/ui/styles/** 포함 시 exit 1
    on_violation: block_merge

# ─── 경계 ───────────────────────────────
out_of_scope:
  - "토큰 값·이름 추가/변경 → DS1-TOKEN-LAYERS 소관"
  - "Style Dictionary 파이프라인 → DS2-TOKEN-BUILD 폐기"
  - "회당 단가 비교 카드 → DS4-PRICE-COMPARE-CARD 소관"
  - "업체 카드 · 태그 칩 · 필터 바 · 리스트 → DS5-CORE-COMPONENTS 소관"
  - "접근성 검사 하네스·CI 집행 → DS6-A11Y-GATE 소관 (본 태스크는 wiring 스모크까지)"
  - "프리뷰/문서 사이트 → DS7-PREVIEW-DOCS 소관 (wiring-smoke 는 DS7 이 승계·제거할 임시 라우트다)"
  - "라우팅 · 메타 태그 · sitemap → W1-SEO-FOUNDATION 소관"
  - "다크 모드 전환 UI (토큰의 light/dark 쌍은 DS1 에 존재하나 전환 장치는 비대상)"
  - "Button·Badge·Card 외 shadcn 컴포넌트 추가 생성 (필요 시 DS5 에서)"

rollback: >
  `git revert <merge-sha>` 로 layer-order.css · globals.css · 폰트 자산 · shadcn 초기화 · 프리미티브가
  함께 제거되고 apps/web 은 F1 스캐폴딩 상태(토큰·폰트 미적용)로 복귀한다.
  DS4·DS5 가 머지된 뒤 되돌리면 프리미티브 부재로 빌드가 즉시 실패하므로 함께 되돌린다(부분 롤백 금지).
  폰트 파일은 리포 내 정적 자산이므로 외부 상태 변경이 없다.

done_when:
  - "`pnpm test:wiring --all` 이 8개 서브체크 전부 exit 0"
  - "실브라우저 스모크의 폰트 전송 바이트 실측치가 PR 본문에 기재됨 (30,000 ≤ 값 ≤ 300,000, 외부 요청 0건)"
  - "본문 computed font-family 첫 항목이 Pretendard Variable 임이 로그로 확인됨 (무로드 통과 차단)"
  - "스모크 라우트의 한글 음절 수 · brand 토큰 사용 노드 수 · 대조한 carrot 변수 개수가 stdout 에 출력되고 전부 하한 초과"
  - "폰트 해시 목록이 pinned.json 상류 tarball 에서 **재생성**되어 대조되었음이 CI 로그로 확인됨 (자기 생성 목록 아님)"
  - "shadcn 기본 테마 심볼 15종 + 2개 패턴의 빌드 CSS 정의 0건이 확인됨"
  - "위반 픽스처 3종(shadcn 테마 블록 포함 CSS · apps/web `:root` 변수 정의 · 자체 서브셋 폰트)이 각각 대응 체크를 실패시킴을 확인"
  - "CI job `ds-wiring` 이 추가되고 PR 이벤트에서 실행됨"
  - "touches 경로 밖 변경 파일 0개 (CI path guard 통과)"
```
