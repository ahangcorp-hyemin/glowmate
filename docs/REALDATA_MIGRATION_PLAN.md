# GlowMate — 목업 제거 → 실데이터(병원·가격·위치) 전환 실행계획

작성 2026-08-14 · 리뷰: /plan-eng-review · 브랜치 main

## 0. 목표
가짜 병원·가격·사회적증거를 전부 제거하고, 국가 공개 API 기반 실데이터로 전환한다.
사용자 실위치(GPS) 기준 근처 피부과·성형외과를 띄우고, 가격은 HIRA 비급여 공개데이터에서
가져온다(없으면 '병원 문의'). 크롤링은 쓰지 않는다(합법·안정).

## 1. 확정 결정 (D2/D3/D4)
| # | 결정 | 선택 |
|---|------|------|
| D2 | 데이터 아키텍처 | **HIRA 인제스트 → DB**. GPS 거리(haversine)로 근처순 조회 + 실가격 join. Kakao는 지역명·지도링크 보조. |
| D3 | 가격 빈칸 | **공개가만 표시, 없으면 '병원 문의'**. 가짜가 절대 금지. |
| D4 | 위치 UX | **허가 요청 + 지역 수동선택 폴백**(강남·분당…). |

## 2. 데이터 소스 (공식·무료)
- **병원정보서비스** (`data.go.kr/data/15001698`) — `apis.data.go.kr/B551182/hospInfoServicev2/getHospBasisList`
  · `ykiho`(요양기호), `yadmNm`, `XPos/YPos`(좌표), `telno`, `addr`, `clCd`(종별). `xPos/yPos/radius` 반경검색 지원.
- **비급여진료비정보** (`data.go.kr/data/15001700`) — `getNonPaymentItemHospList(비급여코드)` → `ykiho, minAmt/maxAmt`.
  753항목·의료법 §45의2. 보톡스 등 미용 비급여 포함(항목별 커버리지 상이).
- **Kakao Local** (`developers.kakao.com`) — `coord2regioncode`(좌표→행정동, 지역 라벨), 지도 링크. 보조.
- **Geolocation** — 브라우저 `navigator.geolocation`. 키 불필요.

## 3. 데이터 흐름
```
[HIRA 공공데이터포털]                                   [브라우저: 병원 보기]
 getHospBasisList        getNonPaymentItemHospList        navigator.geolocation → (lat,lng)
  ykiho·좌표·전화·주소       ykiho·비급여코드·min/maxAmt          │ 거부/실패 → 지역 수동선택(강남·분당)
      │ (ingest 스크립트, 지역·과목 좁힘)   │                        ▼
      ▼                                     ▼                서버액션 nearbyHospitals(lat,lng,procId)
   DB hospitals ────────── ykiho ────────── DB hospital_procedure_prices     │
   (real: ykiho,lat,lng,          (real: ykiho, price, nonpay_code)          ▼
    tel,addr,dept,status)                 │                          DB RPC: haversine 거리순 N
      │                                    │                          + procedure 공개가 join
      └──── procedure_nonpay_map ──────────┘                                 │
            (비급여코드 ↔ our procedure id, 큐레이션)                          ▼
                                                              병원리스트: 거리·가격(or '문의')·전화·지도링크
                                                              (§27: 링크아웃, 건당 수수료 없음)
```

## 4. 스키마 변경 (0005_realdata.sql)
- `hospitals` 확장: `ykiho text unique`, `phone text`, `kakao_url text`, `depts text[]`(진료과목). (lat/lng/addr/status는 0001에 존재)
- `hospital_procedure_prices`: `nonpay_code text` 추가(비급여코드 추적). (나머지 컬럼 0001에 존재)
- 신규 `procedure_nonpay_map(procedure_id text, nonpay_code text, label text, primary key(procedure_id,nonpay_code))` — 비급여코드↔시술 큐레이션(관리형).
- RPC `nearby_hospitals(lat, lng, proc_id, radius_km, max_n)` — haversine 거리 계산, 종별·과목 필터, 공개가 left join. 확장 없이 순수 SQL.
- RLS: public read(active), write service_role.

