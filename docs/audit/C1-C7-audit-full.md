# 감사 보고 — C1~C7 (Phase 2 파이프라인)

> 감사자: task-auditor · 일자: 2026-08-03
> 대상: `docs/tasks/C1.md` ~ `C7.md` (7건)
> 기준: `docs/02-task-contract-spec.md` §5 반려 사유 체크리스트 전 항목 + 적대적 공격 A~F
> 대조: `01-prd.md`(H1~H7, G1~G4) · `03-task-dag.md` · `00-lean-canvas.md`
> 교차 대조: `F2` · `D3` · `D4` · `F4` · `W3` · `W4` · `O2`
> **계약 파일은 수정하지 않았다. 판정과 지적만 낸다.**

---

## 0. 판정 요약

| 태스크 | 판정 | 한 줄 사유 |
|---|---|---|
| **C1** | REVISE | 실제 수집 하한이 0건 — 크롤러가 아무것도 못 모아도 전 계약 녹색 |
| **C2** | REVISE | 가격 원문 추출 요구가 계약에 없음 — 가격 0건 수집으로 REQ 전부 통과 |
| **C3** | **REJECT** | 산출물 개수가 D3 결과에 따라 결정 → PR 1개 원칙을 계약 시점에 보장 불가 |
| **C4** | REVISE | REQ-1이 회당 단가 환산율을 측정하지 않음 (악의적 준수 구멍) |
| **C5** | REVISE | 비대칭 설계는 진짜. 단 전 지표가 쌍 단위라 전이 병합이 무방비 |
| **C6** | REVISE | 환각 탐지가 '완전 날조'만 잡고 '의미 반전'을 못 잡음 |
| **C7** | **REJECT** | 뷰 필터·공개 임계값이 계약에 없어 게이트의 실질이 공란 |

---

## 1. C1-CRAWLER-CORE — REVISE

### 규격 위반
- `[구조] depends_on 이 DAG에 존재하지 않는 태스크를 참조` — `D3-SOURCE-DILIGENCE`. 실제 id는 `D3-SOURCE-DUE-DILIGENCE`(D3.md:5). `parallel_with: F4-TAG-ONTOLOGY` 도 실제 id는 `F4-NEED-TAG-ONTOLOGY`.
- `[구조] traces_to 가 PRD에 없는 ID를 참조` — `KM-price-coverage`. PRD·린캔버스 어디에도 이 ID는 선언돼 있지 않다(린캔버스 §7은 "가격 커버리지율"이라는 이름만 있고 ID 체계가 없음). C1·C4·C5·C7 4건이 동일 유령 ID를 참조한다.
- `gate: G1, G3` 는 YAML 스칼라 문자열로 파싱된다(C4~C7은 `[G1, G3]` 리스트). 게이트를 CI가 파싱해 착수를 막을 수 없다.
- 그 외 체크리스트 통과: REQ 8개(상한 이내) · forbid 6개 · when/must_not/because/detect/on_violation 5요소 전항목 존재 · out_of_scope · rollback · touches 구체.

### 공격 결과
- **A 악의적 준수**: 스케줄러가 job을 거의 발행하지 않아도 REQ-1~8이 전부 통과한다. REQ-4·REQ-7은 합성 500 job 부하테스트, REQ-3은 픽스처 50건 라운드트립이다. **"실제 네트워크에서 N건의 source_record를 확보한다"는 하한이 계약에 0건.** 크롤러가 완벽히 동작하지만 아무것도 수집하지 못하는 상태가 계약 100% 준수다. H1 표본이 만들어지지 않는데 CI는 전부 녹색 → `why` 가 약속한 것이 검증되지 않는다. **결함.**
- **B 조건 회피**: FORBID-3의 `when` 은 "최근 1초 내 요청수가 max_rps에 도달"으로 슬라이딩 윈도우를 명시해 1초 경계 리셋 트릭을 차단했다. FORBID-2의 `when` 은 타임아웃·4xx·5xx를 열거해 fail-open 경로를 닫았다. **방어됨.** 단 FORBID-4의 `when`("로그인·캡차·403 인터스티셜 마커 감지")은 마커 목록이 계약에 없어 "우리 파서가 마커를 인식하지 못했다"로 회피 가능 — 마커 사전이 픽스처에만 존재하면 신종 차단 페이지는 조용히 통과한다. **부분 결함.**
- **C 탐지 무력화**: FORBID-6의 CI grep(UPDATE/DELETE 구문·ORM 호출 검사)은 C1 코드만 본다. F2 REQ-6이 이미 DB 트리거로 append-only를 강제하므로 이 탐지는 중복이자 우회 가능(raw connection·타 패키지 경유)이다. 더 강한 탐지(트리거 존재 검증)를 REQ로 올리지 않았다. FORBID-1의 "우회 호출 경로 정적 검사"는 판정 기준(무엇을 우회로 보는가)이 계약에 없어 구현자가 스스로 느슨하게 정의할 수 있다.
- **D 지름길 유도**: `max_rps` 를 설정 파일에서 올리는 것은 FORBID-3이 "allowlist 기재 상한 초과 오버라이드 시 ValueError"로 막았다. 그러나 **allowlist 자체의 상한 값을 올리는 변경**은 out_of_scope 문장뿐이고 `detect` 가 없다 — allowlist diff에 대한 CI 승인 게이트(C4 FORBID-6 방식)가 없다. 개발 에이전트가 느려서 막히면 여기로 간다. **결함.**
- **E DAG 정합성**: 03-dag는 C1의 의존을 F2 하나로 적었는데 계약은 D3를 추가했다. 계약이 옳다(allowlist가 D3 산출물의 전사) — DAG 문서 쪽이 갱신돼야 한다. blocks(C2·C3·C4·C5)는 DAG와 일치. 순환 없음.
- **F 존재 이유**: `why`(원문 보존 없으면 C4 재파싱마다 재크롤)는 FORBID-5·6과 정확히 연결된다. 다만 `traces_to: H2` 는 C1이 직접 검증하지 않는다(H2는 C4가 측정). 장식 참조.

### 추가 치명 결함 — 원문 삭제 무조건 금지
`rollback` 의 "원문 삭제는 **어떤 경우에도** 롤백 절차에 포함하지 않는다" + FORBID-6은 사실상 무조건 금지다(원칙 2 위반). 그런데 C2/C3가 수집하는 body에는 리뷰어 개인정보가 포함되고(그래서 C2 REQ-6·FORBID-4가 존재), **개인정보 파기 요구(W7/S5)가 들어오면 계약을 지키는 한 응할 수 없다.** 삭제 의무와 보존 규칙이 충돌하는데 예외가 규칙 안으로 들어와 있지 않다 — 이 규칙은 첫 삭제 요구 때 깨지고, 깨지는 순간 FORBID 전체가 협상 대상이 된다.

### 필수 수정 사항
1. `depends_on` → `D3-SOURCE-DUE-DILIGENCE`, `parallel_with` → `F4-NEED-TAG-ONTOLOGY`, `gate` → `[G1, G3]`, `traces_to` 에서 `KM-price-coverage` 제거 또는 PRD에 지표 ID 선언.
2. REQ 추가: 승인된 소스 1개 이상에 대해 **실제 아웃바운드 수집 스모크**(N건 이상 source_record 생성 + sha256 검증)를 수행하고 결과 건수를 done_when 증빙으로.
3. FORBID 추가: `sources.allowlist.yaml` 의 `max_rps`·`per_host_concurrency`·`approved` diff는 `d3-change-approved` 라벨 없이 머지 차단.
4. FORBID-6·rollback의 원문 보존 규칙에 **조건부 예외** 명시(정보주체 파기 요구·법적 삭제 명령 시 감사 로그가 남는 지정 절차로만 삭제/마스킹).
5. FORBID-4의 인터스티셜 마커 사전을 버전 관리 산출물로 명시하고, 미인식 차단 응답에 대한 fail-closed 기본 동작 규정.

