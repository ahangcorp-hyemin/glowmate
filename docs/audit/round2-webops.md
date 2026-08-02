# 2차 감사 — W1~W9 · O1~O3 (12건) · task-auditor

> 대상: `docs/tasks/W1.md`~`W9.md`, `O1.md`~`O3.md`
> 대조 정본: `02-task-contract-spec.md`(원칙 2.5 · R-6 · R-7 · detect 대상 실재성 포함) · `01-prd.md` · `03-task-dag.md`
> 교차 대조 계약(읽고 대조함): `F1` · `F2a` · `F2b` · `F4` · `F5` · `F6` · `C4` · `C6` · `C7` · `D4` · `00-lean-canvas.md`
> 1차 원본: `docs/audit/W1-O3-audit.md`
> **계약 파일은 수정하지 않았다. 본 보고서는 `docs/audit/` 안에만 기록한다.**
> ID·DAG 기계 정합성(`scripts/tasks_manifest.py` 통과분)은 재검하지 않았다. 아래 DAG 지적은 전부 **의미론적**(누락 의존·소유권 공백·게이트 역행)이다.

---

## 0. 판정 요약

| 태스크 | 1차 | 2차 | 한 줄 사유 |
|---|---|---|---|
| W1-SEO-FOUNDATION | REVISE | **REVISE** | `revalidate ≤3600`·무효화 엔드포인트는 해소 ✓ / 그러나 **무효화 호출자가 C7↔W1 상호 위임으로 공백**, D4 사전 경로 부재, `needs_review` 미커버 |
| W2-DISCOVERY-LIST | REVISE | **REVISE** | REQ-7이 `0==0`으로 vacuous 충족(가격 0건 리스트 합법) · F4 `filter_visible` 충돌 미해소 · D4 경로 부재 |
| W3-VENUE-DETAIL | REVISE | **REVISE** | 공개판정 FORBID 신설 ✓(최우선 지적 해소) / **REQ-1이 F6 FORBID-4와 정면 충돌** · REQ-3 detect 여전히 속성 검사 |
| W4-COMBO-LANDING | REJECT | **REVISE** | C7 의존·전수 중복검사·재검증 해소 ✓ / **결과집합의 태그 보유 검증 여전히 0** → doorway 경로 잔존, G4 색인 안전장치가 O3 자동배포와 충돌 |
| W5-EDITOR-REPORT | REVISE | **REVISE** | **REQ-8(실콘텐츠 5건) ↔ out_of_scope(콘텐츠 생산 금지) 데드락** · REQ-6(c)가 W1 REQ-8과 sitemap 총계 충돌 · `category_axis` 부재 |
| W6-LEAD-TRACKING | REVISE | **REVISE** | 분모·식별자 W9 이관 ✓ / **`lead_event` 화이트리스트에 `action_type`·`price_block_seen` 부재** · 알림 룰 소유자 공백 · H6 미기여 |
| W7-CORRECTION-REQUEST | REVISE | **REVISE** | **`correction_request` 테이블이 F2a·F2b 어디에도 없다** · 폼 도달 경로 미해소 · 접수 API의 DB 쓰기 경로가 F5 경계로 차단 |
| W8-CORRECTION-PROCESSING | (신규) | **REVISE (착수 차단 1순위)** | **`venue_suppression`이 `public_venue` 뷰에 결합되지 않아 REQ-2 달성 불가** + C7 REQ-4와 정면 충돌 → **takedown 실행 주체가 여전히 없다** |
| W9-OBSERVABILITY-EVENTS | (신규) | **REVISE** | H7 해소 ✓ / **`price_block_present` 기대값 검증 0 → H4 코호트를 상수로 채워도 전 CI 녹색** · 이벤트 스키마가 F2b 화이트리스트에 부재 · H5 분모 미정의 |
| O1-METRICS-DASHBOARD | REJECT | **REJECT** | 임계 정본 `docs/metrics/registry.yaml`이 **계획 어디에도 없고 F1이 창설을 명시 금지** · `gate: G4` 존재 이유 역행 미해소 · 커버리지 분모를 C7(공개 업체)에 위임해 G1이 구조적으로 통과 |
| O2-REVIEW-ADMIN | REJECT | **REVISE** | C7 충돌·2인 승인 확대 해소 ✓ / `gate: G4` 역행 미해소 · **"수정" 액션의 저장 레이어가 스키마에 부재** · `review_audit_log` 부재 |
| O3-DEPLOY-MONITORING | REVISE | **REVISE** | 메트릭 실존 검사·데드맨·순환 차단 ✓ / **메트릭 저장소 소유자 부재** · W6~W9 룰이 orphan(수신 계약의 touches가 `ops/alerts`를 금지) → **W7 방치 자동 탐지 여전히 0** |

**PASS 0건.** 공격 A~F를 12건 전부에 수행했고, 전 건에서 유효한 결함이 남아 있다.

---

## 1. 1차 착수 차단 결함 4건 — 해소 여부 판정

### ① `price_plan.confidence` 생산자 — **해소 ✓**

`C4.md` REQ-6이 생산자다. 감점 규칙표(기준 0.95, 5요인, 하한 0.10)가 계약 본문에 수치로 못박혀 있고, acceptance (b)가 **`confidence = 1.00` 인 행 0건**을, (c)가 `is_promotional` 행의 `≤0.60`을 강제한다. 공급 측 `F2b` FORBID-3이 `NOT NULL`·`DEFAULT(1.0 포함)`를 스키마에서 금지하고, 소비 측 `F6` FORBID-1이 `?? 1`·`|| 1` 보정을 금지하며 null 입력 12케이스를 전부 `unknown`으로 강제한다. **"파이프라인이 1.0을 채우면 전 FORBID를 준수한 채 UVP 방어선이 소멸"하는 경로는 3중으로 닫혔다.**

잔존 리스크 1건(경고 수준, C4 소관이므로 본 배치 판정에는 미반영): C4 FORBID-6의 잠금 대상은 `임계 상수(0.85/0.75/0.60/0.80/25건)`와 `fixtures/price-golden/**`로 열거되어 있고, **감점 규칙표(−0.20/−0.05/−0.35/−0.10/−0.15) 자체는 잠금 목록에 명시되지 않았다.** 규칙표를 완화하면 REQ-6(a)의 60건 기대값이 깨지므로 실질 방어는 되지만, 잠금 목록에 규칙표 파일을 명시하는 편이 안전하다.

### ② W3 자기 API 라우트의 `public_venue` 강제 — **해소 ✓**

`W3` FORBID-1이 신설되었다. `when`이 `app/api/venues/[slug]/route.ts` 및 `(venue)` 세그먼트로 좁고, `must_not`이 `packages/db` 직접 import·SQL 문자열·visibility 자체 구현·`preview/debug/includeHidden`를 열거하며, detect가 F1 boundary job + visibility 4종 픽스처 + 파라미터 fuzz 20종이다. 상류에서 `F5` REQ-3(공개 함수의 FROM은 `public_venue`만)·FORBID-3(우회 파라미터 금지)이 같은 방어를 DB 접근 레이어에서 한 번 더 건다. **배치 최대 우회 경로는 닫혔다.**

단, 4종 픽스처는 `F2b` REQ-1의 **5값 ENUM(`needs_review` 추가)** 을 커버하지 못한다(§3 공통 결함 C 참조).

### ③ W6 분모(detail_view) — **경계는 명확 ✓ / 산출물 정합은 미해소 ✗**

경계는 깨끗하다. 중복도 공백도 없다:

| 항목 | 소유 | 상대 계약의 명시 |
|---|---|---|
| `visitor_id`·`session_id`·수집 엔드포인트·봇 판정 | W9 | W6 out_of_scope 1행에 그대로 배제 ✓ |
| `detail_view`·`filter_applied`·리텐션 뷰 | W9 | W6 out_of_scope ✓ / W6 done_when "W9 detail_view 뷰 실재 확인, 없으면 착수 중단" ✓ |
| `lead_action` 이벤트·`qualified_lead` 집계 | W6 | W9 out_of_scope 1행 ✓ |
| 분모/분자 결합 뷰 `lead_conversion` | W6 | 분모는 W9 `detail_view`를 참조 ✓ |

**그러나 분모의 품질이 보장되지 않는다.** W6 REQ-3의 코호트 축 `price_block_present`는 W9 REQ-3이 산출하는데, **W9 REQ-3의 acceptance는 "7개 속성 결손 0건"과 `has_editor_report`의 값 일치만 검사하고 `price_block_present`의 기대값은 검사하지 않는다.** 상수 `true`를 채우는 구현이 W9를 100% 준수하고, 그러면 W6 REQ-3의 골든 테스트(자체 픽스처 기반)는 여전히 통과하며 **실데이터에서 H4의 대조군(absent) 분모가 0이 된다.** 게다가 이 속성의 판정 규칙을 W3(렌더 주체)와 W9(관측 주체) 어느 쪽도 공동 정의하지 않아, 1차 W3-F 지적("가격 블록 식별자를 W6에 제공하라")이 형태만 바꿔 재발했다.

### ④ W7 접수→처리 — **UI/API는 생겼으나 처리 경로는 여전히 단절 ✗ (본 배치 최대 결함)**

W8이 신설되어 큐·액션·회신·SLA 지표까지 계약화된 것은 진전이다. 그러나 **승인된 takedown이 실제로 공개면에서 사라지는 경로가 세 계약의 교차점에서 끊겨 있다.**

```
C7 REQ-4      : REQUEST_TAKEDOWN → visibility='hidden_request'  「전이는 W8 소유」
W8 FORBID-1   : W8은 venue.visibility 에 절대 쓰지 않는다        ← C7이 맡긴 일을 스스로 금지
F2b REQ-8/F-4 : admin_writer 롤의 venue.visibility UPDATE = 42501 ← DB 레벨에서도 차단
W8 REQ-2      : 대신 venue_suppression 1행 → public_venue 조회 0건 기대
F2b REQ-4     : public_venue = venue × judgement × override 결합. **venue_suppression 미참여**
C7 REQ-3/진리표: hidden_legal / hidden_request / override / visibility. **venue_suppression 미참여**
```

→ **`venue_suppression`에 행을 넣어도 `public_venue`는 변하지 않는다. W8 REQ-2의 acceptance (b)는 달성 불가능하다.** W8 out_of_scope는 "뷰가 서프레션을 결합하지 않으면 착수를 중단하고 **C7** 변경을 요청한다"고 적었으나, 뷰 파일 `packages/db/views/public_venue.sql`은 **C7과 F2b가 동시에 `touches`에 올려 둔 공동 소유 파일**이고 F2b REQ-4가 이미 서프레션 없는 정의를 테스트로 고정했다. 요청 대상 자체가 둘로 갈라져 있다.

부수 불일치 2건(둘 다 detect 대상 부재):
- W8 REQ-2가 쓰는 컬럼 `(reason ∈ {request,legal}, actor_id, created_at)` ↔ F2b REQ-7의 실제 컬럼 `(correction_request_id, decided_at, decided_by, visibility_from, visibility_to)`. F2b FORBID-5(화이트리스트 + CODEOWNERS)가 컬럼 추가를 막는다.
- `correction_action_log`(W8 REQ-4·FORBID-6의 전 방어가 여기 걸려 있다)를 정의하는 태스크가 **F2a·F2b 어디에도 없다.**

**SLA·미처리 감지:** W7 REQ-7(`correction_overdue{type}`)·W8 REQ-7(p50/p90·기한내 종결률·overdue 잔량)로 **지표는 노출된다.** 그러나 그 지표를 보고 사람을 부르는 장치가 없다 — O3 out_of_scope가 "W6·W7·W8·W9 메트릭의 알림 룰은 각 태스크가 `ops/alerts` 규약에 따라 추가"로 내보냈는데, **W6·W7·W8·W9 어느 계약의 `touches`에도 `ops/alerts/**`가 없고 네 계약 모두 done_when에 "touches 밖 파일 변경 0건(CI path guard)"을 걸어 두었다.** 룰을 만들 수 있는 계약이 하나도 없다. O1 대시보드의 6개 카드에도 `correction_overdue`는 없다. **결과: 접수→방치 경로의 자동 탐지는 1차와 동일하게 0건이며, 방치되어도 아무 CI도 붉어지지 않는다. 법적 리스크는 미해소.**

---

## 2. 체계적 결함 — 닫혔는지 판정

### P-A. 캐시·정적 산출물 우회 — **대부분 해소 ✓ / 무효화 호출자 공백 잔존 ✗**

전 서빙 표면에 재검증 상한이 걸렸는지 교차 대조:

| 표면 | 상한 REQ | 판정 |
|---|---|---|
| W1 색인 라우트 전수 | REQ-6 `revalidate ≤ 3600` 또는 `force-static`, 미선언·초과 시 CI exit 1 | ✓ |
| W2 리스트 | artifacts + done_when("check-render-strategy 통과") | ✓ |
| W3 상세 | artifacts "revalidate ≤ 3600" + W1 매니페스트 전수 검사 대상 | ✓ |
| W4 조합 랜딩 | REQ-7 `revalidate ≤3600` + **재검증 시 자격 재판정 → 404 + 제공자 제외** | ✓ (1차 최대 구멍이 닫혔다) |
| W5 리포트 | REQ-1 후단 `revalidate ≤ 3600` 명시 | ✓ |
| O2 override 미반영 | `public_venue` 뷰가 override를 결합 → 서빙 경로가 뷰만 보므로 자동 반영 | ✓ |

**남은 구멍은 즉시 무효화의 호출자다.** W1 REQ-7이 서명 검증 엔드포인트를 제공하지만:
- `W1` out_of_scope: "무효화 **호출자** 구현 — **C7·W8**이 전이 시 호출한다. W1은 엔드포인트만 제공"
- `C7` out_of_scope: "캐시·정적 산출물 무효화 실행 → **W1**. C7은 `visibility_change_event` 발행까지"
- `W8`에는 무효화 호출 REQ가 0건이다.

