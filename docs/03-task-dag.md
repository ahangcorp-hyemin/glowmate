# glowmate — Task DAG (MVP)

## ⚠️ 감사 반영 — 전 계약에 적용되는 정정 4건

> 1차 감사(`docs/audit/`)에서 확인된 **구조 결함**. 개별 계약 수정 전에 이 결정이 선행한다.

| # | 결함 | 결정 |
|---|---|---|
| **1** | `price_plan.confidence` 를 **생산하는 태스크가 없는데** W2·W3·W4의 확정/추정 구분 전체가 이 필드에 의존 | **C4에 생산 REQ 신설.** 생산자 없이는 W2·W3·W4 착수 금지 |
| **2** | F2는 `visibility ENUM('public','hidden_quality','hidden_request','hidden_legal')` 인데 C7·W1·W2·W4·W5·O2가 boolean `is_public` 전제 | **F2의 ENUM이 정본.** boolean으로 접으면 *삭제 요청 비공개*와 *품질 미달 비공개*가 구분되지 않아 W7·W8의 존재 이유가 스키마에서 소멸한다. 하류 6건을 ENUM에 맞춰 정정 |
| **3** | 게이트가 **시점 기반**이라 캐시·정적 산출물로 우회 (W1 `revalidate` 상한 없음 · W4 생성 후 재검증 없음 · W5 빌드타임 MDX · O2 override 미반영) → C7이 비공개로 돌린 데이터가 **무기한 서빙**되는데 **개별 계약은 아무도 위반하지 않는다** | **재검증 상한을 전 서빙 표면에 REQ로 강제.** `visibility` 변경 시 무효화 경로를 W1이 소유 |
| **5** | **금지만 있고 정상 동작 요구가 없다** — `PriceDisplay`가 항상 "미공개"를 렌더하면, D4가 medical 가격을 전부 숨기면, F4가 태그를 하나도 안 붙이면 **각 계약이 100% 준수된다.** 리스크 방어가 제품 기능을 0으로 만드는 방향으로 열려 있다 | 규격 **원칙 2.5 신설** — 숨김·차단 FORBID는 **최소 정상 동작 커버리지 REQ**를 짝으로 가진다 |
| **6** | **사후 완화는 막았으나 사전 설정이 무방비** — "가격 확인됨" 정의·난이도 임계·요청 상한을 원하는 결론이 나오게 미리 정한 뒤 잠그면 100% 준수로 게이트 통과 | 잠금 대상의 **허용 범위(enum·수치 하한)를 계약 본문에 못박고**, 사전등록을 별도 PR로 선머지 (**D1 → D1a/D1b 분할**) |
| **7** | **계약이 자기 PR을 차단** — F1(lockfile) · F2(down 마이그레이션 DROP) · F3(thresholds.json 신규생성)가 각각 자기 FORBID 위반. 개발 에이전트가 반드시 우회하고 **우회 관용구를 첫 3개 태스크에서 학습** | 예외를 규칙 **안으로** 명시 (최초 도입 / down 스크립트 / 필수 생성 파일) |
| **8** | **`block_merge`를 집행할 CI가 없음** — Discovery 4건이 F1과 병렬이라 `scripts/discovery/**`를 도는 job 부재. 원칙 3 위반 4건 일괄 | F1이 `discovery` CI job 제공 + Discovery 4건이 F1을 `depends_on` |
| **9** | **`blocks` ↔ `depends_on` 양방향 정합성 전무** — W2·W3·W4가 `depends_on:[W1]` 뿐이라 **D4 산출물 없이 착수 가능**하고, 그들의 detect가 참조할 파일이 없다. 없는 파일을 스캔하는 테스트는 스텁이 되고 스텁은 항상 통과한다 → **Phase 3 전체가 G3/D4를 건너뛴다** | DAG 정합성 검증 스크립트를 F1 CI에 추가 + D4 산출물 인용 규약(정본 경로·스키마·버전) 고정 |
| **4** | C7 REQ-1("`is_public` 쓰기 경로 정확히 1개") ↔ O2 REQ-4("2인 승인 시 공개 전환") **정면 충돌** — 한쪽을 지키면 다른 쪽이 구현 불가 | **판정 컬럼(C7)과 오버라이드 레이어(O2)를 분리 저장**, 최종 상태는 뷰가 결합해 산출 |

## 가격 상태 어휘 정본 (2차 감사 반영 — 정정 #10)

> 2차 감사에서 **C4 · F6 · DS4 · W3 가 같은 상태를 서로 다른 이름으로** 불렀다(`unparseable` ↔ `unknown` 등).
> 화면·모듈·API가 같은 상태를 다르게 부르면 판정이 어긋나고, 파이프라인의 모든 금지사항이 **화면이라는 마지막 칸에서** 무너진다.

