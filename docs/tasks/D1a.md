# D1a — 조사 프로토콜 사전등록 (모집단·표집·"가격 확인됨" 정의·판정 임계)

> **분할 사유:** 사전등록과 현장조사가 한 PR에 있으면 통제가 원리적으로 무력하다.
> `git log` 커밋 시각 비교는 `GIT_COMMITTER_DATE` 조작과 squash merge 로 붕괴한다.
> 사전등록은 **PR 경계(=main 선머지)** 로만 강제할 수 있다.
> 구 `docs/tasks/D1.md` 는 폐기되었다.
>
> **개정:**
> - `v1.1` (2026-08-03) — 구현본(`feat/d1a-protocol`, 모집단 2,937행)에 대한 독립 실사 반영.
>   `medical_wellness` 진료과목 집합 확장(K-7), `population.csv` 좌표·전화 보존(K-8),
>   한계 기재 강제(K-9), 표본·홀드아웃 재생성 + 새 키 재봉인, `protocol.lock` 에 `population.csv` 편입,
>   `touches` P7 자기차단 해소, FORBID-1·3·4 확장 및 FORBID-6 신설.
> - `v1.2` (2026-08-03) — **공공데이터 실사 2차 + 사용자 승인에 따른 축 구성 확대.**
>   ① **`beauty_care` 축 신설**(미용업). 축이 3개 → **4개**, 층이 9칸 → **12칸**.
>   ② `relax_recovery` 에 안마시술소·안마원 편입.
>   ③ **K-5 전면 정정** — `www.localdata.go.kr` 은 방화벽 차단이 아니라 **2026-04-16 정식 폐쇄**됐다
>   (`v1.1` 의 "443 포트 차단" 서술은 오류였다). 별개 호스트 `file.localdata.go.kr` 은 살아 있고
>   무인증 전수 다운로드가 된다. 서울 열린데이터광장도 유효 — **1순위/백업 이원화**로 재서술.
>   ④ **구현 함정 4종을 계약이 소유**(UA/Referer 필수 · CP949 거짓 charset 선언 · EPSG:5174 ·
>   폐업 57%).
>   ⑤ **K-10 신설** — 심평원 벌크 파일로 의료기관 축의 홈페이지 URL·진료시간을 보강.
>   **프레임 소스가 아니며 멤버십 결정에 쓸 수 없다.** 부수 효과로 좌표 변환 오차의 독립 검증 기준을 얻는다.
>   ⑥ **K-11 신설** — 공공누리 1유형·서울시 약관 제10조③ 출처표시 의무와 이용조건 스냅샷 보존.
>   ⑦ **K-6 층화 배분 재설계** — 표본 크기 100·최소 칸 8·임계값을 **하나도 바꾸지 않고**
>   4축 12칸으로 재배분(축당 25 = 9/8/8, 홀드아웃 7/6/6/6). 근거는 K-6 주석.
>   ⑧ **REQ 재편** — 구 REQ-6(집계)과 구 REQ-7(임계)을 REQ-7 로 병합하고, 비워진 자리에
>   **REQ-6(모집단 데이터 품질)** 을 신설. REQ 총수는 8 로 유지.
> - `v1.2.1` (2026-08-03) — 실사 3차 수치·식별자 확정 반영. **규칙 변경 없음, 값 정정과 확정이다.**
>   ① 의료유사업 데이터셋 ID 확정 — `OA-16379`(서초)·`OA-16380`(강남)·`OA-16381`(송파).
>   ② **미용업·의료유사업은 자치구별로 OA-ID 가 분리**되어 있다(기존 3종은 시 단위 통합) —
>   빌드 절차가 데이터셋 **9종**을 다루도록 REQ-1 ② 정정.
>   ③ 업태 세분류 실측 정정 — 일반미용업(헤어) 2,913 → **2,312**. `화장ㆍ분장업`(319)·
>   `일반+화장`(312)의 편입 여부를 §헤어 결정에서 **명시적으로 판단**(제외).
>   ④ **T-5 신설** — 과다 요청 시 **HTTP 429**(임계값 미공개). 직렬 다운로드 + 지수 백오프 의무.
>   ⑤ 경로 교차검증 실측치 확정 — 미용업 6,983(포털) vs 6,963(LOCALDATA) = 0.29% · 체력단련장 1,316 완전 일치.
>   ⑥ **층화 칸 최소값 문의에 대한 답: 아무것도 낮추지 않았다.** 근거는 K-6 주석 §칸 최소값.
>
> **상신(escalation) — 본 계약에서 고치지 않음. 다른 담당이 처리한다:**
> 1. **`docs/tasks/D1b.md` 의 P7 자기차단.** `done_when` 이 위반 픽스처 6종을
>    `scripts/discovery/fixtures/d1b/` 에 두라고 요구하는데 그 경로가 `deliverable.touches`
>    (`docs/discovery/D1b/**` · `docs/gates/G1.md` · `scripts/discovery/validate_d1b.py`) 밖이라
>    F1 path-guard 가 자기 PR을 차단한다. D1a `v1.1`·D4 `v2.1` 과 동일 결함. **D1b.md 는 건드리지 않았다.**
> 2. **출처표시 렌더링 의무 (K-11).** 서울시 열린데이터광장 이용약관 제10조③ 은
>    *"검색결과를 노출하는 페이지에 「서울특별시 공공데이터」를 사용한 결과임을 명시"* 를 요구하고,
>    공공누리 제1유형은 **하이퍼링크 형태의 출처표시**를 요구한다. 이는 D1a 산출물이 아니라
>    **제품 화면의 요구사항**이다. 수신 후보:
>    **① `W1`(SEO 기반 — 전역 문서 헤드/푸터·렌더링 전략 소유. 전역 출처표시 컴포넌트의 자연스러운 주인)**,
>    ② `W2`·`W3`·`W4`(리스트·상세·조합 랜딩 — 실제로 "검색결과를 노출하는 페이지"),
>    ③ `D3`(소스 실사 — 라이선스 사실관계와 재공개 정책의 소유자. 의무의 *출처*는 D3 가 확정해야 한다).
>    **권고: D3 가 의무를 확정 → W1 이 전역 렌더링을 소유 → W2·W3·W4 는 W1 컴포넌트를 소비.**

---

## 알려진 프레임 한계 — 하류가 "전수"로 읽는 것을 막는다

> 이 절은 **계약이 소유한다.** 저자가 축소하거나 삭제할 수 없으며, `frame_build.md` 에
> 기계 판독 가능한 형태(K-9 키)로 전재되어야 한다(REQ-1). G1 판정문에 이 문단이 없으면
> 판정 수치는 "강남3구 웰니스 업체 전수의 가격 공개율"로 오독된다.

1. **`beauty_waxing_no_code` — 왁싱은 독립 업태코드가 없다.** 공중위생관리법상 왁싱 전문점은
   **피부미용업으로 신고**되며, 인허가 대장의 업태 컬럼만으로는 왁싱 업소를 식별할 수 없다.
   상호명 텍스트로 추정하는 것만 가능하고, 본 프레임은 그 추정을 하지 않는다.
2. **`beauty_hair_excluded` — 일반미용업(헤어) 2,312 및 화장ㆍ분장업 319·일반+화장 312 를
   축에서 제외했다.** 근거는 K-7 §헤어 결정. 그 결과 `beauty_care` 는 "미용업 전수"가 아니라
   **"피부·네일·종합 미용업"** 이며, 미용업 6,983 중 약 42%가 축 밖에 있다.
   **`beauty_care` 축의 커버리지를 "강남3구 미용업 가격 공개율"로 인용하는 것은 오독이다.**
3. **`beauty_phone_fill_21pct` — 미용업의 전화 채움률은 21%에 불과하다.** 게다가 미용업은
   K-10 보강 경로(심평원)가 **존재하지 않는다**(의료기관이 아니므로). 따라서 `beauty_care` 축은
   업체 자체 채널로 도달할 단서가 4개 축 중 가장 취약하며, D1b 조사에서 `blocked` 가
   이 축에 집중될 가능성이 구조적으로 높다.
4. **`free_business_absent` — 필라테스·요가는 자유업이라 인허가 대장에 대부분 없다.**
   체력단련장업으로 신고한 일부만 `exercise_body` 에 들어온다.
5. **`medical_subject_proxy` — `medical_wellness` 는 표방 진료과목 기준의 대리 지표다.**
   실제 시행 시술(레이저·리프팅·도수치료·영양수액)은 인허가 대장에 없다.