---

## 2. C2-ADAPTER-NAVER — REVISE

### 규격 위반
- `[구조] depends_on 이 존재하지 않는 태스크 참조` — `D3-SOURCE-DILIGENCE`.
- 나머지 체크리스트 통과(REQ 7 · forbid 6 · 5요소 · touches 구체 · rollback · out_of_scope).

### 공격 결과
- **A 악의적 준수 — 배치 내 최상위 위험 중 하나**: C2의 필수 키는 `name / road_address / category_raw / place_url` 뿐이다. **`price_raw` 를 단 한 건도 추출하지 않아도 REQ-1~7이 전부 통과한다.** REQ-3(화이트리스트 12키, additionalProperties=false)은 키의 상한만 정하고 하한을 정하지 않고, REQ-4는 필수 키에서 가격을 제외했다. 그리고 FORBID-3의 detect("extracted.price_raw[*] 각 값이 원본 body의 substring인지")는 배열이 비어 있으면 **공허하게 참**이다. 즉 **"가격을 수집하지 않는 어댑터"가 계약을 100% 준수하며, 그 상태로 C4·H1·H2·G1 판정이 진행된다.** C2의 `why`("H1 검증 표본이 만들어지지 않는다")가 정면으로 배신당한다. **치명 결함.**
- **B 조건 회피**: FORBID-2의 `when`(필수 키 1개 이상 실패)은 좁고 판정 가능. 그러나 **가격 원문이 페이지에 있는데 셀렉터가 놓친 경우**는 필수 키가 아니므로 어떤 `when` 에도 걸리지 않고 status=success로 나간다 — C3 FORBID-3이 "discover 0건"을 침묵 실패로 잡은 것과 대칭되는 방어가 C2에는 없다. FORBID-5는 외부 링크를 "직접 요청·enqueue"만 막아, 링크를 파일로 덤프해 다음 태스크가 읽게 하는 우회는 막지 못한다(저위험).
- **C 탐지 무력화**: REQ-1의 recall 30/30, REQ-4의 성공률 100%, REQ-6의 PII 0건 — **모두 저자가 직접 만든 픽스처 40건/15건 위에서 측정된다.** 픽스처 채집 절차(실제 크롤 결과에서 무작위 표집인지, 잘 파싱되는 페이지만 고른 것인지)가 계약에 없다. 골든 30곳도 저자가 고른다. **탐지의 난이도를 피검자가 정한다.**
- **D 지름길 유도**: 셀렉터가 깨져 REQ-4(100%)를 못 맞추면 픽스처를 쉬운 페이지로 교체하면 된다. **C4·C5·C6에는 픽스처/임계 변경을 라벨로 잠그는 FORBID-6가 있는데 C2·C3에는 없다.** 골든 픽스처가 무방비. **결함.**
- **E DAG 정합성**: `blocks: []` 로 두고 주석으로 "C4·C5·C7이 실데이터 전제"라 적었는데, 이게 실제 구멍을 만든다. C4는 `extracted.price_raw` 를 입력으로 삼는 모듈인데 **입력 필드명을 정의·보증하는 계약이 없다.** C2가 12키 화이트리스트를 독자 정의하고 C3가 소스별로 또 독자 정의하는데, C4·C5는 그 스키마에 의존선이 없다. 필드 계약의 소유자 공백. **결함.**
- **F 존재 이유**: `traces_to: [H1, H2]` 중 H1은 타당. **H2는 A에서 보였듯 이 계약이 가격 원문 수집을 전혀 요구하지 않으므로 검증에 기여하지 않는다.** 참조만 걸린 상태.

### 교차 결함 — 어댑터 등록 지점의 소유자가 없다
C3 REQ-1은 "레지스트리에 등록된 어댑터"를 요구하는데 레지스트리 파일의 위치가 어느 계약에도 없다. C1 artifacts에는 프로토콜과 contract_suite만 있고 레지스트리가 없다. 레지스트리가 `core/` 나 `adapters/__init__` 에 있으면 **C2 FORBID-6·C3 FORBID-5가 그 파일 수정을 금지**하므로 두 어댑터 모두 등록될 수 없고, 각자 자기 디렉토리 밖을 건드리면 병렬 실행 중 충돌한다. `touches` 목록 자체는 겹치지 않지만(naver_place vs kakao_map/_c3), **완성을 위해 필요한 공용 등록 지점이 양쪽 경계 밖에 있다.**

### 필수 수정 사항
1. REQ 추가: **가격 원문 추출 커버리지 하한**(골든 픽스처 중 가격 문자열이 존재하는 라벨 케이스 전체에 대해 price_raw 재현율 ≥ X%, 누락 시 status=parse_schema_drift).
2. FORBID 추가: 골든/PII 픽스처 및 필수키 목록 diff에 승인 라벨 게이트.
3. 픽스처 채집 절차를 done_when에 명시(어떤 crawl_run에서 어떤 규칙으로 표집했는지 README).
4. `extracted` 필드 계약(특히 price_raw 키 이름·타입·다중 값 표현)의 소유 태스크를 지정하고 C2·C3·C4가 동일 스키마 파일을 참조하도록 의존선 명시.
5. 어댑터 레지스트리의 소유자(C1 권장)와 공용 파일 수정 없는 등록 방식 명시.
6. `depends_on` id 수정.

---

## 3. C3-ADAPTER-KAKAO — REJECT

### REJECT 사유 — 범위가 계약 시점에 확정되지 않는다
C3의 대상은 "카카오맵 + `allowlist(owner_task=C3, approved=true)` 의 **모든** 소스"다. D3 계약(REQ-1·REQ-6)은 후보 소스를 **6개 이상** 조사하고 forbidden을 제외한 목록을 어댑터 대상으로 확정한다. 즉 C3의 산출물 개수는 **D3 판정 결과에 따라 1개일 수도 5개일 수도 있고, 계약은 상한을 두지 않았다.**

어댑터 N개는 ① 서로 독립적으로 되돌릴 수 있어야 하고(rollback 항목이 이미 `adapters.<source_id>.enabled=false` 로 **소스 단위 분리**를 전제한다 — 저자 스스로 "일부만 되돌리고 싶어진다"는 분할 신호를 적어놨다), ② 각각 별도 픽스처·셀렉터·실패 모드를 갖고, ③ 한 PR에 묶이면 하나의 셀렉터 문제로 전부 롤백된다.

`02-spec §4`의 분할 신호("되돌릴 때 일부만 되돌리고 싶어진다")에 정면 해당. **"카카오맵 외"를 한 태스크로 묶은 결정 자체가 잘못된 정의**이므로 REVISE가 아니라 REJECT다. 계약 안의 문구 수정으로 해결되지 않고 태스크 분해를 다시 해야 한다.

### 규격 위반
- `[구조] 하나의 태스크가 2개 이상 PR로 나뉘어야 함` — 위 사유.
- `[구조] depends_on 이 존재하지 않는 태스크 참조` — `D3-SOURCE-DILIGENCE`.
- `done_when` 이 "FORBID-1·2·3·4 역케이스 증빙"만 요구하고 **FORBID-5를 누락**(C2도 FORBID-6 누락). 자기 계약 내부 불일치.

