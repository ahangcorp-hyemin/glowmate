# tools/ci-meta — CI 메타 검사기 (F1-REPO-SCAFFOLD)

`.github/workflows/ci.yml` · `.github/ci-budget.json` · `.github/CODEOWNERS` · `.github/ci-fixtures/**` 가
**계약대로 구성되어 있고 실제로 집행되는지**를 판정한다. 구성 파일 자체는 이 디렉터리의 소유가 아니며 읽기만 한다.

## 진입점

| 명령 | 파일 | 담당 규칙 |
|---|---|---|
| `pnpm test:workspace` | `workspace-members.mjs` | REQ-1 |
| `pnpm test:ci-meta` | `index.mjs` | REQ-5 · REQ-6 · REQ-7 · FORBID-2 · FORBID-5 + 판정기 자기검사 |
| `pnpm test:discovery` | `discovery.mjs` | FORBID-6 (a) 존재 요구 / (b) 비스텁 요구 |
| `pnpm test:routes` | `next-routes.mjs` | REQ-8 · FORBID-3 (`next build` 요약 파싱 + 페이지 라우트 토큰 grep) |

## 판정 원칙

1. **판정 불가 ≠ 통과.** CI 컨텍스트(`GITHUB_ACTIONS=true`)에서 GitHub API·base 커밋·pnpm·python 을
   확보하지 못하면 그 검사는 **FAIL** 이다. 로컬에서는 `SKIPPED(local)` 로 **명시 출력**한다(조용한 통과 없음).
2. **검사 대상 0건을 통과로 처리하지 않는다.** 대상이 0건일 수밖에 없는 시점(F1 머지 시점의 FORBID-6)에도
   판정기 자신을 합성 위반 입력으로 검사해(`selftest.mjs`, `discovery.mjs` 의 self-test) 탐지력을 매 실행 입증한다.
3. **실패 출력에는 규칙 ID 토큰(`REQ-5` · `REQ-6` · `FORBID-2` …)이 반드시 포함된다.**
   REQ-5 의 귀속 검증이 픽스처 런 로그에서 이 문자열을 찾는다.
4. 종료 코드를 마스킹하지 않는다. FAIL 1건이면 exit 1.

## REQ-6 (c) 집행 검증 — B-8 을 닫는 판정 로직

`needs:` 만 선언한 애그리게이터는 선행 job 실패 시 실행되지 않고 `skipped` 로 끝나며,
브랜치 보호는 **skipped 필수 체크를 통과로 취급**한다. 등록(a)(b)만 검사하면 전 job red 에서 머지가 열린다.
그래서 `ci-required` 의 **형태**를 정적으로 판정한다.

| 판정 | 요구 | 위반 예 |
|---|---|---|
| R6C-1 실행 보장 | `if:` 가 **`always()`** 를 포함 | `if:` 없음(needs-only) · `if: success()`/`failure()` · **`if: !cancelled()`** |
| R6C-2 평가 존재 | `run`/step `if`/`with`/`env` 가 `needs.*.result` 를 명시 평가 | 평가 스텝 없음 |
| R6C-3 평가 범위 | `needs` 의 **전** job 이 평가에 포함 (개별 `needs.<job>.result` 또는 집계형 `needs.*.result`/`toJSON(needs)`) | 8개 중 2개만 평가 |
| R6C-4 비교 기준 | 평가가 `success` 와 비교 — non-success **전체**를 잡아야 한다 | `contains(needs.*.result,'failure')` 만 (skipped·cancelled 누출) |
| R6C-5 비영 종료 | `exit <nonzero>` / `exit(<nonzero>)` / `exit $rc` 존재, 그리고 job·step 에 `continue-on-error` 없음 | 평가만 하고 실패시키지 않음 |

**`!cancelled()` 를 무효로 판정하는 이유:** 계약 REQ-6 은 non-success 를 `failure · cancelled · skipped`
세 축으로 정의한다. `!cancelled()` 는 워크플로 취소 시 `ci-required` 자신이 `skipped` 로 끝나고
브랜치 보호가 이를 통과로 취급하므로 **cancelled 축을 커버하지 못한다**. `always()` 만이 세 축을 모두 덮는다.

여기에 더해 **런타임 증거**를 API 로 확인한다 — REQ-5 픽스처 8종 각 런의 `ci-required` conclusion 이
`success` 도 `skipped` 도 아니어야 한다. 1건이라도 통과 처리되면 exit 1.

## 픽스처 런 조회 규약 (`.github/ci-fixtures/**` 담당자용 인터페이스)

