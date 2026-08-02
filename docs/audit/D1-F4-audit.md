# D1·D2·D3·D4·F1·F2·F4 감사 보고 (라운드 2) — task-auditor

> 대상: `docs/tasks/{D1,D2,D3,D4,F1,F2,F4}.md` (7건. F3는 DAG 정본에서 폐기되어 제외)
> 대조: `02-task-contract-spec.md` §5 (**R-6·R-7 개정 반영**) · `01-prd.md` · `03-task-dag.md` · `00-lean-canvas.md`
> 교차 대조: C1~C7 · W1~W7 · DS0~DS7 · O1~O3 계약, `docs/audit/C1-C7-audit.md`
> 계약 파일은 한 글자도 수정하지 않았다.
> 직전 라운드 보고서는 `docs/audit/D1-F4-audit-round1.md` 로 보존했다. 본 문서는 개정 규격(R-6/R-7·detect 대상 실재)과 F2 스키마 정합성·G1 축별 판정 주입을 중점으로 한 재감사이며 라운드 1을 대체한다.

> ## ⚠️ 스냅샷 고지 — 감사 중 계약이 동시 개정되었다
>
> 본 감사는 **2026-08-03 00:20~00:27 시점의 파일**을 대상으로 수행했다. 감사 진행 중 저자 측이
> 같은 파일들을 개정했으므로(아래 표), 각 판정이 어느 리비전에 대한 것인지 명시한다.
> **정본 재감사가 필요한 항목이 있다.**
>
> | 태스크 | 감사 대상 리비전 | 현재 상태(00:34) | 본 보고서 판정의 유효성 |
> |---|---|---|---|
> | D1 | 00:20 단일 계약 | **폐기 → D1a-PROTOCOL / D1b-FIELDWORK 분할** | 공격 C(사전등록 잠금 우회)·P2 는 분할로 **해소됨**. 공격 A-1(모집단 프레임)·F(축별 n=33 통계 검정력)·E(G1 기계 판독 산출물)는 **D1a/D1b 에 대해 재확인 필요** |
> | D2 | 00:20 | 00:29 개정 | 검색량 하한·홀드아웃 대조군 20건·엔진별 verdict 결합 규칙이 신설되어 A(산술 불가)·C(capture_mode 자기신고)·R-6 지적이 **대부분 반영됨**. 원본 HTML 스냅샷 요구도 추가됨 |
> | D3 | 00:20 | 00:31 개정 | `max_requests_per_min ≥ 6` 하한(K-2)과 최소 확보 하한(K-6)이 신설되어 A(전량 forbidden 공허 통과)·B(rpm 하향 마비) 지적이 **반영됨** |
> | D4 | 00:20 | 00:33 개정 | 실측 코퍼스 40건(개발 30/홀드아웃 10)과 `show` 판정 비율 하한이 신설되어 R-6·R-7 위반과 A(과잉 차단)가 **반영됨**. 규칙 산출물이 `packages/legal/**` 로 이동해 CI 연결(P4)도 개선됨 |
> | F1 | 00:20 | 00:28 개정 | `README.md` 가 touches 에 편입되어 P7 **해소**. `blocks` 에 D1a·D1b·D2·D3·D4·DS3 편입, `dag-check` 잡 신설로 P6·범용 path guard 지적이 **반영됨**. **`packages/pipeline` 소유자 부재(교착)는 재확인 필요** |
> | F2 | 00:20 | **폐기 → F2a-CORE-SCHEMA / F2b-QUALITY-SCHEMA 분할** | 어휘 정본을 `visibility` 로 확정하고 판정(C7)/오버라이드(O2) 분리 저장·`public_venue` 뷰·롤 분리까지 도입되어 본 보고서 §F2 권고와 **방향 일치**. "정확히 7개" 자기모순도 6테이블+분할로 해소 |
> | **F4** | 00:20 (**미개정 — 23:44 그대로**) | 미개정 | **REJECT 유효하며 긴급도 상승.** F4는 폐기된 `D1` 을 `depends_on` 으로 참조 중이고, D1 tombstone 이 "F4 는 `D1b-FIELDWORK` 를 참조해야 하며 태그 근거는 `ledger.csv` 의 `service_menu_raw` 컬럼에서 공급된다"고 명시한다 — 즉 본 보고서의 필수 수정 2(D1 ledger 에 서비스 문구 컬럼 추가)는 **이미 D1b 에서 충족되었으나 F4 계약이 아직 그것을 반영하지 않았다** |
>
> **후속 조치 권고**
> 1. F4 를 최우선 재작성 — 입력 경로를 `docs/discovery/D1b/ledger.csv#service_menu_raw` · `packages/legal/medical/rules/*.yaml` 로 교체, `depends_on: [D1b-FIELDWORK, D4-MEDICAL-AD-GUARDRAIL, F1-REPO-SCAFFOLD]`, REQ-2 를 G1 축 판정 의존으로, FORBID-1 detect 를 문자열 실재 대조로.
> 2. D1a·D1b·D2·D3·D4·F1·F2a·F2b 는 **개정본 기준 재감사 1회**가 필요하다. 본 보고서의 공격 A~F 기록은 재감사 시 회귀 체크리스트로 사용할 것.
> 3. 직전 라운드 보고서는 `docs/audit/D1-F4-audit-round1.md` 로 보존했다. `F2.md` tombstone 이 "1차 감사 §F2"를 근거로 인용하고 있으므로 인용 추적성을 위해 삭제하지 말 것.

## 0. 판정 요약

| 태스크 | 판정 | 한 줄 사유 |
|---|---|---|
| D1 | **REVISE** | 축별 n=33 설계로는 G1의 3구간 판정이 통계적으로 불가능. 사전등록 잠금에 우회로가 열려 있고, 모집단 프레임 구축 절차가 없어 편향이 자유롭다 |
| D2 | **REVISE** (BLOCKING) | 100개만 측정하면서 "enterable ≥ 100"을 통과 조건으로 삼음 — G2 통과가 산술적으로 불가능 |
| D3 | **REVISE** | 전 소스를 forbidden 으로 판정하면 REQ 6개·FORBID 5개가 전부 공허하게 통과한다. 요청률 하한이 없어 rpm=1로 합법적 마비 가능 |
| D4 | **REVISE** | 실제 관측 가격 문자열 0건 — 전 REQ가 자작 픽스처로 충족(R-7 위반), 임계 REQ에 표집·홀드아웃 없음(R-6 위반) |
| F1 | **REVISE** | 폐기된 F3 참조 · 자기 done_when(README)이 자기 FORBID-5에 걸림 · "정확히 4개 패키지" 고정이 `packages/pipeline` 생성을 원천 봉쇄 |
| F2 | **REVISE** (BLOCKING) | "정확히 7개 테이블" REQ-1과 price_conflict·venue_suppression 요구가 자기모순. 하류 7건이 쓰는 데이터 모델(`is_public`·`canonical_venue`·`venue_price`)을 F2가 표현하지 않아 medical·게이트 FORBID가 공허 통과한다 |
| F4 | **REJECT** | 선언한 입력 3개 파일이 어느 선행 태스크에서도 산출되지 않으며, 경로를 고쳐도 D1 산출물에 필요한 데이터(업체 서비스 문구)가 아예 없다. F4 단독 수정으로 복구 불가 |

---

## D1-PRICE-AVAILABILITY-SPIKE — REVISE

### 규격 위반 (§5 체크리스트)

| 항목 | 결과 |
|---|---|
| traces_to 비었거나 PRD에 없는 ID | **위반** — `KM-price-coverage` 는 PRD·린캔버스 어디에도 정의되지 않은 ID다(린캔버스 §7 지표에는 ID가 없다). H1·H2·G1·S1 은 실재 ✅ |
| depends_on 순환 | 통과 (빈 배열) |
| depends_on 이 DAG에 없는 태스크 참조 | **위반(형식)** — `blocks: [F4, C1, C4]` 는 정본 레지스트리 문자열(`F4-NEED-TAG-ONTOLOGY` 등)과 불일치. DAG 자동 검증이 성립하지 않음 |
| gate 무시 선행 배치 | 통과 |
| PR 2개 이상으로 나뉘어야 함 | 조건부 통과 — 조사 1건이나, 사전등록(protocol)과 결과가 한 PR인 것이 P2 우회의 근원(아래 C) |
| 주관적 형용사 | 통과 |
| acceptance 기계 검증 불가 | **부분 위반** — 6개 acceptance 전부가 `validate_d1.py`(피검자 자작 스크립트) exit 0. 스크립트의 정당성을 검증하는 수단이 계약에 없다 |
| REQ에 '그리고' 복수 결합 | REQ-1이 (모집단 구축)+(표본 추출)+(축 배분) 3개를 묶음 — 경계선. 분리 권고 |
| requirements 8 초과 | 통과 (6개) |
| forbid 0개 / 7개 이상 | 통과 (6개) |
| when 없음·'항상' | 통과 — 6개 전부 판정 가능한 조건 |
| detect 없음 | 통과 |
| because 구체성 | 통과 — 6개 모두 실패 시나리오가 구체적. 이 배치 최고 수준 |
| detect 전부 코드리뷰 | 통과 |
| **R-6 표집 절차·홀드아웃** | **위반** — 표본 추출 절차는 명시(고정 시드·층화) ✅ 이나 **모집단(population.csv) 구축 절차가 전무**하고, REQ-4의 임계(일치율 ≥0.90)에 블라인드·독립성 규정이 없다 |
| R-7 실환경 하한 | 통과 — REQ-3의 실제 업체 페이지 열람·source_url·증거 스니펫이 실환경 하한 역할 ✅ |
| **detect 대상 실재** | **위반** — detect가 전부 `validate_d1.py`인데 이 스크립트를 CI에 등재하는 태스크가 없다. FORBID-1 detect 주석("F1의 CI 도입 후 CI 잡으로 승격")은 소유자 없는 미래형 약속이다 |
| out_of_scope / touches / rollback | 통과 — 이 배치에서 가장 정밀 |

### 공격 결과

**A 악의적 준수** — 세 갈래로 시도했고 전부 뚫렸다.

