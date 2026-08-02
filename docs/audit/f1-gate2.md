# NO-GO: B-3b, B-8

> F1 개발 착수 최종 관문 (4차) · 감사일 2026-08-03 · 감사관 task-auditor
> 대상: `docs/tasks/F1.md` · `docs/tasks/F1b.md`
> 기준: `docs/audit/f1-gate.md` §4 BLOCKING B-1~B-10 의 해소 여부만 이진 판정
> 대조 실사: `F2a.md`(:35) · `F5.md`(:34,49-51) · `W6.md`(:41-51) · `W8.md`(:44-50) · `W9.md`(:45) · `DS1.md` · `DS3.md` · `D1a.md`(:85) · `C2.md`(:172) · `C3.md`(:222) · `03-task-dag.md`(:50) · `scripts/tasks_manifest.py`(:19-28,:69-) · `scripts/github_sync.py`(:20,73) · `python3 scripts/tasks_manifest.py --check` 실행

**해소 8 · 부분 2 · 미해소 0.** 남은 2건은 전부 **F1 계약 본문 3~4줄 수정**으로 닫힌다. 구조 재설계는 필요 없다.

---

## 1. B-1 ~ B-10 이진 판정

### B-1: **해소**
- 근거: `F1.md:102-116` REQ-5 전면 교체. (i) **분리** — `.github/ci-fixtures/<job>/` "위반 1종만 포함하는 독립 픽스처 트리 8개", (ii) **귀속** — "대응 job 만 red 이고 나머지 7개는 green" + "실패 사유가 해당 검사 규칙 ID 또는 계약이 지정한 에러 문자열과 일치"(:106-107, acceptance (3) `:112`), (iii) **신선도** — "현재 PR 의 워크플로 정의로 재실행한 런만 유효로 인정(워크플로 파일 sha 일치 … 과거 red 런 재사용 금지)"(`:110-111`), (iv) **결합 red 경로 차단** — "각 트리는 lockfile 정합을 유지해야 한다 — install 실패로 전 job 이 red 가 되면 귀속 검증이 실패한다"(`:116`) + `done_when:267` 에 재기재.
- 3차 공격 A-1 재시도: 단일 브랜치에 8종을 주입해 install 단계 일괄 red 를 만드는 경로 → `:116` 과 `done_when:267` 이 **명시적으로 그 상태를 실패로 규정**하고, 그 경우에도 "나머지 7 green" assert 가 즉시 깨진다. 검사 로직 0줄 구현은 이제 8개 트리 전부에서 실패한다. **방어됨.**
- 잔여(비차단): 픽스처 트리를 실제 Actions 런으로 만드는 **오버레이 방식**이 미규정(`rollback:261` 의 "픽스처 실행용 브랜치"가 유일한 단서). §4-1 참조.

### B-2: **해소**
- 근거: `F1.md:230-243` FORBID-6 when 이 **(a) 존재 요구 = origin/main 머지분 한정 / (b) 비스텁 요구 = "머지 여부와 무관하게 리포지토리에 존재하는" 전 `validate_d*.py`** 두 갈래로 분리. detect(`:243`)가 "REQ-5 픽스처 ⑦(스텁 스크립트)은 (b)로 판정되어 discovery job 만 red 가 된다"로 REQ-5 와의 모순을 직접 봉합.
- 재공격: (b)를 (a)에 종속시켜 discovery 를 영구 초록으로 만드는 구현 → (b) 문면이 "머지 여부와 무관하게"이므로 종속 구현은 픽스처 ⑦ 에서 즉시 실패. **방어됨.**
- F1 머지 시점 discovery job 이 공허(대상 0건)한 것은 (a)(b) 모두 대상이 없기 때문이며, 탐지 능력은 픽스처 ⑦ 로 별도 입증된다 — 3차가 문제 삼은 "영구 초록"과 다르다.

### B-3: **해소**
- 근거 3자 정합 확인:
  - `F1.md:82` REQ-3 "DB 접근 보유 패키지는 **packages/api 와 packages/db 둘뿐**", `FORBID-1 when:150` "packages/api·packages/db 외의 워크스페이스 패키지에서".
  - `F5.md:49-51` REQ-1 "드라이버 의존 자체를 보유하는 **packages/db 는 제외 집합이다 — F1 REQ-3 과 동일한 경계**", `F5.md:34` touches `packages/db/src/pool.ts` 에 동일 주석. `F5.md:95` FORBID-1 when 도 "packages/api·packages/db 밖의 파일"로 F1 과 일치.
  - `F2a.md:35` touches `packages/db/package.json # DB 드라이버 의존 추가 (packages/db 는 F1 REQ-3 의 제외 집합이므로 boundary job 을 red 로 만들지 않는다)`.
