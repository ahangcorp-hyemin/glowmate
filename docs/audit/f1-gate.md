# F1 단독 통과 감사 (개발 착수 관문) — 3차

> 감사일: 2026-08-03 · 감사관: task-auditor
> 대상: `docs/tasks/F1.md` 1건 (분할 산출물 `F1b.md` 는 대조 참조로만 사용)
> 기준: `docs/02-task-contract-spec.md`(원칙 2.5 · R-6 · R-7 · §5) · `docs/01-prd.md` · `docs/03-task-dag.md`
> 대조 실사: `F1b.md` `D1b.md` `F4.md` `F2a.md` `F5.md` `C2.md` `C3.md` · `scripts/tasks_manifest.py` `scripts/normalize_ids.py` `scripts/github_sync.py` · `python3 scripts/tasks_manifest.py --check` 실행

---

## F1-REPO-SCAFFOLD — **REVISE** (blocking 10건 · non-blocking 8건)

분할(F1 → F1 + F1b) 자체는 규격 §4에 부합한다. 요구사항 11개 → 8개, 리뷰 전문성 2종 분리, F1 단독 중간 상태 동작, "항상 같이 머지" 아님. **분할은 승인한다.** 그러나 F1 에 남은 8 REQ / 6 FORBID 에서 **공격 A(껍데기 CI)가 성공**하고, **P7 자기차단이 3회차로 재발**하며, **REQ-3 의 경계 정의가 F2a·F5 를 계약대로 착수 불가로 만든다.**

---

## 1. 2차 감사 12개 필수 수정 항목별 판정

