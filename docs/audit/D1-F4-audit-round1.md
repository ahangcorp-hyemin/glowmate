# 태스크 계약 감사 보고서 — D1~D4 / F1~F4 (8건)

> 감사관: task-auditor
> 대상: `docs/tasks/{D1,D2,D3,D4,F1,F2,F3,F4}.md`
> 근거 문서: `docs/02-task-contract-spec.md` §5 반려 사유 체크리스트, `docs/01-prd.md`, `docs/03-task-dag.md`, `docs/00-lean-canvas.md`
> 교차 대조: `docs/tasks/{C1,C4,C5,C6,C7,W1,W2,W3,W4,W7,O1,O2}.md`
> 계약 파일은 수정하지 않았다. 판정과 지적만 낸다.

---

## 0. 판정 요약

| 태스크 | 판정 | 한 줄 사유 |
|---|---|---|
| **D1** | **REVISE** | 표본 프레임 구성 규칙이 없어 무작위 추출을 지키면서 커버리지를 20~30%p 부풀릴 수 있다 |
| **D2** | **REVISE** | 난이도 임계값의 *하한*이 없어 처음부터 느슨하게 잠그면 G2가 거짓 통과한다 |
| **D3** | **REVISE** | `conditional` 이 ToS 실사를, `allowed` 가 robots·rate 검사를 각각 우회하는 정식 경로다 |
| **D4** | **REVISE** | 산출물 경로·형식이 하류 8개 태스크와 3중 불일치 → 하류 FORBID 전부가 참조 대상 없이 뜬다 |
| **F1** | **REVISE** | Discovery 검증기를 돌릴 CI job 이 없고, "정확히 4개 패키지" assert 가 F3 머지 시 CI를 죽인다 |
| **F2** | **REVISE** | C7의 `is_public`/`quality_score`/`reason_codes` 와 C4 출력 필드 6종이 스키마에 없다 |
| **F3** | **REVISE** | 항상 "가격 미공개"만 렌더하는 구현이 계약을 100% 준수한다 |
| **F4** | **REJECT** | 선행 입력 3개가 D1·D4 산출물에 존재하지 않고, `gate: G1` 목적과 REQ-2가 논리적으로 양립 불가 |

---

# D1 — REVISE

## 규격 위반 (§5 체크리스트 전 항목 대조)

| 체크리스트 항목 | 판정 | 위치·내용 |
|---|---|---|
| traces_to 가 비었거나 PRD에 없는 ID 참조 | ⚠️ | `KM-price-coverage` 는 어느 문서에도 문자열로 존재하지 않음 (Lean Canvas §7 "가격 커버리지율"에 대응 추정). spec §1 예시에 같은 ID가 등장하므로 관례 허용하나 **ID 레지스트리가 없다** |
| depends_on 에 순환 의존 | ✅ | 없음 |
| depends_on 이 DAG에 없는 태스크 참조 | ✅ | `depends_on: []` |
| gate 를 무시하고 게이트 이후 작업 선행 배치 | ✅ | `gate: null` 정당 (본 태스크가 G1의 입력) |
| **하나의 태스크가 2개 이상 PR로 나뉘어야 함** | ❌ | 사전등록(protocol)과 조사결과가 한 PR. 공격 D 참조 |
| 주관적 형용사 사용 | ✅ | 없음 |
| acceptance 가 없거나 기계 검증 불가 | ❌ | REQ-2 acceptance 의 커밋시각 비교는 실행은 되나 **조작 가능·squash 시 소멸** (공격 C) |
| REQ 하나에 복수 요구가 '그리고'로 결합 | ✅ | 없음 |
| requirements 8개 초과 | ✅ | 6개 |
| forbid 0개 / 7개 이상 | ✅ | 6개 |
| when 이 없거나 '항상'에 해당 | ❌ | FORBID-2 의 `when` 이 **동기(의도)** 조건 → 판정 불가 |
| detect 없음 | ⚠️ | 있으나 **실행 주체(CI)가 없음** (공격 C) |
| because 에 구체적 실패 시나리오 없음 | ✅ | 6건 모두 구체적. 이 계약의 최대 강점 |
| detect 가 전부 '코드리뷰' | ✅ | 없음 |
| out_of_scope 미정의 | ✅ | 8항목 정의 |
| touches 미정의 또는 과도하게 넓음 | ✅ | `docs/discovery/D1/**` + 스크립트 1개 |
| rollback 미정의 | ⚠️ | 정의되어 있으나 2)가 **존재하지 않는 시스템**을 참조 (공격 E) |

**추가 규격 오류:** REQ-1 acceptance 의 "(축,구) 조합 **12칸** 각각 ≥ 8" — 3축 × 3구 = **9칸**이다. 존재하지 않는 12칸을 검사하는 acceptance 는 그대로 구현되면 항상 실패하거나, 구현자가 임의로 9로 고쳐 acceptance 가 계약과 달라진다.

## 공격 결과

### A — 악의적 준수: **성공 (치명적)**

**시도 1 — 표본 프레임을 가격 노출 업체가 많은 소스로 구성한다.**
REQ-1은 `population.csv ≥ 300행`과 층화 배분(34/33/33, 축·구별 최소)만 요구하고, **모집단을 어떻게 구성하는지에 대한 규칙이 전혀 없다.** 네이버 "예약" 상품 등록 업체 목록, 또는 가격표가 있는 업체가 상위 노출되는 검색 결과 상위 N개로 프레임을 짜면, 그 안에서 protocol 고정 시드로 **완벽하게 무작위 추출해도** 커버리지가 실제 모집단 대비 20~30%p 부풀려진다. FORBID-2는 *표본 교체*만 막고 *프레임 편향*은 전혀 막지 못한다. `validate_d1.py --check sampling` 은 행수·분포·중복만 검사한다.
→ **결함. G1의 입력을 조작하는 가장 쉬운 경로가 무방비다. 임계값을 건드릴 필요 없이 분모를 바꾸면 된다.**

**시도 2 — "가격 확인됨"의 정의를 처음부터 넓게 잡고 잠근다.**
FORBID-1은 정의를 *나중에 바꾸는 것*만 막는다. 착수 전에 "인스타 게시물 캡션에 언급된 과거 이벤트가", "블로그 후기에 적힌 결제 금액"까지 포함하도록 정의하고 해시를 고정하면 계약을 100% 준수하며 G1을 통과시킨다.
→ **결함. 잠금장치는 있으나 잠글 내용의 하한이 없다.**

**시도 3 — 전화로 취득한 가격을 공개 채널로 위장한다.**
FORBID-3의 detect 는 `evidence_channel` enum + `source_url` 존재 + snippet 길이 ≥10자만 검사한다. 아무 페이지 URL 을 넣고 snippet 을 창작하면 전 검사를 통과한다. D3는 robots·ToS **원문 스냅샷**을 의무화하는데 D1은 `price_found=true` 의 1차 증거를 요구하지 않는다.
→ **결함. H1 수치 전체가 재검증 불가능한 자기신고 위에 서 있다.**

### B — 조건 회피: **성공 3건**

1. **FORBID-2 `when` 이 너무 좁고(의도 조건), detect 는 넓다.** "price_found=false 가 누적되어 … 넣으려는 경우" — 누적/의도는 관측 불가. detect(집합 대칭차 비교)는 의도와 무관하게 작동하므로 `when` 이 사문화된다. 반대로 `replacement_log.csv` 의 사유 enum은 자기신고이고 **교체 건수 상한이 없다.** "closed" 라고 적으면 예비표본 20개를 전부 소진해 표본의 17%를 갈아치울 수 있고 검사는 통과한다.
2. **FORBID-5(n<30 → inconclusive)는 정상 진행 시 절대 발동하지 않는다.** 축별 primary 가 34/33/33 이다. 그런데 FORBID-6이 `blocked` 행에 `price_found=false` 를 강제해 **접근 차단 업체가 "가격 미공개"로 집계**되어 커버리지가 하향 편향된다. "유효 조사 완료 표본 수"의 정의가 계약 어디에도 없어 blocked 를 분모에 넣을지가 조사자 재량이다.
   → **FORBID-5의 `because`("통과 가능한 축이 부당하게 제외된다")가 서술한 실패를 FORBID-6이 직접 만든다.**
3. **FORBID-4 는 `axis_ambiguous=true` 인 행만 검사한다.** 이 플래그를 조사자가 스스로 세운다. false 로 적으면 중재 의무 전체가 소멸한다. 조건 회피가 1바이트다.

### C — 탐지 무력화: **성공 4건 (치명적)**

1. **`validate_d1.py` 를 실행하는 CI가 존재하지 않는다.** D1은 `depends_on: []` 로 F1과 병렬이고, F1의 6개 CI job 중 `scripts/discovery/**` 를 도는 것이 없다. FORDID-1의 detect 는 스스로 "(F1의 CI 도입 후 동일 명령을 CI 잡으로 승격)"이라 미래형으로 적었다. **현재 시점의 `on_violation: block_merge` 를 집행할 자동 수단이 없다 → spec 원칙 3 정면 위반.**
2. **검증기를 피검증자가 같은 PR에서 작성한다.** `--check sampling` 이 실제로 무엇을 검사하는지 보증하는 것은 계약 문언뿐이다. F1~F4가 하는 "위반 픽스처가 반드시 실패하는지 확인하는 메타테스트"가 D1에는 **한 건도 없다.** 느슨한 검증기 하나로 6개 FORBID 전부가 exit 0 이 된다.
3. **REQ-2의 시간순 검사는 조작 가능하고 squash merge 시 소멸한다.** `git log --format=%cI` 는 committer date 이며 `GIT_COMMITTER_DATE` 로 임의 설정된다. 더 결정적으로 PR이 squash 머지되면 `protocol.lock` 과 `ledger.csv` 가 **동일 커밋**에 들어가 `--diff-filter=A` 두 시각이 같아진다 → "이르다" 조건이 영구 실패하거나 등호 처리로 무의미해진다. **D1의 유일한 사후조작 방지 장치가 머지 전략에 의해 붕괴한다.**
4. **REQ-4 이중판정의 독립성을 강제하는 수단이 없다.** `evaluator` 는 자유 문자열이고 조사 주체는 단일 `research-discovery` 에이전트다. 자기 판정을 두 컬럼에 복사하면 agreement=1.00. "무작위 20개"의 선정 절차도 검증되지 않아(검사는 행수 20뿐) 명확한 20건만 골라 일치율을 확보할 수 있다. 또 불일치 2건에 대해 **최종 ledger 값을 무엇으로 확정할지 규칙이 없다** — arbitration 기록만 남기면 true 로 확정해도 통과한다.

### D — 지름길 유도: **성공**

막혔을 때 개발/조사 에이전트의 최적 경로는 ㉠ 프레임을 가격 노출 업체가 많은 소스로 재구성 ㉡ 예비표본으로 교체 ㉢ protocol.md 의 정의를 처음부터 넓게 확정 — **세 가지 모두 계약을 위반하지 않는다.** 사후 임계값 조정만 막았고, 사전 임계값·정의·프레임 설정은 전부 자유다.

