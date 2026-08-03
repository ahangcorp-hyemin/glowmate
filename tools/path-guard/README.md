# tools/path-guard — FORBID-4 집행기

CI job 이름: **`path-guard`** (고정. C2·C3 계약이 이 이름을 인용한다)
계약: `docs/tasks/F1.md` FORBID-4 · 감사 `docs/audit/f1-gate2.md` §1 B-5 / B-3b′

```bash
pnpm test:path-guard          # = node tools/path-guard/index.mjs  (FORBID-4 판정)
pnpm test:selftest:path-guard # = node --test tools/path-guard/test/*.test.mjs (자기 테스트 40건)
```

**자기 테스트는 환경 독립이다.** 판정 축이 되는 CI 변수(`GITHUB_REF_NAME` · `GITHUB_HEAD_REF` ·
`GITHUB_EVENT_NAME` · `GITHUB_ACTIONS` · `CI` 등)는 자식 CLI 에 **상속시키지 않고**
(`test/helpers/env.mjs` 의 화이트리스트 방식 `cleanEnv()`), 각 케이스가 필요한 값만 명시 주입한다.
그렇지 않으면 selftest 를 `path-guard` job 안에서 돌릴 때 그 job 의 `GITHUB_REF_NAME=ci-fixture/*`
가 자식에게 새어 임시 리포의 브랜치와 무관하게 픽스처 판정 경로를 타고, **통과 이유가 코드가 아니라
주변 환경**이 된다. 회귀 방어 테스트 1건이 이 상태를 직접 감시한다.

## 무엇을 판정하는가

PR 의 변경 파일 집합이, 그 PR 이 구현한다고 선언한 계약의 `touches` 글롭 안에 있는지.