6. **`license_bias_direction` — 편향 방향은 커버리지를 높이는 쪽일 수 있다.** 인허가 업체는
   규모가 크고 웹 노출이 잦다. G1 판정이 임계 근처면 이 한계가 판정을 낙관적으로 만들었을
   가능성을 함께 기록해야 한다.
7. **`map_enumeration_unused` — `map_category_enumeration` 을 쓰지 않았다.** 1·4 의 공백은
   지도 카테고리 전수 나열로만 메울 수 있으나, D3 실사 결론 이전에 그 접근 이력을 만드는 것을
   금지했으므로 공백을 남겨 둔다.
8. **`epsg5174_offset` — 좌표에 수십~수백m 계통 오차가 남는다.** 원본 좌표계 EPSG:5174 는
   **보정계수 미적용 Bessel 중부원점TM** 이라, WGS84 표준 정의로 변환해도 잔차가 남는다.
   **지도 핀 표시에는 충분하나 "도보 N분"·최근접 정렬 같은 거리 연산의 근거로 쓰면 안 된다.**
   잔차의 실측값은 K-10 교차검증으로 산출해 `frame_build.md` 에 기록한다.
9. **`axis_n25_precision` — 축이 4개가 되면서 축당 표본이 25로 줄었다.** 표본 크기 100 을
   늘리지 않는다는 제약의 산술적 귀결이다. `p̂ = 0.40`, `n = 25` 에서 Wilson 95% 구간 반폭은
   약 ±0.19 로, **판정 임계 간격(0.40−0.25 = 0.15)보다 넓다.** 즉 축별 verdict 는 점추정에
   의존하며 구간으로는 `proceed`/`editor_augment`/`axis_excluded` 가 분리되지 않는 경우가
   구조적으로 발생한다. G1 판정문은 축별 점추정과 함께 Wilson 구간을 반드시 병기해야 한다.

---

## 계약 고정 상수 — 사전등록이 **선택할 수 없는** 값

> 감사 지적("사후 완화는 막았으나 사전 설정이 무방비")에 대한 대응.
> 아래 값·enum 은 D1a 저자가 정하는 것이 아니라 **본 계약이 정한다.** 잠금 대상의 허용 범위다.

### K-1. 허용 증거 채널 (이 집합의 **부분집합만** 선택 가능. 확대 불가)

| 값 | 정의 |
|---|---|
| `website` | 업체가 소유·운영하는 공식 웹사이트 |
| `naver_place` | 네이버 플레이스 업체 등록 정보 |
| `kakao_map` | 카카오맵 업체 등록 정보 |
| `instagram_public` | 업체 공식 계정의 **로그인 없이 열람 가능한** 게시물 |
| `official_blog` | 업체가 운영 주체로 명시된 공식 블로그 |

### K-2. 증거로 **인정 금지** (프로토콜에 포함하면 계약 위반)

전화·카카오톡·DM·방문 문의로 취득한 가격 · 제3자 후기/체험단/카페 글에 적힌 결제 금액 ·
쿠폰/딜 플랫폼(소셜커머스) 판매가 · 종료된 이벤트 가격 · 타 업체 가격의 유추 · 조사자 추정치

### K-3. `price_found = true` 성립 요건 (전부 충족해야 하며 완화 불가)

1. K-1 채널 중 하나에 **현재 게시**되어 있을 것 (열람 시점 스냅샷으로 증명)
2. **금액 숫자**와 **대상 서비스명**이 **동일 페이지**에 함께 게시되어 있을 것
3. "가격 문의" · "상담 후 안내" · "회원 문의" 만 있는 경우는 `false`

### K-4. 판정 임계 — PRD §4 G1 전사. **다른 값 기입 불가**

`proceed_threshold = 0.40` · `exclude_threshold = 0.25` · 그 사이 = `editor_augment`

### K-5. 표본 프레임 허용 소스 — `v1.2` 전면 정정

`map_category_enumeration`(지도 서비스의 지역×카테고리 **전수 나열**) · `public_license_registry`(공공 인허가 데이터)

**`public_license_registry` 취득 경로 — 이원화. 다른 경로 기입 불가**

| 순위 | 경로 | 형태 | 상태 |
|---|---|---|---|
| **1순위** | `https://file.localdata.go.kr/file/download/{slug}/info?orgCode={자치구코드}` | 자치구 단위 전수 파일 | 무인증 HTTP 200 실측 |
| **백업** | `https://datafile.seoul.go.kr/bigfile/iot/sheet/csv/download.do?infId={dataset_id}&seq=2&srvType=S` | 서울 열린데이터광장 전수 파일 | 무인증 HTTP 200 실측 |

- 자치구 코드: **서초 `3210000` · 강남 `3220000` · 송파 `3230000`**
- 슬러그 5종: `fitness_centers` · `public_baths` · `clinics` · `beauty_salons` · `medical_related_businesses`
- **두 경로는 교차검증되었다** — 미용업 6,983(포털) vs 6,963(LOCALDATA) = **0.29% 차이**,
  체력단련장업 1,316 **완전 일치**. 저자는 1순위로 수집하고, 축별 행 수가 백업 경로 산출과
  **±2% 이내**인지 대조해 `frame_build.md` 에 기록한다. 초과 시 수집 시점 차이를 명시한다.
- **`www.localdata.go.kr` 은 사용 불가.** 2026-04-16 **정식 폐쇄**되었고 인허가 195종이
  data.go.kr 로 일원화되었다. `file.localdata.go.kr` 은 **별개 호스트이며 살아 있다** —
  둘을 혼동해 "LOCALDATA 는 죽었다"로 처리하면 1순위 경로를 통째로 잃는다.

**구현 함정 4종 — 실사 에이전트가 실제로 밟았다. 계약이 소유한다**

| # | 함정 | 계약이 요구하는 대응 |
|---|---|---|
| T-1 | **UA/Referer 헤더가 없으면 302** | `User-Agent: Mozilla/5.0 ... Chrome/126.0 Safari/537.36` 및 `Referer: https://file.localdata.go.kr/file/{slug}/info` 를 요청에 포함 |
| T-2 | **본문은 CP949 인데 HTTP 헤더가 `charset=UTF-8` 로 거짓 선언** | 응답 헤더의 charset 을 **무시**하고 CP949 로 강제 디코드. UTF-8 로 읽으면 전 행 문자열이 깨진다 |
| T-3 | **좌표계 = EPSG:5174** (보정계수 미적용 Bessel 중부원점TM) | WGS84 가 아니다. K-8 변환 + K-10 교차검증 필수 |
| T-4 | **폐업이 전국 57%** (강남 미용업 10,082건 중 영업중 3,157건) | `영업상태명 == '영업/정상'` 필터 필수. 누락 시 분모가 2배 이상 부풀고 커버리지가 반토막 난다 |
| T-5 | **과다 요청 시 HTTP 429.** 임계값은 공개되지 않았다 | **직렬 다운로드**(동시 요청 금지) + 지수 백오프(초기 2초·배수 2·최대 5회). 요청 시각을 다운로드 로그에 남긴다. 임계가 미공개이므로 "몇 병렬까지 되는지" 탐색하는 것 자체가 차단 위험이며, 차단되면 1순위 경로를 잃는다 |
| T-6 | **미용업·의료유사업은 자치구별로 OA-ID 가 분리**돼 있다 | 기존 3종(`OA-16142`·`OA-16146`·`OA-16480`)만 시 단위 통합이다. 서울 포털 백업 경로는 **총 9개 데이터셋**을 받아야 하며, 자치구 3개 중 하나라도 빠지면 그 구의 두 축이 통째로 누락된다 |

**프레임 구축 필터에 사용 금지인 속성:** 가격/요금/이용권, 예약·결제 연동 여부, 광고·상위노출 상품 가입 여부,
리뷰 수·평점 상위 정렬, 검색 결과 상위 N

### K-6. 수치 상한·하한 — `v1.2` 층화 배분 재설계

| 항목 | 값 |
|---|---|
| 확정 표본 | **100 (축별 25 × 4축)** |
| 축당 구 배분 | 강남구 9 · 서초구 8 · 송파구 8 |
| **(축 × 구) 12칸** 각각 최소 | **8** |
| 홀드아웃 | 25 (축별 `exercise_body` 7 · 나머지 3축 각 6) |
| 표본 교체 상한 | 5건 |
| `blocked` 상한 | 5건 |
| 유효 조사 완료 정의 | `n = 100 − blocked − 교체불가` |
| 이중판정 대상 | 20건 (고정 시드 산출) |
| 이중판정 불일치 시 확정값 | `false` (보수적) |
| 홀드아웃 drift 허용 | `< 15%p` |