**두 축을 구분한다. 섞지 마라.**

| 축 | 소유 | 값 |
|---|---|---|
| **가격 유형** (C4 산출) | `C4-PRICE-NORMALIZER` | `per_session` · `period_pass` · `single_session` · `unparseable` |
| **표시 상태** (F6 산출) | `F6-PRICE-STATE` | `confirmed` · `conflict` · `low_confidence` · `unavailable` |

**규칙**

1. **표시 상태의 단일 판정 소스는 `F6-PRICE-STATE` 다.** DS4·W3·W2·W4는 F6을 소비만 하고 **자체 판정 로직을 구현하지 않는다.** 중복 구현은 두 판정이 어긋나는 시점을 만든다
2. `period_pass` 는 **확정 가격이면 `confirmed`** 다. 회당 환산이 불가능하다는 이유로 `unavailable` 로 접으면, 기간권 업체의 가격이 영구히 표시되지 않는다 (원칙 2.5 위반)
3. `unparseable`(유형) 과 `unavailable`(표시) 은 **다른 개념이다.** 전자는 파싱 실패, 후자는 화면에 숫자를 못 내보내는 모든 사유의 합집합

## 태스크 ID 정본 (Canonical Registry)

> **계약의 `depends_on` / `blocks` / `parallel_with` 는 반드시 이 목록의 문자열과 정확히 일치해야 한다.**
> 오참조는 DAG 자동 검증을 무력화하고, 게이트 선행 검사를 자동화할 수 없게 만든다.

```
D1a-PROTOCOL   D1b-FIELDWORK            ← D1 분할 (감사 반영)
D2-SEO-SERP-FEASIBILITY   D3-SOURCE-DUE-DILIGENCE   D4-MEDICAL-AD-GUARDRAIL
D1-PRICE-AVAILABILITY-SPIKE  ← 폐기(D1a/D1b로 분할). 신규 참조 금지

F2a-CORE-SCHEMA   F2b-QUALITY-SCHEMA   F2c-OPS-LEGAL-SCHEMA   ← F2 분할 (감사 반영)
F2-SCHEMA  ← 폐기. 신규 참조 금지

F1-REPO-SCAFFOLD   F1b-CONTRACT-GOVERNANCE   ← F1 분할 (F1 게이트 감사 승인)
F2-SCHEMA   F4-NEED-TAG-ONTOLOGY
F5-API-LAYER   F6-PRICE-STATE          ← 감사 반영 신설
F3-DESIGN-TOKENS  ← 폐기(DS 워크스트림으로 대체). 신규 참조 금지
DS2-TOKEN-BUILD   ← 폐기(G5 옵션 A). 신규 참조 금지

DS0-SEED-DUE-DILIGENCE   DS1-TOKEN-LAYERS   DS2-TOKEN-BUILD   DS3-BASE-WIRING
DS4-PRICE-COMPARE-CARD   DS5-CORE-COMPONENTS   DS6-A11Y-GATE   DS7-PREVIEW-DOCS

C1-CRAWLER-CORE   C2-ADAPTER-NAVER   C3-ADAPTER-KAKAO   C4-PRICE-NORMALIZER
C5-ENTITY-RESOLUTION   C6-TAG-ASSIGN   C7-QUALITY-GATE

W1-SEO-FOUNDATION   W2-DISCOVERY-LIST   W3-VENUE-DETAIL   W4-COMBO-LANDING
W5-EDITOR-REPORT   W6-LEAD-TRACKING   W7-CORRECTION-REQUEST
W8-CORRECTION-PROCESSING   W9-OBSERVABILITY-EVENTS   ← 감사 반영 신설

O1-METRICS-DASHBOARD   O2-REVIEW-ADMIN   O3-DEPLOY-MONITORING
```


> 태스크 1개 = PR 1개 = 에이전트 1회 실행.
> `‖` 병렬 가능 · `→` 직렬 필수 · `⛔` 게이트

```
Phase 0  DISCOVERY (코드 없음, 전부 병렬)
  D1 ‖ D2 ‖ D3 ‖ D4
       └──────┴──── ⛔ G1(H1) · G2(H3) · G3(법적실사)

Phase 1  FOUNDATION (게이트 무관, 선행 가능)
  F1 ──→ F2 ‖ F3
  F4 (D1·D4 이후, F1과 병렬)

Phase 2  PIPELINE  ⛔ G1·G3 통과 필요
  F2 ──→ C1 ──→ C2 ‖ C3
              └─→ C4 ‖ C5 ──→ C6 ──→ C7 ──→ ⛔ G4

Phase 3  WEB  ⛔ F2·F3 필요 (C와 병렬 진행 가능, 실데이터는 C7 이후)
  W1 ──→ W2 ‖ W3 ‖ W7
       └─→ W4 (C4·C6 이후)
       └─→ W5
  W6 (W2·W3 이후)

Phase 4  OPS
  O3 (F1 이후 조기 착수) ‖ O2 (C7 이후) ‖ O1 (W6 이후)
```

