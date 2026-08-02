# C1~C7 감사 보고 (Phase 2 파이프라인) — task-auditor

> 대상: docs/tasks/C1.md ~ C7.md (7건) · 대조: 02-task-contract-spec.md §5 / 01-prd.md / 03-task-dag.md / 00-lean-canvas.md
> 교차 대조: F2 · D3 · D4 · F4 · W3 · W4 · O2
> 계약 파일은 수정하지 않았다.

## 1. 판정

| 태스크 | 판정 | 사유 |
|---|---|---|
| C1 | REVISE | 실제 수집 하한 0건 — 크롤러가 아무것도 못 모아도 전 계약 녹색 |
| C2 | REVISE | 가격 원문 추출 요구가 계약에 없음 — 가격 0건 수집으로 REQ 전부 통과 |
| C3 | **REJECT** | 산출물 개수가 D3 결과에 따라 결정 → PR 1개 원칙을 계약 시점에 보장 불가 |
| C4 | REVISE | REQ-1이 회당 단가 환산율을 측정하지 않음 (§3) |
| C5 | REVISE | 비대칭 설계는 진짜. 단 전 지표가 쌍 단위라 전이 병합이 무방비 |
| C6 | REVISE | 환각 탐지가 '완전 날조'만 잡고 '의미 반전'을 못 잡음 |
| C7 | **REJECT** | 뷰 필터·공개 임계값이 계약에 없어 게이트의 실질이 공란 (§2) |

## 2. C7 게이트 우회 경로 (실재 6건)

1. **뷰 필터 조건 부재** — `public_venue` 를 `SELECT * FROM venue;` 로 만들어도 REQ-1~7·FORBID-1~6 전부 통과. 판정 함수는 완벽히 돌지만 뷰가 무시하면 G4는 없다.
   → C7 REQ 신설: 뷰는 판정 통과 행만·컬럼 화이트리스트, is_public=false 픽스처가 뷰 조회 0건임을 통합테스트로 검증.
2. **공개 임계값이 계약에 없음** — 임계는 REQ-6의 `--threshold=<N>` 인자에만 등장. 임계 0이면 전량 공개인데 골든 30건 테스트는 녹색. C4·C5·C6엔 다 있는 "임계 하향 금지" FORBID가 G4 집행자인 C7에만 없다.
   → C7 REQ-2에 기본 임계 수치 명시 + 임계·가중치·골든 diff 승인 라벨 FORBID 신설.
3. **REQ-1이 O2와 양립 불가** — C7 REQ-1("is_public 쓰기 경로 정확히 1개") vs O2-REVIEW-ADMIN REQ-4("2인 승인 시 is_public=true"). 한쪽을 지키면 다른 쪽이 구현 불가.
   → C7 REQ-1: 판정 컬럼(C7)과 오버라이드 레이어(O2)를 분리 저장, 최종 상태는 뷰가 결합해 산출.
4. **W4가 C7에 의존하지 않음** — `W4.depends_on=[W1,C4,C6]`, 배치 B6에서 C7과 동시 실행 → 정적 랜딩이 게이트 이전 데이터로 생성 가능.
   → C7 blocks에 W4-COMBO-LANDING 추가(또는 W4 depends_on에 C7).
5. **C4가 공개 필드를 게이트 앞단에서 기록** — FORBID-5의 `public_price_display` 를 C4가 쓴다. 공개 필드 소유가 C4/C7/W3에 분산.
   → C4 FORBID-5: public 접두 필드 기록을 C7로 이관.
6. **탐지 공허** — FORBID-1 detect는 테이블명 문자열 grep인데 Prisma는 `prisma.canonicalVenue`(camelCase)라 안 걸리고, 보조 수단인 DB 롤 분리는 만드는 태스크가 없다.
   → detect를 ORM 모델명까지 포괄 + 롤 분리 소유 태스크 지정. when을 "공개면에 데이터를 도달시키는 모든 코드(정적 생성기·sitemap·배치 export)"로 확대.

## 3. C4 악의적 준수 구멍

**핵심**: REQ-1은 "unit_type이 unparseable이 **아닌** 비율 ≥80%"이고 unit_type은 4값(per_session/period_pass/single_session/unparseable)이다. 애매한 입력을 전부 single_session·period_pass로 분류하면 → REQ-1 통과, price_per_session이 없으니 **REQ-2 mismatch 0**, REQ-3~8 통과, FORBID-1~4 전부 무해 통과.
**결과: 회당 단가를 한 건도 산출하지 않는 파서가 계약을 100% 준수한다.** 전량 unparseable은 막혔지만 한 칸 옆이 열려 있다. H2와 UVP가 계약상 보호되지 않는다.
→ C4 REQ-1을 `per_session` 산출률 하한(회차 정보가 있는 라벨 케이스 대비, 축별 하한 별도)으로 교체.