> **`v1.2` 재배분 근거 — 왜 25/25/25/25 인가 (이 판단을 뒤집으려면 계약 개정이 필요하다)**
>
> 제약은 셋이다: **표본 크기 100 불변 · 최소 칸 8 불변 · 임계 0.40/0.25 불변.**
> 축 4개 × 구 3개 = 12칸에서 이 셋을 동시에 만족하는 균등 배분은 `100 ÷ 4 = 25`,
> `25 = 9 + 8 + 8` 하나뿐이다. 축당 26 이상이면 총합이 100 을 넘고, 24 이하면 어떤 칸이 8 미만이 된다.
>
> **모집단 비례 배분을 쓰지 않은 이유:** 모집단은 1,316 / 180 / 3,595 / ≈4,040 으로 22배 차이 난다.
> 비례 배분하면 `relax_recovery` 표본이 2건이 되어 그 축의 G1 판정이 불가능해진다.
> **G1 판정 단위는 축이므로, 축 간 균등 배분이 최소 정밀도를 최대화한다.**
> 대신 **축 간 모집단 불균형(최대 22배)이 남으므로, 전 축 합산 수치를 낼 때 가중치 없이 더하면
> 편향된다.** 합산 수치가 필요하면 축별 모집단 크기로 가중해야 하며, 이 사실은 G1 판정문에 기재한다.
>
> **§칸 최소값 — 12칸 체제에서 무엇을 낮췄는가: 아무것도 낮추지 않았다.**
>
> | 규정 | v1.1 (9칸) | v1.2 (12칸) | 판정 |
> |---|---|---|---|
> | **표본** 칸당 최소 (K-6) | 8 | **8** | 유지. `12 × 8 = 96 ≤ 100` 이라 낮출 필요가 없다 |
> | **모집단** 칸당 최소 (REQ-1) | 20 (실측 최소 30) | **20** (실측 최소 ≈30) | 유지 |
>
> 모집단 최소 칸은 v1.1 에서 `relax_recovery × 서초구 = 30` 이었다. v1.2 에서 그 칸은
> 목욕장업 30 **+ 안마시술소·안마원 서초분** 이 되어 **줄지 않는다.** 새로 들어온 `beauty_care` 는
> 구별로 1,000 단위이므로 최소 칸을 만들지 않는다. **따라서 "칸이 늘어나 최소값을 낮춰야 하는"
> 상황은 발생하지 않았고, 통계적 대가를 칸 최소값으로 치르지 않았다.**
>
> **대가는 전부 축당 표본 수 한 곳에 몰려 있다.** 축당 33 → 25 로 줄었고, 이것이
> K-9 `axis_n25_precision` 이다. Wilson 구간 반폭 ±0.19 가 임계 간격 0.15 보다 넓다.
> 이것은 "표본을 늘리지 않는다"는 제약의 산술적 귀결이며,
> **이 대가를 임계값 조정이나 칸 최소값 완화로 상쇄하는 것은 FORBID-3 위반이다.**

### K-7. 축 정본 구성 — `v1.2`. 4축. **각 집합은 집합 동등(set equality)으로 검사한다**

**전 축 공통 조건:** `영업상태명 == '영업/정상'` ∧ 소재지 자치구 ∈ {강남구, 서초구, 송파구}

| 축 | LOCALDATA slug | 서울 포털 dataset_id | 프레임 편입 조건 | 참고 실측 |
|---|---|---|---|---|
| `exercise_body` | `fitness_centers` | `OA-16142` (시 단위 통합) | `license_category == '체력단련장업'` | 1,316 |
| `relax_recovery` | `public_baths` | `OA-16146` (시 단위 통합) | `license_category` 가 비어 있지 않음 | 139 |
| `relax_recovery` | `medical_related_businesses` | **`OA-16379`(서초)·`OA-16380`(강남)·`OA-16381`(송파)** | 업태명 ∈ **{안마시술소, 안마원}** | 41 (강남 22 = 안마시술소 12 + 안마원 10) |
| `medical_wellness` | `clinics` | `OA-16480` (시 단위 통합) | `license_category == '한의원'` **또는** (`license_category == '의원'` ∧ 진료과목 ∩ **{재활의학과, 정형외과, 피부과, 성형외과, 마취통증의학과}** ≠ ∅) | 3,595 |
| `beauty_care` | `beauty_salons` | **`OA-17923`(서초)·`OA-17924`(강남)·`OA-17925`(송파)** | `위생업태명` ∩ **{피부미용업, 네일미용업, 종합미용업}** ≠ ∅ | **≈4,040 (도출값)** |

> **⚠️ 데이터셋은 총 9종이다.** 미용업·의료유사업은 **자치구별로 OA-ID 가 분리**돼 있고
> 기존 3종만 시 단위 통합이다(T-6). 자치구 하나를 빠뜨리면 그 구의 `beauty_care`·안마분이
> 통째로 사라지는데, **모집단 총계는 여전히 그럴듯해 보여 눈에 띄지 않는다.**
> 그래서 REQ-1 ② 가 dataset_id 집합을 9종 **집합 동등**으로 검사한다.

**축 결정 규칙 문면 (정본. `frame_build.md` §축 결정표와 `frame.json` 에 글자 단위로 동일해야 한다):**

> 규칙은 위에서 아래로 처음 일치하는 것을 적용한다. 어느 규칙에도 걸리지 않으면 프레임 밖이다.
> 각 집합은 **부분집합도 상위집합도 위반**이며, 검증기가 집합 동등으로 판정한다.

**선정 기준 — 전 축 공통. 이 기준 밖의 업태·진료과목은 추가할 수 없다**

> **"회차권·패키지 단위로 가격이 형성되는 시술 축"** 하나다. 제품의 UVP 가 *회당 단가 비교*이므로,
> 회차권 구조가 표준이 아닌 업태는 비교 대상 자체가 없어 모집단에 들어갈 이유가 없다.

| 진료과목·업태 | 회차권·패키지가 형성되는 시술 축 |
|---|---|
| 피부과 | 레이저 토닝·리프팅·필링 (10회권·5회권 표준) |
| 성형외과 | 보톡스·필러·리프팅 (부위별 패키지) |
| 마취통증의학과 | 도수치료·체외충격파·주사요법 (회차권 표준) |
| 정형외과 · 재활의학과 | 도수치료·운동치료 |
| 피부미용업 | 관리 10회권·필링 패키지 |
| 네일미용업 | 정기권·아트 패키지 |
| 종합미용업 | 위 둘을 포함하는 복합 업태 |
| 안마시술소·안마원 | 회차권·정기권 |

**§헤어 결정 — 위생업태 6종 각각에 대한 편입 판정. 뒤집으려면 본 계약을 개정해야 한다**

`위생업태명` 실측 분포(영업중·강남3구)와 그 판정은 다음과 같다. **"넣지 않았다"가 아니라
"보고 판단해서 뺐다"는 것이 기록의 목적이다.**

| 위생업태명 | 실측 | 판정 | 사유 |
|---|---|---|---|
| 피부미용업 | 1,366 (복합 포함 1,724) | **편입** | 관리 10회권·필링 패키지 = 회차권 표준 |
| 네일미용업 | 635 (복합 포함 1,171) | **편입** | 정기권·아트 패키지 |
| 종합미용업 | 1,090 | **편입** | 헤어+피부+네일 복합. 피부·네일 수요를 실제로 담당 |
| 일반미용업(헤어) | **2,312** | **제외** | 아래 1~2 |
| 화장ㆍ분장업 | 319 | **제외** | 웨딩·행사 메이크업은 1회 완결형. 회차권 구조가 표준이 아니다 |
| 일반+화장(복합) | 312 | **제외** | 편입 집합 3종 중 어느 것도 포함하지 않는다 |

1. **선정 기준 일관성.** 헤어(커트·펌·염색)와 화장·분장은 시술 1회 완결형으로 회차권 구조가
   표준이 아니다. `medical_wellness` 에서 치과·안과를 뺀 것과 **정확히 같은 기준**을 적용한 결과다.
   축마다 다른 기준을 쓰면 그 순간 프레임이 임의 선택의 산물이 된다.
