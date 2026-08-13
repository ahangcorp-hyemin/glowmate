# GlowMate — 시술 자동견적 프로덕션 스펙 v1

> 병원 크롤링 기반 4050 시술 **자동견적 + 룰베이스 지식/출처 답변 + 가격비교** 앱.
> 작성 방식: gstack `/spec` 방법론(5단계 심문 → backlog-ready 스펙). 컨텍스트(리서치·코랄 프로토타입 v3)로 Phase 1~3 자문 완료, 열린 결정은 §15에 명시.
> 상태: **DRAFT — /plan-eng-review 대기**

---

## 0. 요약 (What / Why / Done)

- **What:** 유저가 피부 고민·연령·예산을 입력 → **자동 시술 견적서(조합+예상총액)** + **출처를 남기는 룰베이스 지식 답변** + **병원별 가격비교**를 제공하는 모바일웹 앱. 상담은 병원으로 링크아웃(수수료 0).
- **Who:** 30~50대(핵심 40·50대) 여성. 시술 정보과잉·전문용어·가격불투명에 지친 리서치형 소비자.
- **Why now:** 여신티켓이 카테고리 검증(누적 500만DL·2024 흑자·IPO추진, 방문 60% 신규·70% 월내 재구매 = 비단골·리서치형 = 광고모델 이탈면역). 그러나 3사 모두 firehose·전문용어. 웨지 = **가격비교(기본) + 큐레이션·쉬운설명(소화) + 개인화 fit 데이터 해자.**
- **Done(관측가능):**
  1. 유저가 고민 입력 후 3초 내 견적서(추천 시술 조합 + 예상 총액 범위 + 회차) 수신.
  2. 견적 답변의 모든 주장에 **출처 ref**가 붙고, 클릭 시 출처 원본으로 연결.
  3. 단일 지역(강남·분당) 병원 카탈로그에서 시술별 병원 가격비교 노출(≥50 병원 × 13 시술).
  4. §56 금지표현이 카피/답변/후기에 0건(자동 필터 통과).
  5. 병원 상담 링크아웃까지 전환 퍼널 계측(견적완료율·상담클릭율).

---

## 1. Context (Phase 1 — Why)

- **현재 상태:** 코랄 프로토타입 v3 존재(HTML, `scratchpad/glowmate-procedure-prototype.html`). 랜딩→입력→자동견적(정적 Wizard-of-Oz)→가격비교→병원상세→상담시트. 시술 13종 카탈로그(출처 포함). **백엔드·크롤링·룰엔진 없음.** 이 스펙이 그걸 프로덕션화.
- **왜 지금:** 시술 시장 레이어링 트렌드 확인(피부과 건당결제 9.2만→14만/+46.8%, 환자 70%+ 복합시술). 자동견적(조합)이 이 흐름과 정합.
- **성공 지표(선행):** 견적 완료율 ≥40%, 견적→상담클릭 전환, 병원 유료 게재 전환(§27 안전 광고), 30/90일 재방문(프로필 해자).

## 2. Scope & Boundaries (Phase 2)

**MVP 포함:**
- 단일 지역(강남·분당) + 시술 13종 카탈로그(에너지 리프팅 6 / 볼륨·재생·물광 5 / 색소 2).
- 고민 입력(멀티) + 연령·예산 → **룰베이스 자동견적** + **출처 답변**.
- 시술 상세(쉬운 설명 6필드 + 출처) / 병원 가격비교 / 병원 상세·후기(시딩) / 상담 링크아웃.
- 크롤링 파이프라인(병원·시술·참고가 하이브리드 수집) — 배치, 어드민 검수.
- 컴플라이언스 레이어(§27·§56·§24조의2·§23) 코드화.

**MVP 제외(별도 스코프):**
- LLM RAG(명시적 배제 — 룰베이스만). 음성 상담. 결제/예약(링크아웃만). 제품 커머스/SLO. 커뮤니티. 피부나이 셀피 CV. 다지역 확장. 네이티브 앱. 유익한 영상 embed(Phase 2).

**롤백 가능성:** 크롤 데이터는 스냅샷 버전관리(구 스냅샷 복원). 견적 룰은 버전 태그. 광고 게재는 플래그 off.

## 3. Architecture