1. **모집단 프레임 조작**: REQ-1은 population.csv 를 "300행 이상"으로만 요구하고 **어떻게 열거하는지**를 규정하지 않는다. 네이버 플레이스에서 "가격표 탭이 있는 업체"만으로 300행을 채우면, 그 위의 고정 시드 무작위 추출은 완벽히 무편향이지만 결과는 커버리지 80%가 나온다. **프레임 편향은 표본 추출 절차로 방어되지 않는다.** → **결함(치명)**
2. **분모 미정의**: REQ-6의 커버리지율에서 blocked·폐업·페이지 부재 행을 분모에 넣는지 빼는지가 계약 어디에도 없다. REQ-2가 사전등록하라고 요구하는 4개 항목((a)확인 정의 (b)채널 enum (c)축 배정 (d)임계값)에 **분모·제외 규칙이 빠져 있다.** D2는 REQ-6으로 이 문제를 명시적으로 다루는데 D1에는 대응물이 없다. 조사 후 분모 정의를 고르면 30%가 42%가 된다. → **결함**
3. **검증기 자체가 자작**: `validate_d1.py` 를 `sys.exit(0)` 한 줄로 작성하면 REQ-1~6 acceptance와 FORBID-1~6 detect가 **전부 동시에 통과**한다. F1(위반 픽스처 3종)·F2(4종)·F4(4종)에는 있는 "검증기가 실제로 위반을 잡는지 확인하는 메타 요구"가 D1에는 0건이다. → **결함(치명)**

**B 조건 회피**

- FORBID-2(표본 교체)는 replacement_log 의 사유 enum(closed/duplicate/out_of_region)만 요구하고 **교체 건수 상한도, 사유의 증거도 요구하지 않는다.** 예비표본 20건 = 표본의 20%. 가격이 안 보이는 업체 20건을 전부 "closed"로 선언해 교체하면 커버리지가 최대 20%p 부풀려지고 detect는 녹색이다. **FORBID-2의 `because`가 예언한 실패가 FORBID-2 자신의 예외 경로로 발생한다.** → **결함**
- FORBID-3의 허용 채널 enum에 `official_blog` 와 `instagram_public` 이 들어 있는데, FORBID-1의 `because` 는 "블로그 체험단 글에 적힌 가격"을 거짓 통과의 대표 사례로 지목한다. **같은 계약 안에서 한 FORBID가 금지 사유로 든 것을 다른 FORBID가 허용 enum에 넣었다.** "official" 판정 기준(업체 소유 확인)도 없다. → **결함**
- REQ-3은 100행 전부에 evidence_channel·access_method 를 빈 값 없이 요구하는데, 두 enum 어디에도 "어느 채널에도 페이지가 없음"에 해당하는 값이 없다(access_method는 anonymous_public/blocked 2개뿐). 가격이 없는 업체는 **반드시 조사하지 않은 채널을 기재해야 통과한다.** 조건이 좁아 데이터 날조를 강제하는 사례. → **결함**

**C 탐지 무력화** — 사전등록 잠금이 뚫린다.

REQ-2/FORBID-1의 방어선은 두 겹이다: (i) `sha256(protocol.md) == protocol.lock`, (ii) `protocol.lock` **최초 추가(--diff-filter=A) 커밋 시각 < ledger.checked_at 최소값**.
공격: ① 빈 임계값으로 protocol.md + lock 을 먼저 커밋(A 커밋 시각 확보) → ② 조사 수행, 수치 확인 → ③ protocol.md 의 임계값·"확인됨" 정의를 유리하게 **수정** → ④ lock 을 **재생성(M 커밋)** → sha 일치 ✅, lock 의 A 커밋 시각은 여전히 최초 ✅.
**두 검사를 모두 통과하면서 임계값이 사후 변경된다.** 게다가 `checked_at` 은 조사자가 CSV에 직접 타이핑하는 자기신고 값이고, 커밋 시각은 `GIT_COMMITTER_DATE` 로 임의 지정 가능하다. **D1의 존재 이유가 걸린 단 하나의 방어 장치가 무력하다.** → **결함(치명)**

또한 REQ-4의 "조사자 2인 독립 판정"은 `owner_agent: research-discovery` 단일 에이전트 태스크에서 **같은 주체가 evaluator_a·evaluator_b를 겸한다.** 블라인드(1차 판정 열람 금지) 규정이 없어 일치율 0.90은 자기 자신과의 일치율이다. → **결함**

**D 지름길 유도**

- 임계 낮추기: 위 C의 경로로 사후 조정 가능. **막지 못함**
- 표본 난이도 조절: A-1(프레임)·B-1(교체)로 가능. **막지 못함**
- 실패를 성공으로 삼키기: 가격 미발견 업체를 `blocked` 로 표기해 분모에서 제외 — 분모 규칙이 없으므로 합법. **막지 못함**
- 테스트 스킵: `validate_d1.py --all` 이 어떤 `--check` 를 포함해야 하는지 계약에 열거가 없다. **6개 중 3개만 돌려도 done_when 은 통과한다.** → **결함**
- 스코프 밖 파일 수정: touches 화이트리스트는 명확하나 이를 강제하는 path guard 잡의 소유자가 없다(F1 FORBID-5는 F1 자기 PR 한정). **부분적으로 막지 못함**

**E DAG 정합성**

- 순환 없음 ✅. `blocks: [F4, C1, C4]` 는 F4(depends_on: D1) ✅ / C1·C4(gate G1) ✅ 로 의도는 맞으나, **G1 게이트를 갖는 C2·C3·C5·C6·C7 중 일부만 열거**해 일관성이 없다. 정본 ID 문자열 불일치로 자동 검증 불가.
- **G1 결과의 하류 주입 형태가 없다(팀 리드 지정 항목 — 확인됨).** D1의 축별 판정은 `report.md` 산문/표로만 존재한다. 그런데 C1은 "G1 미통과 축은 시드에서 제외", F4 REQ-2는 "3축 각각 태그 5개 이상", C2·C3·C4·C5·C6은 done_when에 3축 균등 픽스처를 하드코딩한다. **기계 판독 가능한 축 활성화 산출물이 없으므로 하류는 3축 하드코딩을 유지할 수밖에 없고, 축 탈락 결과는 계약 체계에 도달하지 못한다.** → **결함**

**F 존재 이유** — 여기서 D1의 가장 큰 결함이 나온다.

- H1을 검증한다는 주장은 참이지만 **판정 해상도가 없다.** 축별 n=33 에서 p=0.40 의 Wilson 95% 구간은 약 **[0.25, 0.57]** 이다. 즉 G1의 세 구간(≥40% / 25~40% / <25%) **전부를 가로지른다.** FORBID-5는 n<30 일 때만 `inconclusive` 를 강제하므로 n=33은 "확정" 판정을 받는데, 그 확정값은 표본 3~4건으로 뒤집힌다. **PRD가 3축을 유지한 근거인 "축별 차등 판정"이 이 설계로는 측정 불가능하다.** FORBID-5의 n≥30 규칙은 통계적 근거 없는 관습값이고, 그 `because`가 서술한 실패(통과 가능한 축이 잘못 제외됨)를 방어하지 못한다. → **결함(치명)**
- H2 참조는 REQ-5(구조 유형 분류)로 실제 검증된다 ✅. 그러나 린캔버스 §7의 게이트 지표는 "회당가 **산출 가능** 비율 ≥40%"인데 D1의 G1 판정은 **노출율만** 사용한다. 노출 40% × 환산가능 80% = 32%로 실제 게이트 지표는 미달인데 `proceed` 가 나온다. REQ-5로 재료를 다 모으면서 판정에 쓰지 않는다. → **결함**

### 필수 수정 사항

1. **REQ-1에 모집단 프레임 구축 절차 추가** — 열거 소스·순서·완전성 검증(행정 인허가 데이터 또는 지도 격자 스윕 대비 누락율), 그리고 **"가격 노출 여부가 프레임 포함 조건이 되어서는 안 된다"**를 FORBID로. 프레임 편향은 시드 무작위화로 방어되지 않는다.
2. **커버리지 분모 규칙을 REQ-2 사전등록 항목 (e)로 추가** — blocked·폐업·페이지 부재 행의 분자/분모 처리를 protocol.md에 잠근다.
3. **FORBID-1 detect 교체** — sha 일치에 더해 **`git log --diff-filter=M -- protocol.lock` 이 공집합**임을 검사. 나아가 protocol.md/lock을 **선행 PR로 분리**할 것(이 경우 D1은 예외적으로 PR 2개가 정당하며 계약에 근거를 명시).
4. **축별 표본 수 또는 판정 규칙 중 하나를 고칠 것** — (a) 축별 n을 ~150으로 상향하거나, (b) verdict 규칙을 **Wilson 구간 기준**으로 재정의(구간이 임계선을 가로지르면 `inconclusive`). 현행 n≥30 규칙은 삭제하고 FORBID-5를 그에 맞게 재작성.
5. **기계 판독 가능한 G1 산출물 추가** — `docs/discovery/D1/g1_verdict.json`(축별 verdict·n·구간·적용 임계)을 artifacts와 REQ-6 acceptance에 명시. 하류(C1~C6·F4)가 3축 하드코딩 대신 이 파일을 읽도록 후속 계약에 지시.
6. **검증기 메타 요구 신설** — done_when에 "위반 픽스처 6종(잠금 훼손·표본 이탈·비허용 채널·중재 누락·n<30 확정판정·blocked+price_found=true)이 각각 대응 `--check` 를 실패시킴을 확인" 추가 + `--all` 이 포함해야 할 check 목록 열거.
7. **FORBID-2에 교체 상한(예: 5건) + 교체 사유 증거(스냅샷 URL·확인일) 요구.**
8. **FORBID-3 채널 enum 정리** — `official_blog` 를 "업체 소유·운영이 확인된 채널"로 한정하거나 제거. **채널별 커버리지 분해표**를 report.md에 요구하고, D3의 크롤 가능 소스 집합과 교집합을 취한 **"파이프라인 재현 가능 커버리지"**를 제2 verdict로 산출(현행 수치는 C2·C3가 재현할 수 없는 채널을 포함한다).
9. **REQ-3 enum 보강** — `not_found`(evidence_channel) / `no_public_page`(access_method).
10. **REQ-4에 블라인드·독립 평가자 규정** — 평가자 식별자, 1차 판정 비열람, 20건 추출 시드 명시. 단일 에이전트 수행이 불가피하면 그 한계를 report.md에 기재하도록 REQ화.
11. traces_to 에서 `KM-price-coverage` 제거 또는 린캔버스 §7 지표에 ID 부여. blocks/parallel_with 를 정본 ID 문자열로 교체.

---

## D2-SEO-SERP-FEASIBILITY — REVISE (BLOCKING)

### 규격 위반