2. **분모 지배.** 헤어 단독은 미용업 6,983 중 2,312(약 33%)이고, 화장 계열 631 을 합치면 42%다.
   편입하면 `beauty_care` 축 커버리지가 헤어에 지배되고, G1 이 측정하는 값이
   "왁싱·피부관리 가격 공개율"이 아니라 **"미용실 가격 공개율"** 로 바뀐다. 헤어는 예약 플랫폼을
   통한 가격 공개가 이미 보편적이라 축 커버리지를 상방으로 끌어올리고, 그 결과 `proceed` 판정이
   실제와 무관하게 나온다. 이것은 진료과목 집합을 조작하는 것과 **동일한 효과의 분모 조작**이다.
3. **배제 단위는 "업태 단독"이지 "업태를 포함한 모든 업소"가 아니다.** 종합미용업(1,090)은
   헤어를 함께 신고했지만 피부·네일을 실제로 수행하므로 **편입**한다. 편입 규칙이
   `위생업태명 ∩ {피부미용업, 네일미용업, 종합미용업} ≠ ∅` 인 것은 이 때문이다 —
   "헤어를 신고했는가"를 묻지 않고 **"편입 3종 중 하나라도 하는가"** 만 묻는다.

> **참고 실측치 (2026-08-03 기준. 상류가 매일 갱신되므로 acceptance 는 하한만 건다)**
>
> | 축 | 개정 전 | v1.2 | 비고 |
> |---|---|---|---|
> | `exercise_body` | 1,316 | 1,316 | 강남 595 / 서초 354 / 송파 367 |
> | `relax_recovery` | 139 | **180** | 목욕장 139 + 안마 41 (강남 22) |
> | `medical_wellness` | 1,482 | **3,595** | 강남 2,004 / 서초 923 / 송파 668 |
> | `beauty_care` | 0 | **≈4,040** | 미용업 6,983 − 헤어 단독 2,312 − 화장·분장 319 − 일반+화장 312. **도출값이며 실측이 아니다** |
> | 합계 | 2,937 | **≈9,131** | 전 미용업을 편입했다면 ≈12,074 였을 값 |
>
> `beauty_care` 의 4,040 은 계산으로 얻은 값이고 복합업태 중복 처리에 따라 달라진다.
> 그래서 CI 하한은 **2,500** 으로 보수적으로 잡는다 — "축을 만들지 않았다"(0)와
> "헤어만 넣었다"를 잡되, 정당한 중복 제거로 인한 감소에는 red 를 내지 않는다.
> **참고 실측치를 acceptance 로 승격하지 않는 이유:** 상류가 매일 갱신되고 자치구별 파일 3개의
> 수집 시각이 어긋날 수 있어, 정확값을 CI 에 박으면 정당한 갱신에 red 가 난다.

**K-5 금지 속성 비해당 근거 (FORBID-1 판정용, 1줄):**
표방 진료과목·위생업태명·인허가 업태는 모두 **인허가 대장이 보유한 구조적 속성**이며 업체의
가격·예약 연동·광고 상품 가입·노출 순위와 독립이다 — 따라서 K-7 축 구성은 K-5 금지 속성 사용에
해당하지 않는다.

### K-8. `population.csv` 필수 스키마 — 컬럼 삭제 불가

| 컬럼 | 내용 | 비고 |
|---|---|---|
| `venue_id` `name` `gu` `axis` `frame_source` `dataset_id` `license_category` `medical_subjects` `org_code` `license_no` `road_address` `jibun_address` `license_status` | 기존 13종 | 유지 |
| `business_type` | 위생업태명·업태명 원문 (`beauty_care`·안마 축의 판정 근거) | `v1.2` 신설 |
| `lat` `lon` | 원본 TM 좌표를 **WGS84 로 변환**한 위도·경도. 소수 6자리 이하 | `v1.1` 신설 |
| `source_epsg` | 변환 전 원본 좌표계 EPSG 코드 (행 단위 기록) | `v1.1` 신설 |
| `phone` | 원본 소재지전화 중 **사업장 대표번호만** (아래 PII 단서) | `v1.1` 신설 |
| `homepage_url` `open_hours` | K-10 보강 결과. **`medical_wellness` 축에만 채워진다.** 다른 축은 전 행 빈 값 | `v1.2` 신설 |
| `enrich_match` | K-10 매칭 성립 여부 (`matched` / `no_match` / `ambiguous`) | `v1.2` 신설 |

- **좌표계:** 원본은 **EPSG:5174**(보정계수 미적용 Bessel 중부원점TM)이며 WGS84 가 아니다.
  변환 없이 위경도로 해석하면 좌표가 지구 반대편에 찍힌다. 저자는 변환 구현을 `frame_build.md` 에
  기록하고, 결과가 **강남3구 bbox** `lat ∈ [37.42, 37.58]` · `lon ∈ [126.96, 127.18]` 안에
  들어가는지, 그리고 **구별 중심점 편차 ≤ 1.5km** 인지로 검증한다
  (구 중심 기준값: 강남 `37.4959, 127.0664` · 서초 `37.4837, 127.0324` · 송파 `37.5145, 127.1059`).
  잔차의 정밀 측정은 K-10 교차검증이 담당한다.
- **채움률 실측치:** 좌표 96~99% · 도로명주소 100% · 전화는 축마다 다르다(의료·체육 81~82%,
  **미용업 21%**). **결측은 결측으로 남긴다.**
- **PII 단서 (D3 FORBID-5 와의 관계):** `phone` 은 **사업자 대표번호에 한정**한다.
  휴대전화 대역(`010`·`011`·`016`·`017`·`018`·`019` 로 시작)은 개인 식별 정보로 취급하여
  **저장하지 않고 빈 값으로 남긴다.** 인허가 대장의 소재지전화에는 개인사업자 휴대번호가
  섞여 들어오므로 필드명이 아니라 **값 패턴**으로 걸러야 한다(D3 FORBID-5 의 판정 방식과 동일).
  `population.csv` 는 **조사용 내부 프레임**이며 공개 페이지 재공개 대상이 아니다 —
  재공개 allow 여부는 D3 `republish_policy.md` 가 소유하고 본 태스크는 판단하지 않는다.
- **FORBID-2 와의 경계 (자기차단 방지):** `phone` 은 **프레임 속성**이지 증거 채널이 아니다.
  FORBID-2 의 K-2 금지 토큰 검사 대상은 **`protocol.md` 전문에 한정**하며,
  `frame_build.md`·`population.csv`·`ledger_schema.json` 은 검사 대상이 아니다.
- 변환·보강 구현은 `docs/discovery/D1a/frame_build.py` 안에서 수행하며 새 런타임 의존성을 추가하지 않는다.

### K-9. 알려진 프레임 한계 키 — 9종 전부 기재 필수

`beauty_waxing_no_code` · `beauty_hair_excluded` · `beauty_phone_fill_21pct` ·
`free_business_absent` · `medical_subject_proxy` · `license_bias_direction` ·
`map_enumeration_unused` · `epsg5174_offset` · `axis_n25_precision`

(각 키의 내용은 본 문서 상단 **알려진 프레임 한계** 절 1~9 항에 대응한다)

### K-10. 보강 소스 — `v1.2` 신설. **프레임 소스가 아니다**

| 항목 | 값 |
|---|---|
| 출처 | 심평원_전국 병의원 및 약국 현황 — `https://www.data.go.kr/data/15051059/fileData.do` |
| 형태 | 분기별 zip 벌크 파일. **인증키 불필요.** 공공누리 제1유형 |
| 필터 | `sidoCd = 110000` · `sgguCd ∈ {110001 강남, 110018 송파, 110021 서초}` · `clCd ∈ {31 의원, 93 한의원}` |
| 사용 필드 | `hospUrl`(홈페이지) · `trmtMonStart~`(진료시간) · `telno` · `XPos`/`YPos`(**경위도 직접. 재투영 불필요**) |
| 적용 축 | **`medical_wellness` 전용.** 다른 3축에는 이 경로가 존재하지 않는다 |

**결합 규칙 — 이 조건만 허용한다**

1. **left join 만 허용.** 보강 전후 `population.csv` 의 `venue_id` **집합이 완전히 동일**해야 한다.
   inner join·필터·정렬 등 **멤버십에 영향을 주는 결합은 금지**(FORBID-1).