- **F2a 우회 강요 경로 소멸 확인.** F2a 의 첫 PR 은 `packages/db/package.json` 에 드라이버를 넣어도 REQ-3 (a)(b) 어느 쪽에도 걸리지 않는다(제외 집합). F5 도 동일.

### B-3b: **부분 — 미해소 잔여 있음 (blocking)**
- 반영된 것: `F1.md:84-86,88-90` REQ-3 (b) — 전 의존을 `packages/config/dependency-classes.json` 에 분류 강제, **미분류 1건이면 exit 1**(부인목록 → 허용목록 전환 ✓). `@prisma/client`·`@supabase/supabase-js` 는 도달성을 피해도 `data-access` 분류 대상이 되어 포착된다(REQ-3 픽스처 ② `:91-92`). 3차 B-3b 의 원 공격은 **방어됨.**
- **남은 구멍: 허용목록의 기대값 파일이 F1 소유(`packages/config/**`)인데, 의존을 추가하는 하류 계약에 그 파일을 편집할 합법 경로가 없다 — 규칙이 하류 PR 을 통과 불가로 만든다.**
  - `DS3.md` touches `apps/web/package.json # seed CSS/theme · Radix 의존성 추가`. DS3 은 apps/web 에 신규 의존을 등재한다 → REQ-3 (b) 상 **미분류 의존 발생 → boundary job exit 1**.
  - DS3 이 이를 해소하려면 `packages/config/dependency-classes.json` 을 편집해야 하는데 그 경로는 DS3 touches 밖 → `F1.md:200-215` **FORBID-4(path-guard) block_merge**.
  - `DS1.md` 도 동일(`packages/ui/package.json` 신규 패키지 생성 = "이후 신설분"의 전 의존이 미분류).
  - 즉 **DS1·DS3(Phase 1, F1 직후 첫 하류)에 green 이 되는 합법 경로가 존재하지 않는다.** 3차 B-3 이 F2a 에 대해 지적한 것과 **동일 구조의 데드락이 DS1/DS3 으로 이전**됐을 뿐이다. 개발 에이전트의 최단 경로는 (i) 계약 밖 파일 수정, (ii) `dependency-classes.json` 을 touches 에 몰래 추가, (iii) boundary 검사 약화 — 전부 3차가 막으려던 우회 학습이다.
  - 판정 근거(3차 blocking 기준 (c)): 사양 공백을 개발 에이전트가 즉흥 결정하고 그 결정을 하류가 상속한다.

### B-4: **해소**
- 근거: `F1.md:150-152` FORBID-1 when (c) "`db-driver-exceptions.json` 에 (사유 · 만료일 ≤ 90일 · 승인자) 3필드 없이 항목이 추가되는 경우", detect `:161` "diff 는 packages/config CODEOWNERS 승인 리뷰(승인자 ≠ PR 작성자) 없이는 실패", `REQ-7:131` CODEOWNERS 경로에 `packages/config` 등재, 초기값은 `:90` 에 빈 배열로 못박힘.
- 재공격: 하류 PR 이 예외에 `apps/web` 한 줄 추가 → 3필드 + 타인 승인 없이는 boundary red. **방어됨.**

### B-5: **해소**
- 근거: `F1.md:51` touches `.github/pr-task`, `FORBID-4 when:202-203` 판정 원천을 `.github/pr-task` 로 확정, detect `:210-213` "`docs/tasks/<ID>.md` 의 touches 블록을 **직접 파싱(F1b 의 docs/tasks.json 에 의존하지 않는 자립 경로)**", "`.github/pr-task` 부재이거나 미등재 계약 ID 인 경우도 exit 1", `:214` "job 이름은 `path-guard` 로 고정한다 — C2·C3 계약이 이 이름을 인용한다".
- 대조: `C2.md:172`·`C3.md:222` 가 인용하는 job 명 `path-guard` 와 일치 ✓. F1b 산출물 비의존이므로 F1 단독 머지 상태에서도 성립 ✓.