| 항목 | 결과 |
|---|---|
| traces_to | **위반** — `KM-search-ctr` 미정의 ID. H3·G2 실재 ✅ |
| depends_on/blocks 정본 ID | **위반(형식)** — `blocks: [W4]` 는 `W4-COMBO-LANDING` 이어야 함 |
| acceptance 기계 검증 | **부분 위반** — 전부 자작 `validate_d2.py` exit 0. 메타 검증 없음 |
| requirements 8 초과 | 통과 (6개) |
| forbid 개수·5요소 | 통과 (5개, 5요소 완비) |
| **R-6 표집·홀드아웃** | **위반** — REQ-5의 "enterable ≥ 100"은 품질 임계인데 평가 대상(키워드 집합)과 판정 룰을 모두 구현자가 만든다. 홀드아웃 키워드셋 규정 없음 |
| **R-7 실환경 하한** | 형식상 충족(실제 SERP 실측)이나 **실측 증거가 CSV 자기신고뿐** — 원문 HTML·스크린샷 스냅샷 요구가 없어 실환경성이 검증되지 않는다. D3가 robots/ToS 스냅샷을 요구하는 것과 대비 |
| detect 대상 실재 | **위반** — `validate_d2.py` CI 미등재 |
| out_of_scope/touches/rollback | 통과 |

### 공격 결과

**A 악의적 준수 — 판정이 산술적으로 불가능하다(BLOCKING)**
REQ-3은 **검색량 상위 100개** 키워드에 대해서만 SERP를 실측한다. REQ-5는 `verdict = (해당 엔진 enterable ≥ 100)`. REQ-6은 blocked·no_volume_data 를 분자·분모에서 **제외**한다.
→ 측정 가능한 enterable 최대값 = 100 − (blocked + no_volume_data) ≤ 100.
→ **G2 `pass` 는 100개 전부가 enterable 이고 차단이 0건일 때만 성립한다.** 현실에서 발생하지 않으므로 D2는 정의상 항상 `fail` 을 산출한다. 반대로 이를 눈치챈 구현자는 "상위 100"의 의미를 늘리거나 임계를 재해석할 유인을 갖는다. → **결함(치명)**
H3는 "롱테일 100개 **이상**"이므로 ≥100을 입증하려면 100개보다 훨씬 많은 키워드를 실측해야 한다(예: 250~300 실측 → enterable ≥100).

**B 조건 회피**

- REQ-3의 "검색량 상위 100"에서 **어떤 검색량으로 정렬하는지**(google/naver/합/최대)가 미정의. 정렬 기준을 사후 선택하면 경쟁이 약한 키워드 집합을 고를 수 있다. → **결함**
- FORBID-2의 `when` 은 "enterable 이 100 미만으로 나온 이후"의 룰 완화·키워드 추가를 금지하나, detect는 `rule.lock 커밋 이후 keywords.csv 행 추가`를 본다. **단일 PR에서 커밋 재배열·squash 하면 "이후"라는 시간 관계 자체가 소멸한다.** D1과 동일한 lock 재생성 우회도 그대로 성립. → **결함**
- FORBID-5는 blocked 조합의 serp 행을 `collection_note='manual_recheck'` 이면 면제한다. **면제 조건이 자유 문자열 하나**여서 전부 그렇게 표기하면 우회된다(증거·재수집 방법 요구 없음). → **결함**

**C 탐지 무력화**

- FORBID-3(로그인/개인화 SERP 금지)의 detect는 **`capture_mode` 컬럼 문자열이 `incognito_no_login` 인지**만 본다. 이 컬럼은 조사자가 직접 타이핑한다. **위반한 사람이 위반하지 않았다고 적으면 통과한다.** `because` 가 "G2는 이 수치 하나로 갈린다"고 쓴 그 지점이 무방비다. → **결함(치명)**
- REQ-2의 "google_volume == naver_volume 인 행 ≤ 5%"는 복붙 방지 의도가 훌륭하나 ±1 지터로 무력화된다. 원본 도구 export 파일(해시 포함) 요구가 없다. → **결함**
- `validate_d2.py --all` 이 `sys.exit(0)` 이면 전 acceptance·전 detect 통과(D1과 동일 구조).

**D 지름길 유도** — "상위 100" 선정 기준 조작, manual_recheck 남용, capture_mode 허위 기재, 그리고 **어려운 키워드를 `no_volume_data` 로 표기해 REQ-6의 제외 규칙으로 정당하게 삭제**(FORBID-4는 "추정치 기입"만 금지하고 "실측 가능한데 no_volume_data 표기"는 막지 않는다). 전부 **막지 못함**.

**E DAG 정합성**

- `blocks: [W4]` 뿐이다. PRD §4는 "G1·G2·G3 통과 전에는 Phase 2 **이후** 태스크를 착수하지 않는다"고 규정하고 W1-SEO-FOUNDATION 은 Phase 3다. **G2 실패 시 재설계 대상인 SEO 기반(W1) 전체가 D2에 어떤 의존도 갖지 않으며 W1.gate 는 null 이다.** FORBID-1의 `because` 가 서술한 실패("W1·W4에 SEO 개발을 전부 투입")를 DAG가 막지 못한다. → **결함**
- 순환 없음 ✅.

**F 존재 이유** — H3·G2 검증 태스크로서 대상은 정확하며, 구글/네이버 분리 측정(FORBID-1)은 이 배치에서 가장 제품에 밀착한 조항이다 ✅. 다만 A의 산술 모순 때문에 **판정 산출이라는 존재 이유가 구조적으로 달성 불가**하다.

### 필수 수정 사항

1. **REQ-3의 SERP 실측 대상을 ≥250 키워드로 확대**하고 REQ-5의 통과 조건 `enterable ≥ 100` 유지. 실측 규모가 PR 1개를 넘는다면 D2를 "키워드·검색량"과 "SERP·판정" 두 태스크로 분할.
2. **"상위 N" 정렬 기준을 keyword_rule.md 에 사전 고정**하고 rule.lock 대상에 포함.
3. **FORBID-3 detect 교체** — capture_mode 자기신고 대신 **SERP 원문 HTML 또는 스크린샷 스냅샷 + sha256 을 행마다 요구**하고, 스냅샷에 로그인 상태 지표(계정 아바타 등) 부재를 검사.
4. **FORBID-4에 조항 추가** — 실측 가능한 키워드를 `no_volume_data` 로 표기 금지, detect는 동일 도구 재조회 표본 검사.
5. **FORBID-5의 manual_recheck 면제에 증거 요구**(재수집 시각·캡처 파일 참조 필수).
6. **rule.lock 잠금 검증 강화**(lock 파일 M-커밋 부재 검사) 또는 룰 PR 선행 분리.
7. **D2.blocks 에 W1-SEO-FOUNDATION 추가 + W1 계약에 gate: G2 반영 요청.**
8. done_when에 위반 픽스처 5종 메타 검증 추가. traces_to 정리, 정본 ID 사용.

---

## D3-SOURCE-DUE-DILIGENCE — REVISE

### 규격 위반

| 항목 | 결과 |
|---|---|
| traces_to | G3 ✅ H1 ✅ / **H2 는 사실상 무관** — D3는 소스 접근 가능성이지 가격 구조 파싱 가능성이 아니다 |
| depends_on/blocks 정본 ID | **위반(형식)** — `[C2, C3]` |
| acceptance 기계 검증 | 부분 위반 — 전부 자작 `validate_d3.py`. 단 REQ-5(rate probe)는 실제 네트워크 관측이라 이 배치 중 검증 가능성이 가장 높다 ✅ |
| requirements 8 초과 | 통과 (6개) |
| forbid | 통과 (5개, 5요소 완비, because 구체적) |
| R-6 | 해당 없음 — 품질 임계 REQ 부재 |
| **R-7 실환경 하한** | **통과** — REQ-5 rate probe가 실제 요청·실제 응답코드를 요구한다. 이 배치에서 R-7을 명확히 충족하는 유일한 조사 태스크 ✅ |
| detect 대상 실재 | **위반** — `validate_d3.py` CI 미등재. 추가로 **`crawl_policy.yaml` 을 읽는 하류 검사가 존재하지 않는다**(아래 E) |
| out_of_scope/touches/rollback | 통과. rollback에 "차단 발생 시 revert로 복구 불가"를 명기한 점은 정직하다 ✅ |

### 공격 결과

**A 악의적 준수 — 전량 forbidden 이면 계약이 100% 녹색이다.**
6개 소스 전부에 `verdict=forbidden` 을 부여하면:
REQ-3(conditional 대상) 공허 통과 · REQ-4(≠forbidden 집합 = ∅ = republish 표 ∅) 통과 · REQ-5(conditional별 20행 → 대상 0) 공허 통과 · REQ-6(어댑터 목록 = ∅ 이 verdicts와 일치) 통과 · FORBID-1~5 전부 발동 조건 미달.
**결과: 크롤링 가능한 소스가 하나도 없다는 결론이 계약을 완벽히 준수하며, 제품은 그 자리에서 죽는다.** 계약에는 allowed/conditional 최소 개수도, 확보해야 할 필드 커버리지 하한도 없다. REQ-6은 "커버리지 손실 구간 기재"만 요구하고 **상한을 두지 않는다.** → **결함(치명)**
대칭 공격도 성립: verdict_rule.md 를 느슨하게 써 전량 conditional 로 만들어도 통과한다(룰 내용에 대한 제약이 0).

**B 조건 회피**

- FORBID-1 detect는 "`allowed_path_globs` **샘플 경로**가 Disallow 에 매칭되면 실패"인데 **샘플 경로를 조사자가 고른다.** 실제 수집 경로는 Disallow 이면서 샘플만 허용 경로로 두면 통과. → **결함**
- FORBID-3(요청률 초과 금지) detect는 `인접 요청 간격 ≥ 60/max_requests_per_min`. **`max_requests_per_min` 을 조사자가 정한다.** rpm=1로 두면 60초 간격 20회 = 20분에 무조건 429/403 0건 → REQ-5 통과 → conditional 확정. 그러나 rpm=1로는 강남3구 수천 업체 수집이 수일~수주가 걸려 C1~C3가 사실상 동작 불가. **규칙을 완벽히 지키면서 파이프라인을 마비시킬 수 있다.** → **결함(치명)**
- FORBID-2(ToS 미확보 시 allowed 금지)는 `conditional` 로의 도피를 명시 허용한다. 그런데 conditional 은 REQ-3만 채우면 **어댑터 구현 대상에 포함된다**(REQ-6: ≠forbidden 전부). 결과적으로 ToS 미확보 소스가 크롤링 대상이 된다. `must_not` 이 allowed 만 막는 것은 조건이 지나치게 좁다. → **결함**

**C 탐지 무력화**