2. **매칭 조건:** 정규화 상호명 **완전일치** ∧ 정규화 도로명주소(건물번호까지) **완전일치**.
   **좌표는 매칭에 사용하지 않는다** — 좌표를 매칭에 쓰면 아래 3의 교차검증이 순환논증이 된다.
3. **좌표는 검증에 쓴다.** 매칭 성립 행에서 (K-8 변환 WGS84 좌표) ↔ (심평원 `XPos`/`YPos`) 거리를
   계산해 **중앙값·95분위를 `frame_build.md` 에 기록**한다. 이것이 EPSG:5174 변환 오차의
   **유일한 독립 실측**이다.
4. 1:다 매칭이거나 어느 한 조건이라도 불성립이면 `enrich_match` 를 `ambiguous`/`no_match` 로 두고
   `homepage_url`·`open_hours` 를 **빈 값으로 남긴다.** 추정 결합 금지(FORBID-6).

### K-11. 라이선스·출처표시 — `v1.2` 신설

| 항목 | 내용 |
|---|---|
| 라이선스 | **공공누리 제1유형(출처표시)** — 상업적 이용·변형 가능 |
| 서울시 이용약관 제10조③ | *"열린데이터광장 서비스를 이용하여 검색결과를 노출할 경우, 해당 페이지에 「서울특별시 공공데이터」를 사용한 결과임을 명시해야 합니다"* |
| KOGL 출처표시 조건 | **하이퍼링크 형태**의 출처 제공 의무 |

**D1a 의 의무는 스냅샷 보존 하나다.** 소스별 이용조건 페이지를 `docs/discovery/D1a/license_snapshot/`
에 **URL · sha256 · 취득 시각과 함께** 보존한다. 이용조건은 사후 변경될 수 있으나 **변경 전 수집분은
변경 전 조건으로 계속 이용 가능**하므로, 수집 시점 조건을 증명할 수 없으면 이후 조건이 강화될 때
이미 수집한 데이터의 이용 근거를 잃는다.

**제품 화면의 출처표시 렌더링은 D1a 산출물이 아니다** — `out_of_scope` 및 상신 2 참조.

---

