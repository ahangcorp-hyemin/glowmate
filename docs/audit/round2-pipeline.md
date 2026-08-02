# 2차 감사 — C1~C7 (Phase 2 파이프라인)

> 감사자: task-auditor · 일자: 2026-08-03
> 대상: `docs/tasks/C1.md` ~ `C7.md` (7건, 개정 2 / v2)
> 1차: `docs/audit/C1-C7-audit-full.md` (C3·C7 REJECT, 나머지 REVISE)
> 기준: `02-task-contract-spec.md` §5 체크리스트 + 원칙 2.5 · R-6 · R-7 · detect 대상 실재
> 교차 대조: `F2a` · `F2b` · `O2` · `W1` · `W2` · `W3` · `W4` · `W6` · `F5` · `F1` · `D1b` · `D3` · `D4`
> ID·DAG 기계 검증(`scripts/tasks_manifest.py`)은 통과 전제로 두고 **재검하지 않았다.**
> **계약 파일은 수정하지 않았다.**

---

## 0. 판정 요약

| 태스크 | 1차 | 2차 | 한 줄 사유 |
|---|---|---|---|
| **C1** | REVISE | **REVISE** | 파기 예외·실수집 하한은 닫혔다. 새 구멍 3개 — 더미 어댑터가 자기 `touches` 밖 · 자기 PR 경로 가드 부재 · `min_body_bytes` 사전 설정 무방비 |
| **C2** | REVISE | **REVISE** | 가격 재현율·홀드아웃은 실효적. 단 축 주입 원천 `docs/discovery/D1/report.md` 가 **실재하지 않고**(정본은 `docs/gates/G1.md`), D1b 의존선 없음 |
| **C3** | REJECT | **REVISE** | 소스 1개=태스크 1개로 REJECT 사유 해소. 단 파생 규칙의 유일한 집행 수단 `adapter-task-coverage` 가 **소유자 미지정 = 탐지 부재** |
| **C4** | REVISE | **REVISE** | 악의적 준수 구멍(single_session 도피)은 REQ-2로 닫힘. 그러나 **I2·I3가 F2a CHECK 2종과 정면 충돌해 저장 자체가 불가** · 분모 최소 건수 부재 |
| **C5** | REVISE | **REVISE** | 클러스터 불변식(REQ-3)은 전이 병합을 실제로 막는다. 단 **REQ-4 블로킹 재현율이 자기 출력에서 표집돼 구조적으로 실패 불가** |
| **C6** | REVISE | **REVISE** | '치료' 충돌은 해소. 의미 반전은 **부분 봉쇄** — 부정 문장 전체를 인용하면 I3·I4·I5를 전부 통과하고, 유일한 방어인 부정 픽스처 20건은 표집 절차·홀드아웃이 없다 |
| **C7** | REJECT | **REVISE** | 뷰 필터·임계는 계약에 들어왔다. 그러나 **원칙 2.5 짝 REQ 부재 · R-7 부재 · R-6 부재 3중 규격 위반**, 그리고 `public_venue` 뷰를 F2b와 **이중 소유**하며 테이블·컬럼·enum 명칭이 F2 정본과 전부 불일치 |

**PASS 0건.** 다만 결함의 성격이 1차와 다르다 — 1차는 "계약이 제품을 지키지 못한다"였고, 2차는 대부분 **"계약이 참조하는 대상이 정본과 어긋난다"**(detect 대상 실재)와 **"고치는 과정에서 새로 생긴 경계 충돌"**이다.

---

## 1. C1-CRAWLER-CORE — REVISE

### 규격 위반

| 체크리스트 항목 | 판정 | 위치·내용 |
|---|---|---|
| traces_to 유령 ID | ✅ 통과 | `[H1, G3]` — `KM-price-coverage` 제거 확인 |
| gate 표기 | ✅ 통과 | `[G1, G3]` 리스트로 정정됨 |
| REQ ≤ 8 / forbid ≤ 6 | ✅ 통과 | REQ 8 · FORBID 6 |
| forbid 5요소 | ✅ 통과 | 6건 전부 when/must_not/because/detect/on_violation |
| R-7 실환경 하한 | ✅ 통과 | REQ-8 실수집 스모크(records ≥ 10, `generated_at` 7일 이내) |
| 원칙 2.5 짝 | ✅ 통과 | FORBID-2·4(fail-closed) ↔ REQ-8(실제로 10건 이상 수집) |
| **touches 미정의/모순** | ❌ **위반** | REQ-6 acceptance 와 done_when 이 `services/crawler/adapters/<source_id>/adapter.py` **더미 어댑터 생성**을 요구하는데 `touches` 에 `adapters/**` 가 없다 |
| **detect 대상 실재** | ⚠️ 부분 | FORBID-6 detect·rollback 이 "F2 REQ-6 의 DB 트리거"를 인용 — F2a 정본에서 append-only 는 **REQ-5**다(REQ-6은 컬럼 화이트리스트) |

### 공격 결과

- **A 악의적 준수** — "스케줄러·큐·리미터는 완벽하나 아무것도 수집하지 않는 크롤러"를 다시 시도했다. robots 평가기를 항상 Disallow로 구현하면 REQ-5(요청 0건)는 만점이지만 **REQ-8이 records ≥ 10 을 요구해 exit 1** 이 난다. 1차의 핵심 구멍은 닫혔다. → **방어됨.** 잔여: REQ-8은 "소스 1개, 10건"이라 한 개 시드 URL만 동작하는 크롤러가 통과한다(C2·C3가 소스별 하한을 추가로 두므로 수용 가능).
- **B 조건 회피** — FORBID-4의 `when` (c) "http 200 이면서 body 길이가 해당 소스 **`min_body_bytes` 미만**". `min_body_bytes` 의 **허용 범위가 계약에 없다.** 값을 1로 두면 50바이트짜리 차단 페이지가 정상 응답으로 집계되고 FORBID-4는 100% 준수된다. 규격 §3.4의 "사후 완화만 막고 **사전 설정은 무방비**" 안티패턴이다. 같은 위험을 C3 FORBID-1(c)은 **"직전 성공 응답 중앙값의 30% 미만"** 이라는 자기참조 상대 기준으로 막았다 — **같은 배치 안에서 방어 강도가 갈린다.** → **결함.**
- **C 탐지 무력화** — FORBID-1(b) `allowlist-guard` 는 allowlist 값을 D3 `crawl_policy.yaml`(max_requests_per_min ≥ 6 하한을 D3 계약이 고정)과 대조하므로 실효적이다. 그러나 **C1 자신의 PR diff를 `touches` 로 제한하는 검사가 없다.** C2·C3는 FORBID-6 `path-guard` 가 있고 C4~C7은 done_when 에 "touches 경로 밖 변경 0" 이 있는데 **C1만 둘 다 없다.** C1 PR 이 `docs/discovery/D3/crawl_policy.yaml` 을 함께 고치면 allowlist-guard 의 비교 기준 자체가 이동한다(라벨 게이트는 allowlist diff 에만 걸린다). → **결함.**
- **D 지름길 유도** — ① max_rps 상향: FORBID-1(b) + 설정 로더 ValueError로 이중 차단 ✅ ② 스모크 리포트 위조: `generated_at` 7일 창 + sha256_mismatch/429 검사로 부분 방어(리포트 JSON 자체를 손으로 쓰는 경로는 남는다 — 스모크 러너가 서명하지 않는다) ③ **더미 어댑터 요구를 근거로 실제 어댑터를 C1 PR에 끼워 넣기**: REQ-6이 `adapters/` 파일 생성을 명령하는데 경로 가드가 없으므로 가능. C3 §A가 세운 "소스 1개=태스크 1개"가 C1에서 우회된다. → **결함.**
- **E DAG 정합성** — `depends_on: [F2a, D3]` / `blocks: [C2, C3, C4, C5]` 는 하류 4건의 `depends_on` 과 양방향 일치. 순환 없음. 게이트 `[G1,G3]` 은 Phase 2 규칙과 일치. 다만 **F2a와 파기 경로가 이원화**돼 있다 — F2a REQ-5는 `tombstone_source_record(id, reason)` 로 `raw_payload` 를 NULL 로 만들고, C1 FORBID-6은 "blob 객체만 삭제, DB 행·감사 로그 유지"다. C1 설계상 PII 원문은 blob 에 있고 `raw_payload` 는 봉투 메타뿐이므로 **F2a의 tombstone 을 실행해도 개인정보는 남는다.** 두 계약 중 어느 쪽도 상대를 인용하지 않는다.
- **F 존재 이유** — `traces_to: [H1, G3]`. 1차에서 지적한 장식 참조 H2는 제거됐다. `why`(원문 보존 없으면 재파싱마다 재크롤) ↔ FORBID-5·6 이 정확히 대응. **통과.**

### 필수 수정 사항
1. `touches` 에 `services/crawler/adapters/_reference_dummy/**` 를 **명시 추가**하고 REQ-6의 더미 어댑터 경로를 그 하나로 고정 — 지금은 "만들라"와 "만지지 마라"가 한 계약 안에 공존한다(규격 §3.4 "계약이 자기 PR을 차단").
2. FORBID 추가 또는 done_when 강제: **C1 PR diff ⊂ touches** 를 `path-guard` 로 자기 자신에게도 적용. 특히 `docs/discovery/D3/**` 를 C1 PR에서 수정 금지로 명시.
3. `min_body_bytes` 의 **허용 범위를 계약 본문에 못박을 것** — C3 FORBID-1(c) 과 동일하게 "직전 성공 응답 중앙값 대비 비율" 로 통일하거나 절대 하한(예: ≥ 512)을 수치로 기재.
4. FORBID-6 detect·rollback 의 "F2 REQ-6" → **F2a REQ-5** 로 정정(append-only 트리거).
5. FORBID-6과 F2a REQ-5의 관계를 계약에 명시: `crawler.purge`(blob 삭제)와 `tombstone_source_record`(raw_payload NULL)가 **파기 1건에 대해 둘 다 실행되어야 완결**임을 절차로 기술. 어느 한쪽만 돌면 개인정보 파기 요구에 응답한 것이 아니다.

