# DS0 — seed-design 실사 (라이선스 · Next SSR 호환 · 커버리지 · 토큰 추출 경로)

> # ✅ 완료 (2026-08-03) — ⛔G5 판정: **옵션 A**
>
> **실제 산출물:** [`docs/ds0-seed-design-실사.md`](../ds0-seed-design-실사.md)
> (본 계약이 명시한 `docs/design-system/DS0/**` 다분할 구조 대신 **단일 실사 보고서 1건**으로 제출되었다.
>  근거 URL·tarball 실측·SHA-256 대조가 보고서 본문에 인라인으로 기재되어 있어 계약의 evidence 요구는 충족한다.
>  계약상 경로와 산출 경로가 다르다는 사실을 기록으로 남긴다 — 사후에 REQ 를 산출물에 맞춰 고쳐 쓰지 않는다.)
>
> ## 판정 결과
>
> | 게이트 조건 | 판정 | 요약 근거 |
> |---|---|---|
> | ① Next App Router SSR 동작 | ✅ 충족 | seed-design.io 자체가 Next.js 16 App Router + React 19 |
> | ② 라이선스 상업적 사용 허용 | ✅ 충족 | Apache-2.0. 단 로고·상호·**브랜드 컬러 오인 사용** 제외 |
> | ③ 데스크톱 웹 커버 충분 | ❌ **미충족** | `@seed-design/react@2.1.0` tarball 실측 — Table·Pagination·Breadcrumb·**Card** 전무 |
>
> **→ ③ 미충족이므로 옵션 A**: seed 는 **토큰만** 채택, 컴포넌트는 **shadcn/ui** 로 코드 소유.
>
> ## 이 판정이 후속 계약에 미친 변경
>
> | 태스크 | 변경 |
> |---|---|
> | **DS1-TOKEN-LAYERS** | "DTCG 3계층 신규 설계" → **seed 시맨틱 토큰 위 brand 오버레이 + carrot 교체 필수** 로 재작성 |
> | **DS2-TOKEN-BUILD** | **폐기** — Style Dictionary 산출물이 `@seed-design/tailwind4-theme` 로 이미 배포됨 |
> | **DS3-BASE-WIRING** | `depends_on` 에서 DS2 제거. Pretendard self-host + seed CSS/theme import + **shadcn/ui 초기화** 로 재작성 |
> | **DS4·DS5** | 컴포넌트 베이스가 shadcn/ui 프리미티브(Card·Badge·Button) 조합임을 반영 |
> | **DS6·DS7** | 생성 `tokens.ts` 부재 반영 (문서는 런타임 CSS 변수 열거로 렌더) |
>
> 아래 원문 계약은 **실사 착수 시점의 계약**이며 기록 보존용으로 유지한다. 재실행 대상이 아니다.
> 옵션 B 재검토 조건은 실사 보고서 §8 "옵션 B를 재검토해야 할 조건" 참조.
>
> ---

> 계약 규격: [02-task-contract-spec.md](../02-task-contract-spec.md) §1
> 상태: ~~착수 가능~~ → **완료 (2026-08-03)** · 본 태스크의 산출물이 ⛔G5 판정 그 자체다

## 설계 전제 — 판정 룰은 실측보다 먼저 잠긴다

G5는 "seed-design 컴포넌트를 직접 쓸 것인가(옵션 B) / 토큰만 추출하고 컴포넌트는 shadcn/ui로 소유할 것인가(옵션 A)"를
가르는 단 한 번의 분기이며, 이 분기 이후 DS3~DS7 전부의 구현 방식이 갈린다.
따라서 **통과 기준을 실측 전에 고정(해시 잠금)** 하지 않으면 판정은 측정 결과가 아니라 원하는 결론에 맞춘 숫자가 된다.
D3(G3 실사)와 동일한 `verdict_rule.md` + `rule.lock` 패턴을 그대로 따른다.