→ **상호 위임으로 아무도 호출하지 않는다.** C7 REQ-7이 만드는 `visibility_change_event`(+`consumed_at` 컬럼)를 소비하는 태스크도 없다 — 죽은 산출물이다. 실질 피해는 "즉시"가 아니라 "≤1시간"으로 한정되므로 1차의 *무기한 서빙*보다는 크게 낫지만, W1 REQ-7·W4 REQ-7이 단언하는 60초 SLA는 **테스트 안에서만 성립**한다. 그리고 `visibility_change_event`를 정의할 테이블도 F2b 산출물에 없다.

### P-B. H4~H7 판정 가능성 — **H7 해소 ✓ / H4·H5 부분 ✗ / H6 실질 미해소 ✗**

| 가설 | PRD 임계 | 필요 입력 | 소유 | 판정 |
|---|---|---|---|---|
| H4 | 코호트 전환율 차 | 분모 `detail_view` + 코호트 축 | W9 REQ-3 → W6 REQ-3 `lead_conversion` | **△** 분모·뷰는 있으나 코호트 축 `price_block_present`의 기대값 검증 0(§1-③) + **O1에 H4 카드 없음**(6장 중 전환율 카드 부재) |
| H5 | 세션 25% | `filter_applied` + **전체 세션 분모** | W9 REQ-4 `filter_usage_daily` | **△** 이벤트는 생겼으나 **비율의 분모(전체 세션·방문자 수)를 정의한 REQ가 W9·O1 어디에도 없다.** 뷰 이름만 있고 분모 규정이 없다 |
| H6 | 리포트 보유 코호트 비교 | `has_editor_report` 속성 + 비교 뷰 | W9 REQ-3(속성만) | **✗** 속성은 생겼으나 **그 축으로 전환율을 비교하는 뷰가 W6에 없고**(W6 REQ-3의 코호트 축은 `price_block_present` 단일), O1 6개 카드에도 H6이 없다. W6·W9 둘 다 `traces_to`에 H6을 적었으나 어느 쪽도 판정을 산출하지 않는다 |
| H7 | 재방문 20% | 지속 식별자 + 리텐션 뷰 | W9 REQ-1(400일 쿠키)·REQ-7·FORBID-6 | **✓ 해소** (쿠키 차단 세션을 `unidentified_sessions`로 분리하는 FORBID-6까지 정확하다) |

**O1 ↔ PRD 임계 대조 (G1 3구간 포함):**
- O1 REQ-2가 `≥40% = pass / 25~40% = reinforce / <25% = exclude`를 축별로 산출한다 → **G1 3구간 차등 판정은 반영됨 ✓** (1차 지적 해소).
- 그러나 **분자·분모가 계약 본문에 없다.** O1 REQ-7이 "파이프라인 지표 2종은 **C7 리포트 값과 일치**"로 정의를 C7에 위임하고, C7 REQ-8의 커버리지는 **분모가 "공개 venue 수"** 다. C7은 `NO_PRICE` 레코드를 `hidden_quality`로 내리므로 **가격 없는 업체가 분모에서 자동 제거되어 커버리지가 구조적으로 100%에 수렴**한다. PRD H1("강남3구 웰니스 업체의 40% 이상")·lean canvas("수집 업체 중")와 분모가 다르다. → **G1 3구간을 정확히 구현하고도 항상 `pass`가 나온다.** O1 FORBID-1은 이 상태에서 "레지스트리 값 == PRD 40%"를 단언하며 통과한다. **1차 지적 중 가장 위험한 항목이 미해소.**
- `KM-search-to-detail-ctr`(lean canvas 15%)는 O1 out_of_scope로 명시 제외 ✓ — 소스 없는 지표를 요구하지 않는 정직한 처리다.

### P-C. O2의 C7 무력화 — **핵심 2건 해소 ✓ / 3자 정합은 미완 ✗**

- **2인 승인 범위:** O2 REQ-4·FORBID-1이 "사유코드 **6종 무관**" 전 비공개 레코드로 확대되었고, acceptance가 6종 × 3케이스 = 18케이스다. 게다가 F2b REQ-3이 `approver_ids text[] CHECK(cardinality ≥ 2 AND 원소 중복 없음)`으로 **DB 제약까지** 건다. O2 REQ-7이 이메일 별칭(+태그) 계정 생성을 409로 막는다. → **PRICE_CONFLICT 등 5개 사유가 단독 승인으로 뚫리던 경로는 닫혔다 ✓**
- **C7 REQ-1 충돌:** 판정(C7) / 오버라이드(O2) 분리 + 뷰 결합으로 해소 ✓. O2 REQ-5·FORBID-2가 `venue.visibility`·`quality_score`·`reason_codes` 직접 쓰기를 금지하고 F2b FORBID-4가 롤 권한으로 이중 차단한다.
- **삭제 요청 레코드 부활 경로:** O2 REQ-1의 큐가 `visibility='hidden_quality'` 로 좁혀졌고 C7 FORBID-6이 `hidden_request`/`hidden_legal`의 `public` 전이를 금지한다 → UI 경로는 닫힘 ✓.

**그러나 3자(F2b / C7 / O2·W8) 정합은 성립하지 않는다:**

| 항목 | F2b(스키마 정본) | C7 | O2 / W8 |
|---|---|---|---|
| 판정 테이블 | `venue_quality_judgement(quality_score, reason_codes)` | **`quality_verdict(score, reason_codes)`** | O2는 `quality_score/reason_codes`(F2b 명명) |
| 오버라이드 테이블 | `venue_visibility_override` | **`review_override`** | O2는 이름 없이 "오버라이드 레이어" |
| 뷰 파일 소유 | `touches`에 `packages/db/views/public_venue.sql` | **`touches`에 동일 파일** | 둘 다 "뷰 변경은 상대 소관"이라 배제 |
| 뷰 결합 규칙 | `force_public OR (override 없음 AND visibility='public')` | 5행 진리표(`hidden_legal`·`hidden_request`는 **오버라이드 불가**) | — |
| 서프레션 결합 | **없음** | **없음** | W8 REQ-2가 있다고 전제 |

→ (a) 같은 파일을 두 계약이 소유해 **PR 1개 원칙이 실행 시점에 깨진다**, (b) 두 정의가 다르다 — **F2b 규칙대로면 `hidden_request` 업체에 `force_public` 오버라이드를 넣으면 공개된다**(C7 진리표는 금지). 스키마 정본이 법적 비공개를 뚫는 쪽이다. (c) 테이블 명칭 2벌 → grep 기반 detect가 한쪽에서 공허하게 통과한다. (d) **O2의 "수정" 액션(가격 수치·소스 목록·수집일 수정, FORBID-4가 전제)과 W8 FORBID-2의 "정정은 오버라이드 레이어에만 기록"이 쓸 테이블이 스키마에 존재하지 않는다** — `venue_visibility_override`에는 가격 필드가 없다.

### P-D. O3 알림이 영원히 발화하지 않던 문제 — **자기 계약 안에서는 해소 ✓ / 시스템으로는 미해소 ✗**

- REQ-4가 룰 등록 조건을 3개(메트릭 최근 24h 데이터포인트 ≥1 · **합성 조건 주입 시 채널 실제 도달** · `suppress_minutes` 필드)로 올렸고 FORBID-1이 같은 조건을 병렬로 건다 → **"존재하지 않는 메트릭 YAML"은 CI를 통과하지 못한다 ✓**
- REQ-5 데드맨 스위치(5분 하트비트, 15분 미수신 시 **알림 채널과 무관한 외부 경로**=스케줄 워크플로 실패 통지) + REQ-1 드리프트 체크의 GitHub Actions 실패 기록 → **"W6 카운터 → O3 알림 → O3 drift 감지" 순환은 끊겼다 ✓**
- FORBID-4가 무음화 경로를 5종(삭제·임계 상향·**윈도우 확대**·**셀렉터 축소**·**enabled:false**)으로 확대 ✓

**그러나 두 개의 공백이 남아 O3의 존재 이유를 다시 무력화한다:**
1. **"메트릭 저장소"를 소유하는 태스크가 계획 전체에 없다.** REQ-4·FORBID-1의 detect는 "룰의 metric 필드를 **메트릭 저장소에 질의**"하는데, 그 저장소(수집기·exporter·스크레이프 설정)를 만드는 계약이 O3 `touches`에도 F1에도 없다. W6·W7·W8·W9·O2는 전부 "내부 메트릭으로 노출"까지만 하고 그 뒤를 O3에 넘겼다. → detect 대상 부재.
2. **W6~W9 룰의 orphan화**(§1-④). O3가 내보낸 룰을 받을 수 있는 계약이 0개다. **`correction_overdue`·`lead_ingest_expected_vs_received`·`events_heartbeat_received`·`review_queue_depth`에 대한 알림은 계획 전체에서 아무도 만들지 않는다.**

### P-E. W4 thin content — **부분 해소 ✗ (공격 A 최집요 수행 결과 3경로 중 1개만 닫힘)**

| 1차 지적 | 2차 상태 |
|---|---|
| A-1 표본 100건 유사도 → 표집 조작 | **해소 ✓** REQ-4가 **전수** 검사(simhash+LSH), FORBID-3이 `--sample` 류 옵션 도입 자체를 금지하고 "검사 대상 수 == 생성 페이지 수" assert |
| A-2 결과집합 정확 일치 canonical → 1건 차이로 우회 | **해소 ✓** REQ-5가 Jaccard ≥ 0.9 근사중복 통합으로 완화 |
| A-3 **결과집합 5건이 조합 조건(니즈 태그)을 실제로 만족하는지 검증 없음** | **미해소 ✗** REQ-2는 여전히 `visibility='public'` 업체 **수**만 센다. 태그 보유를 확인하는 REQ가 0건 |
| 빌드 후 `visibility` 변경 무반영 | **해소 ✓** REQ-7 재검증 + 자격 상실 시 404 + 제공자 제외, FORBID-2 `when`에 "재검증 시점 모두" 명시 |

**A-3가 남아 있는 한 doorway 양산은 계속 가능하다.** 추가로 REQ-3("조합 고유 문장 5개, 타 조합과 5-gram 중복 0")은 **템플릿에 조합 토큰을 4토큰 이하 간격으로 끼워 넣으면 100% 준수된다** — "강남구에서 · 필라테스를 · 산후회복 · 목적으로 찾는다면" 형태로 변수 사이 고정 구간을 5토큰 미만으로 유지하면 어떤 두 조합도 5-gram을 공유하지 않는다. 정보량 0인 5문장 × 5,000페이지가 REQ-3·REQ-4를 동시에 통과한다.

### P-F. 원칙 2.5(숨김 FORBID ↔ 정상 동작 REQ) — 전 계약 대조

| 태스크 | 숨김·차단 FORBID | 짝 REQ | 판정 |
|---|---|---|---|
| W1 | F-2(비공개 비색인) · F-4(medical 메타) | REQ-8(sitemap 수 == public 수) · REQ-3(medical 픽스처 포함 전수 메타) | ✓ 명시적으로 "짝" 표기까지 되어 있다 |
| W2 | F-2(비confirmed) · F-6(medical) | REQ-7 · REQ-8 | **△ REQ-7이 비율 동등식(`렌더 수 == confirmed 수`)이라 confirmed 0건이면 `0==0`으로 통과** → 20건 전부 '가격 미공개'인 리스트가 여전히 합법 |
| W3 | F-1·F-2·F-4 | REQ-7(골든 40건 100% 렌더, 절대 하한) · REQ-8 | ✓ 절대 건수 하한이라 vacuous 통과 불가 |
| W4 | F-2(자격 미달 제외) · F-6(medical) | REQ-8(총 30건 이상 + 미제외 축마다 1건 이상) | ✓ 절대 하한 |
| W5 | F-1·F-2·F-4·F-5 | REQ-7(confirmed 10건 100%) · REQ-8(스테이징 5건) | ✓ 형식상 / **단 REQ-8이 out_of_scope와 충돌해 달성 불가**(§W5) |
| W7 | F-3(민감정보 마스킹) | REQ-5(정상 골든 20건 100% 접수, 전량 거부·전량 마스킹 시 실패) | ✓ 우수 |
| O2 | F-1·F-3·F-6 | REQ-6(골든 큐 20건 2인 승인 전건 공개) | ✓ |
| F2b·F5·F6(상류) | — | F2b REQ-5(25건) · F5 REQ-5(20건) · F6 REQ-5(40건) | ✓ 상류까지 일관 적용됨 |

→ **원칙 2.5는 배치 전반에 실질적으로 반영되었다.** 유일한 실패는 **W2 REQ-7의 비율형 하한**이다.

### P-G. R-7(실환경 하한) — 12건 중 11건 충족

W1 REQ-8 · W2 REQ-7/8 · W3 REQ-8 · W4 REQ-8 · W5 REQ-8 · W6 REQ-7 · W7 REQ-4/8(c) · W8 REQ-8 · W9 REQ-8 · O1 REQ-8 · O3 REQ-1/7 전부 스테이징 실환경 판정이다. 1차의 "픽스처 세계 탈출 실패 9/10"은 **해소되었다.** 유일하게 O2만 전 REQ가 픽스처·골든 기반이나, 검수 어드민의 성격상 done_when("사유코드 6종별 큐 잔량과 override 공개 비율 **실측치** 첨부")이 대체 역할을 한다 — 다만 이는 CI 판정이 아니라 PR 본문 첨부라 기계 검증이 아니다.

### P-H. **신규 체계 결함 — F5 경계가 5개 계약을 구현 불가로 만든다**

`F5` REQ-1: "`packages/db` 및 postgres 드라이버를 import 하는 패키지가 `packages/api` **하나뿐**이며, **리포지토리 전체(`apps/web/src/app/api/**` 포함)** 의 위반 건수가 0". FORBID-1이 같은 규칙을 `boundary` CI job으로 전 PR에 집행한다. 그런데 F5의 산출물은 **공개 조회 함수 2개(`listPublicVenues`, `getPublicVenueBySlug`)뿐**이고, out_of_scope가 "이벤트 쓰기 경로(W6/W9)", "인증·세션·레이트리밋(W6·W9 소관)"을 명시 배제한다. 즉 **쓰기 경로를 제공하지 않으면서 다른 모든 경로를 금지한다.**