### 공격 결과
- **A 악의적 준수**: C2와 동일하게 가격 원문 하한이 없다(필수 키는 name/road_address/category_raw/source_url). 추가로 REQ-1(레지스트리 커버리지)은 **어댑터가 존재하기만 하면** 통과한다. `discover()` 가 상시 빈 집합을 반환하는 스텁 어댑터를 등록하면 REQ-1·REQ-2(contract_suite) 통과, REQ-3은 카카오만 해당, REQ-5·6·7은 빈 입력에서 공허하게 참. FORBID-3이 "discover 0건을 success로 종료 금지"로 부분 방어하지만 이는 런타임 status의 문제일 뿐, **"그 소스에서 아무것도 못 모은다"는 사실은 계약상 실패가 아니다.** C3 소유 비카카오 소스들은 recall REQ조차 없다(REQ-3은 kakao_map 한정) — **커버리지 요구가 소스별로 비대칭이고 대부분의 소스에 품질 하한이 0이다.** 치명.
- **B 조건 회피**: FORBID-1의 `when`(allowlist 미등재 source_id)은 판정 가능하고 좁다 — 이 배치에서 가장 잘 쓰인 조건 중 하나. FORBID-2의 `when`("429·403이거나 봇 차단 마커")은 **502/503으로 위장한 차단, 빈 200 응답 차단**을 포함하지 않아 비껴갈 수 있다.
- **C 탐지 무력화**: FORBID-1의 detect는 "레지스트리 ⊆ allowlist" 양방향 assert로 실효적. 반면 REQ-6 PII 12건, REQ-3 골든 30곳은 자가 채집 픽스처(C2와 동일 결함).
- **D 지름길 유도**: 비카카오 소스가 어려우면 **스텁 어댑터를 등록해 REQ-1을 만족시키는 것**이 가장 싼 경로이고 계약이 이를 전혀 막지 않는다. 픽스처·임계 잠금 FORBID도 없다.
- **E DAG 정합성**: C2와 동시 실행(B4)에서 `touches` 문자열은 겹치지 않는다. 그러나 **레지스트리 등록 지점 공백**과 `tests/fixtures/` 상위 conftest·공용 픽스처 로더가 양쪽 경계 밖에 있어 실제 충돌 지점이 남는다. `depends_on: C1` 인데 C1의 adapter_contract_suite 를 외부 import 가능하게 하는 것은 C1 done_when에만 있고 C3 계약에는 경로가 고정돼 있지 않다.
- **F 존재 이유**: `why`("단일 소스 의존 회피 + C5 교차 검증 관측치")는 타당하고 C5 REQ/FORBID와 실제로 연결된다. 다만 이 `why` 는 소스 다양성이 목적인데 요구사항에 "카카오 외 소스에서 최소 N건 수집"이라는 지표가 없어 목적이 측정되지 않는다.

### 필수 수정 사항
1. **태스크 분해**: `C3a-ADAPTER-KAKAO` 1건 + D3 확정 목록의 소스별 개별 태스크로 분리. 소스 수가 D3 이후 확정되므로 "D3 report.md 의 어댑터 대상 목록 1개당 태스크 1개"라는 생성 규칙으로 기술.
2. 각 어댑터 태스크에 **소스별 최소 수집 지표**(discover recall 또는 최소 업체 수, 가격 원문 추출 재현율) REQ 부여 — 스텁 등록 차단.
3. FORBID-2의 `when` 에 5xx·빈 본문·응답 크기 급감 등 위장 차단 신호 추가.
4. 픽스처·임계 잠금 FORBID 추가, done_when의 FORBID 증빙 목록에 FORBID-5 포함, `depends_on` id 수정.

---

## 4. C4-PRICE-NORMALIZER — REVISE (배치 내 최고 위험)

### 규격 위반
- `[구조] traces_to 가 PRD에 없는 ID 참조` — `KM-price-coverage`(미선언), `S1`(린캔버스 §4 소재, PRD 미소재 — 참조 원장 이원화).
- `[구조] blocks 가 존재하지 않는 태스크 참조` — `W4-LANDING-GEN`(실제 `W4-COMBO-LANDING`).
- `[경계] out_of_scope 와 forbid 의 소관 충돌` — FORBID-3의 detect가 "**representative_price 선정 함수**가 해당 레코드를 제외하는지 검증"을 요구하는데 out_of_scope는 "대표값 선택 → C7 소관"이라고 못박았다. **C4에 존재하지 않아야 할 함수를 C4의 탐지 수단으로 삼았다** → (a) C4가 C7 영역을 침범해 PR 1개 원칙 위반, 또는 (b) 함수가 없어 detect가 공허. 어느 쪽이든 결함.
- FORBID-2의 detect도 동일 — "**비교 대상 쿼리 헬퍼**가 period_pass를 반환하지 않는지 검증"인데 이 헬퍼는 artifacts에도 REQ에도 없다. **탐지가 계약이 만들지 않는 산출물에 의존한다.**

### 공격 A — 악의적 준수: 커버리지 하한이 실제로 막지 못한다 (핵심 결함)
REQ-1은 "`price_unit_type` 이 unparseable 이 **아닌** 비율 ≥ 80%"다. unit_type은 `{per_session, period_pass, single_session, unparseable}` 4값이다. 따라서:

- 애매한 입력을 전부 `single_session` 또는 `period_pass` 로 분류 → **REQ-1 통과**(80% 이상 non-unparseable).
- `price_per_session` 은 per_session 에서만 산출되므로 → **REQ-2의 mismatch 카운트가 0**(비교할 값이 애초에 없다).
- REQ-3(unit_type ≠ per_session → price_per_session = null) 통과, REQ-4(period 예시 1건) 통과, REQ-5·6·7·8 통과.
- FORBID-1~4 전부 무해하게 통과(추정 없음·범위 밖 값 없음·프로모션 승격 없음).

**결과: 회당 단가가 단 한 건도 산출되지 않는 파서가 C4 계약을 100% 준수한다.** H2는 "노출된 가격의 80% 이상이 **회당 단가로 환산 가능**"인데 REQ-1은 회당 단가 환산율을 측정하지 않는다. UVP가 계약상 보호되지 않는다. **전량 unparseable 반환은 막혔지만, 한 칸 옆의 더 매력적인 도피처가 열려 있다.**

