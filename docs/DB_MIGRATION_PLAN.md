# GlowMate — 정적 카탈로그 → Supabase DB 이관 실행계획

작성 2026-08-13 · 리뷰 스킬: /plan-eng-review · 브랜치 main

## 0. 목표

정적 TS 카탈로그(`src/lib/catalog/{procedures,rules,hospitals}.ts`)를 Supabase DB로 이관해
**실제 정보를 DB에서 관리**한다. 룰베이스 결정론 견적 엔진은 그대로 유지하되, 데이터 소스만
정적 import → DB로 바꾼다. §56(의료광고)·§27(유인·알선 금지) 인바리언트는 이관 후에도 유지·강화한다.

## 1. 확정 결정 (D2/D3/D4)

| # | 결정 | 선택 | 함의 |
|---|------|------|------|
| D2 | 서빙 모델 | **서버 액션 추가(경량)** | client 견적 플로는 유지. 데이터 접근만 서버 액션 3개로 대체. page.tsx 재작성 없음. |
| D3 | 카탈로그 진짜 주인 | **DB 완전 주인 · 스튜디오 직접 수정** | DB가 유일 소스. TS는 1회 시드 부트스트랩용. **직접 수정 허용 → §56 검증이 코드 밖으로 빠지므로 DB 트리거 방어장치 필수.** |
| D4 | 개발 DB | **호스티드 Supabase** (Docker 부재로 변경) | 사용자가 supabase.com 프로젝트 생성 후 URL+anon+service_role 키를 `.env.local`에 제공. env 없으면 repo가 TS 시드로 폴백(앱 안 깨짐), 키 넣으면 DB 전환. |

## 2. 아키텍처 · 데이터 흐름

```
                         ┌──────────────────────── Supabase (Postgres) ────────────────────────┐
                         │  procedures · procedure_sources · concerns · concern_procedure_rules │
                         │  hospitals · hospital_procedure_prices · ad_placements               │
   [운영자]              │  banned_phrases (§56 금지표현)                                        │
   Supabase Studio ────▶ │  ▲ write-time TRIGGER: check_catalog_compliance() (§56 방어)         │
   (병원·가격 직접수정)  └──────────────┬──────────────────────────────────────────────────────┘
                                        │ RLS: 공개 read=catalog/current price/active hospital
                                        │       write=service_role만
              ┌─────────────────────────┼─────────────────────────┐
              │ (build-time 시드/PR)     │ (runtime read, cached)  │ (runtime read, live)
   ┌──────────┴─────────┐    ┌───────────┴──────────┐   ┌──────────┴───────────┐
   │ scripts/seed.ts    │    │ lib/catalog/repo.ts  │   │ repo.ts (hospitals)  │
   │ TS 시드 → upsert    │    │ snake→camel 매핑     │   │ is_current, active   │
   │ + assertCompliant   │    │ getCatalog() 캐시    │   │ 지역 필터            │
   └────────────────────┘    └───────────┬──────────┘   └──────────┬───────────┘
                                          │                         │
                              ┌───────────┴─────────────────────────┴──────────┐
                              │ src/app/estimate/actions.ts  ("use server")     │
                              │  getConcerns()  runEstimate(input)  getHosp(id) │
                              │  runEstimate = buildEstimate(input, catalog)    │  ← 서버에서 결정론 계산
                              └───────────────────────┬─────────────────────────┘
                                                      │ Estimate JSON (items+answer+sources)
                              ┌───────────────────────┴─────────────────────────┐
                              │ src/app/estimate/page.tsx ("use client")         │
                              │  기존 플로 유지 · import 3개 → server action 호출 │
                              └──────────────────────────────────────────────────┘
```

핵심: **데이터·§56검증·결정론 계산은 전부 서버/DB에.** 클라이언트엔 계산된 Estimate만 내려간다.

## 3. §56 방어 심층화 (D3=B의 필수 조건)

D3에서 "스튜디오 직접 수정"을 택했으므로 §56 금지표현 검증이 앱 코드(assertCompliant)만으로는
불충분하다. **누가 어디서 고치든** 막으려면 검증을 데이터 옆(DB)에 둔다.

```
방어선 1 (write-time, DB)   : banned_phrases 테이블 + BEFORE INSERT/UPDATE 트리거
                              → 금지표현 포함 시 RAISE EXCEPTION (studio·seed·app 모두 차단)
방어선 2 (compute-time, app): buildEstimate 조립 후 assertCompliant (기존 유지)
```

`banned_phrases`는 `src/lib/compliance/bannedPhrases.ts`의 `BANNED_PHRASES`를 시드 소스로 →
TS(앱)·DB(트리거) 단일 소스 동기. 트리거는 `procedures`(문구 컬럼들)·`procedure_sources.label`·
`concerns.sentence`에 적용.

§27 인바리언트: `ad_placements`는 정액(monthly_fee)만. 예약/건당 수수료 컬럼 부재 유지(스키마 불변).

## 4. 스키마 변경

- **0002_catalog_drift.sql** (필수 — 현재 스키마가 M1 증강 이전): `procedures`에
  `side_effects, contraindication, misconception, vs_note` 컬럼 추가(not null default ''),
  `concerns`에 `sentence, emoji` 추가.
- **0003_compliance_guard.sql**: `banned_phrases(phrase text primary key)` 테이블 +
  `check_catalog_compliance()` 트리거 함수 + procedures/procedure_sources/concerns 트리거.
- RLS: 카탈로그 write는 service_role만(시드/앱 서버). studio는 service_role로 접속하므로 편집 가능.