- robots·ToS 스냅샷은 조사자가 저장한 파일이고 sha256도 그 파일에 대해 스스로 계산한다. **원본 URL 재취득 대조가 없어** 편집된 스냅샷을 탐지할 수 없다.
- REQ-5의 20회 프로브로는 rate limit 을 알 수 없다. 실무상 차단은 수백~수천 요청 후 또는 일일 쿼터 초과에서 발생한다. **20회 무사통과를 "429·403 = 0 확인"으로 기록하면 C2·C3는 검증되지 않은 파라미터로 대규모 수집에 들어간다.** 탐지가 형식적으로 존재하나 실제 위험을 포착하지 못한다. → **결함**
- `validate_d3.py` sys.exit(0) 문제는 D1·D2와 동일.

**D 지름길 유도** — rpm 하향, 샘플 경로 선택, ToS 미확보 시 conditional 도피, 커버리지 손실 구간을 근거 박약한 값으로 기재(REQ-6은 "산출 근거 파일 경로 참조"만 요구하고 산출 방법을 규정하지 않음). 전부 **막지 못함**.

**E DAG 정합성**

- `blocks: [C2, C3]` ✅. 그러나 **C1 은 `sources.allowlist.yaml` 을 소유하며 G3 결과를 반영해야 하는데 D3.blocks 에 없다.**
- **더 심각: D3의 산출물이 코드에 도달하는 경로가 없다.** D3는 `docs/discovery/D3/crawl_policy.yaml` 을 만들고 C1은 별개로 `services/crawler/config/sources.allowlist.yaml` 을 만든다. **두 파일을 대조하는 CI 검사를 소유한 태스크가 없다.** G3 판정은 문서로만 존재하고 크롤러는 그와 무관하게 동작할 수 있다. FORBID-1·3이 지키려는 대상이 런타임에 도달하지 않는다. → **결함(치명)**
- 순환 없음 ✅.

**F 존재 이유** — G3의 입력 산출이라는 주장은 타당 ✅. 다만 **REQ-1의 소스 6개 중 "업체 공식 웹사이트"·"공개 인스타그램 프로필"은 단일 소스가 아니다.** 업체 공식 웹사이트는 수백~수천 개 독립 도메인이며 각자 다른 robots.txt·ToS 를 갖는다. 계약은 `snapshots/robots/<source>.txt` 파일 1개로 이 클래스를 판정하게 하는데 범주 오류이고, **D1이 실측할 가격 노출 채널 중 큰 축(업체 자체 웹사이트)이 실질적으로 미판정으로 남는다.** 도메인별 런타임 robots 검사를 소유하는 태스크도 없다. → **결함**

### 필수 수정 사항

1. **REQ 신설 — 소스 커버리지 하한**: allowed+conditional 집합이 (상호·주소·좌표·영업시간·가격) 5개 필드를 각각 최소 1개 소스에서 확보 가능함을 입증. **예상 커버리지 손실 상한(예: ≤35%) 초과 시 `g3_blocked` 로 두고 에스컬레이션.** 전량 forbidden 이 조용히 통과하는 경로를 닫는다.
2. **REQ-3에 처리량 하한 추가** — `max_requests_per_min` 이 "대상 업체 수 / 허용 수집 주기"로 산출된 필요 처리량 이상임을 검사.
3. **REQ-5 프로브 규모 상향** — 20회 → 연속 30분 이상 또는 200회 이상, 일일 쿼터·누적 차단 관측 기록.
4. **FORBID-1 detect 교체** — 조사자가 고른 "샘플 경로"가 아니라 **`allowed_path_globs` 전체와 robots 규칙의 교집합 검사**.
5. **FORBID-2 확대** — REQ-6의 어댑터 목록을 "allowed ∪ (conditional ∧ tos_confirmed=true)"로 재정의.
6. **"업체 공식 웹사이트" 클래스 분리** — 도메인별 런타임 robots 준수(요청 직전 fetch·캐시·준수)를 요구사항으로 명시하고 구현 소유 태스크(C1)를 지정. 단일 스냅샷 판정 대상에서 제외.
7. **D3 산출물 → 코드 연결 소유자 지정** — `crawl_policy.yaml` 이 `sources.allowlist.yaml` 및 요청률 설정의 **유일한 원천**임을 명시하고 정합성 CI 잡의 소유 태스크(C1)를 적시. 그 전까지 FORBID-1·3은 문서상 규칙이다.
8. **스냅샷 재취득 대조** 요구 추가. `blocks` 에 C1 추가, 정본 ID 사용, traces_to 에서 H2 제거.

---

## D4-MEDICAL-AD-GUARDRAIL — REVISE

### 규격 위반

| 항목 | 결과 |
|---|---|
| traces_to | G3(성격 불일치, 아래 F) · **H1 무관** — D4는 가격 노출율을 검증하지 않는다. S1·S3 는 타당 ✅ |
| depends_on/blocks 정본 ID | **위반(형식)** — `[F4, C4, C7, W3]` |
| acceptance 기계 검증 | 통과 — 골든 케이스 기대값 100% 일치는 이 배치에서 가장 견고한 형태 ✅(단 자작 데이터) |
| requirements 8 초과 | 통과 (6개) |
| forbid | 통과 (5개) 단 FORBID-1 `must_not` 문장이 자기모순(아래 B) |
| **R-6 표집·홀드아웃** | **위반** — REQ-2·3·4는 "기대값과 100% 일치" 임계를 갖는데 케이스·정답 라벨·규칙을 모두 같은 사람이 만든다. 모집단·표집 절차·홀드아웃 규정 0건 |
| **R-7 실환경 하한** | **위반** — 전 REQ가 자작 yaml + 자작 골든 케이스만으로 충족된다. 실제 업체 가격 표기 문자열 표본이 단 1건도 요구되지 않는다 |
| detect 대상 실재 | **위반** — `validate_d4.py` CI 미등재. FORBID-4(golden immutable)는 base 리비전 대조인데 **이 PR이 파일을 최초 생성하므로 생성 시점엔 공허하고, 이후 검사를 돌릴 CI 잡의 소유자도 없다** |
| out_of_scope/touches/rollback | 통과 |

### 공격 결과

**A 악의적 준수 — 과잉 차단이 완전히 합법이다.**
`display_whitelist.yaml` 에 극도로 좁은 포맷 5개(예: 정확히 `N회 M원` 형태만)를 정의하고 golden_cases 의 show 15건을 그 포맷에 맞춰 작성하면 REQ-2·6이 통과한다. `default_action: hide` 이므로 현실의 medical 가격 문자열 대다수가 hide 로 떨어지고 C7은 medical_wellness 축을 사실상 전량 비공개 처리한다.
FORBID-5는 **다른 축으로 규칙이 번지는 것**만 막을 뿐 **medical 축 내부의 과잉 차단은 아무것도 막지 않는다.** FORBID-3의 `because` 가 "안전빵으로 규칙을 넓게 잡아 medical_wellness 축 전체가 사실상 비공개 처리되면 3축 중 하나가 제품에서 소멸한다"고 정확히 예측해 놓고 그 실패를 막는 조항이 계약에 없다. → **결함(치명)**
반대 방향도 마찬가지다: 화이트리스트를 `.*` 에 가깝게 쓰고 hide 케이스만 피해 가도록 조정할 수 있으며, hide 케이스 역시 자작이다.

**B 조건 회피**

- **FORBID-1 `must_not` 이 자기모순이다.** "기본 동작을 show 또는 needs_review **이외의** 노출 계열 값으로 정의" — 문자 그대로 읽으면 `needs_review` 가 허용된다. 그러나 REQ-6·detect는 `default_action == 'hide'` 를 강제한다. 개발 에이전트가 `must_not` 을 근거로 `needs_review` 기본값을 고르면 규칙과 탐지가 충돌한다. → **결함**
- **FORBID-3의 legal_basis 정규식이 실무를 배제한다.** 허용 법령이 (의료법/시행령/시행규칙/표시광고법) 4종뿐인데, 비급여 진료비용 표시의 실질 근거는 **고시**(비급여 진료비용 등의 공개에 관한 기준)와 자율심의기구 **의료광고 심의기준**인 경우가 많다. 정확한 근거를 쓰면 정규식 불통과 → 통과시키려면 **의료법 제56조를 기계적으로 갖다 붙이게 된다.** 규칙이 허위 인용을 강제하고, FORBID-3의 목적(6개월 뒤 추적 가능성)이 정확히 반대로 달성된다. → **결함**
- FORBID-2는 `status: advisory` + `advisory_index` 등재를 예외로 둔다. **advisory 항목 수 상한이 없다.** 전 규칙을 advisory 로 등재하면 rule_id 는 다 붙고 기계 판정 가능한 규칙은 0개가 된다. → **결함**

**C 탐지 무력화**

- REQ-3의 "정규식 20개 + 골든 40건 100% 일치"는 **같은 사람이 정규식과 케이스를 함께 쓰므로 항상 100%가 나온다.** 규칙 품질이 아니라 자기일관성만 측정한다.
- FORBID-4(골든 불변)의 detect는 base 리비전 대조인데 이 PR이 파일을 최초 생성하므로 **생성 시점에 쉬운 케이스를 넣는 것은 전혀 막히지 않는다.** §2.1이 경고한 "쉬운 시험지 봉인"이 그대로 실현된다.
- `validate_d4.py` 를 ci.yml에 등록하는 태스크가 없어, 하류(C4 FORBID-5·C7 FORBID-5·W3)가 인용할 시점에 규칙을 자동 집행하는 주체가 없다.

**D 지름길 유도** — advisory 남용, 법령 오인용, 좁은 화이트리스트로 전량 hide(가장 안전해 보이므로 에이전트가 선택할 확률이 높다), golden show 케이스를 화이트리스트에서 역산해 작성. 전부 **막지 못함**.

**E DAG 정합성**

- `blocks: [F4, C4, C7, W3]` 중 **F4만 상호 참조가 성립한다.** C4.depends_on = [C1, F2](D4 없음), C7.depends_on = [C4, C6], W3.depends_on = [W1]. **하류 3건 어디에도 D4 의존이 없고, D4를 강제하는 게이트도 없다**(PRD의 G3는 크롤링 소스 실사이지 의료광고 실사가 아니다).
  → **C4·C7·W3는 D4 산출물 없이 착수·머지 가능하며, 그 상태에서 C4 FORBID-5·C7 FORBID-5의 detect(`public_price_display` 가 D4 허용 포맷에 속하는지)는 참조 대상 부재로 공허 통과한다.** 의료광고법 방어선 전체가 DAG상 연결되어 있지 않다. → **결함(치명)**
