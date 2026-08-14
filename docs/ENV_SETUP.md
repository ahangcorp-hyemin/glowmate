# 환경변수 설정 가이드

`.env.local.example` → `.env.local` 복사 후 채우세요. 전부 **서버 전용**(클라이언트 노출 금지).
키가 없으면 앱은 안 깨지고, 병원 목록만 정직한 빈/문의 상태가 됩니다.

| 변수 | 어디에 쓰나 | 발급처(링크) | 비고 |
|------|-------------|--------------|------|
| `SUPABASE_URL` | DB 접속 | [supabase.com](https://supabase.com) → 프로젝트 → **Settings → API** → Project URL | |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버/시드/인제스트 DB 쓰기 | 같은 화면 → **service_role** secret | 절대 클라 노출 금지 |
| `DATA_GO_KR_SERVICE_KEY` | HIRA 병원·비급여 실데이터 인제스트 | [공공데이터포털](https://www.data.go.kr) 가입 후 두 데이터셋 **활용신청** ↓ | 승인 즉시~1일 |
| `KAKAO_REST_API_KEY` | 좌표→지역명, 지도 링크 | [Kakao Developers](https://developers.kakao.com) → 내 애플리케이션 → **REST API 키** | 없어도 동작(지역명만 생략) |

### 공공데이터포털 활용신청 (DATA_GO_KR_SERVICE_KEY)
인증키는 **계정당 1개**로 아래 3개 서비스 전부에 쓰입니다.
1. [병원정보서비스 15001698](https://www.data.go.kr/data/15001698/openapi.do) → **활용신청** (병원·좌표·전화)
2. [비급여진료비정보 15001700](https://www.data.go.kr/data/15001700/openapi.do) → **활용신청** (실가격)
3. [의료기관별상세정보서비스 15001699](https://www.data.go.kr/data/15001699/openapi.do) → **활용신청** (진료과목=피부과/성형외과 판별)
4. 마이페이지 → 오픈API → 인증키(일반 인증키, Decoding) 복사 → `DATA_GO_KR_SERVICE_KEY`

### 위치(Geolocation)
브라우저 `navigator.geolocation` 사용 — **키 불필요**. 사용자가 권한 거부/실패하면 앱이 지역 수동선택으로 폴백합니다. (참고: 배포는 HTTPS에서만 위치 권한이 동작해요.)

## 설정 후 실행
```bash
cp .env.local.example .env.local     # 값 채우기
# Supabase SQL Editor에 supabase/migrations/0001~0005 순서대로 실행
bun run seed        # 카탈로그·레슨(시술 지식) 시드
bun run ingest      # HIRA 실데이터(병원·가격) 인제스트
bun run dev
```

## 데이터 출처 · 합법성
- 병원/가격은 **크롤링이 아니라 국가 공개 오픈API**(HIRA, 의료법 §45의2 비급여 공개)에서만 가져옵니다.
- 공개가 없는 시술·병원은 가짜값 대신 **'병원 문의'**로 표시합니다(§56).
- 병원 노출은 링크아웃(지도/전화)이며 예약·건당 수수료가 없습니다(§27). 광고는 정액만.
