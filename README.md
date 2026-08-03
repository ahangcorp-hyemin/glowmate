# glowmate

3050을 위한 웰니스 오프라인 업체 리스트업 서비스. 강남·서초·송파 시드.
**UVP: 전화 걸지 않고도 회당 단가로 비교한다.**

이 리포는 [계약 기반 오케스트레이션](./CLAUDE.md)으로 개발한다 — 계약(`docs/tasks/<ID>.md`)이 정본이고,
태스크 1개 = PR 1개다. 아래 CI 는 그 계약들의 `on_violation: block_merge` 를 실제로 집행하는 기반이다.

---

## 워크스페이스 경계

```
                    ┌─────────────────────────────────────────┐
                    │  apps/web            (Next.js App Router)│
                    │  packages/ui         (DS1~DS7, 미생성)   │
                    │  packages/price-state(C7, 미생성)        │
                    └──────────────┬──────────────────────────┘
                                   │  DB 접근 금지 (REQ-3 / FORBID-1)
                                   │  · packages/db 도달 불가
                    ═══════════════╪═══════════════  경계  ═══
                                   │  · data-access 분류 의존 0건
                                   ▼
                    ┌─────────────────────────────────────────┐
                    │  packages/api   조회 함수·zod 계약 (F5)   │
                    │  packages/db    커넥션 팩토리   (F2a~c)   │
                    │       └─ 이 둘만 DB 접근을 보유한다        │
                    └─────────────────────────────────────────┘

  packages/config   경계 정본 — 위 판정의 기대값을 담는다 (CODEOWNERS 소유)
  tools/            검사기 — 여기를 고칠 수 있으면 모든 detect 가 무력화된다
  services/crawler  Python 3.12 + Playwright. **pnpm workspace 밖이다**
```

**경계가 왜 이 모양인가:** 웹 라우트가 DB에 직접 붙으면 F5 의 `public_venue` 경유 강제가 무력화되어
C7 이 비공개로 돌린 업체가 상세 API 로 계속 나간다. 그리고 SSR 컴포넌트마다 커넥션이 생성돼
Vercel 함수에서 풀이 고갈된다. 모듈명 부인목록으로 막으면 `@vercel/postgres` 한 줄로,
도달성만 보면 `@prisma/client`·`@supabase/supabase-js` 로 뚫린다 — 그래서 **도달성 + 분류** 이중 검사다.

`services/crawler` 가 워크스페이스 밖인 이유: python 미설치 러너에서도 `pnpm -r build` 가 성립해야 한다(REQ-4).

---

## CI — 검사 job 8개 + 애그리게이터 1개

| job | 목적 | 규칙 |
|---|---|---|
| `typecheck` | strict 3플래그 상속 + `tsc --noEmit` 오류 0건 | REQ-2 |
| `lint` | eslint + CI 메타 검사(워크플로·예산·CODEOWNERS·우회 관용구) | REQ-5·6·7 · FORBID-2·5 |
| `boundary` | 의존 도달성 + 의존 분류 이중 경계 검사 | REQ-3 · FORBID-1 |
| `test` | 워크스페이스 구성 · `next build` 라우트 요약(정적 기본값) | REQ-1·8 · FORBID-3 |
| `python` | crawler 독립 툴체인 — ruff + pytest + Playwright 스모크 | REQ-4 |
| `secret-scan` | 자격증명 커밋 차단 (gitleaks) | — |
| `discovery` | `validate_d*.py` 존재 요구 + 비스텁 요구 | FORBID-6 |
| `path-guard` | `.github/pr-task` 계약의 touches 밖 경로 변경 차단 | FORBID-4 |
| **`ci-required`** | **위 8개를 집계하는 유일한 필수 체크** | REQ-6 |

검사 job 8개는 `needs` 를 선언하지 않는다 — 병렬이며, 하나가 죽어도 나머지 7개의 판정이 남아야
픽스처 귀속 검증이 성립한다.

### `ci-required` 가 `if: always()` 인 이유

`needs:` 만 선언하면 선행 job 이 실패했을 때 애그리게이터는 **실행되지 않고 `skipped`** 로 끝나고,
**GitHub 브랜치 보호는 skipped 필수 체크를 통과로 취급한다.** 즉 8개 job 이 전부 red 여도 머지가 열린다.
그래서 실행을 보장한 뒤 `needs.*.result` 를 명시 평가해 non-success 를 실패로 전파한다.

`if: always()` 는 FORBID-2 의 우회 관용구 목록에 있지만, 계약 FORBID-2 `when` 의 제외 절이
**job 이름이 정확히 `ci-required` 인 단 하나의 job** 에 한해 제외한다. 검사 job 8개의
`if:`·`continue-on-error` 는 그대로 금지 대상이다.

---

## CI 예산 (`.github/ci-budget.json`)

job 당 상한 **8분**. 값은 워크플로의 `timeout-minutes` 와 정확히 일치해야 한다.