계약은 픽스처 트리를 실제 Actions 런으로 만드는 **오버레이 방식을 규정하지 않는다**(감사 f1-gate2 §4-1).
이 검사기는 다음 순서로 런을 특정한다.

1. `.github/ci-fixtures/<job>/fixture.json` 의 `run_id` — 가장 명시적. 권장.
2. 위 파일의 `branch`
3. 관례 브랜치 `ci-fixture/<job>`

```jsonc
// .github/ci-fixtures/<name>/fixture.json   ← 오버레이 대상이 아니다 (드라이버 메타데이터)
{
  "job": "boundary",
  "expect": ["REQ-3", "FORBID-1"],// 선택. 생략 시 fixture-rules.mjs 의 기본 기대 토큰 사용
  "branch": "ci-fixture/boundary",
  "overlay": "overlay/",          // 이 디렉터리 이하가 리포 루트에 덮어쓰기된다
  "run_id": 1234567890            // 선택. 있으면 이 런을 직접 조회한다
}
```

**`.github/pr-task` 교체가 필요한 픽스처는 그 파일을 오버레이 트리 안에 둔다** —
예: `.github/ci-fixtures/discovery/overlay/.github/pr-task` = `D1a-PROTOCOL`.
픽스처 ⑦ 은 `scripts/discovery/validate_d*.py` 를 만드는데 그 경로는 F1 touches 밖이므로,
pr-task 를 바꾸지 않으면 같은 런에서 **path-guard 도 red** 가 되어 "대응 job 만 red · 나머지 7 green" 이 깨진다.

**신선도**: 런의 `head_sha` 시점 `.github/workflows/ci.yml` 의 blob sha 가 현재 PR 의 blob sha 와
같아야만 유효한 런으로 인정한다(과거 red 런 재사용 금지). 어느 경로로도 신선한 런을 찾지 못하면 CI 에서 exit 1.

**귀속**은 두 층으로 판정한다.

1. **실패 스텝** (API, 정확) — red 가 난 스텝이 셋업/설치 스텝이면 실패. 그건 규칙 탐지가 아니라
   결합 실패(lockfile 불일치 등)이며 계약 REQ-5 말미가 명시적으로 배제한 상태다.
2. **실패 지점 로그** — `ci.yml` 은 각 job 첫 스텝에서 규칙 ID 를 echo 하므로 **로그 전체를 대상으로
   `includes()` 하면 green 런에서도 항상 참**이 되어 귀속 검증이 공허해진다. 그래서 마지막 `##[error]`
   마커 주변 구간만 판정 대상으로 삼는다. 토큰이 로그에는 있으나 실패 지점에 없으면 그 사실을 적어 실패시킨다.

### 픽스처 브랜치 면제 (`SKIPPED(fixture-branch)`)

REQ-5 (2)(3) 과 REQ-6 (c) 런타임은 **PR 의 메타 검증**이지 픽스처 자신의 검증이 아니다.
픽스처 브랜치에서 다시 픽스처 런을 조회하면 자기 자신을 검증하는 순환이 되고, 그 시점에
다른 픽스처 런은 존재하지도 않는다. 그래서 현재 브랜치가 `ci-fixture/**` 일 때만 면제한다.

- 면제는 `EXEMPT` 라는 **별도 레벨**이다. `SKIP`(판정 근거 부재 → CI 에서 FAIL)과 성질이 다르므로
  섞지 않는다. `Report.exempt()` 는 면제 조건(`allowed`)이 거짓이면 **FAIL 로 되돌린다**.
- 접두사는 정확히 `ci-fixture/` 다. `feat/ci-fixture-like` · `ci-fixtures/lint` 같은 위장은 면제되지 않으며,
  selftest 가 인식 3건 / 무탐 9건을 매 실행 검증한다. **PR 브랜치에서는 면제 없이 엄격 판정한다.**

### `PLAN_LIMITED` — 브랜치 보호 API 403

private + free 플랜 리포에서는 브랜치 보호 API 가 403 + "Upgrade to GitHub Pro" 를 반환한다.
이는 "일시적 조회 실패"가 아니라 **설정 자체가 불가능**한 상태다. 둘을 구분해 출력하되
**판정은 FAIL 그대로 유지한다** — 계약 요구(REQ-6 (a) · REQ-7 (b))를 충족할 수 없는 상태이기 때문이다.
통과로 바꾸는 것은 계약 개정 또는 플랜 변경 사안이지 검사기가 결정할 일이 아니다.

