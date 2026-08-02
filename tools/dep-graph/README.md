# tools/dep-graph — 워크스페이스 경계 검사기

> 계약: [F1-REPO-SCAFFOLD](../../docs/tasks/F1.md) **REQ-3** · **FORBID-1**
> 진입점: `pnpm test:dep-graph` → `node tools/dep-graph/index.mjs`
> 자기 검증: `node tools/dep-graph/selftest.mjs`

**제외 집합은 `packages/api` · `packages/db` 두 패키지다.** 그 밖의 모든 워크스페이스 패키지
(`apps/web` · 이후 신설분)가 검사 대상이다.

---

## 1. 검사 항목과 계약 절 대응

| 검사 (출력의 체크 ID) | 계약 절 | 판정 |
|---|---|---|
| `targets` | REQ-3 | 검사 대상 패키지가 **0건이면 exit 1** (공허한 초록 금지) |
| `config` | REQ-3 (b)(iii) · FORBID-1 (c) | 정본 3파일 로딩. `classes`/`names` 가 비면 검사가 공허하므로 exit 1 |
| `REQ-3(b) classification` | REQ-3 (b) · FORBID-1 (b) | 전 대상 패키지의 `dependencies`+`devDependencies` 가 `dependency-classes.json` 에 분류돼 있어야 한다. **미분류 1건 → exit 1.** `data-access` 분류 의존 보유 → exit 1 |
| `REQ-3(iii) spoof` | REQ-3 (iii) | `data-access-names.json` 매칭 이름이 `other` 로 등재된 항목을 열거 → 승인 게이트 대상 |
| `REQ-3(a) reachability` | REQ-3 (a) · FORBID-1 (a) | 의존 그래프에서 `packages/db` · Postgres 와이어 드라이버 · 데이터 접근 패키지 도달성 판정 |
| `wire-driver 목록 정합` | REQ-3 (a)(iii) | 검사기의 경성 금지 목록이 정본 `data-access-names.json` 의 부분집합인지 확인 (두 목록이 갈라지면 미탐이 생긴다) |
| `REQ-3(a) depcruise(보조)` | REQ-3 (a) | `.dependency-cruiser.cjs` 로 **소스 import 수준** 보강. 1차 판정은 자체 그래프가 한다 |
| `approval gate` | REQ-3 (ii)(iii) · FORBID-1 (c) | 승인 필요한 diff 에 대해 `packages/config` CODEOWNERS 승인(승인자 ≠ PR 작성자) 확인 |
| `root-direct-deps` | REQ-3 (a) | 워크스페이스 루트가 데이터 접근 패키지를 **직접** 의존하는지 (아래 §5 판단 참조) |

실패 메시지에는 **반드시 `REQ-3` / `FORBID-1` 토큰이 포함**된다 — F1 REQ-5 의 귀속 검증이 이 문자열로
job 실패를 규칙에 귀속시킨다 (`lib/report.mjs` 의 `Report.violation()` 이 토큰 누락을 예외로 잡는다).

---

## 2. 두 층으로 나뉜 금지 — 왜 (a) 가 전부를 막지 않는가

| 층 | 대상 | 여는 문 |
|---|---|---|
| **경성 (a)** | `packages/db` · Postgres 와이어 드라이버(`pg` · `postgres` · `@vercel/postgres` · `@neondatabase/*` · `pg-native` · `pg-promise` · `slonik`) | `db-driver-exceptions.json` 등재 (사유 · 만료일 ≤ 90일 · 승인자 + CODEOWNERS 승인) |
| **연성 (b)+(iii)** | Prisma · Supabase · Drizzle 등 데이터 접근 클라이언트 (`data-access-names.json` 전체) | `dependency-classes.json` 에 `other` 등재 + **CODEOWNERS 승인** (위장 등재 게이트) |

연성 대상까지 (a) 로 경성 금지하면 **승인 게이트가 열어줄 수 있는 문이 0개**가 되어 원칙 2.5(합법 경로 보장)를
깬다. 반대로 전부 연성으로 두면 `other` 한 줄로 와이어 드라이버가 통과한다. 그래서 두 층으로 나눈다.

연성 대상이라도 **`other` 로 등재돼 있지 않은 채 전이 도달**하면 (a) 위반이다 —
(b) 는 직접 의존만 보므로, 등재 없이 전이로 들어오는 경로는 (a) 만이 잡을 수 있다.

---

## 3. 하류 계약의 합법 경로 (DS1 · DS3 …)

의존을 추가하는 계약은 **자기 PR 안에서** `packages/config/dependency-classes.json` 에 분류를 등재한다
(FORBID-4 의 전 계약 공통 허용 경로).

```
승인 불필요 : 새 이름을 `other` 로 추가 (단 data-access-names.json 에 매칭되지 않는 이름)
승인 필요   : `data-access` 로 추가 / 기존 항목 분류 변경(방향 무관) / 등재 삭제
              / data-access-names.json 매칭 이름을 `other` 로 등재(위장)
              / db-driver-exceptions.json 항목 추가·변경
```

### 승인의 두 가지 형태 — REQ-7 acceptance (c)

CI 는 GitHub API 로 **push 권한 보유 collaborator 수**를 먼저 조회해 적용 규약을 가른다.
조회 실패는 **판정 불가 = exit 1** 이다(실패를 "1명"으로 간주하면 누구나 완화 규약으로 내려온다).