---

## 2. C2-ADAPTER-NAVER — REVISE

### 규격 위반

| 항목 | 판정 | 내용 |
|---|---|---|
| R-6 표집·홀드아웃 | ✅ 통과 | REQ-1 (모집단=실 crawl_run 전수, 시드·층화·manifest.lock 선행 커밋) + `dataset-order` CI |
| R-7 실환경 하한 | ✅ 통과 | REQ-8 (실수집 15건, `venues_with_price_raw ≥ 5`) |
| 원칙 2.5 짝 | ✅ 통과 | FORBID-2(실패를 success로 삼키지 마라) ↔ REQ-4 재현율 0.85 · REQ-8 |
| forbid 5요소 · 개수 | ✅ 통과 | 6건 |
| **detect/acceptance 대상 실재** | ❌ **위반** | REQ-1 acceptance 의 `docs/discovery/D1/report.md` — **정본은 `docs/gates/G1.md`**(D1b artifacts). `docs/discovery/D1/` 은 폐기된 D1 의 경로이고 D1b는 `docs/discovery/D1b/report.md` 를 쓴다 |
| depends_on 누락 | ❌ **위반** | REQ-1·REQ-2가 G1 verdict 산출물을 소비하는데 `depends_on` 에 D1b 없음 |
| **DAG 자기모순** | ❌ **위반** | `blocks: [C5-ENTITY-RESOLUTION]` 인데 `parallel_with` 에도 `C5-ENTITY-RESOLUTION` — 선행이면서 동시 실행 불가. (기계 검증은 blocks↔depends_on 양방향만 보므로 이 모순을 잡지 못한다) |

### 공격 결과

- **A 악의적 준수** — 1차의 치명 구멍("가격 0건 수집 어댑터가 100% 준수")을 재시도했다. REQ-4가 **라벨 케이스 대비 재현율 ≥ 0.85 + 라벨 케이스 수 ≥ 8 미만이면 exit 1**, REQ-8이 실수집 15건 중 `venues_with_price_raw ≥ 5` 를 요구한다. 가격 0건 어댑터는 두 곳에서 exit 1. → **방어됨.** 분모 축소 회피(가격이 있는 페이지를 `price_text_present=false` 로 라벨)도 **최소 라벨 케이스 수 8** 이 막는다. C4보다 강하다.
- **B 조건 회피** — FORBID-1의 `when`(최종 URL·body 마커 + 401/403/429)은 판정 가능. FORBID-2의 `when` 은 "라벨상 price_text_present=true 인 페이지에서 price_raw 0건"으로 확장돼 **1차에서 지적한 '가격만 조용히 놓치는 성공'** 을 닫았다. 잔여: 카카오(C3 FORBID-1)가 잡는 **5xx 3연속·본문 급감** 위장 차단이 네이버 FORBID-1의 `when` 에는 없다. 네이버가 차단을 5xx로 반환하는 형태를 D3 실사표에서 확인했다는 근거도 계약에 없다. → **부분 결함.**
- **C 탐지 무력화** — **가장 중요한 잔여 결함.** REQ-2의 "홀드아웃 20건 재발견 recall ≥ 0.95" 는 **모집단이 `discover()` 자신의 출력(REQ-1: 실제 crawl_run 결과 전수)** 이다. 즉 discover 가 애초에 못 찾은 업체는 홀드아웃에 들어갈 수 없고, **재현율은 구조적으로 1.0 에 수렴한다.** 이 지표는 "발견 커버리지"를 전혀 측정하지 못한다. 외부 정답 원장이 이미 존재한다 — **D1b `ledger.csv` 100건**(강남3구 실사 표본). 이것과 대조하지 않으면 recall REQ는 자기 출력에 대한 자기 검증이다. → **결함.**
  또한 `price_text_present` 라벨의 **작성자가 구현자와 동일인인지에 대한 규정이 없다**(R-6은 "구현자가 만든 경우 그 사실과 검증 방법 명시"를 요구한다). 홀드아웃 20건을 라벨링하려면 반드시 열람해야 하는데, done_when 은 "홀드아웃은 개발용 잡에서 읽기 불가(권한 제거)"만 요구한다 — **라벨러 = 구현자면 홀드아웃은 이미 열람된 상태다.**
- **D 지름길 유도** — 픽스처 교체·임계 하향은 FORBID-5(`dataset-lock` + manifest.lock 재계산)로 차단 ✅. 경로 이탈은 FORBID-6 `path-guard` ✅. **남은 경로: 축 주입 원천 파일이 실재하지 않으므로**(위 규격 위반) 구현자가 `docs/discovery/D1/report.md` 를 **스스로 만들어 넣는다.** 그 파일에 활성 축을 적으면 REQ-1의 "매니페스트 축 집합 == D1 report 파싱 결과" 는 자동으로 참이 된다. 게이트 결과를 피검자가 쓰는 상태. → **결함.**
- **E DAG 정합성** — 위 자기모순(blocks ∩ parallel_with) + D1b 의존 누락. C1과의 경계는 깨끗하다(등록은 규약 기반 자동 발견, CI 잡은 C1이 글롭으로 제공, out_of_scope 에 "워크플로를 고치지 말고 블로커 보고" 명시) — 1차의 "레지스트리 소유자 공백"은 해소됐다.
- **F 존재 이유** — `traces_to: [H1, H2]`. 1차에서 "H2는 장식"이라 지적했고, REQ-4(가격 원문 재현율)·REQ-8(price_raw 보유 업체 수) 신설로 **H2가 실제로 이 계약에서 측정된다.** **통과.**

### 필수 수정 사항
1. REQ-1·REQ-2의 축 원천을 **`docs/gates/G1.md`**(D1b 산출물, 게이트 상태 정본)로 정정하고 `depends_on` 에 **D1b-FIELDWORK** 추가.
2. REQ-2의 재현율 모집단을 **자기 출력이 아닌 외부 원장**으로 교체 — D1b `ledger.csv` 의 네이버 대상 업체 집합에 대한 발견율 하한을 별도 REQ로 둘 것. 현행 "재발견 recall"은 유지해도 무방하나 그것만으로는 커버리지 지표가 아니다.
3. `parallel_with` 에서 `C5-ENTITY-RESOLUTION` 제거(blocks와 모순).
4. FORBID-1의 `when` 에 **위장 차단 신호**(5xx 연속·본문 급감) 추가 또는 "네이버는 해당 형태로 차단하지 않음"의 D3 실사표 근거를 계약에 인용.
5. REQ-1에 **라벨 작성자 ≠ 어댑터 구현자** 또는 이중 라벨링·불일치 조정 절차를 명시(R-6 3항).

---

## 3. C3-ADAPTER-KAKAO — REVISE (REJECT 해소)

### REJECT 사유 해소 여부 — 해소됨

1차 반려 사유는 "산출물 개수가 D3 판정 결과에 좌우돼 PR 1개 원칙을 계약 시점에 보장 불가"였다. v2는 §B를 **카카오맵 단일 소스 계약**으로 확정하고(`touches` = `adapters/kakao_map/**` 3경로, FORBID-6이 타 소스 디렉토리 추가를 명시적으로 금지), 나머지를 §C 템플릿의 파생 태스크로 뺐다. **PR 1개는 §B 안에서 보장된다.** REJECT 조건(범위 초과)은 사라졌다.

### 파생 규칙이 실제로 PR 1개를 보장하는가 — 규칙은 맞고, 집행이 없다

| 파생 규칙 (A-2/A-3) | 집행 수단 | 판정 |
|---|---|---|
| 소스 1개 = 태스크 1개 | §C 템플릿 + FORBID-6(타 소스 디렉토리 금지) | ✅ 계약 내 집행 |
| touches 를 소스 디렉토리로 한정 | `path-guard`(C1 제공, 글롭 기반) | ✅ |
| REQ 8 · FORBID 6 상속 | 감사 시점의 사람 검토 | ⚠️ 절차 |
| 스텁 어댑터 금지 | 템플릿 REQ-2·4·8 상속 | ✅ (템플릿에 하한이 실재) |
| **D3 확정 목록 ↔ 계약 파일 1:1** | `adapter-task-coverage` | ❌ **소유 태스크 없음 — 계약이 스스로 "리드가 수동 대조"라고 적었다** |

즉 **"계약 없이 착수될 경로"는 정확히 한 군데 남아 있다** — 파생 대상 소스에 대해 계약 파일을 만들지 않고 넘어가는 것(누락). 이건 코드가 아니라 문서 커버리지 문제라 CI 소유자가 없으면 아무도 알아채지 못한다. 규격 §3.4 "`block_merge` 인데 집행할 CI job 이 없음" 과 동형이다.
추가로 **C1 REQ-6이 `adapters/` 아래 더미 어댑터 파일 생성을 요구하면서 경로 가드가 없다**(§1 D 참조) — 파생 규칙을 우회해 어댑터가 C1 PR로 들어오는 경로가 열려 있다.

### 규격 위반

| 항목 | 판정 | 내용 |
|---|---|---|
| R-6 / R-7 / 원칙 2.5 | ✅ 통과 | C2와 동형(REQ-1 표집·lock, REQ-8 실수집, FORBID↔REQ-4 짝) |
| **acceptance 대상 실재** | ❌ **위반** | REQ-1 `docs/discovery/D1/report.md` — C2와 동일. 정본은 `docs/gates/G1.md` |
| depends_on 누락 | ❌ **위반** | D1b 없음 |
| **DAG 자기모순** | ❌ **위반** | `blocks: [C5]` ∩ `parallel_with: [..., C5]` |
| detect 소유자 부재 | ❌ **위반** | §A-2 `adapter-task-coverage` — 계약이 소유자 미지정을 자인 |