| job | 분 | job | 분 |
|---|---:|---|---:|
| `typecheck` | 5 | `python` | 8 |
| `lint` | 5 | `secret-scan` | 4 |
| `boundary` | 5 | `discovery` | 4 |
| `test` | 8 | `path-guard` | 3 |
| | | `ci-required` | 2 |

**기존 항목의 상향은 `.github` CODEOWNERS 승인 없이는 CI 가 red 다(FORBID-5).** 신규 job 추가는 해당 없음.
CI 가 느려지면 상한을 올리지 말고 테스트 분할·캐시·job 분리로 해결한다 — 상한을 올리는 것이 언제나
최단 경로이고, 그 끝에서 다음에 하는 행동은 job 을 지우는 것이다.

---

## 위반 픽스처 (`.github/ci-fixtures/`)

검사기가 **실제로 위반을 잡는지**를 입증한다. 검사 로직 0줄로도 통과하는 CI 를 막기 위한 장치다.
각 트리는 **위반 1종만** 포함하는 독립 트리이고, 판정 기준은 **대응 job 만 red · 나머지 7개 green**
+ 실패 사유가 규칙 ID 로 귀속 + 현재 PR 의 워크플로 정의로 재실행된 런일 것(신선도).

| # | 트리 | 심는 위반 | red 가 되어야 하는 job |
|---|---|---|---|
| ① | `boundary/` | `@vercel/postgres` 의존 (드라이버 도달) | `boundary` |
| ② | `lint/` | 사유 주석 없는 `eslint-disable` | `lint` |
| ③ | `test/` | `force-dynamic` 페이지 라우트 | `test` |
| ④ | `typecheck/` | 타입 오류 | `typecheck` |
| ⑤ | `secret-scan/` | 가짜 자격증명 | `secret-scan` |
| ⑥ | `python/` | 실패하는 pytest | `python` |
| ⑦ | `discovery/` | 항상 exit 0 인 스텁 `validate_d*.py` | `discovery` |
| ⑧ | `path-guard/` | touches 밖 경로 변경 | `path-guard` |

**각 트리는 lockfile 정합을 유지해야 한다** — install 실패로 전 job 이 red 가 되면 귀속 검증이 무의미해진다.
그리고 픽스처 8종의 각 런에서 **`ci-required` 의 conclusion 이 `success` 가 아님**을 확인한다.
이 확인이 없으면 skipped=통과 semantics 때문에 8개 job 이 전부 red 여도 머지가 열린다.

`.github/ci-fixtures/**` 는 루트 lint·typecheck 의 `ignores` 에 있다 — 의도적 위반을 담고 있으므로
본 트리가 그것을 읽으면 자기 PR 이 자기 픽스처 때문에 red 가 된다.

### REQ-3 전용 픽스처

| 트리 | 심는 것 | 기대 |
|---|---|---|
| `boundary-prisma/` | `@prisma/client` (도달하지 않으나 `data-access` 분류) | `boundary` red |
| `boundary-unclassified/` | 미분류 신규 의존 | `boundary` red |
| `boundary-ui-other/` | 순수 UI 의존을 `other` 로 등재 | **`boundary` green** |

마지막 것이 red 이면 DS1·DS3 에 합법 경로가 없다는 뜻이다 —
**모든 금지는 짝이 되는 정상 동작 요구를 가진다**(원칙 2.5).

---

## 개발

```bash
corepack enable
pnpm install --frozen-lockfile

pnpm build          # pnpm -r build
pnpm typecheck
pnpm lint
pnpm test
pnpm test:dep-graph # 경계 검사 (boundary job)
pnpm test:ci-meta   # CI 메타 검사 (lint job)
pnpm test:path-guard
pnpm test:discovery
```

crawler 는 별도 툴체인이다:

```bash
cd services/crawler
pip install -e '.[dev]'
python -m playwright install chromium
ruff check . && python -m pytest -q
```

### 의존을 추가할 때

`packages/api`·`packages/db` 밖의 패키지에 의존을 추가하면 **`packages/config/dependency-classes.json`
에 분류를 등재해야 한다.** 미분류 1건이면 `boundary` 가 exit 1 한다.

이 파일은 **전 계약 공통 허용 경로**라서 자기 PR 안에서 편집해도 `path-guard` 에 걸리지 않는다.
`other` 신규 추가는 승인이 필요 없다. `data-access` 추가·기존 항목 분류 변경, 그리고
`data-access-names.json` 에 매칭되는 이름을 `other` 로 다는 것은 승인 대상이다.

### CODEOWNERS 와 `single_maintainer`

현재 push 권한 계정이 1개라 "승인자 ≠ PR 작성자"를 GitHub 리뷰로 집행할 수 없다.
`.github/CODEOWNERS` 헤더의 **`single-maintainer-until: 2026-11-01`** 까지만 유효한 한시 완화이며,
그 날짜가 지나면 `lint` job 이 exit 1 한다. 대체 규약은 승인을 흉내내지 않고 검증 가능한 것
(승인 대상 파일은 **그 파일만 담은 독립 PR**)만 요구한다. 자세한 근거는 `docs/tasks/F1.md` REQ-7.