- 순환 없음 ✅.

**F 존재 이유**

- S3(에디터 리포트)·S1은 REQ-4·REQ-2로 실제 연결된다 ✅.
- **G3 참조는 성격 불일치**다. PRD §4의 G3는 "크롤링 소스 법적·기술적 실사"로 D3 소관이다. D4는 어떤 PRD 게이트의 입력도 아니며 그 결과 위 E의 미강제 상태가 발생한다.
- **H1 참조는 거짓이다.** D4는 가격 노출율을 측정하지도 사용하지도 않는다.

**하류가 인용 가능할 만큼 구체적인가(팀 리드 지정 항목)** — **형식은 충분, 내용은 미검증.**
`rule_id` 정규식 `^MED-[A-Z]-\d{2}(-X)?$`, `default_action`, pattern/enum 필수화, 판정 출력 enum(show/hide/needs_review), 골든 케이스 — 이 조합은 하류가 인용하기에 형식적으로 충분하며 이 배치에서 가장 잘 설계된 인터페이스다 ✅. **그러나** (i) 규칙 내용이 실제 문자열 분포와 대조된 적이 없고, (ii) 하류 3건이 D4에 의존하지 않으며, (iii) 검증기가 CI에 없다. 따라서 **C·W 태스크의 medical FORBID는 "인용할 대상은 있지만 집행되지 않는" 상태가 된다.**

### 필수 수정 사항

1. **REQ 신설 (R-7) — 실제 관측 문자열 하한**: D1 ledger 의 `axis=medical_wellness ∧ price_found=true` 행의 `price_evidence_snippet` 전량(또는 규정된 표본)에 규칙을 적용해 (a) 판정 분포 보고 (b) **`hide` 비율 상한** (c) hide 전건 수동 검토 기록을 요구. 없으면 A(과잉 차단)를 막을 수 없다.
   → 이 REQ는 D1 산출물을 요구하므로 **D4.depends_on 에 D1 추가**가 필요하다. 병렬성을 유지해야 하면 D4를 "규칙 정의"와 "실데이터 캘리브레이션"으로 분할하고 후자를 D1 이후에 배치.
2. **REQ-2·3·4에 홀드아웃 규정 (R-6)** — 골든 케이스 30%를 개발 중 열람 불가한 홀드아웃으로 분리, 최종 판정은 홀드아웃에서. 케이스마다 출처(실관측/합성) 필드와 **실관측 비율 하한**.
3. **FORBID-1 `must_not` 재작성** — "`default_action` 을 `hide` 이외의 값으로 정의"로 단순화.
4. **FORBID-3 정규식 확장** — 고시·자율심의기준·의료기기법을 허용하되 `(법령명|고시명) 제N조|제N항|고시 제N호` 형태의 조문 단위 특정을 요구. 현행은 허위 인용을 강제한다.
5. **FORBID-2에 advisory 상한**(예: 전체의 20%) 및 각 advisory 에 기계화 마감 기한 필드.
6. **과잉 차단 방지 FORBID 신설** — `when: display_whitelist 변경으로 D1 medical 표본의 show 비율이 직전 대비 N%p 이상 하락 / must_not: 근거 조문·영향 분석 없이 머지 / detect: 표본 재판정 diff CI`.
7. **CI 등재 소유자 지정** — `validate_d4.py` 를 ci.yml 잡으로 등록(touches 에 ci.yml 추가). CI 잡이 없으면 FORBID-4는 존재하지 않는 규칙이다.
8. **DAG 수정 요청** — C4·C7·W3 의 depends_on 에 `D4-MEDICAL-AD-GUARDRAIL` 추가를 하류 계약 저자에게 전달. traces_to 에서 H1 제거, G3 참조를 별도 게이트로 재정의. 정본 ID 사용.

---

## F1-REPO-SCAFFOLD — REVISE

### 규격 위반

| 항목 | 결과 |
|---|---|
| traces_to | H3 ✅ / **S4 오참조** — S4는 "리드 액션 계측"(린캔버스 §5)이며 `why` 의 "앱 확장 가능한 API 경계"는 PRD §2 기술 스택 결정이지 S4가 아니다 |
| **blocks 가 폐기 태스크 참조** | **위반** — `blocks: [F2, F3, F4, O3]` 의 F3는 DAG 정본에서 "폐기 · 신규 참조 금지" |
| blocks 비대칭 | **위반** — F4.depends_on = [D1, D4] 로 F1을 포함하지 않는데 F1이 F4를 blocks. 반대로 **DS1·DS3 는 depends_on 에 F1 을 갖는데 F1.blocks 에 없다** |
| depends_on 순환 | 통과 |
| PR 1개 원칙 | 통과 — 스캐폴딩은 쪼개면 중간 상태가 동작하지 않음(§4) ✅ |
| 주관적 형용사 | 통과 |
| acceptance 기계 검증 | 통과 — 전 REQ가 CI 잡/파싱 테스트로 판정 가능 ✅ 이 배치 최고 |
| REQ '그리고' 결합 | **위반** — REQ-5가 (6개 잡 존재)+(wall-clock ≤10분) 두 요구를 결합 |
| requirements 8 초과 | 통과 (7개) |
| forbid 개수·5요소 | 통과 (5개, 5요소 완비) |
| R-6 | 해당 없음 |
| R-7 | 실질 충족 — CI가 실제 러너에서 실행되는 것이 곧 실환경 ✅. done_when의 위반 픽스처 3종 요구는 §2.2 취지를 정확히 구현한 모범 ✅ |
| **touches vs done_when 모순** | **위반** — done_when이 "README 에 워크스페이스 경계 다이어그램…포함"을 요구하는데 **README 가 touches 화이트리스트에 없다.** FORBID-5는 touches 밖 경로 1건이라도 있으면 exit 1 → **자기 done_when 이행이 자기 FORBID-5 위반이 된다.** `.python-version` 도 artifacts·REQ-7에 등장하나 touches 경로가 불명 |
| rollback | 통과 — 브랜치 보호 해제까지 언급 ✅ |

### 공격 결과

**A 악의적 준수**

- REQ-5의 "wall-clock ≤ 600s"는 **잡 내용이 비어 있을수록 쉽게 충족된다.** F1 시점엔 자동 충족이고, 무겁게 만드는 태스크(F2의 Postgres+PostGIS, C의 pytest)가 이 제약을 상속한다. 계약은 임계만 걸고 **어떤 검사를 반드시 포함해야 하는지**를 규정하지 않으므로 미래의 우회는 "테스트를 잡에서 빼기"가 된다. → **결함(중)**
- REQ-1 "정확히 4개 패키지" + CI assert 는 **확장 프로토콜이 없다.** DS1·DS2·DS7 은 이를 알고 `packages/config/test/workspace.test.ts` 수정 1건을 자기 touches 에 명시했다. 그러나 **C4·C5·C6·C7 은 `packages/pipeline/**` 를 touches 로 가지면서 `packages/config` 를 건드리지 않는다.** → packages/pipeline 을 만드는 순간 build 잡이 실패하고 어떤 C 태스크도 기대값을 고칠 권한이 없다. 게다가 **`packages/pipeline` 의 package.json 을 만드는 태스크가 리포 전체에 존재하지 않는다.** → **결함(치명, 교착)**

**B 조건 회피**

- FORBID-2의 `when` 은 "`eslint-disable` 신규 추가"를 포함한다. 정당한 disable(생성 코드, 서드파티 타입 우회)이 반드시 발생하며 예외 경로가 없다 → **원칙 2가 예고한 대로 첫 예외에서 깨진다.** 깨지는 순간 이 조항이 보호하려던 `continue-on-error` 금지까지 협상 대상이 된다. `because` 가 그 위험을 정확히 서술해 놓고 규칙 형태가 그 위험을 자초한다. → **결함**
- FORBID-4는 `when` 을 "라우트 세그먼트 또는 루트 레이아웃에 **기본값으로** 설정"으로 좁게 썼으나 `detect` 는 "apps/web 소스에 해당 3개 토큰이 존재하면 실패"로 **전역 grep**이다. when ⊂ detect 로 범위가 어긋나 W6 리드 계측·W7 폼 등 정당한 동적 라우트에서 규칙이 깨진다. → **결함**

**C 탐지 무력화**