구조적 원인: **사전등록과 결과 제출이 같은 PR·같은 에이전트·같은 브랜치다.** 사전등록은 PR 경계(=시간 경계)로만 강제 가능하다. `pr_count: 1` 이 이 계약의 핵심 통제를 원리적으로 불가능하게 만든다. 롤백 관점에서도 "프로토콜은 유지하고 데이터만 재수집"이 불가능하다 → spec §4 "되돌릴 때 일부만 되돌리고 싶어진다" = 분할 신호.

### E — DAG 정합성: **결함**

- `blocks: [F4, C1, C4]` 인데 **C1의 `depends_on` 은 `[F2-SCHEMA, D3-SOURCE-DILIGENCE]`, C4는 `[C1, F2]`** 로 D1이 없다. 게이트를 통한 간접 의존을 `blocks` 에 적어 양방향 불일치를 만들었다. 스케줄러가 `depends_on` 만 읽으면 D1 없이 C1·C4를 시작한다.
- rollback 2) "G1 상태를 `undecided` 로 되돌린다" — **G1 상태를 저장하는 시스템이 어느 계약에도 정의되어 있지 않다** (O1 대시보드는 W6 이후). 실행 불가능한 롤백 절차.
- 순환 없음. 게이트 배치 정당.

### F — 존재 이유: **부분 결함**

- H1 검증은 정당하다. H2도 REQ-5의 `price_structure_type` 분류로 예비 측정된다 — 인정.
- **그러나 `blocks: [F4]` 는 성립하지 않는다.** F4는 D1 표본 원문에서 니즈 태그 별칭(업종 용어)의 관측 근거를 얻어야 하는데, D1의 `ledger.csv` 필수 컬럼 13개에는 **업체 소개문·서비스명·프로그램명 등 태그 근거가 될 원문이 전혀 없다.** 있는 것은 `price_evidence_snippet`(가격 근거)뿐이다. **D1은 F4를 unblock 한다고 선언하면서 F4가 필요로 하는 데이터를 산출하지 않는다.**

## 필수 수정 사항

1. **`pr_count: 1` → 2 (또는 D1a-PROTOCOL / D1b-FIELDWORK 분할).** protocol.md + protocol.lock 이 **별도 PR로 main에 먼저 머지된 뒤에만** 조사 PR이 열릴 수 있게 한다. REQ-2를 "`protocol.lock` 이 base 브랜치(origin/main)에 이미 존재하고 본 PR diff에 포함되지 않을 것"으로 바꾼다 — 이것만이 squash·날짜조작에 견딘다.
2. **REQ-1에 표본 프레임 구성 규칙을 추가한다.** protocol.md 에 ㉠ 프레임 소스 enum(가격 정보와 무관한 소스로 한정) ㉡ 프레임 구축 쿼리·필터 전문 ㉢ "가격 관련 속성으로 필터링 금지"를 잠금 대상에 포함하고 `--check frame` 을 신설. **이 항목이 없으면 D1의 나머지 통제는 전부 무의미하다.**
3. **`price_found=true` 행에 페이지 스냅샷(HTML 또는 스크린샷) 파일을 의무화**하고, `price_evidence_snippet` 이 그 스냅샷의 실제 부분문자열인지 `--check evidence-integrity` 로 검사한다. FORBID-3의 detect 를 형식 검사에서 내용 검사로 승격.
4. **REQ-1 acceptance 의 "12칸"을 "9칸(3축×3구)"으로 정정**하고 칸당 최소값을 재검토한다.
5. **표본 교체 상한과 사유 검증을 추가한다.** `replacement_log.csv` 행수 ≤ 5(=5%), 사유 `closed` 는 폐업 증거(스냅샷) 첨부 필수. 상한 초과 시 해당 축 verdict 를 `inconclusive` 로 강제.
6. **`blocked` 의 집계 처리를 protocol.md 잠금 대상에 넣는다.** REQ-6의 "유효 조사 완료 표본 수 n"을 `n = 100 − blocked − 교체불가` 로 명시 정의한다. 현재는 FORBID-5와 FORBID-6이 서로 반대 방향으로 작동한다.
7. **이중판정의 독립성을 검증 가능하게 만든다.** 20건 선정을 protocol 고정 시드로 산출해 재현 검증, `evaluator` 를 별개 실행 세션 ID로 고정, **불일치 건의 최종값 확정 규칙**(보수적으로 false)을 사전 등록.
8. **`validate_d1.py` 자신에 대한 메타테스트를 done_when 에 추가한다.** 위반 픽스처 6종(프레임 위반·표본 밖 venue·전화 취득·미중재 축모호·n<30 확정판정·blocked+true)이 각각 non-zero exit 하는지 확인.
9. **F1 CI 의존을 명시한다.** F1 머지 후 `discovery` CI job 등록을 D1의 done_when 에 포함.
10. **`blocks: [C1, C4]` 를 제거**하거나 C1·C4의 `depends_on` 에 D1을 추가한다. **`ledger.csv` 에 `service_menu_raw`(업체가 노출한 프로그램·서비스명 원문) 컬럼을 추가**한다 — 없으면 `blocks: [F4]` 는 거짓 선언이다.
11. rollback 2)의 "G1 상태" 저장 위치를 명시한다(예: `docs/gates/G1.md`).

---

# D2 — REVISE

## 규격 위반

- [금지사항] **FORBID-2 `when` "100 미만으로 나온 이후"는 관측 주체가 조사자 내심**이다. 판정 가능 조건이 아니다.
- [요구사항] REQ-2 acceptance 의 `google_volume 과 naver_volume 이 동일 정수인 행의 비율 ≤ 5%` 는 **정당한 데이터를 떨어뜨리고 조작에는 무력하다.**
- 나머지(traces_to·순환·게이트·형용사·REQ 6개·forbid 5개·out_of_scope·touches·rollback)는 통과.

## 공격 결과

### A — 악의적 준수: **성공 (치명적)** — D1과 동형의 "하한 없는 사전등록"

FORBID-2는 `difficulty_rule.md` 를 **사후에 완화**하는 것만 막는다. **임계 수치가 무엇 이상이어야 하는지에 대한 하한이 계약에 없다.** "1페이지 상위 10개 중 비-포털 도메인이 1개 이상이면 enterable" 로 처음부터 정의해 잠그면 사실상 전 키워드가 enterable 이 되어 100개 채우기가 자명해지고 G2가 거짓 통과한다. FORBID-2의 `because` 가 서술한 실패("실제로는 진입 불가인 키워드가 진입 가능으로 재라벨")가 **완화 없이도 그대로 발생한다.**

두 번째: REQ-3은 "검색량 상위 100개 키워드"만 SERP 실측한다. `keyword_rule.md` 로 600개를 만들 때 **경쟁이 약한 초장문 조합**("서초 반포동 40대 여성 허리 필라테스 평일오전 가격")을 대량 생성하면 상위 100 자체가 초장문으로 채워져 enterable 100 이 자동 달성된다. **검색량 하한이 계약에 없다.** FORBID-2의 `because` 가 경고한 "W4가 색인은 되지만 순위가 안 잡히는 랜딩을 대량 생산"을 REQ가 막지 않는다.

### B — 조건 회피: **성공 2건**

1. **FORBID-1 `when` 은 "serp_naver 커버리지 < 100" 일 때만 발동한다.** 네이버 100개를 전부 캡처하되 전부 hard 로 라벨하면 FORBID-1은 발동하지 않고, REQ-5는 `naver_verdict` 를 요구하나 **두 verdict 가 엇갈릴 때 G2 최종 판정을 무엇으로 하는지 계약 어디에도 없다.** PRD G2는 "1페이지 진입 가능 롱테일 ≥ 100개" 하나뿐이고 D2는 엔진별 100을 만들었지만 결합 규칙을 만들지 않았다. `google=pass, naver=fail` 로 제출하면 팀 리드가 임의 해석하게 되고 **그 순간 D2의 모든 잠금장치가 우회된다.**
2. **FORBID-5 `when` 은 "캡차·429/403 반환"이다.** `collection_log.csv` 기록 의무가 차단이 발생한 경우에만 걸리므로, 조사자가 차단을 기록하지 않으면 detect(로그 대조)가 검사할 대상 자체가 사라진다. **로그 누락은 탐지 불가.**

### C — 탐지 무력화: **성공 4건**

1. D1과 동일: **`validate_d2.py` 를 실행할 CI가 없고, 검증기를 피검증자가 작성하며, 메타테스트가 없다.**
2. **FORBID-3 detect 는 `capture_mode == 'incognito_no_login'` 컬럼 값 검사 = 자기신고 문자열이다.** SERP 캡처 원본(HTML/스크린샷) 보존 의무가 없어 사후 재검증이 불가능하다. D3는 스냅샷을 의무화하는데 D2는 하지 않는다 — 동일 조직 내 증거 기준 비대칭.
3. **REQ-2의 "동일 정수 행 ≤ 5%"**: 롱테일 저볼륨 구간에서는 두 엔진 모두 `10`, `20`, `0` 같은 값이 흔해 **정직하게 측정해도 5%를 넘겨 실패**한다. 반대로 회피는 한쪽 값에 +1 하면 끝이다. **검사가 노이즈를 잡고 조작은 놓친다.**
4. **FORBID-2 detect 의 "rule.lock 커밋 이후 keywords.csv 행 추가 시 실패"** 는 D1 REQ-2와 동일하게 squash merge 시 소멸하고 committer date 조작에 취약하다.

### D — 지름길 유도: **성공**

㉠ 임계값을 처음부터 느슨하게 사전등록 ㉡ 초장문 키워드로 600개를 채워 상위 100을 easy 구간으로 이동 ㉢ 네이버 캡처가 힘들면 `blocked` 로 기록해 면제. REQ-3은 "차단 키워드는 collection_log 에 status=blocked 로 존재해야 면제"라고 했는데 **blocked 자기신고 상한이 없다.** 100개 중 90개를 blocked 로 신고하면 FORBID-1의 `커버리지 ≥ (100 − blocked)` 조건은 10개만 캡처해도 충족된다.

### E — DAG 정합성: **결함**

`blocks: [W4]` 뿐인데 W4의 `depends_on` 은 `[W1, C4, C6]` 으로 D2가 없다(양방향 불일치). 또 FORBID-1의 `because` 는 "W1·W4에 SEO 개발을 전부 투입"이라며 스스로 W1을 지목하면서 `blocks` 에 W1을 넣지 않았다. G2 실패 시 채널 전략 재설계 → W1(SEO 기반) 자체의 범위가 바뀌므로 논리적 누락이다.

### F — 존재 이유: **통과**

H3 검증이 D2의 실측으로 직접 이뤄지고 G2 입력 산출도 정확하다. `KM-search-ctr` 은 출시 후 측정 대상이라 참조가 다소 느슨하나, H3·G2로 존재 이유는 충분하다. 장식적 참조 아님.

## 필수 수정 사항

