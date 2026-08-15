# 스펙: 시술 SKU 정규화 엔진 (#70) — v1 상세
근거: PRODUCT_PLAN_V2 §1, 강남 21곳 서베이(#70 코멘트), 크롤링 판례 가이드. 해자는 넓이가 아니라 **정규화 정확도**.

## 0. 한 줄 정의
"울쎄라 300샷 129만~(VAT별도, 마취 포함)"과 "600샷 33만"을 같은 자로 잰다: **SKU(무엇을) × Offer(얼마에, 어떤 조건으로) × 단가(환산)**. 수집원은 4개 — 컨시어지 전화(③), 유저 영수증(0010), 파트너 제출, 병원 공식 사이트 수집 — 전부 하나의 hospital_offers로 합류한다.

## 1. 데이터 모델 — 0012 (서베이 필드 빈도로 확정)
```sql
create table procedure_skus (
  id uuid pk default gen_random_uuid(),
  procedure_id text references procedures(id),
  product_name text,                    -- 브랜드=정체성: 리쥬란힐러/쥬베룩볼륨/나보타/아띠에르
  origin text check (origin in ('domestic','imported')) , origin_country text,  -- 주사류 핵심 축(3~4/7)
  dose_value numeric, dose_unit text check (dose_unit in ('shot','line','cc','unit','vial','site','session')),
  dose_spec text,                       -- "Fine 18cm"(실), "울쎄라 프라임" 등 자유 스펙
  area_label text,                      -- 풀페이스/사각턱/1부위 (nullable)
  session_count int default 1,          -- 1|3|5|10 패키지가 별도 SKU
  includes text[] default '{}',         -- anesthesia_cream|sedation|aftercare
  renewal_weeks int,                    -- 원장(②) 연동
  unique (procedure_id, product_name, dose_value, dose_unit, area_label, session_count)
);
create table hospital_offers (
  id uuid pk default gen_random_uuid(),
  hospital_id uuid references hospitals(id) on delete cascade,
  sku_id uuid references procedure_skus(id),
  price_type text not null check (price_type in ('fixed','from','range','consult')),  -- 4형 전부 실재
  price_normal int, price_event int, price_max int,     -- 만원 아닌 '원' 단위 저장
  vat_included text default 'unknown' check (vat_included in ('yes','no','unknown')), -- 3-state(미표기 절반)
  anesthesia_extra text default 'unknown' check (anesthesia_extra in ('yes','no','unknown')),
  conditions text[] default '{}',       -- first_visit|homepage_booking|kakao_channel|event_period|doctor_designation
  event_start date, event_end date,     -- 월 단위 관행 → 만료 시 stale
  source_type text not null check (source_type in ('official_site','concierge','user_receipt','partner_submit')),
  source_url text, source_snippet text, -- 원문 '스니펫만'(전체 페이지 보관 금지 — 저작권)
  source_fetch_method text check (source_fetch_method in ('static','rendered','ocr','phone','manual')),
  collected_at timestamptz default now(), verified_at timestamptz,
  status text default 'pending' check (status in ('pending','verified','stale','removed')),
  confidence numeric                    -- LLM 추출 신뢰도(수동 입력=1.0)
);
create index on hospital_offers (hospital_id, status);
create index on hospital_offers (sku_id, status);
-- 단가 뷰: effective_price = coalesce(price_event, price_normal); unit_price = effective_price/(dose_value*session_count)
```
상태머신: `pending → verified(검수 승인) → stale(event_end 경과·재수집 실패 3회) → removed(병원 정정 요청)`. **stale/removed는 어디에도 노출 금지, removed는 이력만 보존**.

## 2. 수집 파이프라인 (서베이가 결정한 아키텍처)
```
crawl_sources(소스 레지스트리) → [수집] static fetch ──실패(1/3)──▶ headless 렌더 ──이미지 가격──▶ 스크린샷+비전(2순위)
                                        │성공                          │
                                        ▼                              ▼
                                   [추출] LLM 구조화(JSON 스키마 강제, confidence)
                                        ▼
                                   [검수] 어드민 offer 큐(원문 스니펫 ↔ 추출 결과 대조, 승인/수정/반려)
                                        ▼
                                   [노출] verified만 3면(§4)
```
- **crawl_sources**(0012 포함): hospital_id, url, page_type(price|event), fetch_method, robots_ok, last_crawled_at, fail_count, is_blocked. **시드 = 서베이 21 URL**.
- **주기**: 월 1회 전체(이벤트가 월 단위 관행) + event_end 도래 소스 우선 재수집. 스케줄은 Vercel cron 아닌 로컬/GH Actions 수동 트리거로 시작(베타 규모).
- **수집기 스택**: bun 스크립트 + fetch → 실패 시 Playwright(로컬 실행) → 스크린샷 시 비전 LLM. 소스당 순차, **딜레이 5초/req, UA "GlowmateBot/1.0 (+glowmate-dun.vercel.app/bot; 연락 메일)"**.
- **추출 프롬프트 계약**: 입력=본문 텍스트(또는 스크린샷), 출력=위 스키마 JSON 배열. "가격이 이미지에만 있으면 needs_ocr 플래그". 골든셋(수작업 라벨 20건)으로 **추출 일치율 95% 게이트** — 미달 시 노출 확대 금지.

## 3. 법적 가드레일 (구현 항목으로 번역)
| 판례 교훈 | 구현 |
|---|---|
| 성과도용(야놀자v여기어때) | **경쟁 플랫폼 도메인 블랙리스트 하드코딩**(gangnamunni·babitalk·yeoshin·modoodoc 등) — 수집기가 URL 등록 자체를 거부 |
| DB권(잡코리아v사람인) | 개별 병원 사이트에서 '가격 사실'만 추출. 전체 페이지 저장 금지 → source_snippet(≤300자)+해시만 |
| robots/부하 | robots.txt 파서(불허 시 crawl_sources.robots_ok=false로 스킵), 5s 딜레이, 월 1회 |
| 병원 권리 | `/partners`에 **"우리 병원 정보 정정·삭제"** 폼 추가(partner_inquiries 재사용, type='correction') → removed 처리 SLA 3영업일. **정정 유입 = 파트너 영업 리드**(모두닥의 '정정하기' 루프) |
| 저작권 | 심의필 광고 이미지·문구 재게시 금지. 우리 표기는 항상 정규화 필드로 재구성 |
| 게이트 | 첫 노출 전 법무 검토 1회(§27 역경매 안건과 묶어서) |

## 4. 노출 UX (3면)
1. **병원 상세 "가격 정보"**: SKU 테이블 — 구성 | 총액(이벤트가는 정상가 취소선 병기 — 모두닥 문법) | **단가**(샷당/cc당) | 조건 배지 | `출처: 병원 홈페이지 · 8/15 확인` + [정보가 달라요] 신고 버튼. consult 병원은 "가격 비공개 — 견적 요청으로 확인 →"(③ 진입점).
2. **병원찾기 가격 렌즈**: 고민 필터 선택 시 카드에 해당 대표 시술의 verified 최저 offer("울쎄라 300샷 129만~"). 데이터 없으면 표시 안 함(기존 정직 원칙).
3. **시술 단가 비교(레슨/Q&A 연동)**: "강남 울쎄라 300샷 기준 샷당 3,800~4,600원, n=12곳" — ④분포(실결제)와 나란히 = **광고가 vs 실결제가 대조**가 우리만의 화면.
- 신선도 규칙: collected_at 30일 경과 시 "○일 전 확인" 표시, 60일 경과 자동 stale.

## 5. 커버리지 계획 (콜드스타트)
- 목표: **강남·서초 × 5시술(울쎄라·슈링크·리쥬란·보톡스·필러) × verified offer 100건** (병원 ~30곳).
- 서베이 실측 공개율(텍스트 가격) ≈ 60% → 소스 60곳 필요. 확보: 서베이 21 + HIRA homepage_url + 검색 배치.
- 수집원 믹스 예상: official_site 60% · concierge 25%(③ 부산물) · user_receipt 10% · partner 5%.

## 6. 지표 & 게이트
추출 일치율(골든셋) ≥95% / verified offer 수 / 신선도(30일 내 비율 ≥80%) / [정보가 달라요] 신고율 <3% / 정정·삭제 요청 처리 SLA 3영업일 / 가격 렌즈 노출 시 병원 상세 전환율(A/B 근거).

## 7. 개발 분해
| 단계 | 작업 | 게이트 |
|---|---|---|
| W3-a | 0012 마이그레이션 + 골든셋 20건 수작업 라벨 | — |
| W3-b | 정적 수집기+LLM 추출기(bun 스크립트) + 블랙리스트·robots·딜레이 | 일치율 95% |
| W4-a | 어드민 "가격 검수" 탭(스니펫 대조 UI) + Playwright 폴백 | — |
| W4-b | verified 50건 적재(수집+컨시어지 합류) | 법무 검토 완료 |
| W5 | 노출 3면 + 정정·삭제 폼 + 신고 버튼 | 신선도 규칙 가동 |

## 8. 미결(다음 결정 필요)
- Playwright 실행 환경(로컬 수동 vs GH Actions) — 베타는 로컬 수동으로 충분
- 비전 OCR 발동 기준(서베이상 필요성 낮음 — 이미지 단독 가격 미확인) — 실수요 확인 후
- '병원 확인가' 배지(파트너 제출)와 수집가의 시각 구분 — 파트너 1호 생기면
