# 2차 감사 — Foundation 배치 (F1 · F2a · F2b · F4 · F5 · F6)

> 감사일: 2026-08-03 · 감사관: task-auditor
> 대상: `docs/tasks/F1.md` `F2a.md` `F2b.md` `F4.md` `F5.md` `F6.md`
> 기준: `docs/02-task-contract-spec.md` (원칙 2.5 · R-6 · R-7 포함) · `docs/01-prd.md` · `docs/03-task-dag.md`
> 대조 참조: `C7.md` `O2.md` `C4.md` `D1a.md` `D1b.md` `D4.md` `W2.md` `W3.md` `W4.md` `W5.md` · `scripts/tasks_manifest.py` · `scripts/normalize_ids.py`

**판정 요약**

| 태스크 | 판정 | 한 줄 |
|---|---|---|
| F1 | **REVISE** | 게이트 파일 verdict 어휘가 소비자(D1b·F4)와 3중 불일치 · 초기 baseline 상한 부재로 레지스트리 검사 자체가 자기무효화 · 기존 검증기(`scripts/*.py`)를 승계하지 않고 재구현하면서 오탐 회귀 픽스처 0건 |
| F2a | **REVISE** | no-op down 마이그레이션이 REQ-7을 통과 · F2b가 코어 테이블에 컬럼을 추가하는 순간 F2a의 화이트리스트/6테이블 검사가 깨지는데 F2b는 그 파일을 소유하지 않음 |
| F2b | **REVISE(조건부 차단)** | REQ-4 뷰 진리표가 `force_public` 으로 `hidden_legal`·`hidden_request` 를 뒤집도록 규정 — C7 FORBID-5·6과 정면 충돌하는 법적 리스크 · `public_venue.sql` 2중 소유 · C7/O2가 요구하는 테이블 3종 부재 |
| F4 | **REVISE** | REQ-3·REQ-8·FORBID-2·done_when 이 참조하는 선행 산출물 경로가 전부 실재하지 않음(`docs/discovery/D1/*`, `docs/discovery/D4/*.yaml`) · FORBID-6이 보호하는 경로에 D4 정본(`packages/legal/**`)이 빠짐 |
| F5 | **REVISE** | 응답 필드 집합을 아무 REQ도 고정하지 않아 `{slug,name}` 만 반환해도 전 REQ 통과 · 요금제 조회 경로 부재로 W3·F6이 착수 불가 · 드라이버 5종 부인목록은 `@vercel/postgres` 로 우회 |
| F6 | **REVISE** | `period_pass` 확정 가격(C4 산출)이 영구히 `unknown`→미표시로 접힘 — 원칙 2.5의 정확한 재발 · 홀드아웃/스모크의 데이터 원천을 보장하는 의존이 없음 |

---

## F1-REPO-SCAFFOLD — REVISE

이 배치에서 가장 중요한 계약이며, 실제로 1차 감사 대비 크게 개선되었다(P7 자기차단 2건 해소, discovery job 신설, 위반 픽스처 메타테스트 도입). 그러나 **F1이 새로 떠맡은 "정본 파일 소유" 책임 — 게이트 파일 스키마 · ID 레지스트리 · DAG 검증기 — 세 가지가 모두 소비자 계약과 대조되지 않은 채 작성**되었다. 이후 40개 계약의 detect가 이 위에 얹히므로 결함의 파급이 크다.

### 규격 위반

| 체크리스트 항목 | 판정 | 위치·내용 |
|---|---|---|
| traces_to 가 PRD에 없는 ID 참조 | 통과 | `[H3, G1, G3]` 전부 PRD §3·§4 실재 |
| depends_on 순환·미존재 | 통과 | (기계 검증 완료) |
| gate 선행 배치 | 통과 | `gate: null`, Phase 1 규칙 부합 |
| PR 2개 이상으로 나뉘어야 함 | 통과 | 스캐폴드 단위 1개. 중간 상태 분할 불가(§4 "쪼개면 동작 안 함") |
| 주관적 형용사 | 통과 | 없음 |
| acceptance 기계 검증 불가 | **부분 실패** | REQ-5: statement는 "각 job(8개)"이 픽스처에서 exit≠0 이라 하고 acceptance는 **6개만** 검증. python·dag-check의 오탐지 실패는 검증되지 않음 → statement가 acceptance보다 넓다 (R-2/R-3) |
| REQ에 '그리고' 복수 요구 | **부분 실패** | REQ-7이 (a) ids.yaml 3필드 열거 + (b) 게이트 파일 5종 스키마 존재 — 두 산출물의 서로 다른 검증. R-4상 분리 대상 |
| requirements 8 초과 | 통과 | 정확히 8 |
| forbid 0개 / 7개 이상 | 통과 | 6개 |
| when 없음·'항상' | 통과 | 6건 전부 조건부 |
| detect 없음 / 전부 코드리뷰 | 통과 | 전부 CI job |
| because 실패 시나리오 | 통과 | 6건 전부 구체적 |
| R-6 (표집·홀드아웃) | 해당 없음 | 품질 임계 REQ 없음. 단 REQ-8 baseline은 사실상 임계이며 **사전 설정 무방비**(아래 A-2) |
| R-7 (실환경 하한) | **통과** | REQ-5(실제 GitHub Actions 런을 API로 조회) · REQ-4(실제 Playwright 기동)로 픽스처 세계 탈출 |
| out_of_scope / touches / rollback | 통과 | 3종 정의됨. touches는 열거형이며 `src/**` 류 광역 지정 없음 |
| block_merge 인데 집행 CI 없음 | 통과 | 자기 자신이 CI 소유자 |
| 계약이 자기 PR 차단 | **실패 1건 재발** | FORBID-6 (아래 D-1). FORBID-4·5의 P7은 해소됨 |

### 공격 결과

**A 악의적 준수**

- **A-1 (치명) — 초기 baseline 무제한.** REQ-8은 "docs/tasks 전수 위반 총건수 ≤ `baseline.json`" 이고, done_when은 "전수 위반 수를 baseline.json 에 **최초 기록**"이다. FORBID-5는 baseline 상향을 막지만 `base 에 파일이 없는 최초 도입 커밋은 검사 대상에서 제외` 한다. 즉 **F1 PR이 스스로 정하는 초기값에 상한이 없다.** 실제로 이 값은 0이 될 수 없다: 8개 계약(`D1a, D1b, W7, W8, O1, O2, F6, DS4`)이 `KM-price-coverage` `KM-qualified-lead` `KM-override-public-ratio` `NSM-qualified-lead` 를 traces_to에 쓰는데, 이 ID들은 PRD·Lean Canvas 어디에도 **ID로 존재하지 않는다**(canvas §7은 "가격 커버리지율" 이라는 자연어 행뿐). F1의 out_of_scope는 "PRD·Lean Canvas 에 없는 신규 지표를 ids.yaml에 창설하는 것" 을 금지하므로, F1은 (i) 자기 out_of_scope를 어기고 ID를 창설하거나 (ii) 위반 8건을 baseline에 기록해 **영구 면죄**하는 두 길밖에 없다. 규격 §3.4 안티패턴 "사후 완화만 막고 사전 설정은 무방비"의 교과서적 사례.
- **A-2 — 총건수 단일 카운터.** baseline이 위반 **총합** 하나라서, 한 계약의 위반을 고치고 다른 계약에 새 위반을 넣어도 통과한다. 위반 유형별/파일별 baseline이 아니면 잠금이 아니다.
- **A-3 — 빈 앱이 FORBID-3을 만점 통과.** FORBID-3(정적 렌더 기본값)의 detect는 "`next build` 라우트 요약에서 전 라우트가 Static/ISR"인데, **라우트가 0개면 전건 통과**한다. REQ 어디에도 "apps/web 이 최소 N개의 Static 라우트를 갖는다"가 없다. 숨김·차단형 FORBID의 짝 REQ 부재(원칙 2.5)와 같은 구조.
- **방어됨:** REQ-1의 "집합 포함 검사, `=== 4` 비교 금지" 명시, REQ-3·FORBID-1의 위반 픽스처 강제, FORBID-6의 스텁 금지 — 세 가지는 "아무것도 안 하는 CI"를 실제로 막는다. 이 부분은 잘 설계되었다.

**B 조건 회피**

- **B-1 — FORBID-2의 `when` 이 detect보다 좁다.** when은 "**CI job 이 red 인 PR** 의 diff에 `continue-on-error`·`|| true` 신규 추가"인데, detect는 "diff 스캔으로 신규 추가 시 **무조건** 실패"다. 계약 문면상 **green PR에서 미리 `|| true` 를 심어두는 것은 합법**이며, 그 다음 PR부터 검사는 영구 무력화된다. detect가 실제로는 더 넓어 우연히 막히지만, 개발 에이전트는 계약 문면을 학습한다 — 그리고 계약이 허용한다고 읽은 행위를 CI가 막으면 "CI가 계약보다 엄격하다"는 우회 관용구를 학습한다.
- **B-2 — FORBID-1의 금지 모듈이 폐쇄 열거 5종.** `packages/db · pg · postgres · drizzle-orm · @prisma/client`. Vercel 배포 전제에서 가장 자연스러운 선택인 **`@vercel/postgres` · `@neondatabase/serverless` · `knex` · `sequelize` · `kysely` 는 전부 통과**한다. F2a FORBID-3이 스스로 "정규식 금지는 이름만 바꾸면 뚫린다 — 폐쇄 화이트리스트만이 막는다"고 논증했는데, F1은 정반대 방향(부인목록)을 쓴다. 규칙은 "packages/api 외 어떤 패키지도 DB 클라이언트류 의존을 `package.json` 에 선언할 수 없다"는 **허용목록**이어야 한다.
- **B-3 — FORBID-4의 `touches` 밖 판정.** F1은 `.github/CODEOWNERS` 를 touches에 넣었으나 **어떤 경로에 어떤 소유자를 등록해야 하는지 REQ가 없다**(rollback에 "CODEOWNERS 규칙 3건"이라는 숫자만 등장). 그런데 F2a·F2b(`packages/db`), F5(`packages/api`), F6(`packages/price-state`)의 FORBID 4건이 **"해당 경로 CODEOWNERS 승인 리뷰"를 유일한 예외 경로로 지정**한다. 그 경로들은 F1 시점에 존재하지 않으며, 하류 계약들의 touches에는 `.github/CODEOWNERS` 가 없어 **자기 소유자를 등록할 수 없다.** 결과: 승인 게이트 4건이 전부 집행 불가 또는 임의 통과.