### 공격 결과

- **A 악의적 준수** — "등록만 되고 아무것도 못 모으는 스텁"을 재시도. REQ-2(홀드아웃 recall 0.95)·REQ-4(가격 재현율 0.85, 라벨 케이스 ≥ 6)·REQ-8(실수집 15건, price_raw ≥ 4) 3중으로 차단된다. 1차 구멍 **닫힘.** §C 템플릿도 A-3(4)에서 "스텁 어댑터 금지"를 불변 조건으로 명시 ✅.
- **B 조건 회피** — FORBID-1의 `when` 이 (a) 명시적 차단 (b) 5xx 3연속 (c) **본문 길이가 직전 성공 응답 중앙값의 30% 미만** 3형태를 덮는다. 상대 기준이라 사전 설정으로 무력화할 수 없다 — **이 배치에서 가장 잘 쓰인 `when`.** (C1 FORBID-4가 이 방식을 따라야 한다.)
- **C 탐지 무력화** — C2와 동일한 **재발견 recall 순환**(모집단 = discover 자기 출력). `kakao_price_verbatim` 의 빈 배열 공허 통과는 계약이 스스로 "REQ-4 재현율 하한이 차단한다"고 적어 연결을 명시했다 ✅.
- **D 지름길 유도** — `dataset-lock`·`path-guard` 로 픽스처·경로 차단 ✅. **남은 경로: C2와 동일하게 존재하지 않는 D1 report 를 자작하는 것**, 그리고 파생 태스크를 만들지 않고 D3 목록을 조용히 줄이는 것(집행 CI 부재).
- **E DAG 정합성** — §B `depends_on: [C1, D3]`, `blocks: [C5]` 는 C5 `depends_on` 과 양방향 일치 ✅. §C 템플릿의 `dag_id: C3x` 는 정본 레지스트리 미등재이고 계약이 이를 자인하며 착수 금지를 명시 ✅(기계 검증은 첫 yaml 블록만 읽으므로 오염 없음). **잔여 위험:** 파생 어댑터가 C5 머지 이후에 들어오면 C5의 평가셋·클러스터 판정은 그 소스를 포함하지 않은 상태로 확정돼 있다 — **신규 소스 유입 시 C5 재평가를 요구하는 조항이 어느 계약에도 없다.**
- **F 존재 이유** — `why`("단일 소스 차단 = 커버리지 0, C5가 교차 검증할 두 번째 관측치")가 REQ-8(실수집)과 C5 REQ-8(2개 소스 연결 venue ≥ 40)로 실제 측정된다. **통과.**

### 필수 수정 사항
1. §A-2의 `adapter-task-coverage` **소유 태스크를 지정**(O3 또는 F1 CI). 소유자 없이 남기면 "파생 규칙"은 규칙이 아니라 메모다. 지정 전까지 §C 인스턴스화를 금지한다는 조건을 done_when 급으로 승격.
2. REQ-1 축 원천 → `docs/gates/G1.md`, `depends_on` 에 D1b 추가.
3. `parallel_with` 에서 C5 제거.
4. REQ-2 재현율의 외부 원장 대조(D1b ledger) 추가 — C2와 동일.
5. §C 템플릿 C-1 표에 **"파생 태스크 계약이 `03-task-dag.md` 정본 레지스트리에 등재되기 전 착수 시 감사 자동 반려"** 를 명시(현재는 문서 서두 주석에만 있다).

---

## 4. C4-PRICE-NORMALIZER — REVISE

### 악의적 준수 구멍 재공격 — 주 경로는 닫혔고, 분모에 새 경로가 남았다

**v1 구멍(애매한 입력을 전부 `single_session`·`period_pass` 로 밀어 넣기) 재시도:**

| 도피 시도 | 차단 장치 | 결과 |
|---|---|---|
| 라벨 per_session 케이스를 `single_session` 으로 출력 | REQ-2 (6개 필드 전수 대조, mismatch 0) — `price_unit_type` 불일치 | 차단 ✅ |
| `period_pass` 로 출력 | REQ-2 + I3(`period_days` NOT NULL, `price_per_month` 산식) — `period_days` 를 날조하면 라벨 불일치 | 차단 ✅ |
| `unparseable` 로 출력 | REQ-1 축별 산출률 하한(0.85/0.75/0.60) | **부분 차단** — 허용 오차 안(운동 15%·이완 25%·메디컬 40%)에서는 합법적 포기 |
| **분모 축소** | ❌ **없음** | **결함** |

**남은 경로 — 분모 정의가 라벨에 있고, 라벨은 구현자가 만든다.** REQ-1의 분모는 "정답 라벨의 unit_type 이 per_session 인 케이스(= 원문에 총액과 횟수가 모두 존재)"다. 라벨링 시점에 애매한 원문("10회권 65만 상당", "1회 6.5만/10회 등록시")을 `period_pass`·`single_session`·`unparseable` 로 라벨하면 **분모가 쉬운 케이스만 남는다.** 계약에는:
- 홀드아웃 60건 중 **per_session 라벨 최소 건수 하한이 없다** (C2 REQ-4는 "라벨 케이스 수 ≥ 8 미만이면 exit 1" 을 두었다 — 같은 배치 안에서 방어가 갈린다),
- 층화 기준이 "축별"뿐이라 **unit_type 별 구성비를 보존하라는 요구가 없고**,
- FORBID-6은 **사후 라벨 수정**만 막는다. 초기 라벨링은 무방비다(규격 §3.4 "사전 설정은 무방비").

→ **v1의 도피처는 닫혔으나, 한 칸 위(분모)로 이동했다.**

**4개 `price_unit_type` 판정 기준(I1~I4)이 도피처를 막는가:** I1·I2는 `⇔`(필요충분)이라 분류를 값으로 강제하고, I4는 unparseable 시 금액 4종 전부 NULL을 요구해 "unparseable 로 분류하고 값은 채워두기"를 막는다. **불변식 자체는 잘 설계됐다.** 문제는 불변식이 F2a와 충돌한다는 것이다(아래).

### 규격 위반 — F2 정합화가 미완이다 (착수 즉시 블로커 2건)

| # | C4 | F2a 정본 | 결과 |
|---|---|---|---|
| 1 | REQ-5 **I2**: `single_session ⇔ price_per_session = total_amount_krw` (NOT NULL) | REQ-3 CHECK (b): `price_unit_type <> 'per_session' → price_per_session IS NULL` | **INSERT 가 SQLSTATE 23514 로 거부된다.** single_session 레코드를 저장할 수 없다 |
| 2 | REQ-5 **I3**: `period_pass ⇒ price_per_session IS NULL` (failure_reason 은 I4의 unparseable 전용) | REQ-3 CHECK (a): `price_per_session IS NULL → failure_reason NOT NULL` | **모든 period_pass·single_session 행이 failure_reason 을 요구받는다** — I4의 "failure_reason 은 8종 폐쇄 enum"과 충돌 |
| 3 | I5 `evidence_snippet` | REQ-4: `source_snippet text NOT NULL` | 컬럼명 불일치 — 선행 조건 표는 `evidence_snippet` 을 **신설 요청**하면서 기존 `source_snippet` 을 언급하지 않는다(중복 컬럼 발생) |
| 4 | "수집 시각은 `source_record.fetched_at` 조인, **price_plan 에 복제하지 않는다**" | REQ-4: `captured_at timestamptz NOT NULL` | **NOT NULL 컬럼을 채우지 않겠다고 선언** — INSERT 불가 |

C4의 "선행 조건" 표는 **신설 컬럼만 나열하고 F2a의 기존 CHECK 제약 2종을 개정 대상에 넣지 않았다.** 계약 서두가 "부족이 발견되면 코드를 쓰지 않고 F2 변경을 요청한 뒤 대기한다"고 했으므로, 현행대로 전달하면 **C4는 착수 즉시 대기 상태로 들어간다.**

| 그 밖의 체크리스트 | 판정 |
|---|---|
| R-6 표집·홀드아웃 | ✅ REQ-3(표집 스크립트 재현·홀드아웃 소스 참조 0건·라벨 3필드) — 단 **라벨러 독립성 규정 없음**, **홀드아웃 내 per_session 최소 건수 없음** |
| R-7 실환경 하한 | ✅ REQ-4 (실 source_record 200건 → per_session ≥ 25, "픽스처로는 만족 불가") |
| 원칙 2.5 짝 | ✅ FORBID-1·4(기록하지 마라) ↔ REQ-1·REQ-4 |
| detect 대상 실재 | ⚠️ FORBID-3이 D4를 **`forbidden_lexicon.yaml` 파일명 + `MED-L-*`** 으로 인용 — D4 K-1은 **"`exported_rules.json` 의 `rule_id` 문자열만 인용, 파일명·자연어 인용 금지"** 이고 실제 파일명은 `rules/lexicon.yaml` 이다. `MED-L-` 의 `L` 이 lexicon 을 뜻한다는 규정도 D4에 없다(K-2는 `MED-[A-Z]-\d{2}` 만 정의) |
| touches 밖 산출물 | ❌ REQ-1 acceptance 의 `config/g1-axes.json` — **어느 계약도 이 파일을 생산하지 않고**(전 저장소 grep: C4·C5·C6의 인용 4건뿐), C4 `touches`(`packages/pipeline/**`) 밖이다. C4가 만들면 path guard 위반, 안 만들면 테스트가 대상 부재 |
| REQ 표현 모호 | ⚠️ REQ-2 "파싱 포기는 허용, 틀린 값은 불허" — **`unparseable` 출력이 `price_unit_type` mismatch 로 계상되는지 아닌지가 미정의.** 구현자가 넓게 해석하면 mismatch 산정에서 제외되는 범위가 늘어난다 |