```
[Next.js App Router (Vercel)]  ── 모바일웹, 코랄 디자인토큰
      │  Server Actions / Route Handlers
      ▼
[Supabase]
  ├─ Postgres (카탈로그·병원·가격·견적·리드·광고)  + RLS
  ├─ Auth (전화/카카오 OAuth, 익명세션→가입)
  ├─ Storage (병원·후기 이미지)
  └─ Edge Functions (견적 API, 리드 전송)
      ▲
[Crawler Worker (Bun + Playwright)]  ── 별도 프로세스(Vercel 아님; Fly/Railway/cron)
  └─ 병원·시술·가격 하이브리드 수집 → Postgres upsert(스냅샷)
[Knowledge Base]  ── 룰베이스, 코드+DB(시드 JSON → procedures/rules 테이블)
```

- **런타임:** TypeScript 전면. 프론트 Next 15(App Router)+React+Tailwind(코랄 토큰을 CSS 변수로). DB/Auth/Storage Supabase. 크롤러는 **분리 워커**(장기실행·Playwright라 서버리스 부적합).
- **Search Before Building:** 크롤은 Playwright(성숙), 견적/지식은 자체 룰엔진(1st principles, 결정론·§56 안전). RAG는 의도적 배제.

## 4. Data Model (Postgres)

핵심 테이블. 모든 `price`는 KRW 정수(원), `*_at` timestamptz, 모든 크롤 유래 데이터에 `source_url`·`fetched_at`.

```sql
-- 시술 카탈로그 (지식베이스 핵심, 시드=코드 관리)
create table procedures (
  id            text primary key,           -- 'ulthera','thermage',...
  name_ko       text not null,              -- '울쎄라'
  category      text not null,              -- 'lifting'|'volume'|'pigment'
  tagline       text not null,              -- '처진 피부를 안쪽부터...'
  mechanism     text not null,              -- 뭐냐(기전)
  effect        text not null,              -- 효과
  downtime      text not null,              -- 아픔·회복
  caution       text not null,              -- 주의·부작용(§24조의2 고지 필수)
  good_for      text not null,              -- 이런 분께
  price_min     integer not null,           -- 참고 하한(원)
  price_max     integer not null,           -- 참고 상한
  price_unit    text not null,              -- '회'|'샷300'|'cc'|'바이알'|'부위'
  sessions      text,                       -- 권장 회차/유지
  is_medical    boolean not null default true, -- 의료행위(§27 적용)
  updated_at    timestamptz not null default now()
);

-- 시술 출처(citation) — 답변의 [n] ref 원천
create table procedure_sources (
  id            bigserial primary key,
  procedure_id  text references procedures(id),
  label         text not null,              -- '식약처 의료기기 허가 · 초음파 자극기'
  url           text,                       -- 'https://mfds.go.kr/...'
  source_type   text not null,              -- 'mfds'|'fda'|'society'|'crawl_avg'
  ord           int not null default 0
);

-- 고민(태그) 및 고민→시술 룰(견적/큐레이션의 결정론 핵심)
create table concerns (
  id text primary key, name_ko text not null   -- 'lift'='탄력·처짐'
);
create table concern_procedure_rules (
  concern_id    text references concerns(id),
  procedure_id  text references procedures(id),
  role          text not null,              -- 'base'|'addon'|'optional'
  weight        int not null,               -- fit 점수 가중치(0-100)
  rationale     text not null,              -- 답변 조립용 근거 문장
  source_ref    text,                       -- 근거 출처 라벨
  primary key (concern_id, procedure_id)
);

-- 병원 (크롤+수동)
create table hospitals (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  region        text not null,              -- '강남'|'분당'
  district      text,                       -- '역삼동'
  address       text, lat numeric, lng numeric,
  rating        numeric,                    -- 참고(크롤 or 자체)
  review_count  int default 0,
  source_url    text, fetched_at timestamptz,
  status        text not null default 'active', -- 'active'|'hidden'
  created_at    timestamptz default now()
);

-- 병원×시술 가격 (스냅샷 버전관리)
create table hospital_procedure_prices (
  id            uuid primary key default gen_random_uuid(),
  hospital_id   uuid references hospitals(id),
  procedure_id  text references procedures(id),
  unit          text not null,              -- '300샷'|'1cc'
  price         integer not null,           -- 참고가(원)
  is_promo      boolean default false,
  source_url    text not null, fetched_at timestamptz not null,
  snapshot_id   uuid not null,              -- 배치 스냅샷 묶음
  is_current    boolean not null default true,
  unique (hospital_id, procedure_id, unit, snapshot_id)
);

-- 광고 게재(§27 안전: 정액, 예약/건당 수수료 없음)
create table ad_placements (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid references hospitals(id),
  procedure_id text references procedures(id), -- null=전체
  slot text not null,                        -- 'top'|'list'
  monthly_fee integer not null,              -- 정액(원)
  starts_at date, ends_at date, active boolean default true
);

-- 후기 (방문/결제 인증 게이트)
create table reviews (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid references hospitals(id),
  procedure_id text references procedures(id),
  author_masked text,                        -- '지****'
  age int, concern text,
  rating int, weeks_elapsed int,             -- 경과주수(개인차 표시 강제)
  body text not null,
  is_verified_visit boolean not null default false, -- 결제/영수증 인증
  is_sponsored boolean not null default false,       -- 대가성→'협찬' 라벨
  is_adverse boolean not null default false,         -- 부작용 채널
  status text not null default 'shown',      -- 'shown'|'demoted'|'hidden'
  created_at timestamptz default now()
);

-- 견적 요청/결과 (프로필 해자)
create table estimate_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,                              -- 익명세션 or 가입
  concerns text[] not null, age_band text, budget_band text, note text,
  created_at timestamptz default now()
);
create table estimates (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references estimate_requests(id),
  items jsonb not null,                      -- [{procedure_id, role, price_min, price_max, sessions}]
  total_min integer, total_max integer,
  answer_blocks jsonb not null,              -- [{text, refs:[n]}]
  sources jsonb not null,                    -- [{n, label, url}]
  engine_version text not null,              -- 룰엔진 버전 태그
  created_at timestamptz default now()
);

-- 리드 (병원 상담 링크아웃 계측 — 수수료 없음, 광고 성과지표)
create table leads (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid, hospital_id uuid references hospitals(id),
  procedure_id text, consented_sensitive boolean not null, -- §23 별도동의
  created_at timestamptz default now()
);
```