### 공격 B~F
- **B 조건 회피**: FORBID-4의 sanity 범위는 하한 5,000·상한 축별 명시로 판정 가능(강함). 다만 "10회 30만"을 회당 300,000원으로 잘못 산출하면 운동·바디 상한 500,000 이내라 통과한다 — **sanity 범위는 자릿수 사고만 잡고 횟수 나눗셈 누락은 잡지 못한다.** 이는 골든 라벨(REQ-2)에만 의존하는데 라벨은 저자가 만든다. FORBID-3의 `when`(프로모션 토큰 6개 열거)은 좁고 판정 가능하나 열거 밖 표현("런칭기념", "얼리버드", "N월까지")은 그대로 통과하며 사전 확장 절차가 없다.
- **C 탐지 무력화**: 골든 200건과 **정답 라벨을 C4 저자가 직접 만든다.** 표집 출처(C1 source_record 무작위 층화 표집인지, D1 표본 100건과 연결되는지)가 계약에 없다. 그리고 FORBID-6이 그 골든셋을 라벨 게이트로 **동결**한다 — **자기가 고른 쉬운 문제로 시험 보고 그 시험지를 잠근다.** REQ-1의 80%는 "측정 결과"가 아니라 "설계 가능한 숫자"다. FORBID-6이 방어하려던 실패("게이트가 맞춰 놓은 숫자가 된다")가 다른 경로로 성립한다. 추가로 **홀드아웃/블라인드 세트가 없어** 골든셋 과적합(케이스별 정규식 하드코딩)에 어떤 assertion도 반응하지 않는다.
- **D 지름길 유도**: ① 어려운 케이스를 `single_session` 으로 분류(완전 무방비), ② 임계 0.80 하향은 FORBID-6로 차단, ③ 골든 케이스 삭제도 차단, ④ **`price_unit_type` 분류 기준 자체를 느슨하게 바꾸는 것**은 어디에도 걸리지 않는다 — `single_session` 의 정의가 계약 전체에 한 번도 없다.
- **E DAG 정합성**: `depends_on: [C1, F2]` — **D4 의존 누락이 치명적.** FORBID-5의 detect는 "D4 허용 포맷 화이트리스트"에 의존하는데 C4→C1→(F2,D3), C4→F2→F1 어느 경로로도 D4에 닿지 않는다. C6·C7은 F4→D4 전이 의존이 있지만 **C4만 D4와 단절**돼 있다. 또한 C2·C3(원문 가격 문자열 공급자)에 의존선이 없어 입력 스키마 공백.
- **F 존재 이유**: `why` 는 정확하다. 그러나 A에서 보인 대로 **계약의 요구사항이 `why` 를 강제하지 않는다** — 존재 이유와 검증 수단이 어긋난 대표 사례.

### 무제한권 두 축 분리에 대한 판정
축 분리 자체는 REQ-3·REQ-4·FORBID-2로 **계약 내부에서는 성립한다.** 그러나 **두 축이 섞이는 것을 막는 장치는 C4 밖에서 전부 무너진다**:
1. FORBID-2의 detect가 의존하는 "비교 대상 쿼리 헬퍼"가 C4 산출물에 없다.
2. **C7 REQ-7이 두 축을 합산한다** — "공개 업체 중 price_per_session **또는** price_per_month_krw 가 존재하는 비율"을 가격 커버리지로 산출한다. G4 커버리지와 린캔버스의 "회당가 산출 가능 비율 ≥40%"가 **기간권으로 부풀려진다.**
3. 정렬·비교는 W3/W4에서 일어나는데 C4는 그들을 구속할 수 없고, W3/W4 계약에도 "period_pass를 회당가 정렬에 넣지 말라"는 조건부 금지가 없다.
4. **period_pass 결과의 정확도를 검증하는 요구가 0건**이다 — REQ-2의 mismatch는 price_per_session만 본다. price_per_month_krw가 전부 틀려도 CI는 녹색이다.

### 필수 수정 사항
1. REQ-1을 **`per_session` 산출률 하한**으로 교체/추가(회차 정보가 존재하는 라벨 케이스 대비, 축별 하한 별도).
2. REQ-2를 **모든 unit_type으로 확대**(price_per_month_krw·period_days·single_session 금액의 라벨 불일치 0건).
3. 골든셋의 **표집 절차와 출처를 REQ로 규정**(D1 표본·C1 source_record에서 축별 무작위 층화, 표집 스크립트 커밋) + **홀드아웃 세트 분리**(개발 중 열람 금지, CI에서만 실행).
4. `price_unit_type` 4값의 **판정 기준을 계약에 정의**(특히 single_session).
5. FORBID-2·3의 detect에서 참조하는 함수 문제 해소 — 두 함수의 소유를 C7로 확정하고, C4 detect는 **출력 레코드 수준 불변식**(period_pass 행의 price_per_session이 null이고 비교 가능 플래그 false)으로 재작성.
6. `depends_on` 에 **D4-MEDICAL-AD-GUARDRAIL 추가**.
7. `blocks` id를 `W4-COMBO-LANDING` 으로 수정, `traces_to` 미선언 ID 정리.
8. **스키마 정합성**: F2의 price_plan은 (raw_text, source_record_id, price_per_session, failure_reason, confidence, visibility). C4가 요구하는 price_per_month_krw·period_days·is_promotional·promo_valid_until·public_price_display·parser_version·source_snippet·captured_at 은 **F2에 없다.** 현행대로면 C4는 착수 즉시 전면 블로커. F2 변경을 선행 태스크로 명시하거나 필드 목록을 F2와 일치시킬 것.

---

## 5. C5-ENTITY-RESOLUTION — REVISE

### 비대칭 판단 검증 — 통과
FORBID 6개 중 **5개가 과잉병합 전용**이다: FORBID-1(임계 미만 자동병합 금지), FORBID-2(프랜차이즈 대표번호 가중치), FORBID-4(좌표 근접 단독 신호), FORBID-5(medical 임계 0.98 상향), FORBID-6(precision 임계 하향 금지). 과소병합 쪽 금지는 **의도적으로 0개**이고 유일한 방어가 REQ-2(recall ≥0.85)다. **양쪽을 똑같이 다뤄 판단을 회피한 것이 아니라 실제로 비대칭이 설계돼 있다.** 이 배치에서 가장 잘 쓰인 계약이다.

### 규격 위반
- `[구조] traces_to 미선언 ID` — `KM-price-coverage`, `S1`.
- 그 외 체크리스트 통과(REQ 7 · forbid 6 · 5요소 · out_of_scope · rollback · touches).

### 공격 결과
- **A 악의적 준수 — 전이 병합(transitive closure) 구멍**: 모든 REQ/FORBID가 **쌍(pair) 단위**다. REQ-1의 falseMerge ≤1도 150쌍 기준, FORBID-1·4·5도 쌍 조건이다. 그런데 실제 병합은 canonical 클러스터를 만든다. **A~B 0.93, B~C 0.93, A~C 0.40이면 쌍 단위 위반 0건으로 A·B·C가 한 업체로 뭉친다.** FORBID-4는 "좌표 ≤30m & 상호명 유사도 <0.6"인 **쌍**만 막으므로 중간 노드를 경유한 건물 전체 병합을 막지 못한다. **클러스터 크기 상한도, 단일 연결 vs 완전 연결 규정도 없다.** 설계 전제의 "정밀도 우선"이 클러스터 수준에서 무효화된다. **결함.**
- **B 조건 회피**: FORBID-2의 `when` 은 대표번호 프리픽스 6종 열거로 판정 가능. 그러나 **일반 02 번호를 공유하는 소규모 프랜차이즈**는 조건 밖이고 사전 확장 절차가 없다. FORBID-5의 `when`("**두** 레코드의 category가 medical_wellness")은 **한쪽만 medical인 경우**를 비껴간다(카테고리 오분류된 도수치료 ↔ 필라테스). **결함.**
- **C 탐지 무력화**: FORBID-2의 `must_not` 은 "일반 번호와 **동일한 가중치** 부여"인데 detect는 "가중치가 **0**으로 적용"을 검사한다. **금지 문구는 0.9로 낮추면 만족하지만 탐지는 0을 요구한다** — 문구/탐지 불일치는 규칙 신뢰를 깎는다. 더 중요한 것은 **평가셋 300쌍을 저자가 만든다**는 점이다. "유사하지만 다른 업체 150쌍"의 난이도를 저자가 정하므로 precision 0.99는 자기 채점이다. done_when은 라벨링 근거 README만 요구하고 표집 출처(C2/C3 실제 크롤 결과에서의 후보 생성)를 요구하지 않는다.
- **D 지름길 유도**: 임계 0.92 하향은 FORBID-1·6이 잠갔고 평가셋 조작도 FORBID-6이 잠갔다. **남은 도피처: 회색지대 하한(0.75)을 낮추는 것**(FORBID-6의 "임계 상수"에 0.75가 포함되는지 불명확)과 **블로킹 키를 좁혀 후보쌍 자체를 줄이는 것** — 후보 생성 단계는 어떤 REQ도 측정하지 않는다(블로킹 recall 미규정). 평가셋 300쌍은 이미 후보로 주어지므로 블로킹 결함이 지표에 나타나지 않는다. **결함.**
- **E DAG 정합성**: `depends_on: [C1, F2]`, `blocks: [C6]` 모두 DAG 일치, 순환 없음, 게이트 [G1,G3] 정상. 다만 C5는 "여러 소스의 같은 업체"를 병합하는데 C2·C3에 의존선이 없다 — C3의 `why` 는 "C5가 교차 검증할 두 번째 관측치"라고 스스로 적었는데 C5 계약은 그 관측치의 존재를 전제하지 않는다.
- **F 존재 이유**: `why`(모수 부풀림·가격/태그 분산)는 REQ-1·2와 정확히 연결. `traces_to: H1` 타당.