### B-6: **해소**
- 근거: touches 에 `eslint.config.mjs`(`:39`) · `tools/ci-meta/**`(`:53`) · `tools/dep-graph/**`(`:54`) · `tools/path-guard/**`(`:55`) · `.github/ci-fixtures/**`(`:52`) · `.github/pr-task`(`:51`) 전부 추가. FORBID-2 when 말미(`:171`)에 "**단 `.github/ci-fixtures/**` 와 검사기의 패턴 정의 파일은 위반 재현이 목적이므로 대상에서 제외한다**"가 규칙 안으로 들어옴.
- 자기 PR 대입: F1 이 생성하는 전 파일이 touches 안에 있고(픽스처 8종 포함), 픽스처 내 위반 문자열은 FORBID-2 대상 제외, FORBID-6 은 (a)(b) 분리로 자기 차단 없음. **P7 4회차 재발 없음.**
- 단, B-8 의 애그리게이터 구현 관용구(`if: always()`)가 FORBID-2 패턴 사전에 열거돼 있다(`:169`) — B-8 수정 시 함께 처리해야 P7 5회차가 되지 않는다. §2 필수 수정 2-(c).

### B-7: **해소**
- 근거: `F1.md:186-189` FORBID-3 when 을 **"apps/web 의 페이지 라우트(`apps/web/src/app/**/page.tsx` 와 그 세그먼트 레이아웃)"** 로 한정하고, 괄호로 "**Route Handler `apps/web/src/app/api/**` · Server Action · middleware 는 정의상 동적이므로 대상이 아니다**"를 규칙 안에 명시. detect `:196-197` 도 "**페이지 라우트만** 필터", 2차 수단도 "페이지 라우트 파일에 한정한 5개 토큰 grep" 으로 좁혀짐. `because:193-194` 가 이 한정의 사유(F5·W6·W8 에서 깨지면 최단 경로가 `|| true`)를 명시.
- 지목 3건 실사:
  - **F5 Route Handler** — `F5.md:140-141` out_of_scope "Next.js 라우트 핸들러 작성 (W1·W2·W3 소관)". F5 는 apps/web 을 아예 건드리지 않는다 → 무관. 하류가 만드는 핸들러는 `app/api/**` 예외.
  - **W6 리드 전송 POST** — 수집 엔드포인트는 W6 소유가 아니다(`W6.md:171` "수집 엔드포인트 … W9 소관"). 실물은 `W9.md:45` `apps/web/src/app/api/events/ingest/route.ts` → **예외 경로에 정확히 포함** ✓.
  - **W8 처리 API** — `W8.md:46` `apps/web/src/app/api/internal/corrections/**` → **예외 경로에 포함** ✓.
- `done_when:271` 이 "Route Handler 가 동적이어도 test job 이 green 임을 확인"을 F1 자신의 완료 조건으로 박아 회귀를 막는다. **3건 모두 규칙에 걸리지 않음 확인.**
- 잔여(비차단): 인증 필요한 **내부 페이지 라우트**(`W8.md:45` `(internal)/corrections-queue/**`)는 예외 목록에 없다. §4-2 참조.

### B-8: **부분 — 미해소 잔여 있음 (blocking)**
- 반영된 것: `F1.md:118-127` REQ-6 에 애그리게이터 `ci-required` 예외 신설 + acceptance 에 GitHub API 검증 2종 — (a) required status checks 집합 == {`ci-required`}, (b) `ci-required.needs` ⊇ ci.yml 전 검사 job. **등록 메커니즘은 생겼다 ✓.** 하류가 job 을 추가하고 needs 에 넣지 않으면 lint 가 red(`:126-127`) → 자동 편입 강제도 성립 ✓. `F2a.md:37`·`F5.md:159` 가 이 규약을 인용해 정합 ✓.
- **남은 구멍: 하류 job 의 `block_merge` 가 실제로 집행되는지를 아무도 검사하지 않는다.**
  - REQ-6 acceptance 는 **등록 상태(집합·needs 포함관계)만** assert 한다. "**어떤 needs job 이 red 일 때 `ci-required` 가 red 가 된다**"는 요구가 REQ-6 에도 REQ-5 에도 `done_when` 에도 **없다**.
  - GitHub Actions 표준 semantics: `needs` 중 하나가 실패하면 애그리게이터 job 은 실행되지 않고 **`skipped`** 로 종료되며, **브랜치 보호는 skipped 필수 체크를 통과로 취급**한다. 즉 계약을 100% 준수한 순진한 구현(`needs:` 만 선언)에서 **모든 하류 job 이 red 여도 머지가 열린다** — B-8 이 막으려던 상태 그 자체(악의적 준수 성공).
  - REQ-5 의 픽스처 8종 검증도 "대응 job red · 나머지 7 green" 까지만 보고 **`ci-required` 의 결론(conclusion)을 보지 않는다** — 즉 이 구멍은 픽스처로도 걸리지 않는다.
  - 안전한 표준 구현(`if: ${{ !cancelled() }}` + `needs.*.result` 평가로 명시적 실패)은 계약이 요구하지 않고, 가장 널리 쓰이는 관용구 `if: always()` 는 **FORBID-2 패턴 사전(`:169`)에 열거되어 자기 lint job 이 차단**한다. 개발 에이전트에게 남는 최단 경로는 순진한 구현 = 집행 공백.
  - 판정 근거(기준 (b)+(c)): 36개 계약의 `on_violation: block_merge` 가 여전히 자문으로 전락한다.