| 계약 | 필요한 DB 접근 | F5 제공 여부 |
|---|---|---|
| W7 | `correction_request` INSERT/SELECT (`app/api/corrections/**`) | ✗ |
| W8 | `venue_suppression`·`correction_action_log` INSERT, 큐 SELECT | ✗ |
| W9 | 이벤트 INSERT(`app/api/events/ingest`), `editor_report` 조회(REQ-3 `has_editor_report`) | ✗ |
| O2 | override INSERT, `review_audit_log` INSERT, 비공개 레코드 SELECT | ✗ |
| O1 | `packages/metrics/definitions/*.sql` 실행 | ✗ |

→ **다섯 계약이 착수와 동시에 `boundary` job에 걸린다. 개발 에이전트는 반드시 예외를 판다.** 1차 P4("C7 FORBID-1의 `when`이 너무 넓어 운영 기능이 구현 불가 → 예외가 확정적으로 발생")가 소유자만 C7→F5로 바뀐 채 그대로 재현했다. 규격 §3.4 안티패턴 "계약이 자기 PR을 차단" / 원칙 2("무조건 금지는 반드시 깨지고, 깨지는 순간 다른 금지도 협상 가능해진다")의 교과서적 사례다.

### P-I. **신규 체계 결함 — D4 산출물 경로가 전부 틀렸다**

`D4.md`의 실제 산출물은 `packages/legal/medical/rules/{scope,display,lexicon,review}.yaml` 과 하류 인용 정본 `packages/legal/medical/dist/exported_rules.json`, 판정 함수 `packages/legal/medical/src/index.ts` 다. `docs/discovery/D4/` 아래에는 **`report.md` 하나뿐**이다.

그런데 하드 참조 현황:

| 계약 | 참조 경로 | 실재 |
|---|---|---|
| W1 FORBID-4 | `docs/discovery/D4/forbidden_lexicon.yaml` | **✗** |
| W2 FORBID-6 / REQ-8 | 동 경로 / "D4 `display_whitelist`" | **✗ / ✗**(실제는 `display.yaml`의 허용 포맷) |
| W3 FORBID-4 | 동 경로 | **✗** |
| W4 FORBID-6 | 동 경로 | **✗** |
| W5 FORBID-2 | "D4 금지표현 사전(정본 경로·버전 고정)" — 경로 미기입 | 미확정 |
| W6 FORBID-6 / O2 FORBID-6 | "D4 금지표현 사전" / "D4 가드레일 재검사" | 미확정 |
| (배치 밖) C4 FORBID-3 · C6 FORBID-2 · F4 FORBID | 동일 오경로 | ✗ |

**존재하지 않는 YAML을 정규식 소스로 삼는 렌더 스캔은 위반이 있어도 0건을 보고한다.** 개정 §5의 "detect 가 참조하는 테이블/컬럼/함수가 선행 태스크 산출물에 실재하지 않음"에 정확히 해당하며, 1차 P1(`is_public` 유령 컬럼)이 파일 경로 형태로 반복된 것이다. medical 가드레일은 "위반 시 서비스 전체 중단"으로 스스로 서술한 리스크다.

---

## 3. 태스크별 판정

---

## W1-SEO-FOUNDATION — REVISE

**규격 위반**
- `[금지사항] detect 대상 부재` — FORBID-4가 `docs/discovery/D4/forbidden_lexicon.yaml`을 검사 소스로 지정. D4 산출물에 없다(§P-I).
- `[금지사항] when 이 상위 정본과 불일치` — FORBID-2의 `when`이 `visibility != 'public'`을 "(hidden_quality·hidden_request·hidden_legal)" **3종으로 열거**하고 detect도 "4개 값 픽스처"인데, `F2b` REQ-1의 ENUM은 **5값(`needs_review` 추가)** 이다. 열거형 조건은 명시되지 않은 값에서 발동하지 않는다.
- `[경계] 소유권 상호 위임` — out_of_scope "무효화 호출자는 C7·W8" ↔ C7 out_of_scope "무효화 실행은 W1". 양쪽 다 배제(§P-A).

**공격 결과**
- **A 악의적 준수** — 세 갈래. ①`revalidate` 극대화: REQ-6이 `n ≤ 3600` 상한을 CI로 집행하고 FORBID-1이 초과 선언을 재차 막는다 → **방어됨 ✓**(1차 최대 결함 해소). ②allowlist 폭증: REQ-1이 항목 수 3 이하를 종료 코드로 강제, FORBID-5가 4개 이상 증설을 금지 → **방어됨 ✓**. ③**매니페스트 축소**: REQ-2가 "app 디렉터리 `page.tsx` 스캔 결과와의 대칭차집합 0"으로 자동 도출을 강제 → **방어됨 ✓**. 남은 갈래는 REQ-8의 sitemap 등식으로, 스냅샷의 public 업체가 0건이면 `0+정적 = 0+정적`으로 통과한다(단 F2b REQ-5·F5 REQ-5의 20건 하한이 상류에서 보완).
- **B 조건 회피** — FORBID-2의 `when`이 "sitemap 제공자·라우트 핸들러·`generateStaticParams`·서버 컴포넌트·빌드 스크립트 중 **어느 경로에서든**"으로 확대되어 1차의 RSC/정적 생성기 구멍은 닫혔다 ✓. **그러나 `visibility='needs_review'` 는 열거에서 빠졌다** — F2b가 새로 도입한 5번째 값이며, F2b `public_venue` 뷰가 이를 제외하므로 실피해는 F5 경유 조회에서 차단되지만, **W1의 sitemap 등재·404 테스트는 이 상태를 한 번도 검증하지 않는다.**
- **C 탐지 무력화** — FORBID-1 detect가 "**W1 소유 스텁 라우트**"를 대상으로 명시해 1차의 "검증할 라우트가 없다"는 문제를 닫았다 ✓. FORBID-4 detect는 대상 YAML 부재로 **공허**(§P-I). FORBID-3(`next/headers` import 금지 + SITE_ORIGIN 미설정 시 빌드 실패)은 `lib/routes/**`까지 확대되어 1차 회피 경로가 닫혔다 ✓.
- **D 지름길 유도** — **REQ-8의 등식이 W4·W5 머지 후 반드시 거짓이 된다**: "sitemap URL 수 == public 업체 수 + 정적 라우트 수"인데 W4가 조합 랜딩 수천 개를, W5가 리포트 URL을 같은 sitemap에 넣는다(둘 다 제공자 규약으로 등재). 등식이 깨지는 순간의 최단 지름길은 이 스모크를 느슨하게 고치거나 스킵하는 것이며, 이를 막는 조항이 없다. 등식을 "**제공자별** 기대값 합"으로 재정의해야 한다.
- **E DAG 정합성** — `depends_on`에 D4·F5·F2b·DS3가 들어와 1차의 폐기 F3 참조와 누락 의존이 해소됨 ✓. `blocks`에 W9 추가 ✓(W9 `depends_on`과 대칭). `gate: [G1,G2,G3]` ✓. **미해소: 무효화 호출자 공백(§P-A) 및 `visibility_change_event` 테이블의 소유자 부재.**
- **F 존재 이유** — `traces_to: [H3]` 단일로 정리되었고 `KM-search-to-detail-ctr` 미정의 ID가 제거됨 ✓. URL 규약·sitemap·렌더 전략이 H3 색인 단위를 만든다는 인과가 명확 ✓.

**필수 수정 사항**
1. FORBID-4의 검사 소스를 **`packages/legal/medical/dist/exported_rules.json`(D4 정본)** 으로 교체하고 버전 핀을 명시 — 현재 detect는 존재하지 않는 파일을 읽는다.
2. FORBID-2의 `when`과 detect 픽스처를 **F2b ENUM 5값 전수**로 확대(`needs_review` 포함).
3. **무효화 호출자를 계약으로 확정** — W1 out_of_scope와 C7 out_of_scope가 서로를 가리킨다. `visibility_change_event` 소비자(폴러/워커)의 소유 태스크와 그 테이블의 스키마 소유(F2b)를 명시하지 않으면 REQ-7은 테스트 안에서만 동작한다.
4. REQ-8의 등식을 "**sitemap 제공자별 기대 건수의 합**"으로 재정의 — 현행 등식은 W4·W5 머지와 동시에 거짓이 된다.

---

## W2-DISCOVERY-LIST — REVISE

**규격 위반**
- `[금지사항] detect 대상 부재` — FORBID-6 / REQ-8의 `docs/discovery/D4/forbidden_lexicon.yaml`·`display_whitelist`(§P-I).
- `[금지사항] detect 수단이 자기 touches 밖 산출물` — FORBID-4의 "저장소 전체 스캔 스크립트"는 F6 `tools/check-price-state-single-source.mjs`인데 W2 `touches`에는 `tools/**`가 없다. F6 REQ-2를 인용해야 하며, 그렇지 않으면 W2가 만들 수 없는 스크립트를 detect로 선언한 것이다.
- `[요구사항] 원칙 2.5의 짝 REQ가 vacuous` — REQ-7은 "숫자 가격 렌더 카드 수 == 그 20건 중 confirmed 업체 수". **confirmed가 0이면 0==0으로 통과**한다(§P-F).