### 추가 — 스키마 부재 (치명)
C5의 자료구조 `canonical_venue` / `venue_source_record` / `merge_candidate` / `venue_canonical_link` 는 **F2가 정의한 7개 테이블에 하나도 없다.** REQ-3·REQ-6·FORBID-3의 detect(`DELETE FROM venue_source_record` grep)는 존재하지 않는 테이블을 대상으로 하므로 **전부 공허하게 통과**한다.

### 필수 수정 사항
1. REQ 추가: **클러스터 수준 불변식**(클러스터 내 모든 쌍의 match_score ≥ 0.92 완전 연결, 또는 크기 상한 K 초과 시 자동병합 금지·검수 큐 이관).
2. FORBID-5의 `when` 을 "두 레코드 **중 하나 이상**이 medical_wellness"로 확대.
3. FORBID-2의 `must_not` 문구를 detect와 일치("가중치 0으로 적용").
4. 평가셋 표집 출처·절차를 REQ/done_when에 규정 + **블로킹 재현율 REQ 추가**.
5. FORBID-6의 "임계 상수"에 0.75·0.92·0.98 명시적 열거.
6. 테이블·컬럼을 F2 실제 스키마와 정합화하거나 F2 변경을 선행 의존으로 명시. `traces_to` 정리.

---

## 6. C6-TAG-ASSIGN — REVISE

### 규격 위반
- `[구조] depends_on 이 존재하지 않는 태스크 참조` — `F4-TAG-ONTOLOGY`(실제 `F4-NEED-TAG-ONTOLOGY`). `blocks: W4-LANDING-GEN`(실제 `W4-COMBO-LANDING`), `parallel_with: W2-DISCOVERY-FILTER`(실제 `W2-DISCOVERY-LIST`), `W7-CORRECTION-FORM`(실제 `W7-CORRECTION-REQUEST`). **4건 오참조 — 배치 최다.**
- `traces_to` 의 `S2` 는 린캔버스 소재(PRD 미소재).

### LLM 환각 탐지 검증
**순환 논법은 아니다** — FORBID-1의 detect는 "LLM으로 LLM을 검증"이 아니라 `raw_text.substr(offset, len) === evidence.text` 라는 **결정론적 문자열 검증**이고, REQ-2가 이를 전수 불변식으로 못박았다. 여기까지는 이 배치에서 가장 견고한 설계다.
**그러나 이 탐지가 잡는 환각은 '완전 날조' 한 종류뿐이다.** 잡지 못하는 것:
1. **의미 반전** — 원문 "여성 전용 탈의실 **없음**", "주차 **불가**"에서 "여성 전용"·"주차"를 부분문자열로 인용하면 검증을 통과하고 women_only·parking 태그가 붙는다. 사용자는 필터를 믿고 헛걸음한다 — FORBID-1의 `because` 가 서술한 실패가 **탐지를 통과한 채** 발생한다.
2. **근거 적합성 부재** — evidence의 최소 길이·경계·태그와의 관계 요구가 없다. 2글자 부분문자열도 REQ-2를 만족한다.
3. **타 대상 귀속** — 같은 문서 안의 다른 업체·지점 설명 구간에서 인용해도 통과(FORBID-5는 프롬프트 조립만 규율).
그리고 detect의 "환각 mock 20건"을 **저자가 만든다** — '완전 날조' 유형만 넣으면 탐지는 설계상 100% 통과한다. **부정문·반전 표현 픽스처를 요구하는 조항이 없다.**

### 공격 결과
- **A 악의적 준수**: 룰 태거만으로 쉬운 태그를 붙이고 어려운 태그를 포기하면 precision 0.90은 쉽게 달성되나 **recall 0.70 하한이 degenerate 구현을 막는다**(C4와 달리 여기는 하한이 제대로 작동). 다만 두 지표 모두 저자 평가셋 300업체 기준이고 표집 절차 규정이 없다. 또 **결정성 요구가 없다** — C4 REQ-8·C5 REQ-7에는 재현성 REQ가 있는데 C6에는 없다(temperature=0은 done_when 한 줄일 뿐 acceptance 없음). 재실행마다 태그가 흔들려도 계약 위반이 아니고 W2 필터·W4 랜딩이 배포마다 바뀐다.
- **B 조건 회피 — FORBID-2의 `when` 이 지나치게 넓다**: "D4 금지표현 사전(**치료** / 완치 / 교정 효과…)에 매칭되면 태그 승격 금지". 그런데 3축 중 하나가 **`메디컬 웰니스` = 한의원·도수치료·영양수액**이고 PRD가 이 축을 유지하기로 확정했다. **"도수치료"라는 정식 업종명 자체가 '치료'에 매칭된다.** 이 조건대로면 메디컬 축의 근거 문구 대부분이 금지 매칭되어 태그가 대량 소실되고, 그 순간 개발자는 사전을 임의로 완화하거나 축을 포기한다 — 원칙 2가 경고한 "무조건 금지에 가까운 규칙이 현실 예외에서 깨지고, 깨지는 순간 다른 금지도 협상 대상이 된다"의 교과서적 사례.
- **C 탐지 무력화**: FORBID-5의 detect는 "생성된 프롬프트에서 대상 venue 소스 문자열과 **정적 템플릿**을 제외한 잔여 문자열이 0"인데 `must_not` 은 "few-shot 예시에 **실제 타 업체명**"을 금지한다. **few-shot을 정적 템플릿에 하드코딩하면 detect는 통과하고 must_not은 위반된다.** FORBID-3의 "응답 텍스트 대상 정규식 추출 함수 부재 grep"은 함수명 변경이나 다른 파싱 형태(split/관용 JSON 파서)로 무력화된다.
- **D 지름길 유도**: 임계 하향·평가셋 조작은 FORBID-6이 잠갔다. **남은 도피처: LLM 실패 시 `tagging_status='failed'` 로 두는 것이 계약상 완전히 합법**이라 실패율 상한이 없다. 전체의 90%가 failed여도 REQ-7 통과, recall은 평가셋에서만 측정되므로 **실데이터 실패율은 어디에도 측정되지 않는다.** 재처리 큐 적체 상한·알림도 없다.
- **E DAG 정합성**: `depends_on: [C5, F4]` DAG 일치, F4→D4 경로로 D4 가드레일에 전이 의존(C4와 대비), `blocks: [C7, W4]` 정상, 순환 없음. 다만 **out_of_scope("온톨로지는 읽기 전용 소비")와 FORBID-2 detect("온톨로지 태그 라벨/설명 전수를 금지표현 사전과 대조")가 충돌**한다 — F4 라벨이 사전에 걸리면 C6의 CI가 실패하는데 C6는 고칠 권한이 없다. C4·C5·C7이 F2에 대해 명시한 "작업 중단하고 변경 요청" 절차가 F4에 대해 누락됐다.
- **F 존재 이유**: `why`(필터·롱테일 랜딩) ↔ `traces_to: H5` 연결 타당. REQ-3/4가 H5의 전제(필터 신뢰도)를 직접 측정. 이 배치에서 존재 이유-요구사항 연결이 가장 명확한 계약.