**인덱스:** `hospital_procedure_prices (procedure_id, is_current, price)` — 가격비교 정렬. `reviews (hospital_id, status, is_adverse)`. `hospital_procedure_prices (snapshot_id)`.
**RLS:** 읽기 공개(카탈로그·가격·shown 후기). 쓰기(견적·리드·후기)는 인증 세션. 광고·hidden은 서비스롤만.

## 5. 크롤링 엔진 (상세)

### 5.1 원칙 (합법성 가드레일)
- **판례 기준:** 공개데이터 비중대 이용 OK(여기어때 2021도1533 무죄). **통째복제·DB제작자권 침해·기술적 우회 금지**(잡코리아 v 사람인 유죄). → **하이브리드**: (a) 공개 페이지 소량·표시적 수집 + (b) 병원 제공 피드/수동 입력 + (c) 유저 UGC.
- **가드레일(코드로 강제):**
  1. `robots.txt` 존중(파서로 확인, disallow 경로 스킵).
  2. ToS 위반 소지 도메인 allowlist 관리(수동 승인).
  3. **레이트리밋** 도메인당 ≤1 req/2s, 동시성 ≤2, 지수 백오프.
  4. 비중대성: 전체 덤프 아님 — 시술·가격·병원명·주소·영업정보 등 **팩트 필드만**, 저작물(리뷰 원문·사진) 통째 복제 금지.
  5. **출처·갱신일 표기 필수**(모든 가격에 `source_url`+`fetched_at`, UI "참고가·출처").
  6. 개인정보 미수집(원장명 등 민감 제외 or 공개범위만).
- **주의:** 의료 가격/광고는 §56 의료광고·§27 유인 이슈 → 우리는 **정보 취합·표시**(정액 광고 BM), 병원 데이터는 팩트로만.

### 5.2 소스 우선순위
1. **병원 자체 페이지/블로그**(공개 가격표) — 1차.
2. **공개 디렉토리/지도**(네이버 플레이스류 공개 필드: 이름·주소·영업시간) — robots 범위 내.
3. **병원 제공 피드/수동 어드민 입력** — 유료 게재 병원은 직접 제출(가장 신뢰).
4. **UGC**(유저 제보 가격) — 검증 후.