## 5. 코드 변경 (파일 목록)

| 파일 | 변경 | 비고 |
|------|------|------|
| `supabase/migrations/0002_catalog_drift.sql` | 신규 | 드리프트 컬럼 |
| `supabase/migrations/0003_compliance_guard.sql` | 신규 | §56 트리거 |
| `src/lib/supabase/server.ts` | 신규 | service_role 서버 클라이언트(캐시) |
| `src/lib/catalog/repo.ts` | 신규 | DB read + snake→camel 매핑, `getCatalog()`/`getConcerns()`/`getHospitalPrices()` |
| `src/lib/estimate/engine.ts` | 리팩터 | `buildEstimate(input, catalog)` 주입식(순수 유지) |
| `src/lib/estimate/engine.test.ts` | 수정 | 시드 데이터로 fixture 주입 |
| `src/app/estimate/actions.ts` | 신규 | `"use server"` 3개 액션 |
| `src/app/estimate/page.tsx` | 수정 | import 3개 → 액션 호출 + 로딩상태 |
| `scripts/seed.ts` | 신규 | TS 시드 → DB upsert(+assertCompliant) |
| `package.json` | 수정 | `@supabase/supabase-js`, `tsx`/시드 스크립트, `dotenv` |
| `.env.local` | 신규(사용자) | 로컬 supabase URL/keys (`supabase start`가 출력) |
| `src/lib/catalog/{procedures,rules}.ts` | 유지 | 런타임 import 제거, 시드·테스트 fixture 소스로만 |
| `src/lib/catalog/hospitals.ts` | 제거 예정 | repo.getHospitalPrices()로 대체 |

TS 카탈로그(procedures/rules)는 **삭제하지 않고** 시드 소스 겸 테스트 fixture로 남긴다(버전관리·리뷰 가능).
런타임 경로에서만 분리한다.

## 6. 엔진 리팩터 (make-the-change-easy)

```
현재: buildEstimate(input)            → 모듈 레벨 PROCEDURE_BY_ID/RULES 직접 참조
변경: buildEstimate(input, catalog)   → catalog={proceduresById, rules, concernsById} 주입
```

- 순수성·결정론 불변(같은 입력+같은 catalog = 같은 출력).
- 테스트는 시드 fixture 주입 → 6개 테스트 그대로 통과(오프라인, DB 불필요).
- 서버 액션은 `getCatalog()`(캐시된 DB read) 주입.

## 7. 시드 파이프라인

`scripts/seed.ts`: `PROCEDURES/CONCERNS/RULES/BANNED_PHRASES` import → 각 텍스트 필드
`assertCompliant` 통과 확인 → service_role로 upsert(멱등). 병원/가격은 `hospitals.ts` 시드도
DB로 이관(스냅샷 versioning: snapshot_id 1개, is_current=true). 실행:
`supabase start && supabase db reset && bun run seed`.

## 8. 마일스톤

1. deps + 0002/0003 마이그레이션 + supabase/server.ts
2. repo.ts(매핑) + engine 주입 리팩터 + 테스트 초록
3. seed.ts + 로컬 시드 검증
4. actions.ts + page.tsx 배선 + 브라우저 E2E 검증
5. hospitals.ts 제거, 커밋

## 9. 리스크 · 엣지케이스

- **자격증명 블로커**: 계정/키 입력은 대행 불가. 로컬 supabase(D4=A)로 우회. 배포는 후속.
- **Docker 미설치**: `supabase start`가 Docker 요구. 없으면 M0 블로킹 → 사용자 설치 필요.
- **studio 직접수정 §56 우회**: 0003 트리거로 차단(방어선1). 트리거 미적용 컬럼은 없게 점검.
- **네트워크 지연**: runEstimate 1회 왕복 → 기존 "분석 중" 로더가 마스킹. 카탈로그 read는 캐시.
- **빈 결과/미매칭**: 엔진 needsConsult graceful 경로 유지.
- **DB 빈 상태(시드 전)**: repo가 빈 배열 → 엔진 needsConsult. 시드 필수 안내.

## GSTACK REVIEW REPORT

Runs: 1 (plan-eng-review, claude) · Status: LOCKED · 대상: 본 실행계획 초안

| 영역 | 소견 | 판정 |
|------|------|------|
| Architecture | 서버 액션 경량(D2=A). 결정론 계산·데이터·§56검증 서버/DB 집중. RSC 전면분리는 과임으로 배제. | OK |
| 스키마 드리프트 | procedures 4컬럼·concerns 2컬럼 누락 확인 → 0002 필수. | 수정 필요(계획 반영) |
| §56 방어 | D3=B(스튜디오 직접) 선택으로 앱 검증만으론 불충분 → 0003 DB 트리거로 심층화. 방어선 2단. | OK(필수조건 반영) |
| §27 인바리언트 | ad_placements 정액만, 수수료 컬럼 부재 유지. | OK |
| DRY | banned_phrases·catalog fixture를 TS 단일 소스에서 DB·테스트로 파생. | OK |
| Tests | 엔진 주입식 리팩터로 6 테스트 오프라인 유지 + 시드 §56 검증 테스트 추가 권장. | OK |
| Performance | 카탈로그 read 캐시, 병원가만 live. 견적 1왕복은 로더가 흡수. | OK |
| Scope | 첫 DB 배선상 ~9파일은 불가피(스코프 크립 아님). 최소 diff 경로 선택. | OK |

VERDICT: APPROVED — 구현 진행. 로컬 Supabase(Docker) 전제.

NO UNRESOLVED DECISIONS