---

## 태스크 목록

### Phase 0 — Discovery

| ID | 제목 | 의존 | 병렬 | 가설 |
|---|---|---|---|---|
| **D1a** | **조사 프로토콜 사전등록** (모집단·표집·"가격 확인됨" 정의·판정 임계) ⚠️분할 | — | D2·D3·D4 | H1 |
| **D1b** | **현장 조사 실행** (표본 100, 사전등록된 프로토콜대로만) ⚠️분할 | **D1a** (별도 PR로 main 선머지) | — | H1, H2 |
| **D2** | SEO 키워드·SERP 난이도 실사 | — | D1·D3·D4 | H3 |
| **D3** | 크롤링 소스 법적·기술적 실사 | — | D1·D2·D4 | — (G3) |
| **D4** | 의료광고법 가드레일 정의 | — | D1·D2·D3 | — (G3) |

### Phase 1 — Foundation

| ID | 제목 | 의존 | 병렬 | 가설 |
|---|---|---|---|---|
| **F1** | 리포 스캐폴딩 · 모노레포 · CI | — | — | — |
| **F2a** | 코어 스키마 (venue · price_plan · need_tag · editor_report · source_record) ⚠️분할 | F1 | — | H1,H2 |
| **F2b** | 품질·공개판정 스키마 (`visibility` ENUM · confidence · conflict · override 레이어 · lead_event · venue_suppression · `public_venue` 뷰 단독 소유) ⚠️분할 | F2a | — | H4 |
| **F2c** | **운영·법적 저장소** (correction_request · correction_action_log · review_audit_log · venue_field_override · visibility_change_event) ⚠️2차 감사 반영 신설 | F2a | F2b | — (법적) |
| ~~F3~~ | ~~디자인 토큰 & 코어 컴포넌트~~ → **DS 워크스트림으로 대체** (하단 참조) | — | — | — |
| **F4** | 니즈 태그 온톨로지 정의 | D1, D4 | F1 | H5 |
| **F5** | **공용 API 레이어 패키지** (웹/앱 공용, DB 직접 호출 차단 경계 소유) ⚠️신설 | F1, F2 | F4 | — |
| **F6** | **가격 상태 공용 모듈** (`price_state`: 확정/추정/충돌/저신뢰 판정 + 표현 규칙) ⚠️신설 | F2, C4 | — | H4, S1 |

### Phase 2 — Pipeline ⛔ G1·G3

| ID | 제목 | 의존 | 병렬 | 가설 |
|---|---|---|---|---|
| **C1** | 크롤러 코어 (스케줄·큐·원문 보관) | F2 | — | H1 |
| **C2** | 소스 어댑터 A — 네이버 플레이스 | C1, D3 | C3 | H1 |
| **C3** | 소스 어댑터 B — 카카오맵 외 | C1, D3 | C2 | H1 |
| **C4** | **가격 정규화 엔진 (회당 단가)** ★핵심 | C1, F2 | C5 | H2, S1 |
| **C5** | 엔티티 해소 (동일 업체 병합) | C1, F2 | C4 | H1 |
| **C6** | 니즈 태그 자동 부여 (룰 + LLM) | C5, F4 | — | H5 |
| **C7** | 데이터 품질 게이트 · 공개 판정 | C4, C6 | — | H4 (G4) |

### Phase 3 — Web ⛔ F2·F3

| ID | 제목 | 의존 | 병렬 | 가설 |
|---|---|---|---|---|
| **W1** | SEO 기반 (라우팅·메타·sitemap·JSON-LD) | F2, F3 | — | H3 |
| **W2** | 탐색 — 리스트 + 니즈 태그 필터 | W1 | W3·W7 | H5 |
| **W3** | 업체 상세 — 가격 비교 블록 | W1 | W2·W7 | H4, S1 |
| **W4** | 조합 랜딩 생성기 (지역×카테고리×니즈) | W1, C4, C6, **C7** | — | H3 |
| **W5** | 에디터 리포트 렌더링 | W1 | W4 | H6 |
| **W6** | 리드 액션 & 계측 | W2, W3 | — | H4 (NSM) |
| **W7** | 정보 수정·삭제 요청 **접수** 폼 | W1, F5 | W2·W3 | — (운영) |
| **W8** | **요청 처리 파이프라인** (접수→검토→`visibility` 전환→회신, SLA 계측) ⚠️신설 | W7, C7 | — | — (법적) |
| **W9** | **관측 이벤트 기반** (상세 조회수=전환 분모 · 필터 사용 · 코호트 식별자 · 리텐션) ⚠️신설 | W1, F5 | — | **H4·H5·H6·H7** |