1. **REQ-4에 `difficulty_rule.md` 의 임계 하한을 계약 본문에 못박는다** (예: 상위 10 중 포털·디렉터리를 제외한 개별 서비스 도메인 ≥3). 현재는 "무엇이든 정해서 잠그기만 하면 됨"이다.
2. **SERP 실측 대상에 검색량 하한을 추가한다** ("`google_volume + naver_volume ≥ N` 인 키워드로 한정"). 초장문으로 분모를 희석하는 경로 차단.
3. **REQ-5에 엔진별 verdict 충돌 시 G2 최종 판정 규칙을 명시한다** (예: `naver_verdict=fail` → 전체 `channel_redesign`).
4. **SERP 캡처 원본 스냅샷을 의무화하고**, FORBID-3의 detect 를 자기신고 컬럼 검사에서 **스냅샷 내 로그인 흔적 검사**로 승격한다.
5. **`blocked` 신고 상한을 둔다** (엔진별 ≤20건, 초과 시 해당 엔진 `inconclusive`).
6. **REQ-2의 "동일 정수 ≤5%" 검사를 삭제하고**, `source_tool` 이 엔진별로 서로 다른 도구인지 enum 으로 검사한다.
7. FORBID-2 `when` 을 관측 가능 조건으로 재작성: "`rule.lock` 이 base 에 존재하는 상태에서 `difficulty_rule.md`·`keyword_rule.md`·`keywords.csv` 에 변경이 발생한 경우".
8. `blocks` 에 W1 추가 및 W4의 `depends_on` 에 D2 추가.
9. D1과 동일하게 **사전등록(rule.lock) PR 분리** + 위반 픽스처 메타테스트를 done_when 에 추가.

---

# D3 — REVISE

## 규격 위반

- [금지사항] **FORBID-3 `when` "rate probe 를 시행할 때 (…기록되는 모든 요청)" 은 사실상 '항상'이다.** spec §3.4 안티패턴 `when: 항상` 에 해당. 내용은 타당하나 조건부 형식이 아니다.
- [구조] `traces_to: [G3, H1, H2]` — **D3는 H1·H2를 검증하지 않는다.** 제약을 확정할 뿐이다.
- 나머지는 통과. forbid 5개, requirements 6개, out_of_scope·rollback·touches 정의됨. `because` 5건 모두 구체적.

## 공격 결과

### A — 악의적 준수: **성공 2건 (치명적)**

1. **`conditional` 이 ToS 실사를 통째로 우회하는 합법 경로다.** FORBID-2는 `verdict=allowed` 에만 ToS 스냅샷·조항 번호를 요구하고, `because` 는 스스로 "확보 실패는 forbidden 또는 **conditional(추가 확인 필요)**로 남겨야 한다"고 인정한다. 그런데 REQ-3·REQ-5·REQ-6은 **conditional 소스를 정상 수집 대상으로 취급**하고(crawl_policy 작성 대상이며 어댑터 대상 목록에 포함), C1의 `sources.allowlist.yaml` 도 "verdict ≠ forbidden" 을 전사한다. → **ToS를 확보하지 못한 소스를 `conditional` 로 찍어 전부 크롤링할 수 있다.** "추가 확인"이 언제 종결되는지, 종결 전 수집이 허용되는지 계약에 없다. **G3의 존재 이유가 무력화된다.**
2. **`allowed` 판정이 robots·rate 검사를 전면 면제한다.** REQ-3(crawl_policy 6필드)과 REQ-5(rate probe)는 **conditional 소스에만** 걸린다. 그런데 FORBID-1의 detect 는 "`crawl_policy.yaml` 의 `allowed_path_globs` 샘플 경로가 Disallow 에 매칭되는지" 검사한다 → **`allowed` 소스는 crawl_policy 항목이 없으므로 robots 충돌 검사의 대상이 되지 않는다.** verdict 를 `allowed` 로 주는 것만으로 FORBID-1·FORBID-3의 탐지 범위 밖으로 나간다. **자기참조적 구멍이다.**

### B — 조건 회피: **성공**

FORBID-1 `when` 은 "**대상 경로**에 대한 Disallow"다. `allowed_path_globs` 를 Disallow 되지 않은 구간으로만 적어두고 실제 수집은 C1·C2가 하므로, **실사 문서의 글롭과 어댑터의 실제 요청 경로가 일치하는지 검증하는 수단이 D3에도 C1에도 없다.** D3는 문서상 준수를, C1은 allowlist 전사를 할 뿐 둘을 대조하지 않는다.

### C — 탐지 무력화: **성공 3건**

1. D1·D2와 동일: **CI 없음 + 자작 검증기 + 위반 픽스처 메타테스트 없음.**
2. **FORBID-3 detect 는 `rate_probe_log.csv` 의 `requested_at` 인접 간격을 검사하는데 로그를 조사자가 직접 작성한다.** 실제 요청과 로그의 대응을 보증하는 것이 없다(응답 헤더 스냅샷·HAR 미요구). 429가 실제로 났어도 그 행을 지우면 REQ-5의 "429·403 = 0"을 통과한다.
3. **FORBID-5(PII) detect 는 `allow_fields` 필드명을 정규식 사전과 대조한다.** `author_name` → `contributor_label`, `profile_url` → `source_ref` 로 이름만 바꾸면 통과한다. 필드가 담는 **값의 성질**이 아니라 이름만 본다.

### D — 지름길 유도: **성공 (치명적)**

REQ-5는 "429·403 카운트 = 0"을 통과 조건으로 건다. 실사 중 429가 나오면 **가장 쉬운 해결은 `max_requests_per_min` 을 1로 낮추는 것**이고, 그러면 REQ-5도 FORBID-3도 동시에 통과한다. **`max_requests_per_min` 의 하한이 없다.** 그 값이 그대로 C1의 `sources.allowlist.yaml` 로 전사되면 크롤링 처리량이 실용 불가 수준이 되어 H1 실측 커버리지가 붕괴한다. → **D3의 acceptance 를 통과시키는 최적 행동이 제품을 죽인다. 이 계약에서 가장 위험한 인센티브다.**

두 번째: REQ-1은 "후보 소스 6개 이상"만 요구한다. 어려운 소스를 후보에서 빼고 쉬운 6개(공식 웹사이트·블로그 등)만 실사하면 통과한다. **네이버 플레이스·카카오맵 필수 포함이 REQ 본문 괄호 안 예시로만 있고 acceptance 검사에는 없다.**

### E — DAG 정합성: **결함 4건**

1. **`blocks: [C2, C3]` 인데 C1의 `depends_on` 에 D3가 있다.** D3의 blocks 에 C1 누락 → 양방향 불일치.
2. **C1이 참조하는 ID `D3-SOURCE-DILIGENCE` 는 D3의 실제 id `D3-SOURCE-DUE-DILIGENCE` 와 다르다.** 존재하지 않는 태스크 ID 참조 — §5 [구조] 항목. (수정 책임은 C1이나 정합성 파손이므로 여기 기록)
3. **C1이 필요로 하는 산출물을 D3가 만들지 않는다.** C1의 allowlist 는 `max_rps, per_host_concurrency, d3_ref` 를 "D3 실사 결과 전사"라 명시하는데, D3의 `crawl_policy.yaml` 은 **conditional 소스에만** 그 값을 만든다. `allowed` 소스에 대해 C1이 전사할 값이 존재하지 않는다.
4. **`raw_retention_days` 가 F2와 충돌한다.** D3 REQ-3은 소스별 원문 보존기간을 정하는데, F2 REQ-6은 `source_record` 를 **UPDATE·DELETE 가 DB 레벨에서 거부되는 append-only** 로 만든다. 보존기간 만료 시 삭제할 수단이 스키마에 없다. **두 계약이 정면 충돌한다.**

### F — 존재 이유: **부분 결함**

G3 입력 산출은 정확하다. 그러나 **H1·H2 참조는 장식적이다** — D3는 가설을 검증하지 않고 제약을 확정한다. `why` 도 가설이 아니라 폐기 리스크를 논한다. DAG 표의 D3 가설 칸도 "— (G3)"이다.

## 필수 수정 사항

1. **`conditional` 의 의미를 폐쇄한다.** "ToS 스냅샷 + 조항 번호가 확보된 상태에서 준수 파라미터 부과를 조건으로 허용"으로 정의하고, ToS 미확보는 반드시 `forbidden` 또는 신설 `pending`(어댑터 대상 제외)으로 분리. FORBID-2의 `must_not` 을 `verdict ∈ {allowed, conditional}` 로 확대.
2. **REQ-3·REQ-5의 적용 범위를 `verdict ≠ forbidden` 전체로 확대한다.** `allowed` 소스도 crawl_policy 6필드와 rate probe 를 갖게 해야 FORBID-1·FORBID-3의 detect 가 실제로 걸린다.
3. **`max_requests_per_min` 에 하한을 둔다** (예: <6 인 소스는 `forbidden` 처리하고 report.md 에 커버리지 손실로 계상). 임계를 낮춰 통과하는 지름길을 봉쇄.
4. **REQ-1의 필수 후보 소스를 acceptance 에 넣는다** (`sources/naver_place.md`·`kakao_map.md` 존재 검사).
5. **rate probe 의 물증을 요구한다.** 요청별 응답 상태·헤더 스냅샷(HAR 등)을 보존하고 검증기가 로그와 대조. 자기신고 로그는 증거가 아니다.
6. **FORBID-5의 detect 를 필드명 대조에서 내용 대조로 바꾼다** (각 `allow_field` 에 샘플값 3건 + `pii_assessment` 첨부).
7. **FORBID-3 `when` 을 조건부로 재작성한다**: "동일 소스에 대해 60초 창 내 요청 수가 `max_requests_per_min` 을 초과하는 경우".
8. **`raw_retention_days` 와 F2 append-only 의 충돌을 해소한다.** "보존기간 만료 처리는 payload 컬럼을 tombstone 으로 대체하며 행 삭제가 아니다"를 명시하거나 F2와 조율. **둘 중 하나가 반드시 바뀌어야 한다.**
9. **`blocks` 에 C1 추가**, C1의 ID 오타 정정 요청, `allowed` 소스의 `max_rps`/`concurrency` 산출 의무 추가.
10. `traces_to` 정리(H1·H2 제거 또는 근거 재서술), 위반 픽스처 메타테스트 + CI 등록 추가.

---

# D4 — REVISE

## 규격 위반

- [금지사항] **FORBID-3 `when` "legal_basis 필드를 작성할 때"는 '항상'에 해당한다.**
- [요구사항] **REQ-1은 `medical_scope.yaml` 항목에만 legal_basis 를 요구하는데 FORBID-3의 detect 는 "모든 규칙 항목"(4개 yaml 전체)에 요구한다.** 적용 범위 불일치 → 구현자가 어느 쪽을 따라도 다른 쪽이 깨진다.
- [구조] `traces_to: [G3, H1, S1, S3]` — **PRD G3는 "크롤링 소스 법적·기술적 실사"다.** 의료광고 표기 규칙은 G3 조건이 아니다. `gate` 주석의 "G3의 입력 일부를 산출한다"는 PRD 게이트 정의의 확대 해석이다. H1과의 연결도 없다.
- 나머지(순환·형용사·REQ 6개·forbid 5개·out_of_scope·rollback·touches)는 통과.

## 공격 결과

### A — 악의적 준수: **성공 2건 (치명적)**