### B-9: **해소**
- 근거: `F1.md:129-138` REQ-7 acceptance (a) 7경로 파싱 + 소유자 비어있지 않음, (b) **GitHub API 로 `require_code_owner_reviews == true`**, (c) **소유자 집합 ∩ 구현 에이전트 계정 == ∅**. `done_when:269-270` 이 API 응답 첨부와 소유자 주체 상이를 완료 조건으로 재기재.
- 3차 지적("파일에 문자열이 있는지만 본다" · "소유자 = 작성자면 예외 경로가 영원히 봉쇄")의 두 요구가 모두 acceptance 로 승격됨 ✓.
- 잔여(비차단): "구현 에이전트 계정" 집합의 원천이 미정의(§4-3).

### B-10: **해소**
- 근거: `F1.md:23` blocks 에 `DS1-TOKEN-LAYERS`·`DS6-A11Y-GATE` 추가. `DS1.md:66`·`DS6.md:54` 의 depends_on 과 역방향 정합.
- 실측: `python3 scripts/tasks_manifest.py --check` → **`✓ DAG 정합성 통과`** (3차에서 출력되던 `F1-REPO-SCAFFOLD.blocks 에 'DS1-TOKEN-LAYERS' 누락` 소멸). baseline 고착 위험 해소.
- 부수 확인: `03-task-dag.md:50` 에 `F1b-CONTRACT-GOVERNANCE` 등재됨(3차 N-6 해소) → F1b REQ-4 (b)가 자기 자신을 위반으로 잡는 상태 아님.

---

## 2. NO-GO 항목 필수 수정 (2건 · F1.md 본문)

1. **B-3b — 허용목록 기대값 파일의 하류 편집 경로를 규칙 안에 둔다.** 아래 중 하나를 택할 것:
   (a) `FORBID-4 when`(`F1.md:203`)의 전 계약 공통 허용 목록에 `packages/config/dependency-classes.json` 을 추가하고, REQ-3 acceptance 에 "**분류 추가 diff 는 `data-access` 로 분류할 때만 packages/config CODEOWNERS 승인 리뷰가 필요하고, `other` 분류 추가는 승인 없이 허용**"을 명시. — 하류가 의존을 추가할 합법 경로가 생기고, 위험한 분류(`data-access`)에만 게이트가 걸린다.
   (b) 또는 분류 원천을 중앙 파일이 아니라 **패키지별 파일**(`<pkg>/dependency-classes.json`)로 바꿔 각 계약의 touches 안에 들어오게 한다.
   — 현행대로면 `DS1`·`DS3`(F1 직후 첫 하류)이 boundary red 와 path-guard red 사이에서 **합법 경로 0개**가 되고, 그 자리에서 우회 관용구가 학습된다.

2. **B-8 — 집행(실패 전파) 자체를 검증 대상으로 만든다.** 세 줄:
   (a) `REQ-6 statement` 에 "**`ci-required` 는 needs 중 하나라도 성공이 아니면(실패·취소·스킵 포함) 반드시 실패한다**" 추가.
   (b) `REQ-6 acceptance` 또는 `REQ-5 acceptance (3)` 에 "**픽스처 8종의 각 런에서 `ci-required` 의 conclusion 이 `success` 가 아님**"을 assert 로 추가. — 이것이 없으면 skipped=통과 semantics 때문에 8개 job 이 전부 red 여도 머지가 열린다.
   (c) `FORBID-2 when`(`:169`)의 제외 절에 "**애그리게이터 `ci-required` job 의 `if:` 조건(needs 결과 평가 목적)은 대상에서 제외**"를 추가. — (a)를 만족시키는 유일한 관용구가 현재 패턴 사전에 열거되어 있어, 고치는 순간 F1 자기 PR 이 차단된다(P7 5회차 예방).

---