| # | 수정 요구 | 판정 | 근거 위치 |
|---|---|---|---|
| 1 | verdict 어휘 D1b 정본 통일 + per_axis 값 집합 | **반영** (하류 1건 잔존) | `F1b.md:63-72` REQ-2 — G1 = `{undecided, proceed, editor_augment, axis_excluded, inconclusive}` 이며 `D1b.md:137-142,198,205` 의 4값과 정확히 일치. per_axis **축 키 3종**(`exercise_body, relax_recovery, medical_wellness`)까지 acceptance 에 고정 ✓. **잔존:** `F4.md:60-64` 는 여전히 `proceed/editor_augment/axis_excluded/undecided` 만 파싱하고 **`inconclusive` 축의 처리 규칙이 없다** → F4 계약 정정 필요(F1 소관 아님) |
| 2 | `scripts/tasks_manifest.py` 승계 · 공존 금지 | **부분** | `F1b.md:87-95` REQ-4 + `FORBID-1`(`--check self` 로 `scripts/` 잔존 판정 로직 검출) + touches 에 `scripts/tasks_manifest.py`·`scripts/normalize_ids.py` 명시 ✓ (요구된 `scripts/**` 대신 2파일 열거 — 더 좁으므로 수용). **미대조 2건:** (a) 실제 스크립트는 **`docs/tasks.json` 생성**이 주기능이고 `scripts/github_sync.py:20,73` 이 그 산출물에 의존한다 — REQ-4 의 "삭제" 옵션을 택하면 github_sync 가 파손된다. (b) 스크립트 규칙 (1)은 **계약 파일에서 수집한 ID 집합**과 대조하는데 F1b REQ-3(b)는 **`03-task-dag.md` 정본 레지스트리**와 대조한다 — 기대값 원천이 달라 그대로는 "동일 집합" 비교(REQ-4 acceptance)가 성립하지 않는다 |
| 3 | 오탐 회귀 픽스처 3종 · 각 0건 판정 | **반영(모순 1건)** | `F1b.md:80-85` REQ-3 acceptance (2) 에 3종이 **0건 판정 → exit 0** 형태로 박혔고 `FORBID-5` 가 삭제·기대값 변경을 막으며 `done_when:162` 에도 재기재 ✓. **모순:** 픽스처 ③("폐기 태스크를 depends_on 하는 살아있는 계약 → **0건**")과 REQ-3 규칙 **(c) "폐기 표시 ID 참조 → 위반"** 이 정면 충돌한다. 실제 스크립트(`tasks_manifest.py:82-87`)는 ③을 **위반으로 계상**하고, 교정된 것은 *역방향 blocks 요구 면제*(`:96` `dep in live`)뿐이다. 현 문면대로면 구현자는 (c)를 죽이거나 픽스처 ③ 기대값을 바꾼다 → **F1b 저자에게 정정 상신 필요** |
| 4 | baseline 초기값 상한 · 유형별 카운터 | **반영** | `F1b.md:79,83-84` 유형별 baseline + `traces_to` 유형 0, `FORBID-2` when 에 "**base 에 파일이 없는 최초 도입에도 traces_to 상한 0 은 적용**" — 사전 설정 무방비(§3.4)가 규칙 안으로 들어왔다 ✓ |
| 5 | KM-*/NSM-* 출처 확정 · 이름 통일 | **반영(소유자 공백)** | `F1b.md:52-62` REQ-1 — `KM-qualified-lead` 를 `NSM-qualified-lead` **별칭**으로 등재해 정본 1개 ✓, `done_when:160` 이 선행 PR 머지를 요구 ✓. 실사 결과 `docs/01-prd.md`·`docs/00-lean-canvas.md` 에 `KM-`·`NSM-` 문자열은 **현재 0건**(grep 확인) — 즉 선행 PR 은 아직 존재하지 않으며, **그 PR 을 소유한 태스크 계약이 없다**(F1b out_of_scope:149 가 자기 소관에서 배제). F1b 착수 전 해소 필요 |
| 6 | FORBID-6 최초 도입 예외 | **부분** | `F1.md:192-194` when 에 "**origin/main 에 머지된**" 한정 삽입 ✓. 그러나 같은 항목 `detect:200-203` (b)와 `REQ-5:96-99` 픽스처 ⑦ 가 그 한정과 **모순**(아래 blocking B-2) |
| 7 | FORBID-1 부인목록 → 허용목록 | **부분** | `F1.md:73-81` REQ-3 이 **lockfile transitive 도달성** 판정으로 전환되고 "모듈명 부인목록만으로 구현하면 실패로 간주" 명시 ✓ (`@vercel/postgres` → `@neondatabase/serverless` 도달로 포착됨). 그러나 **여전히 드라이버 노드 5종 열거(부인목록)** 이며 요구된 "packages/api 외 어떤 패키지도 DB 클라이언트류를 `dependencies` 에 선언 금지"(허용목록)로 전환되지 않았다. 게다가 **제외 집합이 `packages/api` 하나뿐**이어서 아키텍처와 충돌(B-3) |
| 8 | CODEOWNERS REQ 승격 | **부분** | `F1.md:109-113` REQ-7 로 6경로 승격 ✓(`tools/dag-check/**` → `tools/**` 로 확대, 수용). 그러나 **집행 수단이 없고**(B-9) **`packages/config/**` 가 빠져 있어**(B-4) 정작 F1 자신의 경계 예외 파일이 무주공산 |
| 9 | REQ-5 statement/acceptance 정합 | **반영(실효성 무력)** | `F1.md:91-99` — 7 job / 7 픽스처 / **7개 전부 red** 로 정합화되고 픽스처 구성 7종이 계약에 고정(2차 D-3 해소) ✓. 그러나 픽스처 **단일 브랜치 결합 + 귀속 미검사 + 신선도 미규정**으로 검증력이 무너진다(B-1) |
| 10 | FORBID-2 when 정정 · FORBID-3 짝 REQ | **반영(과잉 1건)** | `F1.md:138-142` when 에서 "CI red 인 PR" 한정 제거 + "(CI 성공·실패 여부와 무관하게 발동한다)" 명시 ✓. `F1.md:115-119` REQ-8(Static/ISR ≥ 2)로 원칙 2.5 짝 REQ 신설 ✓. 단 FORBID-3 detect 가 **"전 라우트 Static/ISR"** 무조건 금지로 과잉(B-7) |
| 11 | 게이트 전이 정합성 검사 | **반영** | `F1b.md:77-78` REQ-3 (f) + `:85` 배열/문자열 양 표기 처리 강제 + 미처리 시 (f) 픽스처 실패 ✓ (2차 C-5 도 함께 해소) |
| 12 | blocks 주석 삭제 | **반영** | `F1.md:23` 주석 없음 ✓ ("미반영분은 baseline 계상" 문구 소멸 확인) |

**요약: 반영 7 · 부분 5 · 미반영 0.** 부분 5건 중 #6·#7·#8 은 아래 blocking 으로 승계된다.

---

## 2. 기계적 규격 대조 (§5 체크리스트 전 항목)