**C 탐지 무력화**

- **C-1 (치명) — 게이트 파일 verdict 어휘 3중 불일치.** F1 REQ-7은 `docs/gates/G*.md` 의 고정 스키마를 `verdict ∈ {undecided, pass, fail, partial}` 로 정한다. 그런데 그 파일을 실제로 쓰는 D1b는 `proceed / editor_augment / axis_excluded / inconclusive` 를 기록하고(D1b REQ·FORBID 전부 이 어휘), 그 파일을 읽는 F4 REQ-2는 `proceed / editor_augment / axis_excluded / undecided` 를 파싱한다. **세 계약이 같은 파일에 대해 서로 다른 어휘를 쓴다.** F1의 `--check registry` 스키마 검증이 실제로 동작하면 D1b의 PR이 차단되고, 동작하지 않으면(per_axis 표의 값이 스키마 밖이라면) F1 REQ-7의 검증은 장식이다. F1이 게이트 정본의 소유자이므로 이 어휘를 확정할 책임은 F1에 있다.
- **C-2 (치명) — dag-check가 기존 검증기를 승계하지 않는다.** 리포에는 이미 `scripts/tasks_manifest.py`(ID 오참조 · **폐기 태스크 참조** · blocks↔depends_on 역방향 · 순환)와 `scripts/normalize_ids.py` 가 있고, 개발 중 3종 오탐(개정 노트 본문의 "폐기" 문구 오인 → `DEPRECATED_TITLE`/`DEPRECATED_STATUS` 를 **head 영역 + 제목/상태 줄로 한정**해 해결 / 인라인 리스트 뒤 주석 미인식 → `(?:#.*)?` 로 해결 / 폐기 태스크의 역방향 blocks까지 요구하는 자기모순 → `dep in live` 로 해결)을 이미 교정했다. F1 REQ-8은 이 스크립트를 **한 번도 언급하지 않고** `tools/dag-check`(node)를 신규 요구하며, FORBID-4의 touches 화이트리스트에 `scripts/**` 가 없어 **F1은 기존 검증기를 승계·폐기·이관할 수도 없다.** 결과: 규칙이 다른 검증기 2개가 공존하고, 이미 해결된 3종 오탐이 node 재구현에서 재발한다.
- **C-3 — 오탐 회귀 픽스처가 계약에 없다.** REQ-8 acceptance의 픽스처 세트는 "정상 1건 + 위반 5종 각 1건"이다. **정상 계약 1건으로는 위 3종 오탐(폐기 문구 오인 · 주석 뒤 리스트 · 폐기 태스크 역방향)을 하나도 재현하지 못한다.** "없는 결함을 만들어내는 검증기"는 통과하고, 그 오탐은 baseline에 흡수되어(A-1) 영구 고착된다. 미탐 픽스처만 있고 오탐 픽스처가 없는 것은 규격 원칙 3의 절반만 만족한 것이다.
- **C-4 — REQ-8 (b)가 폐기 ID 참조를 잡지 못한다.** 규칙은 "`depends_on/blocks ⊄ 03-task-dag.md` 정본 ID 레지스트리"인데, 그 레지스트리 블록에는 `D1-PRICE-AVAILABILITY-SPIKE` `F2-SCHEMA` `F3-DESIGN-TOKENS` `DS2-TOKEN-BUILD` 가 "신규 참조 금지"라는 **자연어 주석과 함께** 등재되어 있다. 집합 포함 검사만 하는 구현은 폐기 ID 참조를 전부 통과시킨다 — 기존 파이썬 스크립트는 잡는 위반이다(탐지 능력 후퇴).
- **C-5 — gate 필드 형식이 계약 간 2종.** `gate: G1`(F4·O1·O2) 와 `gate: [G1, G3]`(C1~C7·F6·W1~W4). REQ-8 (e)는 "gate 값 ⊄ 파일명 5종"만 말하고 배열 처리를 규정하지 않는다. 배열을 문자열로 읽는 구현은 전부 위반으로 판정(오탐 대량) 또는 전부 스킵(미탐)한다.
- **C-6 — 게이트 "선행 배치" 검사가 없다.** 규격 §5 체크리스트의 `gate 를 무시하고 게이트 이후 작업을 선행 배치` 는 REQ-8의 5종 어디에도 없다. gate=null인 태스크가 gate=[G1,G3]인 태스크에 의존해도(예: 없음, 그러나 F6은 gate=[G1,G3]인데 이를 depends_on 하는 W2·W3의 gate는 [G1,G2,G3]로 우연히 맞음) 검출되지 않는다. **전이적 게이트 정합성**은 사람이 눈으로 볼 수 없는 종류의 검사이며, 자동화 대상 1순위인데 빠져 있다.

**D 지름길 유도**

- **D-1 (P7 재발) — FORBID-6이 F1 자신의 PR을 red로 만든다.** FORBID-6의 when은 "`scripts/discovery/validate_d*.py` 중 **계약이 요구하는** 스크립트가 존재하지 않거나, 항상 exit 0 을 반환하는 경우"다. F1 머지 시점에 D1a·D1b·D2·D3·D4는 아직 머지되지 않았고(F1이 그들을 `blocks`), 각 계약은 `validate_d1a.py` `validate_d1b.py` `validate_d2.py` `validate_d3.py` `validate_d4.py` 를 요구한다. 문면대로면 F1의 discovery job은 자기 PR에서 실패한다. 개발 에이전트가 택할 유일한 해석은 "**아직 요구하는 계약이 머지 안 됐으니 없어도 통과**" 이며, 그 순간 FORBID-6은 자기가 막으려던 "영구 초록 job" 그 자체가 된다. FORBID-4·5에서는 예외를 규칙 안으로 넣었는데(최초 도입 파일 · base 부재 커밋) **FORBID-6에만 그 처리가 빠졌다.**
- **D-2 — CI 예산 25분 총량이 하류에서 반드시 깨진다.** REQ-6은 "8개 job 예산 합계 ≤ 25". 그런데 F2a(`db-schema`), F4(`ontology`), F5(`api-integration`), F6(`price-state`), C7(`public-surface`) 이 각각 job을 추가하며 전부 `.github/ci-budget.json` 을 touches에 넣는다. F2a REQ-2는 **PostGIS 5만행 시드 + EXPLAIN**, F5 REQ-6은 **컨테이너 기동 + 전 마이그레이션**이다. 12개 job을 25분에 넣는 유일한 길은 (i) 라벨+승인으로 상한을 올리거나(FORBID-5의 예외 경로 상시화) (ii) 다른 job의 timeout을 깎는 것이다. **총량 상한을 두면서 배분 규칙을 두지 않으면, 상한은 하류의 상시 우회 대상이 된다.**
- **D-3 — REQ-5의 픽스처 브랜치는 사람이 만든다.** `ci-fixture/violations` 브랜치의 내용이 계약에 고정되어 있지 않다. 6개 job을 red로 만드는 최소 픽스처만 넣으면 통과하며, 그것이 실제 위반 유형을 대표하는지 아무도 판정하지 않는다. done_when의 6종 목록이 유일한 근거인데 done_when은 기계 판정 대상이 아니다.

**E DAG 정합성**

- `depends_on: []` 타당(최초 태스크). `blocks` 12건은 전부 F1의 CI·워크스페이스를 실제로 필요로 한다.
- `blocks` 주석("해당 계약들의 depends_on 에 F1 추가가 **상신되어 있으며**, 미반영분은 REQ-8 baseline 에 계상된다")이 문제다. **양방향 불일치를 baseline으로 흡수하겠다는 선언**이며, DAG 정정 #9가 요구한 "정합성 검증"의 목적을 계약 본문에서 스스로 무효화한다. (실제로는 기계 검증 통과 상태이므로 이 주석은 불필요하게 구멍만 만든다 — 삭제 대상.)
- 순환 없음. 게이트 건너뜀 없음.

**F 존재 이유**

- `why` 는 F1의 실제 산출물과 정합한다. 다만 `traces_to: [H3, G1, G3]` 중 **H3의 검증에 F1이 기여하는 경로는 FORBID-3(정적 렌더 기본값) 하나**인데, A-3에서 보인 대로 그 FORBID는 라우트 0개인 스캐폴드에서 공허하게 통과한다. 즉 traces_to H3은 현재 계약 상태로는 **참조만 걸린 것**에 가깝다. 최소 Static 라우트 REQ가 추가되면 해소된다.

### 필수 수정 사항