### 공격 결과 (B~F)

- **B 조건 회피** — FORBID-4의 `when` 에 "session_count > 1인데 price_per_session == total_amount_krw(나눗셈 미적용)"가 명시로 들어와 1차의 "sanity 범위는 자릿수만 잡는다"가 보완됐다 ✅. FORBID-3의 `when` 은 열거 토큰 6개에서 **D4 lexicon(정규식 20개 이상) + 커밋 사전 + 종료일 명시**로 확장 ✅. 잔여: 프로모션 토큰 사전의 **초기 내용**에 하한이 없다(확장만 라벨 게이트).
- **C 탐지 무력화** — FORBID-1·2의 detect 가 1차 지적대로 **출력 레코드 불변식(I1·I2·I4 / I3)** 으로 재작성돼, C7 소유 함수에 의존하던 공허한 detect 가 사라졌다 ✅. CI grep(`DEFAULT_SESSION_COUNT`·`weeklyVisits` 류 식별자)은 식별자명 변경으로 우회 가능하나 **불변식이 주 방어이고 grep은 보조**라는 구성이 올바르다. FORBID-5 detect("visibility 가 전부 F2 DEFAULT `hidden_quality`")는 F2b REQ-1과 정확히 일치 ✅.
- **D 지름길 유도** — 임계 하향·라벨 수정·홀드아웃 이동은 FORBID-6이 전부 잠금 ✅. **남은 경로:** ① 위 분모 축소(초기 라벨링), ② `config/g1-axes.json` 을 스스로 작성해 **탈락 축을 임의로 제외**(REQ-1은 "통과 축만 판정"하므로 medical_wellness 를 제외 축으로 적으면 0.60 임계가 사라진다). ②는 게이트 결과를 피검자가 정의하는 경로다. **결함.**
- **E DAG 정합성** — `depends_on` 에 **D4 추가됨** ✅(1차 필수 수정 6). F2a·F2b 분리 반영 ✅. `blocks` 가 `W4-COMBO-LANDING` 으로 정정 ✅. 순환 없음. **잔여: `config/g1-axes.json` 이 G1 산출물의 파생인데 D1b 의존선이 없다.** 또 C2·C3(가격 원문 공급자)에 의존선이 없는 것은 1차와 동일하나, `extracted` 공통 스키마 소유가 C1로 확정됐고 C4가 C1을 의존하므로 **입력 필드 계약의 공백은 해소**됐다.
- **F 존재 이유** — `traces_to: [H2, G4]`. H2("노출 가격의 80% 이상이 회당 단가로 환산 가능")가 **REQ-1의 per_session 산출률로 직접 측정된다.** 1차의 "존재 이유와 검증 수단의 어긋남"은 해소. **통과.**

### 필수 수정 사항
1. **선행 조건 표에 F2a REQ-3 CHECK 2종의 개정을 추가**: (a) `price_per_session IS NULL → failure_reason NOT NULL` 을 `price_unit_type='unparseable'` 조건으로 축소, (b) `price_unit_type <> 'per_session' → price_per_session IS NULL` 을 `NOT IN ('per_session','single_session')` 으로 수정. 지금 상태로는 I2·I3 레코드가 DB에 들어가지 못한다.
2. `evidence_snippet` → **F2a 정본의 `source_snippet` 으로 통일**, `captured_at`(F2a NOT NULL)의 채움 주체를 명시. "복제하지 않는다"를 유지하려면 F2a에서 그 컬럼 제거를 요청할 것.
3. REQ-1에 **홀드아웃 내 per_session 라벨 최소 건수 하한**(예: 축별 ≥ 10, 총 ≥ 25)과 **unit_type 구성비 층화**를 추가 — 분모를 좁혀 빠져나가는 경로를 닫는다.
4. REQ-2의 "파싱 포기"를 **`price_unit_type='unparseable'` 출력에 한한다**고 못박고, 그 경우에도 라벨이 unparseable 이 아니면 REQ-1 분자에서 제외됨을 명시.
5. `config/g1-axes.json` 의 **생산 태스크를 지정**(D1b 또는 F1)하고 C4 `depends_on` 에 반영. 지정 전까지 REQ-1 acceptance 는 대상 부재로 공허하다.
6. FORBID-3의 D4 인용을 **rule_id 문자열 집합**으로 교체(D4 K-1 규약). 파일명 인용은 D4 계약이 금지한다.
7. REQ-3에 **라벨 작성자 ≠ 파서 구현자** 또는 이중 라벨링·조정 절차 명시(R-6 3항).

---

## 5. C5-ENTITY-RESOLUTION — REVISE

### 전이 병합 봉쇄 검증 — 실효적으로 닫혔다

REQ-3이 (a) 클러스터 내 **모든 쌍** match_score ≥ 0.92 (완전 연결), (b) 크기 ≤ 6 을 요구하고, acceptance 가 **전이 픽스처(A~B 0.93, B~C 0.93, A~C 0.40)를 명시적으로 지목**해 "3개 소스가 서로 다른 venue 로 남고 큐 적재 3쌍" 을 검증한다. FORBID-1의 `when` 에도 클러스터 위배가 편입됐다. 1차 지적(쌍 단위 지표만으로 3사 병합)은 **닫혔다.**

**남은 클러스터 경로를 재공격했다:**
- 같은 건물 다층 업체 → 각 쌍이 FORBID-4(≤30m & 상호명 유사도 <0.6)에 걸려 0.92 미만 → 완전 연결 실패 ✅
- 프랜차이즈 대표번호 → FORBID-2(가중치 0) ✅
- **동일 상호 원거리 다지점**(예: "○○필라테스" 강남점/송파점, 지점명 미표기, 각 지점 고유 02 번호) → 상호명 유사도 1.0, 전화 신호 무관, 좌표만 다르다. **거리 상한을 규정한 FORBID가 없다.** FORBID-4는 "근접 + 비유사"만 막고 그 거울상인 **"원거리 + 유사"** 는 무방비다. 완전 연결 조건은 이 경우 오히려 쉽게 충족된다(3개 지점이 서로 모두 유사). 크기 상한 6 안에서 3개 지점이 한 venue 로 뭉치면 **"지역 × 카테고리 비교"가 무의미해진다** — FORBID-2의 `because` 가 서술한 실패가 다른 입구로 성립한다. → **결함.**

### 규격 위반

| 항목 | 판정 | 내용 |
|---|---|---|
| R-6 | ✅ 통과 | REQ-5 (표집 스크립트 재현·홀드아웃 참조 0건·rationale·50/50 구성) — 단 라벨러 독립성 미규정 |
| R-7 | ✅ 통과 | REQ-8 (실수집 500건 → 2소스 연결 venue ≥ 40, "픽스처로 만족 불가") |
| 원칙 2.5 짝 | ✅ 통과 | FORBID-1~5(병합하지 마라) ↔ REQ-2 recall 0.85 · REQ-8 |
| forbid 개수·5요소 | ✅ 통과 | 6건 |
| **detect 대상 실재** | ⚠️ 부분 | 선행 조건 표가 "F2 REQ-1 스냅샷 — 현행 **'정확히 7개'** 문구 갱신"이라 적었으나 **F2a REQ-1 정본은 "정확히 6개"** 다. 개정 요청서가 존재하지 않는 문구를 대상으로 한다 |
| touches 밖 산출물 | ❌ 위반 | done_when 의 `config/g1-axes.json` — 생산자 부재(C4와 동일) |

### 공격 결과

- **A 악의적 준수** — "아무것도 병합하지 않는 구현"을 시도. REQ-2(recall 0.85) + REQ-8(실데이터 2소스 venue ≥ 40)이 이중으로 차단 ✅. 반대로 "전부 병합"은 REQ-1(falseMerge 0) + REQ-3으로 차단 ✅. **양방향 모두 막혔다.**
- **B 조건 회피** — FORBID-5의 `when` 이 "**중 하나 이상**이 medical_wellness"로 확대돼 1차 지적(도수치료↔필라테스 오분류 쌍)이 닫혔다 ✅. FORBID-2의 대표번호 프리픽스 6종은 여전히 열거식이고 확장 절차가 없다(소규모 프랜차이즈의 공용 02 번호는 밖). FORBID-4의 거울상 미방어는 위 A 참조.
- **C 탐지 무력화** — **최대 잔여 결함.** REQ-4(블로킹 재현율 ≥ 0.95)의 평가 쌍은 REQ-5에 의해 **"블로킹 후보 층화 무작위 추출"** 로 만들어진다. 즉 **평가 대상의 모집단이 피검 대상(블로킹)의 출력**이다. 블로킹이 놓친 동일 업체 쌍은 홀드아웃에 들어올 수 없으므로 **REQ-4는 구조적으로 실패할 수 없다.** REQ-4 acceptance 가 "평가 쌍을 후보로 미리 주입하지 않고 전체 모집단에서 블로킹을 실행"이라고 적었지만, 표집 프레임이 이미 후보 집합이면 그 절차는 의미가 없다(블로킹 로직을 사후에 좁히지 않는 한 항상 포함된다). 1차가 요구한 "블로킹 재현율 REQ"는 **형식만 충족됐다.** → **결함.**
  FORBID-2의 must_not/detect 불일치(1차 지적)는 "가중치 0 이외의 값을 적용"으로 문구가 detect 와 일치하게 정정됨 ✅.