1. **과잉 hide 가 완전히 무방비다.** `display_whitelist.yaml` 에 허용 포맷 5개를 극단적으로 좁게(예: `^도수치료 \d{1,2}회 [0-9,]+원$` 정확 매칭) 정의하면 REQ-2(포맷 ≥5), REQ-6(default hide), FORBID-1을 전부 만족하면서 **medical_wellness 축의 실제 가격이 거의 전부 hide** 된다. FORBID-5는 *다른 축에 규칙을 적용하는* 과잉교정만 막고, **medical 축 내부의 과잉 hide 는 어떤 FORBID도 막지 않는다.** FORBID-3의 `because` 가 "안전빵으로 규칙을 넓게 잡아 medical_wellness 축 전체가 사실상 비공개 처리되면 3축 중 하나가 제품에서 소멸한다"고 정확히 이 실패를 서술하는데, **그것을 막는 REQ도 FORBID도 없다.** PRD G1이 축별 차등 판정으로 "전부 아니면 전무"를 회피한 노력을 D4가 조용히 되돌린다.
2. **`advisory` 예외가 FORBID-2를 자기무력화한다.** REQ-5는 "`status=advisory` 인 항목은 pattern/enum 없이도 rule_id 보유 가능(단 advisory_index 등재)"을 허용하고 FORBID-2의 detect 가 그 예외를 그대로 인정한다. 그런데 FORBID-2의 `must_not` 은 "자연어 규칙에 rule_id 를 부여해 **C4·C7·W3 가 인용 가능한 확정 규칙으로 등재**"하는 것이다. **advisory 항목도 `MED-A-01` 형식 rule_id 를 갖고 하류는 rule_id 를 인용한다.** 하류가 advisory 인지 확정인지 구별할 구조적 수단이 없다 → 자연어 규칙을 인용한 CI 체크가 "통과 시늉만" 하는 상황이 그대로 발생한다. **FORBID-2가 자기 `because` 에 적은 실패를 자기 예외 조항으로 허용한다.**

### B — 조건 회피: **성공**

FORBID-5 `when` 은 "`applies_to` 에 exercise_body 또는 relax_recovery 가 포함되는 경우"다. `applies_to` 를 `medical_wellness` 로만 두고 **패턴 자체는 축 무관하게 넓게** 만들면 발동하지 않는다. 실제로 W2·W3·W4는 "D4 금칙어 사전으로 렌더 HTML 스캔"이라고만 적었지 **축별 적용 범위를 구분하지 않는다** → 필라테스 페이지의 "신규 할인"까지 차단된다. `when` 이 D4 문서 내부만 보고 하류의 사용 방식을 보지 않아 우회된다.

### C — 탐지 무력화: **성공 (치명적)**

1. **`golden_cases.yaml` 은 규칙 저자가 같은 PR에서 만든 자기채점 시험지다.** REQ-2/3/4/6의 acceptance 는 전부 "golden_cases 기대값과 100% 일치"다. 규칙과 시험을 같은 주체가 만들면 **회귀는 방지되지만 정확성은 전혀 검증되지 않는다.** 정규식 20개를 `할인`·`이벤트`·`무료` 같은 단순 문자열로 나열하고 miss 케이스 20건을 무관한 문장으로 채우면 REQ-3이 통과한다. **실제 크롤 원문에 대한 재현율(recall) 요구가 0이다.** 외부 코퍼스가 필요한데 D4는 D1과 병렬(`depends_on: []`)이라 실측 표본을 쓸 수 없다 — **병렬 배치가 D4의 검증 가능성을 구조적으로 제거했다.**
2. **FORBID-4 detect("base 리비전 대비 golden_cases 변경 감지")는 `pr_count: 1` 인 이 태스크의 첫 PR 에서 base 가 없어 절대 발동하지 않는다.** 5개 FORBID 중 1개가 이 태스크에서는 사문이다.

### D — 지름길 유도: **성공**

㉠ 허용 포맷을 좁혀 전부 hide ㉡ 애매한 규칙을 `advisory` 로 도피 ㉢ golden 케이스를 규칙에 맞춰 작성 — **세 경로 모두 계약 위반이 아니다.**

### E — DAG 정합성: **결함 (치명적)**

- **`blocks: [F4, C4, C7, W3]` 인데 실제로 D4 산출물을 인용하는 태스크는 C6·W2·W4·O2 도 포함한다** (C6:108/117행, W2:99/101행, W4:96/98행, O2:126/128행). **blocks 4건 누락.**
- **더 심각한 것은 인용 태스크들의 `depends_on` 에 D4가 하나도 없다는 점이다.** C4=`[C1,F2]`, C7=`[C4,C6]`, W3=`[W1]`, W2=`[W1]`, W4=`[W1,C4,C6]`. 스케줄러가 `depends_on` 을 읽으면 **D4 산출물 없이 W2·W3·W4가 착수되고 그들의 FORBID detect("D4 금칙어 사전으로 스캔")가 참조할 파일이 존재하지 않는다.** 없는 파일을 참조하는 테스트는 에러가 나거나 스텁으로 대체되고, 스텁은 항상 통과한다. Phase 3(W)은 DAG상 F2·F3만 요구하므로 **G3/D4를 건너뛰는 경로가 열려 있다.**
- **파일 경로가 3중으로 불일치한다:**
  - D4 실제 산출물: `docs/discovery/D4/forbidden_lexicon.yaml`, `display_whitelist.yaml`
  - F4가 전제하는 입력: `docs/discovery/D4-medical-guardrails.md`, `data/legal/medical-banned-terms.txt` ← **D4가 만들지 않으며 `touches: docs/discovery/D4/**` 제약상 만들 수도 없다**
  - C4·C6·W2·W3·W4·O2: 경로 없이 **"D4 금칙어 사전"·"D4 허용 포맷 화이트리스트"라는 이름으로만** 인용
  → **하류 FORBID 전체가 참조 대상 없이 떠 있다.** "산출물 형식이 인용 가능할 만큼 구체적인가"의 답은 **아니오**다. rule_id 체계는 잘 설계됐으나 **어떤 파일을 어떤 경로에서 어떤 스키마로 로드하는지가 계약에 없어** 하류가 rule_id 를 쓰지 않고 이름으로 인용하는 결과를 낳았다.
- 산출물이 전부 `docs/` 아래인데 W2·W3·W4 렌더 테스트와 C7 런타임 판정이 이를 로드해야 한다. **`docs/` 를 런타임/테스트 의존 경로로 삼는 것이 F1의 모노레포 구조 어디에도 승인되어 있지 않다.**

### F — 존재 이유: **부분 결함**

제품 보호 관점의 존재 이유는 명확하고 강력하다(`why` 우수). 그러나 **어떤 PRD 가설도 검증하지 않는다.** `traces_to` 의 H1은 무관하고 G3는 게이트 정의상 소스 실사다. S1·S3와의 연결은 타당하다.

## 필수 수정 사항

1. **`medical_wellness` 축의 최소 공개 커버리지 요구를 REQ로 추가한다.** 예: "REQ-7: D1 표본 중 medical_wellness · `price_found=true` 행의 `price_evidence_snippet` 에 화이트리스트 적용 시 `show` 판정 비율 ≥ X%". D1과 병렬이라 불가능하다면 **D4를 D1 이후로 재배치**하거나, medical 가격 표기 실측 코퍼스 30건 이상을 D4 자체 산출물로 요구한다. **이것이 없으면 D4는 항상 "전부 hide"로 도피할 수 있고 3축 UVP가 소멸한다.**
2. **`advisory` 항목의 rule_id 네임스페이스를 분리한다** (`^MEDA-[A-Z]-\d{2}$`). "하류 태스크는 `MED-` 접두 rule_id 만 인용할 수 있다"를 계약에 명시.
3. **소비 인터페이스를 계약으로 고정한다.** ㉠ 정본 경로를 `docs/` 밖으로(예: `packages/legal/medical/`) ㉡ 각 yaml 의 JSON Schema 포함 ㉢ `version` 필드와 semver 규칙 ㉣ **`exported_rules.json`(rule_id·kind·pattern·applies_to·version)을 기계 판독 산출물로 발행.** done_when 의 "계약 저자에게 전달되었다"는 기계 검증 불가한 인간 절차이므로 위 산출물로 대체한다.
4. **`blocks` 에 C6·W2·W4·O2 를 추가하고** C4·C6·C7·W2·W3·W4·O2 의 `depends_on` 에 D4 추가를 상신한다. **현재는 D4 없이 Phase 3 전체가 착수 가능하다.**
5. **REQ-1과 FORBID-3의 legal_basis 적용 범위를 일치시킨다.**
6. **FORBID-3 `when` 을 조건부로 재작성한다** ("규칙 항목의 `status` 가 `binding` 인 경우" 등).
7. **FORBID-4를 이 태스크에서 발동 가능하게 하거나 후속 유지보수 규칙임을 명시한다.** 대안: golden 케이스에 `origin`(observed/synthetic) 필드를 넣고 **`origin=observed` 비율 ≥ 50%** 를 REQ로 추가해 자기채점 문제를 완화.
8. **각 규칙에 `applies_to` 를 필수화하고, 하류가 축 필터 없이 사전 전체를 적용하는 것을 금지하는 조항을 추가한다.**
9. `traces_to` 정리 — G3 대신 별도 게이트 신설 상신, H1 제거.

---

# F1 — REVISE

## 규격 위반

| 체크리스트 항목 | 판정 | 내용 |
|---|---|---|
| traces_to 가 PRD에 없는 ID 참조 | ❌ | **`S4` 는 Lean Canvas §4에서 "리드 액션 계측"이다.** F1의 `why` 는 S4를 "앱 확장 가능한 API 경계"로 서술한다 — 실제로는 PRD §2 기술스택 결정이며 S 항목이 아니다. **오참조** |
| depends_on 순환/미존재 | ✅ | 없음 |
| REQ 하나에 복수 요구 '그리고' 결합 | ❌ | REQ-5 = "6개 job 이 전부 실행되고 **그리고** wall-clock 10분 이내" — 두 요구. spec R-4 위반 |
| requirements 8개 초과 | ✅ | 7개 |
| forbid 개수 | ✅ | 5개 |
| when 이 없거나 '항상' | ❌ | FORBID-2 `when` 에 **의도**("green 으로 만들기 위해")가 포함 → 판정 불가. detect 는 의도 무관 diff 검사이므로 **실질적으로 무조건 금지**로 작동 |
| detect 없음 / 전부 코드리뷰 | ✅ | 전부 CI 기반 |
| **touches 미정의 또는 과도** | ❌ | **`pnpm-lock.yaml` 과 `README.md` 가 touches 에 없다** — 자기 요구사항과 충돌 |
| out_of_scope / rollback | ✅ | 정의됨. rollback 이 외부 상태(브랜치 보호 설정) 해제까지 기술 — 양호 |

## 공격 결과

### A — 악의적 준수: **대체로 방어됨**

REQ-3(경계 규칙)과 FORBID-1은 **위반 픽스처가 반드시 실패하는지 확인하는 메타 테스트**를 detect 에 명시했다 — 이 배치에서 유일하게 "탐지 수단 자체를 검증"하는 계약이고 가장 잘 설계된 부분이다. `depcruise` 클린 0건 + 픽스처 exit≠0 이중 검사로 "규칙을 등록만 하고 실제로는 안 도는" 악의적 준수가 막힌다.