### 필수 수정 사항
1. REQ-2에 **근거 적합성 조건**(evidence 최소 길이·문장 경계 정렬) + **부정/반전 표현 픽스처를 평가셋과 FORBID-1 detect에 필수 포함**(예: "주차 불가", "여성 전용 아님" 20건에서 태그 0건).
2. FORBID-2의 `when` 을 **업종명과 효능 주장을 구분**하도록 재작성(예: "금지표현이 *질환명 + 효능 동사* 패턴으로 결합되거나 태그 라벨/설명에 등장하는 경우") + D4 사전의 업종명 예외 목록 참조 명시.
3. FORBID-5의 detect에 **정적 템플릿 자체의 검사**(업체명 사전·타 venue 문자열 대조) 추가.
4. REQ 추가: **결정성**(동일 스냅샷 2회 실행 시 태그 집합 동일) 및 **실데이터 tagging_status='failed' 비율 상한**.
5. `depends_on`·`blocks`·`parallel_with` 4건 id 수정, out_of_scope에 F4 변경 요청 절차 추가.
6. `venue_need_tag` 에 assignment_method/confidence/model_id/prompt_hash 4개 컬럼이 F2에 없다 — REQ-6이 존재하지 않는 컬럼을 대상으로 한다. F2 정합화 필요.

---

## 7. C7-QUALITY-GATE — REJECT

### REJECT 사유 (3중)
1. **게이트의 실질이 계약에 없다.** `public_venue` 뷰의 **필터 조건**과 **공개 임계값**이 계약 어디에도 규정돼 있지 않다. "공개 판정"이라는 존재 이유의 핵심 두 개가 공란인 채 나머지 요구사항만 정교하다.
2. **하류 태스크와 논리적으로 양립 불가.** REQ-1은 "`is_public` 에 쓰기를 수행하는 코드 경로가 **정확히 1개**"이고 detect는 "그 외 0건"이다. 그런데 C7이 blocks로 지정한 O2(실제 id `O2-REVIEW-ADMIN`)의 REQ-4는 **"서로 다른 2인 승인 시 `is_public=true`"** 를 요구한다. **C7의 REQ-1을 지키면 O2가 구현 불가능하고, O2를 구현하면 C7의 CI가 깨진다.** C7 FORBID-6은 예외를 "O2 수동 오버라이드로만 처리"라고 스스로 인정하면서 REQ-1은 그 경로를 금지한다.
3. **집행 대상 스키마 객체가 존재하지 않는다.** F2 REQ-5가 정의한 것은 `venue.visibility ENUM('public','hidden_quality','hidden_request','hidden_legal')`, DEFAULT `'hidden_quality'` 다. **`is_public` 컬럼도, `canonical_venue`·`venue_price`·`venue_tag` 테이블도 F2에 없다.** 따라서 REQ-1의 grep은 매칭 0건으로 **공허하게 통과**하고(코드는 visibility에 쓴다), REQ-3의 3개 테이블 COUNT 검증과 FORBID-1의 base 테이블명 검사도 대상이 틀렸다. 또 F2의 `hidden_request`(W7 정정요청)·`hidden_legal` 상태는 C7의 reason_code enum에도 단일 판정 함수 모델에도 자리가 없다 — **비공개 사유가 품질 외에도 존재한다는 사실 자체가 설계에서 빠졌다.**

이 셋은 문구 교정이 아니라 **C7/F2/O2 3자 재조정**을 요구하므로 REVISE 범위를 넘는다.

### 규격 위반
- `[구조] blocks/out_of_scope 가 존재하지 않는 태스크 참조` — `O2-DATA-ADMIN`(실제 `O2-REVIEW-ADMIN`), `O1-METRIC-DASHBOARD`(실제 `O1-METRICS-DASHBOARD`), `W4-LANDING-GEN`(실제 `W4-COMBO-LANDING`).
- `[구조] traces_to 미선언 ID` — `KM-price-coverage`.
- `[요구사항] acceptance 가 기계 검증 불가` — REQ-1의 acceptance는 grep 기반이며 위 3번 이유로 **위반 시에도 통과**한다.

### 공격 결과
- **A 악의적 준수**: `packages/db/views/public_venue.sql` 을 `SELECT * FROM venue;` 로 작성해도 **REQ-1~7과 FORBID-1~6이 전부 통과한다.** 계약 어디에도 "뷰는 is_public=true(또는 visibility='public') 인 행만 노출한다"는 요구가 없고 뷰가 노출하는 **컬럼 화이트리스트**도 없다. FORBID-1은 "웹이 뷰만 조회"하도록 강제하지만 **그 뷰가 무엇을 담는지는 아무도 규정하지 않았다.** 설계 전제 §2("우회로가 없어야 한다")가 자기 계약에 의해 배신된다.
 두 번째: **공개 임계값이 계약에 없다.** REQ-2는 "스코어 0~100 정수, 가중치는 단일 설정 파일, 골든 30건 스코어 기대값 고정"만 요구하고 임계값은 REQ-6의 `--threshold=<N>` 인자에만 등장한다. **임계를 0으로 두면 전량 공개되고 골든 30건 스코어 테스트는 그대로 녹색이다.** 그리고 C4·C5·C6에 모두 있는 **"임계를 낮추지 마라" FORBID가 C7에는 없다.**
- **B 조건 회피**: FORBID-1의 `when` 이 "**웹(apps/web) 또는 공용 API 레이어 코드**가 조회할 때"로 한정돼 있다. 비껴가는 실체가 존재한다 — **W4의 빌드타임 정적 생성기**, W1의 sitemap/JSON-LD 생성, 배치 스크립트, O1 대시보드. (W4는 자체 FORBID로 우연히 막혔을 뿐 C7이 건 방어가 아니다.) 게이트의 `when` 은 **데이터가 공개면에 도달하는 모든 경로**여야 한다.
- **C 탐지 무력화**: FORBID-1의 detect는 "base 테이블명 **문자열** 참조 검사"다. Prisma/ORM은 `prisma.canonicalVenue.findMany()` 처럼 **camelCase 모델명**을 쓰므로 스네이크케이스 grep에 걸리지 않는다. 두 번째 수단인 "web 롤의 base 테이블 SELECT 권한 오류"는 실효적이지만 **DB 롤 분리를 만드는 태스크가 지정돼 있지 않다**(F2 touches에도 GRANT/ROLE 없음) — 존재하지 않는 인프라에 기댄 탐지. REQ-1의 grep은 REJECT 3번대로 공허. FORBID-2의 "quality 모듈 내 DELETE/TRUNCATE grep"은 모듈 밖 마이그레이션·잡에서의 삭제를 못 잡는다.
- **D 지름길 유도**: ① **임계 하향**(무방비), ② **가중치 설정 파일 조정**(REQ-2의 골든 기대값이 부분 방어하나 그 기대값 파일 자체에 라벨 게이트가 없다), ③ 뷰 필터 완화(무방비). 특정 업체 화이트리스트는 FORBID-6이 잘 막았다.
- **E DAG 정합성**: §8의 게이트 우회 경로 6건 참조.
- **F 존재 이유**: `traces_to: [H1, H4, KM-price-coverage]` 중 **H4(가격 비교 블록 노출 코호트 전환율)는 C7이 검증하지 않는다** — H4는 W3·W6가 측정한다. `why` 에도 H4 언급이 없다. 장식 참조. H1과 G4 집행은 타당.