- **D 지름길 유도** — 임계 완화는 FORBID-6이 **0.75·0.92·0.98·6·0.95 를 명시 열거**해 잠갔다 ✅(1차 필수 수정 5 반영). 평가셋 조작은 `entity-eval-integrity` ✅. **남은 경로:** ① 블로킹 키를 좁혀 후보를 줄이기 — 위 C에 의해 지표에 나타나지 않는다. REQ-8(실데이터 2소스 venue ≥ 40)이 부분 방어이나 40이라는 절대 수치는 모집단 대비 비율이 아니라서 블로킹을 크게 좁혀도 도달 가능하다. ② `config/g1-axes.json` 자작(C4와 동일).
- **E DAG 정합성** — `depends_on` 에 **C2·C3 추가**돼 1차 지적("교차 검증할 두 번째 관측치의 존재를 전제하지 않는다")이 해소 ✅. `blocks: [C6]` 양방향 일치 ✅. `parallel_with: [C4, W1]` 에 C2·C3가 없어 C2·C3 쪽의 자기모순(§2·§3)과 대칭이 맞지 않는다 — **정정 주체는 C2·C3다.** 순환 없음.
- **F 존재 이유** — `traces_to: [H1, G4]`, `why`(모수 부풀림·가격 분산) ↔ REQ-1·2·8 연결 타당. **통과.**

### 필수 수정 사항
1. **REQ-4의 표집 프레임을 블로킹 출력 밖으로 옮길 것** — 전수 쌍 또는 독립 오라클(도로명주소 정규화 완전일치·D1b ledger 교차)에서 동일 업체 쌍을 구성해야 블로킹 누락이 지표에 나타난다. 현행은 자기 출력에 대한 자기 검증이다.
2. **FORBID 추가(또는 FORBID-4 확장)** — `when: 두 레코드의 좌표 거리 > 500m 이면서 도로명주소 건물번호가 불일치` → `must_not: 상호명 유사도만으로 match_score ≥ 0.92 산출`. 원거리 동일상호 다지점 병합이 현재 무방비다.
3. 선행 조건 표의 "정확히 7개" → **F2a REQ-1 정본의 "정확히 6개"** 로 정정(개정 요청서가 실재하는 문구를 가리켜야 한다).
4. `config/g1-axes.json` 생산 태스크 지정(C4와 공통).
5. REQ-5에 라벨 작성자 독립성 또는 이중 판정·조정 절차 명시(R-6 3항). REQ-6 왕복 검증에서 `venue_source_link` 이력 보존은 잘 규정돼 있다.

---

## 6. C6-TAG-ASSIGN — REVISE

### 의미 반전 환각 — 부분 봉쇄. 가장 중요한 케이스가 여전히 통과한다

v2는 I3(≥12자) · **I4(문장 경계 정렬, 근거 문장 전체 포함)** · I5(대상 venue 소스 한정)를 추가했다. 1차가 지적한 3유형 중 **근거 부적합(2글자 인용)과 타 대상 귀속은 닫혔다.**

**그러나 의미 반전의 정본 사례를 다시 넣어봤다:**

```
원문:      "저희 시설에는 여성 전용 탈의실이 없습니다."
evidence:  "저희 시설에는 여성 전용 탈의실이 없습니다."   ← 문장 전체
검증:      I3 길이 26자 ✅ / I4 문장 경계 정렬 ✅ / I5 대상 venue 소스 ✅
결과:      women_only 태그 저장 — 불변식 6종 전부 통과
```

**I4는 "문장 전체를 인용하라"는 요구일 뿐 "그 문장이 태그를 지지하는가"는 판정하지 않는다.** 오히려 문장 경계 정렬을 요구했기 때문에, 부정어를 잘라내던 v1식 환각은 막히지만 **부정 문장을 통째로 인용하는 쪽이 규칙 준수 경로가 된다.**

유일한 방어는 **REQ-2(부정·반전 픽스처 20건에서 태그 0건)** 인데:
- 이 20건은 **구현자가 손으로 쓴다.** REQ-5의 표집 절차(sample_tag_eval.py·시드·층화)는 개발셋 200/홀드아웃 100에만 적용되고 **부정 픽스처에는 적용되지 않는다.**
- **홀드아웃에 부정·반전 케이스를 포함하라는 요구가 없다.** 따라서 REQ-3(precision 0.90)이 이 유형을 측정한다는 보장이 없다.
- FORBID-6이 부정 픽스처 삭제를 잠그지만, **쉬운 20건("주차 불가", "샤워실 없음" 같은 단순 패턴)을 처음에 넣고 잠그면** 규격 §2.1이 경고한 "쉬운 시험지를 봉인"이 그대로 성립한다.

→ **결함(중대).** 결정론적 방어(부정 토큰 스캐너)가 계약에 없고 통계적 방어(precision)는 해당 유형을 표집하지 않는다.

### '치료' 금지어 충돌 — 해소됨

FORBID-2의 `when` 이 **"질환명 + 효능 동사 결합 패턴"** 이고 **`medical_scope` 업종명 enum 매칭은 명시적 예외**다. detect 도 "medical_scope enum 매칭 구간 예외 처리 + 업종명 15건은 태그 유지 / 효능 주장 15건은 태그 0건 **양방향 검증**"으로, 사전을 임의 완화할 유인이 제거됐다. 설계 전제 1이 그 이유(원칙 2)를 명시적으로 적었다. **1차 지적 해소 ✅ — 이 배치에서 원칙 2를 가장 정확하게 적용한 조항이다.**

단, **인용 대상이 D4 정본과 어긋난다:**

| C6 인용 | D4 정본 | 문제 |
|---|---|---|
| `forbidden_lexicon.yaml` | `rules/lexicon.yaml` | 파일명 불일치 + **D4 K-1이 파일명 인용을 금지**("`exported_rules.json` 의 rule_id 문자열만") |
| `medical_scope.yaml` | `rules/scope.yaml` | 동일 |
| "치료효과 보장 **계열 rule_id**" | D4는 `kind: lexicon` 만 부여, 하위 분류(치료효과/최상급/유인) 필드 없음 | **선택자가 실재하지 않는다** — 구현자가 rule_id 를 임의로 골라야 한다 |
| `validate_d4.py` 의 lexicon 판정 | 판정 함수 정본은 `packages/legal/medical/src/index.ts` (show/hide/needs_review). `validate_d4.py` 는 D3/D4 산출물 검증기 | detect 가 잘못된 실행 주체를 지목 |

### 규격 위반

| 항목 | 판정 | 내용 |
|---|---|---|
| R-6 | ⚠️ 부분 | 개발셋·홀드아웃은 REQ-5로 규정 ✅ / **부정 픽스처 20건은 표집 절차·홀드아웃 대상 밖** |
| R-7 | ✅ 통과 | REQ-7(실데이터 부여율 ≥ 60%) · REQ-8(failed ≤ 5% + 재처리 큐 전량) — 1차 지적("90% failed 가 합법") 해소 |
| 원칙 2.5 짝 | ✅ 통과 | FORBID-1·2·3(저장하지 마라) ↔ REQ-4 recall 0.70 · REQ-7 |
| 결정성 | ✅ 통과 | REQ-6(2회 실행 서명 해시 일치 + temperature ≠ 0 호출 1건이면 exit 1) — 1차 지적 해소 |
| **detect 대상 실재** | ❌ **위반** | FORBID-2의 D4 파일명·rule_id 선택자·판정 주체 3중 오지정(위 표) |
| **depends_on** | ❌ **위반** | FORBID-2가 D4 산출물을 직접 집행하는데 `depends_on` 에 D4 없음(F4 경유 전이 의존에만 기댄다). C4·C7은 D4를 직접 의존선으로 넣었다 — 같은 배치 안에서 불일치 |
| touches 밖 산출물 | ❌ 위반 | done_when 의 `config/g1-axes.json` (C4·C5와 공통) |

### 공격 결과

- **A 악의적 준수** — "쉬운 태그만 붙이고 어려운 태그는 포기": REQ-4(recall 0.70) + REQ-7(실데이터 60%) 이중 차단 ✅. 역방향 "아무 태그나 대량 부여": REQ-3(precision 0.90) 차단 ✅. REQ-1의 "rule-map 이 filter_visible 태그를 8개 이상 포함하지 않으면 exit 1" 은 룰 태거의 최소 커버리지까지 못박았다 ✅.
- **B 조건 회피** — FORBID-2는 위와 같이 균형 잡혔다 ✅. **FORBID-1의 `when`("I3·I4·I5 중 하나라도 위배")이 지나치게 좁다** — 의미 반전은 세 불변식을 모두 만족하므로 이 금지의 발동 대상이 아니다. 즉 FORBID-1의 `because` 가 명시적으로 서술한 실패("여성 전용 탈의실 없음에서 잘라낸 태그")를 FORBID-1 자신이 막지 못한다. → **결함.**
- **C 탐지 무력화** — FORBID-5 detect 에 **(b) `prompt-lint`(정적 템플릿을 스테이징 venue 상호명 사전과 대조)** 가 추가돼 1차 지적("few-shot 을 정적 템플릿에 하드코딩하면 통과")이 닫혔다 ✅. FORBID-3 detect 도 grep 에서 **"LLM 응답 원문이 zod parse 이외 경로로 태그 생성 함수에 도달하지 않음"이라는 모듈 경계 테스트**로 강화 ✅. 잔여: REQ-2의 20건이 자작이라는 점(위).
- **D 지름길 유도** — 임계 완화·라벨 수정·픽스처 삭제는 FORBID-6이 잠금 ✅. 실패율 도피는 REQ-8(≤5%)이 차단 ✅. **남은 경로:** ① 부정 픽스처를 쉬운 것으로 초기 구성, ② `config/g1-axes.json` 자작으로 메디컬 축 제외 → FORBID-2의 D4 대조 부담을 통째로 회피(C4·C5와 공통 경로이나 **C6에서 가장 파괴적**이다 — 축 하나가 태그 없이 사라진다).
- **E DAG 정합성** — `depends_on: [C5, F4, F2a]`, `blocks: [C7, W4]` 양방향 일치 ✅. 1차의 ID 오참조 4건 정정 ✅. out_of_scope 에 **"온톨로지 결함 발견 시 코드를 쓰지 않고 F4 변경 요청 후 대기"** 절차가 추가돼 1차의 소관 충돌 해소 ✅. **잔여: D4 직접 의존선 부재.**
- **F 존재 이유** — `traces_to: [H5, H3]`. H5(필터 사용률)는 REQ-3·4가 전제(필터 신뢰도)를 직접 측정 ✅. H3(롱테일 1페이지 진입)는 C6이 측정하지 않고 D2·W4가 측정한다 — 다만 태그 없이는 조합 랜딩이 성립하지 않으므로 **전제 제공자로서의 참조**로 인정. 장식은 아니다.

