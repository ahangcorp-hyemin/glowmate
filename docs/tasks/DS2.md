# DS2 — 토큰 빌드 파이프라인 (Style Dictionary → tokens.css / tokens.ts / tailwind theme)

> # ⛔ 폐기 (SUPERSEDED) — 착수 금지
>
> **폐기일:** 2026-08-03 · **근거:** [ds0-seed-design-실사.md](../ds0-seed-design-실사.md) §5.2 · §8-5 · §9.1
> **판정:** ⛔G5 = **옵션 A** (seed 토큰 채택 + shadcn/ui 컴포넌트 소유)
>
> ## 폐기 사유
>
> 본 계약은 "DTCG JSON → Style Dictionary → tokens.css / tokens.ts / tailwind theme" 파이프라인을 세우는
> 태스크였다. DS0 실사 결과 **그 파이프라인의 최종 산출물이 이미 npm 에 배포되어 있음**이 실측으로 확인되었다.
>
> - `@seed-design/tailwind4-theme@2.3.0` 은 파일이 `index.css` 하나이며 내용 전체가 Tailwind `@theme` 매핑이다
>   (`--color-palette-gray-100: var(--seed-color-palette-gray-100);` …). Style Dictionary 가 만들어줄 결과물 그 자체다.
> - `@seed-design/css@2.3.0` 은 `dependencies: {}` · `peerDependencies: {}` 로 **런타임 의존성 0**, 산출물이 정적 `.css` 다.
>   빌드 플러그인·CSS-in-JS 런타임·바벨 플러그인이 전부 불필요하다.
> - seed 의 토큰 원본은 DTCG 가 아니라 당근 자체 포맷(**Rootage YAML**, `kind`/`metadata`/`data` 구조)이다.
>   DTCG 경로를 고집하면 **공식 export 가 없는 포맷을 위해 자체 변환기를 먼저 작성**해야 한다.
>
> 즉 본 태스크를 수행하면 이미 존재하는 산출물을 재생산하기 위해 변환기 · 빌드 설정 · drift 게이트 · 결정성 검사를
> 새로 만들게 된다. 이는 순수한 오버엔지니어링이며, 유지 대상 코드만 늘리고 seed 업그레이드 경로를 막는다.
>
> ## 대체 경로
>
> | 폐기된 것 | 대체 |
> |---|---|
> | DTCG JSON 원천 작성 | `@seed-design/css` 가 정의하는 `--seed-*` CSS 변수 (벤더 제공) |
> | Style Dictionary 변환 | `@seed-design/tailwind4-theme` 의 `@theme` 매핑 import 1줄 |
> | 자체 tokens.css / tokens.ts 생성 | 없음. CSS 변수를 직접 소비 (Tailwind v4 CSS-first) |
> | 브랜드 색 주입 | **DS1-TOKEN-LAYERS** — `:root` 에서 carrot 팔레트 변수 재정의 (오버레이) |
> | 빌드 drift 게이트 | 불필요 (생성 단계 자체가 없음) |
>
> DS1 은 폐기되지 않았다. **역할이 "3계층 신규 설계" → "seed 시맨틱 토큰 위 glowmate 브랜드 오버레이"로 재정의**되었다.
>
> ## 재도입 조건 (아래 중 하나라도 참이 되면 본 계약을 갱신해 되살린다)
>
> 1. **seed 토큰에서 이탈해 자체 토큰 소스를 갖기로 결정한 경우** — 브랜드가 성숙해 팔레트 · 타이포 스케일 ·
>    반경 체계를 독자적으로 운용해야 하고, `:root` 오버라이드만으로 덮을 수 없는 범위에 이른 시점
> 2. **웹 외 소비처가 생긴 경우** — Expo 앱 · 이메일 템플릿 · 네이티브 등 CSS 변수를 쓸 수 없는 타깃이
>    동일 토큰을 요구할 때(이때는 다중 포맷 생성이 실익을 가진다)
> 3. **seed 가 DTCG 공식 export 를 제공하고 우리가 Rootage YAML 을 소스 오브 트루스로 삼기로 한 경우**
>    (실사 §9.3-4 후속 확인 항목)
> 4. `@seed-design/tailwind4-theme` 가 배포 중단되거나 Tailwind v4 지원을 잃은 경우
>
> 재도입 시에도 **토큰 소스는 정확히 1개**라는 제약은 그대로다. 아래 원문 계약의 FORBID-2(primitive 를 CSS 변수로
> 노출 금지) · FORBID-4(외부 경로를 빌드 입력에 추가 금지)는 그 시점에도 유효하므로 보존한다.
>
> ---
>
> ## 아래는 폐기된 원문 계약 (기록 보존용 · 실행 금지)

