# tools/path-guard — FORBID-4 집행기

CI job 이름: **`path-guard`** (고정. C2·C3 계약이 이 이름을 인용한다)
계약: `docs/tasks/F1.md` FORBID-4 · 감사 `docs/audit/f1-gate2.md` §1 B-5 / B-3b′

```bash
pnpm test:path-guard                        # = node tools/path-guard/index.mjs
node --test "tools/path-guard/test/*.test.mjs"   # 검사기 자체의 자기 테스트 (31건)
```

## 무엇을 판정하는가

PR 의 변경 파일 집합이, 그 PR 이 구현한다고 선언한 계약의 `touches` 글롭 안에 있는지.

1. `.github/pr-task` — 이 PR 이 구현하는 **계약 정본 ID 1줄**을 읽는다.
2. `docs/tasks/*.md` 의 ```yaml 블록에서 `id:` 를 대조해 계약 파일을 찾는다.
   파일명은 축약형(`docs/tasks/F1.md`)이고 정본 ID 는 `F1-REPO-SCAFFOLD` 이므로 **파일명이 아니라 `id:` 필드로 해석**한다.
3. 그 계약의 `touches` 블록을 **직접 파싱**한다.
   `docs/tasks.json`(F1b-CONTRACT-GOVERNANCE 소유)에 **의존하지 않는다** — F1 단독 머지 상태에서도 동작해야 하는 자립 경로다.
4. `git diff --name-only --no-renames origin/main...HEAD` 와 대조한다.
5. touches 글롭 밖 경로가 **1건이라도** 있으면 `exit 1`.

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
| merge-base 계산 실패 · HEAD 가 origin/main 의 조상(커밋 0건) | 체크아웃 ref 오류를 통과로 처리하지 않는다 |
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
lib/git.mjs         origin/main 해석 · merge-base · 변경 파일 목록 (실패는 전부 예외)
lib/errors.mjs      PathGuardError · FORBID-4 토큰
test/*.test.mjs     자기 테스트 (node:test, 외부 의존 없음)
```

Node 24 ESM. **새 의존 없음** (`node:` 내장 모듈과 `git` 만 사용).