### 필수 수정 사항
1. **FORBID 신설(또는 FORBID-1의 `when` 확장)** — `when: evidence 문장에 부정·부재 토큰(없음/불가/아님/미제공/미운영/제외/불가능)이 태그 키워드와 동일 문장에 존재하는 경우` → `must_not: 해당 태그 저장` → `detect: 결정론적 부정 스캐너 단위테스트 + 부정 픽스처 회귀`. 지금은 통계 지표(precision) 외에 의미 반전을 잡는 결정론적 장치가 0개다.
2. **REQ-2의 부정 픽스처에 표집 절차를 부여** — 실수집 원문에서 부정 토큰 정규식으로 후보를 뽑아 태그별 층화 추출하고, **홀드아웃 100업체에 부정·반전 케이스 최소 N건 포함**을 REQ-5에 명시. 손으로 쓴 20건을 FORBID-6으로 잠그는 현행은 "쉬운 시험지 봉인"이다.
3. FORBID-2의 D4 인용을 **`exported_rules.json` 의 rule_id 집합**으로 교체(D4 K-1 규약 준수). 하위 분류 선택자가 필요하면 **D4에 `subkind` 필드 추가를 변경 요청**으로 걸 것 — 현행 선택자는 D4 산출물에 실재하지 않는다.
4. FORBID-2 detect 의 판정 실행 주체를 `packages/legal/medical/src/index.ts`(show/hide/needs_review)로 정정.
5. `depends_on` 에 **D4-MEDICAL-AD-GUARDRAIL** 추가(C4·C7과 동형).
6. `config/g1-axes.json` 생산 태스크 지정(C4·C5와 공통).

---

## 7. C7-QUALITY-GATE — REVISE (REJECT 해소, 단 규격 위반 3건 신규)

### REJECT 사유 3건의 해소 여부

| 1차 REJECT 사유 | v2 대응 | 판정 |
|---|---|---|
| 뷰 필터 조건이 계약에 없음 (`SELECT * FROM venue` 로도 전 REQ 통과) | REQ-3 — 진리표 결합 + 컬럼 매니페스트 + **hidden 픽스처 4종 각 15건(총 60건) 뷰 조회 0건** + force_public/medical 실패 5건 0건 + 충돌 10건 NULL | **해소 ✅** — 통합테스트가 실재하고 위반 케이스를 실제로 포함한다 |
| 공개 임계값이 계약에 없음 | REQ-2 — 임계 **60 소스 하드코딩** + FORBID-3(임계·가중치·골든 기대값·컬럼 매니페스트 diff 라벨 게이트) | **해소 ✅** |
| REQ-1 ↔ O2 REQ-4 양립 불가 | 판정(C7) / 오버라이드(O2) 분리 저장 + 뷰 결합. O2 REQ-3·FORBID-2도 동일 구조로 정정됨 | **해소 ✅** — 양쪽 계약이 서로를 인용하며 일치한다 |

**"hidden 픽스처가 뷰 조회 0건임을 검증하는 통합테스트"는 실재한다** (REQ-3 acceptance (a), `pnpm test:public-view`). 다만 **같은 이름의 테스트를 F2b REQ-4·REQ-5가 이미 소유**한다(아래 E 참조).

### 규격 위반 — 3중 (전달 차단)

**① 원칙 2.5 위반 — 숨김 FORBID의 짝이 되는 정상 동작 REQ가 없다.**
C7의 FORBID 6개 중 5개가 "공개하지 마라" 계열이다. **전량 `hidden_quality` 로 판정하는 구현을 시뮬레이션했다:**

| REQ | 전량 비공개 시 |
|---|---|
| REQ-1 쓰기 경로 1개 | 통과 |
| REQ-2 골든 40건 score·reason 기대값 일치 | 통과 (골든 기대값도 함께 저점으로 작성) |
| REQ-3 hidden 60건 뷰 조회 0건 | **만점** |
| REQ-4 비공개 사유코드 부여 | 통과 |
| REQ-5 행 수 변화 0 | 통과 |
| REQ-6 2회 실행 변경 0 | 통과 |
| REQ-7 24시간 초과 **public** venue 0건 | **public 이 0건이므로 자동 통과** |
| REQ-8 커버리지 리포트 출력 | **하한이 없다 — 0% 를 출력해도 통과** |

→ **공개 업체 0건인 게이트가 C7 계약을 100% 준수한다.** F2b는 이 위험을 인지해 REQ-5("공개 픽스처 20건 + force_public 5건 전건 조회, 아니면 exit 1")를 두었는데 **정작 판정 주체인 C7에는 대응 REQ가 없다.** G4가 "미달 데이터는 비공개"를 집행하는 태스크이므로 이 방향은 항상 열려 있다. 규격 §0 원칙 2.5의 검사 질문("이 금지를 극단적으로 준수하면 제품이 사라지는가?") — **사라진다.**

**② R-7 위반 — 실환경 하한 REQ가 0건.**
C1~C6은 전부 실수집/스테이징 DB 스모크를 갖는다(C1 REQ-8 · C2 REQ-8 · C3 REQ-8 · C4 REQ-4 · C5 REQ-8 · C6 REQ-7·8). **C7만 전 REQ가 픽스처·골든·리포트 쿼리로 충족 가능하다.** REQ-7의 nightly `report:gate-freshness` 는 실행 환경이 실데이터지만 **public 행이 0이면 항상 통과**하므로 하한이 아니다.

**③ R-6 위반 — 품질 임계 REQ가 있는데 표집 절차·홀드아웃이 없다.**
REQ-2는 "골든 40건(결측 12건 포함)의 기대 score·reason_codes 일치"라는 품질 임계 REQ다. **이 40건의 모집단·추출 방법·층화 기준이 계약에 없고 홀드아웃도 없다.** C4·C5·C6은 전부 표집 스크립트 + 홀드아웃 + `*-eval-integrity` 잡을 갖는데 **집행자에게만 없다.** 게다가 FORBID-3이 그 골든셋을 라벨 게이트로 동결한다 — 규격 §2.1이 지목한 "**쉬운 시험지를 봉인**" 구성이 그대로다. 가중치 설정 파일의 **초기 값에 대한 제약도 없어서**(사후 변경만 잠금), 임계 60은 고정이지만 **모두가 60을 넘도록 또는 아무도 못 넘도록 가중치를 초기 설계하는 것**이 완전히 합법이다(§3.4 "사전 설정은 무방비").

### 그 밖의 규격 대조

| 항목 | 판정 | 내용 |
|---|---|---|
| REQ ≤ 8 / forbid ≤ 6 | ✅ | REQ 8 · FORBID 6 |
| forbid 5요소 | ✅ | 6건 전부 |
| **detect 대상 실재** | ❌ **위반 (다수)** | 아래 표 |
| traces_to | ✅ | `[H1, G4]` — 1차의 장식 참조 H4 제거 ✅ |
| out_of_scope · rollback · touches | ✅ | 구체적 |

**F2 정본과의 명칭·구조 불일치 (REQ·FORBID의 detect 가 존재하지 않는 객체를 가리킨다):**

| C7 | F2b 정본 | 영향 |
|---|---|---|
| `quality_verdict` (score, reason_codes, ruleset_version, evaluated_at) | `venue_quality_judgement` (quality_score, reason_codes, judge_version, judged_at) | **REQ-1 acceptance 가 `quality_verdict`·`qualityVerdict` 를 grep 한다 → 매칭 0건으로 공허 통과.** 1차 REJECT 사유 3번(“is_public grep 공허 통과”)과 **동일한 실패가 이름만 바뀌어 재현**된다. O2는 이미 F2b 명칭(`quality_score`·`reason_codes`)을 쓴다 |
| `review_override` | `venue_visibility_override` | REQ-1 (b)·FORBID-1 detect 동일 문제 |
| `visibility_change_event` | **F2b 산출물에 없음** | REQ-7의 대상 테이블이 어느 계약에서도 생성되지 않는다. C7 out_of_scope 는 "마이그레이션 작성 금지(뷰만 예외)" 이므로 C7이 만들 수도 없다 |
| reason_code enum 에 `REQUEST_TAKEDOWN`·`LEGAL_ORDER` 추가 (REQ-4) | F2b REQ-2: `reason_codes` 원소가 **폐쇄 enum 6종 CHECK** | **INSERT 가 23514 로 거부된다.** REQ-4는 현행 스키마에서 구현 불가 |
| visibility **4값** (선행 조건 표 · 진리표) | F2b REQ-1: **5값** (`public`·**`needs_review`**·`hidden_quality`·`hidden_request`·`hidden_legal`) | `needs_review` 를 **쓰는 주체도, 뷰 처리도, reason_code 대응도 없다.** D4 판정 enum 이 `show/hide/needs_review` 이므로 이 값은 실제로 발생한다. W1·W3·W4도 4값 전제라 **하류 전체가 5번째 값을 모른다** |