### Phase 4 — Ops

| ID | 제목 | 의존 | 병렬 | 가설 |
|---|---|---|---|---|
| **O1** | 게이트 지표 대시보드 | W6 | O2 | H1,H4,H5,H7 |
| **O2** | 데이터 검수 어드민 (품질 큐) | C7 | O1 | H1 |
| **O3** | 배포·모니터링·알림 | F1 | 전체 | — |

---

### Phase 1.5 — Design System (F3 대체)

> **원천은 코드다.** Figma 목업이 아니라 `import` 해서 쓰는 파일이 산출물.
> 파운데이션 = 당근 `seed-design` · 패턴 = 강남언니(레퍼런스) · 제약 = 3050 접근성

| ID | 제목 | 의존 | 병렬 | 가설 |
|---|---|---|---|---|
| ~~DS0~~ | seed-design 실사 | — | — | ✅ **완료 → G5 = 옵션 A** |
| **DS1** | 토큰 계층 설계 — seed 시맨틱 토큰 위에 glowmate 브랜드 팔레트 오버레이 (**carrot 교체 필수**) | DS0 | — | H4 |
| ~~DS2~~ | ~~Style Dictionary 파이프라인~~ → **폐기.** `@seed-design/tailwind4-theme` 가 이미 산출물을 배포함. 자체 토큰 소스가 필요해지는 시점에 재도입 | — | — | — |
| **DS3** | Pretendard self-host + `@seed-design/css` · `tailwind4-theme` 연결 + **shadcn/ui 초기화** (Radix + Tailwind v4) | F1, DS1 | — | — |
| **DS4** | **시그니처 컴포넌트 — 회당 단가 비교 카드** ★ | DS3 | DS5 | H4, S1 |
| **DS5** | 코어 컴포넌트 (업체 카드 · 니즈 태그 칩 · 필터 바 · 리스트) | DS3 | DS4 | H5 |
| **DS6** | 3050 접근성 게이트 (대비 AA · 최소 폰트 · 터치타깃) **CI 강제** | DS1 | DS4·DS5 | H4 |
| **DS7** | 프리뷰/문서화 (Storybook 또는 프리뷰 라우트) | DS4, DS5 | — | — |

**✅ G5 판정 완료 — 옵션 A** (근거: [ds0-seed-design-실사.md](./ds0-seed-design-실사.md))

| 조건 | 판정 |
|---|---|
| ① Next.js App Router SSR 동작 | ✅ 충족 — seed 공식 문서 사이트가 Next 16 App Router |
| ② 라이선스 상업적 사용 | ✅ 충족 — Apache-2.0 |
| ③ 데스크톱 웹 커버 충분 | ❌ **미충족** — Table·Pagination·Breadcrumb·Card 전무 |

**확정 구성**

| 레이어 | 결정 |
|---|---|
| 디자인 토큰 | ✅ `@seed-design/css` + `@seed-design/tailwind4-theme` |
| React 컴포넌트 | ❌ `@seed-design/react` 미채택 |
| 컴포넌트 레이어 | ✅ **shadcn/ui** (Radix + Tailwind v4) — 코드 소유 |
| 폰트 | ✅ Pretendard self-host (SIL OFL 1.1) |
| 브랜드 컬러 | ⚠️ **`carrot` 교체 필수** — NOTICE의 오인 유발 금지 조항 |
| Style Dictionary | ❌ 보류 — 결과물이 이미 배포되어 있음 |

> **토큰 소스는 정확히 1개.** seed 시맨틱 토큰 위에 glowmate 브랜드 팔레트를 오버레이하되, shadcn 기본 토큰과 공존시키지 않는다. 이것이 DS 워크스트림 최상위 FORBID 조건이다.

**옵션 B 재검토 조건** — 모바일 웹뷰 중심으로 선회 / SEED가 Table·Pagination·Card 추가 / 커스텀 브랜드 컬러 공식 경로 문서화 / cascade layers Experimental 해제

---

## 병렬 실행 배치

| 배치 | 동시 실행 태스크 | 선행 조건 |
|---|---|---|
| **B0** | D1, D2, D3, D4 | 없음 |
| **B1** | F1 | 없음 (B0와 동시 가능) |
| **B2** | F2, F3, O3 | F1 |
| **B3** | F4, C1 | B2 + ⛔G1·G3 |
| **B4** | C2, C3, C4, C5, W1 | B3 |
| **B5** | C6, W2, W3, W5, W7 | B4 |
| **B6** | C7, W4, W6 | B5 |
| **B7** | O1, O2 | B6 + ⛔G4 |