| 항목 | 판정 | 근거 |
|---|---|---|
| traces_to 가 비었거나 PRD 미존재 ID | **부분 실패** | `[H3, G1, G3]` 는 `01-prd.md:50,62,64` 에 실재하나, **H3 의 판정 게이트는 G2**(`prd:63`)인데 F1 은 G2 를 참조하지 않는다 (N-5) |
| depends_on 순환 | 통과 | `depends_on: []`. `tasks_manifest.py` 순환 탐지 통과 |
| depends_on 이 DAG 미존재 태스크 참조 | 통과(단 blocks 1건 결함) | `blocks` 의 `F1b-CONTRACT-GOVERNANCE` 가 `03-task-dag.md:44-62` **정본 레지스트리에 미등재**(N-6). 또 `blocks` 에 **DS1-TOKEN-LAYERS 누락**(B-10, 검증기 실측 exit 1) |
| gate 무시 · 선행 배치 | 통과 | `gate: null`, `prd:67` "Phase 1 은 게이트와 무관하게 선행 가능" 부합 |
| 2개 이상 PR 로 나뉘어야 함 | 통과 | F1b 분할로 해소. 잔여 8 REQ 는 단일 되돌림 단위(스캐폴드+CI) |
| 주관적 형용사 (R-5) | 통과 | 금지 어휘 0건 |
| acceptance 기계 검증 불가 | **부분 실패** | REQ-5·6·7 이 `pnpm test:ci-meta` 를 지목하나 **어느 job 이 이를 실행하는지 미지정**(N-2). REQ-5 는 GitHub API 조회를 전제하나 토큰·권한·포크 PR 조건 미규정 |
| REQ 하나에 복수 요구 (R-4) | 통과 | 8건 모두 단일 축. REQ-6 의 3조건(예산 일치·8분 상한·needs 금지)은 "CI 예산 불변식" 단일 관심사로 수용 |
| requirements 8 초과 | 통과 | 정확히 8 |
| forbid 0개 / 7개 이상 | 통과 | 6개 |
| when 없음 · '항상' | **부분 실패** | 6건 모두 형식상 조건부이나, FORBID-3 의 **detect** 가 when 보다 넓은 무조건 금지("전 라우트")로 원칙 2 위반(B-7) |
| detect 없음 / 전부 코드리뷰 | 통과 | 6건 전부 CI job |
| because 실패 시나리오 | 통과 | 6건 전부 구체적·검증 가능 |
| 품질 임계 REQ 의 표집·홀드아웃 (R-6) | 해당 없음(주의) | 통계 임계 REQ 없음. 단 REQ-5 의 위반 픽스처 7종은 **구현자가 만드는 평가셋**이며, 계약이 7종 *유형*을 고정한 것은 R-6 취지에 부합 ✓. 각 픽스처의 **구체 내용**(특히 ⑤ 가짜 자격증명)은 자기 출제로 남음(N-3) |
| 전 REQ 픽스처 충족 가능 (R-7) | 통과 | REQ-4(실제 Playwright 기동) + REQ-5(실제 Actions 런 API 조회) + REQ-8(실제 `next build` 요약) |
| detect 대상 실재 | 통과 | `scripts/discovery/validate_d*.py` 는 D1a·D1b·D2·D3·D4 계약이 실제로 선언(실사 확인). FORBID-6 이 머지분 한정이므로 부재 시점 공허 참조 아님 |
| block_merge 인데 집행 CI 없음 | **부분 실패** | F1 자신은 CI 소유자 ✓. 그러나 **필수 체크 등록 메커니즘이 없고 REQ-6 이 애그리게이터 패턴을 봉쇄**해 하류 job 의 block_merge 가 집행되지 않는다(B-8) |
| 계약이 자기 PR 차단 (P7) | **실패 — 3회차 재발** | 루트 ESLint 설정 · ci-meta/dep-graph 검사기 구현 경로가 `touches` 에 없어 FORBID-4 가 F1 자기 PR 을 차단(B-6). FORBID-6 도 REQ-5 와의 모순으로 자기 PR 에서 판정 불가(B-2) |
| out_of_scope / touches / rollback | 통과(구멍 1) | 3종 정의 ✓, touches 는 열거형이며 광역 지정 없음. 단 검사기 구현 경로 부재(B-6) |

---

## 3. 공격 결과

### 공격 A — 악의적 준수 ("껍데기만 만드는 구현이 가능한가")

**시도한 공격:**
1. *7 job 을 만들되 각 job 의 스텝을 실질 검사 없이 채운다.* → REQ-5 가 "픽스처 브랜치에서 7개 job 전부 red" 를 요구하므로 정면 돌파는 실패. **그러나 우회 성공:** 픽스처가 **단일 브랜치 `ci-fixture/violations` 에 7종을 동시 주입**하는 구성이다. ① "web→db 드라이버 의존" 을 넣으려면 `apps/web/package.json` 을 편집해야 하고, 그러면 `pnpm install --frozen-lockfile`(REQ-1)이 **lockfile 불일치로 실패**한다 → **7개 job 이 전부 install 단계에서 red 가 된다.** 검사 로직이 하나도 없어도 REQ-5 의 "7개 전부 red" assert 는 100% 통과한다. → **결함 B-1(치명).**
2. *검사기를 항상 exit 0 으로 만든다.* → discovery job 에 대해서는 FORBID-6 (b)가 막으려 하나, 그 when 이 "머지된 계약" 한정이라 **F1 시점에 요구 스크립트 집합이 공집합**이다. 문면대로면 픽스처 ⑦(스텁 validate)은 "미머지 계약의 스크립트" 이므로 판정 대상이 아니고 → **discovery job 은 red 가 될 근거가 없다.** REQ-5 와 FORBID-6 이 서로를 무효화한다. → **결함 B-2(치명).**
3. *레지스트리·예외 파일을 비워둔다.* → `db-driver-exceptions.json` 초기값이 **빈 배열로 계약 본문에 못박혀 있어** 사전 설정 공격은 방어됨 ✓. 그러나 **사후 추가에 아무 게이트가 없다**(CODEOWNERS 6경로에 `packages/config/**` 없음, FORBID 어디에도 예외 등재 조건·상한 없음) → 하류 PR 이 `apps/web` 을 예외에 한 줄 추가하면 REQ-3·FORBID-1 전체가 합법적으로 무력화된다. → **결함 B-4.**
4. *빈 앱으로 FORBID-3 을 만점 통과한다.* → REQ-8(Static/ISR ≥ 2)이 신설되어 **방어됨 ✓**. 다만 `/` `/health` 두 개의 플레이스홀더로 충족되므로 H3 기여는 명목적(N-5).
5. *테스트 0건으로 `pnpm test` 를 통과시킨다.* → python 은 REQ-4(수집 ≥1)로 방어 ✓. **TS 측은 하한 없음** — `--passWithNoTests` 기본 통과가 막히지 않는다(N-1, 경미).
6. *워크스페이스를 4개만 만들고 개수 동등 비교로 하류를 막는다.* → REQ-1 이 "집합 포함 검사, `=== 4` 사용 시 실패" 를 명시해 **방어됨 ✓**(이 계약에서 가장 잘 쓰인 문장). 단 REQ-5 의 "7개 job" 에는 같은 방어 문장이 없다(N-4).