### 5.3 파이프라인
```
discover → fetch → parse → normalize → validate → dedup → snapshot(upsert) → review(admin) → publish
```
- **discover:** 지역×시술 시드 쿼리 + 병원 URL 목록(수동 seed 50~100).
- **fetch:** Playwright(동적 렌더) + 정적 fetch 폴백. 캐시(ETag). robots 체크.
- **parse:** 사이트별 어댑터(선택자/정규식) → 원시 필드. gstack `/scrape`·`/skillify`로 반복 플로우 코드화(200ms 재실행).
- **normalize:** 가격 파서 — "300샷 89만원(부가세 별도)" → `{unit:'300샷', price:890000, vat:false, is_promo}`. 단위 사전(샷/cc/바이알/부위/회) 매핑. 프로모/정가 구분.
- **validate:** 범위 sanity(시술별 price_min/max의 ±동적 범위 밖이면 flag). 통화·자릿수 검증.
- **dedup:** (hospital, procedure, unit) 최신성 기준. fuzzy 병원명 매칭.
- **snapshot:** 배치마다 `snapshot_id`, 기존 `is_current=false`로 롤오버(구가격 보존→롤백/추세).
- **review:** 어드민 큐 — 신규/이상치 human 승인 후 `publish`(§ 신뢰·정확도).
- **schedule:** 주 1~2회 배치(cron) + 유료 병원은 온디맨드. 실패시 재시도·알림.
- **모니터링:** 소스별 성공률·파싱드리프트(선택자 깨짐) 알림, 가격 급변 flag.

### 5.4 반(反)취약 설계
- 사이트 구조 변경 → 어댑터 단위 격리(하나 깨져도 나머지 진행), 파싱 실패율 임계 알림.
- 차단 리스크 → 레이트리밋·User-Agent 명시·백오프, allowlist 밖 자동수집 금지.

## 6. 룰베이스 지식 & 견적 엔진 (RAG 아님)

> **결정론·출처고정.** LLM 생성 없음 → 할루시네이션 0, §56(효과보증·과장) 안전, 재현가능.

### 6.1 지식베이스 구조
- `procedures` + `procedure_sources` + `concerns` + `concern_procedure_rules` = 코드/DB 관리 지식.
- 시드: 리서치한 13종(v3 프로토타입 데이터) → 마이그레이션 시드. 각 필드에 출처 라벨/URL.

### 6.2 큐레이션(고민→시술)
```
입력: concerns[], age_band, budget_band
1) concern_procedure_rules에서 매칭 rows 수집
2) fit_score = Σ(weight × concern_present) × age_fit × budget_fit
3) role별 정렬: base(리프팅 기둥) → addon(재생 마감재) → optional(볼륨 벽돌)
4) 예산 필터로 optional on/off
→ 상위 N개 시술 + 각 rationale(+source_ref)
```

### 6.3 자동견적(총액 조립)
- **견적 구성 = base 장비(샷수 변수) + add-on 샷 + 주사제(cc/vial).** (리서치 검증 로직)
- 각 시술 `price_min/max × 권장 회차` → item 범위. Σ → `total_min/total_max`.
- 항상 **"예상 범위 + 병원 상담 필요"** 고지(단정 금지).

### 6.4 출처 답변 조립(템플릿)
```
answer_blocks = [
 { text: "{age}대 {concern} 고민엔 {base}로 처짐을 잡고 {addon}로 결을 올리는 조합이 일반적이에요",
   refs:[rule.source_ref → n] },
 { text: "{base}는 {mechanism 요약}, 식약처·FDA 허가 장비예요", refs:[procedure_sources FDA/MFDS → n] },
 { text: "볼륨 손실이 크면 {optional}를 더해요", refs:[...] }
]
sources = 참조된 라벨·URL을 [1..n]으로 dedup
```
- 문장은 **슬롯 치환 템플릿**(생성 아님). 각 문장 → 근거 ref 필수. ref 없는 문장 금지.

### 6.5 컴플라이언스 필터(§56)
- **금지표현 사전**(정규식): "100%·완치·부작용 없는·최고·최저가·완벽·안전보장·재발없는·세계최초" 등 → 카피/답변/후기 게시 전 차단(빌드타임 lint + 런타임 검증).
- 답변에 효과보증·비교광고 문구 생성 불가(템플릿이 원천적으로 미포함).