부수 구멍:
- `single_session` 정의가 계약 전체에 없음 → 최대 도피처. → 4개 unit_type 판정 기준 정의 추가.
- REQ-2가 price_per_session만 검증 → price_per_month_krw·period_days가 전부 틀려도 CI 녹색. → REQ-2를 전 unit_type으로 확대.
- 골든 200건+정답 라벨을 저자가 만들고 FORBID-6이 동결 → 쉬운 시험지 봉인, 홀드아웃 없어 과적합 무탐지. → 표집 절차 REQ화 + 홀드아웃 분리.
- **두 축이 실제로는 섞인다**: FORBID-2·3의 detect가 의존하는 "비교 대상 쿼리 헬퍼"·"representative_price 선정 함수"가 C4 산출물에 없다(후자는 out_of_scope "대표값 선택은 C7"과 정면 충돌). 게다가 **C7 REQ-7이 두 축을 합산**("price_per_session 또는 price_per_month_krw")해 G4 커버리지가 기간권으로 부풀려진다.
  → C7 REQ-7 축별 분리 산출 + C4 FORBID-2·3 detect를 레코드 수준 불변식으로 재작성.
- **D4 의존 누락**: FORBID-5가 D4 허용 포맷 화이트리스트에 의존하는데 C4는 D4에 어떤 경로로도 닿지 않는다(C6·C7은 F4→D4 전이 의존 존재).
  → C4 depends_on에 D4-MEDICAL-AD-GUARDRAIL 추가.

## 4. medical_wellness 조건부 FORBID 누락

걸린 곳: C4 FORBID-5 · C5 FORBID-5 · C6 FORBID-2 · C7 FORBID-5 — 후반 4건은 일관. 특히 C7 FORBID-5의 "점수로 상쇄 불가한 하드 블록"은 이 배치 최고 조항.
**누락: C1·C2·C3.** C2·C3는 done_when에서 메디컬 축 픽스처 12건/9건 이상을 요구하며 그 축을 명시적으로 수집하면서, 해당 축 조건부 금지가 0건이다.
→ C2·C3 out_of_scope에 "의료광고법 표기 규율은 C4·C7이 집행, 어댑터는 원문 보존만" 명시.

추가 충돌 — G1 축별 차등 판정: PRD는 "<25% 축은 MVP 제외"인데 C2·C3·C4·C5·C6이 3축 균등 픽스처를 done_when에 하드코딩했다. G1이 한 축을 탈락시키면 완료 조건이 게이트 결과와 모순된다.
→ 5건 done_when: 축 목록을 G1 판정 결과에서 설정으로 주입받도록 기술.

## 5. 체계적 결함 패턴

- **P1. 픽스처 세계에서만 참 (C1~C6 전부, 최대 위험)** — 실데이터·실네트워크 하한이 어느 계약에도 없다. 크롤러 0건 수집·어댑터 가격 0건 추출·파서 회당가 0건 산출·태거 90% failed(tagging_status='failed'는 계약상 합법이며 실패율 상한 없음)여도 7건 CI가 전부 녹색이고 그 위에서 G1·G4 판정이 내려진다.
  → C1 실수집 스모크 REQ / C2·C3 가격 원문 추출 재현율 REQ / C6 실데이터 실패율 상한 REQ 추가.
- **P2. 자기 출제·자기 채점 (6건)** — C2(40+15)·C3(30+12)·C4(골든 200+정답 라벨)·C5(300쌍)·C6(300업체)의 모든 품질 임계가 피검자가 만든 데이터 위에서 측정되고, 표집 절차·홀드아웃 규정이 0건. 이 상태에서 FORBID-6(임계·픽스처 잠금)은 쉬운 시험지를 봉인하는 장치가 된다.
  → 02-spec §2에 "평가 데이터의 표집 절차 명시 + 홀드아웃 분리"를 필수 항목으로 추가(개별 태스크 수정으로는 재발).