> 계약 규격: [02-task-contract-spec.md](../02-task-contract-spec.md) §1
> 상태: ~~착수 가능 (DS0 완료 후)~~ → **폐기 (2026-08-03)**

## 설계 전제

1. **DTCG JSON 1개 → 산출물 3개.** 손으로 쓰는 CSS 변수 파일도, 손으로 쓰는 Tailwind 색상표도 존재하지 않는다.
   생성물은 커밋하되 **재빌드 결과와 바이트 동일**해야 하며, 이 drift 검사가 "소스가 1개"라는 명제의 집행 수단이다.
2. **생성 CSS 에 primitive 를 노출하지 않는다.** primitive 가 CSS 변수로 나가면 컴포넌트가
   `var(--gray-500)` 을 직접 쓸 수 있고, 그 값은 DS1 의 페어 매트릭스 검사 밖이라 DS6 로도 잡히지 않는다.
   3계층 구조가 실제로 강제되는 지점은 여기다.
3. **DS1 과 병렬이므로 특정 토큰 이름에 의존하지 않는다.** 파이프라인은 픽스처 토큰셋으로 개발·검증하며,
   DS1 이 이름을 바꿔도 빌드가 깨지지 않아야 한다. G5(컴포넌트 레이어 결정)와도 무관하다 —
   옵션 A/B 어느 쪽이든 토큰은 CSS 변수와 Tailwind theme 으로 나가야 한다.