다만 **REQ-4는 반대 방향의 악의적 준수를 허용한다**: `python` job 을 사실상 아무것도 검사하지 않는 no-op(대상 테스트 0건)으로 만들어도 REQ-4·FORBID-3은 통과한다. out_of_scope 가 "hello-world 수준 골격 + 테스트 1개"라 의도된 범위이나 **"테스트 1개"가 무엇을 assert 하는지 acceptance 가 없다.**

### B — 조건 회피: **성공 2건**

1. **FORBID-2가 예외 경로 없는 무조건 금지다.** `eslint-disable` 은 서드파티 타입 문제 등에서 정당하게 필요한 순간이 반드시 온다. 그때 규칙이 한 번 깨지면 spec 원칙 2가 경고한 "다른 모든 금지사항도 협상 가능"이 발생한다. 게다가 이 규칙은 **F1 이후 모든 태스크에 적용되어야 하는 리포 전역 규칙**인데 예외 승인 절차가 정의되어 있지 않다.
2. **FORBID-4의 grep 3토큰은 우회가 쉽다.** `export const dynamic='force-dynamic'` 만 잡고, 실제로 라우트를 동적으로 만드는 **`cookies()` / `headers()` / `searchParams` 사용, `fetch(..., {cache:'no-store'})`, `unstable_noStore` 별칭 import** 를 못 잡는다. 변수 우회(`'force-'+'dynamic'`)도 통과한다. `because` 가 걱정하는 "수천 개 랜딩 미색인"을 grep 3개로 막을 수 없다.

### C — 탐지 무력화: **성공 1건**

**FORBID-2의 detect 를 검증하는 픽스처가 done_when 에 없다.** done_when 은 "위반 픽스처 3종(web→db import, force-dynamic, 가짜 시크릿)"만 확인한다. `|| true`/`continue-on-error`/`eslint-disable` 신규 추가를 잡는 lint 체크가 **실제로 동작하는지 확인하는 절차가 없다.** 하필 이 FORBID가 "이후 F2~W7 모든 FORBID 의 탐지 기반"이라고 스스로 선언한 규칙이다.

### D — 지름길 유도: **성공 2건 (자기모순)**

1. **FORBID-5가 F1 자신의 PR을 차단한다.** REQ-1이 `pnpm install --frozen-lockfile` 을 요구하므로 **`pnpm-lock.yaml` 이 반드시 커밋되어야 하는데 touches 화이트리스트에 없다.** done_when 은 "README 에 워크스페이스 경계 다이어그램과 CI job 설명 포함"을 요구하는데 **`README.md` 도 touches 에 없다.** FORBID-5의 detect(touches 밖 경로 1건이라도 exit 1)가 그대로 구현되면 **F1은 자기 요구사항을 만족하는 순간 자기 금지사항을 위반한다.** 에이전트가 이 모순에 부딪히면 touches 를 조용히 넓히거나 체크를 비활성화한다 — **그 순간 FORBID-2가 경고한 "우회 관용구 학습"이 F1 자신에게서 시작된다.**
2. **REQ-5의 `timeout-minutes: 10` 이 하류 CI 전체의 시한폭탄이다.** F2(`db-schema`), F3(`ui-a11y`), F4(`ontology`)가 같은 워크플로에 job 을 추가하는데 **job 별 시간 예산 배분이 없다.** PostGIS 기동 + 마이그레이션 왕복(F2 REQ-7) + Playwright 컴포넌트 테스트(F3 REQ-4/7) + Storybook 빌드(F3 REQ-5)를 더하면 10분을 넘는다. 그때 최적 행동은 **timeout 상향**인데 FORBID-2의 열거(`continue-on-error`·`|| true`·disable 주석)에 없다.

### E — DAG 정합성: **결함 2건**

1. **`blocks: [F2, F3, F4, O3]` 인데 F4의 `depends_on` 은 `[D1, D4]` 로 F1이 없고 F4는 F1을 `parallel_with` 에 넣었다.** 그런데 F4는 `.github/workflows/ci.yml` 에 job 을 추가하고 `node tools/ontology-validate` 를 CI로 돌린다 → **F4는 실제로 F1에 의존한다.** 양방향 불일치이며 F4 쪽이 틀렸다.
2. **F1 REQ-1의 "정확히 4개 패키지"가 F3와 정면 충돌한다.** acceptance 는 `pnpm list -r --depth -1 --json` 결과의 **패키지 수가 4**임을 assert 한다. F3는 `packages/ui` 를 신설한다 → **F3 머지 즉시 F1의 `build` job 이 영구 실패한다.** F1의 touches 에도 out_of_scope 에도 `packages/ui` 언급이 없다.

### F — 존재 이유: **부분 결함**

- H3 지지는 성립한다(FORBID-4가 정적 생성 기본값을 지켜 H3 측정 가능성 확보). **S4 참조는 오참조.**
- `why` 의 "이후 모든 태스크의 FORBID가 탐지 수단을 갖지 못한다"는 정확한 진술이며, 실제로 F2~W7의 detect 대다수가 F1의 CI job 이름(`boundary`, `lint`, `test`)에 의존한다 — 이 점에서 F1은 배치 전체의 기반으로 정당하다.
- **그러나 D1~D4의 `validate_d*.py` 를 실행할 CI job 이 F1에 없다.** 6개 job 중 `python` 은 `services/crawler` 전용(REQ-4)이고 `scripts/discovery/**` 를 도는 job 이 없다. → **Discovery 4건의 모든 `on_violation: block_merge` 를 집행할 기반이 F1에 존재하지 않는다.** 팀 리드 질문("F1이 그 기반을 실제로 제공하는가")에 대한 답: **웹·데이터 경계에 대해서는 제공하고, Discovery 검증에 대해서는 제공하지 않는다.**

## 필수 수정 사항

1. **`touches` 에 `pnpm-lock.yaml` 과 `README.md` 를 추가한다.** 현재 F1은 자기 done_when 을 수행하면 FORBID-5를 위반한다.
2. **REQ-1의 "정확히 4개 패키지"를 "≥4개이며 apps/web·packages/api·packages/db·packages/config 를 반드시 포함"으로 바꾼다.** 현재대로면 F3 머지 시점에 CI가 죽는다.
3. **`scripts/discovery/**` 를 실행하는 CI job(`discovery`)을 F1 산출물에 추가한다.** 없으면 Discovery 4건의 FORBID 22개가 전부 집행 불가다.
4. **REQ-5를 둘로 분리하고 job 별 `timeout-minutes` 예산을 명시한다.** **FORBID 에 "CI 실패를 timeout 상향으로 해결하는 것"을 추가**한다.
5. **FORBID-2에 예외 경로를 규칙 안으로 끌고 들어온다** (`eslint-disable` 은 `-- reason: <이슈번호>` 주석 + CODEOWNERS 승인 시에만 허용, `continue-on-error`·`|| true` 는 예외 없음).
6. **FORBID-2의 detect 를 검증하는 위반 픽스처를 done_when 에 추가한다** (3종 → 4종).
7. **FORBID-4의 detect 를 확장한다.** grep 토큰에 `unstable_noStore`, `cache: 'no-store'`, `fetchCache`, `cookies()`, `headers()` 추가하고, **`next build` 라우트 요약 assert 를 주 탐지 수단으로 승격**(grep 은 보조).
8. **`traces_to` 의 `S4` 를 정정한다.** S4(리드 액션 계측)를 지지하는 태스크는 W6이다. `why` 문장도 함께 수정.
9. **F4의 `depends_on` 에 F1 추가를 상신**하거나 F1의 `blocks` 에서 F4 제거.
10. REQ-4의 "테스트 1개"가 무엇을 assert 하는지 acceptance 에 명시(no-op job 방지).

---

# F2 — REVISE (REJECT 경계)

## 규격 위반

| 체크리스트 항목 | 판정 | 내용 |
|---|---|---|
| requirements 8개 초과 | ⚠️ | 7개. 다만 **누락 필드·테이블을 채우면 반드시 8을 넘는다** → §4 분할 신호 |
| acceptance 기계 검증 | ⚠️ | REQ-2는 **플래너 의존이라 불안정** |
| **REQ 내부 모순** | ❌ | **REQ-1 "정확히 7개 테이블" ↔ REQ-4 `price_conflict` · FORBID-5 `venue_suppression`** = 실제 9개. artifacts 도 "테이블 7종"으로 잘못 기재 |
| forbid 개수 | ✅ | 6개(상한 내) |
| when/must_not/because/detect/on_violation 5요소 | ✅ | 6건 전부 충족, `because` 우수 |
| out_of_scope / touches / rollback | ✅ | 정의됨 |
| traces_to | ✅ | H1·H2·S1·G4 전부 실재 |

## 공격 결과

### A — 악의적 준수: **성공**

REQ-1의 스냅샷 비교(`schema.snapshot.json` diff 0)는 **스냅샷 파일을 저자가 생성한다.** 마이그레이션을 짜고 덤프해서 커밋하면 정의상 항상 일치한다. **스냅샷이 "기대값"이 아니라 "결과의 복사본"이므로 REQ-1은 어떤 스키마에 대해서도 통과한다.** 실질 검증은 REQ-2~6과 FORBID-2~6의 개별 assert 뿐이고, 그것이 커버하지 않는 컬럼은 자유다. 구조 자체는 회귀 방지 목적으로 정당하나 **"7개 테이블"이라는 유일한 구조적 제약이 아래 E의 모순으로 무너지면 REQ-1은 완전히 공허해진다.**

### B — 조건 회피: **성공 2건**

1. **FORBID-4(성별 중립)의 정규식 `(gender|sex|female|male)` 은 컬럼명만 본다.** `target_audience ENUM('women','men')`, `for_w_only`, `audience_segment`, 한글 라벨 `'여성전용'` 은 전부 통과한다. `because` 가 막으려는 것은 "성별이 1급 스키마 축이 되는 것"인데 **이름만 바꾸면 축이 된다.** 반대로 `unisex_facility` 같은 정당한 컬럼은 부분매칭으로 차단된다.
2. **FORBID-6의 정규식 `(name|phone|tel|email|ip_addr|raw_ip|lat|lng)` 은 부분매칭이라 `event_name`·`action_name` 등 정당한 컬럼을 차단**하면서, **`user_agent`·`referrer`·`device_id`·`fingerprint`·솔트 없는 세션 해시 등 실질 식별자는 놓친다.** 과잉과 미탐의 최악 조합.

### C — 탐지 무력화: **성공**

**FORBID-1의 detect 가 F2 자신의 down 마이그레이션을 차단한다.** REQ-7은 up/down 쌍과 왕복을 요구하고 rollback 은 `db:migrate:down` 을 전제한다. **down 스크립트는 `DROP TABLE` 을 포함할 수밖에 없다.** FORBID-1의 `when` 은 "신규 마이그레이션에 DROP TABLE … 포함"이며 up/down 구분이 없다 → **F2 자신이 `allow-destructive` 라벨 + 백업 아티팩트 없이는 머지 불가**해진다. 라벨을 붙여 통과시키는 순간 예외 경로가 태스크 1건차부터 소비되고, 이후 모든 파괴적 DDL이 "F2도 붙였으니까"로 정당화된다.