### 필수 수정 사항
1. **REQ 신설 — 뷰 정의의 불변식**: 뷰는 (a) 공개 판정을 통과한 행만 노출, (b) 컬럼 화이트리스트 보유, (c) is_public=false 픽스처 N건이 뷰 조회 결과 0건임을 통합테스트로 검증.
2. **REQ 신설 — 공개 임계값의 계약화**: 기본 임계값을 계약에 수치로 명시하고 소스에 하드코딩, 근거(G4 목표 커버리지) 병기. **FORBID 신설 — 임계·가중치·골든 기대값 파일 diff에 승인 라벨 게이트.** forbid 6개 상한에 걸리므로 FORBID-2와 FORBID-3을 통합해 자리를 만들 것.
3. **REQ-1과 O2의 모순 해소**: 판정 결과(C7 소유)와 오버라이드(O2 소유)를 분리 저장소로 규정하고, 최종 공개 상태는 뷰가 두 값을 결합해 산출. "쓰기 경로 1개"는 *판정 컬럼*에 한정.
4. **F2 정합화**: `is_public` 대신 `venue.visibility` ENUM 4값 사용으로 전면 재작성, `hidden_request`(W7)·`hidden_legal`(D4) 상태와 reason_code enum의 대응 규정.
5. FORBID-1의 `when` 을 "공개면에 데이터를 도달시키는 모든 코드"로 확대, detect를 ORM 모델명·생성 클라이언트까지 포괄하도록 보강 + **DB 롤 분리의 소유 태스크 지정**.
6. **DAG 수정**: `W4-COMBO-LANDING` 을 C7의 blocks로 이동(또는 W4의 depends_on에 C7 추가).
7. blocks/out_of_scope/traces_to id 오참조 4건 수정.

---

## 8. 게이트 우회 경로 6개 (C7 교차 대조 결과)

```
경로1: C7-QUALITY-GATE → public_venue 뷰를 필터 없이 정의할 때 → 계약이 뷰의 WHERE 조건을
       규정하지 않아 SELECT * FROM venue 로도 REQ-1~7·FORBID-1~6이 전부 통과한다
결과: is_public=false 판정을 받은 전량이 웹·API에 그대로 노출. 판정 함수는 정상 동작하고
       reason_codes도 정확히 기록되는데 게이트만 존재하지 않는다
수정: C7 REQ 신설 — "뷰는 판정 통과 행만·컬럼 화이트리스트 보유, is_public=false 픽스처 N건이
       뷰 조회 결과 0건" 을 통합테스트 acceptance로
```
```
경로2: C7-QUALITY-GATE → 공개 임계값을 낮게(또는 0으로) 설정할 때 → 임계값이 계약에 없다.
       REQ-6의 --threshold=<N> 인자에만 등장하고 임계 하향 금지 FORBID도 없다
결과: 스코어 0점 업체까지 전량 공개. REQ-2의 골든 30건 스코어 기대값 테스트는 스코어만 보므로
       그대로 녹색이고, 개발 에이전트가 막혔을 때의 최단 지름길이 무방비다
수정: C7 REQ-2에 기본 임계값을 수치로 하드코딩 + FORBID 신설(임계·가중치·골든 기대값 diff에
       승인 라벨 게이트, C4 FORBID-6 동형)
```
```
경로3: O2-REVIEW-ADMIN → 2인 승인으로 공개 전환할 때 → C7 REQ-1(is_public 쓰기 경로 정확히 1개)과
       O2 REQ-4(2인 승인 시 is_public=true)가 논리적으로 양립 불가
결과: 구현은 셋 중 하나로 귀결 — ① C7 grep 검사 무력화(제외 경로 추가), ② O2가 판정 컬럼 직접
       덮어쓰기, ③ O2 기능 삭제. ①②는 게이트 우회를 CI가 승인하는 상태다
수정: C7 REQ-1을 "판정 컬럼 쓰기 경로 1개"로 한정하고 오버라이드는 별도 레이어(O2 소유)에 기록해
       뷰가 판정+오버라이드를 결합해 산출하도록 명시
```
```
경로4: W4-COMBO-LANDING → 조합 랜딩을 정적 생성할 때 → W4.depends_on=[W1,C4,C6]에 C7이 없고
       배치 B6에서 C7과 동시 실행된다. 게이트 판정이 존재하기 전에 데이터 접근 코드가 작성된다
결과: 미판정 데이터로 롱테일 랜딩이 빌드되어 색인까지 간다. 색인된 저품질 페이지는 뒤늦게
       비공개로 돌려도 검색 캐시에 남는다
수정: C7 blocks에 W4-COMBO-LANDING 추가(또는 W4 depends_on에 C7) + DAG 배치 B6에서 분리
```
```
경로5: C4-PRICE-NORMALIZER → medical 레코드의 public_price_display를 기록할 때 → 공개용 표시 필드를
       게이트 앞단인 C4가 직접 쓴다. C7의 "판정 코드 1개" 원칙 밖에서 공개 필드가 채워진다
결과: 공개 필드의 값과 공개 여부의 판정이 서로 다른 태스크에 있어 어느 필드가 게이트를 거쳤는지
       추적 불가. C4 FORBID-5가 실패해도 C7 FORBID-5와 중복 방어처럼 보여 둘 다 느슨해진다
수정: C4 FORBID-5에서 public 접두 필드 기록을 삭제하고 C7로 이관, C4 out_of_scope에 명시
```
```
경로6: apps/web · API 레이어 → ORM으로 base 테이블을 조회할 때 → C7 FORBID-1의 detect가 테이블명
       문자열 grep이라 Prisma의 prisma.canonicalVenue(camelCase)에 걸리지 않는다
결과: 뷰를 우회한 화면이 하나 생기고 그 화면에서만 비공개 업체가 노출된다. 보조 탐지인 "web 롤
       권한 오류" 검증은 DB 롤 분리를 만드는 태스크가 어디에도 없어 실행 불가다
수정: C7 FORBID-1 — when을 공개면 도달 전 경로 전체로 확대, detect에 ORM 모델명·생성 클라이언트
       포함, DB 롤 분리의 소유 태스크 지정
```

---

## 9. medical_wellness 조건부 FORBID 분포

**걸린 곳**: C4 FORBID-5 · C5 FORBID-5 · C6 FORBID-2 · C7 FORBID-5 — 후반 4건은 일관되게 존재. 특히 C7 FORBID-5의 "품질 스코어가 임계를 넘더라도 is_public=true 금지"라는 **점수로 상쇄 불가한 하드 블록**은 이 배치에서 가장 잘 설계된 조항이다.