## 7. API (Route Handlers / Edge Functions)

```
POST /api/estimate            → {concerns, age_band, budget_band, note} → estimate(items, total, answer_blocks, sources)
GET  /api/procedures          → 카탈로그(카테고리별)
GET  /api/procedures/:id      → 상세(쉬운설명 + sources)
GET  /api/prices?procedure=&region=&sort= → 병원 가격비교(광고 top 우선, 정렬)
GET  /api/hospitals/:id       → 병원 상세 + reviews(shown, adverse 분리)
POST /api/leads               → {estimate_id, hospital_id, consent} → 링크아웃 계측(수수료X)
POST /api/reviews             → 방문/결제 인증 게이트 통과분만
```
- 견적은 **서버 룰엔진**(결정론), 동일 입력=동일 출력. `engine_version` 스탬프.

## 8. Frontend (프로토타입 → 프로덕션)

프로토타입 v3 화면을 Next 라우트로 이식:
- `/` 랜딩(히어로+CTA) · `/estimate/new` 입력 · `/estimate/[id]` 견적결과(견적서+출처답변) · `/procedures/[id]` 쉬운설명 · `/compare` 가격비교 · `/hospitals/[id]` 후기 · `/me` 마이(내 견적/프로필).
- 코랄 디자인 토큰을 `globals.css` CSS 변수로. 컴포넌트: EstimateCard, AnswerWithSources, PriceRow, ProcedureExplainer, ReviewItem.
- SSR/ISR: 카탈로그·가격비교는 ISR(주기 재생성), 견적은 동적.

## 9. 컴플라이언스 레이어 (코드화)

| 규제 | 코드 반영 |
|---|---|
| **의료법 §27③ 유인·알선** | BM=정액 광고(`ad_placements.monthly_fee`)만. 리드·예약 건당 과금 스키마 자체 없음. 계약서 "고정 광고비" 명시 |
| **의료법 §56 의료광고** | 금지표현 필터(빌드+런타임). 후기=유저 UGC. 전후사진 경과주수·개인차 강제 필드. 시술장면 노출 없음 |
| **§24조의2 설명의무** | 각 시술 `caution`(부작용) 필수 노출. "상담에서 확인" 고지 |
| **개인정보 §23 민감정보** | 리드 전송 전 `consented_sensitive` 별도 동의 게이트 |
| **크롤링 합법성** | robots·allowlist·레이트리밋·출처표기·비중대성(§5.1) |
| **표시광고법(후기 대가성)** | `is_sponsored`→'협찬' 라벨 자동 상단 노출 |

## 10. 수용 기준 (Acceptance Criteria)

1. `POST /api/estimate`에 {탄력·팔자, 40대, 100–200만} → 동일 요청 5회 모두 동일 items·total(결정론) 반환, 3s 이내.
2. 견적 `answer_blocks`의 모든 block에 ≥1 ref, `sources[n]`에 label·url 존재. ref 없는 문장 0.
3. 금지표현 사전 20개 문구가 카탈로그·답변 템플릿·후기 게시경로에서 0건(테스트로 검증).
4. `/compare?procedure=ulthera&region=강남&sort=price_asc` → 광고 top 1건 우선 후 가격오름차순, ≥50 병원.
5. 크롤 배치 실행 → 신규 가격은 `is_current=true`, 직전 스냅샷 `is_current=false`로 롤오버(구가격 보존).
6. robots disallow 경로는 fetch 로그에 skip 기록, allowlist 밖 도메인 fetch 0.
7. 리드 전송은 `consented_sensitive=true` 없으면 400.
8. 후기 작성은 `is_verified_visit=false`면 게시 안 됨(demoted/차단).

## 11. 테스트 피라미드

| Layer | What | Count |
|---|---|---|
| Unit | 견적 룰엔진(fit_score·조립·total), 가격 파서(샷/cc/바이알), 금지표현 필터 | +20 |
| Integration | crawl→normalize→snapshot 롤오버, estimate API 결정론, prices 정렬·광고우선 | +10 |
| E2E | 랜딩→입력→견적(출처)→가격비교→상담 링크아웃; 후기 인증 게이트 | +4 |
| Compliance | §56 금지표현 회귀, §23 동의 게이트, robots 준수 | +6 |