## 5. 파일
| 파일 | 변경 |
|------|------|
| `supabase/migrations/0005_realdata.sql` | 신규 스키마 + RPC |
| `scripts/ingest-hira.ts` | 신규 — HIRA 병원+비급여 인제스트(지역·과목·매핑 시술 한정) |
| `src/lib/hospitals/hira.ts` | 신규 — HIRA/공공데이터 API 클라이언트(fetch+파싱) |
| `src/lib/hospitals/repo.ts` | 신규 — `getNearbyHospitals()` (RPC 호출, DB만; 데이터 없으면 빈 배열 정직) |
| `src/lib/geo/region.ts` | 신규 — Kakao coord2regioncode 래퍼 + 지역 상수(강남·분당…) |
| `src/app/estimate/actions.ts` | `fetchHospitalPrices` → `fetchNearbyHospitals(lat,lng,procId)` 교체 |
| `src/app/estimate/page.tsx` | 병원 오버레이: 위치권한 요청 + 지역 폴백 UI, 실데이터 렌더('문의' 포함) |
| `src/app/page.tsx` · `estimate/page.tsx` | "1,240명" 가짜 사회적증거 **제거** |
| `src/lib/catalog/hospitals.ts` | **삭제**(HOSPS·hospitalPrices 목업) |
| `src/lib/catalog/repo.ts` | `getHospitalPrices`/seed 폴백 **제거** |
| `scripts/seed.ts` | 병원·가격 시딩 **제거**(병원은 ingest가 채움), procedure_nonpay_map 시드만 |
| `.env.local.example` · `docs/ENV_SETUP.md` | 신규 env + 가이드(링크 포함) |

## 6. 환경변수 (가이드)
| 키 | 용도 | 발급 | 노출 |
|----|------|------|------|
| `DATA_GO_KR_SERVICE_KEY` | HIRA 병원·비급여 API | data.go.kr 가입→활용신청(15001698·15001700) | 서버 전용(ingest) |
| `KAKAO_REST_API_KEY` | 좌표→지역, 지도링크 | developers.kakao.com 앱→REST 키 | 서버 전용 |
| `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` | DB | supabase.com→Settings/API | 서버 전용 |
Geolocation은 브라우저 API라 키 없음. 상세는 docs/ENV_SETUP.md.

## 7. 마일스톤
1. 0005 스키마 + RPC + procedure_nonpay_map 시드
2. hira.ts 클라이언트 + ingest-hira.ts(강남·분당+서울, 피부과/성형외과, 매핑 시술)
3. hospitals/repo.ts + geo/region.ts + actions 교체
4. page.tsx 위치권한/지역폴백 UI + 실데이터 렌더
5. 목업 전부 제거(hospitals.ts 삭제, 1,240명 제거, seed 정리)
6. 빌드·검증(키 없으면 정직한 빈 상태) · 커밋

## 8. 리스크 · 엣지케이스
- **자격증명 블로커**: data.go.kr/kakao 키는 사용자가 발급(대행 불가). 키 없으면 병원 리스트는 **가짜 대신 정직한 빈/문의 상태**. 앱 안 깨짐.
- **HIRA 필드/파라미터 실검증**: 활용가이드 대비 첫 실행 시 응답 스키마 확인 필요(코드는 문서화 필드에 맞춤).
- **비급여 커버리지 부분**: 매핑 안 된 시술·미공개 병원 → '문의'. 정직.
- **좌표 반경 성능**: haversine 순수 SQL은 소규모(수천 행)엔 충분. 전국 확장 시 earthdistance/PostGIS 고려.
- **위치 권한 거부**: 지역 수동선택 폴백 필수(구현).
- **의료법 §27**: 병원은 링크아웃(지도/전화), 예약·건당 수수료 없음. 광고는 정액만(스키마 유지).

## GSTACK REVIEW REPORT
Runs: 1 (plan-eng-review, claude) · Status: LOCKED

| 영역 | 소견 | 판정 |
|------|------|------|
| Architecture | HIRA를 DB로 인제스트해 거리순+실가격 join. Kakao 매칭 불필요(ykiho 단일키). boring·정직. | OK |
| 데이터 소스 | 공식 무료 API(병원·비급여) + Kakao 보조. 크롤링 회피(합법). | OK |
| Scope | 지역(강남·분당+서울)·과목(피부/성형)·매핑 시술로 인제스트 규모 축소. ~11파일은 실데이터 파이프라인 본질복잡도. | OK |
| §56/§27 | 가짜가·가짜 사회적증거 제거. 미공개는 '문의'. 병원 링크아웃·정액광고만. | OK |
| Tests | ingest 파서·haversine RPC·매핑 단위테스트 권장. repo는 DB없으면 빈배열(정직). | OK |
| Performance | 거리 RPC 소규모 OK. 인제스트는 배치(레이트리밋 준수). | OK |
| Reversibility | 키 없으면 빈 상태 폴백 → 점진 전환(strangler). 목업 삭제는 되돌림 쉬움(git). | OK |

VERDICT: APPROVED — 구현 진행. data.go.kr/kakao 키는 사용자 발급 전제(없으면 정직한 빈 상태).

NO UNRESOLVED DECISIONS