FORBID-3의 detect 중 "마이그레이션 SQL 에 `DEFAULT 'public'` 정규식 매치 시 실패" 는 `public` 이 Postgres 기본 스키마명이라 정당한 SQL과 충돌할 소지가 있다(과잉 정규식).

### D — 지름길 유도: **성공**

1. **REQ-2의 EXPLAIN Index Scan assert 는 1,000행에서 플래너가 Seq Scan 을 고르면 실패한다.** 막힌 에이전트의 최적 행동은 `SET enable_seqscan = off` 를 테스트에 넣는 것이고, 그러면 인덱스가 없어도 통과하는 무의미한 테스트가 된다. 계약이 이를 금지하지 않는다.
2. **FORBID-1의 `allow-destructive` 라벨을 누가 붙이는지 계약에 없다.** PR 작성자가 스스로 붙일 수 있으면 예외는 무조건 열려 있다.

### E — DAG 정합성 / 하류 표현력: **결함 5건 (치명적)**

**"F2 스키마가 C4의 conflict·신뢰도·공개여부, C7의 게이트 판정을 표현할 수 있는가"의 답: conflict·신뢰도는 가능, 공개판정과 C4 출력은 불가능.**

1. **✅ conflict** — `price_conflict` 테이블(양쪽 `price_plan_id` 보존)이 REQ-4에 있고 W3 REQ가 실제로 조회한다. C4 FORBID-2("임의의 한쪽을 대표값으로 단독 노출 금지")를 표현 가능.
2. **✅ 신뢰도** — `price_plan.confidence numeric(3,2)` + CHECK(0~1). W3의 `confidence ≥ 0.7` 판정과 정합.
3. **❌ 자기모순** — REQ-1은 "**정확히 7개** 도메인 테이블"을 스냅샷으로 잠그는데 REQ-4가 `price_conflict` 를, FORBID-5가 `venue_suppression` 존재 assert 를 요구한다 → **실제 9개.** 스냅샷이 7개만 담으면 REQ-4·FORBID-5를 만족하는 순간 REQ-1이 실패한다. **W3가 `price_conflict` 를 실제로 조회하므로 REQ-1 쪽이 틀렸다.**
4. **❌ C7 공개판정 표현 불가** — C7 REQ-1은 "`is_public` 컬럼에 쓰기 경로가 정확히 1개"를 assert 하고, C7 rollback 은 "`is_public`/`quality_score`/`reason_codes` 는 파생 컬럼"이라 명시하며, W7·O2도 `venue.is_public` 을 직접 참조한다. **F2는 `visibility` ENUM 만 정의하고 셋 다 없다.** 결과: 공개 상태를 표현하는 축이 **`visibility` 와 `is_public` 두 개**가 된다 — C7이 설계 전제에서 "공개 여부를 판정하는 코드가 2곳 이상 생기는 순간 게이트는 없는 것과 같다"고 경고한 바로 그 상황을 **F2가 스키마 레벨에서 만든다.**
5. **❌ C4 출력 필드 6종 부재** — C4 REQ-3/4/5/6/7이 산출하는 `price_unit_type`, `price_per_month_krw`, `period_days`, `source_snippet`, `captured_at`, `parser_version` 중 **F2가 정의한 것이 하나도 없다.** C7 REQ는 "스코어 입력값(price_unit_type, 소스 개수, captured_at, 필수 필드)"을 읽고, C4 rollback 은 "C7 게이트가 `parser_version` 불일치 레코드를 자동 비공개 처리"한다고 적었다. **F2의 `why`("C4·C7의 금지사항이 저장 시점에 강제될 수 있다")가 산출물로 뒷받침되지 않는다.**
6. **❌ D4의 판정 출력 `needs_review` 를 표현 못 한다.** `visibility` ENUM 4값에 없다. `hidden_legal` 로 뭉개면 "법적 확정 비공개"와 "사람 검토 필요"가 구분 불가 → **O2 검수 큐가 대상을 특정할 수 없다.**
7. **❌ D3의 `raw_retention_days` 와 REQ-6 append-only 충돌.** 보존기간 만료 삭제 경로가 스키마에 없다.

DAG 표기 자체(`depends_on: [F1]`, `blocks: [C1,C4,C5,C7,W1,W3,O2]`)는 순환 없고 게이트 정합하다.

### F — 존재 이유: **부분 결함**

H1·H2·S1·G4 참조는 타당하다. 그러나 **`why` 가 주장하는 "C4·C7의 금지사항을 저장 시점에 강제"는 현재 REQ 집합으로 달성되지 않는다.** FORBID-2·3·4·5·6은 모두 훌륭한 방어이지만 **방어할 대상 컬럼의 절반이 정의되지 않았다.**

## 필수 수정 사항

1. **REQ-1을 "정확히 9개 도메인 테이블"(+ `price_conflict`, `venue_suppression`)로 정정하고 artifacts 의 "테이블 7종"도 함께 고친다.**
2. **공개 상태 표현을 하나로 통일한다.** `visibility` 를 정본으로 하고 `is_public` 을 생성 컬럼 또는 `public_venue` 뷰 필드로만 파생시키거나, 그 역. **동시에 `quality_score`(0~100 정수)와 `reason_codes`(폐쇄 enum 배열) 컬럼을 REQ에 추가한다.** 어느 쪽이든 F2에서 확정해야 하며 **확정 전에는 C7이 착수 불가다.**
3. **`price_plan` 에 C4 출력 필드 6종을 추가한다.** C4 REQ-3의 불변식(`unit_type != per_session → price_per_session IS NULL`)을 **CHECK 제약으로 스키마에 넣으면** F2의 `why` 가 비로소 성립한다.
4. **`visibility` ENUM 에 `needs_review` 를 추가**하거나 D4 판정 출력을 별도 컬럼(`legal_check_result`)으로 분리한다.
5. **FORBID-1의 `when` 을 up 마이그레이션으로 한정한다** ("동일 버전의 down 스크립트의 되돌림용 DROP 은 예외"). **`allow-destructive` 라벨의 부여 주체를 CODEOWNERS 승인으로 못박는다.**
6. **FORBID-4/6 의 detect 를 이름 정규식에서 허용 컬럼 화이트리스트(폐쇄 목록)로 전환한다.** 그래야 `target_audience`·`user_agent`·`device_id`·`fingerprint` 가 자동 차단되고 `event_name` 오탐이 사라진다. FORBID-4는 컬럼명 + ENUM 라벨 + `COMMENT ON COLUMN` 까지 검사 범위를 넓히고 사전에 `women|men|여성|남성` 추가.
7. **REQ-2의 acceptance 에 "플래너 설정(`enable_seqscan` 등)을 테스트에서 변경하지 않을 것"을 명시**하거나 시드 행수를 5만행으로 올린다.
8. **`raw_retention_days` 충돌을 해소한다**(payload tombstone 경로를 REQ-6에 명시).
9. 1~4 반영 시 requirements 가 8개를 넘는다. **F2a-CORE-SCHEMA / F2b-QUALITY-SCHEMA 분할 여부를 저자가 판단하고 근거를 남길 것** (기준: C1이 F2a만으로 착수 가능한가. 불가능하면 하나로 둔다 — spec §4 억지 분할 금지).

---

# F3 — REVISE

## 규격 위반

| 체크리스트 항목 | 판정 | 내용 |
|---|---|---|
| when 이 '항상'에 해당 | ❌ | **FORBID-5: `when`("아이콘 단독 변형을 제공하는 경우") = `must_not`("아이콘 단독 변형을 제공")** — 동어반복. 조건부가 아니라 무조건 금지 |
| 주관적 형용사 | ✅ | 없음. 17px / 7.0:1 / 4.5:1 / 48px / 200% 전부 수치화 — 이 배치에서 가장 모범적 |
| acceptance 기계 검증 | ⚠️ | REQ-3의 "**허용 페어**" 집합이 저자 정의이고 잠겨 있지 않음 |
| requirements / forbid 개수 | ✅ | 7 / 5 |
| detect 없음 / 코드리뷰 | ✅ | 전부 자동 |
| out_of_scope / touches / rollback | ✅ | 정의됨 |
| 기타 | ⚠️ | `workstream: web` 인데 DAG상 Phase 1 Foundation — 분류 기준 불일치(경미) |

## 공격 결과

### A — 악의적 준수: **성공 (치명적). 이 배치의 교과서 사례.**

**REQ-6과 FORBID-3은 "가격을 노출하면 안 되는 조건"만 규정하고 "노출해야 하는 조건"을 규정하지 않는다.** `PriceDisplay` 를 **모든 입력에 대해 항상 "가격 미공개"를 렌더**하도록 구현하면:
- REQ-6(`test:price-display`: null/저신뢰 입력에 숫자 없음) → 통과
- FORBID-3(저신뢰/null 에 숫자 노출 금지) → 통과
- REQ-1~5, REQ-7 → 무관하게 통과
- done_when 의 "위반 픽스처 3종(… 숫자 노출 PriceDisplay)" → 통과

**계약 100% 준수 + 제품 완전 파괴.** spec §5 서두의 "파싱 실패 시 null 반환만 요구하고 실패율 상한이 없으면 전부 null 반환이 계약을 100% 준수한다"가 그대로 재현됐다. **UVP가 "가격 비교"인데 가격을 표시하라는 요구사항이 계약에 없다.**

**시도 2 — 실패하는 대비비 페어를 허용 목록에서 뺀다.** REQ-3은 "정의된 모든 (텍스트 토큰 × 배경 토큰) **허용 페어**"를 검사하는데 그 목록을 저자가 만든다. FORBID-2는 "특정 토큰을 예외 목록에 추가"를 금지하지만 **detect 는 `thresholds.json` diff 만 본다.** 허용 페어 목록이 `tokens.json` 이나 별도 파일에 있으면 **탐지 범위 밖**이다. → **임계값은 잠겼는데 검사 대상 집합은 자유롭게 줄일 수 있다.**

**시도 3 — 투명 pseudo-element 로 히트영역만 48px 로 늘린다.** REQ-4 통과, 시각 타깃은 24px. 의도 훼손이나 계약은 만족(경미).

### B — 조건 회피: **성공**

**FORBID-1 `when` 이 "`tokens.json` 에 *없는* 색상/px 리터럴"이다.** 문언대로면 tokens.json 에 존재하는 값(예: `16px`)은 하드코딩해도 금지에 걸리지 않는데, REQ-1은 "px 리터럴이 0건"을 무조건 요구한다. **REQ와 FORBID의 조건이 어긋난다.** 또 미디어쿼리 breakpoint, `border: 1px`, `outline` 등 px 리터럴이 정당한 경우가 반드시 발생하는데 예외 경로가 없다 → 원칙 2의 무조건 금지 함정.

### C — 탐지 무력화: **부분 방어됨 (양호)**

FORBID-1과 FORBID-4는 **위반 픽스처 메타 테스트**를 명시했고 done_when 에도 3종 확인이 있다 — F1과 함께 이 배치에서 탐지 검증이 가장 성실하다. FORBID-3도 "스냅샷이 아니라 정규식 assert 로 고정"이라 못박아 스냅샷 갱신 우회를 차단했다. 다만 **FORBID-2의 detect 를 검증하는 픽스처는 없다.**