```yaml
# ─── 식별 ───────────────────────────────
id:            DS0-SEED-DUE-DILIGENCE
dag_id:        DS0
title:         seed-design 실사 — 라이선스 · Next App Router SSR 호환 · 컴포넌트 커버리지 · 토큰 추출 경로
workstream:    web
owner_agent:   research-design-system

# ─── 존재 이유 ──────────────────────────
traces_to:     [G5, H4, S1]
why:           "컴포넌트 레이어를 어디서 가져올지 확정되지 않으면 DS3~DS7이 구현 후에 통째로 폐기될 수 있고,
                라이선스 미확인 자산이 들어가면 이미 색인된 화면의 시각 자산을 전부 교체해야 한다."

# ─── DAG ────────────────────────────────
depends_on:    []
blocks:        [DS1-TOKEN-LAYERS, DS3-BASE-WIRING]      # DS2-TOKEN-BUILD 는 본 실사 결과(G5=옵션 A)로 폐기
parallel_with: [D1-PRICE-AVAILABILITY-SPIKE, D2-SEO-SERP-FEASIBILITY, D3-SOURCE-DUE-DILIGENCE,
                D4-MEDICAL-AD-GUARDRAIL, F1-REPO-SCAFFOLD]
gate:          null                 # 이 태스크가 ⛔G5 의 **입력**을 산출한다

# ─── 산출물 ─────────────────────────────
deliverable:
  pr_count:    1
  touches:
    - docs/design-system/DS0/**
    - scripts/design-system/validate_ds0.mjs      # 산출물 검증 전용 단일 스크립트
  artifacts:
    - "docs/design-system/DS0/verdict_rule.md — G5 판정 룰 (사전 고정) + rule.lock"
    - "docs/design-system/DS0/license.md + snapshots/license/** — LICENSE 원문 스냅샷 · 버전/커밋 SHA 고정"
    - "docs/design-system/DS0/ssr_probe.md + probe/** — Next App Router 최소 재현 앱 소스와 빌드/렌더 로그"
    - "docs/design-system/DS0/coverage.csv — 웹 데스크톱 필요 컴포넌트 12종 존재/부재 표"
    - "docs/design-system/DS0/token_extraction.md + extracted_tokens.json — 추출 경로와 원본 그대로의 추출 결과"
    - "docs/design-system/DS0/verdict.md — G5 판정(옵션 A | 옵션 B) + 축별 판정값 + rule_id + 근거 경로"
    - "scripts/design-system/validate_ds0.mjs"

# ─── 요구사항 ───────────────────────────
requirements:
  - id: REQ-1
    statement: >
      조사자는 verdict_rule.md 에 4개 판정 축(license / ssr_compat / coverage / token_extractability)
      각각의 통과 기준을 수치 또는 이진값으로 기재하고, 실측을 시작하기 전에 sha256 을 rule.lock 에 고정한다.
    acceptance: >
      `node scripts/design-system/validate_ds0.mjs --check rule-lock` exit 0.
      검사: sha256(verdict_rule.md) == rule.lock · rule.lock 커밋 시각 ≤ (ssr_probe 로그 · coverage.csv ·
      extracted_tokens.json 중 최초 커밋 시각) · 4개 축 각각에 pass 기준 문장과 rule_id 가 존재.

  - id: REQ-2
    statement: >
      조사자는 seed-design 의 npm 패키지 버전(정확한 x.y.z)과 저장소 커밋 SHA 를 고정하고,
      LICENSE 원문 스냅샷을 커밋한 뒤 상업적 사용 · 수정 · 재배포 3항목을 각각 allowed / denied / unclear 로 판정한다.
    acceptance: >
      `--check license` exit 0. 검사: license.md 에 package_version(정규식 `\d+\.\d+\.\d+`) ·
      repo_commit_sha(40자) · snapshots/license/<file> 경로 + sha256 이 존재하고,
      3항목 판정값이 3개 enum 내이며 빈 값 0.

  - id: REQ-3
    statement: >
      조사자는 Next.js App Router 최소 재현 앱에서 seed-design 컴포넌트 5종 이상을 서버 컴포넌트 트리에 렌더해
      (a) `next build` exit 0, (b) hydration mismatch 경고 건수, (c) JS 비활성 HTML 의 텍스트 노출 건수
      3개 수치를 로그 파일과 함께 기록한다.
    acceptance: >
      `--check ssr` exit 0. 검사: probe/ 아래 빌드 로그 · 콘솔 경고 로그 · JS 비활성 HTML 스냅샷 3개 파일 존재 ·
      ssr_probe.md 의 3개 수치가 로그 파일에서 파싱한 값과 일치 · 컴포넌트 수 ≥ 5.

  - id: REQ-4
    statement: >
      조사자는 웹 데스크톱 필요 컴포넌트 12종(Button, Card, Badge, Chip, Input, Select, Checkbox, Radio,
      Tabs, Dialog, Tooltip, Pagination)에 대해 존재/부재와 근거(export 심볼명 또는 소스 경로)를 기록하고
      충족률(%)을 산출한다.
    acceptance: >
      `--check coverage` exit 0. 검사: coverage.csv 행수 = 12 · (component, present, evidence_ref) 3컬럼 빈 값 0 ·
      present=true 인 행은 evidence_ref 가 패키지 내부 경로 또는 export 심볼명 형식 ·
      verdict.md 의 충족률이 coverage.csv 로부터 재계산한 값과 소수 첫째 자리까지 일치.

  - id: REQ-5
    statement: >
      조사자는 토큰을 얻는 경로(패키지명 · 파일 경로 · 포맷)를 명시하고 실제 추출을 실행해
      extracted_tokens.json 을 원본 값 그대로 커밋하며, 추출된 토큰 항목 수가 50개 이상이다.
    acceptance: >
      `--check tokens` exit 0. 검사: token_extraction.md 에 재실행 가능한 커맨드 문자열 존재 ·
      extracted_tokens.json 이 유효 JSON 이고 리프 노드 수 ≥ 50 · 각 리프에 원본 값 문자열이 보존됨
      (해석·리네이밍된 흔적이 없도록 원본 키 경로를 함께 기록).

  - id: REQ-6
    statement: >
      조사자는 verdict.md 에 G5 판정(option_a | option_b) 1개와 4개 축의 판정값 · 적용 rule_id ·
      근거 파일 경로를 기록하며, 판정은 verdict_rule.md 의 매핑과 일치한다.
    acceptance: >
      `--check verdict` exit 0. 검사: verdict 값이 2개 enum 내 · 4개 축 전부에 (value, rule_id, evidence_ref) 존재 ·
      evidence_ref 가 가리키는 파일이 실재 · 룰 매핑 재평가 결과가 기록된 verdict 와 일치.

  - id: REQ-7
    statement: >
      판정이 option_b 이면 채택 컴포넌트 목록과 coverage.csv 의 부재 항목별 대체 계획을,
      option_a 이면 shadcn/ui 로 소유할 컴포넌트 목록과 extracted_tokens.json → 우리 primitive 이름 매핑 표를
      verdict.md 부록으로 첨부한다.
    acceptance: >
      `--check appendix` exit 0. 검사: option_b → 부재 컴포넌트 전건에 대체 계획 셀이 채워짐 /
      option_a → 매핑 표의 좌변 키가 extracted_tokens.json 에 실재하는 키의 부분집합이고 행수 ≥ 20.

# ─── 조건부 금지사항 ────────────────────
forbid:
  - id: FORBID-1
    when: >
      4개 판정 축(license / ssr_compat / coverage / token_extractability) 중 하나라도
      evidence_ref 가 비었거나 가리키는 파일이 존재하지 않는 경우
    must_not: >
      verdict 를 option_b(seed-design 컴포넌트 직접 채택)로 기록
    because: >
      근거 없이 채택한 뒤 SSR 비호환이 드러나면 DS3~DS7 이 전부 재작업이고, 라이선스 문제라면
      이미 배포·색인된 화면의 컴포넌트를 내려야 한다. 미확인은 option_a(토큰만 추출) 쪽으로
      기울어야 되돌리는 비용이 작다.
    detect: >
      `validate_ds0.mjs --check verdict` — verdict=option_b 인 경우 4개 축 evidence_ref 파일 실재를
      전수 검사하고 1건이라도 누락되면 non-zero exit
    on_violation: block_merge

  - id: FORBID-2
    when: >
      어떤 판정 축의 evidence_ref 가 스크린샷 이미지 · 블로그 글 URL · Figma 파일 · 요약문만으로 구성된 경우
      (패키지 tarball · 저장소 커밋 SHA · LICENSE 원문 · 실행 로그가 없는 경우)
    must_not: >
      해당 축에 pass 판정을 부여
    because: >
      이 워크스트림의 전제는 "원천은 코드"다. 2차 자료로 판정하면 실제 패키지에 없는 컴포넌트를 있다고 세게 되고,
      부풀려진 커버리지 충족률이 option_b 를 만들어낸 뒤 DS3 구현 단계에서야 부재가 드러난다.
    detect: >
      `--check evidence` — 각 evidence 항목이 (파일 경로 + sha256 + 취득 URL 또는 버전) 3요소를 갖는지 검사하고,
      확장자가 png/jpg/webp/pdf 인 파일이 유일 근거인 축이 1건이라도 있으면 non-zero exit
    on_violation: block_merge

  - id: FORBID-3
    when: >
      verdict 가 option_a(토큰만 추출)로 판정된 경우
    must_not: >
      seed-design 컴포넌트 소스 파일을 리포지토리에 복사해 두거나 probe/ 디렉터리에 남겨 커밋
    because: >
      라이선스·SSR 미충족으로 배제된 자산이 리포에 남으면 이후 개발 에이전트가 "이미 있으니까" 가져다 쓰고,
      배제 판정 자체가 무의미해진다. 라이선스 위반이 배포까지 도달하면 회수 수단이 없다.
    detect: >
      `--check no-vendored` — 리포 전 파일에서 seed-design 패키지 식별 문자열(패키지명 · 라이선스 헤더 ·
      원본 export 심볼 시그니처) 매칭 파일이 docs/design-system/DS0/snapshots/license/** 외에
      1건이라도 존재하면 non-zero exit
    on_violation: block_merge

  - id: FORBID-4
    when: >
      license.md 의 상업적 사용 · 수정 · 재배포 3항목 중 하나라도 denied 또는 unclear 인 경우
    must_not: >
      token_extraction.md 에 extraction_allowed=true 를 기록하거나 extracted_tokens.json 을 커밋
    because: >
      색상표·타이포 스케일 같은 토큰 값도 저작물 범위에 들어갈 수 있다. 미확인 상태로 추출해 제품에 심으면
      나중에 색·간격을 전부 교체해야 하고, 그 시점엔 이미 수천 개 랜딩이 색인된 뒤라 시각 회귀를 검증할 방법이 없다.
    detect: >
      `--check license` — 3항목 중 denied|unclear 가 있는데 extraction_allowed=true 이거나
      extracted_tokens.json 이 존재하면 non-zero exit
    on_violation: block_merge

  - id: FORBID-5
    when: >
      rule.lock 이 커밋된 이후 실측 결과(ssr_probe 로그 · coverage.csv)가 산출된 시점에서
    must_not: >
      verdict_rule.md 의 통과 기준(커버리지 %, 허용 hydration 경고 수, 라이선스 요구 항목)을 수정
    because: >
      사후 조정은 G5 를 "측정 결과"가 아니라 "원하는 결론에 맞춘 숫자"로 만든다. G5 이후 DS3~DS7 의
      모든 구현 판단이 이 판정에 매달려 있으므로, 기준이 흔들리면 재작업 여부조차 논증할 수 없게 된다.
    detect: >
      `--check rule-lock` — sha256(verdict_rule.md) != rule.lock 이거나
      rule.lock 커밋 시각 > 실측 산출물 최초 커밋 시각이면 non-zero exit
    on_violation: block_merge

# ─── 경계 ───────────────────────────────
out_of_scope:
  - "토큰 3계층 설계 및 우리 토큰 파일 작성 → DS1 소관 (본 태스크는 추출 원본과 매핑 표까지)"
  - "Style Dictionary 빌드 파이프라인 구성 → DS2 소관"
  - "shadcn/ui 실제 설치·초기화 → DS3 소관 (본 태스크의 probe/ 는 판정용 일회성 재현 앱이며 제품 코드가 아니다)"
  - "packages/ui 생성 및 제품 코드 작성 (본 PR 은 docs/ 와 scripts/ 밖을 건드리지 않는다)"
  - "강남언니 등 비공개 코드 자산의 역공학 — 레이아웃 패턴은 관찰 기반 레퍼런스로만 다루며 실사 대상이 아니다"
  - "접근성 임계값 정의 → DS1(constraints.json) · DS6(집행) 소관"
  - "디자이너 인터뷰 · 브랜드 아이덴티티 결정"

rollback: >
  1) `git revert -m 1 <merge_sha>` 로 docs/design-system/DS0/** 와 scripts/design-system/validate_ds0.mjs 제거.
  2) G5 상태를 `undecided` 로 되돌리고, DS3 브랜치가 존재하면 draft 전환 후 착수 중단
     (DS1 은 토큰 계층 작업이므로 판정과 무관하게 계속 진행 가능).
  3) 본 태스크는 읽기 전용 조사와 로컬 probe 앱 실행만 수행하며 외부 상태를 변경하지 않는다.
     probe 앱은 리포 밖으로 배포하지 않으므로 revert 이후 잔여물이 없다.

done_when:
  - "verdict_rule.md + rule.lock 이 실측 산출물보다 앞선 커밋으로 존재한다"
  - "license 스냅샷 · ssr probe 로그 · coverage.csv · extracted_tokens.json 4개 근거가 모두 커밋되어 있다"
  - "verdict.md 에 option_a | option_b 판정이 축별 rule_id 와 함께 기록되어 있다"
  - "판정에 대응하는 부록(대체 계획표 또는 토큰 매핑표)이 첨부되어 있다"
  - "`node scripts/design-system/validate_ds0.mjs --all` exit 0"
  - "FORBID-1~5 각각에 대응하는 --check 서브커맨드가 의도적 위반 픽스처에서 non-zero exit 하는 것을 확인"
  - "팀 리드가 G5 판정과 그에 따른 DS3 분기(옵션 A/B)를 수령했다"
```