## 3. F1b 신규 검토 (치명 결함만)

**착수 가능하나 정정 2건 필요.** F1b 는 `depends_on: [F1]` 이므로 F1 착수 판정에는 영향하지 않는다.

- **승계·공존 금지: 구멍 1건.** `F1b.md:100-108` REQ-5 + `FORBID-1:113-119`(`--check self` 로 `scripts/` 잔존 판정 로직 검출) + touches 에 2파일 명시(`:42-43`) → **공존 금지는 성립 ✓**. 그러나 REQ-5 의 "**삭제**" 옵션이 여전히 열려 있고, `scripts/tasks_manifest.py:15` 의 주기능인 **`docs/tasks.json` 생성**을 dag-check 가 승계한다는 문장이 없다. `scripts/github_sync.py:20,73` 이 그 산출물에 의존하므로(삭제 시 `"docs/tasks.json 이 없다"` 로 SystemExit) **삭제를 택하면 이슈 동기화가 파손**된다. → REQ-5 에 "매니페스트 생성 기능(`docs/tasks.json`)도 함께 승계하며 산출 경로·스키마를 유지한다" 명시 필요.
- **오탐 픽스처: 정면 모순 1건 (치명).** `REQ-4:90` 규칙 **(c) "폐기 표시 ID 참조" = 위반** ↔ `REQ-4 acceptance:96` 오탐 픽스처 **③ "폐기 태스크를 depends_on 하는 살아있는 계약" = 0건**. 같은 사실에 대해 한쪽은 위반, 한쪽은 0건을 요구한다. `FORBID-5`(픽스처 기대값 변경 금지)까지 걸려 있어 구현자에게 남는 유일한 길은 **규칙 (c)를 죽이는 것**이고, 그러면 폐기 ID 참조 탐지가 조용히 사라진다. 실제 스크립트(`tasks_manifest.py`)가 교정한 것은 *역방향 blocks 요구 면제*뿐임을 재확인. → (c)를 "폐기 태스크를 `blocks` 로 요구하는 역방향 검사만 면제, 참조 자체는 경고 유형으로 분리" 등으로 문면 정정 필요. 픽스처 ①(개정 노트 "폐기" 문구) ②(인라인 리스트 뒤 `#` 주석)는 각각 `tasks_manifest.py:30-35`(제목·상태 줄에서만 폐기 판정)·`:23-25` 와 대응하며 **0건 판정이 규칙과 모순되지 않는다 ✓**.
- **미탐 픽스처: 가장 위험한 1종이 빠져 있다 (치명).** `REQ-4 acceptance:94` 는 "미탐 픽스처 **7종**"만 요구하고, 그 7종은 규칙 (a)~(g) 유형과 1:1 대응한다 — **파서 미탐 케이스가 하나도 없다.** 정작 기존 스크립트 저자는 `tasks_manifest.py:20-22` 에 이렇게 남겼다: *"대괄호가 여러 줄에 걸쳐도 인식해야 한다. 여러 줄을 못 읽으면 필드가 통째로 빈 리스트가 되어 **위반이 조용히 통과한다** — 오탐보다 위험한 미탐"*. 현행 `LIST_INLINE`(`:23-25`)은 `[^\]]*` 로 개행을 넘어 매칭해 이를 처리하지만, **node 재구현이 줄 단위 파싱을 쓰면 이 방어가 그대로 소실되고 dag-check 는 녹색인 채 뚫린다.** `F1.md:23` 의 blocks 는 15개 항목 300자 이상이라 누군가 줄바꿈하는 순간 F1 의 DAG 검사 전체가 무판정이 된다. → REQ-4 acceptance 에 미탐 픽스처 **8종째**로 "**여러 줄로 감싼 인라인 리스트를 가진 계약(위반 1건 포함)**"을 추가하고, "**전 계약에 대해 `depends_on`·`blocks`·`traces_to` 중 파싱 결과가 빈 값인 필드가 원문에 실제 값이 있는 경우 exit 1**"(파싱 실패 = 침묵 통과 금지)을 규칙으로 추가할 것. FORBID-5 의 동결 대상에도 포함.
- **F1/F1b 경계 — 중간 상태 동작(규격 §4): 성립 ✓.** F1 단독 머지 시 8 job + `ci-required` 로 CI 가 완결되고, `path-guard` 는 `docs/tasks/<ID>.md` 직접 파싱이라 `docs/tasks.json`(F1b 소유) 없이 동작한다(`F1.md:211`). discovery job 은 대상 0건이나 픽스처 ⑦ 로 탐지력이 입증된다. F1b 는 `.github/workflows/ci.yml`·`ci-budget.json` 을 touches 에 갖고 있어(`F1b.md:44-45`) `dag-check` job 추가와 `ci-required.needs` 편입을 자기 PR 안에서 처리할 수 있다 ✓. **"항상 같이 머지" 관계 아님 → 분할 유지 타당.**
- (참고) `F1b.md:89` REQ-4 (b) 의 "정본 ID 레지스트리"가 어느 파일인지 미지정 상태다. REQ-5 의 "파이썬 검증기 출력과 **동일 집합**" 비교는 기대값 원천이 같을 때만 성립한다(3차 N-8(c) 잔존).