### D — 지름길 유도: **성공 2건 (치명적)**

1. **`threshold-change-approved` 라벨을 PR 작성자가 스스로 붙일 수 있다.** FORBID-2의 detect 는 "diff 에 `thresholds.json` 변경 포함 + 라벨 없으면 exit 1"이다. **라벨을 붙이면 통과한다.** CODEOWNERS 는 리뷰 승인만 강제하고 라벨 부착은 통제하지 않으며, 에이전트가 `gh pr edit --add-label` 을 실행하는 것을 막는 조항이 없다. → **"임계값 낮추기"라는 이 배치 최대의 지름길에 대해 F3가 유일하게 명시적 방어를 시도했으나, 그 방어가 자물쇠가 아니라 문고리다.**
2. **F3 자신의 PR 이 FORBID-2에 걸린다.** F3는 `thresholds.json` 을 **신규 생성**한다 → diff 에 포함 → 라벨 없으면 exit 1. **신규 생성 예외가 정의되어 있지 않다.** F1 FORBID-5와 동일한 자기차단 구조.

### E — DAG 정합성: **결함 1건**

`depends_on: [F1]`, `blocks: [W1,W2,W3,W5,W7]` 은 순환 없고 게이트 정합. W2/W3/W5/W7 은 W1 경유 간접이나 허용 범위.
**그러나 F3가 신설하는 `packages/ui` 가 F1 REQ-1의 "정확히 4개 패키지" assert 를 영구 실패시킨다.** F3 계약 어디에도 "F1 REQ-1을 함께 수정해야 한다"는 언급이 없다. **F3 머지 = F1 CI 파손.** 또 `ui-a11y` job 추가가 F1의 워크플로 10분 상한을 압박한다.

### F — 존재 이유: **통과**

H4·H5를 F3가 직접 검증하지는 않지만 `why` 가 "측정 가능해진다"로 정확히 서술했다 — 가독성이 무너지면 H4·H5의 저조한 수치가 가설 기각인지 UI 실패인지 분리 불가해진다는 논거는 유효하다. S2 참조도 `FilterChip` 산출물로 뒷받침된다. **장식적 참조 아님.**

## 필수 수정 사항

1. **positive 요구사항을 추가한다.** "REQ-8: `PriceDisplay` 는 `price_per_session` 이 non-null 이고 `confidence ≥ price.minConfidence` 인 입력에 대해 회당 단가 숫자와 통화 단위를 렌더한다. acceptance: 고신뢰 픽스처 5건의 `textContent` 가 `/[0-9]{1,3}(,[0-9]{3})*원/` 에 매치." **최우선 — 없으면 항상 '미공개'를 렌더하는 구현이 계약을 완전히 준수한다.**
2. **`threshold-change-approved` 라벨을 자가 부여 불가하게 만든다.** detect 를 "라벨 존재"에서 **"`thresholds.json` 에 대한 CODEOWNERS 승인 리뷰 존재"(GitHub API 조회)** 로 바꾸거나 최소한 "라벨 부여자 ≠ PR 작성자"를 검사한다. **라벨은 통제가 아니다.**
3. **FORBID-2에 신규 생성 예외를 명시한다** ("`thresholds.json` 이 base 에 존재하지 않는 최초 도입은 제외").
4. **허용 페어 목록을 잠금 대상에 포함한다.** REQ-3의 페어 목록을 `thresholds.json` 안에 두거나 별도 파일을 CODEOWNERS 보호 + FORBID-2 detect 대상에 추가.
5. **FORBID-1의 `when` 을 REQ-1과 일치시키고 예외를 규칙 안으로 끌고 들어온다** (breakpoint 파일, border-width 화이트리스트).
6. **FORBID-5의 `when` 을 재작성한다** (현재 when=must_not 동어반복). 예: "`variant` prop 값이 `'icon-only'` 이거나 children 에 텍스트 노드 없이 아이콘 요소만 전달되는 경우". detect(`test:label`)는 이미 적절하다.
7. **F1 REQ-1 수정을 F3의 전제로 명시하고** done_when 에 "F1 `build` job 이 여전히 green" 을 추가한다.
8. `ui-a11y` job 의 `timeout-minutes` 를 F1 총 예산 안에서 명시.

---

# F4 — REJECT

## 규격 위반

| 체크리스트 항목 | 판정 | 내용 |
|---|---|---|
| **depends_on 이 존재하지 않는 산출물을 참조** | ❌ | **선행 입력 3개 파일이 D1·D4의 artifacts 에 하나도 존재하지 않는다** |
| **depends_on 누락** | ❌ | `.github/workflows/ci.yml` 을 수정하고 CI job 을 추가하면서 **`depends_on` 에 F1 없음**(F1은 `parallel_with`) |
| **gate 정합** | ❌ | **`gate: G1` 의 명시된 목적과 REQ-2가 직접 모순** |
| traces_to 가 PRD에 없는 ID | ⚠️ | `G3` 는 PRD상 "크롤링 소스 법적·기술적 실사"로 F4와 무관 |
| requirements 8개 초과 | ✅ | 7개 |
| forbid 개수 | ✅ | 5개 |
| out_of_scope / touches / rollback | ✅ | 정의됨. rollback 의 조건부 처리 서술은 정직하고 좋음 |

## 공격 결과

### A — 악의적 준수: **성공 2건 (치명적)**

1. **`filter_visible` 을 모든 태그에서 false 로 두면 계약을 100% 준수하면서 필터가 하나도 존재하지 않는 온톨로지가 완성된다.** REQ-7("`filter_visible: true` 인 태그는 [1..n] 연속 정수 `display_order`")은 **n=0 에서 자명하게 참**이다. FORBID-5는 3건 미만 태그의 `filter_visible: true` 를 *금지*할 뿐 **최소 몇 개가 true 여야 하는지 요구가 없다.** F4가 unblock 하는 W2의 존재 이유(니즈 태그 필터, H5)가 통째로 사라진다.
2. **REQ-4(D1 표본 커버리지 ≥70%)는 자기채점이다.** `d1-labeling.csv` 를 F4 저자가 만들고, `inclusion_criteria` 는 **자연어 필드**이며 기계 판정 가능성 요구가 없다. "몸이 불편한 사람"처럼 넓게 쓰면 커버리지 100%가 나온다. **D4의 `advisory` 문제와 동형** — 하류 C6가 이 기준으로 자동 부여를 구현해야 하는데 기준이 판정 불가하다.
3. **FORBID-4(성별 중립)는 구조 필드만 막는다.** `label_ko: "여성전용 필라테스"`, `"여성전용 스파"`, `"여성전용 사우나"` 처럼 태그 인스턴스를 다수 만들면 **성별이 사실상 축이 된다.** `must_not` 이 "여성전용 시설은 일반 태그 인스턴스 **1개**로만"이라 수량을 못박았지만 **detect(스키마 키 정규식)는 인스턴스 수를 세지 않는다.** 계약 문언과 탐지 수단이 어긋난다.
   → **PRD "스키마는 넓게" 요구 자체는 FORBID-4로 다루고 있으므로 성별 중립 위반은 없다.** 다만 탐지가 문언을 따라가지 못한다.

### B — 조건 회피 / 내부 모순: **성공 (치명적)**

**`gate: G1` 의 주석은 "G1에서 제외된 축의 태그를 만들지 않기 위함"이다. 그런데 REQ-2는 "3축(exercise_body, relax_recovery, medical_wellness) 각각에 대해 5개 이상 태그"를 무조건 요구한다.**
PRD G1은 `<25%` 축을 **MVP에서 제외**한다. 어떤 축이 제외되면 F4는 **게이트의 목적을 따르면 REQ-2가 실패하고, REQ-2를 만족하면 게이트의 목적을 배반한다.** 조건 회피가 아니라 **계약 정의 자체의 오류다.**

### C — 탐지 무력화: **성공 (치명적)**

1. **FORBID-1·FORBID-2의 detect 가 참조하는 파일이 존재하지 않는다.**
   - FORBID-1 detect: "모든 alias 의 evidence id 를 **D1 CSV** 와 대조" → `docs/discovery/D1-price-sample.csv` 는 D1 산출물 목록에 없다(D1은 `docs/discovery/D1/ledger.csv` 등을 만든다).
   - FORBID-2 detect: "`data/legal/medical-banned-terms.txt` 정규식 사전과 대조" → **D4는 이 파일을 만들지 않으며 `touches: docs/discovery/D4/**` 제약상 만들 수도 없다.**
   → 존재하지 않는 파일을 대조하는 검사는 에러로 죽거나(CI red 로 진행 불가) 파일 없음을 통과 처리(탐지 0)한다. **어느 쪽이든 FORBID-1·2는 집행되지 않는다.**
2. **FORBID-3 detect("이전 커밋의 `need-tags.yaml` 과 대조")는 `pr_count: 1` 인 첫 PR 에서 base 가 없어 절대 발동하지 않는다.**

### D — 지름길 유도: **성공**

㉠ `filter_visible` 전부 false ㉡ `inclusion_criteria` 를 넓게 써서 커버리지 달성 ㉢ **선행 파일이 없으면 직접 만들어 넣는다** — `out_of_scope` 는 "선행 태스크 산출물은 **읽기 전용**"이라며 *수정* 만 금지하고, **"존재하지 않는 파일을 생성하는 것"은 금지 목록에 없으며 `data/legal/**` 는 `touches` 밖이라 FORBID로도 걸리지 않는다.** 에이전트가 `data/legal/medical-banned-terms.txt` 를 스스로 만들어 채우면 **의료광고 규칙이 개발 에이전트의 추측으로 대체된다.**

### E — DAG 정합성: **결함 5건 (치명적)**

1. **선행 입력 3개 파일 전부 불일치.** 계약 상단의 "이 태스크는 아래 파일이 존재할 때만 착수한다"는 조건이 **영원히 충족되지 않는다.**
2. **D1은 F4가 필요로 하는 *내용*을 산출하지 않는다.** REQ-3은 alias(업종 용어)의 관측 근거를 D1 표본 원문에서 찾으라고 요구하는데, D1 `ledger.csv` 필수 컬럼에는 **업체 소개문·프로그램명·서비스명이 없다**(가격 증거 스니펫뿐). REQ-3·REQ-4·FORBID-1은 **경로를 고쳐도 실행 불가능하다.** D1 계약 자체가 바뀌어야 한다 → **F4 단독으로 수정 불가.**
3. **REQ-6의 인용 방식이 D4의 산출 방식과 다르다.** F4는 `guardrail_ref` 를 "D4 문서의 **섹션 앵커**"로 정의하는데 D4는 `MED-[A-Z]-\d{2}` **rule_id** 를 산출한다. 문서 앵커는 리팩터링에 취약하고 D4가 안정 식별자를 만든 이유를 무시한다.
4. **F1 의존 누락.** 워크플로가 먼저 존재해야 job 을 추가할 수 있다.
5. **`gate: G1` 인데 `parallel_with` 에 C1(gate G1·G3)이 있다.** G3 통과 여부와 무관하게 F4가 진행 가능한지 계약이 답하지 않는다. 또 **G1 판정 상태가 어디에 기록되는지 어느 계약에도 정의되어 있지 않아** `gate: G1` 을 기계적으로 확인할 수단이 없다.