## 픽스처 실행 드라이버 — `fixtures-run.mjs`

```bash
node tools/ci-meta/fixtures-run.mjs                    # dry-run(기본): 오버레이 계획과 실행될 git 명령만 출력
node tools/ci-meta/fixtures-run.mjs --job discovery    # 픽스처 1종만
node tools/ci-meta/fixtures-run.mjs --push             # 실제로 브랜치 생성 + force-with-lease push
node tools/ci-meta/fixtures-run.mjs --push --collect   # push 후 런 URL·신선도 수집, fixture.json 에 넣을 run_id 출력
```

- `fixture.json` 의 `overlay` 이하가 리포 루트에 **덮어쓰기**된다. 브랜치는 `branch` 필드(기본 `ci-fixture/<name>`),
  base 는 현재 PR 의 HEAD.
- REQ-5 필수 8종 + `.github/ci-fixtures/` 에서 발견된 **추가 픽스처**(REQ-3 의 `boundary-prisma` 등)를 모두 구동한다.
- `--push` 는 워킹트리가 깨끗할 때만 진행하고, 끝나면 원래 브랜치로 복귀한다.
- 필수 트리가 하나라도 없거나 오버레이할 파일이 0건이면 **exit 1** (검사 대상 0건 통과 금지).
- `--collect` 는 각 브랜치 최신 런의 신선도를 확인하고 `fixture.json` 에 넣을 `run_id` 를 출력한다.

## FORBID-2 스캔 범위

대상: base 커밋 대비 **추가된 라인** + 현재 워크플로 상태의 `continue-on-error`.

계약 명시 제외 2종을 그대로 구현한다.

- ① `.github/ci-fixtures/**` 와 **패턴 정의 파일 자신**(`forbid2-patterns.mjs`)
- ② job 이름이 **정확히 `ci-required`** 인 단 하나의 job 의 `if:` 조건 (라인 범위로 한정).
  검사 job 8개의 `if:`·`continue-on-error` 는 그대로 대상이다.

추가로, 비실행 산문 파일(`.md` `.txt` 등)은 스캔하지 않는다 — FORBID-2 의 `when` 은
"CI 스텝의 종료 코드를 마스킹하거나 검사 대상을 축소하는 **구성**"이며, 계약 문서가 금지 관용구를
**인용**하는 것은 어떤 검사도 무력화하지 않는다. 확장자 기준이므로 `docs/foo.sh` 는 그대로 대상이다.
(이 규칙이 없으면 F1 자기 PR 이 자신의 계약 문서 때문에 차단된다 — 규격 §3.4 안티패턴.)

## FORBID-6 스텁 판정 프로브

존재하는 전 `scripts/discovery/validate_d*.py` 에 결손 입력을 주입한다.
**모든** 프로브가 exit 0 이면 스텁으로 판정한다.

| 프로브 | 인자 | cwd |
|---|---|---|
| `no-args` | (없음) | 리포 루트 |
| `unknown-check` | `--check __glowmate_nonexistent_check__` | 리포 루트 |
| `all-in-empty-tree` | `--all` | 빈 임시 디렉터리 |
| `missing-input-file` | `--check verdict --input __glowmate_missing_input__.json` | 빈 임시 디렉터리 |

Discovery 계약 저자에게: 인자 검증(미지의 `--check` 는 non-zero)이 있으면 이 판정을 자동으로 통과한다.

(a) 존재 요구의 판정 원천은 **base 브랜치의 `.github/pr-task` 이력**이다 —
각 PR 이 자신의 계약 ID 를 그 파일에 1줄로 기재하므로, 그 파일을 건드린 전 커밋의 값 집합이
"머지된 계약 ID 집합"이다. F1b 의 `docs/tasks.json` 에 의존하지 않는 자립 경로다.

## REQ-8 · FORBID-3 — `next-routes.mjs`

```bash
pnpm --filter @glowmate/web exec next build | tee /tmp/next-build.log
node tools/ci-meta/next-routes.mjs /tmp/next-build.log     # 또는 파이프로 stdin
```

| 수단 | 판정 |
|---|---|
| 1차 (`next build` 요약) | 페이지 라우트만 필터 → 동적(`ƒ`·`λ`) **0건** + Static/ISR(`○`·`●`) **≥ 2** |
| 2차 (토큰 grep) | `apps/web/src/app/**` 의 `page.tsx`·`layout.tsx` 한정 5토큰 0건 |