### 공격 B — 조건 회피

- **B-3(치명) — REQ-3/FORBID-1 의 제외 집합이 아키텍처와 어긋난다.** 규칙은 "**packages/api 를 제외한** 모든 워크스페이스 패키지에서 드라이버 도달 불가" 다. 그런데 `F5.md:32,49` 는 **`packages/db/src/pool.ts`(커넥션 풀 싱글턴)** 를 만들고 "packages/db 및 드라이버를 import 하는 패키지는 packages/api 하나" 라고 규정한다 — 즉 **드라이버를 실제로 보유하는 패키지는 `packages/db`** 다. `F2a.md:36` 이 `packages/db/package.json` 을 편집하는 순간 F1 의 boundary job 은 red 가 되고, **F2a·F5 의 touches 어디에도 `packages/config/db-driver-exceptions.json` 이 없어 합법적 탈출구가 없다.** 결과는 둘 중 하나다: (i) F2a 가 F1 의 규칙 자체를 손대 약화시키거나(스코프 밖 수정), (ii) 예외 파일을 touches 에 몰래 추가한다. 첫 하류 태스크에서 우회 관용구가 학습된다.
- **B-3b — 드라이버 부인목록이 여전히 뚫린다.** 도달성 판정 도입은 개선이나, 열거된 5종 노드에 **도달하지 않는 DB 접근 경로**가 남는다: `@prisma/client`(자체 Rust 엔진 바이너리 — `pg` 노드 없음), `@supabase/supabase-js`(PostgREST over HTTP — 의존 그래프상 완전 무해로 보임). 두 경로 모두 apps/web 에서 DB 전체에 접근하면서 REQ-3·FORBID-1 을 **100% 준수**한다. 2차 수정 #7 이 요구한 허용목록("packages/api·packages/db 외 어떤 패키지도 DB 접근 클라이언트를 `dependencies` 에 선언하지 않는다")으로의 전환이 미완이다.
- **B-7 — FORBID-3 은 when 보다 detect 가 넓다(무조건 금지).** when 은 "동적 토큰 선언 **또는** Static/ISR < 2" 인데 detect 1차 수단은 "**전 라우트** Static/ISR". F5 의 Route Handler, W6 의 리드 전송 POST 엔드포인트, W8 의 처리 API 는 **정의상 동적**이다. 이 규칙은 반드시 깨지고, 깨지는 순간 최단 경로는 `|| true`(FORBID-2 위반)이거나 F1 규칙 삭제다. 원칙 2 의 교과서적 위반이며 **F1 이 스스로 FORBID-2 가 막으려는 학습을 유도**한다.
- **FORBID-2 의 우회 관용구 열거가 부인목록이다(N-1).** `|| true` · `continue-on-error: true` 만 열거 → `|| :`, `set +e`, 스크립트 말미 `exit 0`, `if: always()`, `--passWithNoTests`, `describe.skip`/`@pytest.mark.skip`, 필수 체크에서 job 제외 는 전부 통과한다. **지름길 목록 중 "테스트 스킵" 을 막는 조항이 F1 에 하나도 없다.** #7 에서 부인목록의 위험을 인정했으면서 같은 파일 안에서 두 번 더 부인목록을 쓴다(체계적 패턴).

### 공격 C — 탐지 무력화 (각 CI job 이 실제로 위반을 잡는가)