### F — 존재 이유: **내용 자체는 통과, 실행 가능성 없음**

H5 검증의 전제로서 온톨로지는 필수이고 `why`("C6 자동 부여도, W2 필터도, W4 URL 축도 정의할 수 없다")는 정확하다. S2 참조도 타당. **`G3` 참조만 무관하다.** 존재 이유는 명확하나 **실행 가능성이 없다.**

## REJECT 사유

spec §5 "REJECT: 태스크 자체가 잘못 정의됨(범위 초과, **DAG 모순**, 존재 이유 없음)"에 해당한다.

1. **`gate: G1` 의 명시 목적과 REQ-2가 논리적으로 양립 불가** — 계약을 그대로 수행하면 반드시 하나를 위반한다.
2. **선행 입력 3개가 선행 태스크 산출물에 경로·내용 어느 것도 존재하지 않으며, REQ-3·REQ-4·FORBID-1이 요구하는 데이터는 D1 계약을 수정하지 않는 한 획득 불가** — F4 계약 내부 수정만으로 해결되지 않는다.

## 필수 수정 사항 (재작성 전제)

1. **선행: D1 계약에 `ledger.csv` 의 `service_menu_raw`(프로그램·서비스명 원문) 컬럼 추가 상신.** **D1 수정 없이는 F4를 재발행할 수 없다.**
2. **선행: D4의 정본 경로와 `exported_rules.json` 확정 후** 입력 경로를 실제 산출물로 정정하고 `guardrail_ref` 를 **rule_id 참조**로 전환.
3. **REQ-2를 G1 결과에 조건부로 만든다.** "G1 verdict 가 `proceed`/`editor_augment` 인 축 각각 ≥5, `axis_excluded` 축의 태그는 0개(있으면 exit 1)". 검증 스크립트가 G1 판정 파일(`docs/gates/G1.md` 신설)을 읽게 한다.
4. **`filter_visible: true` 인 태그의 최소 개수를 REQ로 추가한다** (진행 축당 ≥4, 전체 ≥10).
5. **`inclusion_criteria`/`exclusion_criteria` 에 `match_patterns`(정규식 배열)를 필수화한다** — 자연어만으로는 C6가 인용할 수 없고 D4 FORBID-2가 지적한 "통과 시늉만 하는 검사"가 C6에서 재현된다.
6. **FORBID-4의 detect 를 문언에 맞춘다** ("성별 표현(`여성전용|남성전용|women|men`)을 `label_ko`/`aliases` 에 포함하는 태그가 **2개 이상**이면 실패").
7. **`data/legal/**` 등 선행 태스크 소유 경로에 대한 *생성* 을 FORBID로 명시 차단한다.**
8. **`depends_on` 에 F1 추가**, `traces_to` 에서 `G3` 제거, FORBID-3의 첫 PR 사문 문제 처리.

---

# 체계적 결함 패턴

## P1 — "잠그기만 하고, 무엇을 잠글지는 자유" (D1·D2·D3·D4 전원)

사전등록·해시잠금·불변 골든셋이라는 사후조작 방지 장치는 잘 설계됐다. 그러나 **잠기는 내용의 하한이 어느 계약에도 없다.** D1의 "가격 확인됨" 정의, D2의 난이도 임계, D3의 `max_requests_per_min`, D4의 화이트리스트 폭 — 전부 원하는 결론이 나오게 사전 설정한 뒤 잠그면 계약 100% 준수로 게이트를 통과시킨다.
**→ "결론을 정해놓고 데이터를 맞추는 것"이 정확히 이 경로로 가능하다. 사후 완화만 막았고 사전 설정은 무방비다.**
처방: 각 Discovery 계약에 **잠금 대상의 허용 범위(enum·수치 하한)를 계약 본문에 못박고**, 사전등록 산출물을 별도 PR로 main에 먼저 머지시킨다.

## P2 — 시간순 검증이 squash merge 와 committer date 조작에 붕괴 (D1 REQ-2 · D2 FORBID-2 · D3 REQ-2)

세 계약 모두 `git log` 커밋 시각 비교로 "사전등록 → 데이터 수집" 순서를 강제한다. `GIT_COMMITTER_DATE` 로 조작 가능하고, squash 머지 시 두 파일이 같은 커밋에 들어가 검사가 소멸한다.
**→ 단일 PR 안에서 시간 순서를 증명할 수 있다는 전제가 틀렸다.**
처방: "잠금 파일이 base 브랜치에 이미 존재하고 본 PR diff에 포함되지 않을 것"으로 전환.

## P3 — 자기채점 검증기, 메타테스트 부재 (D1·D2·D3, 부분적으로 D4·F4)

Discovery 4건은 `validate_dN.py` 를 자기 PR에서 작성하고, **그 스크립트가 계약에 적힌 검사를 실제로 수행하는지 확인하는 위반 픽스처가 없다.** F1·F2·F3는 "위반 픽스처 N종이 각각 대응 검사를 실패시키는 것을 확인"을 done_when 에 넣었다 — **Foundation은 했고 Discovery는 안 했다.** 느슨한 검증기 하나로 FORBID 22개가 동시에 무력화된다.

## P4 — `on_violation: block_merge` 를 집행할 CI가 존재하지 않음 (D1·D2·D3·D4)

Discovery 4건은 `depends_on: []` 로 F1과 병렬이고, F1의 6개 job 중 `scripts/discovery/**` 를 도는 것이 없다. D1 FORBID-1은 스스로 "(F1의 CI 도입 후 승격)"이라 미래형으로 적었다.
**→ spec 원칙 3(탐지할 수 없는 금지는 금지가 아니다) 위반이 4건 일괄 발생한다.**

## P5 — `depends_on` 과 `blocks` 가 서로 다른 의미로 쓰여 양방향 정합성이 전혀 없음 (8건 전원)

`blocks` 는 "내 산출물을 인용하는 태스크"(논리), `depends_on` 은 "빌드 선후"(물리)로 쓰인다.
확인된 불일치: D1→C1·C4 / D2→W4 / D3→C1(+ID 오타 `D3-SOURCE-DILIGENCE`) / **D4→C4·C7·W3(+ blocks 에 C6·W2·W4·O2 4건 누락)** / F1→F4 / F4→F1.
**가장 위험한 귀결: W2·W3·W4는 `depends_on` 이 `[W1]` 뿐이라 D4 산출물 없이 착수 가능하고, 그들의 FORBID detect("D4 금칙어 사전으로 렌더 스캔")가 참조할 파일이 없다. 없는 파일을 스캔하는 테스트는 스텁으로 대체되고, 스텁은 항상 통과한다. Phase 3 전체가 G3/D4를 건너뛰는 경로가 열려 있다.**
처방: `blocks` 를 `depends_on` 의 역방향으로 기계 검증하는 DAG 정합성 스크립트를 F1 CI에 추가.

## P6 — 산출물 인용 규약의 부재 (D4 → 하류 8건)

D4는 `MED-[A-Z]-\d{2}` 라는 안정 식별자를 만들었으나 **정본 파일 경로·스키마·버전·소비 인터페이스를 계약으로 고정하지 않았다.** 결과적으로 하류 8개 계약이 "D4 금칙어 사전"이라는 자연어 이름으로만 인용하고, F4는 존재하지 않는 파일명 두 개를 지어냈다.
**→ "모호하면 하류 FORBID 전체가 무력해진다"는 우려가 이미 현실화되어 있다.**

## P7 — 계약이 자기 PR을 차단하는 자기모순 (F1 FORBID-5 · F2 FORBID-1 · F3 FORBID-2)

F1은 lockfile·README 누락으로, F2는 down 마이그레이션의 DROP 으로, F3는 `thresholds.json` 신규 생성으로 각각 자기 FORBID에 걸린다.
**→ 개발 에이전트는 이 모순 앞에서 반드시 규칙을 우회하며, F1 FORBID-2가 경고한 "우회 관용구 학습"이 계약 체계의 첫 3개 태스크에서 시작된다.**
처방: 세 FORBID 모두 "최초 도입 / down 스크립트 / 필수 생성 파일" 예외를 **규칙 안으로** 명시.

## P8 — 금지만 있고 정상 동작 요구가 없음 (F3 결정적, D4·F4 동형)

F3의 `PriceDisplay` 는 항상 "미공개"를 렌더하면 계약을 완전히 준수한다. D4는 medical 가격을 전부 hide 하면 계약을 완전히 준수한다. F4는 필터 태그를 하나도 노출하지 않으면 계약을 완전히 준수한다.
**→ 세 계약 모두 "잘못 노출하지 않을 것"만 요구하고 "노출해야 할 것을 노출할 것"을 요구하지 않는다. 규제·신뢰 리스크에 대한 방어가 제품 기능을 조용히 0으로 만드는 방향으로 전부 열려 있다.**
처방: 각 계약에 **최소 정상 동작 커버리지 REQ** 추가 (F3: 고신뢰 입력 숫자 렌더 / D4: medical 표기 show 비율 하한 / F4: `filter_visible` 최소 개수).

---

# 전 태스크 공통 조치

1. **`blocks` ↔ `depends_on` 양방향 정합성을 기계 검증하는 DAG 스크립트를 F1 CI에 추가**하고, 순환·누락·미존재 ID(`D3-SOURCE-DILIGENCE` 등)를 CI에서 잡는다.
2. **게이트 상태(G1~G4)를 저장할 단일 정본 파일(`docs/gates/*.md`)을 신설한다** — 현재 D1 rollback 과 F4 `gate` 가 존재하지 않는 대상을 참조한다.
3. **`traces_to` 에 사용 가능한 ID 레지스트리(H1~H7 / S1~S5 / G1~G4 / KM-*)를 문서로 고정**하고 CI에서 대조한다.
4. **Discovery 4건에 대해 `scripts/discovery/**` 를 실행하는 `discovery` CI job 을 F1이 제공**하고, 각 태스크는 위반 픽스처 메타테스트를 done_when 에 포함한다.

---

# 최종 판단

**계약 수정만으로 막히는 것은 8건 중 5건이다.** D2·D3·D4·F1·F3 는 REQ/FORBID 문언 보강(임계 하한 명시, 적용 범위 확대, positive REQ 추가, 예외 경로 내재화, detect 승격)으로 결함이 봉쇄된다.
**나머지 3건은 태스크 분할 또는 재설계가 필요하다.** ① **D1** — 사전등록과 현장조사를 한 PR에 담은 구조 자체가 핵심 통제를 원리적으로 무력화하므로 **PR 분할(D1a-PROTOCOL / D1b-FIELDWORK)이 필수**다. ② **F2** — 누락된 컬럼·테이블을 채우면 requirements 가 8개를 넘고 코어 스키마와 품질·공개판정 스키마가 서로 다른 리뷰 전문성을 요구하므로 **F2a/F2b 분할 검토가 필요**하다(중간 상태가 동작하는지가 판단 기준). ③ **F4** — 선행 태스크(D1)의 산출물 정의 자체를 바꿔야 실행 가능하므로 **D1 재발행 후 F4 재설계** 없이는 착수 불가다.