1. **REQ-7의 verdict enum** 을 `{undecided, proceed, editor_augment, axis_excluded, inconclusive}`(D1b 정본 어휘) 또는 게이트별 어휘표로 확정하고, **per_axis 표의 값 집합까지 스키마에 명시** — 현재 F1·D1b·F4가 같은 파일에 3종 어휘를 쓴다.
2. **REQ-8에 `scripts/tasks_manifest.py` 승계 조항 추가** (기존 규칙 4종 + 폐기 태스크 참조 검출을 이관하고 파이썬 스크립트를 제거하거나, 파이썬 스크립트를 CI 진입점으로 승격). touches에 `scripts/**` 추가. 검증기 2개 공존을 금지.
3. **REQ-8 acceptance에 오탐 회귀 픽스처 3종 필수화** — (a) 개정 노트 본문에 "폐기" 문구가 있으나 살아있는 계약, (b) 인라인 리스트 뒤 `# 주석` 이 붙은 계약, (c) 폐기 태스크를 depends_on 하는 살아있는 계약의 역방향 요구. 각각 **0건 판정**되어야 exit 0.
4. **baseline 초기값 상한을 계약 본문에 못박을 것** — 예: "최초 baseline은 유형별로 기록하며, `traces_to` 유형은 0이어야 한다. 0이 불가능한 경우 F1을 머지하기 전에 `KM-*`·`NSM-*` ID를 PRD/Lean Canvas에 확정하는 별도 PR을 선머지한다"(D1 → D1a/D1b 분할과 동일한 처방). 총건수 단일 카운터를 유형별 카운터로 교체.
5. **`KM-price-coverage` `KM-qualified-lead` `KM-override-public-ratio` `NSM-qualified-lead` 의 출처 확정** — 8개 계약이 이미 참조 중이다. `KM-qualified-lead`(DS4) 와 `NSM-qualified-lead`(O1·O3·W6)는 같은 North Star의 두 이름이다. 하나로 통일.
6. **FORBID-6에 최초 도입 예외를 규칙 안으로 명시** — "해당 Discovery 계약이 **origin/main 에 머지된 경우에 한해** 그 계약이 선언한 validate 스크립트의 존재·비스텁을 요구한다". 그렇지 않으면 F1이 자기 PR을 차단하거나(P7 3회차) 규칙이 공허해진다.
7. **FORBID-1을 부인목록 → 허용목록으로 전환** — "packages/api 외의 어떤 워크스페이스 패키지도 DB 드라이버(=`pg`류 + `@vercel/postgres` + `@neondatabase/serverless` + 쿼리빌더/ORM)를 `dependencies` 에 선언하지 않는다"를 `package.json` 단위로 검사. 모듈명 열거는 이름을 바꾸면 뚫린다(F2a FORBID-3의 논증과 동일).
8. **CODEOWNERS 규칙을 REQ로 승격** — 최소 `packages/db` `packages/api` `packages/price-state` `.github/**` `docs/registry/**` `tools/dag-check/**` 6개 경로에 소유자가 등록되고, 소유자가 없는 경로에 대한 승인 게이트를 선언한 계약이 있으면 dag-check가 실패하도록. (하류 4건의 유일한 예외 경로가 여기에 걸려 있다.)
9. **REQ-5 statement/acceptance 정합** — 8개 전부를 검증하도록 acceptance를 확장하거나, statement를 6개로 축소.
10. **FORBID-2의 `when` 에서 "CI red 인 PR" 한정을 제거** (detect와 일치시킬 것). **FORBID-3에 짝 REQ 추가** — "apps/web 이 Static/ISR 라우트를 최소 2개 포함하고 `next build` 요약에 나타난다"(원칙 2.5).
11. **REQ-8에 게이트 전이 정합성 검사 추가** — "gate=G_i 인 태스크를 depends_on 하는 태스크의 gate 는 G_i 를 포함해야 한다".
12. **`blocks` 주석의 "미반영분은 baseline에 계상" 문구 삭제.**

---

## F2a-CORE-SCHEMA — REVISE

### 규격 위반

| 항목 | 판정 | 내용 |
|---|---|---|
| traces_to | 통과 | `[H1, H2, S1]` 실재 |
| requirements 8 초과 | 통과 | 7개 |
| forbid 개수 | 통과 | 5개, 5요소 전부 충족 |
| acceptance 기계 검증 | **부분 실패** | REQ-1 "마이그레이션에서 덤프한 스냅샷을 기대값으로 사용하면 실패로 간주한다" — **판정 주체·수단이 없다**. 사람이 diff를 보지 않으면 알 수 없으며, 규격 §3.4의 `detect: 코드리뷰` 안티패턴과 같은 급 |
| R-6 | 해당 없음 | 품질 임계 REQ 없음 |
| R-7 | 통과 | REQ-2가 실제 PostGIS 컨테이너(mock 금지) + 5만행 |
| touches/out_of_scope/rollback | 통과 | |
| 자기 PR 차단 | **해소 확인** | FORBID-1의 when에 "동일 버전 down 스크립트의 되돌림용 DROP · base에 파일이 없는 최초 도입은 검사 대상이 아니다" 가 규칙 **안으로** 들어왔다. P7 2건 중 F2 항목은 정상 처리됨 |
| 제목/본문 불일치 | 경미 | 제목은 5테이블 열거, REQ-1·artifacts는 6테이블(`venue_need_tag` 누락) |

### 공격 결과

- **A 악의적 준수 — 결함 2건.**
  - **A-1 (치명) — no-op down이 REQ-7을 통과한다.** REQ-7은 `up → down → up` 후 덤프 sha256이 "최초 up 직후"와 같을 것만 요구한다. **down 스크립트를 빈 파일로 두면** down 후 스키마가 그대로이고, 이어지는 up은 idempotent하게 작성하면(`CREATE TABLE IF NOT EXISTS`) 성공하며, 덤프는 당연히 동일하다 → **통과**. 그런데 F2a·F2b의 rollback 절차 전체가 `db:migrate:down` 이 실제로 되돌린다는 전제 위에 있다. 필요한 것은 "down 직후 덤프가 **F2a 이전 덤프**와 sha256 일치" 라는 반대 방향 assert다.
  - **A-2 — CHECK 제약이 FORBID의 detect에만 존재한다.** FORBID-2 detect가 `CHECK(price_per_session IS NULL OR price_per_session > 0)` 의 존재를 assert하는데, 이 제약은 **어느 REQ에도 없다**(REQ-3은 CHECK 2종만 규정). 요구사항이 금지사항의 탐지 수단 안에 숨어 있으면 구현자는 REQ만 읽고 누락한다.
- **B 조건 회피 — 결함 1건.** FORBID-3의 when은 "**6개 테이블에** 화이트리스트 밖 컬럼·ENUM 라벨 추가". 성별 축을 스키마에 넣고 싶은 구현자는 **7번째 테이블**(`venue_profile`, `venue_attribute` 등)을 만들면 된다 — REQ-1의 "정확히 6개" 검사가 있으므로 이 경로는 막히지만, 그 검사가 **information_schema 전체 테이블 수를 세는지, 하드코딩 목록의 포함 여부를 보는지** 계약이 규정하지 않았다. 후자로 구현되면(그리고 F2b가 테이블을 5개 더 추가해야 하므로 **후자로 구현될 수밖에 없다**) 7번째 테이블은 자유롭게 추가된다.
- **C 탐지 무력화 — 결함 1건(분할 경계).** F2b는 코어 테이블에 **컬럼 3개를 추가**한다(`venue.visibility`, `price_plan.visibility`, `price_plan.confidence`). F2a REQ-6은 "6개 테이블의 **전체 컬럼 집합**이 `allowed-columns.core.json` 의 부분집합"을 매 PR CI에서 검사한다. F2b의 touches에는 `packages/db/test/allowed-columns.core.json` 도 `packages/db/test/core/**` 도 **없다**. 결론: **F2b를 머지하는 순간 F2a의 `test:schema-core` 가 red가 되고, F2b는 그것을 고칠 권한이 없다.** 규격 §4의 "쪼갠 두 PR이 항상 같이 머지되어야 한다 → 하나로 둔다"에 저촉되지는 않지만(F2a 단독 중간 상태는 정상 동작한다), **분할선이 파일 소유권과 어긋나 있다.**
- **D 지름길 유도 — 결함 1건.** 막혔을 때의 최단 경로는 `allowed-columns.core.json` 에 컬럼을 미리 넉넉히 등재해 두는 것이다. FORBID-3은 화이트리스트 **변경**에 CODEOWNERS 승인을 요구하지만 **최초 작성 내용에는 아무 상한이 없다**(F1 A-1과 동일한 사전 설정 무방비). 화이트리스트에 `target_audience`, `gender_hint` 를 처음부터 넣어두면 FORBID-3은 100% 준수된다. 규격 §3.4: "잠금 대상의 허용 범위를 계약 본문에 못박아라" — 현재 계약 본문에 못박힌 컬럼은 REQ-1의 필수 목록뿐이고 **금지 컬럼 목록이 없다**.
- **E DAG 정합성 — 이상 없음.** `depends_on: [F1]` 필요(워크스페이스·CI). blocks 9건 전부 스키마를 실제로 소비. 순환 없음. gate=null 타당.
- **F 존재 이유 — 통과.** `why` 대로 C4 출력 6필드(REQ-4)가 C4 계약의 산출 필드와 정확히 대응한다(`price_unit_type` 4값 · `price_per_month_krw` · `period_days` — C4 REQ-5·I3와 일치 확인). traces_to H1·H2·S1 모두 이 스키마 없이는 측정 불가.

### 필수 수정 사항