| job | 픽스처 | 실제로 잡는가 |
|---|---|---|
| typecheck | ④ 타입 오류 | **잡음** — `tsc --noEmit` + 세 플래그 assert(REQ-2). 가장 견고 |
| lint | ② 사유 없는 eslint-disable | **부분** — disable 검출은 유효하나 FORBID-4(touches 대조)의 **판정 수단이 미정의**(B-5), FORBID-2 는 부인목록(B-2 위) |
| boundary | ① web→db 드라이버 | **부분** — 도달성 판정은 유효하나 제외 집합 오류(B-3)로 첫 하류에서 무력화, Prisma/Supabase 경로는 미포착(B-3b) |
| test | ③ force-dynamic | **부분** — REQ-8 로 "라우트 0개 자동 통과" 는 막힘 ✓. 그러나 detect 1차 수단이 과잉(B-7) |
| python | ⑥ pytest 실패 | **잡음** — 실 Playwright 기동 + 수집 ≥1 (R-7 충족) |
| secret-scan | ⑤ 가짜 자격증명 | **미검증** — 도구·룰셋이 계약에 없어 "픽스처에 맞춘 정규식 1개" 로 통과 가능(N-3) |
| discovery | ⑦ 항상 exit 0 스텁 | **잡지 못함** — FORBID-6 when 이 머지분 한정이라 F1 시점 픽스처 ⑦ 이 판정 대상 밖(B-2) |

- **C-공통(치명) — 위반 귀속(attribution)이 검사되지 않는다.** REQ-5 는 job 의 **red 여부만** GitHub API 로 확인하고, *어떤 규칙이 발동해 red 가 되었는지* 를 assert 하지 않는다. 결합 픽스처 브랜치에서는 install 실패·부수 파손만으로 7개가 동시에 red 가 되므로 **탐지 능력이 전혀 없어도 통과**한다(공격 A-1).
- **C-공통2 — 픽스처 실행의 신선도 규정이 없다.** "픽스처 브랜치의 실행을 GitHub API 로 조회해 assert" 는 **과거의 red 런을 읽어도 성립**한다. 하류 PR 이 boundary 로직을 삭제해도 `ci-fixture/violations` 의 옛 red 런이 남아 있는 한 ci-meta 는 계속 green 이다. **F1 이 만드는 탐지 기반이 시간이 지나면 자동으로 허구가 되는 구조.**

### 공격 D — 지름길 유도

- **임계 낮추기:** ci-budget 는 REQ-6(job당 8분·예산 정확 일치)+FORBID-5 로 잘 잠겼다 ✓ (2차 D-2 처방이 제대로 적용된 유일한 항목). 반면 **REQ-8 의 "2", REQ-3 의 예외 목록, ci-meta 자체**를 하류가 수정하는 것을 막는 조항이 없다. 검사기 구현 경로가 미지정이라 CODEOWNERS(`tools/**`)에 걸릴지도 불확정(B-6).
- **기본값 채워넣기:** `db-driver-exceptions.json` 사후 추가 무방비(B-4).
- **실패를 성공으로 삼키기:** FORBID-2 부인목록 회피(N-1) + discovery 영구 초록(B-2).
- **스코프 밖 파일 수정:** FORBID-4 가 이를 막아야 하나 **detect 가 "어느 계약의 touches 인지" 를 결정하는 수단을 명시하지 않는다**(B-5). 기계적으로 가능한 원천은 `docs/tasks.json`(= `scripts/tasks_manifest.py` 산출물)뿐인데, 그 경로는 **F1b 소유이고 F1 의 touches 밖**이다. 결과: F1 은 자기 touches 를 하드코딩할 수밖에 없고, 그러면 **모든 하류 PR 이 lint 에서 실패**한다. 게다가 `C2.md:172`·`C3.md:222` 는 같은 검사를 **`path-guard` 라는 다른 job 이름**으로 지목한다 — F1 이 CI job 네임스페이스 소유자이므로 정합화 책임은 F1 에 있다.
- **필수 체크 회피(신규):** 하류가 추가한 job(`db-schema` `api-integration` `dag-check` `public-surface` `path-guard`…)이 **브랜치 보호 필수 체크로 등록되는 메커니즘이 계약 어디에도 없다.** 표준 해법인 "애그리게이터 job(`needs: [모든 job]`)을 유일한 필수 체크로 등록" 은 **REQ-6 의 `needs` 무조건 금지로 봉쇄**되어 있다. 등록이 수작업이면 아무도 하지 않고, **36개 계약의 `on_violation: block_merge` 는 자문으로 전락한다**(B-8).

### 공격 E — DAG 정합성

- `depends_on: []` 타당(최초 태스크), 순환 없음, 게이트 건너뜀 없음(gate: null · Phase 1).
- **B-10 — `blocks` 에 `DS1-TOKEN-LAYERS` 누락.** `DS1.md:66` 이 `depends_on: [DS0, F1-REPO-SCAFFOLD]` 인데 F1 의 blocks 에 DS1 이 없다. 리포의 기존 검증기가 **지금 이 순간 이 위반을 출력**한다: `F1-REPO-SCAFFOLD.blocks 에 'DS1-TOKEN-LAYERS' 누락 (역방향 불일치)`. F1b 의 baseline 은 `traces_to` 유형만 0 을 강제하므로, 지금 고치지 않으면 **이 위반은 baseline 에 흡수되어 영구 고착**된다.
- **N-6 — `F1b-CONTRACT-GOVERNANCE` 가 `03-task-dag.md:44-62` 정본 레지스트리에 미등재.** F1.blocks 와 F4.depends_on 이 이미 이를 참조한다. F1b REQ-3(b)가 가동되는 순간 자기 자신이 위반으로 잡힌다. F1 의 touches 에 `docs/**` 가 없어 F1 이 고칠 수 없다 → **별도 문서 PR 이 F1b 이전에 필요**.
- `blocks` 나머지 12건은 전부 F1 의 워크스페이스·CI 를 실질적으로 필요로 함 ✓. `parallel_with` 4건 타당 ✓.