둘 중 하나라도 실패하면 exit 1. 실패 출력에 `REQ-8`·`FORBID-3` 토큰이 들어가므로 픽스처 ③의 귀속이 성립한다.

- **Route Handler `/api/**` 는 제외** — 계약이 "정의상 동적이므로 대상이 아니다"라고 명시했다.
  `/api/health` 가 `ƒ` 로 찍히는 것을 위반으로 잡으면 F1 자기 PR 이 red 가 된다.
- Next 내부 생성 라우트(`/_not-found` 등)는 **≥2 카운트에서만 제외**하고 동적 여부 검사에는 포함한다
  (루트 레이아웃이 동적이 되면 전 라우트가 `ƒ` 가 되는데, 그건 반드시 잡아야 한다).
- 범례 줄(`○  (Static) …`)·`ƒ Middleware`·prerender 하위 경로는 라우트로 세지 않는다
  (경로가 `/` 로 시작하는 항목만 라우트로 인정).
- **로그를 못 읽거나 요약 섹션(`Route (app)`)을 못 찾으면 exit 1.** 라우트 0건도 exit 1.
  PPR(`◐`) 등 계약에 분류 규정이 없는 마커가 나오면 임의 판정하지 않고 exit 1 한다.

## "구현 에이전트 계정" 집합 (REQ-7 (c))

계약에 원천이 미정의다(감사 f1-gate2 §4-3). 새 정본 파일을 만들지 않고
**PR 작성자 ∪ 환경변수 `GLOWMATE_IMPLEMENTER_ACCOUNTS`(콤마 구분)** 의 합집합으로 판정한다.
두 원천이 모두 비어 교집합 검사가 공허해지면 그 사실을 CI 에서 FAIL 로 드러낸다.

## `single_maintainer` 대체 규약 (REQ-7 개정본 · FORBID-5)

push 권한 보유 collaborator 가 **1명이면** 타인 승인이 물리적으로 불가능하다. 이때 (c) 대신
아래 3건을 **전부** assert 하고, 상태를 `SINGLE_MAINTAINER` 토큰으로 CI 로그에 명시 기록한다.

| 항목 | 요구 | 판정 원천 |
|---|---|---|
| (c-1) | `.github/CODEOWNERS` 헤더에 `single-maintainer-until: <YYYY-MM-DD>` 가 있고 **오늘 ≤ 그 날짜** | 헤더 파싱. 초과 시 exit 1 — **완화가 스스로 만료한다** |
| (c-2) | 그 날짜가 CODEOWNERS 최초 도입일로부터 **90일 이내** | `git log --diff-filter=A --date=format:%Y-%m-%d -- .github/CODEOWNERS`. 도입 PR 에서는 현재 커밋 날짜 |
| (c-3) | 승인 대체 대상 파일의 변경은 **그 파일 하나만 포함하는 독립 PR** | `git diff --name-only <merge-base>` |

- collaborator 수를 확정하지 못하면(로컬 등) **원 요구 (c) 와 대체 규약을 둘 다 돌려** 정보량을 남기고,
  체제 미확정 사실을 `SKIPPED(local)` 로 명시한다. CI 에서 확정 불가면 FAIL 이다.
- 날짜는 **작성자 로컬 캘린더**로 비교한다. `%aI` 를 UTC 캘린더로 바꾸면 KST 새벽 커밋이 전날로 밀려
  90일 판정이 1일 어긋난다(실제로 91일 오판이 났다). "오늘"은 실행 환경 로컬 캘린더 —
  만료 판정이 관대한 쪽으로 틀리지 않게 한다.
- (c-3) 대상: `packages/config/db-driver-exceptions.json` · `.github/ci-budget.json`(기존 항목 상향).
  `packages/config/dependency-classes.json` 은 계약이 "**승인 대상 diff 인 경우**"로 한정하며 그 판정은
  REQ-3 / `tools/dep-graph` 소관이다. 여기서 무조건 독립 PR 을 요구하면 감사 B-3b′ 의 DS1·DS3
  데드락이 되살아나므로, **소관 표기와 함께 명시 출력만** 하고 판정은 넘긴다.
- **최초 도입(base 에 파일 없음)은 (c-3) 대상 제외** — 아니면 F1 자기 PR 이 차단된다(규격 §3.4).
- `.github/pr-task` 는 "다른 변경"으로 세지 않는다 — FORBID-4 의 전 계약 공통 허용 경로이며,
  그것을 갱신 못 하면 (c-3) 을 만족하는 PR 이 path-guard 에서 반드시 red 가 되어 합법 경로가 0개가 된다.