1. **REQ-7에 역방향 assert 추가** — "down 직후 덤프 sha256이 F2a 적용 **이전** 덤프와 일치". no-op down 차단.
2. **REQ-1의 "정확히 6개" 판정 방법 명시** — "도메인 스키마 `core` 네임스페이스의 테이블 목록이 하드코딩 6개와 **집합 동등**" 처럼 F2b가 테이블을 추가해도 깨지지 않는 형태로. 동시에 FORBID-3의 대상을 "core 스키마의 모든 테이블"로 확장(7번째 테이블 우회 차단).
3. **`allowed-columns.core.json` 의 금지 축을 계약 본문에 명문화** — 최소 "성별·연령대 추정·개인 식별자 계열 컬럼명은 화이트리스트 최초 작성 시에도 등재 불가" 를 FORBID-3의 when에 편입.
4. **REQ-3에 `price_per_session > 0` CHECK을 REQ로 승격** (현재 FORBID-2 detect에만 존재).
5. **F2a↔F2b 분할선 정정** — `allowed-columns.core.json` 을 F2b touches에 추가하거나(단 FORBID-3의 승인 게이트 유지), 코어 테이블에 붙는 3개 컬럼을 F2a가 NULL 허용으로 선반영하고 F2b는 제약·뷰·롤만 담당하도록 경계 재조정.
6. **REQ-1 acceptance의 "스냅샷 기대값 금지"에 탐지 수단 부여** — 예: "기대 목록 파일과 `pg_dump` 출력 간 편집 거리 검사" 또는 최소한 CODEOWNERS 리뷰 항목으로 강등하고 그 사유를 명시(§3.4).
7. 제목의 테이블 열거에 `venue_need_tag` 추가(경미).

---

## F2b-QUALITY-SCHEMA — REVISE (조건부 차단 — 아래 1·2 미해소 시 REJECT)

### 규격 위반

| 항목 | 판정 | 내용 |
|---|---|---|
| traces_to | 통과 | `[H4, G4, S4]` 실재 |
| requirements / forbid 개수 | 통과 | 8 / 6 (경계값) |
| when·because·detect·on_violation | 통과 | 6건 전부 5요소 충족 |
| **detect 대상 실재** | **실패** | 아래 C-1: C7·O2가 요구하는 `visibility_change_event` · `review_audit_log` · override의 `revoked_at`/`source_url`/`entered_by` 가 **어느 계약에도 없다**. F2b가 마지막 스키마 태스크다 |
| R-7 | **부분 실패** | 전 REQ가 픽스처 기반. F2a REQ-2와 달리 "실제 PostGIS 컨테이너" 요구가 명시되지 않아 mock/sqlite 대체 여지가 남는다 |
| out_of_scope / rollback / touches | 통과 | |
| PR 1개 원칙 | **경고** | `packages/db/views/public_venue.sql` 을 **C7도 touches에 갖고 "그 뷰는 C7 소유"라고 선언**한다(C7 §설계 전제·touches). 한 파일에 소유자 2명 |

### 공격 결과

- **A 악의적 준수 — 결함 1건(치명, 법적 리스크).** REQ-4의 뷰 조건은 문면 그대로다:
  `(override.decision='force_public') OR (override 없음 AND visibility='public')`
  **`force_public` 이 앞에 OR로 놓여 있어, `visibility='hidden_legal'` 또는 `'hidden_request'` 인 업체도 오버라이드 한 줄로 공개된다.** 이는 C7 FORBID-6("hidden_request·hidden_legal 을 override로 public 전이 금지")과 C7 FORBID-5(medical 가드레일 실패 시 force_public 이어도 비공개)에 **정면으로 반한다**. F2b의 acceptance (b)는 `force_hidden` 만 검사하므로 이 구멍은 **테스트를 전부 통과한다.** 삭제 요청으로 내린 업체가 어드민 오버라이드로 되살아나는 경로가 스키마 정본에 박히는 것이며, 정정 #2가 ENUM을 정본으로 삼은 이유(삭제요청 비공개와 품질 비공개의 구분)를 뷰 단계에서 다시 소멸시킨다.
- **B 조건 회피 — 결함 1건.** FORBID-1의 when은 "뷰 SQL이 **두 테이블과의 조인을 포함하지 않거나 WHERE 절 없이** base 테이블 SELECT". 위 A의 구현은 **조인도 있고 WHERE도 있다** → FORBID-1을 100% 준수하면서 hidden_legal을 노출한다. 정적 문자열 검사(조인 대상 2테이블 존재 + WHERE 존재)는 **뷰의 의미가 아니라 형태만** 본다.
- **C 탐지 무력화 — 결함 3건.**
  - **C-1 (치명) — 하류가 요구하는 객체 3종 부재.** C7의 "선행 조건 — F2 스키마 개정(미충족 시 착수 금지)" 표는 `quality_verdict` · `review_override` · `visibility_change_event` 를 요구한다. F2b가 만드는 것은 `venue_quality_judgement` · `venue_visibility_override` 이며(**이름 불일치 2건**), `visibility_change_event` 는 **아예 없다**. C7 REQ-7(전이 30건 → 이벤트 30행)과 DAG 정정 #3(재검증 상한·무효화 경로)이 이 테이블 위에 서 있고, C7의 out_of_scope는 "본 태스크는 마이그레이션을 작성하지 않는다(뷰 제외)"다. **아무도 만들지 않는다.** 마찬가지로 O2는 `review_audit_log`(REQ-2·FORBID-5), override의 `source_url`/`entered_by`(FORBID-4 "DB 제약"), `revoked_at`(rollback)을 전제하는데 F2b의 화이트리스트 컬럼 집합에 없고, O2의 out_of_scope는 "DB 스키마 변경 — F2b 소관. 없으면 **착수 중단**"이다. 현 상태로 F2b를 머지하면 **C7과 O2가 계약대로 영구 착수 불가**다.
  - **C-2 — ENUM 값 수 불일치.** F2b REQ-1은 5값(`needs_review` 추가), DAG 정정 #2와 C7 §선행조건은 4값이다. `needs_review` 를 **쓰는 주체가 없다** — C7 REQ-1은 `public↔hidden_quality` 전이만 소유하고, C7 REQ-4의 reason_code↔visibility 대응표에도 `needs_review` 행이 없다. 값이 있는데 생산자도 소비 규칙도 없으면, 그 값은 나중에 "임시 상태"로 쓰이며 판정 우회로가 된다.
  - **C-3 — FORBID-4의 detect가 부분 검사.** "admin_writer 의 `venue.visibility` UPDATE가 42501" 만 assert한다. `pipeline_writer`(C7 롤)가 `venue_visibility_override` 에 INSERT할 수 있는지는 검사하지 않는다. 판정 주체가 오버라이드 테이블에 쓰면 C7 REQ-1의 "같은 모듈이 review_override 에 쓰지 않는다"가 DB 레벨에서 무방비다. FORBID-4의 because가 말하는 위험은 **양방향**인데 detect는 한 방향뿐이다.
- **D 지름길 유도 — 결함 1건.** REQ-8의 `lead_event` 컬럼 집합 **동등 비교**(⊆ 가 아니라 ==)와 FORBID-5의 화이트리스트가 충돌 가능하다. W6/W9가 필요로 하는 컬럼(예: `experiment_arm`, `referrer_kind`)이 하나라도 생기면 F2b의 테스트가 red가 되고, 최단 경로는 **W6/W9가 이벤트를 JSON 컬럼 하나에 밀어넣는 것**이다. 화이트리스트에 `payload jsonb` 가 없어야 이 우회가 막히는데, 계약은 그것을 금지하지 않는다(개인정보 축적 방지라는 FORBID-5의 목적이 jsonb 한 컬럼으로 우회된다).
- **E DAG 정합성 — 결함 1건.** `blocks` 13건은 타당하고 순환도 없다. 그러나 **`public_venue.sql` 의 소유권이 F2b와 C7에 이중 배정**되어 있다. F2b가 먼저 머지되고 C7이 REQ-3(진리표·컬럼 매니페스트·충돌 시 NULL)대로 같은 파일을 다시 쓰면, F2b의 `test:public-view`(REQ-4·5)와 C7의 `test:public-view` 가 **같은 이름으로 서로 다른 기대값을 갖는다.** 되돌림 단위도 엉킨다(규격 원칙 1).
- **F 존재 이유 — 부분 충족.** `why`("C7의 단일 쓰기 경로와 O2의 2인 승인이 충돌하지 않게 분리 저장")는 정정 #4의 처방과 정확히 일치하고, REQ-2·REQ-3·FORBID-4의 조합은 실제로 충돌을 해소한다 — **이 부분은 이 배치에서 가장 잘 설계된 요구사항이다.** 다만 C-1(테이블 3종 부재)과 A(뷰 진리표 오류) 때문에 **해소가 절반만 전달된다.** traces_to H4·G4·S4는 정합(리드 전환·품질 게이트·리드 계측 스키마).

### 필수 수정 사항