### 공격 F — 존재 이유

- `why` 는 산출물과 정합하며, "집행 주체 없는 선언" 이라는 문제 정의는 정확하다.
- **`traces_to: [H3, G1, G3]` 중 H3 이 헐겁다.** `01-prd.md:50,63` 상 **H3 의 검증 게이트는 G2**(SERP 롱테일 100개)이며 F1 은 G2 를 참조하지 않는다. F1 의 H3 기여 경로는 REQ-8+FORBID-3(Static/ISR ≥ 2) 하나인데, 플레이스홀더 라우트 2개로 충족되므로 **H3 검증에 실질 기여는 거의 없다**. 2차 감사 지적(짝 REQ 부재)은 해소되었으나 "참조만 걸림" 상태는 부분적으로 남아 있다. `G1·G3` 은 discovery job 이 D1a/D1b/D3 의 validate 스크립트를 실행함으로써 실질 기여 ✓ — 단 B-2 가 해소되어야 성립한다.

---

## 4. 필수 수정 사항

### BLOCKING — 개발 착수 전에 반드시 고쳐야 하는 것 (10건)

> 판정 기준: (a) F1 자기 PR 이 성립하지 않거나, (b) 머지 직후 CI 가 실질 검사 없이 초록이 되거나, (c) 개발 에이전트가 사양 공백을 즉흥 결정하고 그 결정을 36개 계약이 상속하는 것.