```yaml
# ─── 식별 ───────────────────────────────
id:            DS2-TOKEN-BUILD
dag_id:        DS2
status:        superseded          # ⛔ 폐기 2026-08-03. DAG 검증기는 이 계약의 depends_on/blocks 를 건너뛴다
superseded_by: [DS1-TOKEN-LAYERS]  # 브랜드 오버레이로 역할 흡수. 생성 파이프라인 자체는 도입하지 않음
title:         토큰 빌드 파이프라인 — Style Dictionary → tokens.css / tokens.ts / tailwind-theme.cjs
workstream:    web
owner_agent:   dev-platform

# ─── 존재 이유 ──────────────────────────
traces_to:     [H4, S1]
why:           "토큰 JSON 이 코드에서 import 가능한 산출물로 변환되지 않으면 DS3~DS5 컴포넌트가
                토큰을 참조할 수단이 없어 각자 하드코딩으로 회귀하고, 가격 상태 구분(H4)이 화면마다 갈린다."

# ─── DAG ────────────────────────────────
depends_on:     [DS0-SEED-DUE-DILIGENCE]
blocks:         [DS3-BASE-WIRING]
parallel_with:  [DS1-TOKEN-LAYERS]
gate:          null      # G5 와 독립. 옵션 A/B 어느 쪽이든 동일한 산출물이 필요하다

# ─── 산출물 ─────────────────────────────
deliverable:
  pr_count:    1
  touches:
    - packages/ui/tokens/style-dictionary.config.mjs
    - packages/ui/tokens/build/tokens.css              # 생성물 (커밋됨)
    - packages/ui/tokens/build/tokens.ts               # 생성물 (커밋됨)
    - packages/ui/tokens/build/tailwind-theme.cjs      # 생성물 (커밋됨)
    - packages/ui/tokens/test/build/**
    - packages/ui/tokens/test/build/fixtures/**        # 이름이 서로 다른 픽스처 토큰셋 2종
    - packages/ui/package.json                         # ↓ 공유 규약 참조
    - packages/config/test/workspace.test.ts           # 먼저 머지되는 PR 인 경우에 한해 패키지 수 기대값 4→5 갱신 1건
    - .github/workflows/ci.yml                         # job `tokens-build` 추가만 (기존 job 수정 금지)
  artifacts:
    - "style-dictionary.config.mjs — DTCG 소스 → 3개 포맷 변환 설정"
    - "생성물 3종 (tokens.css / tokens.ts / tailwind-theme.cjs) + 자동생성 경고 배너"
    - "픽스처 토큰셋 2종 기반 빌드 회귀 테스트 (`pnpm test:token-build`)"
    - "CI job `tokens-build` — 재빌드 후 git diff 0 검증(drift 게이트)"

# ─── 공유 규약 (DS1 과의 경계) ──────────
shared_contract:
  - "packages/ui/package.json 은 DS1·DS2 중 **먼저 머지되는 PR** 이 생성한다.
     생성하는 PR 이 F1 의 워크스페이스 패키지 수 기대값(4→5) 갱신을 동반하며,
     나중 PR 은 scripts 키 추가만 수행한다."
  - "DS2 는 packages/ui/tokens/src/**(원천 토큰·constraints·pairs)를 생성하지도 수정하지도 않는다 — DS1 소관."
  - "DS1 머지 전에는 test/build/fixtures/ 의 픽스처 토큰셋을 입력으로 개발·검증한다."

# ─── 요구사항 ───────────────────────────
requirements:
  - id: REQ-1
    statement: >
      `pnpm --filter @glowmate/ui build:tokens` 가 packages/ui/tokens/src/ 의 DTCG 소스로부터
      tokens.css · tokens.ts · tailwind-theme.cjs 3개 파일을 생성하고 exit 0 으로 종료한다.
    acceptance: "CI job `tokens-build` — 빌드 exit 0 이고 3개 산출 파일이 생성됨(파일 존재 + 크기 > 0) assert"

  - id: REQ-2
    statement: >
      클린 체크아웃에서 재빌드했을 때 커밋된 생성물 3개와 바이트 단위로 동일하다(drift 0).
    acceptance: "CI job `tokens-build` — `pnpm build:tokens && git diff --exit-code packages/ui/tokens/build/` exit 0"

  - id: REQ-3
    statement: >
      tokens.css 가 정의하는 CSS 커스텀 프로퍼티는 semantic 토큰에서 유래한 것만이며,
      primitive 레이어 이름(gray-500 · blue-600 등 팔레트 단계 표기)을 가진 변수 정의가 0건이다.
    acceptance: "`pnpm test:token-build --check css-surface` — 생성 CSS 파싱 후 변수명 정규식 `-(50|[1-9]00)$` 매칭 0건, semantic 키 집합과 변수 집합의 대칭차집합 0"

  - id: REQ-4
    statement: >
      tokens.ts 는 토큰 키의 리터럴 유니온 타입을 export 하며, 존재하지 않는 키를 참조하는 코드는
      `tsc --noEmit` 에서 오류가 된다.
    acceptance: "타입 테스트 — `test/build/fixtures/unknown-token.fail.ts` 를 포함한 tsc 실행이 exit ≠ 0, 제외 시 exit 0"

  - id: REQ-5
    statement: >
      tailwind-theme.cjs 를 적용한 Tailwind 설정의 `theme.colors` 키 집합이 semantic color 토큰 키 집합과
      정확히 일치하며(Tailwind 기본 팔레트 잔존 0건), spacing·fontSize 도 동일하게 교체된다.
    acceptance: "`pnpm test:token-build --check tw-theme` — resolveConfig 결과 theme.colors/spacing/fontSize 각각의 키 집합과 토큰 키 집합의 대칭차집합 0"

  - id: REQ-6
    statement: >
      동일 입력으로 빌드를 2회 실행한 결과 3개 산출물의 sha256 이 각각 동일하다(키 정렬·타임스탬프 미포함).
    acceptance: "`pnpm test:token-build --check determinism` — 2회 빌드 산출물 해시 3쌍 전부 일치"

  - id: REQ-7
    statement: >
      style-dictionary.config.mjs 에 개별 토큰 이름 문자열이 0건이며, 토큰 이름이 서로 다른 픽스처
      토큰셋 2종 각각에 대해 빌드가 exit 0 으로 성공한다.
    acceptance: "`pnpm test:token-build --check name-agnostic` — config 소스의 토큰 이름 리터럴 grep 0건 + 픽스처 2종 빌드 성공"

# ─── 조건부 금지사항 ────────────────────
forbid:
  - id: FORBID-1
    when: >
      packages/ui/tokens/build/ 의 생성물(tokens.css · tokens.ts · tailwind-theme.cjs)에
      값 수정·변수 추가가 필요한 상황이 발생한 경우
    must_not: >
      생성물 파일을 직접 편집해 커밋 (원천 JSON 또는 변환 설정을 고칠 것)
    because: >
      손으로 고친 값은 다음 빌드에서 조용히 원복된다. 그 사이 화면은 정상으로 보이고 며칠 뒤
      무관한 PR 의 빌드에서 색이 되돌아가며, 아무도 그 PR 을 원인으로 지목하지 못한다.
    detect: >
      CI job `tokens-build` — 재빌드 후 `git diff --exit-code packages/ui/tokens/build/` (REQ-2 drift 게이트) +
      생성물 상단 자동생성 경고 배너 존재 검사
    on_violation: block_merge

  - id: FORBID-2
    when: >
      tokens.css 를 생성하는 Style Dictionary 플랫폼 설정을 작성할 때
    must_not: >
      primitive 레이어 토큰을 CSS 커스텀 프로퍼티로 함께 출력 (semantic 만 변수로 노출하고
      primitive 는 참조 해결된 리터럴로만 존재해야 한다)
    because: >
      `--gray-500` 같은 변수가 존재하면 컴포넌트가 이를 직접 참조할 수 있고, DS6 의 하드코딩 린트는
      "유효한 토큰 변수"로 보아 통과시킨다. 그 색은 DS1 의 (text × surface) 페어 매트릭스에 없으므로
      대비 검사도 받지 않는다. 3계층 구조가 무너지는 유일한 자동 우회로가 바로 이 경로다.
    detect: >
      `pnpm test:token-build --check css-surface` — 생성 CSS 를 파싱해 팔레트 단계 표기 변수 0건 +
      semantic 키 집합과 변수 집합 대칭차집합 0 assert (위반 픽스처 설정으로 실패 재현)
    on_violation: block_merge

  - id: FORBID-3
    when: >
      Tailwind theme 산출물을 생성할 때
    must_not: >
      Tailwind 기본 팔레트·스페이싱을 `extend` 로 병합해 기본값을 남겨두기 (교체할 것)
    because: >
      기본 팔레트가 남으면 개발 에이전트가 `bg-blue-500` · `p-[13px]` 을 쓸 수 있고, 그 값들은
      우리 토큰이 아니라 대비·최소폰트 검사 대상 밖이다. 검사망 밖의 색과 치수가 컴포넌트에 섞여 들어오면
      "CI 는 초록인데 화면은 미달"인 상태가 고착된다.
    detect: >
      `pnpm test:token-build --check tw-theme` — resolveConfig 결과 theme.colors/spacing/fontSize 키 집합이
      토큰 키 집합과 정확히 일치하는지 assert (기본 팔레트 키가 1개라도 남으면 실패)
    on_violation: block_merge

  - id: FORBID-4
    when: >
      style-dictionary 의 source 글롭 또는 include 목록을 구성할 때
    must_not: >
      node_modules 경로나 packages/ui/tokens/src/ 밖의 경로를 빌드 입력에 추가
    because: >
      외부 패키지 토큰이 빌드 입력에 섞이면 산출물의 일부 값이 우리 JSON 에 존재하지 않게 된다.
      화면의 색을 JSON 에서 검색해도 나오지 않는 상태가 되고, 그 시점에 "토큰 소스 1개" 라는
      워크스트림 전제는 검증 불가능한 주장으로 바뀐다.
    detect: >
      `pnpm test:token-build --check sources` — config 를 import 해 source 배열의 모든 항목이
      `packages/ui/tokens/src/` 접두인지 assert, 아니면 exit 1
    on_violation: block_merge

  - id: FORBID-5
    when: >
      DS1 이 아직 머지되지 않아 실제 토큰 소스가 없는 상태에서 빌드를 성공시켜야 하는 경우
    must_not: >
      packages/ui/tokens/src/ 에 임시 토큰 파일을 생성하거나, 특정 토큰 이름을 config·산출물에
      하드코딩해 통과시키기 (test/build/fixtures/ 의 픽스처 토큰셋을 입력으로 검증할 것)
    because: >
      임시 토큰 파일은 DS1 머지 시 충돌하거나 병합 과정에서 살아남아 원천이 2개가 된다.
      이름 하드코딩은 DS1 이 토큰명을 바꾸는 순간 빌드가 조용히 빈 값을 내보내고,
      화면에서 색이 사라진 뒤에야 발견된다.
    detect: >
      CI path guard — 이 PR 의 diff 에 packages/ui/tokens/src/** 가 포함되면 exit 1 +
      `--check name-agnostic` (config 내 토큰 이름 리터럴 0건, 픽스처 2종 빌드 성공)
    on_violation: block_merge

# ─── 경계 ───────────────────────────────
out_of_scope:
  - "토큰 값·이름·계층 설계 → DS1 소관 (본 태스크는 변환만 한다. 값이 미흡해도 src 를 고치지 않는다)"
  - "Pretendard 로딩 · Tailwind preset 을 앱에 연결 → DS3 소관"
  - "컴포넌트 구현 → DS4 · DS5 소관"
  - "접근성 검사 CI 잡 → DS6 소관 (본 태스크가 추가하는 CI job 은 `tokens-build` 1개)"
  - "다크 모드 · 테마 스위칭용 다중 CSS 레이어 출력 (MVP 비대상)"
  - "F1 이 만든 기존 CI job 의 수정 (job 추가만 허용)"

rollback: >
  `git revert <merge-sha>` 로 config · 생성물 · 테스트 · CI job 추가분이 함께 제거된다.
  생성물은 파생 파일이므로 데이터 손실이 없다. DS3 가 이미 머지된 상태라면 tokens.css 부재로
  앱 빌드가 즉시 실패하므로 DS3 와 함께 되돌린다(부분 롤백 금지).
  브랜치 보호 필수 체크에 `tokens-build` 를 등록했다면 revert 시 함께 해제한다.

done_when:
  - "`pnpm --filter @glowmate/ui build:tokens` exit 0, 생성물 3종 커밋됨"
  - "`pnpm test:token-build --all` 이 6개 서브체크 전부 exit 0"
  - "CI job `tokens-build` 가 재빌드 drift 0 을 검증하고 브랜치 보호 필수 체크로 등록됨"
  - "픽스처 토큰셋 2종(토큰 이름 상이)으로 빌드가 성공하는 것을 확인"
  - "위반 픽스처 2종(primitive 변수 노출 설정, extend 병합 설정)이 각각 대응 체크를 실패시키는 것을 확인"
  - "touches 경로 밖 변경 파일 0개 (CI path guard 통과)"
```
