# F1-REPO-SCAFFOLD PR #38 — **FAIL**

> PR 검수 · 검수일 2026-08-03 · 검수관 pr-reviewer
> 대상: `feat/f1-repo-scaffold` @ `73fa6ec` (PR #38, base `main` @ `0f4c47e`)
> 기준: `docs/tasks/F1.md`(개정본) · `docs/audit/f1-gate.md` · `docs/audit/f1-gate2.md` · `docs/02-task-contract-spec.md`
> 검수 방식: 모든 acceptance/detect 를 **직접 실행**하고, 각 FORBID 에 대해 **위반을 실제로 주입해** 검사기가 잡는지 확인했다.

**판정: FAIL — 차단 5건 · 비차단 6건.**
(별도 판정: `f1-ci-meta` 미커밋 방어 2건의 부재 = **둘 다 비차단** · §4-bis)

구현의 밀도와 자기검사 설계 수준은 이 프로젝트에서 본 것 중 가장 높다. `Report.skip()` 이 CI 에서
자동으로 FAIL 로 승격되는 구조(`tools/ci-meta/lib/util.mjs:91-101`), 판정 불가를 통과로 처리하지 않는
일관성, 픽스처 8종의 **실제 Actions 런** 귀속·신선도 검증, `ci-required` 실패 전파의 런타임 실증 —
전부 실물로 작동함을 확인했다.

그럼에도 FAIL 인 이유는 하나다. **검사기 자신을 무력화하는 경로가 세 군데 열려 있고, 그 경로를
막아야 할 탐지 수단이 CI 에서 실행되지 않는다.** 이것은 F1 이 막으려던 바로 그 실패 유형이다.

---

## 0. 검수 중 임시 수정과 원복

3단계 (b) 검증을 위해 아래를 임시 수정했고 **전부 원복했다.**

| 대상 | 무엇을 했나 | 원복 확인 |
|---|---|---|
| `.github/workflows/ci.yml` | `ci-required` 를 순진한 needs-only 로 되돌림 · `if: success()` · needs 1개 제거 · `\|\| true` · `set +e` · `continue-on-error` · 검사 job 에 `if: always()` · 예산 9분 | `git checkout` / 원본 복사 |
| `tools/dep-graph/index.mjs` | `process.exit(code)` → `process.exit(0)` | 원본 복사 |
| `apps/web/package.json` · `packages/config/dependency-classes.json` | `@vercel/postgres` · `pg` · `@radix-ui/react-dialog` 등재 실험 | 원본 복사 |
| `packages/config/tsconfig.base.json` | `strict:false` · `noUncheckedIndexedAccess` 삭제 | 원본 복사 |
| `.github/CODEOWNERS` | 만료일 과거화 · 91일 초과 · 경로 삭제 · 만료일 줄 삭제 | 원본 복사 |
| `apps/web/src/lib/venues.ts` · `venues.test.ts` · `apps/web/package.json` | `eslint-disable` · `test.skip` · `--passWithNoTests` | `git checkout` |
| `apps/web/src/app/venues/**` · `packages/api/**` | force-dynamic · `unstable_noStore` · 라우트 삭제 · typecheck 스크립트 삭제 · 타입 오류 | 원본 복사 |
| 커밋 1개 | touches 밖 파일(`docs/notes/reviewer-probe.md`) 커밋 후 path-guard 실행 | `git reset --hard 73fa6ec` |

**최종 상태 검증:** `HEAD = 73fa6ece4fea1b6d40f0de03c17e5c180b6d206e` (검수 전과 동일) ·
브랜치 `feat/f1-repo-scaffold` · 검수 시작 시 존재하던 **미커밋 변경 3파일을 stash 후 pop 하여
바이트 단위로 동일하게 복원**(`diff /tmp/f1-uncommitted.patch /tmp/after.patch` → 차이 없음).
계약 파일과 구현 파일에 대한 영구 변경은 0건이다.

> ⚠ **검수 시작 시점에 워킹트리에 미커밋 변경 3파일이 있었다** (`tools/ci-meta/checks/req5-fixtures.mjs`,
> `tools/ci-meta/fixtures-run.mjs`, `tools/ci-meta/lib/git.mjs`). 오케스트레이터 확인 결과 이는 **다른
> 에이전트(`f1-ci-meta`)의 커밋 직전 작업**이며 **PR #38 에 포함되어 있지 않다.** 본 검수는 지시에 따라
> **커밋된 상태 `73fa6ec`(= `origin/feat/f1-repo-scaffold` = PR #38 의 내용)** 만을 대상으로 했다.
> 그 3파일은 stash → pop 으로 **바이트 단위 복원**했고 오케스트레이터 백업
> `/tmp/ci-meta-hardening.patch` 와 `diff` 결과 동일함을 확인했다(검수 종료 시점 재확인 완료).
> 그 변경이 담은 방어 2건의 **부재가 차단인지 비차단인지**는 §4-bis 에서 별도 판정한다.

---

## 1. 범위 (1단계) — **통과**

변경 파일 **119건** (`git diff --name-only main...HEAD`). 전건이 `deliverable.touches` 27개 글롭 안에 있다.
검사기 자신의 판정으로도 확인된다:

```
$ pnpm test:path-guard
path-guard: 계약 F1-REPO-SCAFFOLD (docs/tasks/F1.md) · touches 27건
  변경 119건 = touches 내 116건 + 공통 허용 3건 + 위반 0건
  · 공통 허용: .github/pr-task / packages/config/dependency-classes.json / pnpm-lock.yaml
```

- `out_of_scope` 침범 0건. `docs/registry/**` · `docs/gates/**` · `tools/dag-check/**` · DB 마이그레이션 ·
  디자인 토큰 · `validate_d*.py` 실물 — 전부 미생성 확인.
- 계약 개정(`docs/tasks/F1.md`)은 **별도 커밋으로 main 에 선행 반영**되어 구현 PR 과 섞이지 않았다
  (`b178002` · `93a9021` · `0f4c47e`). `docs/**` 가 F1 touches 밖이므로 이는 올바른 분리다.
- 롤백 단위: 신규 파일 생성만 119건. `git revert` 로 원복 가능. 외부 상태(워크플로 등록 · 브랜치 보호
  ruleset · 픽스처 브랜치 11개)는 `rollback:` 절이 명시.

---

## 2. 요구사항 (2단계)

| REQ | acceptance 실행 | 결과 | 판정 |
|---|---|---|---|
| REQ-1 | `pnpm install --frozen-lockfile && pnpm -r build` · `pnpm test:workspace` | build exit 0 · `필수 4개 멤버 {apps/web, packages/api, packages/config, packages/db} 전부 포함 (추가 멤버 허용)` | **충족** |
| REQ-2 | `pnpm typecheck` · **세 플래그 assert 테스트** | tsc exit 0 ✓ / **assert 테스트가 리포에 존재하지 않음** | **미충족 (차단 B-A)** |
| REQ-3 | `pnpm test:dep-graph` | (a)(b)(iii) 전건 PASS · 미분류 0건 · data-access 0건 · 예외 0건 | 충족 (단 detect 측 결함 B-D) |
| REQ-4 | `pytest -q` · `ruff check .` | `7 passed` · `All checks passed!` · Playwright 스모크 assert 실재(`test_extract_smoke.py:22-29`) · `pnpm -r build` 가 python 없이 exit 0(test job 별도 스텝 `ci.yml:109-110`) | **충족** |
| REQ-5 | `GH_TOKEN=… pnpm test:ci-meta` | 8 job 집합 포함 ✓ · 픽스처 8종 전부 **실제 런**에서 대응 job red · 나머지 7 green · 귀속 · 신선도 ✓ | 부분 (⑥ 귀속 오탐 · 면제 누수 B-B) |
| REQ-6 | 동상 + GitHub API | (a) `required status checks == {ci-required}` (ruleset) ✓ (b) `needs ⊇ 8 job` ✓ (c) 정적 R6C-1~5 ✓ + **런타임: 픽스처 8종 각 런 `ci-required` conclusion=failure** ✓ | 부분 (R6C-5 정적 홀 · B-B) |
| REQ-7 | 동상 | (a) 7경로 전건 ✓ (b) `require_code_owner_review == true` (ruleset) ✓ (c) collaborator 1명 → `SINGLE_MAINTAINER` (c-1)(c-2)(c-3) 전건 ✓ | **충족** |
| REQ-8 | `pnpm test:routes /tmp/next-build.log` | `Static/ISR 페이지 라우트 2건 ≥ 2 {○/, ●/venues/[slug]}` | **충족** |

**임계값 하향 없음.** `.github/ci-budget.json` 의 9개 값이 `ci.yml` 과 정확히 일치하고 전건 ≤ 8분,
`limit_minutes_per_job: 8` 유지. 90일 상한(`MAX_RELAXATION_DAYS = 90`) 유지. `dependency-classes.json`
`data-access` 0건. 테스트 스킵·비활성화 0건(`pnpm test` 출력 `skipped 0`, pytest `7 passed`).

### 실제 PR 런 (권위 있는 판정)

```
$ gh run view 30774762887 --json jobs   # PR #38 head 73fa6ec, event=pull_request
typecheck/lint/boundary/test/python/secret-scan/discovery/path-guard: success
ci-required: success
# lint job 내부:
--- ci-meta (REQ-5 · REQ-6 · REQ-7 · FORBID-2 · FORBID-5): FAIL=0 SKIP=0 EXEMPT=0 PASS=99
```

`SKIP=0 EXEMPT=0` 이 중요하다 — CI 에서 API 의존 검사 6건이 **면제되지 않고 실제로 판정**됐다.
이 green 은 "검사를 안 돌려서 얻은 green" 이 아니다. 그 점은 확인했다.

---

## 3. 금지사항 (3단계) — detect 가 **실제로 위반을 포착하는가**

각 항목은 (a) detect 파일 실재 + (b) **위반 주입 실증**으로 판정했다.

### FORBID-1 — DB 경계 · **유효 (단 메타테스트 공백)**

(a) `tools/dep-graph/**` 실재(486+377+lib 5종). (b) 실증:

| 주입 | 결과 |
|---|---|
| `apps/web` 에 `@vercel/postgres` 추가 | exit 1 · `[REQ-3(b)] 미분류` + `[REQ-3(a)] 와이어 드라이버 도달` 2건 |
| `pg` 를 추가하고 `dependency-classes.json` 에 `other` 로 **위장 등재** | exit 1 (도달성 경성 금지) · 로컬은 `승인 대상 후보 1건: 위장 등재 후보 "pg"→other` 명시 |
| `@radix-ui/react-dialog` 를 `other` 로 등재 (**DS1·DS3 합법 경로**) | exit 0 ✓ — 짝 되는 정상 동작이 살아 있다 |
| `db-driver-exceptions.json` 3필드 누락 · 만료 초과 | selftest `07`·`07b` → exit 1 |
| 검사 대상 0건 · 허용목록 공허 | selftest `06`·`09` → exit 1 (0건 자동 통과 방지) |

실제 Actions 런으로도 확인: `ci-fixture/boundary-prisma`(#30774780080) · `boundary-unclassified`(#30774784388)
= boundary 만 failure / 나머지 7 + `ci-required` 전부 정상 · `boundary-ui-other`(#30774782364) = **success**.

**그러나** — 계약 FORBID-1 detect 가 요구한 "픽스처 ①②③ 이 boundary job 만 red 로 만드는지 확인하는
메타테스트"는 ① 만 자동화돼 있다. ②③④ 는 §4 B-D 참조.

### FORBID-2 — 종료 코드 마스킹 · 검사 대상 축소 · **무효 (차단 B-C)**

(a) `tools/ci-meta/forbid2-patterns.mjs` + `checks/forbid2-masking.mjs`(448줄) 실재. (b) 실증:

| 주입 | 탐지 |
|---|---|
| 검사 job 에 `continue-on-error: true` | ✅ FAIL 6건 (라인 + job 레벨 이중) |
| `pnpm test:dep-graph \|\| true` | ✅ `or-true` |
| `set +e` | ✅ `set-plus-e` |
| `--passWithNoTests` | ✅ `pass-with-no-tests` |
| 사유 없는 `eslint-disable` | ✅ `disable-without-reason` + `pnpm lint` 도 red |
| `test.skip(` | ✅ `test-skip-only` 3건 |
| 검사 job(`boundary`)에 `if: always()` | ✅ `if-always` — **제외는 `ci-required` 1개로만 한정됨을 실증** |
| **`tools/dep-graph/index.mjs` 말미 `process.exit(0)`** | ❌ **미탐** |

계약 FORBID-2 when 이 **명시적으로 열거한** "스크립트 말미 `exit 0`" 이 잡히지 않는다.
`TRAILING_EXIT_ZERO_RE`(`forbid2-patterns.mjs:110`)는 `forbid2-masking.mjs:257` 에서
`.sh/.bash/.zsh` 와 `.github/workflows/**` 에만 적용된다. **이 리포의 검사기는 전부 `.mjs` 다.**

→ **detect 가 이 위반을 포착하지 못하므로 FORBID-2 는 무효 처리한다.** 상세는 §4 B-C.

### FORBID-3 — 페이지 라우트 정적 기본값 · **유효**

| 주입 | 탐지 |
|---|---|
| `page.tsx` 에 `dynamic='force-dynamic'` | ✅ 1차(요약 `ƒ /venues`) + 2차(토큰 grep) **둘 다** |
| `unstable_noStore` import | ✅ 2차 수단 |
| 정적 라우트를 1개로 감축 | ✅ `Static/ISR 페이지 라우트가 1건으로 2건 미만` |
| 빌드 로그 없음 / `Route (app)` 섹션 없음 | ✅ **FAIL** (파싱 실패를 통과로 처리하지 않음) |
| Route Handler `/api/health` 가 `ƒ` | ✅ 무탐 (계약 예외 정확히 반영) |

실제 런 #30774766632 에서 `test` job 만 red, 실패 스텝 = 요약 파싱 스텝, 귀속 토큰 `FORBID-3` 확인.

### FORBID-4 — touches 밖 경로 · **유효**

| 주입 | 탐지 |
|---|---|
| touches 밖 파일을 **커밋** 후 실행 | ✅ exit 1 · 위반 경로 · 허용 범위 27건 전량 출력 |
| `.github/pr-task` 삭제 | ✅ exit 1 |
| 미등재 계약 ID | ✅ exit 1 (계약 41건 조회 후 판정) |
| `GITHUB_HEAD_REF=ci-fixture/sneaky` + `pull_request` (완화 누수 시도) | ✅ **완화 미적용** — `base-ref.mjs:152` 가 `pull_request` 를 명시 제외 |
| `GITHUB_REF_NAME=ci-fixture/sneaky` + push, 오버레이 커밋 아님 | ✅ exit 1 (커밋 제목 형식 · 픽스처 트리 실재 · 부모 1개 · 이중 오버레이 아님 4중 확인) |

**path-guard 의 픽스처 완화는 6개 조건으로 봉인돼 있고 실증으로 확인했다.** 같은 종류의 완화를
ci-meta 는 봉인하지 않았다 — 이 비대칭이 B-B 다.

### FORBID-5 — timeout 상향 · **유효**

| 주입 | 탐지 |
|---|---|
| `ci-budget.json` boundary 5→9 (+ ci.yml 동조) | ✅ `상한 8분 초과` + REQ-6 `상한 초과` 2중 |
| ci.yml 만 9분 (예산 불일치) | ✅ `예산(5) 와 불일치` |
| base 대비 상향 | selftest `상향 탐지 / 신규추가·하향 무탐` — **이 selftest 는 `ci-meta/index.mjs` 에 wired 되어 CI 에서 매 실행 검증된다** ✓ |
| base 예산 파싱 실패 | `report.fail` (`forbid5-budget.mjs:104`) — 판정 불가 ≠ 통과 ✓ |

이 PR 은 `.github/ci-budget.json` **최초 도입 커밋**이라 상향 판정 대상에서 제외되는데,
이는 계약 detect 가 명시한 제외다(`base 에 파일이 없는 최초 도입 커밋은 검사 대상에서 제외`).

### FORBID-6 — Discovery 검증기 부재·스텁 · **유효**

| 주입 | 탐지 |
|---|---|
| `scripts/discovery/validate_d1a.py` = `sys.exit(0)` | ✅ exit 1 · 프로브 4종 전부 exit=0 로 STUB 판정 |
| 인자·입력에 반응하는 실검증기 | ✅ exit 0 (오탐 없음) — 프로브 `2/3/3/3` |
| 대상 0건 (현재 상태) | ✅ **판정기 자기검사를 매 실행 수행** — 합성 스텁=STUB, 합성 실검증기=OK. 0건 자동 통과를 구조적으로 차단 |
| (b)가 (a)에 종속되는가 | ❌ 독립 실행 확인 (`discovery.mjs:173`, `:213` 별개 `guard`) — 감사 B-2 요구 충족 |

실제 런 #30774775349 에서 discovery 만 red, 귀속 토큰 `FORBID-6` 확인.

---

## 4. 차단 결함 (5건)

### B-A. REQ-2 acceptance 의 "세 플래그 assert 테스트" 가 **존재하지 않는다**

계약 REQ-2 acceptance: *"`tsc --noEmit` exit 0 **+ packages/config/tsconfig.base.json 의 세 플래그 값
assert 테스트 통과**"*.

리포 전체 grep 결과, `noUncheckedIndexedAccess` / `noImplicitOverride` 를 **검사하는 코드는 0건**이다.
등장하는 곳은 값 선언 2곳과 주석·echo 문자열 3곳뿐:

```
packages/config/tsconfig.base.json:6,7   ← 값 선언
packages/config/tsconfig.base.json:3     ← 주석
apps/web/tsconfig.json:3                 ← 주석
.github/workflows/ci.yml:49              ← echo "규칙 REQ-2 — strict/noUncheckedIndexedAccess/…"
```

**실증:**

| 주입 | typecheck | ci-meta | workspace | dep-graph |
|---|---|---|---|---|
| `"strict": true` → `false` | exit 0 | FAIL=0 | FAIL=0 | PASS |
| `noUncheckedIndexedAccess` 줄 삭제 | exit 0 | FAIL=0 | FAIL=0 | PASS |

`ci.yml:49` 의 echo 는 REQ-5 귀속 검증용 규칙 ID 마커일 뿐 판정을 하지 않는다.
**계약이 명문으로 요구한 acceptance 수단이 통째로 빠졌고, 그 결과 REQ-2 의 핵심(세 플래그)은
아무도 지키지 않아도 CI 가 green 이다.**

부수: 각 패키지 tsconfig 가 base 를 **상속하는지**(`extends`)도 검사되지 않는다. `extends` 한 줄을
지우면 그 패키지는 느슨한 기본값으로 컴파일되고 CI 는 green 이다.

### B-B. ci-meta 의 `ci-fixture/**` 면제가 `pull_request` 로 샌다 — REQ-5(2)(3)·REQ-6(c) 우회로

`tools/ci-meta/checks/req5-fixtures.mjs:103-119` 는 **브랜치 이름 접두사만** 본다:

```js
const branchInfo = currentBranch(root);      // GITHUB_HEAD_REF 우선
if (isFixtureBranch(branchInfo.branch)) {    // 'ci-fixture/' 로 시작하면
  report.exempt(RULE,  '(2)(3) …', { allowed: true, … });   // ← CI 에서도 FAIL 로 승격되지 않는 유일한 경로
  report.exempt(RULE6, '(c) 런타임 …', { allowed: true, … });
  return;
}
```

`GITHUB_HEAD_REF` 는 **`pull_request` 이벤트에서만** 설정된다. 즉 이 분기는 PR 컨텍스트를 배제하기는
커녕 **PR 컨텍스트를 우선적으로 읽는다.**

**실증 (CI 컨텍스트 + 유효 토큰):**

```
$ GITHUB_ACTIONS=true GITHUB_EVENT_NAME=pull_request \
  GITHUB_HEAD_REF=ci-fixture/sneaky \
  GITHUB_REPOSITORY=ahangcorp-hyemin/glowmate GH_TOKEN=$(gh auth token) \
  pnpm test:ci-meta
EXIT=0
EXMP [REQ-5] SKIPPED(fixture-branch) (2)(3) 픽스처 8종의 실제 Actions 런 신선도·귀속 검증
EXMP [REQ-6] SKIPPED(fixture-branch) (c) 런타임 — 픽스처 8종 각 런의 `ci-required` conclusion 검증
--- ci-meta: FAIL=0 SKIP=0 EXEMPT=2 PASS=59
```

대조군(정상 브랜치명, 토큰 없음)은 같은 항목이 `FAIL` 로 승격된다:

```
$ GITHUB_ACTIONS=true GITHUB_EVENT_NAME=pull_request GITHUB_HEAD_REF=feat/f1-repo-scaffold pnpm test:ci-meta
FAIL [REQ-5] (2)(3) … — CI 컨텍스트에서 판정 불가는 통과가 아니다
FAIL [REQ-6] (c) 런타임 … — CI 컨텍스트에서 판정 불가는 통과가 아니다
```

**영향:** 하류 PR 이 소스 브랜치 이름을 `ci-fixture/*` 로 짓기만 하면 **B-1(귀속·신선도)과 B-8(실패
전파 집행)의 런타임 검증 전체가 면제**된다. 감사가 NO-GO 로 지목했던 두 항목이 브랜치 이름 한 줄로
꺼진다. `ci-required` 자체는 여전히 동작하므로 머지가 즉시 열리지는 않지만, **픽스처가 낡거나
`ci-required` 가 무력화돼도 그것을 검출할 검사가 사라진다.**

같은 파일이 스스로 경고하고 있다 — `fixture-rules.mjs:93`:
> `⚠ 이 완화가 PR 브랜치로 새면 REQ-5 전체가 무력화된다. 그래서 접두사를 정확히 'ci-fixture/' 로 못박고…`

접두사를 못박는 것으로는 부족하다. **`path-guard` 는 정확히 이 문제를 `base-ref.mjs:152` 에서
`eventName === 'pull_request'` 제외로 이미 해결했다.** ci-meta 에 같은 3줄이 없다.

selftest(`REQ-5 자기검사 통과 — 면제는 'ci-fixture/' 접두사에만 적용(3건 인식 / 9건 무탐)`)는
접두사 매칭 정확성만 검사하고 **이벤트 축을 전혀 보지 않는다.** 통과하는 selftest 가 있다는 것이
탐지 수단의 존재를 뜻하지 않는 전형적 사례다.

### B-C. 검사기 `process.exit(0)` 무력화를 아무도 잡지 않는다 — 백스톱 부재

**실증 — `tools/dep-graph/index.mjs:486` 한 줄:**

```diff
-  process.exit(code);
+  process.exit(0);
```

동시에 `apps/web/package.json` 에 `@vercel/postgres` 추가:

```
$ pnpm test:dep-graph
  VIOLATIONS (1): [REQ-3(a)][FORBID-1(a)] apps/web 에서 Postgres 와이어 드라이버 @vercel/postgres 가 도달 가능하다
dep-graph: FAIL — REQ-3 / FORBID-1 위반이 있다
DEPGRAPH_EXIT=0        ← boundary job green
$ pnpm test:ci-meta  → FAIL=0    (FORBID-2 미탐)
$ pnpm lint          → exit 0
```

**"FAIL 이다" 라고 출력하면서 exit 0 을 내고, 그것을 잡는 검사가 하나도 없다.**
FORBID-2 `because` 가 예고한 상태 그 자체다 — *"green PR 에서 미리 심어둔 `|| true` 는 다음 PR 부터
검사를 영구 무력화한다."*

세 겹이 동시에 비어 있다:

1. **FORBID-2 패턴 사전** — `TRAILING_EXIT_ZERO_RE` 가 `.sh/.bash/.zsh` + 워크플로 `run:` 블록에만
   적용(`forbid2-masking.mjs:257`). 검사기 본체 `.mjs` 는 대상 밖.
2. **dep-graph selftest** — 이 무력화를 잡을 유일한 수단인데 **CI 에서 실행되지 않는다** (B-D).
3. **REQ-5 신선도** — `isFresh()`(`req5-fixtures.mjs:84-94`)는 **`.github/workflows/ci.yml` 의 blob sha 만**
   비교한다. 검사기 소스를 바꿔도 ci.yml 은 그대로이므로 **기존 픽스처 런이 계속 "신선"으로 인정되고,
   그 런에 기록된 옛 red 가 재사용된다.** 계약이 "과거 red 런 재사용 금지"라고 쓴 그 상태다.

같은 한 줄이 `tools/ci-meta/index.mjs` · `tools/path-guard/index.mjs` · `tools/ci-meta/discovery.mjs` ·
`next-routes.mjs` 에도 그대로 적용된다. `/tools/` 는 CODEOWNERS 소유 경로지만(`CODEOWNERS:40`)
`single_maintainer` 상태에서 승인 리뷰는 (c-3) 독립 PR 로 치환되고, (c-3) 대상 파일 목록에 `tools/**` 는
**없다**. 즉 검사기 수정에는 어떤 게이트도 걸려 있지 않다.

### B-D. 탐지력 증명 테스트 2종이 CI 에서 **한 번도 실행되지 않는다** + REQ-3 픽스처 ②③④ 메타테스트 부재

```
$ grep -rn "selftest" .github/workflows/ci.yml package.json
(없음 — ci-meta/index.mjs:22 의 import 만 존재)
```

| 자산 | 규모 | CI 실행 |
|---|---|---|
| `tools/ci-meta/selftest.mjs` | 494줄 | ✅ `index.mjs:22` 에서 import → 매 실행 |
| `tools/dep-graph/selftest.mjs` | 377줄 · 단위 14 + 픽스처 14 | ❌ **어떤 script 에도, ci.yml 에도 없음** |
| `tools/path-guard/test/*.test.mjs` | 39 tests (605줄) | ❌ **동상** |

`pnpm test` = `pnpm -r test` 이고 `pnpm-workspace.yaml` 은 `apps/*` · `packages/*` 만 포함하므로
`tools/` 는 워크스페이스 멤버가 아니다 → `pnpm test` 도 이들을 잡지 못한다.

죽어 있는 탐지력 증명의 내용:
- `05b-spoof-ci-unapproved` / `05c-classes-change-ci-unapproved` — **B-3b 위장 등재·분류 변경 게이트의
  유일한 증명** (현재 PR 은 `dependency-classes.json` 최초 도입이라 승인 게이트가 계약상 면제되므로,
  실물 실행 경로가 없다)
- `06-zero-targets` / `09-empty-allowlist` — 검사 대상 0건·허용목록 공허 = 실패 증명
- `verifySingleMaintainer` 4종 — (c-3) 독립 PR 판정
- `fixture-base.test.mjs` — path-guard 픽스처 완화 6조건 봉인 증명

또한 `.github/ci-fixtures/boundary-{prisma,unclassified,ui-other}/fixture.json` 에 `expected_result`
필드가 있지만 **이 필드를 읽는 코드가 리포에 없다** (grep 결과 README 3줄 + fixture.json 3줄이 전부).
`FIXTURES`(`fixture-rules.mjs:26-68`)는 8종만 열거하므로 REQ-3 픽스처 ②③④ 는 자동 검증 대상이 아니다.

계약 FORBID-1 detect 는 *"픽스처 ①②③ 이 boundary job 만 red 로 만드는지 확인하는 메타테스트(REQ-5)"*
를 명시했다. **① 만 자동화됐다.** ②③④ 는 실제 런에서 기대대로 동작함을 내가 수동 확인했지만
(#30774780080 red · #30774784388 red · #30774782364 success), **회귀를 잡을 수단은 없다.**

### B-E. `pnpm typecheck` 가 스크립트 없는 패키지를 조용히 건너뛴다

**실증:** `packages/api/package.json` 에서 `scripts.typecheck` 삭제 + `src/index.ts` 에 명백한 타입 오류
(`export const broken: number = "문자열";`) 삽입:

```
$ pnpm typecheck   → TYPECHECK_EXIT=0     (Scope: 4 → 3 packages, api 는 조용히 빠짐)
$ pnpm -r build    → BUILD_EXIT=0
$ pnpm test:ci-meta / test:workspace / test:dep-graph → 전부 FAIL=0
```

`pnpm -r <script>` 는 스크립트가 없는 패키지를 **오류 없이 건너뛴다.** 커버리지 하한이 없으므로
"틀린 값 0건"이 "아무것도 검사하지 않음"으로 만족된다.

이 구멍은 커밋 `8efdb11` 이 만들었다. 그 전까지 `packages/{api,db}` 의 `build` 는 `tsc --noEmit` 이라
`typecheck` 스크립트가 없어도 `build` 가 타입을 봤다. 커밋 메시지는 *"검사가 사라지는 것이 아니라
담당 job 이 하나로 모인다"* 라고 적었는데, **이중화가 단일화됐으면 그 단일 경로의 존재를 보장하는
검사가 필요했다.** 그것이 추가되지 않았다. B-A 와 같은 뿌리다.

---

## 4-bis. `f1-ci-meta` 미커밋 방어 2건의 **부재** 판정 — 둘 다 비차단

오케스트레이터가 지목한 2건은 PR #38(`73fa6ec`)에 없다. 그 부재의 등급을 독립적으로 판정했다.

### 결론 요약

| 방어 | 커밋본에서의 발현 | CI 머지 게이트 영향 | 판정 |
|---|---|---|---|
| ① 면제 근거를 워크플로 컨텍스트(env)로 한정 | 로컬 실행이 REQ-5(2)(3)·REQ-6(c) 를 조용히 면제 | **없음 (CI 무영향)** | **비차단** (권고 상위) |
| ② 픽스처 드라이버의 `finally` 복귀 | 중간 실패 시 리포가 `ci-fixture/**` 에 잔류 | **없음 (CI 미실행 도구)** | **비차단** |
| — | | | **둘 다 차단 결함 B-B 를 닫지 못한다 (실측)** |

### ① `fromEnv` 한정의 부재 — 비차단 (로컬 축 한정)

**커밋본에서 실제로 발현한다.** 별도 worktree 를 `ci-fixture/*` 브랜치에 두고 커밋본을 그대로 실행:

```
$ git worktree add --detach /tmp/gm-wt ci-fixture/boundary   # 메인 트리·HEAD 불변
$ git checkout -B ci-fixture/local-leftover ; git checkout 73fa6ec -- tools/ci-meta package.json
$ env -u GITHUB_ACTIONS -u GITHUB_HEAD_REF -u GITHUB_REF_NAME -u GITHUB_REF -u GITHUB_EVENT_NAME \
    node tools/ci-meta/index.mjs
EXIT=0
EXMP [REQ-5] SKIPPED(fixture-branch) (2)(3) 픽스처 8종의 실제 Actions 런 신선도·귀속 검증
EXMP [REQ-6] SKIPPED(fixture-branch) (c) 런타임 — 픽스처 8종 각 런의 `ci-required` conclusion 검증
--- ci-meta: FAIL=0 SKIP=4 EXEMPT=2 PASS=57
```

같은 worktree 에 하드닝본을 얹으면 정확히 이 축이 닫힌다:

```
SKIP [REQ-5] SKIPPED(local) (2)(3) … 미수행
INFO [REQ-5] 워킹트리가 픽스처 브랜치(ci-fixture/local-leftover)에 있으나 워크플로 컨텍스트가 아니므로
             면제하지 않는다 — 드라이버가 중단돼 브랜치가 남아 있을 수 있다
--- ci-meta: FAIL=0 SKIP=6 EXEMPT=0 PASS=57      ← EXEMPT 2 → 0
```

**비차단으로 판정하는 근거:** GitHub Actions 는 **모든 이벤트에서 `GITHUB_REF_NAME` 을 항상 설정**하므로
CI 컨텍스트에서는 `fromEnv` 가 언제나 `true` 다. 즉 **이 방어는 CI 에서 무영향(inert)** 이고, 머지 게이트
(`ci-required` ← `lint` job)의 판정은 커밋본과 하드닝본이 동일하다. 실제 PR 런이 이를 확증한다:

```
$ gh run view 30774762887 --log | grep "판정 컨텍스트"
INFO [REQ-5] (2)(3) 판정 컨텍스트: 브랜치 feat/f1-repo-scaffold (GITHUB_HEAD_REF (PR 소스 브랜치))
             — 픽스처 브랜치가 아니므로 엄격 판정한다
```

**그럼에도 "권고 상위"인 이유:** `done_when` 첫 줄이 *"클린 체크아웃에서 … `pnpm test:ci-meta` … 전부
exit 0"* 을 완료 조건으로 삼는다. 로컬 실행이 신뢰할 수 없으면 그 완료 조건 자체가 위양성이 된다.
그리고 이 상태는 ②와 연쇄해 **실제로 발생했다**(§4-bis ②).

*(부수, 사소)* 하드닝본의 후속 INFO 가 `브랜치 ci-fixture/local-leftover … 픽스처 브랜치가 아니므로 엄격
판정한다` 로 출력된다 — 브랜치는 픽스처 브랜치가 맞는데 메시지가 반대로 읽힌다. 커밋 전 문구 정정 권고.

### ② 드라이버 `finally` 복귀의 부재 — 비차단 (CI 미실행 도구)

커밋본 `tools/ci-meta/fixtures-run.mjs:211-283` 은 `git checkout -B <fixture-branch>` **이후** 5개 지점에서
복귀 없이 `return` 한다 — `git add 실패` · `git commit 실패` · `push 실패` · `checkout 복귀 실패`,
그리고 루프 조기 종료. 어느 경우에도 리포는 `ci-fixture/**` 에 남는다.

**고착 문제가 하나 더 있다.** 커밋본은 `startBranch` 를 **루프 안에서** 읽고(`:222`) 그것이 픽스처
브랜치인지 검사하지 않는다. 따라서 위 실패 후 사용자가 드라이버를 재실행하면 `startBranch` 가
`ci-fixture/*` 로 잡히고, 이후 모든 "원래 브랜치 복귀"가 픽스처 브랜치를 향한다 — **손상이 자기 강화된다.**
하드닝본은 `origin.startsWith('ci-fixture/')` 가드와 루프 밖 `try/finally` 로 이 둘을 함께 닫는다.

**비차단으로 판정하는 근거:** `fixtures-run.mjs` 는 개발자 드라이버이지 검사기가 아니다.
`ci.yml` 어느 job 도 실행하지 않고, 어떤 REQ/FORBID 의 acceptance·detect 도 이 도구를 판정 원천으로
삼지 않는다(계약은 오버레이 방식 자체를 미규정 — f1-gate2 §4-1). 실패 시 손해는 **개발자 환경 파손**이며
머지 게이트에 도달하지 않는다.

**단, ①과 연쇄하면 로컬 위양성 green 이 된다:** ② 로 리포가 픽스처 브랜치에 잔류 → ① 부재로 로컬
`pnpm test:ci-meta` 가 REQ-5·REQ-6(c) 를 면제 → 개발자가 green 을 보고 완료로 판단. 이 연쇄가 실제로
발생했기 때문에 `f1-ci-meta` 가 두 방어를 함께 작성한 것으로 보인다. **판단은 옳다.** 다만 F1 머지
가부를 좌우하지는 않는다.

### 두 방어 모두 차단 결함 B-B 를 닫지 못한다 — 실측

하드닝본(워킹트리 현재 상태)에 §4 B-B 의 위장 PR 조건을 그대로 넣었다:

```
$ GITHUB_ACTIONS=true GITHUB_EVENT_NAME=pull_request GITHUB_HEAD_REF=ci-fixture/sneaky \
  GITHUB_REPOSITORY=ahangcorp-hyemin/glowmate GH_TOKEN=$(gh auth token) pnpm test:ci-meta
EXIT=0
EXMP [REQ-5] SKIPPED(fixture-branch) (2)(3) …
EXMP [REQ-6] SKIPPED(fixture-branch) (c) 런타임 …
--- ci-meta: FAIL=0 SKIP=0 EXEMPT=2 PASS=59        ← 커밋본과 동일. 누수 그대로
```

정당한 픽스처 브랜치 push(`GITHUB_REF_NAME=ci-fixture/boundary`)도 동일하게 `EXEMPT=2` 이므로,
하드닝본은 **두 경우를 구분하지 못한다.**

이유는 명확하다. `fromEnv` 는 *"브랜치명을 환경변수에서 얻었는가"* 를 묻는데, `GITHUB_HEAD_REF`
(= `pull_request` 이벤트)도 환경변수다. 필요한 조건은 `fromEnv` 가 아니라
**`GITHUB_EVENT_NAME !== 'pull_request'`** — `tools/path-guard/lib/base-ref.mjs:152` 가 이미 쓰고 있는 바로
그 조건이다.

**따라서 §10 필수 수정 ①은 f1-ci-meta 의 미커밋 작업으로 대체되지 않는다.** 두 변경은 서로 다른 축을
막으며, 커밋 시 **하나로 합쳐야** 한다:

```js
const isPr   = String(process.env.GITHUB_EVENT_NAME ?? '') === 'pull_request';
const branchInfo = currentBranch(root);
const mayExempt = !isPr && branchInfo.fromEnv && isFixtureBranch(branchInfo.branch);
```

---

## 5. 비차단 결함 (6건)

**5-1. 픽스처 ⑥ 의 귀속이 오탐이다 — python job 의 pytest 탐지력은 미입증.**
계약 REQ-5 픽스처 ⑥ = "pytest 실패". 실제 런 #30774772978 의 실패 스텝은 **`ruff`** 다:

```
python  ruff  E501 Line too long (105 > 100)
              --> tests/test_fixture_failure.py:6:71
              6 |     assert extracted == "글로우메이트 성수점", "추출 결과가 비어 있다 …"
python  ruff  ##[error]Process completed with exit code 1.
```

`ruff` 가 먼저 죽어 **pytest 는 실행조차 되지 않았다.** 귀속 검증이 통과한 이유는 기대 토큰
`assert`(`fixture-rules.mjs:56`)가 ruff 가 인용한 소스 라인에 우연히 들어 있기 때문이다.
→ ⑥ 는 "ruff 가 E501 을 잡는다"를 증명할 뿐 **"pytest 실패가 job 을 red 로 만든다"를 증명하지 않는다.**
부수 문제: `expect` 토큰 `assert`·`secret` 은 지나치게 일반적이라 변별력이 낮다.
(픽스처 파일의 6행을 100자 이하로 줄이면 ruff 를 통과하고 pytest 에서 red 가 된다.)

**5-2. R6C-5(non-zero 종료) 정적 판정에 구멍.**
`RE_NONZERO_EXIT`(`req6-aggregator.mjs:88`)는 run 스크립트 **전체 텍스트**를 grep 한다.
집계 분기의 `process.exit(1)` 만 지우면 앞쪽 `entries.length === 0` 가드의 `process.exit(1)` 이
매칭돼 통과한다 (실증: FAIL=0). 그 상태의 `ci-required` 는 선행 job 이 red 여도 **success** 다.
비차단인 이유: ci.yml 을 바꾸면 신선도 검사가 픽스처 재생성을 강제하고, 재생성된 런에서
REQ-6 (c) 런타임이 `ci-required conclusion=success` 를 잡는다 (단 B-B 로 그 런타임을 면제받으면
이 백스톱도 사라진다).

**5-3. `packages/{api,db}` 의 `test` 가 수집 0건에서 exit 0.**
`node --test --experimental-strip-types` 는 테스트 파일 0건에서 `tests 0 … Done`, exit 0.
FORBID-2 가 `--passWithNoTests` 로 금지한 성질과 동일한데 패턴 사전은 리터럴만 본다.

**5-4. gitleaks allowlist `^\.github/ci-fixtures/` 가 필요 이상으로 넓다.**
제외가 필요한 것은 픽스처 ⑤ 원본 1파일(`secret-scan/overlay/apps/web/src/lib/fixture-credentials.ts`)
뿐인데 트리 전체를 뺐다. `.github/ci-fixtures/**` 는 이미 eslint `ignores`(`eslint.config.mjs:19`)와
FORBID-2 스캔 제외(`forbid2-patterns.mjs:15`)에도 들어 있어, **세 검사가 동시에 눈감는 유일한 경로**가
됐다. 완화: 그 경로는 F1 touches 전용이라 하류 계약이 손댈 수 없다(path-guard).

**5-5. f1-gate2 §4 비차단 4건 현황**

| # | 내용 | 현황 |
|---|---|---|
| §4-1 | 픽스처 → Actions 런 전환 방식 미규정 | **해소(구현 측)** — `fixtures-run.mjs` + `fixture.json` + `ci.yml` push 트리거(`:21`) + discovery 픽스처의 `pr-task = D1a-PROTOCOL`(감사가 제안한 그 해법). 단 **계약 본문에는 여전히 미기재** — 규약의 원천이 구현 코드뿐이다 |
| §4-2 | 인증 필요한 내부 페이지 라우트가 FORBID-3 예외에 없음 | **잔존** — `next-summary.mjs` 에 `(internal)` 예외 없음. 계약 측 사안, W8(Phase 3~4) 시점 발현 |
| §4-3 | "구현 에이전트 계정" 집합의 원천 미정의 | **해소(구현 측·명시적)** — `req7-codeowners.mjs:5-8` 이 미정의임을 적시하고 `PR 작성자 ∪ GLOWMATE_IMPLEMENTER_ACCOUNTS` 로 판정. 집합이 0건이면 skip→CI FAIL(`:192-198`). 조용히 좁히지 않은 점 양호 |
| §4-4 | DS1 의 "패키지 수 기대값 4→5 갱신" 이 F1 REQ-1 과 충돌 | **F1 측은 해소** — 집합 포함 검사 실증(`추가 멤버 … 은 허용`). `DS1.md` 주석은 여전히 정정 필요(하류 소관) |

**5-6. PR 미포함 미커밋 변경 3파일 (`f1-ci-meta` 작업).** → **§4-bis 에서 별도 판정.**
요지: 담고 있는 방어 2건의 부재는 **둘 다 비차단**(CI 무영향 · 드라이버 한정)이나, **차단 결함 B-B 를
닫지 못하므로** §10 필수 수정 ①을 대체하지 않는다. 커밋 시 `GITHUB_EVENT_NAME !== 'pull_request'`
조건과 합칠 것.

---

## 6. 조용한 실패 탐색 (4단계) — 탐색 경로와 결과

**깨끗함을 확인한 경로 (전부 실행으로 확인):**

| 시도 | 결과 |
|---|---|
| `pnpm test:routes` 에 빈 로그 / `Route (app)` 없는 로그 | **FAIL** — `파싱 실패를 통과로 처리하지 않는다` |
| CI 컨텍스트 + 토큰 없음 | **FAIL 6건** — `Report.skip()` 이 `IS_CI` 에서 자동 승격(`util.mjs:92-99`) |
| GitHub API 403(플랜 제약) | selftest `PLAN_LIMITED … 판정은 FAIL 유지` |
| `db-driver-exceptions.json` / `ci-budget.json` / `dependency-classes.json` 파싱 실패 | 전부 `report.fail` (`forbid5-budget.mjs:73,104`, `config.mjs`) |
| lockfile 에 `importers` 섹션 없음 | selftest `통과가 아니라 unusable` |
| dep-graph 검사 대상 0건 · 허용목록 공허 | selftest `06`·`09` → exit 1 |
| discovery 검사 대상 0건 | 판정기 **자기검사**를 매 실행 수행 → 0건 자동 통과 차단 |
| path-guard base ref 부재 | selftest `통과가 아니라 판정 불가` |
| `.github/pr-task` 부재 · 미등재 ID | exit 1 |
| 검사기 예외 throw | `guard()` 가 FAIL 로 승격 (`util.mjs:167-177`) |
| Next 요약의 미분류 마커(PPR 등) | `임의 판정하지 않고 실패시킨다` (`next-summary.mjs:22`) |
| `ci-required.needs` 에서 job 1개 제거 | FAIL 2건 |
| 워크스페이스 멤버 누락 | FAIL |

**발견한 조용한 실패 (전부 §4 에 차단으로 등재):**
- B-C — 검사기 종료 코드 무력화가 어떤 검사에도 걸리지 않는다
- B-E — `pnpm -r <script>` 의 스크립트 부재 무시 = 커버리지 하한 없음
- B-A — REQ-2 의 판정 수단 자체가 없어 "틀린 값 0건"이 공허
- B-D — 탐지력 증명이 CI 에서 실행되지 않아, 검사기 회귀가 조용히 통과
- B-B — 면제 경로가 브랜치 이름만으로 열린다

---

## 7. 자기모순(P7) 7회차 점검 — 각 제외의 대가

> 질문: (i) 이 제외가 없으면 무엇이 깨지는가 (ii) 이 제외 때문에 무엇을 못 잡게 됐는가

| 제외 | (i) 없으면 | (ii) 못 잡게 된 것 | 판정 |
|---|---|---|---|
| eslint `ignores: .github/ci-fixtures/**` | 픽스처 ② 의 의도적 `eslint-disable` 이 본 트리 lint 를 red 로 만들어 **자기 PR 차단**(P7). 8개 픽스처 브랜치 전부에서 lint 가 red 가 되어 "나머지 7 green" 이 깨진다 | 그 트리 안의 실제 lint 위반. **완화:** path-guard 가 그 경로를 F1 touches 로 한정 | 정당 |
| eslint `ignores: services/crawler/**` | 실질 영향 없음(JS 파일 0건). ruff 가 담당 | 없음 (no-op 안전장치) | 정당 |
| eslint `ignores: **/next-env.d.ts` | `next build` 가 매번 재생성하는 파일이 red 를 낸다. 손으로 못 고친다 | 생성 파일 내부. 무의미 | 정당 |
| gitleaks allowlist `.env.example` | 자리표시자가 red | 예시 파일. 무의미 | 정당 |
| gitleaks allowlist `^\.github/ci-fixtures/` | 픽스처 ⑤ 원본 때문에 **전 브랜치 secret-scan red** | 그 트리 전체의 진짜 비밀. **필요 범위보다 넓다 (§5-4)** | 과대 |
| gitleaks allowlist `.next/ node_modules/ dist\|out` | `--no-git` 워킹트리 스캔이 빌드 산출물에서 오탐 | gitignore 된 산출물. 무의미 | 정당 |
| gitleaks 이력 범위 `origin/main..HEAD` | 무관한 픽스처 브랜치 커밋 때문에 본 PR red (실측 기록됨) | main 직접 push 시 이력 스캔 공허 — 워킹트리 스캔(2)이 보완 | 정당 |
| FORBID-2 제외: `ci-required` 의 `if:` | B-8 을 닫는 유일한 관용구가 자기 lint 에 걸린다 | 없음 — **job 이름 1개로 한정됨을 실증**(`boundary` 에 `if: always()` 주입 → FAIL) | 정당 |
| FORBID-2 제외: 패턴 정의 파일 · 산문 확장자 | 패턴 사전이 자기 자신에 걸린다 / 계약 문서 인용이 걸린다 | `.md` 안의 실행 가능 구성. **완화:** 확장자 기준이라 `docs/foo.sh` 는 스캔 대상 | 정당 |
| **ci-meta 의 `ci-fixture/**` EXEMPT** | 픽스처 브랜치에서 자기 자신을 검증하는 순환 + 다른 픽스처 런 부재 | **REQ-5(2)(3) · REQ-6(c) 전체. 그리고 이 완화가 PR 로 샌다** | **부당 — 차단 B-B** |
| path-guard 의 픽스처 base 전환 | 픽스처 ⑦(`pr-task=D1a`)에서 F1 파일 전량이 touches 밖 판정 → path-guard 까지 red | 없음 — `pull_request` 제외 + 6조건 봉인 **실증 확인** | 정당 (모범) |
| `packages/{api,db}` build no-op | 타입 오류 픽스처가 `typecheck` 와 `test` 를 **동시에** red 로 만들어 귀속이 깨진다 | 표면상 없음(typecheck job 이 담당, 실행 확인). **실질: `typecheck` 스크립트의 존재를 아무도 보장하지 않아 이중화가 사라졌다 — 차단 B-E** | 조건부 부당 |

**총평:** 제외 12건 중 9건은 정당하고 사유가 규칙 안에 문서화돼 있다. 2건(gitleaks 범위, build no-op)은
과대하거나 보완이 필요하고, 1건(ci-meta EXEMPT)은 **완화 자체가 우회로가 됐다.**
`ci.yml` 의 green 은 대체로 "검사를 약화시켜 얻은 green" 이 **아니다** — PR 런의 `SKIP=0 EXEMPT=0 PASS=99`
가 그 증거다. 다만 **다음 PR 부터는 약화시켜 green 을 얻을 수 있다**는 것이 이 검수의 결론이다.

---

## 8. 계약 개정 4건의 정당성

| # | 개정 | 근거 | 판정 |
|---|---|---|---|
| 1 | **B-3b′** — FORBID-4 공통 허용에 `dependency-classes.json` 추가 + REQ-3 acceptance (i)(ii)(iii) + 픽스처 ④ | `f1-gate2 §2-1` 이 지시한 두 선택지 중 (a). DS1·DS3 의 합법 경로 부재(데드락) 해소가 목적 | **정당** — 우회 아님. 실증: `other` 신규 등재 exit 0 / 위장 등재 차단 / 픽스처 ④ 실제 런 success |
| 2 | **B-8′** — REQ-6 실패 전파 의무 + acceptance (c) + FORBID-2 제외절 | `f1-gate2 §2-2` 가 지시한 3줄 그대로 | **정당** — 오히려 요구를 **강화**했다. 제외는 job 이름 1개로 한정되고 검사 job 8개의 `if:` 는 대상임을 실증 |
| 3 | **REQ-7 `single_maintainer` 대체 규약** (`93a9021`) | 1인 리포에서 "승인자 ≠ PR 작성자"가 물리적으로 불가능 | **정당** — 아래 근거 |
| 4 | **touches +2** `packages/{api,db}/tsconfig.json` (`0f4c47e`) | REQ-2 의 상속 수단. 없으면 계약대로 구현할 때 자기 path-guard 에 걸린다(P7 6회차) | **정당 — 단 미완** |

### #3 — `single_maintainer` 가 "우회의 포장" 이 아닌 이유

검증 가능한 것만 요구하는지 항목별로 확인했고, 전부 **실증으로 작동을 확인**했다:

- **(c-1) 자동 만료** — 만료일을 과거로 바꾸면 즉시 FAIL. 만료일 줄을 지우면 `만료일 없는 완화는
  영구화된다` FAIL. **완화가 스스로 죽는다.**
- **(c-2) 90일 상한** — `2026-11-30` 으로 늘리면 `119일 뒤다 — 상한 90일 초과` FAIL.
  도입일 원천은 `git log --diff-filter=A` 의 **최초** 추가 커밋(`maintainer.mjs:65-70`, `lines[last]`)이라
  **CODEOWNERS 를 지웠다 다시 만들어도 리셋되지 않는다.** 연장의 유일한 경로는 계약 개정이다.
- **(c-3) 독립 PR** — `checkIndependentPr` 이 대상 파일 외 변경을 거부. `.github/pr-task` 만 예외로
  두는데, 그 예외가 없으면 (c-3) 을 만족하는 PR 이 반드시 path-guard 에서 red 가 된다(자기차단 방지).
- **원 요구의 자동 복귀** — `detectMaintainerMode` 가 push 권한 collaborator ≥ 2 를 감지하면 (c) 를 판정한다.
  조회 불가는 `unknown` → CI FAIL. 실제 PR 런 로그: `push 권한 보유 collaborator 가 1명({ahangcorp-hyemin})`.
- **명시 기록** — 전 완화 라인에 `SINGLE_MAINTAINER` 토큰이 찍힌다. *"조용한 통과와 명시적 유예는 다르다."*

검증 불가능한 것(타인 승인)을 흉내내지 않았고, 대신 만료일을 붙여 **2026-11-01 에 반드시 재협상하게**
만들었다. 이것은 규격이 요구하는 예외 처리 방식이다.

### #4 — 정당하되 **미완**

touches 2줄 추가는 필요·최소했다. `packages/api/tsconfig.json` 없이는 `tsc --noEmit -p tsconfig.json`
자체가 불가능하고, 그러면 REQ-2 는 충족할 방법이 없다. 다른 경로를 슬쩍 끼워 넣지도 않았다.

**그러나 개정으로 열어준 자리를 채우지 않았다.** 계약을 고쳐 REQ-2 의 상속 수단을 확보해 놓고,
정작 REQ-2 acceptance 가 요구한 **세 플래그 assert 테스트**는 구현하지 않았다(B-A). 개정의 목적이
"REQ-2 를 충족 가능하게 만드는 것"이었는데 충족은 되지 않았다.

---

## 9. 하류 영향 (5단계)

`blocks` 15개 계약의 전제를 대조했다.

| 하류 | 전제 | 현황 |
|---|---|---|
| F2a / F5 | `packages/db` 가 REQ-3 제외 집합 → 드라이버 추가가 boundary 를 red 로 만들지 않음 | ✅ 실측 `제외 집합(REQ-3) = packages/api, packages/db` |
| DS1 / DS3 | `dependency-classes.json` 에 `other` 무승인 등재 + 그 파일이 FORBID-4 공통 허용 | ✅ 실증: `@radix-ui/react-dialog` → `other` 등재 시 exit 0 · path-guard 출력에 `공통 허용: packages/config/dependency-classes.json` |
| DS1 | 패키지 신설(`packages/ui`) 시 REQ-1 이 개수 동등 비교를 쓰지 않음 | ✅ `추가 멤버 0건 {} 은 허용` (집합 포함 검사) |
| C2 / C3 | job 이름이 정확히 `path-guard` | ✅ `ci.yml:219-220` |
| F1b | `ci.yml`·`ci-budget.json` 을 자기 touches 로 편집해 `dag-check` job 을 needs 에 편입 | ✅ REQ-6(b)가 `needs ⊇ 정의된 전 검사 job` 을 강제하고, ci.yml 변경 시 신선도 검사가 픽스처 재생성을 강제한다 — 자동 편입 성립 |
| D1a~D4 | discovery job 이 `validate_d*.py` 를 실제로 검사 | ✅ 스텁 → exit 1 실증. (a) 존재 요구는 `origin/main` 의 `.github/pr-task` 이력에서 머지 계약을 산출 |
| W1 / W4 (H3) | 페이지 라우트 기본값이 정적 | ✅ `Static/ISR 2건` · Route Handler 예외 정확 |
| **전 하류 36개** | `on_violation: block_merge` 가 실제로 집행됨 | ⚠ **B-B·B-C 가 열려 있는 한 조건부.** 브랜치 이름(`ci-fixture/*`) 또는 검사기 한 줄(`process.exit(0)`)로 우회 가능 |

**전제를 직접 깨뜨리는 구현은 없다.** 다만 마지막 행이 F1 의 존재 이유 자체(`why:` 절 —
*"집행 주체가 없는 선언에 그친다"*)에 걸린다.

---

## 10. 필수 수정 (FAIL 해소 조건)

우선순위 순. 모두 F1 touches 안에서 처리 가능하다.

1. **`tools/ci-meta/checks/req5-fixtures.mjs:103-119`** — 면제 조건에 `pull_request` 제외를 추가하라.
   `tools/path-guard/lib/base-ref.mjs:152` 와 동일한 형태로:
   ```js
   const isPr = String(process.env.GITHUB_EVENT_NAME ?? '') === 'pull_request';
   if (!isPr && isFixtureBranch(branchInfo.branch)) { … }
   ```
   그리고 `tools/ci-meta/selftest.mjs:352` 의 면제 selftest 에 **이벤트 축 케이스**
   (`pull_request` + `ci-fixture/x` → 면제 안 됨)를 추가하라. 접두사 매칭만 검사하는 현재 selftest 는
   이 회귀를 잡지 못한다.
   *— 없으면 B-1·B-8 의 런타임 검증이 브랜치 이름 한 줄로 꺼진다.*
   *— `f1-ci-meta` 의 미커밋 `fromEnv` 변경은 **이것을 대체하지 않는다**(§4-bis 실측). 두 조건을 합칠 것.*

2. **REQ-2 acceptance 의 assert 테스트를 신설하라** (예: `packages/config` 의 test 스크립트 또는
   `tools/ci-meta` 의 신규 check). 최소 요구:
   - `packages/config/tsconfig.base.json` 의 `strict` · `noUncheckedIndexedAccess` · `noImplicitOverride`
     가 **모두 `true`** 임을 assert (누락도 실패)
   - 워크스페이스의 **전 TS 패키지**가 그 base 를 `extends` 하고 세 플래그를 재선언하지 않음을 assert
   - 전 TS 패키지에 `typecheck` 스크립트가 존재하고 `-p tsconfig.json` 을 대상으로 함을 assert
     (**B-E 를 함께 닫는다**)
   *— 현재 `strict:false` 로 낮춰도 전 검사가 green 이다.*

3. **`tools/ci-meta/forbid2-patterns.mjs` + `checks/forbid2-masking.mjs:257`** — 종료 코드 강제 성공
   패턴을 **스크립트 언어 전반**으로 확장하라. 최소한 `tools/**` 의 `.mjs`/`.js`/`.py` 에서
   `process.exit(0)` · `sys.exit(0)` 이 **조건 없이** 최상위 실행 경로에 나타나면 위반으로 판정할 것.
   *— `process.exit(code)` → `process.exit(0)` 한 줄로 boundary 검사 전체가 죽고, 그것을 아무도 못 잡는다.*

4. **`package.json` + `.github/workflows/ci.yml`** — 탐지력 증명 테스트를 CI 에 연결하라.
   ```
   "test:selftest": "node tools/dep-graph/selftest.mjs && node --test tools/path-guard/test/*.test.mjs"
   ```
   를 `boundary`(또는 `lint`) job 스텝으로 추가. `.github/ci-budget.json` 의 해당 job 값은 **올리지 말 것**
   (FORBID-5). 실측 소요는 dep-graph selftest < 3초, path-guard 39 tests ≈ 14초다.
   *— 지금 871줄 · 67 케이스의 탐지력 증명이 CI 에서 한 번도 실행되지 않는다.*

5. **`tools/ci-meta/fixture-rules.mjs`** — REQ-3 픽스처 ②③④ 를 검증 대상에 편입하라.
   `fixture.json` 의 `expected_result` 를 읽어 `red`/`green` 을 판정하는 경로를 추가하고,
   특히 **④ `boundary-ui-other` 가 green 임**을 assert 하라 (원칙 2.5 — 짝 없는 금지는 제품을 없앤다).
   *— 계약 FORBID-1 detect 가 명시한 메타테스트가 ① 만 구현돼 있다.*

6. **`.github/ci-fixtures/python/overlay/services/crawler/tests/test_fixture_failure.py`** —
   6행을 100자 이하로 줄여 ruff 를 통과시키고 **pytest 에서 red 가 되게** 하라. 동시에
   `fixture-rules.mjs:56` 의 `expect` 에서 지나치게 일반적인 `assert` 를 빼고
   `FAILED tests/test_fixture_failure.py` 처럼 pytest 고유 문자열로 좁혀라.
   *— 현재 ⑥ 는 ruff 를 증명할 뿐 pytest 를 증명하지 않는다.*

### 권고 (비차단 · 다음 PR 가능)

7. `req6-aggregator.mjs:215` R6C-5 를 "non-success 분기 안에 non-zero 종료가 있는가"로 좁힐 것.
8. gitleaks allowlist 를 `^\.github/ci-fixtures/secret-scan/` 로 좁힐 것.
9. `packages/{api,db}` 의 `test` 를 수집 0건에서 실패하도록 하거나, 최소 1개 실질 테스트를 둘 것.
10. 미커밋 3파일(§5-6)은 `fromEnv` 대신 `GITHUB_EVENT_NAME` 조건으로 방향을 바꿔 항목 1에 통합할 것.
11. f1-gate2 §4-1(오버레이 규약)을 계약 본문에 1줄로 못박고, §4-2(`(internal)` 페이지 라우트 예외)를
    W8 착수 전에 처리할 것 — 둘 다 계약 측 사안.

---

## 11. 결론

| 항목 | 판정 |
|---|---|
| 1단계 범위 | 통과 (119/119 touches 내) |
| 2단계 요구사항 | REQ-1·3·4·7·8 충족 / **REQ-2 미충족** / REQ-5·6 부분 |
| 3단계 금지사항 | FORBID-1·3·4·5·6 **유효(실증)** / **FORBID-2 무효** |
| 4단계 조용한 실패 | **5건 발견** (B-A~B-E) |
| 5단계 하류 영향 | 전제 파괴 없음 / block_merge 집행은 B-B·B-C 에 조건부 |
| 계약 개정 4건 | **전부 정당** (우회 포장 아님). #4 는 정당하되 후속 구현 미완 |
| `f1-ci-meta` 미커밋 방어 2건 부재 | **둘 다 비차단** — CI 무영향 · B-B 미해소 (§4-bis) |
| **최종** | **FAIL — 필수 수정 6건** |

이 PR 은 "규칙을 지켰는가"에서는 거의 만점이다. 8개 job 이 실제 위반을 실제로 잡고, 픽스처 11종이
실제 Actions 런에서 기대대로 동작하며, `ci-required` 가 실패를 실제로 전파한다는 것을 API 응답으로
확인했다. 감사 B-1~B-10 과 NO-GO 2건은 **구현 수준에서 모두 닫혔다.**

FAIL 인 이유는 다른 층위다. **F1 은 자기 자신이 앞으로도 지켜지게 만드는 태스크인데, 검사기를 지키는
검사가 비어 있다.** 브랜치 이름 하나(`ci-fixture/*`)와 한 줄(`process.exit(0)`)로 이 CI 의 핵심 두
계층이 꺼지고, 그것을 잡을 871줄의 탐지력 증명은 CI 에서 실행되지 않는다. 그리고 REQ-2 는 acceptance 가
지정한 판정 수단 없이 "green 이니까 됐다"로 통과했다.

필수 수정 6건은 전부 F1 touches 안에서, 코드 100줄 안팎으로 닫힌다. 구조 재설계는 필요 없다.
수정 후에는 §10 의 6개 항목과 그 회귀 테스트만 재확인하면 되고 전면 재검수는 불필요하다.