1. **B-1 · REQ-5 픽스처 구조 교체.** 결합 단일 브랜치 → **위반 1종만 담은 독립 픽스처 7개**로 분리하고, 각각에 대해 **대응 job 만 red · 나머지는 green** 을 assert. 추가로 **실패 사유 귀속**(규칙 ID·에러 문자열 매칭)과 **신선도**("현재 PR 의 워크플로 정의로 픽스처 트리를 재실행한 런만 유효")를 acceptance 에 명시. — 현 구성은 lockfile 불일치 하나로 7개가 동시에 red 가 되어, **검사 로직이 0줄이어도 REQ-5 가 통과**한다.
2. **B-2 · FORBID-6 의 when 을 두 갈래로 분리.** (a) *존재* 요구 → "origin/main 에 머지된 계약이 선언한 스크립트" 한정(현행 유지), (b) *비스텁* 요구 → "리포지토리에 존재하는 **모든** `scripts/discovery/validate_d*.py`" 로 확대. — 현 문면은 REQ-5 픽스처 ⑦ 과 모순이며, 구현자가 (b)를 (a)에 종속시키면 **discovery job 은 D 계약이 머지될 때까지 영구 초록**이 된다. 이는 이 FORBID 가 막으려던 실패 그 자체다.
3. **B-3 · REQ-3/FORBID-1 의 제외 집합을 `{packages/api, packages/db}` 로 정정**하고, 규칙을 "**apps/** · packages/ui 등 소비자 패키지에서 `packages/db` 및 드라이버 노드로의 도달 금지**"(F5 REQ-1 문면과 동일)로 재서술. — 현행대로면 `packages/db/package.json` 에 드라이버가 들어가는 **F2a 시점에 boundary job 이 red 가 되고 F2a·F5 에는 합법적 탈출구가 없다**(예외 파일이 그들의 touches 밖).
4. **B-3b · 부인목록 → 허용목록 전환 완료.** 도달성 검사와 **병행**하여 "packages/api·packages/db 외 워크스페이스의 `dependencies`·`devDependencies` 에 DB 접근 클라이언트(드라이버 · ORM · PostgREST/HTTP DB SDK)가 등재되면 실패" 를 REQ-3 에 추가. — `@prisma/client` · `@supabase/supabase-js` 는 드라이버 노드에 도달하지 않으면서 apps/web 에 DB 전권을 준다.
5. **B-4 · `packages/config/db-driver-exceptions.json` 잠금.** (a) REQ-7 CODEOWNERS 경로에 이 파일(또는 `packages/config/**`) 추가, (b) 예외 등재 시 **등재 사유 · 만료일 · 승인자 ≠ 작성자** 를 요구하는 FORBID 조항 신설 또는 FORBID-1 의 when 에 편입. — 초기값은 빈 배열로 잘 못박혔으나 **사후 추가가 완전 무방비**여서 경계 전체가 한 줄로 해제된다.
6. **B-5 · FORBID-4 의 판정 수단 명시.** "PR 이 구현하는 계약 ID 를 무엇으로 결정하는가"(브랜치명 규약 / PR 라벨 / `.github/pr-task` 파일)와 "touches 글롭의 기계 판독 원천은 무엇인가" 를 acceptance 에 못박을 것. **F1 시점에 `docs/tasks.json` 은 F1b 소유이므로 F1 이 자립 가능한 원천을 지정해야 한다.** 아울러 `C2.md:172`·`C3.md:222` 가 기대하는 job 명 `path-guard` 와 F1 의 `lint` 중 하나로 통일(F1 이 job 네임스페이스 소유자).
7. **B-6 · P7 자기차단 3회차 차단 — touches 보강.** 최소 (a) 루트 ESLint 플랫 설정(`eslint.config.*`), (b) `test:ci-meta`·`test:dep-graph` **검사기 구현 디렉터리**(예: `tools/ci-meta/**`, `tools/dep-graph/**`), (c) 픽스처 디렉터리를 touches 에 명시. 동시에 FORBID-2 의 when 에 "**검사기 자신의 패턴 정의 파일과 위반 픽스처 디렉터리는 대상에서 제외**" 를 규칙 안으로 삽입. — 현 touches 로는 `pnpm lint` 를 성립시키는 루트 설정과 REQ-5·6·7 을 판정하는 검사기를 **둘 곳이 없고**, FORBID-4 가 F1 자기 PR 을 차단한다. 또한 검사기가 `tools/**` 밖에 놓이면 CODEOWNERS 보호도 받지 못한다.
8. **B-7 · FORBID-3 detect 의 무조건 금지 제거.** 1차 수단을 "**정적 대상 라우트에 동적 전환 토큰 선언 금지 + Static/ISR 라우트 수 ≥ 2**" 로 축소하고, Route Handler·Server Action 등 본질적 동적 엔드포인트의 예외를 **규칙 안에** 둘 것(예: `apps/web/src/app/api/**` 제외). — "전 라우트 Static/ISR" 은 F5·W6·W8 에서 반드시 깨지며, 깨지는 순간의 최단 경로가 FORBID-2 위반이다.
9. **B-8 · 필수 체크 등록 메커니즘 신설.** REQ-6 의 `needs` 금지에 **"단, 전 job 완료를 집계하는 애그리게이터 job 1개는 예외로 하며 이 job 을 브랜치 보호의 유일한 필수 체크로 등록한다"** 를 규칙 안으로 넣거나, "ci.yml 에 정의된 모든 job 이 필수 체크로 등록되어 있음을 `test:ci-meta` 가 GitHub API 로 확인" 을 REQ 로 추가. — 현행대로면 **하류가 추가하는 모든 job 이 비필수 체크**여서 36개 계약의 block_merge 가 집행되지 않는다.
10. **B-9 · CODEOWNERS 의 실집행 요구(REQ-7 보강).** (a) 브랜치 보호에서 "Require review from Code Owners" 활성화를 rollback/done_when 이 아니라 **REQ acceptance 로 검증**, (b) 각 경로의 소유자가 **구현 에이전트 계정과 다른 주체**임을 assert. — FORBID-5 및 F2a·F2b·F5·F6·F1b 의 **유일한 예외 경로가 "CODEOWNERS 승인 리뷰"** 인데, 현 계약은 파일에 문자열이 있는지만 본다. 소유자가 곧 작성자면 "승인자 ≠ PR 작성자" 조건은 **영원히 충족 불가**가 되어 정당한 예외까지 봉쇄되고, 그 결과가 우회 학습이다.
11. **B-10 · `blocks` 에 `DS1-TOKEN-LAYERS` 추가.** (한 단어. 지금 `python3 scripts/tasks_manifest.py --check` 가 이 위반을 출력하며, 방치하면 F1b baseline 에 흡수되어 영구 고착된다.)

*(번호 11개이나 B-3/B-3b 를 한 사안으로 묶어 blocking 10건으로 계수한다.)*

### NON-BLOCKING — 개발과 병행해 고칠 수 있는 것 (8건)