**공격 결과**
- **A 악의적 준수** — ①`confidence` 조작으로 estimated 소멸: C4 REQ-6 + F2b FORBID-3 + F6 FORBID-1이 3중 차단 → **방어됨 ✓**(1차 최대 결함 해소). ②**20건 전부 '가격 미공개'인 리스트**: REQ-1은 `data-price-state` 속성 20건만 요구하고(값 제약 없음), REQ-7은 비율 동등식이라 confirmed 0건에서 자동 충족, REQ-8은 medical 한정 → **여전히 성립**. F6 REQ-7(스테이징 confirmed ≥30%)이 상류에서 완화하지만 W2 자신은 절대 하한을 갖지 않는다.
- **B 조건 회피** — FORBID-6 `when`이 "카드의 `category`가 medical_wellness". `category`는 F2a REQ-1에 실재하는 컬럼이다 ✓(1차의 "필드 부재" 지적 해소). 다만 판정 정본은 D4 `scope.yaml`의 업종 enum인데 W2는 이를 인용하지 않아 **C5·C6 단계의 축 오분류 1건이 FORBID-6을 통째로 회피**시킨다(1차 지적 #4 미해소). FORBID-3(조건 완화 금지, 속성 테스트 100회, 완화 제안은 `data-section="suggestions"`로 분리)은 여전히 이 배치 최상급 조항 ✓.
- **C 탐지 무력화** — FORBID-1 detect가 "핸들러 소스 테이블명 grep"에서 **F1 boundary job(dependency-cruiser) + visibility 4종 픽스처 + 파라미터 fuzz 20종**으로 교체되어 1차의 ORM 우회 구멍이 닫혔다 ✓. FORBID-6 detect는 대상 YAML 부재로 공허(§P-I).
- **D 지름길 유도** — 임계 하향: `0.7`은 F6 `PRICE_CONFIDENCE_MIN` 단일 선언이고 F6 FORBID-3이 CODEOWNERS 승인 없이는 변경을 막는다 → **방어됨 ✓**. 남은 지름길은 REQ-2의 태그 집합 정의(아래 E)와 REQ-7의 vacuous 충족이다.
- **E DAG 정합성** — `depends_on`에 F4·F5·F6·C4·C7·D4·DS5·DS6이 들어와 1차 지적 전부 반영 ✓. `lib/price-state.ts` 공유 파일 문제는 F6 신설로 해소 ✓. **미해소: REQ-2가 "F4 온톨로지가 export 한 집합"으로만 쓰여 있다.** F4는 `filter_visible` 필드를 정의하고 "`filter_visible: true` 태그가 축당 4개 이상"을 REQ로 갖는다. 전체 집합과 대칭차집합 0을 요구하면 **`filter_visible=false` 태그까지 필터 UI에 노출되어 F4 REQ-1이 무효화된다.** 1차 필수수정 #1이 문구만 바뀐 채 남았다.
- **F 존재 이유** — H5 관측 표면으로 타당 ✓. 필터 사용 이벤트는 W9 REQ-4가 소유하고 W2 out_of_scope가 "이벤트 발화 지점의 data 속성만 제공"으로 접합면을 정의했다 ✓ — 다만 **W2가 제공해야 할 data 속성의 이름·조건이 어느 REQ에도 없고**, W9 REQ-4는 미들웨어에서 URL 쿼리로 독립 산출하므로 두 정의가 어긋날 수 있다.

**필수 수정 사항**
1. **REQ-7에 절대 하한을 추가** — 예 "첫 페이지 20건 중 `confirmed` 카드 ≥ N(≥5)". 현행 비율 동등식은 가격 0건 리스트를 합법화한다(원칙 2.5의 실질 위반).
2. **REQ-2를 `filter_visible=true` 집합과의 대칭차집합 0으로 명시** — F4 REQ-1과 정면 충돌 상태다.
3. FORBID-6의 검사 소스를 D4 정본 경로로 교체하고, `when`의 축 판정 근거를 D4 `scope.yaml` 업종 enum으로 고정 + **축 판정 실패 시 기본 동작을 `hide`로 명시**.
4. FORBID-4의 detect를 F6 REQ-2 스크립트 인용으로 교체(자기 touches 밖 산출물을 자기 detect로 선언하지 않는다).
5. REQ-1의 `data-price-state` 속성명과 W9 `filter_applied`가 소비할 data 속성 규약을 REQ로 고정.

---

## W3-VENUE-DETAIL — REVISE

**규격 위반**
- `[금지사항] detect 대상 부재` — FORBID-4의 D4 경로(§P-I).
- `[요구사항] 상류 계약과 충돌` — REQ-1이 "요금제 **전량**, 각 행에 원문·총액·횟수·**회당 단가**·수집일 5개 필드 출력"을 요구한다. `F6` REQ-3·FORBID-4는 **`showNumeric=true`인 상태는 `confirmed` 하나뿐**이며 비-confirmed 입력에 대해 숫자 파생값 반환 자체를 금지한다. **estimated/conflicted/unknown 행의 회당 단가 숫자를 렌더하면 F6 계약 위반, 렌더하지 않으면 W3 REQ-1 실패** — 두 계약이 동시에 참일 수 없다.
- `[요구사항] R-6` — REQ-7의 표집 절차(모집단=C7 스냅샷, `venue_id` 해시 오름차순 상위 40, 동일 절차 홀드아웃 20, 저장소 미커밋)가 명시됨 ✓ **충족**.

**공격 결과**
- **A 악의적 준수** — 1차 치명 결함("비공개 업체를 렌더하지 마라는 조항이 0건")은 FORBID-1 신설로 닫혔다 ✓. 재시도: ①**전량 '가격 미공개' 상세**: REQ-7이 골든 40건 **절대 건수** 100% 렌더를 요구하므로 불가 ✓. ②요금제 0건 + 비공개 업체 200 응답: FORBID-1 + W1 FORBID-6(비공개 slug 404)이 이중 차단 ✓. ③**메타·OG로의 추정가 유출**: FORBID-2가 "요금제 행 밖 표면(제목·메타 description·openGraph)"까지 확대 ✓.
- **B 조건 회피** — FORBID-1·2의 `when`이 판정 함수 입력이 아니라 **경로/상태값** 기준이라 1차의 "`confidence` 조작으로 `when` 자체를 소멸"이 통하지 않는다 ✓. FORBID-3의 `when`이 `price_conflict` 행 참조 + C7 `reason_codes` 로 이중 특정되어 좁고 판정 가능 ✓ (`price_conflict`는 F2b REQ-6에 실재 ✓ — 1차의 "테이블 부재" 해소).
- **C 탐지 무력화** — **REQ-3의 detect가 여전히 `data-emphasis="primary"` 속성 존재 검사뿐이다.** 한쪽 값에 `class="text-2xl font-bold"`를 주고 다른 쪽을 작게 렌더하면 시각적으로 완전한 대표값 강조인데 테스트는 통과한다. 1차 필수수정 #3(계산 스타일 비교로 격상) **미반영**. FORBID-3의 (a)(b) 검사가 "숫자 집합이 입력의 부분집합 + 값 노드 2개 이상"으로 보강된 것은 진전이나, **강조 여부는 여전히 잡지 못한다.** FORBID-2 detect의 "배지 노드 존재" 역시 `opacity:0` 렌더를 잡지 못한다(1차 지적 미반영).
- **D 지름길 유도** — 1차의 "8행 상한 밖으로 비확정 행 밀어내기"는 REQ-1의 절단 폐지로 소멸 ✓. 남은 지름길은 위 REQ-1↔F6 충돌 지점 — 개발 에이전트는 **F6의 `showNumeric`을 무시하고 자체 포맷터로 숫자를 찍는 쪽**을 택할 가능성이 높고(그래야 W3 CI가 녹색), 그 순간 F6 FORBID-2("소비 측 판정 재선언 금지")가 깨진다.
- **E DAG 정합성** — D4·F2a·F2b·DS4·F5·F6·C4·C7이 전부 들어와 1차 누락 4건 해소 ✓. DS4-PRICE-COMPARE-CARD 중복 구현 문제도 `depends_on` + out_of_scope("DS4 컴포넌트를 사용만 한다")로 해소 ✓.
- **F 존재 이유** — H4·S1 타당 ✓. **그러나 H4 코호트의 실체인 `price_block_present`를 W3가 정의·제공하지 않는다.** out_of_scope는 "상세 조회 이벤트는 W9 소유, W3는 CTA data 속성만 제공"이라 적었고 W9는 미들웨어에서 독립 산출한다 → **"가격 블록이 있었는가"의 정의가 두 벌**이 되어 H4 코호트가 오염된다(§1-③). 1차 필수수정 #5 미반영.

**필수 수정 사항**
1. **REQ-1 ↔ F6 FORBID-4 충돌 해소** — 비-confirmed 행에서 무엇을 렌더하는지(숫자 미표기 + 원문 문구만, 또는 F6가 `maskedValue`를 반환) 계약 본문에 확정. 현 상태로는 두 계약 중 하나를 반드시 어긴다.
2. **REQ-3의 detect를 계산 스타일 비교로 격상** — Playwright로 충돌 양측 값 노드의 `font-size`·`font-weight`·`color` 동일성 단언. 속성명 검사로는 강조를 못 잡는다(1차 지적 재발).
3. **FORBID-2 detect에 가시성 검사 추가** — 배지 노드의 계산 스타일(`opacity`·`display`·`visibility`) 확인.
4. **`price_block_present`의 판정 규칙(요금제 0건 상태 포함 여부 · confirmed 요구 여부)을 W3가 REQ로 고정하고 W9가 그것을 인용하도록 상호 참조** — H4 코호트 정의의 유일한 소스여야 한다.
5. FORBID-4의 D4 경로를 정본으로 교체.

---

## W4-COMBO-LANDING — REVISE (1차 REJECT에서 상향)

**규격 위반**
- `[금지사항] detect 대상 부재` — FORBID-6의 D4 경로(§P-I).
- `[요구사항] 자격 판정의 실질 요건 부재` — REQ-2가 조합의 공개 업체 **수**만 세고, 그 업체들이 조합의 니즈 태그를 보유하는지 검증하는 REQ가 0건(§P-E A-3).
- `[경계] done_when의 안전장치가 다른 계약과 충돌` — "프로덕션 색인 활성화는 G4 통과 후 **별도 배포**로 수행, 본 PR 머지 시점에는 W1 REQ-5의 비프로덕션 전체 차단 상태 유지". 그러나 **`O3` REQ-1은 "웹은 main 머지 시 자동 배포"** 이고 W1 REQ-5는 `VERCEL_ENV=production`에서 `/api`·쿼리 경로만 Disallow한다. **머지 = 프로덕션 배포 = 색인 허용.** "별도 배포"라는 단계는 파이프라인에 존재하지 않는다(1차 지적 #8 미해소).

**공격 결과**
- **A 악의적 준수 (최집요 수행)** — §P-E 표 참조. **3경로 중 A-1(표집 조작)·A-2(정확 일치 canonical)는 닫혔고, A-3(조건 무관 업체로 하한 채우기)은 열려 있다.** 추가로 발견한 **A-4 신규**: REQ-3의 "조합 고유 문장 5개, 타 조합과 5-gram 중복 0"은 **변수 토큰을 4토큰 이하 간격으로 삽입한 템플릿으로 100% 준수 가능**하다. 조합 토큰이 문장마다 다르므로 5-gram이 겹치지 않는다. REQ-4(전수 Jaccard ≤0.8)도 업체 목록이 다르면 통과. → **정보량 0인 5문장 + 업체 표 × 5,000페이지가 계약을 완전히 준수한다.** FORBID-3의 `because`가 스스로 "doorway page의 정확한 정의"를 서술하는데, 탐지 수단은 여전히 n-gram 계열뿐이다.
- **B 조건 회피** — FORBID-6의 `when`이 여전히 "**매니페스트 행의** 카테고리"다(1차 지적 #7 미반영). `강남 도수치료 가격`이 `릴렉스·회복` 축으로 라벨링되면 `when`이 발동하지 않는다. 다만 detect가 "**실제 생성물 전량**의 HTML·메타를 매칭"으로 확대되어 lexicon 위반은 축과 무관하게 잡힌다 → **부분 방어**. 그러나 `must_not`의 후반부("시술명과 금액을 결합한 문구 생성")는 `when`에 걸려 있어 오분류 조합에서 통제되지 않는다.
- **C 탐지 무력화** — FORBID-3의 detect가 "임계 상수 0.8 assert + CLI 파서에 표본 옵션 존재 시 실패 + **검사 대상 수 == 생성 페이지 수** assert" 3중으로 강화되어 1차의 표본 조작이 완전히 봉쇄 ✓. FORBID-4 detect는 F1 boundary job + visibility 4종 픽스처로 실효화 ✓. FORBID-1의 "카테시안 grep"은 여전히 무엇을 잡는지 불명확하나 REQ-1(부분집합 검증)이 실질 방어를 하므로 장식 수준.
- **D 지름길 유도** — REQ-8(총 30건 + 축별 1건)에 걸리면 최단 지름길은 **자격 하한 5를 만족시키기 위해 결과집합을 지역×축으로만 채우는 것**(A-3)이며, 이는 계약상 완전히 합법이다. 임계 완화 경로는 FORBID-3로 봉쇄 ✓.
- **E DAG 정합성** — `depends_on`에 C7·D2·W2·F4·F5·F6 추가, `parallel_with`에서 C7 제거 → **1차 REJECT 사유(DAG 정본과 반대 방향 선언) 해소 ✓**. W5의 허위 엣지도 out_of_scope에 명시적으로 반박해 두었다 ✓. **미해소: G4 이후 색인 활성화의 집행 수단**(위 규격 위반).
- **F 존재 이유** — H3의 유일한 유입 표면 ✓. REQ-8의 절대 하한(30건)으로 "0페이지 생성이 합법"이던 1차 R-7 위반 해소 ✓.

**필수 수정 사항**
1. **REQ-2에 "결과집합의 전 업체가 조합의 니즈 태그를 보유"를 추가** — 하한 5는 조건 무관 업체로 채울 수 있다. 이것이 남은 doorway 경로의 본체다(1차 필수수정 #3 미반영).
2. **REQ-3을 n-gram이 아닌 정보량 기준으로 보강** — 예: 조합 고유 텍스트에서 템플릿 변수 치환 구간을 제거한 **잔여 토큰 수 하한**, 또는 조합별 서로 다른 데이터 근거(가격 분포·업체 수·수집 기간) 문장 수. 현행 5-gram 0 조건은 변수 삽입 간격만 조절하면 통과한다.
3. **FORBID-6의 `when`을 "결과집합에 medical_wellness 업체가 1건 이상 포함된 경우"로 확대** + 검사 소스를 D4 정본 경로로 교체.
4. **G4 이후 색인 활성화를 실제 집행 수단으로 표현** — `O3` REQ-1의 main 머지 자동 배포와 충돌하지 않도록, W1 robots 정책에 `docs/gates/G4.md`의 `verdict` 를 읽는 프로덕션 단계 게이트를 두거나 별도 태스크로 분리. 현재 done_when의 서술은 집행되지 않는다.

---

## W5-EDITOR-REPORT — REVISE

**규격 위반**
- `[요구사항] REQ ↔ out_of_scope 정면 충돌` — REQ-8은 "스테이징에서 **실제 에디터 리포트 콘텐츠 5건 이상**이 200 응답(콘텐츠 0건이면 실패)"을 요구하는데, out_of_scope 1행이 "**리포트 원고 작성·촬영 등 콘텐츠 생산 자체**"를 배제하고 콘텐츠를 생산할 태스크는 DAG에 없다. 동시에 FORBID-5는 EXIF 촬영일(`visited_at ±7일`)과 원문 유사도로 허구 리포트를 차단한다. → **정상 경로로는 REQ-8을 달성할 수 없고, 달성하려면 FORBID-5를 뚫어야 한다(EXIF 조작).**
- `[요구사항] 다른 계약과 acceptance 충돌` — REQ-6(c) "`pnpm test:sitemap` 에서 **sitemap URL 수 == 공개 리포트 수**" ↔ W1 REQ-8 "sitemap URL 수 == public 업체 수 + 정적 라우트 수". 같은 산출물에 대해 두 계약이 서로 다른 총계를 단언한다.
- `[금지사항] detect 대상 부재` — FORBID-2의 `category_axis`. **F2a 컬럼은 `category`** 이며 F2a REQ-6/FORBID-3의 화이트리스트가 `category_axis` 추가를 CODEOWNERS 승인 없이 막는다. (동일 오류가 W6 FORBID-6·O2 FORBID-6에도 있다.)
- `[금지사항] detect 소스 미고정` — FORBID-2가 "D4 금지표현 사전(정본 경로·버전 고정)"이라 쓰면서 **경로를 적지 않았다**. W2·W3·W4는(틀렸지만) 경로를 하드 참조한다.
- `[구조] gate 선언의 근거가 사실과 다름` — `gate: null # W1·W2·W3 와 동일 규약`. **W1·W2·W3는 전부 `[G1,G2,G3]`** 이다. Phase 3 안에서 게이트 선언이 두 갈래(W1~W4 = 3게이트 / W5~W9 = null)이며, 주석이 그 사실을 반대로 서술한다.

**공격 결과**
- **A 악의적 준수** — ①**sitemap 미등재로 H3 기여 0**: `lib/sitemap-sources/reports.ts`가 touches에 편입되어 해소 ✓(1차 최대 지적). ②**리포트 0건 배포**: REQ-1은 `0==0`으로 통과하지만 REQ-8이 5건 하한을 걸어 차단 ✓ — **다만 그 하한이 out_of_scope와 충돌해 데드락**(위). ③**FORBID-4 우회로 삭제요청 업체 노출**: `when`이 `visibility != 'public'` 3종 전체로 확대되고 detect가 가격 노드 0·href 0·sitemap 0을 단언 ✓ 해소.
- **B 조건 회피** — FORBID-4의 3종 열거는 F2b 5값 ENUM의 `needs_review`를 빠뜨린다(W1과 동일). FORBID-1의 `when`(`funding != "self"` 또는 `receipt_ref` 미존재)은 좁고 판정 가능 ✓. **다만 1차 지적 "REQ-1(경로 수 == 파일 수) ↔ FORBID-1(위반 리포트 라우트 미생성)" 모순은 남아 있다** — REQ-1이 "**프론트매터 검증을 통과한** 리포트 전부"로 한정되어 형식상 해소되었으나, FORBID-1 detect가 "**빌드 exit != 0**"을 요구하므로 협찬 리포트 파일이 저장소에 존재하는 순간 전체 빌드가 실패한다. 협찬 리포트를 정상적으로 다루는 운영 경로(별도 디렉터리·`draft` 상태)가 없어 첫 예외에서 규칙이 깨진다(원칙 2).
- **C 탐지 무력화** — **FORBID-5가 1차의 "LLM 생성문 + 사진 1장이면 통과"에서 EXIF `DateTimeOriginal` ±7일 + `source_record` 원문 대비 5-gram Jaccard ≤0.30 으로 교체되어 실효화 ✓** (이 배치에서 가장 개선된 조항). 잔존: EXIF는 촬영 기기에서 조작 가능하고, "본문을 LLM으로 쓰되 크롤링 원문과 유사하지 않게" 쓰면 유사도 검사를 통과한다 — 즉 **원문 복제는 잡지만 창작은 잡지 못한다.** `visited_at` 자체의 진위는 여전히 자기신고다.
- **D 지름길 유도** — REQ-8 5건을 채우기 위한 최단 경로가 **EXIF 메타데이터 조작**이라는 점이 이 계약 최대 위험이다. 계약이 달성 불가능한 REQ와 그것을 막는 FORBID를 동시에 두면, 에이전트는 반드시 FORBID를 우회하는 방법을 학습한다.
- **E DAG 정합성** — `blocks: [W4]` 허위 엣지 제거 ✓, D4·F5·F6 의존 추가 ✓, W4 out_of_scope와 상호 정합 ✓. 순환 없음.
- **F 존재 이유** — H6 판정에는 수십 건의 리포트가 필요한데 생산 소유자가 여전히 없다(1차 필수수정 #8 미반영). **W5 완료 = 렌더러 완성이지 H6 관측 가능성 확보가 아니다.** H3 기여는 sitemap 편입으로 회복 ✓.

**필수 수정 사항**
1. **REQ-8 ↔ out_of_scope 데드락 해소** — 콘텐츠 생산을 소유할 운영 태스크를 DAG에 신설해 `depends_on`에 넣거나, REQ-8을 "생산된 콘텐츠가 존재할 때의 렌더 계약"으로 재정의. 현 상태는 EXIF 조작을 유도한다.
2. **REQ-6(c)를 W1 REQ-8과 정합하게 재작성** — "sitemap의 `/reports/*` 항목 수 == 공개 리포트 수"로 범위를 한정.
3. `category_axis` → **`venue.category`** 로 정정(F2a 정본).
4. FORBID-2의 검사 소스를 D4 정본 경로 + 버전으로 하드 고정.
5. FORBID-4 `when`에 `needs_review` 포함, `gate` 선언과 그 주석을 W1~W4와 정합화(사실과 다른 근거 서술 제거).
6. 협찬 리포트의 **정상 운영 경로**(빌드 실패가 아닌 비공개 처리)를 규칙 안에 명시 — 현재는 첫 예외에서 빌드가 멈춘다.

---

## W6-LEAD-TRACKING — REVISE

**규격 위반**
- `[금지사항] detect 대상 부재 (치명)` — REQ-1의 필수 필드 `action_type`·`price_block_seen`, REQ-4의 `visitor_id` 가 **`F2b` REQ-8의 `lead_event` 화이트리스트 `(event_type, surface, venue_id, session_hash, is_bot, event_version, occurred_at)` 에 없다.** F2b FORBID-5가 화이트리스트 밖 컬럼 추가를 CODEOWNERS 승인 없이 차단한다. W6 out_of_scope는 "컬럼이 부족하면 착수를 중단하고 F2 변경을 요청"이라 적었으나, **F2b는 이미 W6를 `blocks`에 넣은 채 그 컬럼을 제공하지 않는다.**
- `[금지사항] detect 대상 부재` — FORBID-6의 `category_axis`(F2a는 `category`).
- `[금지사항] detect 소스 미고정` — FORBID-6의 "D4 금지표현 사전" 경로 미기입.
- `[경계] 산출물 소유 경계` — `packages/events/schema/lead_action.v1.json`·`views/*.sql`은 W9 소유 디렉터리에 파일을 추가하는 형태(W1 sitemap 제공자 규약과 동형)라 허용 가능하나, **뷰 SQL을 실제로 DB에 생성하는 주체(마이그레이션 = F2b 소유)가 명시되지 않았다.**

**공격 결과**
- **A 악의적 준수** — 1차 치명 결함(`session_id` 정의 부재로 매 로드마다 새 UUID → NSM 부풀리기)은 **W9 REQ-1·REQ-2(400일 쿠키 / 30분 무활동 만료 / 새로고침 유지)로 이관되어 해소 ✓**. 재시도: ①**리드 0건 상태**: REQ-7 하트비트가 "수집 차단 주입 시 비율 0으로 관측되어 실패(값이 항상 1로 고정되면 실패)"까지 요구해 계측 자체의 무응답을 차단 ✓ — 이 배치 최고 수준의 R-7 조항. ②**`price_block_present` 상수화로 H4 코호트 붕괴**: W6 REQ-3의 골든 테스트는 자체 픽스처(present 60/absent 40)로 통과하고, 실데이터에서 W9가 상수 `true`를 채워도 **W6·W9 어느 테스트도 실패하지 않는다** → **여전히 성립**(§1-③).
- **B 조건 회피** — FORBID-2의 detect가 "스키마 diff 대비 version bump" **+ `qualified_lead_daily`의 `event_version` 필터 존재 검사 + `lead_events_by_version` 지표 노출**로 확대되었고, 1차가 지적한 "스키마를 안 건드리는 의미 변경"(뷰포트 임계·dedup 창·봇 패턴·surface 부여 기준) 중 **surface·is_bot·visitor_id는 FORBID-3으로 서버 확정, 봇 패턴은 W9 REQ-5로 이관**되어 대부분 닫혔다 ✓. 남은 것: **REQ-6의 뷰포트 임계(50%·1초)와 REQ-4의 dedup 창(30초) 상수 변경**은 FORBID-4의 `when`("집계 정의 변경")에 포함되나 detect가 "`qualified_lead_daily.sql` 또는 `surface` enum diff"만 보므로 **클라이언트 상수 변경은 탐지되지 않는다.**
- **C 탐지 무력화** — 1차 지적("로컬 e2e는 실환경 유실을 못 본다")이 REQ-7의 **서버측 합성 프로브 + `lead_ingest_expected_vs_received`** 로 해소 ✓. FORBID-1의 detect(수집 500/차단 mock 후 100ms 내 navigation)는 견고 ✓.
- **D 지름길 유도** — 봇 목록 축소는 W9 REQ-5로 이관되어 W6에서는 불가 ✓. 남은 지름길: REQ-6 상수 완화(위 B), 그리고 **`lead_event` 컬럼 부재를 만났을 때 "착수 중단" 대신 별도 테이블을 만드는 것** — out_of_scope가 금지하지만 F2b 변경 없이는 진행이 불가능하므로 압력이 확정적이다.
- **E DAG 정합성** — `depends_on: [W2, W3, W9, F2b, D4]` ✓, W9 `blocks`와 대칭 ✓, `blocks: [O1]` ↔ O1 `depends_on` ✓. done_when의 "W9 `detail_view` 뷰 실재 확인(없으면 착수 중단)"은 경계를 실행 가능한 형태로 표현한 좋은 예 ✓. 순환 없음.
- **F 존재 이유** — NSM 발생 지점으로 정당 ✓. **`traces_to: H6`은 실질 미기여** — `lead_conversion` 뷰의 코호트 축이 `price_block_present` 단일이라 리포트 보유 코호트 비교 산출물이 없다(§P-B). H7이 traces_to에서 빠지고 W9로 이관된 것은 정확 ✓.

**필수 수정 사항**
1. **`lead_event` 컬럼 계약을 F2b와 정합화** — `action_type`·`price_block_seen`·`visitor_id`·`session_id`가 화이트리스트에 없다. F2b 개정을 `depends_on` 선행 조건 표로 명시(C4·C7이 쓴 "선행 조건 — F2 스키마 개정" 형식이 정본).
2. **FORBID-4의 detect에 클라이언트 계측 상수(뷰포트 50%/1초, dedup 30초, `surface` 부여 규칙) 파일 diff를 포함** — 뷰 SQL diff만으로는 정의 변경을 잡지 못한다.
3. **H6 코호트 뷰를 W6 범위에 추가하거나 `traces_to`에서 H6 제거** — 현재는 참조만 있고 산출물이 없다.
4. `category_axis` → `category` 정정, FORBID-6의 D4 소스 경로 고정.
5. **`ops/alerts` 룰 파일을 `touches`에 추가** — O3가 W6 메트릭 룰을 이 계약으로 넘겼는데 path guard가 그것을 금지한다(§1-④).

---

## W7-CORRECTION-REQUEST — REVISE

**규격 위반**
- `[금지사항/요구사항] detect·acceptance 대상 부재 (착수 차단)` — **`correction_request` 테이블·`requires_takedown_review`·`contact_email`·`due_at`·`status` 를 정의하는 태스크가 계획 전체에 없다.** F2a는 코어 6테이블만(REQ-1 "정확히 6개"), F2b 산출물은 visibility/judgement/override/public_venue/price_conflict/venue_suppression/lead_event 뿐이다. **그런데 F2b는 `blocks`에 W7을 넣어 두었다** — 제공하지 않는 것을 unblock한다고 선언한 상태다.
- `[경계] 구현 경로가 상류 FORBID로 차단` — `app/api/corrections/**`가 `correction_request`에 쓰려면 DB 접근이 필요한데 F5 REQ-1·FORBID-1이 `apps/web` 전체의 DB import를 0건으로 강제하고 F5는 쓰기 함수를 제공하지 않는다(§P-H).
- `[경계] 도달 경로 미정의` — 폼으로 가는 링크를 어느 계약도 REQ로 갖지 않는다. W1 `layout.tsx`(푸터) 소유는 W1이고, W2·W3·W4·W5 어디에도 "정보 수정 요청 링크" REQ가 없다. rollback 서술만 "푸터의 문의 이메일"을 언급한다(1차 필수수정 #4 미반영).

**공격 결과**
- **A 악의적 준수** — 1차 치명("접수만 되고 처리되지 않는 경로가 계약상 정상 상태")은 W8 신설로 **형식상 해소**되었으나, W8이 실제로 takedown을 집행할 수 없어(§1-④) **실질은 미해소**. 재시도: ①**전량 거부·전량 마스킹 접수 폼**: REQ-5(정상 골든 20건 100% 접수, 본문 문자 단위 일치)가 차단 ✓ 원칙 2.5 모범. ②**아무도 찾을 수 없는 창구**: 도달 경로 REQ 부재로 **여전히 성립** — 폼이 존재하고 전 REQ를 충족하면서 유입이 0일 수 있다.
- **B 조건 회피** — FORBID-2의 `when`이 "유형과 무관하게" overdue 1건 이상으로 확대되어 1차의 takedown 한정 구멍이 닫혔다 ✓. REQ-3(삭제 요구 키워드 12표제어 트리아지 → due_at 7일 단축)이 "사용자가 유형을 잘못 고른 삭제 요구"를 포착한다 ✓ 우수. **미해소: REQ-8의 파기 조건이 여전히 `resolved/rejected` 전이 후 30일뿐** — `received`/`in_review`로 방치된 건의 `contact_email`은 영구 보존된다. 처리가 늦을수록 개인정보 보유가 길어지는 역설(1차 필수수정 #3 미반영).
- **C 탐지 무력화** — FORBID-1 detect가 `venue.visibility` 불변 + `venue_suppression` 행 증가 0으로 정정되어 1차의 `is_public` 유령 컬럼 문제 해소 ✓. FORBID-2의 "억제 플래그 정적 검사"는 여전히 무엇을 찾는지 불명확하나 앞단의 "유형 4종 overdue 픽스처에서 메트릭 > 0" 단언이 실질 방어 ✓. **FORBID-5(물리 삭제 금지)의 detect가 CI 정적 검사 + 파기 배치 후 행 수 불변으로 이중 ✓ 우수.**
- **D 지름길 유도** — **SLA 상수 상향 금지 조항이 여전히 없다.** REQ-2의 `+7일/+14일`을 코드에서 늘리면 overdue가 사라지고 W7·W8의 지표가 동시에 녹색이 된다. W8 FORBID-3은 **레코드별 `due_at` UPDATE**만 막고 산정 상수 변경은 막지 않는다(1차 필수수정 #5 미반영). REQ-6의 IP 해시 솔트 관리 규정도 여전히 없다.
- **E DAG 정합성** — `blocks: [W8]` ↔ W8 `depends_on: [W7,...]` 대칭 ✓(1차 비대칭 해소). `gate: null` + 근거 서술("공개 페이지 서비스 시점부터 필요, SEO 게이트 뒤에 둘 근거가 없다")이 명확 ✓ — 이 배치에서 gate 선언 근거가 가장 설득력 있다.
- **F 존재 이유** — `traces_to`에 H1·KM-price-coverage가 추가되어 "price_error 요청이 H1 '가격 확인됨' 판정의 오류율을 관측하는 유일한 외부 피드백"이라는 인과가 생겼다 ✓. **다만 그 피드백을 지표로 산출하는 계약이 없다** — O1의 6개 카드에 정정 요청 기반 오류율이 없고, W7 REQ-7은 overdue 건수만 노출한다. `traces_to: H1`은 서술로만 존재한다.

**필수 수정 사항**
1. **`correction_request` 스키마의 소유를 F2b 개정 요청 표로 명시**(C4·C7 형식) — 현재 F2b가 W7을 unblock한다고 선언하면서 테이블을 제공하지 않는다. **이 상태로는 착수 불가.**
2. **접수 API의 쓰기 경로를 F5 경계 안에서 확정** — `packages/api`에 쓰기 함수를 추가할지, `apps/web`에 예외를 둘지. 현행은 F5 `boundary` job에 확정적으로 걸린다(§P-H).
3. **폼 도달 경로를 REQ로 명시** — 상세·리스트 푸터 링크의 소유 태스크(W1 `layout.tsx`)를 지정. 없으면 창구 실효성 0.
4. **REQ-8의 파기 조건에 "미처리 상태 N일 경과" 분기 추가.**
5. **`due_at` 산정 상수(+7/+14) 상향 금지 FORBID 신설** — 지표를 지우는 최단 경로다.
6. **`ops/alerts` 룰 파일을 `touches`에 추가**(§1-④) — `correction_overdue` 알림을 만들 수 있는 계약이 하나도 없다.

---

## W8-CORRECTION-PROCESSING — REVISE (착수 차단 1순위)

**규격 위반**
- `[요구사항] acceptance 달성 불가 (치명)` — REQ-2 (b) "`public_venue` 조회 결과 0건". **F2b REQ-4와 C7 REQ-3의 뷰 정의 어느 쪽도 `venue_suppression`을 결합하지 않는다.** 서프레션 행을 넣어도 뷰는 변하지 않는다(§1-④).
- `[금지사항] 다른 계약과 정면 충돌` — C7 REQ-4가 `REQUEST_TAKEDOWN → hidden_request` 전이를 **W8 소유**로 지정 ↔ W8 FORBID-1이 `venue.visibility` 쓰기를 스스로 금지 ↔ F2b REQ-8/FORBID-4가 `admin_writer` 롤의 해당 UPDATE를 42501로 차단. **세 계약을 모두 지키면 takedown을 집행할 주체가 존재하지 않는다.**
- `[금지사항] detect 대상 부재` — REQ-2의 `venue_suppression(reason, actor_id, created_at)` ↔ F2b REQ-7의 실제 컬럼 `(correction_request_id, decided_at, decided_by, visibility_from, visibility_to)`. **`correction_action_log`·`resolution_note`·`reason_code` 를 정의하는 태스크가 계획 전체에 없다**(REQ-4·5·6과 FORBID-6이 전부 여기 걸려 있다).
- `[경계] 구현 경로가 상류 FORBID로 차단` — `app/api/internal/corrections/**`의 DB 쓰기가 F5 REQ-1에 걸린다(§P-H).
- `[경계] out_of_scope의 수신자 오지정` — "뷰가 서프레션을 결합하지 않으면 **C7** 변경을 요청"이라 적었으나 뷰 파일은 C7·F2b **공동 소유**이며 F2b REQ-4가 정의를 이미 고정했다.

**공격 결과**
- **A 악의적 준수 (치명)** — 전 REQ·FORBID를 준수하는 구현이 **삭제 요청을 처리했다고 기록하면서 실제로는 아무것도 내리지 않는다.** `venue_suppression` 1행 + `correction_action_log` 1행 + `status='resolved'` + 회신 1통이 남고, 업체는 계속 공개된다. REQ-8(스테이징 종단 e2e)이 "public_venue 조회 0건"을 검사하므로 CI에서는 실패하지만 — **실패하는 방법이 계약 안에 없다.** 개발 에이전트가 통과시킬 유일한 경로는 (a) 뷰를 몰래 수정(out_of_scope 위반), (b) `venue.visibility`에 직접 쓰기(FORBID-1 위반 + DB 권한 오류), (c) 테스트 완화. **셋 다 계약 붕괴다.**
- **B 조건 회피** — FORBID-2의 `when`(`price_error`/`info_error` ∧ `requires_takedown_review=false`)이 좁고 판정 가능 ✓ — "한 줄 오류를 업체 전체 비공개로 해결해 커버리지를 깎는" 경로를 정확히 겨냥한 우수 조항. FORBID-3의 `when`(`now > due_at` 인 건 처리)도 정확 ✓. **FORBID-3이 막지 못하는 것: `due_at` 산정 상수(W7 REQ-2) 자체의 상향** — 레코드별 UPDATE는 DB 트리거로 거부하지만 코드 상수를 바꾸면 신규 건의 기한이 전부 늘어난다.
- **C 탐지 무력화** — FORBID-1의 detect("C7 게이트 재실행 후에도 `public_venue` 조회 0건 유지")는 **재실행 전에 이미 0건이 아니므로 최초부터 실패**한다. FORBID-6(로그 insert 실패 주입 시 전량 롤백)은 조건·탐지 모두 견고 ✓ — 이 계약 최고 조항. FORBID-5(`source_record` 해시 불변)는 F2a REQ-5의 append-only 제약과 이중으로 맞물려 ✓.
- **D 지름길 유도** — 위 A의 (a)(b)(c). 추가로 REQ-5의 "resolution_note 20자 이상"은 공백·상수 문자열로 충족된다(O2 FORBID-3 같은 벌크 제한이 W8에는 없다 — **큐 120건을 상수 note로 30분에 전량 종결하는 것이 계약상 모범 준수**다).
- **E DAG 정합성** — `depends_on: [W7, C7, F2b]` ✓ 대칭, `gate: null` + 근거("법적 안전판이므로 게이트 뒤로 미루지 않는다") ✓. 순환 없음. **누락: 뷰 결합 규칙에 대한 의존이 계약으로 표현되지 않았다**(out_of_scope의 서술뿐).
- **F 존재 이유** — 공백을 소유한다는 선언 자체는 정확하고 필요하다 ✓. 그러나 **이 태스크가 완료되어도 takedown이 이행되지 않으므로 why("법적 부채 해소")가 달성되지 않는다.** 오히려 "처리했다는 기록"이 남아 방어가 더 불리해진다(W7 FORBID-2의 `because`가 서술한 리스크의 상위 버전).

**필수 수정 사항**
1. **최우선: `public_venue` 뷰의 서프레션 결합을 계약으로 확정** — (a) F2b REQ-4의 뷰 정의에 `venue_suppression LEFT JOIN ... AND released_at IS NULL → 제외`를 추가하도록 선행 조건 표로 요청하고, (b) C7 진리표에 서프레션 행을 추가하고, (c) 뷰 파일의 **단일 소유자를 F2b 또는 C7 중 하나로 확정**(현재 양쪽 `touches`에 있다). **이것 없이 W8을 전달하면 "처리 기록만 남고 실제로는 내려가지 않는" 구현이 만들어진다.**
2. **C7 REQ-4 ↔ W8 FORBID-1 충돌 해소** — `hidden_request` 전이의 집행 주체를 하나로 확정(권고: W8은 서프레션만 쓰고, C7 REQ-4의 "W8 소유" 문구를 서프레션 기반으로 수정).
3. **REQ-2의 `venue_suppression` 컬럼을 F2b REQ-7 실제 컬럼과 일치시키고, `correction_action_log`·`resolution_note`·`reason_code`를 F2b 개정 요청 표로 명시.**
4. **REQ-3(해제)의 `released_at`이 F2b FORBID-6(서프레션 행 UPDATE·DELETE 거부)과 충돌** — 해제를 "새 이벤트 행"으로 표현하도록 정정(F2b FORBID-6이 요구하는 형식).
5. **벌크 종결 제한 FORBID 신설**(O2 FORBID-3 동형) — 상수 note로 큐를 일괄 종결하는 경로가 열려 있다.
6. `ops/alerts` 룰 파일을 `touches`에 추가(SLA·overdue 알림).

---

## W9-OBSERVABILITY-EVENTS — REVISE

**규격 위반**
- `[금지사항] detect 대상 부재 (치명)` — done_when이 "`lead_event`의 `visitor_id`·`session_id`·`event_version` 컬럼 실재 확인"을 요구하는데 **F2b REQ-8 화이트리스트에는 `session_hash`만 있고 `visitor_id`·`session_id`는 없다.** 또한 `detail_view`의 7속성(`has_editor_report`·`price_block_present`), `filter_applied`의 `tag_ids[]`·`result_count` 를 담을 컬럼도 없으며, **F2b는 이벤트 저장을 `lead_event` 단일 테이블로 규정**한다.
- `[요구사항] 검증 없는 필수 속성` — REQ-3의 acceptance는 "7개 속성 결손 0건"과 `has_editor_report` 값 일치만 검사한다. **`price_block_present`의 기대값 검증이 없다** — H4 코호트 축 전체가 이 속성에 걸려 있는데 상수로 채워도 통과한다.
- `[요구사항] 지표 정의 미완` — REQ-4가 `filter_applied` 이벤트를 정의하지만 **H5("방문자의 25% 이상")의 분모(전체 세션·방문자 수)를 산출하는 REQ가 없다.** `filter_usage_daily` 뷰의 분모 규정이 어디에도 없다.
- `[요구사항] R-6 부분 위반` — REQ-5의 봇 판정은 품질 임계형인데 평가 픽스처(봇 UA 20 + 정상 UA 20)를 구현자가 만들고 홀드아웃이 없다.
- `[경계] 구현 경로가 상류 FORBID로 차단` — `middleware.ts`의 `editor_report` 조회와 `api/events/ingest`의 INSERT가 F5 REQ-1에 걸린다(§P-H). F5의 공개 함수 2종은 `has_editor_report`를 제공하지 않는다.

**공격 결과**
- **A 악의적 준수** — ①**`price_block_present` 상수화**: 위 규격 위반 참조. **H4 판정이 무효화되는데 W9·W6 어느 테스트도 붉어지지 않는다.** ②**전량 봇 판정으로 지표 0**: REQ-5 (c) "정상 UA 픽스처 20건이 `is_bot=false`(전량 봇 판정 시 실패)"가 차단 ✓ 원칙 2.5. ③**이벤트 0건**: REQ-8 하트비트가 "수집 중단 주입 시 값 0으로 관측되어 실패"까지 요구 ✓. ④**분모 부풀리기(신규)**: REQ-3이 "상세 라우트 요청 1회당 `detail_view` 1건"이라 **Next.js 프리페치·RSC 재요청이 전부 분모로 계산**된다. 봇 판정은 UA·headless·분당 60건 초과만 보므로 프리페치는 정상 방문으로 남고, **H4 전환율 분모가 구조적으로 부풀려진다.**
- **B 조건 회피** — FORBID-2의 `when`(클라이언트가 서버 산출 필드를 보낸 경우)이 정확하고 detect(위조 페이로드 3종에서 서버값 덮어쓰기 확인)가 실효적 ✓ — 1차 W6의 "클라이언트가 자기 봇 여부를 신고" 문제를 정확히 닫았다. FORBID-6(`session_id`를 `visitor_id` 대체값으로 쓰지 않기 + `unidentified_sessions` 분리)은 H7 과소추정을 막는 정밀한 조항 ✓ 이 배치 최고 수준.
- **C 탐지 무력화** — FORBID-1의 pii-guard(스키마 필드명 금지목록 + 저장 페이로드 100건 정규식 + 솔트 환경변수 로드 단위테스트)는 F2b FORBID-5의 컬럼 화이트리스트와 맞물려 이중 ✓. **FORBID-3의 "파생 뷰 3종의 `event_version` WHERE 절 존재 검사"는 정적 검사라 뷰가 존재하지 않으면 공허**하지만 REQ-7 골든 쿼리가 뷰 실재를 요구하므로 보완됨 ✓.
- **D 지름길 유도** — 봇 규칙 오탐이 나면 UA 목록을 줄이는 방향으로 조정되고 이를 막는 조항이 없다(FORBID-4는 raw 보존만 강제). 홀드아웃이 없어 규칙 완화가 자기 픽스처로 정당화된다. 또한 **`middleware.ts`에서 DB를 못 읽는다는 사실을 만나면 `has_editor_report`를 클라이언트 힌트나 상수로 대체하는 것이 최단 경로**이며, 그러면 H6 코호트 속성이 통째로 허구가 된다.
- **E DAG 정합성** — `depends_on: [W1, F5, F2b]` / `blocks: [W6, O1]` 대칭 ✓. **누락 의존 2건: (a) `has_editor_report`가 F2a `editor_report` 테이블에 의존하는데 `depends_on`에 F2a가 없다**(W5 out_of_scope는 코호트 속성을 W9로 넘겼고, W5 `blocks: []`의 근거도 "F2a에서 파생"이다), **(b) `price_block_present`가 요금제·가격 상태에 의존하는데 F6·W3 의존이 없다.**
- **F 존재 이유** — H7은 완전히 해소 ✓, H4·H5는 기반만 제공(판정 완결은 O1·W6 몫인데 O1에 H4 카드가 없고 H5 분모가 미정의), **H6은 속성 1개뿐이고 비교를 산출하는 계약이 없다.** `traces_to`의 4개 가설 중 실제로 판정 가능해진 것은 1개다.

**필수 수정 사항**
1. **REQ-3에 `price_block_present`의 산출 규칙과 기대값 검증을 추가**하고, 그 규칙을 W3의 렌더 조건과 상호 참조로 고정 — H4 코호트의 유일한 소스다.
2. **이벤트 저장 스키마를 F2b와 정합화** — 4종 이벤트의 속성을 담을 컬럼/테이블 구조를 F2b 개정 요청 표로 명시(`lead_event` 단일 테이블 + 7컬럼 화이트리스트로는 불가능).
3. **H5의 분모를 REQ로 정의** — `filter_usage_daily`가 "필터 사용 세션 ÷ 전체 세션"임을 수식으로 고정. 현재 분모가 없다.
4. **REQ-3의 분모에서 프리페치·RSC 재요청을 제외하는 조건 명시**(예: `Sec-Purpose: prefetch`·`RSC` 헤더 제외).
5. **REQ-5에 홀드아웃 UA 셋 분리(R-6)** 및 봇 규칙 완화 금지 조항.
6. `depends_on`에 F2a·F6 추가, `has_editor_report` 조회 경로를 F5 함수로 확정(§P-H).

---

## O1-METRICS-DASHBOARD — REJECT

**규격 위반**
- `[구조] 전 REQ가 존재하지 않는 정본 위에 서 있음 (REJECT 사유 1)` — REQ-1·4·5와 FORBID-1·5가 **`docs/metrics/registry.yaml`(F1 소유)** 을 정본으로 삼는다. **F1 `touches`에는 `docs/registry/ids.yaml` 만 있고**(3필드: id·정의·출처), `threshold`·`bands`·`min_n`·`n_unit` 4필드를 가진 지표 레지스트리는 계획 어디에도 없다. 게다가 F1 out_of_scope가 "**PRD·Lean Canvas에 없는 신규 지표를 창설하는 것**"을 배제하므로 `KM-override-public-ratio`(어느 문서에도 없다)는 F1이 만들 수 없다 → **REQ-1의 "대칭차집합 0"이 원리적으로 불가능.** O1 done_when의 "없으면 착수 중단"은 영구 대기를 의미한다.
- `[구조] gate 가 존재 이유와 역행 (REJECT 사유 2)` — `gate: G4`. why는 "게이트 판정(G1 포함)과 가설 판정을 단일 정의로 관측"이고 REQ-2가 **G1 3구간 판정**을 산출한다. **G1은 Discovery(D1b)와 Phase 2에서 이미 내려지고, G4는 그 뒤다.** G4 통과 후 착수하는 대시보드가 G1 판정에 기여할 수 없다. 1차 지적 미해소.
- `[요구사항] 핵심 지표의 정의를 계약 밖에 위임 (REJECT 사유 3)` — REQ-7이 `KM-price-coverage`를 "C7 리포트 값과 일치"로 정의하고, C7 REQ-8의 분모는 **공개 venue 수**다. `NO_PRICE` 업체가 분모에서 자동 제거되어 **커버리지가 구조적으로 임계를 통과**한다(§P-B). FORBID-1은 이 상태에서 "PRD 40%와 일치"를 단언하며 녹색이 된다. **게이트 대시보드가 게이트를 항상 통과시키는 구조.**
- `[경계] 구현 경로가 상류 FORBID로 차단` — `packages/metrics`가 `definitions/*.sql`을 실행하려면 DB 접근이 필요하고 F5 REQ-1에 걸린다(§P-H).

**공격 결과**
- **A 악의적 준수** — 1차 치명("5개 카드 전부 `unavailable`이 100% 준수")은 **REQ-6 (b)(정상 픽스처에서 6/6 `ok`) + REQ-8(스테이징 실데이터에서 ok 카드 ≥5, 값이 픽스처 상수와 동일하면 실패)로 해소 ✓** — 이 배치에서 가장 잘 설계된 R-7 조항 중 하나. 재시도: **레지스트리의 `min_n`을 크게 잡으면 전 카드가 `insufficient_sample`** 이 되는데, 그 값을 O1이 아닌 F1 레지스트리가 정하고 O1은 "로드·검증만"이라 **O1의 어떤 FORBID도 `min_n` 설정값을 제약하지 않는다**(FORBID-1이 대조하는 것은 threshold·bands뿐). 규격 §3.4 "사후 완화만 막고 **사전 설정은 무방비**"에 해당.
- **B 조건 회피** — FORBID-5의 `when`이 "**지표 미달 여부와 무관**하게 diff가 포함된 PR"로 확대되어 1차의 "미달 판정 불가 시 `when` 미발동" 구멍이 닫혔다 ✓ 우수. FORBID-2의 `when`(예외·0행)도 좁고 판정 가능 ✓.
- **C 탐지 무력화** — FORBID-1의 detect가 "문서 마크다운 파싱"에서 "레지스트리 ↔ **F1이 고정한 PRD 스냅샷** 대조"로 교체되어 1차의 "문서 한 줄 고치면 CI가 깨진다"가 해소 ✓. **그러나 그 스냅샷을 만드는 REQ가 F1에 없다** — 대조 대상 부재.
- **D 지름길 유도** — 위 A(`min_n` 사전 설정). 추가로 REQ-8의 "ok ≥5"에 걸리면 최단 경로는 **`min_n`을 낮추거나 rolling 기간을 늘리는 것**인데, 기간·min_n은 레지스트리에 있고 FORBID-5가 CODEOWNERS 승인을 요구하므로 부분 방어 ✓.
- **E DAG 정합성** — `depends_on: [F1, F2b, C7, W6, W9]` ✓ 전부 대칭. `parallel_with`의 주석("O2 미머지 시 `KM-override-public-ratio` 값 0")이 정확한 접합면 서술 ✓. **문제는 `gate: G4`(위)** 와, O1 `touches`에 지표 API 경로가 없는데 REQ-3이 "API 라우트의 인라인 SQL 0건"을 검사한다는 점(라우트를 `(internal)/metrics-dashboard/` 안에 코로케이트하면 glob 안이므로 치명적이지는 않으나 명시가 필요).
- **F 존재 이유** — 6개 카드 중 **H4(전환율 비교) 카드가 없다.** `traces_to`에 H4를 적었으나 W6 `lead_conversion` 뷰를 렌더하는 REQ가 0건이다. H6도 없다. `KM-search-to-detail-ctr`를 소스 부재로 정직하게 제외한 것은 ✓. **결과적으로 "출시 후 가설 판정 대시보드"인데 H4·H6을 표시하지 않는다.**

**필수 수정 사항 (REJECT — 아래 1·2 없이는 전달 불가)**
1. **지표 레지스트리의 실재를 확보** — F1 계약에 `docs/metrics/registry.yaml`(threshold·bands·min_n·n_unit) 생성 REQ를 추가하도록 요청하고 O1 `depends_on`의 선행 조건 표로 명시. **동시에 F1 out_of_scope(신규 지표 창설 금지)와 `KM-parse-success`·`KM-override-public-ratio` 등 신규 ID의 관계를 정리**해야 한다. 현재는 O1이 영구 착수 불가다.
2. **`gate: G4` 제거** — G1 3구간 판정을 산출하는 대시보드가 G4 이후에 착수하면 존재 이유가 소멸한다. C7과 동일하게 `[G1, G3]` 또는 단계 분리(파이프라인 지표 카드 선행 / 이벤트 지표 카드 후행).
3. **`KM-price-coverage`의 분자·분모를 계약 본문에 수식으로 고정** — "분모 = 수집된 canonical 업체 전체(비공개 포함)". C7 REQ-8의 공개 업체 분모를 그대로 쓰면 G1이 구조적으로 통과한다.
4. **`min_n`·집계 기간의 허용 범위를 계약 본문에 못박기**(규격 §3.4 사전 설정 방무). 현재 상한이 없어 전 카드 `insufficient_sample` 상태를 합법적으로 만들 수 있다.
5. **H4(전환율 코호트) 카드 추가 또는 `traces_to`에서 H4 제거.**
6. 지표 쿼리 실행 경로를 F5 경계 안에서 확정(§P-H).

---

## O2-REVIEW-ADMIN — REVISE (1차 REJECT에서 상향)

**규격 위반**
- `[구조] gate 가 존재 이유와 역행` — `gate: G4`. why는 "C7이 비공개로 묶은 레코드를 되살리는 경로가 없으면 가격 커버리지가 **H1 게이트를 인위적으로 미달**시킨다"인데, G4 통과 후 착수하면 그 미달을 막을 수 없다. **1차 REJECT 사유 중 유일하게 미해소.**
- `[요구사항] 저장 레이어 부재` — FORBID-4가 전제하는 **"검수자의 스코어 입력값(가격 수치·소스 목록·수집일) 수정"과 REQ-5의 "오버라이드 레이어에만 기록"이 양립할 테이블이 없다.** F2b `venue_visibility_override`는 `(venue_id, decision, approver_ids, reason_code, reason_text, created_at)` 뿐이고 가격 필드가 없다. W8 FORBID-2("정정은 오버라이드 레이어에만 기록")도 같은 부재를 공유한다.
- `[금지사항] detect 대상 부재` — REQ-2·FORBID-5의 **`review_audit_log`** 테이블이 F2a·F2b 산출물에 없다. FORBID-6의 `category_axis`(실제는 `category`). FORBID-6의 "D4 가드레일 재검사" 소스 경로 미기입.
- `[경계] 구현 경로가 상류 FORBID로 차단` — `app/api/internal/review/**`의 DB 쓰기·비공개 레코드 SELECT가 F5 REQ-1에 걸린다(§P-H). C7 FORBID-1도 `apps/web`의 `review_override` 직접 조회를 금지하는데 검수 큐는 정의상 그것을 봐야 한다.

**공격 결과**
- **A 악의적 준수** — 1차 치명("수동 입력으로 `confidence=0.99`를 넣어 `when` 자체를 소멸시켜 단독 승인")은 **REQ-4·FORBID-1이 "사유코드 6종 **무관**" 2인 승인으로 확대되고 F2b REQ-3이 `approver_ids` cardinality ≥2 + 중복 금지를 DB CHECK로 강제하면서 닫혔다 ✓.** FORBID-4가 "입력값 수정 후 **C7 재판정 없이 동일 세션 승인 시 409**"까지 요구한다 ✓. 재시도: ①**전량 반려로 큐 비우기**: REQ-6(골든 큐 20건 2인 승인 전건 공개)이 차단 ✓. ②**벌크 승인**: FORBID-3(60분 20건 초과 429)이 차단 ✓ — 1차 D 지적("note 20자는 상수 붙여넣기로 충족")을 정확히 겨냥한 신설 조항. ③**남은 경로**: 검수자가 가격 수치를 수정한 뒤 C7 재판정을 트리거하면, **재판정의 입력이 된 `confidence`를 누가 산출하는지 규정이 없다.** C4가 산출한 값이 그대로면 재판정 결과도 동일하고, 검수자가 수정 시 confidence를 지정할 수 있다면 FORBID-1 우회가 부활한다. 1차 필수수정 #4("수동 입력 레코드는 confidence 상한 0.69 = 항상 estimated")가 반영되지 않았다.
- **B 조건 회피** — REQ-1의 큐를 `visibility='hidden_quality'`로 좁혀 `hidden_request`·`hidden_legal`을 배제 ✓, C7 FORBID-6이 이중 차단 ✓ → **1차의 "삭제 요청 레코드를 커버리지 명목으로 되살리기" 경로 해소 ✓.** **단 F2b REQ-4의 뷰 규칙은 `force_public`이 `hidden_request`를 이기도록 쓰여 있어**(§P-C), UI가 아닌 데이터 레이어에서는 여전히 부활 가능하다.
- **C 탐지 무력화** — FORBID-2의 detect가 "CI 정적 검사 + **C7 재실행 후 오버라이드 결과 유지 통합테스트**"로 이중화 ✓. FORBID-5(어드민 롤의 `review_audit_log` UPDATE/DELETE 시 42501)는 F2b FORBID-6과 맞물려 견고 ✓ — **다만 대상 테이블이 스키마에 없다.** FORBID-6의 "최종 상태 기준 재검사(수정→승인 2단계 우회 차단)"는 검사 시점을 정확히 지정한 우수 조항 ✓.
- **D 지름길 유도** — REQ-3의 "note 20자"는 여전히 공백 20자로 충족되나 FORBID-3의 속도 제한이 실질 억제 ✓. REQ-7의 "동일 자연인 2계정" 문제는 조직 이메일 도메인 유일성 + 별칭(+태그) 409로 해소 ✓ (1차 D 지적 반영).
- **E DAG 정합성** — `depends_on: [C7, F2b, D4]` ✓, W7 `blocks: [O2]` 비대칭이 W8 신설로 정리됨 ✓, `parallel_with: [O1, W8]` ✓. **`gate: G4` 만 역행**(위).
- **F 존재 이유** — 판정/오버라이드 분리 구조가 확정되어 1차의 "무엇을 산출해야 하는지가 계약 안에서 결정되지 않는다"는 해소 ✓. REQ-8의 `override 공개 비율` 지표는 "사람이 게이트를 얼마나 뒤집는가"를 관측하는 좋은 자기감시 장치 ✓.

**필수 수정 사항**
1. **`gate` 를 G4에서 제거**(C7과 동일하게 `[G1, G3]`) — 존재 이유와 시간 순서가 모순이다. 1차 지적 미해소.
2. **"수정" 액션의 저장 레이어를 확정** — F2b에 정정값 테이블(예 `venue_field_override`)을 요청하거나, 수정 액션을 범위에서 제외. 현재 FORBID-4·REQ-5·W8 FORBID-2가 존재하지 않는 레이어를 전제한다.
3. **`review_audit_log` 를 F2b 개정 요청 표로 명시** — REQ-2와 FORBID-5 전체가 이 테이블 위에 있다.
4. **수동 입력·정정 레코드의 `confidence` 상한을 명시**(예 ≤0.69로 고정 = 화면에서 항상 `estimated`) — 재판정 입력 조작 경로가 남아 있다.
5. `category_axis` → `category`, FORBID-6의 D4 소스 경로 고정.
6. **F2b REQ-4의 뷰 규칙에 "`hidden_request`·`hidden_legal`은 `force_public`으로 뒤집히지 않는다"를 반영하도록 요청**(C7 진리표가 정본).

---

## O3-DEPLOY-MONITORING — REVISE

**규격 위반**
- `[금지사항] detect 대상 부재 (핵심)` — REQ-4·FORBID-1의 detect가 "룰의 metric 필드를 **메트릭 저장소에 질의**"하는데, **메트릭 수집기·저장소·스크레이프 설정을 소유하는 태스크가 계획 전체에 없다.** O3 `touches`(워크플로·`ops/alerts`·프로브·롤백 스크립트·`/api/version`·에러 리포터)에도 F1에도 없다. W6·W7·W8·W9·O2는 전부 "내부 메트릭 노출까지"로 out_of_scope를 끊었다.
- `[경계] out_of_scope의 수신자가 그것을 받을 수 없음` — "W6·W7·W8·W9가 생산하는 메트릭에 대한 알림 룰 — **각 태스크가 `ops/alerts` 규약에 따라 룰 파일을 추가**한다". **네 계약 어디에도 `ops/alerts/**`가 `touches`에 없고, 넷 다 done_when에 "touches 밖 파일 변경 0건(CI path guard)"을 걸었다.** 규격 §5 "`on_violation: block_merge` 인데 집행할 CI job이 없음"의 변종 — 집행할 룰을 만들 계약이 없다.

**공격 결과**
- **A 악의적 준수** — 1차 치명("존재하지 않는 메트릭을 참조하는 룰 4개를 YAML로 선언하면 REQ-4·done_when 통과, 알림은 영원히 발화하지 않음")은 **REQ-4의 3조건(24h 데이터포인트 ≥1 · 합성 주입 시 채널 실제 도달 · `suppress_minutes` 필드) + FORBID-1로 닫혔다 ✓.** 재시도: **룰을 0개 등록하면 "등록된 룰 전수"에 대한 검사가 vacuous하게 통과한다.** REQ-6이 H3 룰 3종을 절대 요구하므로 최소 3개는 보장되지만(원칙 2.5 짝 역할 ✓), **W6~W9 메트릭 룰은 위 경계 문제로 영구히 0개**다. 즉 **"알림이 오지 않는 것과 정상인 것을 구분할 수 없다"는 `because`가 정확히 그 영역에서 재현된다.**
- **B 조건 회피** — FORBID-4가 무음화 5경로(삭제·임계 상향·**평가 윈도우 확대**·**라벨 셀렉터 축소**·**`enabled:false`**)로 확대되어 1차의 "억제 창만 늘리면 통과" 구멍이 닫혔다 ✓ 우수. 잔존: **`suppress_minutes` 값 자체의 상한이 계약에 없다.** FORBID-4는 "diff 시 라벨+승인"을 요구할 뿐 값의 허용 범위를 못박지 않아, **최초 등록 시점에 `suppress_minutes: 1440`으로 설정하면 승인 절차 없이 사실상 무음**이다(규격 §3.4 "사전 설정 무방비").
- **C 탐지 무력화** — REQ-5의 데드맨이 "**알림 채널과 무관한 외부 경로**(스케줄 워크플로 실패 통지)"로 명시되어 **자기 감시 순환이 끊겼다 ✓** (1차 지적 정확히 해소). REQ-1의 드리프트 체크도 GitHub Actions 잡 실패로 기록 ✓. FORBID-6의 detect("`beforeSend` 훅이 body/cookie/query 키 제거")는 여전히 **키 이름 기반**이라 중첩 객체·커스텀 컨텍스트에 담긴 W7 폼 본문은 통과한다(1차 지적 미반영).
- **D 지름길 유도** — REQ-3의 drain 10분·REQ-7의 300초 상한을 **하향/상향하는 것을 막는 조항이 여전히 없다**(FORBID-4는 `ops/alerts`만 커버). CI가 느려지면 drain 대기를 줄이는 것이 최단 경로이고, 그러면 FORBID-2의 보호가 실질적으로 무력해진다(1차 필수수정 #7 미반영).
- **E DAG 정합성** — `depends_on: [F1]`, `parallel_with`에서 폐기 F3 제거 ✓, `gate: null` ✓. **시간 순서 모순 해소 ✓** — W6·W7 메트릭 룰을 out_of_scope로 내보내 B2 착수 시점에 존재하지 않는 메트릭을 참조하지 않게 되었다(다만 그 결과가 orphan화, 위). **신규 충돌: REQ-1("main 머지 시 자동 배포")이 W4 done_when의 "G4 이후 별도 배포로 색인 활성화" 안전장치를 무효화한다**(§W4).
- **F 존재 이유** — 배포 분리·drain·마이그레이션 가드·롤백 리허설은 실질 가치가 명확 ✓. REQ-6의 H3 외부 프로브 3종(sitemap URL 수 -30% · 4xx/5xx 1% 초과 · robots 해시 변경)은 `traces_to: H3`를 실제로 뒷받침한다 ✓. **그러나 why의 "장애가 사람에게 도달하는 경로"는 메트릭 저장소 부재와 룰 orphan화로 절반만 달성된다.**

**필수 수정 사항**
1. **메트릭 저장소·수집 경로의 소유를 확정** — O3 범위에 편입하거나 별도 태스크 신설. 없으면 REQ-4·FORBID-1의 detect가 질의할 대상이 없다.
2. **W6·W7·W8·W9 메트릭 룰의 소유 방식을 실행 가능하게 정정** — (a) 각 계약의 `touches`에 `ops/alerts/<metric>.yml` 추가를 상신하거나, (b) O3가 룰까지 소유하고 "메트릭 배포 후 후속 PR"로 순서를 규약화. **현재는 어느 계약도 만들 수 없어 `correction_overdue` 알림이 존재하지 않는다 — 법적 방치 경로의 유일한 자동 탐지 수단이다.**
3. **`suppress_minutes`의 허용 상한을 계약 본문에 못박기**(예 ≤60분, 상태형 알림은 별도 정책) — 최초 설정으로 무음화하는 경로가 열려 있다.
4. **drain 대기(10분)·롤백 상한(300초) 상수의 완화 금지 조항 추가.**
5. FORBID-6의 detect를 키 이름 기반에서 **페이로드 재귀 스캔 + 값 패턴(이메일·전화·본문 길이) 검사**로 격상.
6. **REQ-1의 자동 배포와 W4의 G4 색인 게이트를 정합화** — 현재 W4의 안전장치는 집행 수단이 없다.

---

## 4. 종합 — 체계적 결함 패턴 (2차)

### 해소된 패턴 (1차 → 2차)

| 1차 패턴 | 상태 |
|---|---|
| **P1 `is_public` 유령 컬럼(7건)** | **해소 ✓** 전 계약이 `visibility` ENUM으로 정합화, F2b가 정본을 제공 |
| **P2 픽스처 세계 탈출 실패(9/10)** | **해소 ✓** 12건 중 11건이 스테이징 실환경 하한 REQ 보유(R-7) |
| **P3-1 W3 상세 API 무방비** | **해소 ✓** W3 FORBID-1 + F5 REQ-3/FORBID-3 이중 |
| **P3-2 캐시 무효화 소유자 부재** | **부분 해소 △** `revalidate ≤3600`이 전 표면에 강제되어 무기한 서빙은 소멸. **즉시 무효화 호출자는 여전히 공백** |
| **P3-3 O2 수동 override로 2인 승인 우회** | **해소 ✓** 사유코드 무관 확대 + F2b DB CHECK |
| **P5 medical FORBID의 `when` 판정 대상 3갈래** | **부분 해소 △** `category`(F2a 실재)로 수렴 중이나 W5·W6·O2가 여전히 `category_axis` 사용. **W1에 medical 메타 가드레일 신설 ✓** |
| **P8 자기 출제·자기 채점(R-6)** | **대부분 해소 ✓** W3 REQ-7(해시 정렬 표집+홀드아웃) · W4 REQ-4(전수) · C4/F6(홀드아웃 봉인). **잔존: W9 REQ-5 봇 픽스처** |

### 잔존·신규 패턴

**Q1. 스키마 부재가 소유자만 바꿔 재현했다 (7개 객체 · 5개 계약 착수 차단)**

1차 P1이 `is_public` 하나였다면, 2차는 **테이블 단위**로 옮겨갔다. 아래는 전부 "detect·acceptance가 참조하는데 F2a·F2b 어디에도 없는" 객체다:

| 객체 | 요구 계약 | 상태 |
|---|---|---|
| `correction_request`(+`requires_takedown_review`·`due_at`·`contact_email`) | W7 전체 · W8 REQ-1 | **부재** — F2b는 W7을 `blocks`에 넣고도 미제공 |
| `correction_action_log` | W8 REQ-4 · FORBID-6 | **부재** |
| `review_audit_log` | O2 REQ-2 · FORBID-5 | **부재** |
| `visibility_change_event` | C7 REQ-7 · W1 REQ-7의 트리거 | **부재** |
| 정정값 저장 레이어 | O2 FORBID-4 · W8 FORBID-2 | **부재** |
| `lead_event`의 `action_type`·`price_block_seen`·`visitor_id`·`session_id`·`tag_ids`·`result_count` | W6 REQ-1·4 · W9 REQ-3·4·7 | **화이트리스트 밖**(F2b FORBID-5가 추가를 차단) |
| `venue_suppression`의 `reason`·`actor_id`·`created_at` | W8 REQ-2 | **컬럼 불일치** |

C4·C7은 "**선행 조건 — F2 스키마 개정(미충족 시 착수 금지)**" 표를 계약 상단에 두어 이 문제를 명시적으로 처리했다. **W6·W7·W8·W9·O2는 done_when 한 줄("없으면 착수 중단")로만 처리했고, 그 결과 F2b는 자기가 제공하지 않는 것을 `blocks`에 선언한 상태다.** C4/C7 형식을 전 계약에 강제해야 한다.

**Q2. 경계 FORBID가 다시 운영 기능을 구현 불가로 만든다 (1차 P4의 재현, 소유자만 C7→F5)**

F5 REQ-1/FORBID-1이 리포지토리 전체의 DB 접근을 `packages/api`로 독점시키면서 **쓰기 함수를 제공하지 않는다.** W7(접수)·W8(처리)·W9(이벤트 수집)·O2(오버라이드)·O1(지표 쿼리) 다섯이 착수와 동시에 `boundary` job에 걸린다. **예외는 확정적으로 발생하고, 예외를 파는 순간 공개면 보호도 함께 협상 대상이 된다**(원칙 2). 근본 해법은 접근 통제를 **경로가 아니라 DB 롤 단위**로 옮기는 것이며, F2b가 이미 롤 3종(`pipeline_writer`·`admin_writer`·`web_reader`)을 정의해 두었으므로 재료는 있다 — F5가 그것을 쓰지 않고 경로 금지에 의존하는 것이 문제다.

**Q3. detect 소스 경로가 실물과 다르다 (D4 · 9개 계약)**

`docs/discovery/D4/forbidden_lexicon.yaml`·`medical_scope.yaml`·`display_whitelist`는 존재하지 않는다. 실물은 `packages/legal/medical/**`이고 하류 인용 정본은 `dist/exported_rules.json`이다. **존재하지 않는 파일을 정규식 소스로 삼는 렌더 스캔은 위반이 있어도 0건을 보고한다.** 의료광고법 방어선 전체(W1·W2·W3·W4·W5·W6·O2 + C4·C6·F4)가 이 경로 위에 서 있다. **1건의 일괄 치환으로 닫히는 결함이며, 방치 시 "서비스 전체 중단"급 리스크가 무검증 상태로 남는다.**

**Q4. 계약 간 상호 위임으로 생긴 공백 5건 (개별 계약은 아무도 위반하지 않는다)**

1차의 P9와 동일한 실패 양식이 **다른 항목들로** 재현했다.

| # | 공백 | A가 넘긴 곳 | B의 상태 |
|---|---|---|---|
| 1 | **캐시 무효화 호출** | W1 → "C7·W8" | C7 → "W1", W8에 REQ 없음 |
| 2 | **W6~W9 메트릭 알림 룰** | O3 → "각 태스크" | 네 계약 모두 `touches`에 `ops/alerts` 없음 + path guard |
| 3 | **메트릭 저장소** | 각 계약 → "메트릭 노출까지" | O3에 없음 |
| 4 | **에디터 리포트 콘텐츠 생산** | W5 out_of_scope | 소유 태스크 없음 (REQ-8과 데드락) |
| 5 | **정정 요청 폼 도달 경로** | W7 touches 밖 | W1·W2·W3 어디에도 REQ 없음 |

**Q5. `gate` 역행 2건과 Phase 3 게이트 선언 2갈래**

- O1·O2의 `gate: G4`가 각자의 존재 이유(G1 판정 관측 / G4 미달 방지)와 시간 순서상 모순 — **1차 지적 그대로 남아 있다.**
- Phase 3에서 W1~W4는 `[G1,G2,G3]`, W5~W9는 `null`. **W5·W6의 주석은 "W1·W2·W3와 동일 규약"이라 적었으나 사실과 반대다.** 실피해는 작지만, 게이트 선행 검사를 자동화하면 두 갈래 중 한쪽이 반드시 오판된다.

**Q6. 원칙 2.5는 정착했으나, "비율형 짝 REQ"라는 새 우회가 생겼다**

W2 REQ-7("숫자 가격 렌더 카드 수 == 그 20건 중 confirmed 수")처럼 **분자·분모가 함께 0이 되는 동등식**은 제품이 사라진 상태에서 자동 충족된다. W3 REQ-7(골든 40건 절대 건수)·W4 REQ-8(총 30건)·F5 REQ-5(20건)·F6 REQ-5(40건)·F2b REQ-5(25건)는 전부 **절대 건수**라 안전하다. **짝 REQ는 비율이 아니라 절대 하한이어야 한다**는 규칙을 규격 §원칙 2.5에 추가할 것을 권고한다.

---

## 5. 전달 전 필수 조치 (우선순위)

1. **W8 — `public_venue` 뷰의 `venue_suppression` 결합 확정 + 뷰 파일 단일 소유자 지정(F2b/C7 중 1개) + C7 REQ-4와의 전이 주체 충돌 해소.** 이것 없이 W8을 전달하면 **"처리했다는 기록만 남고 실제로는 내려가지 않는" 구현**이 만들어진다. 접수 이력과 처리 이력이 모두 남은 채 업체가 계속 공개되는 상태는 1차의 "방치"보다 법적으로 불리하다.
2. **알림 룰 orphan 해소(O3 + W6·W7·W8·W9)** — `correction_overdue`를 감시하는 룰을 만들 수 있는 계약이 하나도 없다. 미처리 자동 탐지가 여전히 0이다.
3. **Q1 스키마 부재 7객체 일괄 정리** — C4·C7의 "선행 조건 — F2 스키마 개정" 표 형식을 W6·W7·W8·W9·O2에 강제. 현재 다섯 계약이 착수 즉시 대기 상태가 된다.
4. **Q3 D4 경로 일괄 치환**(9개 계약) — 1건의 치환으로 의료광고법 방어선 전체의 detect가 실효화된다.
5. **O1 REJECT 해소** — 지표 레지스트리 실재 확보 + `gate: G4` 제거 + `KM-price-coverage` 분모 수식 고정. 분모를 고치지 않으면 **G1이 3구간 판정을 정확히 구현한 채로 항상 `pass`** 가 된다.
6. **Q2 F5 경계 재설계** — 경로 금지에서 DB 롤 기반 통제로. F2b의 롤 3종을 활용하면 5개 계약의 예외 압력이 사라진다.
7. **W4 REQ-2에 태그 보유 검증 추가** — 남은 doorway 경로의 본체.
8. **W9 `price_block_present` 기대값 검증 + W3와의 정의 공유** — H4 판정의 유일한 코호트 축이 무검증 상태다.
9. **W5 REQ-8 데드락 해소** — 현 상태는 EXIF 조작을 유도한다.
10. **O1·O2의 `gate: G4` 제거**, Phase 3 게이트 선언 통일, W2 REQ-7의 절대 하한화.