1. **REQ-4의 뷰 조건식을 C7 §설계 전제의 진리표로 교체** — `hidden_legal`·`hidden_request` 는 오버라이드 불가, `force_public` 은 `hidden_quality`(및 medical 가드레일 통과) 조건에서만 유효. **acceptance에 "force_public × hidden_legal/hidden_request 픽스처 각 5건이 뷰 조회 0건"을 추가**(현재 `force_hidden` 만 검사).
2. **`public_venue.sql` 의 단일 소유자 확정** — F2b(스키마)와 C7(집행) 중 하나. C7이 소유한다면 F2b REQ-4·5와 FORBID-1을 "뷰 소비 계약 검증"이 아니라 "뷰가 참조할 테이블·롤 제공"으로 축소하고 touches에서 제거. F2b가 소유한다면 C7의 touches·REQ-3을 정정 요청.
3. **`visibility_change_event` 테이블을 F2b REQ로 신설** (C7 REQ-7·DAG 정정 #3의 유일한 근거지).
4. **`review_audit_log` · override의 `source_url`/`entered_by`/`revoked_at` 을 F2b 화이트리스트와 REQ에 편입** — 또는 O2 계약의 해당 REQ/FORBID를 함께 정정. 현재는 O2가 영구 착수 불가.
5. **테이블명 정본화** — `venue_quality_judgement`/`venue_visibility_override` 로 통일하고 C7 §선행조건 표(`quality_verdict`/`review_override`)의 정정을 상신. 하류 detect가 SQL 식별자 grep 기반이므로 이름 1글자 차이가 탐지 전체를 공허하게 만든다.
6. **ENUM 4값 vs 5값 확정.** `needs_review` 를 유지한다면 **생산자 태스크와 reason_code 대응을 계약에 명시**, 아니면 삭제(정정 #2 정본은 4값).
7. **FORBID-5 화이트리스트에 "자유형 payload(jsonb·text blob) 컬럼 금지"를 when에 편입**(D 우회 차단).
8. **FORBID-4 detect에 역방향 추가** — `pipeline_writer` 의 `venue_visibility_override` INSERT가 42501.
9. **REQ 전건에 "실제 PostgreSQL 16 + PostGIS 컨테이너" 명시**(F5 REQ-6과 동일 수준, R-7).

---

## F4-NEED-TAG-ONTOLOGY — REVISE

> 1차 감사 REJECT 후 재작성본이며, 재작성 노트는 "**존재하지 않는 선행 산출물 참조 제거**"를 첫 변경사항으로 명시한다. 그런데 아래 C-1·C-2에서 보듯 **선행 산출물 경로 참조가 4곳에서 여전히 틀렸다.** 지적된 결함 클래스가 그대로 남은 채 "반영"으로 표기된 것이 이 계약의 가장 큰 문제다.

### 규격 위반

| 항목 | 판정 | 내용 |
|---|---|---|
| traces_to | 통과 | `[H5, S2]` 실재 |
| requirements / forbid | 통과 | 8 / 6 |
| **detect 대상 실재** | **실패 4건** | C-1·C-2 |
| R-6 (표집·홀드아웃) | **부분 실패** | 표집 절차(REQ-3)·홀드아웃 분리·해시 잠금은 모범적이다. 그러나 **"정답 라벨을 구현자가 만든 경우 그 사실과 검증 방법을 명시"가 없다.** `labels.holdout.csv` 를 구현자가 같은 PR에서 작성하며, 라벨 작성 시점·독립성·이중판정 규정이 전무 |
| R-7 | 통과 | 실측 코퍼스(스냅샷 실재 검증, REQ-3c) + 홀드아웃 판정(REQ-5·6) |
| out_of_scope / rollback / touches | 통과 | |
| gate 선행 | 통과 | `gate: G1` + REQ-2가 `undecided` 시 착수 불가로 기계 판정 |

### 공격 결과

- **A 악의적 준수 — 결함 1건.** REQ-5(홀드아웃 커버리지 ≥60%)·REQ-6(오탐률 ≤20%)의 **정답 라벨을 구현자가 만든다.** 태그 정의 → 패턴 작성 → 라벨링 순서로 진행하면, 라벨을 패턴에 맞춰 붙이는 것이 가장 쉬운 길이며 두 임계 모두 자동 충족된다. `holdout.lock` 은 **커밋 시점에 봉인**할 뿐 라벨이 패턴을 보고 만들어졌는지는 구분하지 못한다. R-6이 요구하는 "자기 출제·자기 채점 금지"의 절반(코퍼스 분리)만 지켜졌고 나머지 절반(라벨 독립성)이 비어 있다. 참고로 D1a는 이중판정 20건·홀드아웃 봉인(키는 팀 리드 보관)까지 규정한다 — 같은 리포 안에 더 나은 처방이 이미 있다.
- **B 조건 회피 — 결함 1건(치명).** **FORBID-6이 보호하는 경로가 실제 선행 산출물의 경로가 아니다.** FORBID-6은 `docs/discovery/**` · `data/legal/**` · `scripts/discovery/**` 쓰기를 막는데, D4의 정본 규칙 파일은 **`packages/legal/medical/rules/*.yaml`** 과 **`packages/legal/medical/dist/exported_rules.json`** 이다(D4 touches·artifacts). 즉 **F4는 의료광고 규칙 정본을 자유롭게 수정할 수 있고, 금지된 것은 report.md 뿐이다.** FORBID-6의 because("의료광고 규칙이 개발 에이전트의 추측으로 대체된다")가 정확히 그 경로에서 발동 불가.
- **C 탐지 무력화 — 결함 4건.**
  - **C-1 — D1 산출물 경로 오류.** REQ-3은 `docs/discovery/D1/sample.csv` 의 `status=primary 100행` 을 모집단으로 쓴다. 실제 경로는 **`docs/discovery/D1a/sample.csv`**(D1a touches·artifacts). done_when은 `docs/discovery/D1/ledger.csv` 를 요구하지만 실제는 **`docs/discovery/D1b/ledger.csv`**. `D1-PRICE-AVAILABILITY-SPIKE` 는 **폐기 태스크**이므로 `docs/discovery/D1/` 은 영원히 생기지 않는다. REQ-3의 `--check corpus` 는 파일 부재로 항상 실패하거나(착수 불가), 구현자가 경로를 임의 수정한다(계약 이탈).
  - **C-2 — D4 인용 규약 위반 + 경로 오류.** REQ-8은 "`docs/discovery/D4/` 의 **4개 yaml** 에 rule_id 가 실재하고 status 가 advisory 가 아닐 것"을, FORBID-2는 "`docs/discovery/D4/forbidden_lexicon.yaml`" 을 참조한다. D4 계약 K-1은 **"하류 인용 방식: `exported_rules.json` 의 `rule_id` 문자열만 인용. 파일명·자연어 인용 금지"** 를 명문화했고, 파일명도 `lexicon.yaml`(≠`forbidden_lexicon.yaml`), 위치도 `packages/legal/medical/**` 다. 또 D4 K-2에 따르면 **advisory 항목은 `MEDA-` 네임스페이스로 분리되어 export 자체가 금지**되므로 REQ-8의 "status 가 advisory 가 아니다" 검사는 이미 D4가 구조로 해결한 것을 중복 구현하는 것이다. 결정적으로 **F4의 정규식 `^MED-[A-Z]-\d{2}$` 는 D4가 정의한 예외 규칙 접미 `-X`(`^MED-[A-Z]-\d{2}(-X)?$`)를 거부**한다 → 정당한 예외 규칙을 인용하는 태그가 전부 실패.
  - **C-3 — 게이트 어휘 불일치.** REQ-2는 G1.md의 per_axis verdict를 `proceed / editor_augment / axis_excluded / undecided` 로 읽는다. **D1b가 실제로 쓰는 값은 `proceed / editor_augment / axis_excluded / inconclusive`** 이고, **F1이 정한 스키마 enum은 `undecided / pass / fail / partial`** 이다. `inconclusive` 축이 존재할 때 F4의 파서는 세 어휘 어디에도 걸리지 않아 침묵 통과하거나 크래시한다. (F1 C-1과 동일 근원.)
  - **C-4 — depends_on 주석이 사실과 다르다.** "D1a/D1b 는 … 정본 ID 레지스트리에 슬러그가 **아직 등재되지 않았으므로** 등재되는 즉시 교체해야 한다" — `03-task-dag.md` 정본 레지스트리 첫 줄에 `D1a-PROTOCOL   D1b-FIELDWORK` 가 이미 등재되어 있다. 계약이 최신 정본과 대조되지 않은 채 작성되었다는 증거이며, 이 주석은 개발 에이전트에게 "ID를 바꿔도 된다"는 잘못된 허가로 읽힌다.
- **D 지름길 유도 — 결함 1건.** REQ-1의 태그 수 하한(18) · REQ-7의 노출 태그 하한(축당 4·전체 10) · FORBID-5(라벨 3건 미만 태그의 filter_visible 금지)가 동시에 걸린다. 코퍼스 100건에서 특정 축의 태그가 3건 라벨을 못 채우면 **REQ-7과 FORBID-5가 정면 충돌하며, 유일한 탈출구는 라벨을 더 붙이는 것**(A와 같은 자기 채점)이다. 충돌 시의 처리(축 제외? REQ-7 하향?)가 계약에 없다.
- **E DAG 정합성 — 이상 없음.** `depends_on: [F1, D1a, D1b, D4]` 는 전부 실질적 필요(CI job·표본 프레임·라벨 원장·의료 규칙). blocks 3건 타당. gate G1이 REQ-2로 기계 집행됨 — 이 배치에서 게이트를 실제로 집행하는 유일한 계약이며 좋은 설계다.
- **F 존재 이유 — 통과.** H5(필터 사용률)의 검증 대상인 필터 태그 집합을 이 태스크가 정의하고, FORBID-1의 because가 "H5의 저조한 수치가 가설 오류인지 태그 허구인지 구분 불가"라는 **측정 타당성 논거**까지 제시한다. S2와도 정합.

### 필수 수정 사항

1. **REQ-3·done_when의 D1 경로를 `docs/discovery/D1a/sample.csv` · `docs/discovery/D1b/ledger.csv` 로 정정.**
2. **REQ-8·FORBID-2의 D4 참조를 `packages/legal/medical/dist/exported_rules.json` 의 rule_id 인용으로 전환**(D4 K-1 규약 준수). 정규식을 `^MED-[A-Z]-\d{2}(-X)?$` 로 수정. "status advisory 아님" 검사는 `MEDA-` 네임스페이스 배제로 대체.
3. **FORBID-6의 보호 경로에 `packages/legal/**` 추가**(현재 D4 정본이 무방비). `docs/discovery/D1a/**` `docs/discovery/D1b/**` 로 경로 정정.
4. **REQ-2의 verdict 어휘를 D1b 정본(`proceed/editor_augment/axis_excluded/inconclusive`)에 맞추고, `inconclusive` 축의 처리(태그 부여 가부)를 명시.** F1 REQ-7의 스키마 확정과 함께 처리해야 한다.
5. **R-6 보강 — 라벨 독립성 REQ 신설.** 최소: (a) 홀드아웃 라벨은 `match_patterns` 작성 **이전에** 커밋되고 그 순서가 커밋 이력으로 검증된다, (b) 홀드아웃 30건 중 최소 10건은 이중판정하고 불일치율을 리포트한다(D1a의 이중판정 20건 규정과 동형).
6. **REQ-7 ↔ FORBID-5 충돌 시의 우선순위를 계약에 명시** (예: "라벨 3건 미만으로 축당 4개를 채울 수 없는 축은 `filter_visible` 하한 적용 대상에서 제외하고 그 사실을 리포트한다").
7. **depends_on 주석 삭제**(정본 레지스트리에 이미 등재됨).

---

## F5-API-LAYER — REVISE

### 규격 위반

| 항목 | 판정 | 내용 |
|---|---|---|
| traces_to | 통과 | `[H4, G4, S4]` 실재 |
| requirements / forbid | 통과 | 7 / 5 |
| when·because·detect·on_violation | 통과 | 5건 전부 충족 |
| **detect 대상 실재** | **부분 실패** | REQ-3·FORBID-2가 `public_venue` 뷰를 전제하는데, 그 뷰의 소유자가 F2b·C7 이중이며 컬럼 목록이 어느 계약에도 확정되어 있지 않다(F2b는 `allowed-columns.quality.json` 에 위임, C7은 `public_venue.columns.json` 에 위임 — **매니페스트 파일이 2개**) |
| R-7 | 통과 | REQ-6이 실제 PostgreSQL16+PostGIS 컨테이너 + mock 패턴 검출 |
| 원칙 2.5 짝 REQ | 통과 | REQ-5(공개 20건 전건 반환)가 FORBID-2·3의 짝. 명시적으로 잘 배치됨 |
| out_of_scope / rollback / touches | 통과 | |

### 공격 결과

- **A 악의적 준수 — 결함 2건(치명).**
  - **A-1 — 응답 필드 집합을 아무 REQ도 고정하지 않는다.** REQ-4는 "zod 스키마 파싱을 통과 · 미선언 컬럼 strip · 필수 키는 optional 아님"이라고만 하고, **필수 키 목록은 "테스트 소스 하드코딩"(FORBID-4 detect)** 으로 구현자에게 위임된다. 따라서 `{slug, name}` 만 반환하는 API가 REQ-1~7을 **전부 통과**한다. 그런데 F6은 `price_per_session` · `confidence` · 미해소 `price_conflict` 존재 여부를 입력으로 요구하고(F6 REQ-1), W3은 충돌 쌍 **양쪽 price_plan 값과 소스명**을 요구하며(W3 REQ), W2는 `data-price-state` 20건을 요구한다. FORBID-4의 because는 "F2b가 만든 confidence·visibility 누락을 조용히 통과시킨다"고 **응답에 confidence가 있다고 가정**하지만, 그것을 요구하는 REQ가 없다.
  - **A-2 — 요금제 조회 경로가 계약에 없다.** artifacts는 `listPublicVenues` · `getPublicVenueBySlug` 2개뿐이고 `public_venue` 는 **venue 단위 뷰**다. W2·W3·W4·W5는 "공개 조회 함수는 F5 소유. F5가 함수를 제공하지 않으면 **대기해야지 자체 쿼리로 대체해서는 안 된다**"(W2 FORBID because)고 못박혀 있다. 즉 **F5가 요금제 조회를 제공하지 않으면 Phase 3 4개 태스크가 전부 대기 상태로 교착**한다. `price_plan.visibility` 필터를 어디서 적용할지도 미정(F2b가 컬럼은 만들지만 뷰는 venue 단위).
  - **A-3 — REQ-5의 20건과 기본 페이지 크기의 충돌.** `listPublicVenues` 가 **하드코딩 `LIMIT 20`** 으로 구현되면 REQ-5(정확히 20건)는 통과한다. 페이지네이션은 out_of_scope(W2)이므로 상한을 두는 것이 오히려 자연스러운 선택이다. 21건 이상을 요구하는 assert가 없어 **"전량 차단 방지" 장치가 "전량 절단"을 못 막는다.**
- **B 조건 회피 — 결함 2건.**
  - **B-1 — 드라이버 부인목록 우회.** REQ-1·FORBID-1의 대상은 `packages/db · pg · postgres · drizzle-orm · @prisma/client` 5종. **`@vercel/postgres`(Vercel 배포 전제에서 가장 유력) · `@neondatabase/serverless` · `kysely` · `knex` · `postgres.js` 를 다른 이름으로 alias 한 로컬 래퍼**는 전부 통과한다. F1 B-2와 동일 결함이며, 두 계약이 같은 부인목록을 복제해 놓았으므로 한쪽만 고쳐도 소용없다.
  - **B-2 — 런타임 차단이 아무 계약에도 없다.** C7 FORBID-1은 "**DB 롤 분리를 통한 런타임 차단은 F5-API-LAYER 소관**"이라고 명시적으로 위임했다. F2b는 `web_reader` 롤을 만든다(REQ-8). 그런데 **F5의 REQ·FORBID·out_of_scope 어디에도 롤 사용 규정이 없다** — F5는 어떤 DB 사용자로 접속하는지 계약하지 않는다. 결과: 경계는 **정적 분석 1겹**뿐이고, 우회 시 런타임 방어가 0이다. 위임받은 책임이 증발했다.
- **C 탐지 무력화 — 결함 2건.**
  - **C-1 — REQ-3 (a)의 정적 검사가 문자열 상수에만 걸린다.** "`FROM venue`·`FROM price_plan`·`visibility` 리터럴 검출 시 exit 1". 쿼리 빌더(`sql.from(tables.venue)`), 템플릿 조립(`FROM ${T}`), 뷰와 동명의 CTE(`WITH public_venue AS (SELECT * FROM venue)`) 는 전부 통과한다. 통합테스트 (b)는 hidden 4종이 안 나오는 것만 보므로 **CTE로 뷰를 위장한 base 조회를 잡지 못한다**(뷰와 동일 조건을 복제한 CTE는 픽스처를 통과한다). FORBID-2가 막으려는 것이 정확히 "판정 조건 복제"인데 detect가 그것을 못 본다.
  - **C-2 — FORBID-3의 fuzz 사전이 폐쇄 열거.** `includeHidden·preview·debug·bypassGate·allVisibility` 5종 × 대소문자·별칭 20종. `internal`, `withDrafts`, `mode:'admin'`, `role` 파라미터, `NEXT_PUBLIC_*` 환경 분기는 전부 빠져나간다. 더 강한 계약은 "공개 함수의 시그니처 파라미터 집합을 테스트 소스에 하드코딩하고 **집합 동등** 비교"(REQ-4가 응답에 쓴 기법을 입력에 적용)다.
- **D 지름길 유도 — 결함 1건.** FORBID-4의 유일한 예외 경로는 "`packages/api` CODEOWNERS 승인 리뷰"인데, **F5의 touches에 `.github/CODEOWNERS` 가 없다**(F1 B-3). 소유자가 등록되지 않은 경로에 대한 승인 요구는 GitHub에서 아무 리뷰어나 승인하면 충족되거나, 아예 검사 불가다. F2a·F2b·F6도 동일.
- **E DAG 정합성 — 결함 1건(경미).** `depends_on: [F1, F2a, F2b]` 는 타당하며 F2b 추가 사유 주석도 정확하다. 순환 없음. 다만 **F5는 `packages/db/src/pool.ts` 를 새로 만드는데 F1은 이미 `packages/db/src/client.ts`(커넥션 팩토리 골격)를 만든다.** 커넥션 생성 지점이 2개가 되며 REQ-7("풀 인스턴스 정확히 1개")의 검사 대상이 어느 쪽인지 불명확하다. F1의 `client.ts` 를 대체·삭제한다는 규정이 없다.
- **F 존재 이유 — 통과.** PRD §2 "Route Handler 기반 공용 API 레이어를 웹과 분리 / 앱 확장 시 재사용 / 웹 컴포넌트가 DB를 직접 호출하지 못하게 경계를 강제"를 그대로 이행한다. REQ-2(next/react import 0건)는 Expo 재사용 전제를 **기계 검증 가능한 형태**로 바꾼 좋은 예다. traces_to H4·G4·S4 중 **G4가 핵심**(공개 판정 우회 차단)이며 실제로 REQ-3·FORBID-2가 그것을 집행한다.

### 필수 수정 사항

1. **응답 필수 키 집합을 계약 본문에 못박을 것** — 최소 `slug · name · category · gu · location` + 요금제별 `price_per_session · price_unit_type · price_per_month_krw · confidence · conflict_ids`. 현재는 구현자가 정하며, 하류 4개 태스크의 입력이 여기에 걸려 있다(§3.4 "잠금 대상의 허용 범위를 계약 본문에 못박아라").
2. **요금제 공개 조회 함수를 artifacts·REQ에 추가**(예: `listPublicPricePlans(venueId)`), 그리고 `price_plan.visibility` 필터가 어디서 적용되는지 명시. 없으면 W2·W3·W4·W5가 계약상 교착한다.
3. **REQ-5에 "전량 절단 방지" assert 추가** — 공개 픽스처를 20건이 아닌 **23건**(임의 비관행 수)으로 하고 전건 반환을 요구하거나, 별도로 "기본 호출에 상한 LIMIT을 적용하지 않는다"를 REQ화.
4. **REQ-1/FORBID-1의 부인목록을 허용목록으로 전환** — "`packages/api` 외 워크스페이스 패키지의 `dependencies` 에 DB 드라이버·쿼리빌더·ORM 계열이 0건" + F1과 동일 규칙 공유(중복 정의 금지).
5. **DB 롤 사용을 REQ로 신설** — "공개 조회 함수는 `web_reader` 롤 자격증명으로만 접속하며, 해당 롤로 base 테이블 SELECT 시 42501" 통합테스트. C7이 F5에 위임한 런타임 차단의 유일한 실체.
6. **REQ-3 (a) 정적 검사를 AST/쿼리빌더 대응으로 확장하고 CTE 위장 케이스를 픽스처에 추가.**
7. **FORBID-3을 파라미터 집합 동등 비교로 전환**(fuzz 사전 열거 폐기).
8. **`packages/db/src/pool.ts` 와 F1 `client.ts` 의 관계 명시**(대체·삭제 여부).
9. **`.github/CODEOWNERS` 를 touches에 추가**하거나 F1이 사전 등록(F1 필수 수정 8과 연동).

---

## F6-PRICE-STATE — REVISE

> 팀 리드가 지목한 원칙 2.5 리스크("항상 미공개만 렌더하는 모듈이 만점")에 대해서는 **방어에 성공했다** — REQ-5(고신뢰 40건 전건 confirmed+showNumeric)와 REQ-7(스테이징 300행에서 confirmed ≥30%)이 정확히 그 짝이다. 그러나 **상태 분류 체계 자체가 C4의 출력 공간을 다 덮지 못해**, 아무것도 위반하지 않으면서 확정 가격 한 종류를 통째로 은닉한다.

### 규격 위반

| 항목 | 판정 | 내용 |
|---|---|---|
| traces_to | **부분 실패** | `[H4, S1, KM-price-coverage]` — `KM-price-coverage` 는 **PRD·Lean Canvas에 ID로 존재하지 않는다**(canvas §7의 자연어 행 "가격 커버리지율"). F1 REQ-8 (a) 검사에 걸리며, F1은 out_of_scope상 이를 창설할 수 없다(F1 A-1) |
| requirements / forbid | 통과 | 7 / 5 |
| when·because·detect·on_violation | 통과 | 5건 전부 충족 |
| R-6 | 통과 | REQ-6이 모집단·층화·고정 시드·홀드아웃 sha256 잠금·개발셋 import 금지까지 규정. **이 배치에서 R-6을 가장 정확히 이행한 계약** |
| R-7 | 통과 | REQ-7 스테이징 실표본 300행 분포 하한 |
| 원칙 2.5 | 통과(형식) | FORBID-4의 짝 = REQ-5, FORBID-1의 짝 = REQ-7. 다만 아래 A-1의 구조적 은닉은 짝 REQ로 막히지 않는다 |
| out_of_scope / rollback / touches | 통과 | rollback이 소비자 머지 이후 시나리오까지 다룸(우수) |
| gate 표기 | 경미 | `gate: [G1, G3]` 배열 — F1 REQ-8 (e)가 배열을 규정하지 않음(F1 C-5) |

### 공격 결과

- **A 악의적 준수 — 결함 2건(1건 치명).**
  - **A-1 (치명) — `period_pass` 확정 가격이 영구히 `unknown` 으로 접힌다.** REQ-1의 unknown 조건은 `price_per_session IS NULL` 이다. C4는 `price_unit_type='period_pass'` 행에 대해 **불변식 I3 = `price_per_session IS NULL ∧ period_days NOT NULL ∧ price_per_month_krw = floor(total×30/period_days)`** 를 강제한다. 즉 **정상적으로 파싱되어 월 환산가까지 산출된 기간권 요금제가 F6에서는 `unknown`**(=미확정)이 되고, REQ-3에 의해 `showNumeric=true` 인 상태는 `confirmed` 뿐이므로 **W2·W3·W4·W5 네 표면에서 그 가격은 절대 렌더되지 않는다.** 한편 C7 REQ-8은 "기간권 커버리지율"을 G4 지표로 **분리 산출**하도록 요구한다 — 측정은 하는데 표시는 불가능한 데이터가 된다. 이 은닉은 규칙 자체에 박혀 있어 **어떤 테스트도 실패시키지 않으며**, REQ-7(confirmed ≥30%)도 per_session 행만으로 충족 가능하다. 정확히 "숨기는 방향으로 열려 있다"의 재발이며, 팀 리드가 F6에서 경계한 실패 모드가 **다른 축(가격 유형)으로 실현**된 형태다.
  - **A-2 — `unparseable` 과 "confidence 미산출"이 같은 상태로 붕괴한다.** C4의 출력 공간은 4종(확정 per_session / period_pass·single_session / unparseable+failure_reason 8종 / 저신뢰)이고, F2a REQ-3은 `price_per_session IS NULL → failure_reason NOT NULL` 을 강제한다. F6은 이 둘을 모두 `unknown` 하나로 매핑하고 REQ-3은 상태당 `reasonKey` 를 **1개**만 반환하게 한다. 결과: 화면에서 "가격 정보가 없음"과 "가격을 읽지 못함"과 "파이프라인이 신뢰도를 산출하지 못함"이 **동일 문구**가 된다. `failure_reason` 8종을 만든 C4의 투자가 표시 계층에서 소멸한다.
- **B 조건 회피 — 결함 1건.** REQ-2·FORBID-2의 단일 소스 검사는 "**confidence 비교 연산과 동일 임계 리터럴**의 타 위치 선언"을 스캔한다. 소비 측은 (i) `0.7` vs `0.70` vs `70/100` vs `7e-1` 표기 변형, (ii) `if (p.confidence < CFG.minConf)`(리터럴 없음), (iii) `classifyPriceState` 를 부르되 결과를 무시하고 `p.confidence` 를 직접 읽어 배지를 결정 — 세 경로 모두 통과한다. 훨씬 검사하기 쉬운 형태는 **"`packages/price-state` 외의 어떤 파일도 `confidence` 필드를 읽지 않는다"**(필드 접근 금지)이며, W2 FORBID도 같은 리터럴 기반이라 함께 교체되어야 한다. 또한 W2는 정본을 **2곳**(`@glowmate/price-state` + DS 토큰 패키지)으로 인정하는데 F6 REQ-2는 **1곳**이라고 못박는다 — 계약 간 불일치.
- **C 탐지 무력화 — 결함 1건.** FORBID-3의 `when` 은 "**REQ-4·REQ-5 테스트가 실패한 상태에서** 임계·기대 라벨을 변경"이다. 그러나 실제로 막히는 지점은 **REQ-7(스모크 분포)** 이다: 스테이징 confirmed 비율이 28%면 REQ-4·REQ-5는 green인 채 REQ-7만 red다. 이 상태에서 `PRICE_CONFIDENCE_MIN` 을 0.60으로 낮추는 것은 **when에 해당하지 않아 계약상 허용**된다(REQ-5의 골든은 confidence ≥0.70이므로 임계를 낮춰도 여전히 confirmed → 통과). detect(diff 감지 + 승인)가 우연히 더 넓게 걸리지만, F1 B-1과 동일하게 **계약 문면이 우회를 허가**한다.
- **D 지름길 유도 — 결함 1건(치명).** REQ-6("골든/홀드아웃 100건은 **C4가 실데이터로 산출한 price_plan 모집단**에서 층화 추출")과 REQ-7("**스테이징 DB의 실제 price_plan 표본 300행**")은 실데이터를 요구하는데, **`depends_on: [F2b, C4]` 에는 데이터를 생성하는 태스크가 없다.** C4는 `depends_on: [C1, F2a, F2b, D4]` 이고 **소스 어댑터 C2·C3에 의존하지 않는다.** 즉 F6 착수 시점에 스테이징 `price_plan` 이 300행에 도달한다는 보장이 전무하다. REQ-7 acceptance는 "표본이 300행 미만이면 `insufficient_sample` 로 exit 1" 이므로 **F6은 착수 즉시 영구 red가 될 수 있고**, 그때의 최단 경로는 **합성 행을 스테이징에 적재하는 것**이다 — 이를 금지하는 FORBID가 없다(FORBID-3은 `constants.ts·fixtures/**·holdout.lock` diff만 본다). R-7의 목적(픽스처 세계 탈출)이 정확히 이 지점에서 무효화된다.
- **E DAG 정합성 — 결함 1건.** `depends_on: [F2b, C4]`, `blocks: [W2, W3, W4, W5]`, `gate: [G1, G3]` 은 03-task-dag.md Phase 1 표(F6: 의존 F2·C4)와 정합하고 순환도 없다. 게이트도 C4로부터 정당하게 승계한다. **누락 의존 1건**: 위 D-1대로 실데이터 하한(REQ-6·REQ-7)을 유지하려면 `C2-ADAPTER-NAVER` 또는 `C3-ADAPTER-KAKAO` 중 최소 1건이 depends_on에 있어야 한다. 또한 F6은 "Foundation" 워크스트림인데 Phase 2 산출물에 의존하므로 **Phase 1 병렬 배치(B2)에서 실행 불가** — `03-task-dag.md` 의 병렬 실행 배치표(B1~B7)에 F5·F6·W7·W8·W9가 아예 등재되지 않은 것과 함께 정리되어야 한다.
- **F 존재 이유 — 통과(1건 단서).** `why`("표면마다 따로 구현하면 같은 업체가 리스트에서는 확정, 상세에서는 추정")는 W2·W3·W4·W5가 모두 `@glowmate/price-state` 를 명시적으로 의존하고 자체 구현을 금지한 현 상태와 정확히 일치한다 — **4개 소비자 계약이 이미 이 모듈명·4상태 어휘(confirmed/estimated/conflicted/unknown)를 그대로 쓰고 있음을 확인**했다. traces_to H4(가격 비교 블록 전환율)·S1(회당 단가 정규화) 정합. 단 `KM-price-coverage` 는 미등록 ID(규격 위반 표 참조).

### 필수 수정 사항

1. **`period_pass`(월 환산가 보유) 행의 상태를 신설하거나 `confirmed` 판정 조건을 확장할 것.** 예: 상태를 `confirmed_per_session` / `confirmed_period` 로 분리하고 표시 규칙에 `showNumeric=true` + 단위 키를 부여. 그렇지 않으면 C4가 산출한 기간권 가격과 C7 REQ-8의 기간권 커버리지 지표가 제품 표면에 **영구히 도달하지 못한다**. (소비 계약 W2·W3·W4·W5의 `data-price-state` 어휘 정정 상신 포함)
2. **`unknown` 을 `unparseable`(price_per_session NULL ∧ failure_reason 존재)과 `unscored`(confidence NULL)로 분리**하고 각각의 `reasonKey` 를 지정. C4의 `failure_reason` 8종과의 대응표를 REQ화.
3. **REQ-6·REQ-7의 데이터 원천 보장** — `depends_on` 에 소스 어댑터(C2 또는 C3)를 추가하거나, REQ-7을 "C7 스테이징 스냅샷이 존재하는 경우"로 조건화하고 **합성 행 적재를 FORBID로 금지**(`smoke` 대상 테이블에 픽스처 origin 태그가 있는 행이 포함되면 exit 1).
4. **FORBID-3의 `when` 에 REQ-7 실패 상태를 포함** — "REQ-4·REQ-5·**REQ-7** 중 하나라도 실패한 상태에서".
5. **REQ-2·FORBID-2의 검사를 리터럴 스캔 → 필드 접근 금지로 전환** — "`packages/price-state` 외의 파일이 `confidence` 필드를 읽거나 `price_conflict` 를 조회하면 exit 1". W2 FORBID의 "정본 2곳" 표현과도 정합화.
6. **`traces_to` 의 `KM-price-coverage` 를 확정 ID로 등록**(F1 필수 수정 5와 연동) 또는 PRD 실재 ID로 교체.

---

## 전체 요약

### 판정

| 태스크 | 판정 | 차단 사유 1순위 |
|---|---|---|
| **F1** | REVISE | 게이트 verdict 어휘 3중 불일치(F1/D1b/F4) · 초기 baseline 상한 부재 · 기존 검증기 미승계 + 오탐 회귀 픽스처 0건 · FORBID-6 자기 PR 차단(P7 3회차) |
| **F2a** | REVISE | no-op down이 REQ-7 통과 · F2b가 코어 화이트리스트를 깨뜨리는데 소유권 없음 |
| **F2b** | REVISE (조건부 차단) | REQ-4 뷰가 `force_public` 으로 `hidden_legal`/`hidden_request` 를 뒤집음(C7 FORBID-5·6 정면 충돌) · `public_venue.sql` 2중 소유 · C7/O2가 요구하는 테이블 3종 부재로 두 태스크 영구 착수 불가 |
| **F4** | REVISE | 선행 산출물 경로 4곳 오류(폐기된 D1 경로 · D4 정본 위치·인용 규약 위반) · FORBID-6이 실제 D4 경로를 보호하지 않음 |
| **F5** | REVISE | 응답 필드 미고정으로 `{slug,name}` 구현이 만점 · 요금제 조회 경로 부재로 W2~W5 교착 · C7이 위임한 런타임 롤 차단 증발 |
| **F6** | REVISE | `period_pass` 확정 가격의 구조적 은닉 · 실데이터 REQ의 데이터 원천 의존 부재 |

### 체계적 결함 패턴 (2개 이상 태스크에서 반복)

**P-A. 폐쇄 열거로 지켜야 할 것을 부인목록(deny-list)으로 지킨다 — F1 · F5 · F6 · F4**
F1 FORBID-1과 F5 REQ-1은 DB 드라이버 5종을 이름으로 열거하고(`@vercel/postgres` 등이 통과), F5 FORBID-3은 우회 파라미터 5종을 열거하며, F6 REQ-2는 임계 리터럴을 문자열로 찾고, F4 FORBID-4는 성별 표현을 정규식으로 찾는다. **정작 F2a FORBID-3의 because 가 "정규식 금지는 이름만 바꾸면 뚫린다 — 폐쇄 화이트리스트만이 막는다"를 정확히 논증해 놓았다.** 같은 배치 안에서 옳은 처방과 틀린 처방이 공존한다. 허용목록(패키지 의존 선언 · 파라미터 집합 동등 · 필드 접근 금지)으로 일괄 전환이 필요하다.

**P-B. 잠금 대상의 "최초값"에 상한이 없다 (사전 설정 무방비 · 정정 #6의 재발) — F1 · F2a · F4**
F1의 `baseline.json` 초기값, F2a의 `allowed-columns.core.json` 최초 내용, F4의 홀드아웃 **라벨** 최초 작성 — 셋 다 "변경에는 승인이 필요하지만 최초 작성에는 아무 제약이 없다". 규격 §3.4가 명시한 안티패턴이며, D1 → D1a/D1b 분할로 이미 처방(사전등록 선머지)이 나와 있는데 Foundation 배치에는 적용되지 않았다.

**P-C. 계약 간 어휘·이름·경로가 대조되지 않은 채 확정 선언되었다 — F1 · F2b · F4 · F6**
게이트 verdict 3종(F1/D1b/F4), 품질 테이블명 2종(F2b/C7), visibility ENUM 4값/5값(정정#2/F2b), 뷰 컬럼 매니페스트 2개(F2b/C7), D4 규칙 파일 경로·인용 규약(F4/D4), 정본 상수 소스 1곳/2곳(F6/W2), `KM-*`·`NSM-*` 미등록 ID 8건. **하류 detect가 대부분 SQL 식별자·파일 경로 grep이므로, 이름 한 글자 차이가 곧 탐지 전멸이다.** F1이 `ids.yaml` 로 가설·지표 ID는 정본화했지만 **테이블명·파일 경로·상태 어휘에는 정본 레지스트리가 없다** — 이것이 이 배치 결함의 최대 단일 원인이다.

**P-D. `when` 이 `detect` 보다 좁아, 계약 문면이 우회를 허가한다 — F1 FORBID-2 · F6 FORBID-3**
둘 다 "테스트가 red 인 상태에서 …" 로 조건을 좁혔고, detect는 그보다 넓게 걸린다. 개발 에이전트는 계약을 읽고 행동하며 CI에 막힌다 → "CI가 계약보다 엄격하다"는 학습은 F1 FORBID-2의 because가 우려한 우회 관용구 학습과 정확히 같은 경로다.

**P-E. 승인 게이트가 존재하지 않는 CODEOWNERS에 걸려 있다 — F2a · F2b · F5 · F6 (4건)**
네 계약의 핵심 FORBID(화이트리스트 변경 · 임계 변경 · 필수 키 변경)의 유일한 예외 경로가 "해당 경로 CODEOWNERS 승인 리뷰(승인자 ≠ 작성자)"인데, **F1은 어떤 경로에 소유자를 등록할지 REQ로 정하지 않았고, 네 계약은 `.github/CODEOWNERS` 를 touches에 갖고 있지 않다.** 승인 게이트 4건이 집행 불가. 부수적으로, 전원이 에이전트인 리포에서 "승인자 ≠ PR 작성자"가 무엇을 의미하는지도 어느 계약도 정의하지 않는다(O2 REQ-7의 2인 승인과 같은 미해결 전제).

**P-F. 원칙 2.5의 짝 REQ는 갖췄으나, "은닉"이 규칙 자체에 내장된 경우는 짝 REQ로 잡히지 않는다 — F6 · F1**
F6은 REQ-5·REQ-7이라는 모범적인 짝을 갖고도 `period_pass` 전체를 은닉하고, F1 FORBID-3은 라우트가 0개인 스캐폴드에서 만점을 받는다. **짝 REQ는 "얼마나 보여주는가"를 묻지만, "무엇이 보여줄 수 있는 집합에서 아예 빠졌는가"는 묻지 않는다.** 향후 계약에는 "입력 도메인 전수 커버리지"(C4 출력 4종 × 표시 규칙 4상태 대응표 같은)를 짝 REQ의 두 번째 축으로 두어야 한다.