- FORBID-1 detect(dependency-cruiser + 위반 픽스처 메타 테스트)는 이 배치에서 유일하게 **탐지기 자체를 검증**한다 ✅ **방어됨.**
- FORBID-5 detect(`git diff --name-only origin/main` vs touches)는 **범위가 불명확**하다. 영구 CI 잡이면 F2(packages/db/migrations/**)를 즉시 차단하고, F1 PR 한정이면 이후 어떤 태스크의 touches 도 강제되지 않는다. 그런데 **DS3 done_when("CI path guard 통과"), C2·C3 FORBID(diff 경로 검사)는 범용 path guard 존재를 전제한다.** F1은 그 메커니즘을 산출물로 정의하지 않는다. → **결함 — 하류가 존재하지 않는 검사를 전제하고 있다**

**하류가 전제하는 detect 기반 점검 (팀 리드 지정 항목)**

| 하류가 전제하는 것 | F1이 제공하는가 |
|---|---|
| 모노레포 경계(web→db import 금지) | ✅ REQ-3 + FORBID-1, 위반 픽스처까지 |
| dependency-cruiser 설정 파일(W4 detect가 인용) | ✅ `.dependency-cruiser.cjs` |
| 태스크별 touches path guard (DS3·C2·C3) | ❌ **없음** |
| apps/web·API 소스의 base 테이블명 grep 잡 (C7 FORBID-1) | ❌ **없음** (C7 touches 에도 ci.yml 없음 → 소유자 부재) |
| 크롤러 어댑터 레지스트리 (C3 REQ-1) | ❌ **없음** (C1~C7 감사에서도 소유자 부재로 지적) |
| `scripts/discovery/*.py` 실행 툴체인 (D1~D4 acceptance) | ❌ **없음** — Python 툴체인은 services/crawler 에만 |
| `packages/pipeline` 워크스페이스 (C4~C7) | ❌ **없음 + REQ-1이 금지** |

**D 지름길 유도** — CI가 빨개졌을 때의 우회는 FORBID-2가 정면으로 막고 있어 설계가 좋다 ✅. 다만 예외 경로 부재가 규칙 수명을 깎는다(B). "패키지 수 기대값을 몰래 5로 바꾸기"는 F1 이후 어떤 FORBID도 막지 않는다.

**E DAG 정합성** — F3 폐기 참조, F4 비대칭, DS1·DS3 누락, 정본 ID 미사용. `depends_on: []` ✅, gate null ✅(PRD §4 "Phase 1은 게이트 무관"과 일치).

**F 존재 이유** — "이후 모든 태스크의 FORBID가 탐지 수단을 갖지 못한다"는 `why` 는 정확하며 C·W·DS 다수가 F1의 CI를 전제한다 ✅. 다만 위 표에서 보듯 **전제되는 탐지 기반 중 5개를 제공하지 않는다.** traces_to 의 S4는 거짓.

### 필수 수정 사항

1. **REQ-1 재작성** — "정확히 4개" 대신 **패키지 매니페스트 파일**을 원천으로 두고 패키지 추가 시 1줄 갱신을 허용하는 확장 프로토콜 명시. 그리고 **`packages/pipeline` 의 소유 태스크를 DAG에 지정**(F1이 골격만 만들거나 별도 태스크 신설) — 현재 C4~C7은 만들 수 없는 패키지에 코드를 넣게 되어 있다.
2. **범용 path guard 를 F1 산출물로 승격** — 태스크 ID → touches 글롭 매니페스트 + PR diff 대조 CI 잡. DS3·C2·C3가 이미 전제하므로 소유자를 F1로 확정하고 FORBID-5 detect를 그 잡의 첫 사용 사례로 재작성.
3. **REQ-5 분리** — REQ-5a(6개 잡 존재)/REQ-5b(wall-clock). 5b에는 "잡 내용 축소로 시간을 맞추는 것 금지"에 해당하는 최소 검사 집합 명시.
4. **FORBID-2에 예외 경로 편입** — `eslint-disable` 은 (규칙명 명시 + 사유 주석 + `--report-unused-disable-directives`) 충족 시 허용, `continue-on-error`·`|| true`·`depcruise-disable` 은 무예외 유지.
5. **FORBID-4의 when ↔ detect 범위 일치** — grep 대상을 라우트 세그먼트 설정 파일로 한정하거나 예외 허용 라우트 화이트리스트를 선언.
6. **touches 에 `README.md`·`.python-version` 명시 경로 추가**(현행은 done_when 이행이 FORBID-5 위반).
7. **blocks 에서 F3 제거, DS1·DS3 추가, F4 제거(또는 F4.depends_on 에 F1 추가 요청).** 정본 ID 사용. traces_to 에서 S4 제거.
8. **C7이 요구하는 base 테이블명 grep 잡의 소유자 지정** — F1 `boundary` 잡 확장 또는 C7 touches 에 ci.yml 추가 요청.

---

## F2-SCHEMA — REVISE (BLOCKING · 이 배치 최우선)

### 규격 위반

| 항목 | 결과 |
|---|---|
| traces_to | H1·H2·S1·G4 전부 실재 ✅ |
| depends_on | `[F1]` ✅ (형식은 정본 ID 아님) |
| **parallel_with 폐기 태스크 참조** | **위반** — `[F3, O3]` 의 F3 |
| depends_on 순환 | 통과 |
| PR 1개 원칙 | 통과(현행 범위 기준). 하류 정합화 반영 시 재평가 필요 |
| 주관적 형용사 | 통과 |
| acceptance 기계 검증 | 통과 — SQLSTATE 코드까지 지정한 REQ-3·4는 모범 ✅ |
| REQ '그리고' 결합 | REQ-4가 (confidence CHECK)+(price_conflict 테이블) 두 관심사를 결합 — 분리 권고 |
| requirements 8 초과 | 통과 (7개) |
| forbid | 통과 (6개, 5요소 완비) |
| R-6 | 해당 없음 |
| R-7 | 실질 충족 — 실제 Postgres+PostGIS 에 마이그레이션을 적용해야 통과 ✅. done_when 위반 픽스처 4종 요구도 적절 ✅ |
| **REQ 내부 모순** | **위반** — REQ-1 "정확히 7개 도메인 테이블" + 스냅샷 100% 일치 vs REQ-4 `price_conflict` 요구 + FORBID-5 `venue_suppression` 존재 assert = **최소 9개**. 어느 쪽을 구현해도 다른 쪽 테스트가 실패한다 |
| **detect 대상 실재** | **위반(하류 방향)** — 아래 C |
| touches vs done_when | **위반** — done_when 의 "packages/db/README" 가 touches 에 없음(F1과 동일 패턴) |
| out_of_scope / rollback | 통과 |

### 공격 결과

**A 악의적 준수 — REQ-1이 자기참조라 스키마 내용이 사실상 무제약이다.**
REQ-1의 판정은 "information_schema 질의 결과가 **커밋된 스냅샷 파일**과 일치"인데 그 스냅샷은 같은 PR에서 저자가 생성한다. 즉 REQ-1은 "이후 드리프트 금지"만 보장하고 **어떤 컬럼이 있어야 하는가는 전혀 강제하지 않는다.**
→ **하류 4~7건이 필요로 하는 컬럼이 하나도 없는 스키마가 F2 계약을 100% 준수한다. 실제로 그렇게 작성되어 있다.** → **결함(치명)**

**B 조건 회피**

- FORBID-4(성별 컬럼 금지)의 `when` 은 **venue / price_plan / need_tag 3개 테이블만** 대상으로 한다. `venue_need_tag`·`editor_report`·`lead_event`·`source_record` 에 `target_gender` 를 넣으면 통과한다. PRD "스키마는 넓게" 판단을 지키려면 스키마 전역이어야 한다. → **결함**
- FORBID-6의 정규식 `(name|phone|tel|email|ip_addr|raw_ip|lat|lng)` 은 부분 문자열 매칭이라 **`latency_ms`·`event_name`·`template_name`·`related_id` 같은 정당한 컬럼을 오탐**한다. 오탐이 나오면 개발자는 정규식을 완화할 것이고 그 순간 `phone` 도 함께 통과한다. → **결함**
- FORBID-1은 DROP TABLE/COLUMN/TRUNCATE/ALTER TYPE 만 막는다. **REQ-6의 append-only 를 지탱하는 트리거를 `DROP TRIGGER` 로 제거하는 마이그레이션은 통과**한다. 원문 보존이라는 `because` 의 핵심이 우회 가능. → **결함**

**C 탐지 무력화**

- FORBID-1 detect의 sha256 매니페스트 파일 자체가 리포에 있고 CODEOWNERS 보호가 명시되지 않았다. 매니페스트를 함께 갱신하면 통과.
- **하류 방향의 공허 통과가 이 감사의 핵심이다.** C7 REQ-1의 acceptance 는 "`is_public` 대상 INSERT/UPDATE 를 포함한 파일이 quality/publish.ts 1개인지 grep". F2 스키마에는 `is_public` 이 없고 `visibility` 가 있다. → 코드가 `visibility` 에 쓰면 **grep 결과 0건 → C7 REQ-1 통과 → 게이트 우회 경로는 열린 채 CI 녹색.** §5 신설 항목의 교과서적 사례이며 같은 구조가 C4 FORBID-5(`public_price_display`)·C5 FORBID-3(`venue_source_record`)에서 반복된다. → **결함(치명)**

**D 지름길 유도** — 스냅샷 재생성으로 REQ-1 통과(A), 매니페스트 동시 갱신으로 FORBID-1 통과(C), 정규식 완화로 FORBID-6 통과(B). **세 방어선이 전부 "같은 PR 안에서 기준 파일을 함께 고치면" 무력화된다.** 공통 처방: 기준 파일(스냅샷·매니페스트·정규식 사전) 변경에 별도 승인 라벨을 요구.

**E DAG 정합성** — `blocks: [C1, C4, C5, C7, W1, W3, O2]` 는 하류 depends_on 과 대체로 일치 ✅(C6은 C5 경유, W2/W4/W5/W7 은 W1 경유). parallel_with 의 F3 참조는 폐기 위반. 순환 없음 ✅.

**F 존재 이유** — "가격 신뢰도·공개여부·소스 충돌을 스키마 레벨에서 표현" ✅ 은 정확한 문제 정의이고, `visibility` 4값 ENUM은 PRD G4("미달 데이터는 비공개, 삭제 아님")와 W7 삭제요청·C7 품질·D4 법적 사유를 **모두 구분해 담을 수 있는 우월한 모델**이다. 문제는 존재 이유가 아니라 **범위와 어휘가 하류와 단절**된 것이다.

### F2 ↔ 하류 정합성 표 (팀 리드 지정 항목: F2가 하류가 필요로 하는 것을 표현할 수 있는가)

| 하류가 인용하는 객체 | 인용 태스크 | F2에 존재? | 판단 |
|---|---|---|---|
| `is_public` (boolean) | C7, W1, W2, W4, W5, W7, O2 (**7건**) | ❌ (`venue.visibility` ENUM) | **어휘 충돌 — 하류를 F2로 통일** |
| `quality_score`, `reason_codes[]` | C7, O2 | ❌ | **F2 확장 필요** |
| `public_venue` 뷰 | C7, W1, W2, W4 | ❌ (C7 touches 소유) | 뷰는 C7 유지, 단 base 계약을 F2가 확정 |
| `canonical_venue`, `venue_canonical_link`, `merge_candidate` | C5 | ❌ | **F2 확장 또는 C5에 마이그레이션 소유권 부여** |
| `venue_source_record` | C5, C7 | ❌ (`source_record`) | **어휘 충돌 — 하류를 F2로 통일** |
| `venue_price` | C7 | ❌ (`price_plan`) | **어휘 충돌 — 하류를 F2로 통일** |
| `venue_tag` + `model_id`·`prompt_hash`·`assignment_method` | C6 | ❌ (`venue_need_tag`, 컬럼 미정의) | **어휘 충돌 + F2 확장 필요** |
| `price_per_month_krw`, `period_days`, `unit_type` | C4, C7 | ❌ | **F2 확장 필요** |
| `public_price_display` | C4, C7 | ❌ | **F2 확장 필요**(소유는 C7으로) |
| 검수 오버라이드 레이어 | O2 | ❌ | **F2 확장 필요**(C7 판정 컬럼과 분리 저장) |
| `price_conflict` | W2, W3, C7 | ✅ REQ-4 | 정합 ✅ |
| `price_plan.confidence`, `price_per_session`, `failure_reason` | C4, W2, W3 | ✅ | 정합 ✅ |
| `venue_suppression` | W7(개념), F2 FORBID-5 | ✅ 단 REQ-1의 "7개"와 충돌 | 내부 모순 |

**권고: F2를 확장한다 — 단 어휘 충돌은 하류를 F2에 맞춘다.**

- 근거 1: `visibility` ENUM은 hidden_quality / hidden_request / hidden_legal 을 구분하며, 이는 C7(품질)·W7(삭제요청)·D4(법적)를 **동시에** 표현해야 하는 제품 요구를 boolean 보다 정확히 담는다. boolean 으로 후퇴하면 "왜 숨겼는가"가 소실되고 G4의 "삭제 아님" 원칙이 코드에서 사라진다.
- 근거 2: 테이블·컬럼 명명 충돌은 하류 계약의 **문자열 치환**으로 끝나지만, F2가 하류 명명으로 이사하면 이미 정합한 W2·W3까지 깨진다.
- 근거 3: 반대로 **컬럼·테이블의 부재(quality_score, unit_type, canonical_venue …)는 하류가 스스로 해결할 수 없다.** C4~C7의 touches 에 `packages/db/schema/**` 도 `migrations/**` 도 없다(C7의 뷰 파일 1개가 유일한 예외).
- 범위 우려에 대한 답: 추가분은 대부분 nullable 컬럼과 파생 테이블이며 **단일 마이그레이션·단일 스냅샷에서 한 번에 만들어진다**(§4 "쪼개면 중간 상태가 동작하지 않는다"). 다만 C5의 canonical/merge 계열 3테이블은 파생 성격이 강하므로, **F2에 "파생 테이블 마이그레이션은 소유 태스크가 신규 파일로 추가할 수 있다"는 REQ를 두고 C5에 touches 권한을 부여**하는 편이 롤백 단위상 낫다.

### 필수 수정 사항

1. **REQ-1 재작성 (BLOCKING)** — "정확히 7개"를 폐기하고 **테이블 매니페스트**(도메인/파생 구분)로 교체. `price_conflict`·`venue_suppression` 명시. 현행은 자기 CI를 통과할 수 없다.
2. **REQ 신설 — 하류 인터페이스 계약 (BLOCKING)**: C4·C5·C6·C7·O2·W3 가 인용하는 컬럼·테이블 목록을 F2 계약에 **명시적으로 열거**하고 스키마 테스트가 그 존재를 assert. 현행 REQ-1(자기 스냅샷 대조)은 하류를 전혀 보호하지 않는다.
3. **어휘 단일화 지시** — `venue_price → price_plan`, `venue_source_record → source_record`, `venue_tag → venue_need_tag`, `is_public → visibility='public'` 로 하류 계약을 정정하도록 팀 리드에 에스컬레이션. **정정 전에는 C4·C5·C6·C7·W1·W2·W4·W5·W7·O2 를 개발 에이전트에 전달하지 말 것.**
4. **컬럼 추가**: `venue.quality_score numeric`, `venue.reason_codes text[]`(또는 별도 판정 테이블), `price_plan.unit_type ENUM`, `price_plan.price_per_month_krw int NULL`, `price_plan.period_days int NULL`, `venue_need_tag.(assignment_method, model_id, prompt_hash, confidence)`. `public_price_display` 는 C7 소유로 두되 컬럼 정의는 F2가 한다.
5. **C7 판정 컬럼과 O2 오버라이드 레이어를 물리적으로 분리해 정의**(C1~C7 감사 §2-3의 상호 모순 해소).
6. **FORBID-4 `when` 을 스키마 전 테이블로 확대.**
7. **FORBID-6 정규식을 단어/접미사 경계로 재작성**(`^(.*_)?(name|phone|tel|email|ip|lat|lng)$` 형태). 오탐이 규칙을 죽인다.
8. **FORBID-1에 `DROP TRIGGER`·`DISABLE TRIGGER` 추가** + 스냅샷·매니페스트 변경에 승인 라벨 요구.
9. `parallel_with` 에서 F3 제거, touches 에 `packages/db/README.md` 추가, 정본 ID 사용.

---

## F4-NEED-TAG-ONTOLOGY — REJECT

### 규격 위반

| 항목 | 결과 |
|---|---|
| traces_to | H5 ✅ S2 ✅ / **G3 무관** — F4는 크롤링 소스 법적 실사와 아무 관계가 없다 |
| **depends_on 이 산출되지 않는 산출물을 전제** | **위반(치명)** — 아래 E |
| **parallel_with 가 폐기 태스크 참조** | **위반** — `[F1, F2, F3, C1]` 의 F3 |
| depends_on 순환 | 통과 |
| gate | `G1` ✅ 배치 B3 기준 부합. 단 REQ-2와 자기모순(아래 B) |
| PR 1개 원칙 | 통과 |
| 주관적 형용사 | 통과 |
| acceptance 기계 검증 | 통과 — 전 REQ가 검증 스크립트 exit code ✅ |
| requirements 8 초과 | 통과 (7개) |
| forbid | 통과 (5개, 5요소 완비) |
| **R-6 표집·홀드아웃** | **위반** — REQ-4(커버리지 ≥70%)는 품질 임계인데 라벨링 시트를 구현자가 직접 만들고 태그 정의도 구현자가 만든다. 표집·홀드아웃·라벨 검증 규정 0건 |
| R-7 실환경 하한 | 의도상 REQ-4가 실데이터 하한 역할이나 **그 실데이터가 존재하지 않아 무효** |
| **detect 대상 실재** | **위반(치명)** — 아래 E |
| out_of_scope / touches / rollback | 통과 — rollback이 FORBID-3과의 상호작용까지 고려한 점은 좋다 ✅ |

### 공격 결과

**A 악의적 준수 — REQ-4는 포괄 태그 1개로 충족된다.**
REQ-4는 "D1 표본 100개 중 최소 1개 태그를 부여할 수 있는 업체 비율 ≥ 70%"다. `body_care`("몸 관리 프로그램을 제공하는 업체") 같은 포괄 태그 하나를 100개 전부에 부여하면 **커버리지 100%**다. 나머지 17~27개 태그가 0건이어도 REQ-1(개수)·REQ-2(축별 5개)를 만족한다.
FORBID-5는 `filter_visible: true` 태그의 하한(≥3건)만 막을 뿐 **변별력 상한을 두지 않는다.** 한 태그가 표본의 90%를 덮는 무의미한 온톨로지가 계약을 100% 준수하고, H5의 측정 대상인 필터는 아무것도 가르지 않는다. → **결함(치명)**

**B 조건 회피 — 계약이 자기 게이트와 모순된다.**
`gate: G1` 의 주석은 "G1에서 제외된 축의 태그를 만들지 않기 위함"이다. 그런데 REQ-2는 "**3축 각각** 5개 이상"을 하드코딩한다. G1이 한 축을 `axis_excluded` 로 판정하면 REQ-2는 (a) 죽은 축의 태그를 억지로 만들어야 충족되거나 (b) 충족 불가가 된다. **게이트의 목적과 요구사항이 정면 충돌한다.** → **결함**

**C 탐지 무력화 — FORBID-1의 detect가 FORBID-1을 잡지 못한다.**
FORBID-1의 `must_not` 은 "D1 표본 원문에서 **단 한 건도 관측되지 않은 표현**을 태그·별칭으로 추가"다. 그런데 detect는 "모든 alias 의 evidence id 를 D1 CSV 와 대조, **미존재 참조**가 있으면 실패"다.
→ **아무 alias 에나 실재하는 행 id 를 붙이면 통과한다.** alias 문자열이 그 행에 실제로 나타나는지는 검사하지 않는다. 브레인스토밍으로 만든 27개 태그 × 3개 alias 전부에 `evidence: [row_007]` 을 달면 CI 녹색이다. `because` 가 예언한 "매칭률 0인 태그 → 항상 0건인 필터 칩"이 그대로 발생한다. → **결함(치명)**

**D 지름길 유도** — 포괄 태그(A), evidence id 남발(C), medical 축 태그를 무해한 시설 태그 5개로만 채워 REQ-6·FORBID-2를 형식화. 전부 **막지 못함**.

**E DAG 정합성 — REJECT 사유의 핵심.**
계약 상단이 선언한 입력 3개가 **어느 선행 태스크에서도 산출되지 않는다.**

| F4가 전제하는 입력 | 실제 선행 산출물 | 상태 |
|---|---|---|
| `docs/discovery/D1-price-sample.csv` | D1은 `docs/discovery/D1/{population,sample,ledger,double_check,arbitration,replacement_log}.csv` | **경로 부재** |
| `docs/discovery/D4-medical-guardrails.md` | D4는 `docs/discovery/D4/guardrail.md` + 4개 yaml | **경로 부재** |
| `data/legal/medical-banned-terms.txt` | D4의 touches 는 `docs/discovery/D4/**` + `scripts/discovery/validate_d4.py`. **`data/legal/` 을 만드는 태스크가 리포 전체에 없다** | **소유자 부재** |

이로 인해 **REQ-3·REQ-4·REQ-6 및 FORBID-1·FORBID-2 가 전부 존재하지 않는 파일 위에 서 있다.** done_when 첫 항목("선행 입력 3개 파일이 리포에 존재함을 확인")은 영원히 충족되지 않는다.

**경로를 고쳐도 복구되지 않는다.** D1 `ledger.csv` 의 13개 컬럼(venue_id, name, gu, axis, axis_ambiguous, evidence_channel, source_url, access_method, checked_at, price_found, price_evidence_snippet, price_structure_type, evaluator)은 **전부 가격 조사용**이며 업체의 서비스·프로그램·시설 문구 원문이 없다.
→ REQ-3(alias 가 D1 원문에서 관측될 것)의 대조 대상 텍스트가 존재하지 않는다.
→ REQ-4(업체별 태그 부여 가능성 판정)의 판단 근거가 존재하지 않는다. `name` 과 `axis` 만으로 "허리·목"·"여성전용"·"평일오전" 태그 부여 여부를 판정할 수 없다.
→ **F4 단독 수정으로 복구 불가능하며 D1의 수집 범위(ledger 컬럼)를 바꿔야 한다.** 다른 태스크의 계약 변경이 선결이므로 §5의 "DAG 모순"에 해당한다.

부가: `parallel_with: [F1, ...]` 이면서 touches 에 `.github/workflows/ci.yml`(F1이 생성)과 `tools/ontology-validate/**`(F1의 워크스페이스 규약 필요)를 포함한다. **F1과 병렬이면 존재하지 않는 파일을 수정하게 된다.** `blocks: [C6, W2, W4]` 중 상호 참조가 성립하는 것은 C6뿐.

**F 존재 이유** — H5·S2 검증 수단으로서 온톨로지가 필요하다는 것은 참이다 ✅. 그러나 A·C 때문에 **"근거 있는 태그 체계"라는 존재 이유가 계약상 보장되지 않는다.** G3 참조는 거짓.

**성별 중립성 검증 (팀 리드 지정 항목) — 방어됨 ✅**
FORBID-4는 최상위 필드·별도 축으로서의 성별 도입을 금지하고, detect가 (a) `need-tags.schema.json` 의 `additionalProperties: false` + 허용 키 화이트리스트 메타 테스트, (b) 키명 정규식 `(gender|sex|female|male)` 두 겹으로 검사한다. "여성전용"을 일반 태그 인스턴스 1개로 표현하도록 명시한 것도 PRD("카피는 좁게, 스키마는 넓게")와 정확히 일치한다. 키 추가는 additionalProperties 로, 값 인코딩은 태그 인스턴스 허용으로 흡수되므로 **구조적 위반 경로를 찾지 못했다.** 이 배치에서 F2 FORBID-4(3개 테이블 한정)보다 F4 쪽이 더 견고하다. **PRD 위반 없음.**

### 필수 수정 사항 (REJECT — 재정의 후 재감사)

1. **선행 입력 경로를 D1·D4의 실제 산출물로 교체** — `docs/discovery/D1/ledger.csv`, `docs/discovery/D4/{guardrail.md, forbidden_lexicon.yaml, medical_scope.yaml}`. `data/legal/medical-banned-terms.txt` 참조는 삭제하고 D4의 `forbidden_lexicon.yaml` 을 직접 인용(또는 D4 계약에 해당 파일 산출 추가 요청).
2. **D1 계약 변경 요청 (선결)** — ledger.csv 에 태그 근거로 쓸 **업체 서비스·프로그램·시설 문구 원문 컬럼**(예: `service_text_snippet`, 출처 URL)을 추가하도록 D1 저자에게 요청. 없으면 REQ-3·REQ-4는 어떤 형태로도 판정 불가하다. **이 변경 없이 F4를 개발 에이전트에 전달해서는 안 된다.**
3. **REQ-2를 G1 결과 의존으로 재작성** — "3축 각각"이 아니라 "**G1에서 `proceed`/`editor_augment` 판정을 받은 축 각각** 5개 이상". D1이 산출할 기계 판독 가능한 축 판정 파일(D1 필수 수정 5)을 입력으로 명시.
4. **FORBID-1 detect 교체** — evidence id 실재 검사 → **alias 문자열(정규화 후)이 해당 행의 원문 컬럼에 실제로 부분 문자열로 존재**하는지 검사.
5. **REQ-4에 변별력 조건 추가** — 단일 태그 커버리지 상한, `filter_visible` 태그의 중앙 커버리지 하한.
6. **R-6 대응** — 라벨링 시트의 표집·라벨 작성 주체·검증 방법을 REQ에 명시하고 표본 100 중 30건을 **홀드아웃**으로 분리해 최종 커버리지를 홀드아웃에서 산출.
7. **`depends_on` 에 F1 추가**, `parallel_with` 에서 F3 제거, traces_to 에서 G3 제거, 정본 ID 사용.

---

## 전체 요약

| 태스크 | 판정 | 핵심 결함 1개 |
|---|---|---|
| D1 | REVISE | 축별 n=33 → Wilson 95% 구간 [0.25, 0.57] 이 G1 3구간 전체를 덮어 축별 차등 판정이 원리적으로 불가능 |
| D2 | REVISE (BLOCKING) | 100개 측정 · "enterable ≥ 100" 통과 조건 → G2 pass 가 산술적으로 불가능 |
| D3 | REVISE | 전 소스 forbidden 판정이 계약을 100% 준수하며, 요청률 하한이 없어 rpm=1 로 합법적 마비 가능 |
| D4 | REVISE | 실관측 가격 문자열 0건(R-7 위반) — 좁은 화이트리스트로 medical 축 전량 비공개가 완전 합법 |
| F1 | REVISE | "정확히 4개 패키지" 고정 + `packages/pipeline` 소유자 부재 → C4~C7이 만들 수 없는 패키지에 코드를 넣게 되어 있음 |
| F2 | REVISE (BLOCKING) | REQ-1(정확히 7개) vs price_conflict·venue_suppression 자기모순 + 하류 7건과 데이터 모델 단절로 게이트·의료 FORBID가 공허 통과 |
| F4 | **REJECT** | 선언한 입력 3개가 실재하지 않으며, 경로를 고쳐도 D1 산출물에 태그 근거 텍스트가 없어 F4 단독 수정 불가 |

### 체계적 결함 패턴

**P1 — 자기 검증기 (D1·D2·D3·D4, 4건 전부).**
네 조사 태스크의 **모든** acceptance 와 **모든** detect 가 피검자가 같은 PR에서 작성하는 `scripts/discovery/validate_dN.py` 의 exit code 다. 그 스크립트가 실제로 위반을 잡는지 확인하는 요구가 0건이다. → `sys.exit(0)` 한 줄로 **22개 REQ와 21개 FORBID가 동시에 통과**한다.
대조적으로 F1(위반 픽스처 3종)·F2(4종)·F4(4종)는 done_when 에서 탐지기 자체를 검증한다.
**처방: 02-spec §3에 "detect 가 자체 제작 스크립트인 경우, 각 detect 에 대응하는 위반 픽스처가 그 detect 를 실패시킴을 done_when 에서 확인해야 한다"를 추가**(개별 태스크 수정으로는 재발한다).

**P2 — 사전등록 잠금의 공통 우회 경로 (D1 FORBID-1, D2 FORBID-2, D3 REQ-2).**
셋 다 `sha256(rule.md) == rule.lock` + `lock 최초 추가 커밋 시각 < 데이터 시각` 이라는 동일 2중 장치를 쓰고, 셋 다 **① lock 을 먼저 A-커밋 → ② 조사 → ③ rule.md 수정 → ④ lock 재생성(M-커밋)** 으로 통과한다. 비교 대상인 `checked_at`·`captured_at` 은 자기신고 값이고 커밋 시각은 `GIT_COMMITTER_DATE` 로 위조 가능하다.
**처방: lock 파일에 M-커밋이 존재하면 실패시키는 검사 + 룰 문서를 조사 PR과 물리적으로 분리된 선행 PR로 강제.** 조사 태스크에 한해 PR 2개 허용이 원칙 1보다 우선한다.

**P3 — 자기신고 컬럼을 탐지 수단으로 사용 (D1 FORBID-3·6, D2 FORBID-3, D3 REQ-1).**
`evidence_channel`·`access_method`·`capture_mode`·robots 스냅샷 sha256 — 전부 위반자가 직접 기입하는 값을 그 위반의 탐지 수단으로 삼는다. **위반한 사람이 위반하지 않았다고 적으면 통과한다.** 특히 D2 FORBID-3은 G2 판정 전체가 걸린 조항인데 방어가 문자열 하나다.
**처방: 원문 스냅샷(HTML·스크린샷·robots 재취득) + 해시를 증거로 요구하고 자기신고 컬럼은 보조 지표로 강등.**

**P4 — 조사 산출물이 코드에 도달하지 않는다 (D1·D2·D3·D4 공통).**
넷 다 `.github/workflows/ci.yml` 을 touches 에 넣지 않는다. validate 스크립트는 **한 번 로컬 실행되고 끝**이며 이후 어떤 PR도 검사하지 않는다. 더 근본적으로 **D3 `crawl_policy.yaml` ↔ C1 `sources.allowlist.yaml`**, **D4 `display_whitelist.yaml` ↔ C4·C7 CI 스키마 체크**를 연결하는 검사의 소유 태스크가 없다. G3의 결론이 런타임에 도달하지 않는다.
**처방: 각 조사 태스크 touches 에 ci.yml 추가 + "조사 산출물 → 코드 설정" 대조 잡의 소유 태스크를 DAG에 명시.**

**P5 — 임계값 REQ에 표집·홀드아웃 없음 (R-6 위반: D2 REQ-5, D4 REQ-2·3·4, F4 REQ-4).**
C1~C7 감사에서 지적된 자기출제 패턴이 그대로 반복된다. 특히 D4는 규칙·케이스·정답을 한 사람이 만들고 "100% 일치"를 성과로 보고하는 순수한 자기일관성 측정이다. **규격은 개정되었으나 계약이 아직 따라오지 않았다.**

**P6 — 정본 ID 미사용(7건 전부) 및 폐기 태스크 F3 참조(F1·F2·F4).**
이 배치는 짧은 dag_id(`[F1]`, `[C2, C3]`)를 쓰고 C 배치는 긴 ID(오타 다수)를 쓴다. 두 관습이 공존해 어느 쪽으로도 자동 검증이 불가능하다. 여기에 F1·F2·F4가 **폐기된 F3**를 참조한다(정본 레지스트리: "신규 참조 금지").

**P7 — done_when 이 자기 touches 를 위반 (F1 README, F2 packages/db/README).**
계약이 요구하는 산출물이 계약이 허용한 경로 밖에 있다. F1은 FORBID-5로 그 경로를 스스로 차단하므로 **자기 완료 조건과 자기 금지사항이 충돌**한다.

**P8 — 게이트 결과의 하류 주입 형태 부재 (D1 ↔ F4·C1~C6).**
D1은 G1 축별 판정을 `report.md` 산문으로만 산출한다. 그 사이 F4 REQ-2("3축 각각 5개")·C2~C6 done_when(3축 균등 픽스처)은 3축을 하드코딩한다. **PRD가 3축을 유지한 근거인 "축별 차등 판정으로 전부 아니면 전무를 회피"가 계약 체계 안에 존재하지 않는다.** 축이 탈락하면 하류 계약들이 동시에 충족 불가가 된다. 처방은 D1 필수 수정 5(`g1_verdict.json`)와 하류 계약의 축 목록 주입화이며, **F2 정합화와 함께 이 배치에서 반드시 처리해야 하는 2개 크로스커팅 이슈다.**

### 전달 차단 권고

- **즉시 전달 불가**: F4(REJECT). D1의 ledger 컬럼 변경이 선결 조건이다.
- **F2 정합화 라운드가 끝나기 전에는 C4·C5·C6·C7·W1·W2·W4·W5·W7·O2 를 개발 에이전트에 전달하지 말 것.** 이들의 detect 는 F2에 없는 객체를 grep 하므로 위반이 발생해도 **CI가 녹색인 채로** G4 게이트와 의료광고 방어선이 뚫린다. 이것이 "잘못된 코드"가 아니라 "잘못된 제품"이 만들어지는 경로다.