**누락**: **C1 · C2 · C3.** C2·C3는 done_when에서 메디컬 축 픽스처를 12건/9건 이상 요구하며(즉 그 축을 명시적으로 수집하며) 해당 축의 조건부 금지가 0건이다. "원문 verbatim 보관이라 광고 주체가 되지 않는다"는 논리는 성립하나 **계약에 적혀 있지 않아 판단이 아니라 누락으로 보인다.**
→ C2·C3 out_of_scope에 "의료광고법 표기 규율은 C4·C7이 집행, 어댑터는 원문 보존만" 명시.

**추가 충돌 — G1 축별 차등 판정**: PRD는 "<25% 축은 해당 축 MVP 제외"인데 **C2·C3·C4·C5·C6이 3축 균등 픽스처를 done_when에 하드코딩**했다. G1이 메디컬 축을 탈락시키면 **완료 조건이 게이트 결과와 모순**된다. 게이트 결과를 계약이 소비하는 방식(축 목록을 설정으로 주입)이 어느 계약에도 없다.

---

## 10. 체계적 결함 패턴

### P1. 픽스처 세계에서만 참 — C1~C6 전부 (최대 위험)
실데이터·실네트워크에 대한 하한이 어느 계약에도 없다. 크롤러 0건 수집(C1) · 어댑터 가격 0건 추출(C2·C3) · 파서 회당가 0건 산출(C4) · 태거 90% failed(C6, `tagging_status='failed'` 는 계약상 완전 합법이고 실패율 상한이 없다) → **7건의 CI가 전부 녹색이고 그 위에서 G1·G4 판정이 내려진다.** Phase 2 전체가 "동작하지만 아무것도 만들어내지 않는" 상태를 계약상 허용한다.
→ C1 실수집 스모크 REQ / C2·C3 가격 원문 추출 재현율 REQ / C6 실데이터 실패율 상한 REQ 추가.

### P2. 자기 출제·자기 채점 — 6건
C2(픽스처 40+15) · C3(30+12) · C4(골든 200+정답 라벨) · C5(평가셋 300쌍) · C6(평가셋 300업체) — **모든 품질 임계가 피검자가 만든 데이터 위에서 측정**되고, 표집 절차·홀드아웃을 규정한 계약이 0건이다. 이 상태에서 C4·C5·C6의 FORBID-6(임계·픽스처 잠금)은 **자기가 고른 쉬운 시험지를 봉인하는 장치**로 작동한다.
→ 02-spec §2에 "평가 데이터의 표집 절차 명시 + 홀드아웃 분리"를 필수 항목으로 추가(개별 태스크 수정으로는 재발한다).

### P3. F2 스키마와 전면 불일치 — C4·C5·C6·C7 (전달 전 차단 필요)
F2 실제 정의는 7테이블(`venue / price_plan / need_tag / venue_need_tag / editor_report / lead_event / source_record`) + `venue.visibility` ENUM(DEFAULT `hidden_quality`). 그러나 파이프라인 4건은 `canonical_venue`·`venue_source_record`·`venue_price`·`venue_tag`·`merge_candidate`·`is_public`·`price_per_month_krw`·`public_price_display`·`prompt_hash` 등 **F2에 존재하지 않는 객체 위에 요구사항과 탐지를 세웠다.**
- 각 계약 out_of_scope가 "없으면 작업 중단하고 F2 변경 요청"이므로 → **현행대로 전달하면 C4·C5·C6·C7이 착수 즉시 동시 블로커.**
- 더 위험: **grep 기반 detect가 대상 부재로 공허하게 통과**한다. C5 FORBID-3(`DELETE FROM venue_source_record`)·C7 REQ-1(`is_public` grep)은 코드가 실제로는 `visibility` 에 쓰므로 **위반해도 녹색.**
→ 전달 전 F2 정합화 라운드 1회.

### P4. 태스크 ID 오참조 — 6건 12개소
`D3-SOURCE-DILIGENCE`(정: `D3-SOURCE-DUE-DILIGENCE`) · `F4-TAG-ONTOLOGY`(정: `F4-NEED-TAG-ONTOLOGY`) · `W4-LANDING-GEN`(정: `W4-COMBO-LANDING`) · `O2-DATA-ADMIN`(정: `O2-REVIEW-ADMIN`) · `W2-DISCOVERY-FILTER`(정: `W2-DISCOVERY-LIST`) · `W7-CORRECTION-FORM`(정: `W7-CORRECTION-REQUEST`) · `O1-METRIC-DASHBOARD`(정: `O1-METRICS-DASHBOARD`). 저자들이 DAG 문서의 축약 표기를 보고 id를 추정한 것으로 보인다. **DAG 자동 검증이 성립하지 않으므로 게이트 선행 검사도 자동화할 수 없다.** 부수적으로 `gate` 필드도 C1·C2·C3는 스칼라(`G1, G3`), C4~C7은 리스트(`[G1, G3]`)로 갈렸고, `traces_to` 는 PRD(H1~H7)·린캔버스(S1~S5)·미선언(`KM-price-coverage`) 3개 원장을 섞어 쓴다.

---

## 11. 최종 판단 — 계약 수정으로 막히는가, 분할을 다시 해야 하는가

**대부분은 계약 수정으로 막힌다. 그러나 두 군데는 분할 자체를 다시 그어야 한다.**

### 계약 수정으로 닫히는 것
- C1·C2·C5·C6의 전 결함 — REQ 추가, FORBID의 when 재작성, detect 보강, id 수정으로 해결된다.
- C4의 REQ-1/REQ-2/골든셋/의존 누락 — 조항 수정 범위.
- 게이트 우회 경로 1·2·4·6 — 조항 추가와 의존선 수정으로 닫힌다.
- P1·P2·P4 — 각 계약에 REQ를 더하고 spec에 항목을 추가하면 재발이 막힌다.

### 분할을 다시 해야 하는 것 (2건)
**(1) C3 — 소스별 태스크로 분해.** 산출물 개수가 D3 결과에 따라 변동하고, rollback이 이미 소스 단위 분리를 전제한다. 계약 문구로는 PR 1개 원칙을 회복할 수 없다.

**(2) C7 — "품질 판정"과 "공개면 계약"의 분리.** 게이트 우회 6경로의 **공통 원인은 하나다: `공개면(public surface)의 소유자`가 어느 태스크에도 없다.** C7은 *판정*만 소유하고, 뷰의 내용(경로1)·공개 필드(경로5)·소비 경로(경로4·6)·오버라이드 결합(경로3)은 C4·W4·O2·apps/web에 흩어져 있다. 이건 C7 계약 안의 문구로 메울 수 없다. 지금 상태의 C7은 리뷰어에게 두 종류의 전문성(스코어링 vs DB 접근 경계·권한)을 요구하고, 되돌릴 때 판정만 되돌리고 싶어진다 — 02-spec §4의 분할 신호 두 개에 정확히 해당한다.
→ `C7a` 품질 스코어링·판정 함수·사유 코드 / `C7b` 공개면 계약(public_venue 뷰 스키마 + 접근 경계 + DB 롤 + 오버라이드 결합 규약)으로 분리하고, C7b가 W4·W3·O2의 선행이 되도록 DAG를 다시 긋는다.

### 전달 전 선결 조건
위 분할과 별개로, **F2 정합화 라운드(P3)를 먼저 돌리지 않으면 C4·C5·C6·C7의 detect 상당수가 대상 부재로 공허하게 통과**한다. 탐지가 공허한 상태로 개발 에이전트에게 넘기면 감사를 한 의미가 없다. 이것이 이 배치에서 가장 먼저 처리해야 할 항목이다.