1. `.github/pr-task` — 이 PR 이 구현하는 **계약 정본 ID 1줄**을 읽는다.
2. `docs/tasks/*.md` 의 ```yaml 블록에서 `id:` 를 대조해 계약 파일을 찾는다.
   파일명은 축약형(`docs/tasks/F1.md`)이고 정본 ID 는 `F1-REPO-SCAFFOLD` 이므로 **파일명이 아니라 `id:` 필드로 해석**한다.
3. 그 계약의 `touches` 블록을 **직접 파싱**한다.
   `docs/tasks.json`(F1b-CONTRACT-GOVERNANCE 소유)에 **의존하지 않는다** — F1 단독 머지 상태에서도 동작해야 하는 자립 경로다.
4. `git diff --name-only --no-renames <base>...HEAD` 와 대조한다 (base 선택은 아래 §비교 기준).
5. touches 글롭 밖 경로가 **1건이라도** 있으면 `exit 1`.

## 비교 기준(base) 선택 — `lib/base-ref.mjs`

| ref | base | 근거 |
|---|---|---|
| 일반 브랜치 (기본) | `origin/main` 과의 공통 조상 | PR 의 변경 집합 = `origin/main...HEAD` |
| `ci-fixture/**` (단, `pull_request` 이벤트 제외) | **분기점 = 오버레이 커밋의 부모(HEAD~1) = PR HEAD** | 픽스처 브랜치는 `tools/ci-meta/fixtures-run.mjs` 가 PR HEAD 에서 분기해 오버레이 커밋 1개를 얹은 것이다. `origin/main` 기준으로 보면 F1 의 변경 전량이 diff 에 들어오고, 픽스처 ⑦ 처럼 `.github/pr-task` 를 `D1a-PROTOCOL` 로 바꾸는 트리에서는 그 전량이 D1a touches 밖이 되어 **대응 job 외의 `path-guard` 까지 red** 가 된다 (REQ-5 "대응 job 만 red · 나머지 7 green" 위반. 감사 `f1-gate2.md` §4-1 이 예고한 발현) |

**어느 기준을 썼는지는 성공·실패 출력 양쪽에 항상 명시한다** (`기준: origin/main...HEAD …` / `기준: 픽스처 분기점 HEAD~1 …`).

완화가 PR 브랜치로 새지 않도록 픽스처 모드 진입 조건을 좁혔다. 하나라도 어긋나면 **exit 1** (기준을 못 정하는 상태는 통과가 아니다):

1. ref 이름이 `ci-fixture/` 로 시작 (CI: `GITHUB_HEAD_REF` → `GITHUB_REF_NAME`, 로컬: `git rev-parse --abbrev-ref HEAD`)
2. 이벤트가 `pull_request` 가 **아님** — PR 로 머지되는 경로에는 절대 적용하지 않는다. 적용하면 브랜치를 `ci-fixture/x` 로 명명하고 위반 커밋을 앞 커밋에 숨기는 우회가 열린다
3. HEAD 가 부모 1개인 비병합 커밋
4. HEAD 커밋 제목이 `ci-fixture(<name>):` 형식 (fixtures-run.mjs 가 만드는 형식)
5. `.github/ci-fixtures/<name>/` 트리가 실제로 존재 — 커밋 제목만으로 완화하지 않는다
6. HEAD~1 이 또 다른 `ci-fixture(...)` 커밋이 **아님** — 오버레이가 2개 쌓이면 앞 커밋의 변경이 판정에서 빠지는 미탐이 된다

픽스처 ⑧(path-guard)은 이 모드에서도 red 다: 오버레이가 `docs/notes/out-of-touches.md` 이고 `.github/pr-task` 가 `F1-REPO-SCAFFOLD` 이므로 touches 밖 1건이 그대로 남는다. 탐지력은 유지된다.

## 전 계약 공통 허용 3경로

touches 밖이어도 통과한다 (`lib/check.mjs` 의 `ALWAYS_ALLOWED`):

| 경로 | 이유 |
|---|---|
| `.github/pr-task` | 판정 원천 자체. 모든 PR 이 자기 계약 ID 를 기재해야 한다 |
| `pnpm-lock.yaml` | 의존을 추가하면 반드시 갱신된다 |
| `packages/config/dependency-classes.json` | F1 REQ-3 (b) 가 전 패키지에 의존 분류를 강제한다. 의존을 추가하는 **모든** 하류 계약이 이 파일을 편집해야 한다 — 이 허용이 없으면 DS1·DS3 은 boundary red 와 path-guard red 사이에서 합법 경로가 0개가 된다 (감사 B-3b′) |

`packages/config/` 의 **다른** 파일(예: `tsconfig.base.json`)은 공통 허용이 아니다. 정확 경로 일치만 허용한다.

## exit 1 이 되는 모든 경우

| 상황 | 이유 |
|---|---|
| touches 글롭 밖 경로 변경 | FORBID-4 본체 |
| `.github/pr-task` 부재 · 빈 파일 · 2줄 이상 | 판정 원천 부재를 통과로 처리하지 않는다 |
| 미등재 계약 ID (`docs/tasks/*.md` 의 `id:` 어디에도 없음) | 상동 |
| 같은 ID 가 2개 계약 파일에 중복 | touches 확정 불가 |
| 계약에 `touches:` 키 없음 | 허용 범위 판정 불가 |
| 계약에 `touches:` 가 있는데 파싱 항목 0건 | **파싱 실패 ≠ 위반 0건.** 조용한 통과가 이 프로젝트에서 반복 지적된 최악의 미탐이다 (`scripts/tasks_manifest.py:20-22` 와 같은 취지) |
| `origin/main` 해석 실패 (얕은 클론 등) | diff 를 못 구했으면 빈 diff 로 통과시키지 않는다. 워크플로는 `fetch-depth: 0` 필요 |
| merge-base 계산 실패 · 기준 커밋 == HEAD(커밋 0건) | 체크아웃 ref 오류를 통과로 처리하지 않는다 |
| `ci-fixture/**` 인데 픽스처 모드 조건 (3)~(6) 불충족 | 비교 기준을 확정할 수 없는 상태 |
| 그 외 예기치 못한 예외 | `index.mjs` 가 exit 1 로 변환. 종료 코드 마스킹 없음 |

실패 출력은 **항상 `FORBID-4` 토큰과 위반 경로 전량**을 포함한다 (REQ-5 픽스처 ⑧ 의 귀속 검증이 이 문자열에 의존).

## 글롭 문법 (`lib/glob.mjs`)

계약 `touches` 표기의 실제 변이형만 지원한다.

| 표기 | 의미 | 실제 사용처 |
|---|---|---|
| `**` | 여러 세그먼트 | `apps/web/**`, `packages/config/**` |
| 더블스타 + `/` | 0개 이상 세그먼트 | — |
| `*` | 한 세그먼트 내부 (`/` 를 넘지 않음) | `ops/alerts/o3-*.yml` |
| `?` | `/` 아닌 한 글자 | — |
| `{a,b}` | 택일 | `packages/ui/src/components/{venue,tag,filter,list}/*.cases.tsx` |
| 그 외 | 리터럴 | `(browse)` · `[slug]` · `<SOURCE_ID>` 도 리터럴 |

- 항목 뒤의 `# 주석` 은 제거하고 경로만 취한다. 항목과 같은 열에 이어지는 주석 전용 줄(DS1.md 표기)도 건너뛴다.
- 블록 리스트(`- path`)·인라인 리스트(`[a, b]`, 여러 줄에 걸쳐도 최초 `]` 까지)·스칼라 1건을 모두 읽는다.
- **디렉터리 자동 승격을 하지 않는다.** `tools/ci-meta` 는 그 파일 자체만 매칭하고 하위 파일은 매칭하지 않는다(`tools/ci-meta/**` 로 써야 한다). 확장자 없는 이름을 임의로 디렉터리로 넓히면 touches 범위가 조용히 커져 미탐이 된다.

## 파일

```
index.mjs           진입점. 성공 요약 출력 / 실패는 exit 1
lib/check.mjs       판정 절차 · ALWAYS_ALLOWED 3경로 · 위반 분류
lib/contract.mjs    docs/tasks/*.md 의 yaml 펜스 · id · touches 파서
lib/glob.mjs        touches 글롭 → 정규식
lib/base-ref.mjs    비교 기준 선택 (기본 origin/main · ci-fixture/** 만 분기점)
lib/git.mjs         ref 해석 · merge-base · 변경 파일 목록 (실패는 전부 예외)
lib/errors.mjs      PathGuardError · FORBID-4 토큰
test/*.test.mjs     자기 테스트 40건 (node:test, 외부 의존 없음)
test/helpers/env.mjs  자식 CLI 환경 통제 — CI 변수 상속 차단 + 명시 주입
```

Node 24 ESM. **새 의존 없음** (`node:` 내장 모듈과 `git` 만 사용).