- **P3. F2 스키마 전면 불일치 (C4·C5·C6·C7 — 전달 전 차단 필요)** — F2 실제 정의는 7테이블(venue/price_plan/need_tag/venue_need_tag/editor_report/lead_event/source_record) + venue.visibility ENUM(DEFAULT hidden_quality). 그러나 4건은 canonical_venue·venue_source_record·venue_price·venue_tag·merge_candidate·is_public·price_per_month_krw·public_price_display·prompt_hash 등 F2에 없는 객체 위에 요구사항과 탐지를 세웠다. out_of_scope 규정상 착수 즉시 4건 동시 블로커이며, 더 위험한 것은 **grep 기반 detect가 대상 부재로 공허하게 통과**한다는 점이다(C5 FORBID-3, C7 REQ-1 — 코드는 visibility에 쓰므로 위반해도 녹색).
  → 전달 전 F2 정합화 라운드 1회.
- **P4. 태스크 ID 오참조 (6건 12개소)** — D3-SOURCE-DILIGENCE(정: D3-SOURCE-DUE-DILIGENCE) / F4-TAG-ONTOLOGY(정: F4-NEED-TAG-ONTOLOGY) / W4-LANDING-GEN(정: W4-COMBO-LANDING) / O2-DATA-ADMIN(정: O2-REVIEW-ADMIN) / W2-DISCOVERY-FILTER(정: W2-DISCOVERY-LIST) / W7-CORRECTION-FORM(정: W7-CORRECTION-REQUEST) / O1-METRIC-DASHBOARD(정: O1-METRICS-DASHBOARD). DAG 자동 검증이 성립하지 않아 게이트 선행 검사를 자동화할 수 없다.
  → 03-task-dag.md에 정식 id 컬럼 추가 + 7건 참조 수정.

## 6. 그 외 제품이 깨지는 지점

- **C5 전이 병합** — 전 지표가 쌍 단위. A~B 0.93, B~C 0.93, A~C 0.40이면 쌍 위반 0건으로 3개 업체가 한 canonical로 뭉친다. FORBID-4는 쌍 조건이라 중간 노드 경유를 못 막는다.
  → 클러스터 불변식 REQ 추가(클러스터 내 전 쌍 ≥0.92 완전 연결, 또는 크기 상한 초과 시 검수 큐 이관).
- **C5 FORBID-5 협소** — when이 "두 레코드의 category가 medical_wellness" → 한쪽만 medical인 오분류 쌍이 통과. → "하나 이상"으로 확대.
- **C6 의미 반전 환각** — "여성 전용 탈의실 없음"에서 "여성 전용"을 인용하면 substring 검증을 통과해 women_only가 붙는다. FORBID-1의 because가 서술한 실패가 탐지를 통과한 채 발생. (탐지 자체는 순환 논법이 아니라 결정론적 검증이며, 잡는 범위가 '완전 날조' 한 종류뿐인 것이 문제.)
  → REQ-2에 evidence 최소 길이·문장 경계 요구 + 부정/반전 표현 픽스처 20건 필수화.
- **C6 FORBID-2가 깨질 예정** — 금지표현 사전의 "치료"가 정식 업종명 "도수치료"(메디컬 웰니스 축)와 충돌 → 태그 대량 소실 → 사전 임의 완화(원칙 2 붕괴).
  → when을 "질환명+효능 동사 결합" 패턴으로 재작성 + 업종명 예외 목록 참조.
- **C6 FORBID-5 우회** — must_not은 few-shot의 타 업체명을 금지하나 detect는 "정적 템플릿 제외 잔여 0"이라 템플릿 하드코딩 시 통과.
  → detect에 템플릿 자체의 업체명 사전 대조 추가.
- **C2/C3 등록 지점 공백** — C3 REQ-1은 레지스트리 등록을 요구하나 레지스트리 소유 태스크가 없다. core/에 있으면 C2 FORBID-6·C3 FORBID-5가 그 파일 수정을 금지 → 양쪽 다 등록 불가(touches 문자열 자체는 충돌 없음).
  → C1이 레지스트리를 소유하고 공용 파일 수정 없는 등록 방식(엔트리포인트)을 명시.
- **C1 원문 삭제 무조건 금지** — FORBID-6 + rollback "어떤 경우에도 삭제 없음"인데 body에 리뷰어 개인정보가 포함된다(C2 REQ-6가 그 증거). 파기 요구(W7/S5)에 응할 수 없고, 규칙은 첫 요구 때 깨진다.
  → 파기 요구·법적 명령 한정 조건부 예외를 규칙 안으로 편입.
- **C1 allowlist 상한 완화 무방비** — FORBID-3은 초과 오버라이드만 막고 allowlist 값 자체를 올리는 변경엔 detect가 없다.
  → allowlist diff에 d3-change-approved 라벨 게이트.