```yaml
# ─── 식별 ───────────────────────────────
id:            D1a-PROTOCOL
title:         조사 프로토콜 사전등록 (모집단·표집·"가격 확인됨" 정의·판정 임계)
workstream:    discovery
owner_agent:   research-discovery

# ─── 존재 이유 ──────────────────────────
traces_to:     [H1, G1, KM-price-coverage]
why:           "판정 기준을 데이터보다 먼저, 별도 PR로 main에 고정하지 않으면 G1은 '조사 결과'가 아니라 '원하는 결론에 맞춘 정의'의 함수가 되고, 그 위에 Phase 2 파이프라인 7개 태스크가 세워진다."

# ─── DAG ────────────────────────────────
depends_on:    [F1-REPO-SCAFFOLD]      # `discovery` CI job 이 없으면 block_merge 를 집행할 수단이 없다
blocks:        [D1b-FIELDWORK, F4-NEED-TAG-ONTOLOGY]
parallel_with: [D2-SEO-SERP-FEASIBILITY, D3-SOURCE-DUE-DILIGENCE, D4-MEDICAL-AD-GUARDRAIL]
gate:          null

# ─── 산출물 ─────────────────────────────
deliverable:
  pr_count:    1                        # 이 PR이 main에 머지된 뒤에만 D1b PR을 열 수 있다
  touches:
    - docs/discovery/D1a/**
    - scripts/discovery/validate_d1a.py
    - scripts/discovery/fixtures/d1a/**   # v1.1 — done_when 메타테스트 경로. 미등재 시 F1 path-guard 가 자기 PR을 차단(P7)
  artifacts:
    - "docs/discovery/D1a/protocol.md — 프레임 규칙·판정 트리·집계 규칙·임계"
    - "docs/discovery/D1a/protocol.lock — protocol.md + frame_build.md + population.csv + sample.csv + ledger_schema.json 의 sha256"
    - "docs/discovery/D1a/frame_build.md — 4축 소스·취득 경로·필터 전문·축 결정표·한계(K-9)·교차검증 로그"
    - "docs/discovery/D1a/frame_build.py — 모집단 재현 스크립트 (다운로드·빌드·좌표 변환·K-10 보강)"
    - "docs/discovery/D1a/population.csv — 모집단 (K-8 스키마, 4축)"
    - "docs/discovery/D1a/sample.csv — 확정 표본 100 (4축 × 3구 12칸) + 예비표본 20"
    - "docs/discovery/D1a/holdout.enc — 홀드아웃 25건 봉인 (키는 팀 리드 보관)"
    - "docs/discovery/D1a/holdout_manifest.json — 축별 배분·sha256·키 지문·superseded_* 필드"
    - "docs/discovery/D1a/license_snapshot/ — 소스별 이용조건 스냅샷 + URL + sha256 + 취득 시각 (K-11)"
    - "docs/discovery/D1a/ledger_schema.json — D1b가 채울 원장 스키마"
    - "docs/discovery/D1a/definition_examples/ — 판정 트리 검증용 실측 예시 20건 + 스냅샷"
    - "scripts/discovery/validate_d1a.py"
    - "위반 픽스처 12종 — scripts/discovery/fixtures/d1a/ 또는 docs/discovery/D1a/fixtures/ (검증기가 두 위치를 모두 탐색)"

# ─── 요구사항 ───────────────────────────
requirements:
  - id: REQ-1
    statement: >
      저자는 K-5 취득 경로로 K-7 의 4축 소스를 내려받아 population.csv 를 구축하고, 그 출처·경로·
      필터 전문·축 결정표·K-9 한계 9종·K-11 라이선스 스냅샷·재현 절차를 frame_build.md 에 기록한다.
      축 결정표의 4개 집합은 K-7 과 각각 집합 동등이다.
    acceptance: >
      CI job `discovery` 에서 `python scripts/discovery/validate_d1a.py --check frame` exit 0.
      검사: ① population.csv ≥ 300행 · **(축,구) 12칸** 각각 ≥ 20행 · axis enum == K-7 4축
      ② frame_source ⊆ K-5 enum · 취득 URL 호스트 ∈ {`file.localdata.go.kr`, `datafile.seoul.go.kr`} ·
      문서·코드 전문에 `www.localdata.go.kr` 토큰 0건 · slug 집합이 K-7 **5종과 집합 동등** ·
      dataset_id 집합이 **9종**{OA-16142, OA-16146, OA-16480, OA-17923, OA-17924, OA-17925,
      OA-16379, OA-16380, OA-16381}**과 집합 동등** (T-6 — 자치구 하나 누락을 총계로는 못 잡는다) ·
      다운로드 로그의 연속 요청 간격이 전부 ≥ 1초 (T-5 직렬·백오프)
      ③ filter_expressions 가 K-5 금지 속성 토큰 사전과 0건 매칭
      ④ 축 결정표의 4개 집합(진료과목 5종 · 위생업태 3종 · 안마 업태 2종 · 체력단련장업)이 K-7 과
      **각각 집합 동등** · `일반미용업`·`화장ㆍ분장업` 이 편입 집합에 부재 ·
      결정표를 population.csv 전 행에 재적용한 결과가 `axis` 컬럼과 100% 일치
      ⑤ 축별 행 수 하한: `medical_wellness` ≥ 3,000 · `beauty_care` ≥ 2,500 · `relax_recovery` ≥ 150 ·
      `exercise_body` ≥ 1,000
      ⑥ `license_status != '영업/정상'` 행 0건 (T-4)
      ⑦ frame_build.md 의 `known_gaps` 기계 판독 블록에 K-9 키 9종 전부 존재하고 각 값이 40자 이상 ·
      1순위/백업 경로 축별 행 수 대조 결과(±2%)가 기록되어 있음
      ⑧ license_snapshot/ 에 소스별 스냅샷 파일·URL·sha256·취득 시각이 존재.

  - id: REQ-2
    statement: >
      저자는 protocol.md 에 `price_found` 판정 트리를 분기 5개 이상으로 기술하되,
      허용 증거 채널을 K-1의 부분집합으로, 성립 요건을 K-3 전부로 고정한다.
    acceptance: >
      `validate_d1a.py --check definition` exit 0.
      검사: allowed_channels ⊆ K-1 · **protocol.md 전문**에 K-2 금지 채널 토큰
      (전화|통화|카톡|DM|방문문의|체험단|카페글|소셜커머스|추정) 0건 매칭 ·
      required_conditions 배열이 K-3의 3개 항목을 모두 포함.
      (K-8 단서에 따라 frame_build.md·population.csv·ledger_schema.json 은 이 검사 대상이 아니다)

  - id: REQ-3
    statement: >
      저자는 판정 트리를 **실제 관측 스냅샷** 20건(양성 10 / 음성 10)에 적용해 기대 라벨과
      100% 일치시킨다. 양성 10건은 표기 형태가 서로 다른 5종 이상(본문 텍스트·표·이미지·PDF·
      게시물 캡션)을 포함한다.
      *(원칙 2.5 짝 — 정의를 극단적으로 좁게 잡아 커버리지를 0으로 만드는 경로를 차단)*
    acceptance: >
      `validate_d1a.py --check definition-recall` exit 0.
      검사: definition_examples/ 하위 20건 각각에 snapshot 파일·취득 URL·sha256 존재 ·
      snippet 이 스냅샷 추출 텍스트의 부분문자열 · 판정 트리 적용 결과가 기대 라벨과 20/20 일치 ·
      양성 10건의 `display_form` 값 distinct ≥ 5.

  - id: REQ-4
    statement: >
      저자는 protocol.md 에 기록된 고정 시드로 **K-7 4축 모집단** population.csv 에서 확정 표본 100 +
      예비표본 20 을 추출하고, 축당 25(구 배분 9/8/8) 및 12칸 각각 ≥ 8 을 만족시킨다. 각 표본 행의
      축 배정은 축 결정표를 적용한 결과이며 D1b에서 변경 불가다.
    acceptance: >
      `validate_d1a.py --check sampling` exit 0.
      검사: status=primary 100행 · 축 카운트 = {25,25,25,25} · **12칸 각각 ≥ 8** ·
      seed 재실행 결과가 sample.csv 와 완전 일치 · venue_id 중복 0 ·
      전 행이 population 에 존재하고 `name`·`axis`·`gu` 가 population 과 동일 ·
      protocol.lock 의 population.csv sha256 == 현 population.csv sha256.

  - id: REQ-5
    statement: >
      저자는 확정 표본 100 중 층화 무작위 25건을 홀드아웃으로 지정해 **개정 전과 다른 새 키로**
      holdout.enc 에 봉인하고, 평문 venue_id 를 리포지토리 어디에도 남기지 않는다.
    acceptance: >
      `validate_d1a.py --check holdout-sealed` exit 0.
      검사: holdout.enc 존재 · 복호화 키가 리포 내 부재 · 홀드아웃 25건의 venue_id 문자열이
      추적 대상 파일 전체에서 grep 0건 · 봉인 매니페스트에 축별 배분(**7/6/6/6**)·sha256·
      `key_fingerprint` 기록 · `key_fingerprint != superseded_key_fingerprint` (개정 전 키 재사용 차단).

  - id: REQ-6
    statement: >
      저자는 population.csv 를 K-8 스키마로 산출한다 — EPSG:5174 → WGS84 변환 좌표, 사업장 대표번호,
      K-10 보강 결과. 변환 오차는 K-10 매칭 행에서 심평원 경위도와 대조해 실측한다.
    acceptance: >
      `validate_d1a.py --check population-quality` exit 0.
      검사: ① K-8 컬럼 20종 전부 존재
      ② `name`·`road_address` 에 U+FFFD(치환문자) 0건 · `name` 빈 문자열 0건 (T-2 인코딩 무결성)
      ③ 채워진 좌표가 bbox(lat 37.42–37.58 / lon 126.96–127.18) 밖인 행 0건 ·
      구별 좌표 중심점이 기준 중심에서 ≤ 1.5km · `lat`/`lon` 채움률 ∈ [0.90, 0.999]
      ④ `phone` 채움률이 `beauty_care` 축 ∈ [0.10, 0.40], 나머지 3축 ∈ [0.60, 0.95] ·
      휴대전화 대역(`^0(1[016789])`) 매칭 0건
      ⑤ K-10 보강 전후 `venue_id` 집합이 완전 동일 · `enrich_match == 'matched'` 행 수 ≥ 100 ·
      `medical_wellness` 외 축의 `homepage_url`·`open_hours` 가 전 행 빈 값 ·
      `enrich_match != 'matched'` 행의 `homepage_url` 이 전부 빈 값
      ⑥ 매칭 행의 (변환 좌표 ↔ 심평원 경위도) 거리 **중앙값 ≤ 300m 이고 95분위 ≤ 1,000m** 이며
      그 값이 frame_build.md 에 기록되어 있음.

  - id: REQ-7
    statement: >
      저자는 protocol.md 에 집계 규칙(K-6)과 판정 임계(K-4)를 전재한다 — `n` 정의, blocked·교체 상한,
      이중판정 20건의 고정 시드 선정 절차, 불일치 시 확정값 `false`, Wilson 95% 산식,
      K-4 임계 2종, `inconclusive` 강제 조건 3종.
    acceptance: >
      `validate_d1a.py --check aggregation` 과 `--check thresholds` 가 **둘 다** exit 0.
      검사: n_definition == `100 - blocked - unreplaceable` · blocked_cap == 5 · replacement_cap == 5 ·
      disagreement_resolution == `false` · double_check_seed 재실행 20건이 기재 목록과 일치 ·
      proceed_threshold == 0.40 · exclude_threshold == 0.25 · 임계 필드에 소수점 3자리 초과 값 부재 ·
      inconclusive_conditions 가 3종(n<90 · 교체>5 · drift≥15%p)을 모두 포함 ·
      **K-6 수치 8종**(primary_n 100 · axis_allocation 25×4 · min_cell 8 · cells 12 · holdout 25 ·
      holdout_allocation 7/6/6/6 · double_check_n 20 · drift 15.0)이 K-6 표와 전부 동일.

  - id: REQ-8
    statement: >
      저자는 ledger_schema.json 에 D1b가 채울 원장 컬럼을 확정한다 — 필수 컬럼 16종
      (venue_id, name, gu, axis, evidence_channel, source_url, snapshot_path, access_method,
      checked_at, price_found, price_evidence_snippet, price_structure_type, service_menu_raw,
      absence_check, evaluator, cohort) 및 각 컬럼의 타입·enum.
    acceptance: >
      `validate_d1a.py --check ledger-schema` exit 0.
      검사: 16개 컬럼 전부 정의 · `axis` enum 이 K-7 4축과 집합 동등 ·
      `service_menu_raw` 가 필수(fallback `NONE_LISTED`) ·
      `absence_check` 가 K-1 5개 채널 각각의 확인 결과를 담는 객체 타입 ·
      스키마가 JSON Schema draft 2020-12 로 검증 통과.

# ─── 조건부 금지사항 ────────────────────
forbid:
  - id: FORBID-1
    when: >
      (a) frame_build.md 의 프레임 소스가 K-5 enum 밖이거나 slug 집합이 K-7 5종과 다른 경우,
      (b) 수집 필터 표현식에 K-5 금지 속성(가격·요금·이용권·예약·결제·광고상품·상위노출·평점정렬·
      검색상위N)이 포함된 경우,
      (c) 축 결정표의 4개 집합 중 하나라도 K-7 과 집합 동등이 아닌 경우
      (원소를 빼는 것도 더하는 것도, `일반미용업` 을 편입하는 것도 위반),
      (d) population.csv 에 `license_status != '영업/정상'` 행이 1건 이상 있는 경우, 또는
      (e) K-10 보강 소스가 left join 이 아닌 방식(inner join·필터·행 제거)으로 사용되어
      보강 전후 `venue_id` 집합이 달라진 경우
    must_not: >
      그 결과물을 population.csv 로 확정하거나 protocol.lock 에 포함
    because: >
      프레임 편향은 고정 시드 무작위 추출을 완벽히 지켜도 커버리지를 20~30%p 부풀린다.
      "네이버 예약 연동 업체 목록"으로 프레임을 짜면 임계값을 단 한 글자도 건드리지 않고
      G1을 통과시킬 수 있다 — 분모를 바꾸는 것이 임계를 바꾸는 것보다 쉽고 눈에 띄지 않는다.
      (c)는 실제로 두 번 발생했다: 진료과목 2종만 잡아 회차권 가격 경쟁이 가장 격렬한 2,113곳을
      제외했고, 미용업 축이 통째로 빠져 있었다. 반대로 `일반미용업`(헤어 단독 2,312 = 미용업의 33%)을 넣으면
      축 커버리지가 헤어에 지배되어 G1 이 "미용실 가격 공개율"을 재게 된다.
      (d)는 단독으로 분모를 2배 이상 부풀린다 — 폐업이 전국 57%이고 강남 미용업은 10,082건 중
      영업중이 3,157건뿐이다. 필터 한 줄 누락으로 커버리지가 반토막 나고, 그 수치로 축이 제외된다.
      (e)는 가장 조용한 경로다. 홈페이지 URL 을 붙이려고 심평원 파일과 inner join 하면
      심평원에 없는 의원이 모집단에서 사라지고, **홈페이지를 가진 업체 쪽으로 모집단이 이동한다** —
      즉 "가격을 웹에 올릴 만한 업체"만 남아 커버리지가 구조적으로 부풀려진다.
    detect: >
      CI job `discovery` — `validate_d1a.py --check frame` 이 소스/slug enum 위반, 금지 토큰 매칭,
      4개 집합 중 하나라도 집합 동등 실패, 폐업 행 존재, 또는 보강 전후 venue_id 집합 불일치를
      검출하면 non-zero exit.
    on_violation: block_merge

  - id: FORBID-2
    when: >
      protocol.md 의 allowed_channels 가 K-1의 부분집합이 아니거나, **protocol.md 전문**에
      K-2 금지 증거(전화·DM·체험단·카페글·소셜커머스·종료 이벤트·추정치) 취득 경로가 등장하는 경우
    must_not: >
      protocol.lock 을 발행
    because: >
      정의를 처음부터 넓게 잡고 잠그면 계약을 100% 준수하면서 H1이 부풀려진다. 특히 전화 취득
      가격과 체험단 후기 금액은 크롤러가 재현할 수 없어, G1 통과 후 파이프라인 실측에서
      커버리지가 20%대로 드러나고 UVP 피봇 결정이 6개월 늦어진다.
    detect: >
      CI job `discovery` — `validate_d1a.py --check definition` 의 enum 부분집합 검사 +
      금지 토큰 사전 매칭. **검사 범위는 protocol.md 로 한정**한다 — K-8 의 `phone` 컬럼은
      프레임 속성이지 증거 채널이 아니어서, 범위를 넓히면 계약이 자기 산출물을 차단한다(P7).
    on_violation: block_merge

  - id: FORBID-3
    when: >
      protocol.md / protocol.json 의 임계·수치 필드가 K-4(0.40 / 0.25) 또는 K-6 표
      (primary_n 100 · axis_allocation 25×4 · min_cell 8 · cells 12 · holdout 25 ·
      holdout_allocation 7/6/6/6 · double_check_n 20 · drift 15.0%p · n<90)의 값과
      하나라도 다른 경우
    must_not: >
      해당 protocol.md 로 protocol.lock 을 발행
    because: >
      "사전등록이므로 자유롭게 정할 수 있다"는 해석으로 임계를 0.35로 낮춰 잠그면,
      잠금장치가 오히려 조작을 정당화한다. G1 임계는 PRD가 소유하며 조사자가 소유하지 않는다.
      v1.2 에서 축이 4개가 되며 축당 표본이 33→25 로 줄었고 Wilson 구간 반폭(±0.19)이
      임계 간격(0.15)을 넘는다. 그래서 **"정밀도가 부족하니 임계 간격을 넓히자" 또는
      "표본을 125로 늘리자"는 통계적으로 그럴듯한 논거가 양방향으로 생긴다.**
      어느 쪽이든 사전등록된 판정 규칙을 사후에 재작성하는 것이고, 표본 크기를 바꾸면
      `n<90` 판정선과 구간 폭이 함께 움직여 G1 결과가 설계 선택의 함수가 된다.
      정밀도 부족은 은폐가 아니라 K-9 `axis_n25_precision` 기재로 다룬다.
    detect: >
      CI job `discovery` — `validate_d1a.py --check thresholds` 의 값 동등성 검사
      (K-4 2종 + K-6 8종 하드코딩 비교).
    on_violation: block_merge

  - id: FORBID-4
    when: >
      (a) 홀드아웃 25건의 venue_id·상호명이 평문으로 저장되었거나 sample.csv 의 컬럼·행 순서로
      역산 가능한 경우 (예: 홀드아웃이 말미 25행에 연속 배치), 또는
      (b) 모집단 개정으로 재생성한 holdout.enc 의 `key_fingerprint` 가
      `superseded_key_fingerprint`(개정 전 봉인 키 지문)와 같은 경우
    must_not: >
      holdout.enc 및 sample.csv 를 커밋
    because: >
      홀드아웃이 사전에 식별되면 조사자가 홀드아웃만 엄격하게(또는 느슨하게) 조사해
      drift 검출 장치가 무력화되고, 조사 후반으로 갈수록 판정이 느슨해지는 편향을
      D1b 단계에서 잡아낼 수단이 사라진다. (b)는 개정 특유의 경로다 — 모집단이 2,937→약 9,131 로
      바뀌어 홀드아웃 집합이 새로 뽑혔는데 봉인 키를 재사용하면, 개정 전 봉인을 한 번이라도
      열어 본 사람(또는 유출된 이전 키)이 새 홀드아웃도 즉시 열 수 있다.
      그 순간 R-6(홀드아웃 분리)이 형식만 남고 실질이 사라진다.
    detect: >
      CI job `discovery` — `validate_d1a.py --check holdout-sealed` 가 평문 grep 매칭,
      sample.csv 내 홀드아웃 행의 연속 배치(런 길이 ≥ 5), 또는
      `key_fingerprint == superseded_key_fingerprint` 를 검출하면 non-zero exit.
    on_violation: block_merge

  - id: FORBID-5
    when: >
      definition_examples/ 의 양성 예시 중 snapshot 파일이 없거나 snippet 이 스냅샷 추출 텍스트의
      부분문자열이 아닌 항목이 존재하는 경우
    must_not: >
      REQ-3 의 정의 검증을 통과로 간주하고 protocol.lock 을 발행
    because: >
      창작한 예시로 판정 트리를 검증하면, 실제 웹에 존재하는 가격 게시 형태(표 이미지·PDF 요금표·
      인스타 카드뉴스)를 정의가 배제해도 드러나지 않는다. 그 결과 커버리지가 하향 편향되어
      실제로는 40%를 넘는 축이 `axis_excluded` 로 제외되고, '웰니스 지도'가 단일 업종 디렉터리로 축소된다.
    detect: >
      CI job `discovery` — `validate_d1a.py --check definition-recall` 의 스냅샷 존재·
      부분문자열·display_form distinct ≥ 5 검사.
    on_violation: block_merge

  - id: FORBID-6
    when: >
      population.csv 의 `lat`·`lon`·`phone`·`homepage_url`·`open_hours` 컬럼에서
      (a) 원본이 결측인 셀에 빈 문자열이 아닌 값(`0` · `0.0` · `-` · `N/A` · `없음` · `null` ·
      도로명주소 지오코딩 추정치)이 들어간 경우,
      (b) `lat`/`lon` 채움률이 0.999 초과이거나 `phone` 채움률이 축별 K-8 실측 대역
      (`beauty_care` 0.40 / 나머지 0.95)의 상한을 넘는 경우,
      (c) 단일 (lat,lon) 쌍이 전체 행의 3% 초과를 점유하는 경우, 또는
      (d) `enrich_match` 가 `matched` 가 아닌 행에 `homepage_url` 또는 `open_hours` 가
      채워져 있는 경우 (K-10 매칭 2조건 미충족 상태의 추정 결합)
    must_not: >
      그 population.csv 를 커밋하거나 protocol.lock 에 포함
    because: >
      (a)~(c)는 조용히 틀린 데이터를 만드는 경로다. 실측 채움률은 좌표 96~99% · 전화는 축별로
      21~82% 인데, 결측을 채우려 도로명주소를 지오코딩하거나 구청 대표좌표로 메우면 채움률이
      100%로 올라가고 원본 결측과 추정치가 구분 불가능해진다. 좌표와 전화는 하류가 업체 자체
      채널에 도달하는 유일한 단서라 틀린 값은 "다른 업체로 안내하는 지도"가 되고,
      EPSG:5174→WGS84 변환을 건너뛰면 전 행이 조용히 잘못된 위치에 찍힌 채 통과한다.
      (d)는 오매칭 사고다 — 인허가 대장과 심평원 파일에는 공통 키가 없어 상호명·주소로 결합해야
      하는데, 조건을 느슨하게 하면 "강남 OO의원"의 홈페이지가 동명 이업체에 붙는다.
      그 URL 은 D1b 조사자가 실제로 방문해 가격을 판정하는 대상이므로, 오매칭 1건은
      틀린 표시가 아니라 **틀린 원장 행**이 되어 G1 수치 자체를 오염시킨다.
      휴대전화 대역 저장은 별도로 법적 경로다 — 인허가 대장 소재지전화에는 개인사업자 휴대번호가
      섞여 있고 이는 사업자 대표번호가 아니라 개인 식별 정보이며, 9천 행 규모로 축적된 뒤
      D3 재공개 정책 단계에서 발견되면 삭제가 아니라 커밋 이력 재작성이 필요해진다.
    detect: >
      CI job `discovery` — `validate_d1a.py --check population-quality` 가 sentinel 값 사전 매칭,
      축별 채움률 상·하한 검사, 최빈 좌표쌍 점유율 검사, 휴대전화 대역 정규식 매칭,
      `enrich_match` 와 보강 컬럼의 정합성 검사에서 위반 시 non-zero exit.
    on_violation: block_merge

# ─── 경계 ───────────────────────────────
out_of_scope:
  - 표본 100건의 실제 조사 (D1b)
  - ledger.csv 데이터 행 작성 (D1b. 본 태스크는 스키마까지)
  - G1 판정 결과 기록 (D1b가 docs/gates/G1.md 를 생성)
  - 크롤러·파서·스키마 구현 (C1·C4·F2)
  - 니즈 태그 온톨로지 설계 (F4)
  - 소스별 robots/ToS 판정 (D3) · 의료광고 표기 규칙 (D4)
  - 강남3구 외 지역 프레임
  - "서울특별시 공공데이터" 출처표시의 **화면 렌더링** (K-11) — D1a 는 스냅샷 보존까지. 상신 2 참조
  - 왁싱 업소를 상호명 텍스트로 분류하는 작업 — K-9 `beauty_waxing_no_code` 로 한계 기재만 한다
  - 자유업(필라테스·요가) 프레임 확보 — 인허가 대장에 부재. K-9 `free_business_absent`
  - 일반미용업(헤어) 단독 업소의 편입 — K-7 §헤어 결정으로 제외 확정. 뒤집으려면 계약 개정
  - K-10 보강을 `medical_wellness` 외 축으로 확대 — 해당 경로가 존재하지 않는다
  - EPSG:5174 보정계수를 적용한 정밀 좌표 변환 — 잔차는 K-9 `epsg5174_offset` 으로 기재만 한다
  - `phone`·`lat`/`lon`·`homepage_url` 의 **재공개(public 노출) 정책 판단** — D3 republish_policy.md 소유
  - `docs/tasks/D1b.md` 의 동일 P7 결함 수정 — 상신 1. D1b 담당자가 처리
  - 좌표·전화 결측 행의 외부 지오코딩/전화번호 조회 API 보완

rollback: >
  1) `git revert -m 1 <merge_sha>` 로 docs/discovery/D1a/**, scripts/discovery/validate_d1a.py,
     scripts/discovery/fixtures/d1a/** 제거.
  2) protocol.lock 이 main 에서 사라지면 D1b는 FORBID-1(선행 lock 부재)로 자동 차단되므로
     별도 조치 없이 하류가 멈춘다.
  3) 홀드아웃 봉인 키는 팀 리드 보관이므로 리포 롤백으로 유출 위험이 발생하지 않는다.
     revert 후 재착수 시에는 **다시 새 키로 재봉인**한다 (FORBID-4(b)). revert 로 되살아난
     이전 봉인을 그대로 쓰면 그 사이 노출된 키로 홀드아웃이 열린다.
  4) 외부 발신·데이터 삭제가 없어 부수 효과 없음. 원본 인허가 파일과 심평원 zip 은 리포에
     커밋하지 않으므로 revert 로 지워지는 외부 데이터도 없다.
  5) license_snapshot/ 도 함께 사라지므로, 재착수 시 이용조건을 **다시 취득해 스냅샷을 새로 남긴다**
     (그 사이 조건이 변경되었을 수 있고, 그렇다면 변경된 조건이 적용된다).

done_when:
  - protocol.md · protocol.lock · frame_build.md · frame_build.py · population.csv · sample.csv ·
    holdout.enc · holdout_manifest.json · license_snapshot/ · ledger_schema.json ·
    definition_examples/ 가 전부 존재한다
  - `python scripts/discovery/validate_d1a.py --all` exit 0
  - **모집단 재생성**: K-7 4축을 적용해 population.csv 를 처음부터 다시 빌드했다.
    `beauty_care` 축이 신설되었고 `relax_recovery` 에 안마시술소·안마원이 편입되었으며,
    축별 하한(REQ-1 ⑤)을 전부 충족한다
    (참고 실측 ≈9,131 = 체육 1,316 / 이완 180 / 의료 3,595 / 미용 ≈4,040.
     상류가 매일 갱신되므로 하한만 강제한다)
  - **데이터셋 9종 수집 확인**: 미용업·의료유사업이 자치구별로 분리된 OA-ID(T-6)까지
    전부 수집되었고, dataset_id 집합 동등 검사가 통과한다
  - **표본 재추출**: 개정 전 sample.csv 는 무효다. 같은 고정 시드로 **개정 후 population.csv 를 입력**해
    100(축당 25 = 9/8/8) + 예비 20 을 재추출했고, `--check sampling` 의 시드 재실행 대조가 통과한다
  - **홀드아웃 재봉인**: 개정 전 holdout.enc 는 폐기하고 25건(7/6/6/6)을 다시 뽑아
    **새 패스프레이즈**로 봉인했다. `holdout_manifest.json` 에 `superseded_key_fingerprint` 와
    `superseded_population_sha256` 를 기록했고, `key_fingerprint` 가 `superseded_key_fingerprint`
    와 다르다 — 기존 키로 새 봉인을 열 수 없다
  - **protocol.lock 재발행**: 잠금 대상이 protocol.md + frame_build.md + **population.csv** +
    sample.csv + ledger_schema.json 5종이고, 각 sha256 이 현재 파일과 일치한다
    (분모인 모집단이 잠기지 않으면 사전등록은 임계만 잠그고 분모는 열어 둔 것이 된다)
  - **좌표 변환 실측 기록**: K-10 매칭 행에서 (변환 WGS84 ↔ 심평원 경위도) 거리의 중앙값·95분위가
    frame_build.md 에 숫자로 기록되어 있고 REQ-6 ⑥ 하한을 충족한다
  - **경로 교차검증 기록**: `file.localdata.go.kr` 1순위 산출과 `datafile.seoul.go.kr` 백업 산출의
    축별 행 수 차이(±2%)가 frame_build.md 에 기록되어 있다
  - **메타테스트**: 위반 픽스처 **12종**이 각각 non-zero exit 함을 확인
    (① 프레임 필터에 `예약연동=Y` ② allowed_channels 에 `phone` 추가 ③ proceed_threshold=0.35
     ④ 홀드아웃 평문 노출 ⑤ 양성 예시 스냅샷 누락 ⑥ 진료과목 집합에서 `피부과` 제거
     ⑦ `key_fingerprint == superseded_key_fingerprint` ⑧ `phone` 에 `010-` 번호 1건 주입
     ⑨ `beauty_care` 편입 집합에 `일반미용업` 추가 ⑩ `license_status='폐업'` 행 1건 주입
     ⑪ K-10 보강을 inner join 으로 수행해 venue_id 집합 축소
     ⑫ dataset_id 집합에서 `OA-17925`(송파 미용업) 제거 — **자치구 누락은 총계로는 안 잡힌다**)
    — 픽스처는 `scripts/discovery/fixtures/d1a/` 또는 `docs/discovery/D1a/fixtures/` 에 두며
    검증기가 두 위치를 모두 탐색한다. 둘 다 `touches` 안이다
  - F1의 CI job `discovery` 가 `scripts/discovery/**` 를 실행하도록 등록되어 있고,
    본 PR에서 해당 job 이 실행된 로그가 존재한다
  - 홀드아웃 **새** 복호화 키가 팀 리드에게 전달되었다 (리포에 부재). 개정 전 키는 폐기 통지되었다
  - `python3 scripts/tasks_manifest.py --check` 가 DAG 정합성 통과
```