---

## 4. 비차단 신규 발견 (판정에 미반영)

1. **픽스처 트리 → 실제 Actions 런 전환 방식 미규정.** `.github/ci-fixtures/<job>/` 의 트리를 어떻게 브랜치로 올려 실행하는지(오버레이? 브랜치 동기화?)가 계약에 없다. 부수 효과: 픽스처 ⑦ 은 `scripts/discovery/validate_dX.py` 를 루트에 놓아야 하는데 그 경로는 F1 touches 밖이라 **같은 런에서 path-guard 도 red** 가 되어 "나머지 7 green" 이 깨진다. 합법 해법은 있다 — 해당 픽스처 브랜치의 `.github/pr-task` 에 `D1a-PROTOCOL` 을 기재하면 `D1a.md:85` touches 가 그 경로를 덮는다. 계약에 이 규약을 1줄 적어두면 즉흥 판단이 사라진다.
2. **인증 필요한 내부 페이지 라우트가 FORBID-3 예외에 없다.** `W8.md:45` `(internal)/corrections-queue/**` 는 페이지 라우트이면서 세션·실시간 큐가 전제다. `cookies()` 사용만으로 `next build` 요약에 동적(ƒ)으로 찍히고, detect(`F1.md:196`)의 "페이지 라우트 동적 항목 0건"에 걸린다. W8 은 Phase 3~4 이므로 지금 막지 않아도 되나, 예외에 `apps/web/src/app/(internal)/**` 를 추가해 두면 미래의 `|| true` 를 예방한다.
3. **REQ-7 (c) "구현 에이전트 계정" 집합의 원천 미정의.** 현 문면으로는 "PR 작성자"로 축소 구현될 수 있다. 계정 목록 파일 또는 판정 규칙을 지정할 것.
4. **`DS1.md` touches 주석과 F1 REQ-1 충돌(하류 계약 측 정정 대상).** DS1 은 "F1 이 고정한 워크스페이스 패키지 수 기대값 **4→5 갱신**"을 예외로 선언하는데, `F1.md:71-72` 는 "집합 포함 검사, **개수 동등 비교(=== 4)를 사용하면 실패**"를 요구한다. F1 을 규격대로 구현하면 DS1 이 갱신할 기대값 자체가 존재하지 않는다 → DS1 저자에게 상신.
5. 3차 non-blocking 중 `F4.md` 의 `inconclusive` 축 처리 규칙 부재(N-8(e))는 여전히 미해소(F4 저자 소관).

---

## 5. 결론

| 항목 | 판정 |
|---|---|
| B-1 픽스처 분리·귀속·신선도 | 해소 |
| B-2 discovery 영구 초록 | 해소 |
| B-3 경계 제외 집합(F2a·F5 3자 정합) | 해소 |
| B-3b 허용목록 전환 | **부분 — 하류(DS1·DS3) 합법 경로 0개** |
| B-4 예외 파일 잠금 | 해소 |
| B-5 FORBID-4 판정 수단·job 명 | 해소 |
| B-6 P7 자기차단 | 해소 |
| B-7 FORBID-3 범위 한정 | 해소 (F5·W6·W8 3건 전부 무관 확인) |
| B-8 필수 체크 등록·집행 | **부분 — 등록 ✓, 실패 전파 검증 없음** |
| B-9 CODEOWNERS 실집행 | 해소 |
| B-10 blocks DS1 | 해소 (검증기 exit 0 실측) |

**NO-GO: B-3b, B-8.** 두 건 모두 "규칙은 강해졌으나 그 규칙이 **작동하는지**를 아무도 확인하지 않는다"는 3차 체계적 패턴 #2 의 잔재이며, §2 의 5줄 수정으로 닫힌다. 수정본은 해당 5줄만 재확인하면 되고 전면 재감사는 불필요하다.