- **N-1** FORBID-2 우회 관용구를 부인목록 → 판정 규칙으로 확장(`|| :`, `set +e`, 말미 `exit 0`, `if: always()`, `--passWithNoTests`, `.skip`/`.only`). 특히 **테스트 스킵을 막는 조항이 F1 에 전무**하다.
- **N-2** `pnpm test:ci-meta` 를 실행하는 job 명시 + GitHub API 토큰·권한·포크 PR 시 동작 규정.
- **N-3** secret-scan 의 도구·룰셋 고정(gitleaks/trufflehog 기본 룰셋 등). 현재는 픽스처 ⑤ 에 맞춘 정규식 1개로 통과 가능.
- **N-4** REQ-5 의 "7개 job" 에 REQ-1 과 동일한 **집합 포함 검사(개수 동등 비교 금지)** 문장 추가 — 하류가 job 을 추가하면 개수 비교 구현은 깨진다.
- **N-5** `traces_to` 에서 H3 의 위치 재검토. PRD 상 H3 의 게이트는 G2 이고 F1 의 기여는 명목적이다. 유지하려면 REQ-8 의 근거를 "W1/W4 의 정적 생성 전제 확보" 로 `why` 에 구체화.
- **N-6** `03-task-dag.md` 정본 레지스트리에 `F1b-CONTRACT-GOVERNANCE` 등재(별도 문서 PR — F1 의 touches 밖. **F1b 착수 전 필수**).
- **N-7** REQ-6 의 `needs` 금지로 인한 설치·빌드 중복 비용(8분 상한과 충돌 가능). B-8 의 애그리게이터 예외와 함께 재설계.
- **N-8** **F1b 로 이관된 항목의 잔여 결함**(F1 착수를 막지 않으나 F1b 저자에게 상신 필요):
  (a) REQ-3 규칙 **(c) 폐기 ID 참조 = 위반** ↔ **오탐 픽스처 ③ = 0건** 정면 모순 — 실제 스크립트는 ③을 위반으로 계상하며, 교정된 것은 역방향 blocks 면제뿐이다.
  (b) REQ-4 의 "삭제" 옵션이 **`docs/tasks.json` 생성 기능**을 함께 없애 `scripts/github_sync.py` 를 파손시킨다(승계 범위에 매니페스트 생성 명시 필요).
  (c) REQ-3(b)의 기대값 원천(`03-task-dag.md` 레지스트리)이 기존 스크립트(계약 파일 수집 ID)와 달라 REQ-4 의 "동일 집합" 비교가 성립하지 않는다.
  (d) `KM-*`/`NSM-*` 확정 선행 PR 을 **소유한 태스크 계약이 존재하지 않는다**(PRD·Lean Canvas 에 현재 0건 확인).
  (e) `F4.md:60-64` 가 여전히 `inconclusive` 축 처리 규칙을 갖지 않는다(F1b REQ-2 로 어휘는 확정됨).

---

## 5. 체계적 결함 패턴

1. **부인목록(denylist) 재발.** 2차 감사에서 드라이버 부인목록을 지적받아 도달성 판정으로 개선했으나, **같은 계약 안에서 우회 관용구(FORBID-2)·동적 렌더 토큰(FORBID-3)·드라이버 노드(REQ-3)를 다시 열거형으로** 쓴다. 열거는 이름 하나로 뚫린다.
2. **"검사가 존재함" 과 "검사가 작동함" 의 혼동.** REQ-5·FORBID-1·FORBID-6 이 모두 "픽스처에서 job 이 red" 를 최종 근거로 삼는데, **어떤 규칙이 red 를 냈는지 · 그 런이 현재 코드의 것인지** 를 아무도 묻지 않는다. 결합 픽스처·과거 런 재사용으로 전부 우회된다.
3. **집행 계층의 공백.** CODEOWNERS(문자열만 검사) · 필수 체크 등록(주체 없음) · 예외 파일(사후 무방비) — **F1 이 만드는 세 개의 집행 장치가 모두 "선언" 단계에서 멈춘다.** 하류 36개 계약의 예외 경로와 block_merge 가 전부 이 셋 위에 서 있다.
4. **P7(자기차단) 3회차.** 1차는 lockfile, 2차는 FORBID-6, 3차는 **touches 에 없는 필수 생성물**(루트 ESLint 설정 · 검사기 구현 경로)과 **FORBID-6 ↔ REQ-5 모순**이다. 매번 "예외를 규칙 안으로" 로 고쳤지만, **새로 추가한 REQ/FORBID 를 자기 PR 에 대입해보는 절차**가 저자 측에 없다는 것이 근본 원인이다.

---

## 6. 판정

**REVISE** — blocking 10건, non-blocking 8건.

태스크 정의(범위·DAG·존재 이유)는 타당하며 F1b 분할도 승인한다. REJECT 사유는 없다. 그러나 **B-1(픽스처 결합) · B-2(discovery 영구 초록) · B-6(자기 PR 차단)** 세 건은 "F1 을 머지했는데 CI 가 아무것도 잡지 않는" 상태를 그대로 허용하고, **B-3(경계 제외 집합) · B-5(FORBID-4 판정 수단) · B-8(필수 체크) · B-9(CODEOWNERS 집행)** 는 개발 에이전트가 즉흥으로 메울 사양 공백이며 그 즉흥 결정을 나머지 36개 계약이 상속한다.

> **지금 개발에 넘겨도 되는가 — 아니다. blocking 10건(B-1~B-10)을 반영한 개정본을 재감사한 뒤에 넘겨야 한다.** 다만 10건은 전부 F1 계약 본문 안에서 수정 가능하며(구조 재설계 불필요), 재작성 부담은 REQ-3·REQ-5·REQ-6·REQ-7 문면 보강과 FORBID-3·4·6 의 when/detect 정정, touches 3줄 추가, blocks 한 단어 추가 수준이다.