**뷰 이중 소유 (원칙 1 위반):**

| | F2b | C7 |
|---|---|---|
| touches | `packages/db/views/public_venue.sql` | `packages/db/views/public_venue.sql` |
| 컬럼 화이트리스트 | `allowed-columns.quality.json` 의 `public_view` | `public_venue.columns.json` (별도 매니페스트) |
| 테스트 명령 | `pnpm test:public-view` | `pnpm test:public-view` |
| 진리표 | `force_public` → **무조건 공개** | `force_public` 이어도 `hidden_legal`·`hidden_request`·medical 실패면 **비공개** |

**두 계약이 같은 파일·같은 테스트 이름·다른 진리표를 각자 소유한다.** F2b가 선행 머지(F2b.blocks ⊃ C7)되므로 C7이 뷰를 덮어쓰게 되고, 그 순간 **어느 계약의 REQ-4/REQ-3이 정본인지 판정 불가**가 된다. (C7의 진리표가 법적으로 옳다 — F2b 쪽이 `hidden_legal` 에 대한 오버라이드 우선순위를 잘못 규정했다.) O2 out_of_scope 는 "뷰 정의 변경 — **C7 소관**"이라 적어 3자 인식도 갈려 있다.

### 공격 결과

- **A 악의적 준수** — 위 ①. **전량 비공개 구현이 만점.** 1차의 `SELECT * FROM venue`(전량 공개) 구멍은 닫혔으나 **정반대 방향이 무방비**다. 규격 §0 원칙 2.5가 정확히 이 경우를 위해 신설됐고 D4는 K-5로, F2b는 REQ-5로 짝을 두었는데 **C7만 없다.** → **결함(중대).**
- **B 조건 회피** — FORBID-1의 `when` 이 apps/web · packages/api · W1 sitemap·JSON-LD · W4 정적 생성기 · 배치 export 로 확대돼 1차 경로 4·6이 닫혔다 ✅. 잔여: **열거식**이라 새 표면(O1 대시보드 export · 피드 · LLM 인덱싱용 덤프)은 밖이다. FORBID-5의 `when`("D4 판정이 `show` 를 반환하지 않은 경우")은 `needs_review` 를 포함하므로 넓고 정확 ✅ — 다만 그 결과를 어떤 visibility 로 쓸지가 미정의(위 5값 문제).
- **C 탐지 무력화** — **REQ-1·FORBID-1의 grep 대상 식별자가 F2 정본에 없다**(위 표) → 코드는 `venue_quality_judgement` 에 쓰고 검사는 `quality_verdict` 를 찾으므로 **위반해도 녹색.** 1차 REJECT 3번의 재현이다. 또 `public-surface` 워크플로의 **트리거 범위가 계약에 없다** — C7이 소유한 신규 워크플로에 path 필터가 걸리면 W1·W4·F5 PR에서 잡이 아예 돌지 않는다. FORBID-1이 "DB 롤 분리 런타임 차단은 F5 소관이며 **F5 머지 후 이 잡에 추가한다**"고 적었으나 **그 추가를 수행할 태스크가 지정돼 있지 않다**(C7은 이미 머지됐고 F5 계약에도 이 항목이 없다). 이미 F2b REQ-8·FORBID-4가 `test:roles` 로 롤 검증을 제공하므로 **인용 대상을 F2b로 바꾸면 즉시 실효화된다.**
- **D 지름길 유도** — ① 임계 하향 → FORBID-3 차단 ✅ ② 골든 기대값·가중치 사후 수정 → FORBID-3 차단 ✅ ③ 뷰 WHERE 완화 → REQ-3 통합테스트 + 픽스처 diff 게이트로 차단 ✅ ④ **가중치·골든의 초기 설계** → 무방비(위 ③) ⑤ **전량 비공개로 도피** → 무방비(위 ①). 막혔을 때 개발 에이전트가 갈 곳은 ④⑤다. **결함.**
- **E DAG 정합성** — `depends_on: [C4, C6, F2a, F2b, D4]` / `blocks: [O1, O2, W2, W3, W4, W8]` — **W4가 blocks 에 들어와 1차 경로 4가 닫혔다 ✅**(W4.depends_on 에도 C7 확인). 순환 없음. **잔여 모순:** `parallel_with: [W6-LEAD-TRACKING]` 인데 W6.depends_on = [W2, W3, …] 이고 C7이 W2·W3를 blocks 한다 → **W6은 C7의 전이 하류이므로 병렬 불가.** 그리고 위의 **뷰 이중 소유**가 F2b와의 경계 충돌이다.
- **F 존재 이유** — `traces_to: [H1, G4]`, `why`(미달 데이터 격리 + 서빙 표면 단일 관문) ↔ REQ-3·FORBID-1이 대응 ✅. **다만 H1(가격 노출 40%) 검증에 C7이 기여하려면 REQ-8 커버리지가 실측치를 산출해야 하는데 하한이 없어 0%도 합법**이라, 존재 이유와 요구사항의 연결이 A의 결함만큼 약하다.

### 필수 수정 사항 (①②③은 전달 차단 조건)
1. **REQ 신설 — 최소 공개 커버리지 하한(원칙 2.5 짝).** 예: "실수집 스테이징 스냅샷에서 축별 `visibility='public'` venue 수 ≥ N(축별 하한, G1 통과 축만) 이고, 두 값이 미달이면 exit 1". D4 K-5(`show` 비율 ≥ 0.60, 개발셋·홀드아웃 각각)가 선례다. **이 REQ 없이 전달하면 게이트가 제품을 0으로 만드는 경로가 열린 채 배포된다.**
2. **REQ 신설 — R-7 실환경 하한.** 위 1과 통합 가능(스테이징 실데이터 입력 고정, "픽스처로는 만족 불가"). 현재 C7만 픽스처 세계 안에 있다.
3. **REQ-2에 R-6 적용** — 골든 40건의 모집단·추출 방법·층화 기준을 REQ로 명시하고 **홀드아웃 분리** + `quality-eval-integrity` 성격의 검사 추가. 아울러 **가중치의 허용 범위(항목별 상한·합계)를 계약 본문에 수치로 못박을 것** — 사후 diff 게이트만으로는 초기 설계를 통제하지 못한다.
4. **F2b 정본에 명칭 정합화**: `quality_verdict`→`venue_quality_judgement`, `review_override`→`venue_visibility_override`, `score`→`quality_score`, `ruleset_version`→`judge_version`, `evaluated_at`→`judged_at`. **REQ-1·FORBID-1의 grep 대상을 정정하지 않으면 1차 REJECT 사유 3번이 이름만 바꿔 재현된다.**
5. **REQ-4의 사유코드 확장을 F2b 개정 요청으로 승격** — 현행 F2b CHECK(6종 폐쇄 enum)에서는 `REQUEST_TAKEDOWN`·`LEGAL_ORDER` INSERT 가 거부된다. 선행 조건 표에 명시할 것.
6. **`visibility` 5값 대응** — `needs_review` 의 쓰기 주체·뷰 처리·reason_code 대응을 진리표와 REQ-4 표에 편입하거나, F2b에 5번째 값 제거를 요청. 지금은 C7·W1·W3·W4가 모두 4값 전제라 **정본이 만든 상태값을 하류 전체가 모른다.**
7. **`public_venue` 뷰의 소유를 하나로 확정.** 권고: **뷰 DDL·컬럼 화이트리스트는 F2b 단독 소유**로 두고(C7 touches 에서 `packages/db/views/**` 와 `public_venue.columns.json` 제거), C7은 **진리표를 만족하는지 검증하는 통합테스트와 개정 요청만** 소유. 그러면 C7은 "판정 + CI 경계 잡"으로 정리돼 1차 §11이 제기한 C7a/C7b 분할 요구도 자연히 해소된다. 현행 유지 시 F2b REQ-4(force_public 무조건 공개)와 C7 REQ-3·FORBID-6(법적·요청 비공개는 오버라이드 불가)이 같은 파일에서 충돌한다 — **어느 쪽이든 이 항목이 미해결이면 C7은 REJECT로 되돌아간다.**
8. `parallel_with` 에서 `W6-LEAD-TRACKING` 제거(전이 하류). `public-surface` 워크플로의 **트리거를 전 PR 대상으로 명시**, FORBID-1의 롤 검증 인용을 F5 대기 → **F2b `pnpm test:roles`** 로 교체.

---

## 8. 게이트 우회 경로 6건 — 재확인

| # | 1차 경로 | 상태 | 근거 / 잔여 |
|---|---|---|---|
| **1** | 뷰를 필터 없이 정의 | **닫힘** | C7 REQ-3(hidden 4종 각 15건 조회 0건 통합테스트) + F2b REQ-4·FORBID-1. **단 두 계약이 같은 파일을 이중 소유** — 정본 미확정 상태 |
| **2** | 공개 임계값 무규정 | **닫힘** | C7 REQ-2(60 하드코딩) + FORBID-3. **잔여: 가중치 초기 설계 무방비** |
| **3** | C7 REQ-1 ↔ O2 REQ-4 충돌 | **닫힘** | 판정/오버라이드 분리 저장 + 뷰 결합. C7·O2·F2b 3자 진술 일치. **잔여: 테이블 명칭이 C7만 다름** |
| **4** | W4가 C7 없이 정적 생성 | **닫힘** | C7.blocks ∋ W4, W4.depends_on ∋ C7, W4 REQ-7(빌드 후 visibility 변경 재검증)·FORBID(공개 5건 미만 조합 제외) |
| **5** | C4가 게이트 앞단에서 공개 필드 기록 | **닫힘** | C4 FORBID-5 — `visibility='public'` 기록 금지 + 할인·최저가·시술명 결합 파생 필드 금지 + "medical 표기 판정은 C7 단독 소유" 명시. detect 는 "medical 픽스처 30건이 전부 F2 DEFAULT `hidden_quality` 유지" ✅ |
| **6** | ORM camelCase 로 base 테이블 조회 | **부분** | C7 FORBID-1 detect 가 SQL 식별자 + ORM 모델명 + 생성 클라이언트 타입 import 3형태로 확대 ✅, F5 REQ(공개 조회 함수의 FROM 절이 public_venue 뿐)·F1 boundary job 이 다중 방어 ✅. **잔여 2건: (a) grep 대상 테이블명이 F2 정본과 불일치(§7 C) → 검사가 헛돈다, (b) `public-surface` 잡의 트리거 범위 미규정 + 롤 검증 추가 주체 미지정** |