## 12. Effort (per component, CC+gstack 기준)

- 스키마·마이그레이션·시드(13종+룰): 4h · 크롤러(어댑터 3~5개+파이프라인): 12h · 룰 견적/답변 엔진: 8h · API: 5h · 프론트 이식(7화면): 12h · 컴플라이언스 필터·게이트: 5h · 어드민 검수 큐: 6h · 테스트: 8h. **≈ 60h(CC 압축)**.

## 13. Rollback

- 크롤: 스냅샷 단위 → 이전 `snapshot_id`로 `is_current` 스왑. 
- 견적 룰: `engine_version` 태그 → 이전 버전 롤백. 
- 광고: `ad_placements.active=false`. 
- 배포: Vercel 즉시 롤백 + Supabase 마이그레이션 down.

## 14. Phasing (마일스톤)

- **M0(스캐폴드):** Next+Supabase+코랄토큰, 스키마·시드, 프로토타입 정적 이식.
- **M1(견적·지식 코어):** 룰 견적/출처답변 엔진 + `/estimate` + 시술상세. → **핵심 훅 동작.**
- **M2(가격비교·크롤):** 크롤러(강남 50병원 수동+어댑터) → `/compare`·병원상세.
- **M3(컴플라이언스·후기·리드):** 필터·인증후기·리드동의·어드민 검수.
- **M4(광고·계측):** 정액 게재·전환 계측 → 병원 유료 온보딩 파일럿.

## 15. 열린 결정 (기본값 선택 — 바꾸려면 지시)

1. **크롤 posture:** 안전 하이브리드(공개 팩트+피드+UGC, allowlist). ← 기본. (더 공격적 X)
2. **인증:** 카카오 OAuth + 전화. 익명세션→가입 전환. ← 기본.
3. **크롤러 호스팅:** Fly.io 또는 Railway(장기실행 워커). ← 기본. (Vercel cron은 Playwright 한계)
4. **1차 시드 지역·고민:** 강남·분당 / 탄력·리프팅 우선. ← 기본.
5. **영상:** M4 이후 시술별 큐레이션 교육영상 embed(에디터 검증). ← 보류.

---

## 부록 — 근거(이전 리서치)
여신티켓 검증·이탈/광고모델(§10 이탈 5전략), 콜드스타트(come-for-the-tool), §27③(강남언니 유죄 vs 로톡 무죄), 크롤링 판례(여기어때 무죄·잡코리아 유죄), 시술 13종 카탈로그(에너지/주사/색소, 출처: 식약처·FDA·학회), 레이어링 트렌드(건당 14만·+46.8%).

---

## 리뷰 반영 (plan-eng-review 결과)

- **[수용] M1 크롤러 defer** — 자동 크롤러(§5)를 M2로 미루고, **M1은 강남 20~30병원 가격을 수동 시드**해 견적·출처 훅부터 검증(do-things-that-don't-scale, 법적·기술 리스크 후행).
- **[수용] 카탈로그 단일 소스** — 시술 지식은 `lib/catalog/*.ts`(TS 시드 모듈) → DB 시드/프로토타입 공용. JS 중복 금지.
- **[수용] §56 필터 단일화** — `lib/compliance/bannedPhrases.ts` 한 곳(빌드 lint + 런타임 검증).
- **[수용] §27 인바리언트** — 매출을 예약·진료비에 연동하는 스키마 필드 금지(이미 부재) + **런치 전 법률검토 게이트**.
- **[수용] 크롤러 = 분리 워커** — Fly.io, `service_role` 키만(클라이언트 노출 금지).
- **[Critical gap] 미지 고민조합** — 견적 엔진은 매칭 룰 0건이면 크래시 금지, "상담 권장" graceful 반환(테스트 필수).

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 아키2·품질2·성능0·critical gap 1, 전부 스펙 반영 |
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | 프로토타입 v3 존재(이식) |

- **VERDICT:** ENG CLEARED — 구현 착수 가능. 조건: 크롤러 M2 defer, 런치 전 §27/§56 법률검토.

**UNRESOLVED DECISIONS:**
- 없음 (열린 결정 §15는 기본값 확정, 리뷰 findings 전부 스펙 반영)