| collaborator 수 | 적용 규약 |
|---|---|
| **2 이상** | `packages/config` CODEOWNERS 승인 리뷰, **승인자 ≠ PR 작성자** |
| **1 (`single_maintainer`)** | 타인 승인이 물리적으로 불가능하므로 **REQ-7 (c-3) 독립 PR 요구**로 치환. 승인 대상 diff 를 가진 파일은 **그 파일 하나만 포함하는 독립 PR** 이어야 한다. 로그에 `SINGLE_MAINTAINER` 토큰을 명시 출력한다 |

`single_maintainer` 는 **완화가 아니라 치환**이다 — 검증 불가능한 것(타인 승인)을 검증 가능한 것(독립 PR)으로
바꿀 뿐, **3필드 검사(FORBID-1 c)와 위장 검사(iii)는 상태와 무관하게 그대로 적용**된다.

- **최초 도입 diff 는 (c-3) 대상이 아니다.** base(`origin/main`)에 파일이 없으면 그 파일을 처음 만드는
  PR(=F1 자신)이 차단되므로 제외한다.
- (c-1) `single-maintainer-until` 만료일 검사와 (c-2) 90일 검사는 **REQ-7 소관(`tools/ci-meta`)** 이며
  여기서 중복 구현하지 않는다. 이 검사기는 collaborator 수 판정과 (c-3) 독립 PR 판정만 한다.

---

## 4. `db-driver-exceptions.json` 항목 스키마

```jsonc
[
  {
    "package":     "apps/web",          // 워크스페이스 패키지 경로 또는 package.json name
    "dependency":  "pg",                // 예외로 허용할 의존/노드 이름
    "reason":      "…10자 이상의 사유",  // FORBID-1 (c) 필수 3필드 ①
    "expires_at":  "2026-09-15",        // ② YYYY-MM-DD · 과거 불가 · 오늘+90일 초과 불가
    "approved_by": "@platform-owner"    // ③
  }
]
```

세 필드 중 하나라도 없거나, 만료됐거나, 90일을 초과하면 **exit 1**이다.
파일의 diff 자체도 CODEOWNERS 승인 없이는 실패한다(초기값 `[]` 의 최초 도입은 항목이 0건이므로 대상이 아니다).

---

## 5. 실행 컨텍스트별 동작

| | 로컬 (`GITHUB_ACTIONS` 미설정) | CI |
|---|---|---|
| 파일 기반 검사 (a)(b)(iii)·예외 3필드 | 수행 | 수행 |
| `pnpm-lock.yaml` 부재/파싱 불가 | `SKIPPED` 로 **명시 출력** 후 package.json + 워크스페이스 링크 그래프로 대체 | **exit 1** (전이 의존 미판정 = 미탐) |
| dependency-cruiser 미설치 | `SKIPPED(local)` 명시 | **exit 1** |
| 승인 검사 | `SKIPPED(local)` 로 명시 출력 + 승인 대상 후보 열거 | 수행. **판정 불가(토큰·collaborator 수·PR 번호·CODEOWNERS·base ref 부재)면 exit 1** |

> CI 에서 판정 불가를 통과로 처리하면 게이트가 사라진다. 그래서 전부 fail-closed 다.
> **boundary job 은 `pnpm install --frozen-lockfile` 이후에 이 검사기를 실행해야 한다.**

**워크스페이스 루트(`./package.json`)는 pnpm-workspace 멤버가 아니므로 (b) 분류 대상이 아니다.**
다만 루트가 데이터 접근 패키지를 *직접* 의존하는 경우는 명백한 경계 이탈이므로 별도로 검사한다
(전이 의존은 대상이 아니다 — 툴체인 전이까지 막으면 합법 경로가 사라진다).
**워크스페이스 내부 패키지 간 링크(`@glowmate/*`)는 외부 의존이 아니므로 분류 대상이 아니다** —
반면 도달성 그래프의 간선으로는 그대로 사용한다.

---

## 6. 자기 검증 (`selftest.mjs`)

검사기가 **실제로 탐지하는지**를 임시 워크스페이스 픽스처로 확인한다. 계약 REQ-3 acceptance 의 픽스처
①②③④ 를 포함한다.

```
① 01-driver-reachable / 01b-driver-direct   → exit 1   (a)
② 02-prisma-data-access                      → exit 1   (b)
③ 03-unclassified-dep                        → exit 1   (b)
④ 04-ui-dep-as-other-LEGAL                   → exit 0   원칙 2.5 — 여기가 red 면 DS1·DS3 에 합법 경로가 없다
   08-exception-valid-LEGAL                  → exit 0   예외 경로의 합법 동작
   05-spoof-local / 05b / 05c / 05d          → 위장·분류변경 승인 게이트
   unit: verifySingleMaintainer 4건          → REQ-7 (c-3) 독립 PR · 최초 도입 제외 · 파일 2개 분리 요구
   06-zero-targets                           → exit 1   공허한 초록 금지
   07 / 07b                                  → exit 1   FORBID-1 (c) 3필드·만료일
   09-empty-allowlist                        → exit 1   허용목록 공허화 금지
```

픽스처는 리포 트리에 파일로 남기지 않고 `__fixtures__/fixtures.mjs` 의 정의를 임시 디렉터리에
물질화한다 — 가짜 `package.json` 을 리포에 남기면 다른 검사기(워크스페이스 탐색 · lint · depcruise)의
대상이 되어 서로를 오염시킨다.