**새로 생긴 경로 (2차에서 발견):**

```
경로7: C4·C5·C6 → 평가 축 목록을 config/g1-axes.json 에서 주입할 때 →
       이 파일을 생산하는 태스크가 없다(전 저장소에서 인용 4건뿐, 생산 0건).
결과: 구현자가 직접 작성하게 되고, medical_wellness 를 제외 축으로 적으면
       C4 REQ-1의 0.60 임계 · C6 FORBID-2의 D4 대조 부담이 통째로 사라진다.
       G1 판정 결과를 피검자가 정의하는 상태 — 정정 #6("사전 설정 무방비")의 재발.
수정: 생산 태스크 지정(D1b 또는 F1) + 3개 계약의 depends_on 반영.
       정본은 docs/gates/G1.md 이므로 파생 규칙(어느 verdict 를 통과로 볼지)도 함께 고정.
```
```
경로8: C2·C3 → 활성 축을 docs/discovery/D1/report.md 에서 읽을 때 →
       그 경로는 실재하지 않는다(D1 폐기, D1b는 docs/discovery/D1b/report.md,
       verdict 정본은 docs/gates/G1.md).
결과: acceptance 가 대상 부재로 실패하거나, 구현자가 그 파일을 자작해 통과시킨다.
       경로7과 합쳐 G1 게이트 결과가 파이프라인 5건에서 각자 다른 원천으로 읽힌다.
수정: 전 계약에서 축 원천을 docs/gates/G1.md 단일 경로로 통일.
```
```
경로9: C1 → REQ-6의 레퍼런스 더미 어댑터를 만들 때 → adapters/ 가 C1 touches 밖이고
       C1 자신에 대한 path-guard 도 없다.
결과: C3 §A가 세운 "소스 1개 = 태스크 1개 = PR 1개"가 C1 PR에서 우회된다.
       파생 태스크 커버리지 검사(adapter-task-coverage)는 소유자가 없어 이를 알아채지 못한다.
수정: C1 touches 에 지정 더미 경로 1개 추가 + C1 PR 에 대한 path-guard 적용.
```

---

## 9. 체계적 결함 패턴

### P1. 계약이 참조하는 산출물이 정본과 어긋난다 — 7건 중 6건 (2차 최대 위험)

| 계약 | 인용 | 정본 |
|---|---|---|
| C1 | "F2 REQ-6 의 append-only 트리거" | F2a **REQ-5** |
| C2·C3 | `docs/discovery/D1/report.md` | `docs/gates/G1.md` |
| C4 | `evidence_snippet` · D4 `forbidden_lexicon.yaml` · `MED-L-*` | `source_snippet` · rule_id 문자열 인용(D4 K-1) |
| C4 | F2a CHECK 2종을 개정 대상에서 누락 | I2·I3 레코드가 **저장 불가** |
| C5 | "F2 REQ-1 스냅샷의 '정확히 7개' 문구" | F2a REQ-1 **"정확히 6개"** |
| C6 | `forbidden_lexicon.yaml` · `medical_scope.yaml` · `validate_d4.py` 판정 | `rules/lexicon.yaml` · `rules/scope.yaml` · `src/index.ts` |
| C7 | `quality_verdict` · `review_override` · reason enum 8종 · visibility 4값 | `venue_quality_judgement` · `venue_visibility_override` · 6종 CHECK · **5값** |
| C4·C5·C6 | `config/g1-axes.json` | **생산자 없음** |

1차 P3(F2 스키마 불일치)는 "테이블이 아예 없다"였고, 2차는 **"테이블은 생겼는데 이름·제약·값 개수가 다르다"** 다. 위험은 동일하다 — **grep·jsonschema·SQL 기반 detect 가 대상 부재로 공허하게 통과하거나(C7 REQ-1), CHECK 충돌로 착수 즉시 블로커가 된다(C4).**
→ **전달 전 "정본 인용 라운드" 1회 필수.** 규격 §5의 "detect 가 참조하는 테이블/컬럼/함수가 선행 태스크 산출물에 실재하지 않음" 항목을 각 계약 저자가 **파일 경로 단위로 대조**해야 한다. 매니페스트 스크립트가 태스크 ID 는 검증하지만 **산출물 경로·컬럼명은 검증하지 않는다** — 이 검사를 자동화(계약 본문의 `docs/**`·`packages/**` 경로 문자열이 선행 태스크의 artifacts/touches 에 실재하는지)하는 것이 재발 방지책이다.

### P2. 사후 잠금은 촘촘한데 사전 설정은 여전히 무방비 — 5건

C1 `min_body_bytes` · C4 초기 라벨링(분모)·프로모션 사전 초기 내용 · C6 부정 픽스처 20건의 초기 구성 · C7 가중치 초기 설계·골든 40건 · C2·C3 `price_text_present` 초기 라벨.
전부 **FORBID로 "나중에 바꾸지 마라"는 완벽하게 잠갔으나, 처음 정하는 값에 허용 범위가 없다.** DAG 정정 #6이 D1을 분할하며 세운 원칙("잠금 대상의 허용 범위를 계약 본문에 못박는다")이 파이프라인 배치에는 **부분적으로만 이식됐다.** C3 FORBID-1(c)의 "직전 성공 응답 중앙값의 30%"처럼 **자기참조 상대 기준**이 이 문제의 일반해다.

### P3. 자기 출력을 모집단으로 삼는 재현율 지표 — 3건

C2 REQ-2 · C3 REQ-2(discover 재발견 recall, 모집단 = discover 출력) · C5 REQ-4(블로킹 재현율, 모집단 = 블로킹 후보).
**표집 절차·홀드아웃·라벨 잠금은 모두 갖췄지만 표집 프레임이 피검 대상의 출력이라 구조적으로 실패할 수 없다.** R-6이 "모집단·추출 방법·층화 기준"을 요구하는데 세 계약 모두 그 형식을 갖추고도 **모집단 선택 자체가 순환**이다. 외부 원장(**D1b `ledger.csv` 100건**)이 이미 존재하므로 대조 대상을 바꾸면 즉시 해결된다.
→ 규격 §2.1에 **"평가 데이터의 모집단이 피검 대상의 출력이면 안 된다"** 를 명시 항목으로 추가할 것을 권고한다(개별 태스크 수정으로는 재발한다).

### P4. 라벨 작성자의 독립성이 어느 계약에도 없다 — 4건

C2·C3(`price_text_present`) · C4(unit_type 정답 라벨) · C5(동일/상이) · C6(태그 정답).
전부 **홀드아웃을 "소스에서 참조 0건 / 개발 잡에서 권한 제거"로 보호**하지만, **그 홀드아웃을 라벨링하려면 반드시 열람해야 한다.** 라벨러 = 구현자면 홀드아웃은 이미 열린 시험지다. R-6 3항("정답 라벨을 구현자가 만든 경우 그 사실과 검증 방법을 명시")이 **어느 계약에서도 이행되지 않았다** — 기록 필드(labeler·labeled_at·rationale)는 있으나 **검증 방법**이 없다. D1b는 `double_check.csv`(이중판정 20건)로 이 문제를 이미 해결했다 — 같은 장치를 파이프라인에 이식하면 된다.

### P5. `blocks` 와 `parallel_with` 의 논리 모순 — 3건

C2(blocks C5 ∩ parallel_with C5) · C3(동일) · C7(parallel_with W6 인데 W6은 전이 하류).
매니페스트는 `blocks ↔ depends_on` 양방향만 검사하므로 **이 모순은 기계가 잡지 못한다.**
→ `tasks_manifest.py` 에 **`parallel_with ∩ (전이 선행 ∪ 전이 후행) = ∅`** 검사를 추가하면 3건 모두 자동 검출된다.

---

## 10. 전달 판단

**전달 가능(정본 인용 정정 후 즉시): C1 · C2 · C3 · C5**
결함이 전부 "경로·번호 정정 + REQ 1~2개 추가" 범위다. C5의 블로킹 재현율 표집 프레임 교체가 가장 무겁다.

**정합화 라운드 없이는 전달 불가: C4 · C7**
- **C4** — F2a CHECK 2종과 충돌해 `single_session`·`period_pass` 레코드가 **DB에 저장되지 않는다.** 착수 즉시 F2 변경 대기로 들어가므로 지금 넘기면 에이전트 1회 실행이 통째로 낭비된다.
- **C7** — 원칙 2.5 짝 부재로 **전량 비공개 구현이 만점을 받고**, REQ-1의 grep 이 F2 정본과 이름이 달라 **1차 REJECT 사유가 이름만 바꿔 재현**되며, `public_venue` 뷰를 F2b와 이중 소유한다. 세 항목 중 뷰 소유 확정이 미해결로 남으면 **REJECT로 되돌아간다.**

**우선순위 1건만 고른다면:** C7의 **최소 공개 커버리지 REQ**다. 나머지 결함은 CI를 빨갛게 만들지만, 이것 하나는 **CI가 전부 녹색인 채로 제품을 0으로 만든다.**
