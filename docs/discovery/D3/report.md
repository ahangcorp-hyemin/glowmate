# D3 — 크롤링 소스 법적·기술적 실사 보고서

> 계약: [D3-SOURCE-DUE-DILIGENCE](../../tasks/D3.md) · 게이트 판정 정본: [`docs/gates/G3.md`](../../gates/G3.md)
> 조사일시(UTC): 2026-08-03 · 조사자: research-discovery
> **내부 조사 문서이며 법률 자문이 아니다.**

---

## 1. 한 줄 결론

**`data_acquisition_blocked`** — 어댑터 대상으로 확정된 소스는 `official_website` **1개**로,
K-6 하한(2개)에 미달한다. 네이버·카카오·구글·인스타그램·탈잉은 robots 또는 ToS 로 금지되고,
당근·구석구석은 ToS 원문을 확보하지 못해 `pending` 이다.
**C2-ADAPTER-NAVER · C3-ADAPTER-KAKAO 는 현 판정으로는 착수 불가**이며, 팀 리드 에스컬레이션이 필요하다.

---

## 2. 소스별 판정 (정본: [`verdicts.csv`](./verdicts.csv))

| source | verdict | rule_id | 근거 요약 | 실사표 |
|---|---|---|---|---|
| `naver_place` | **forbidden** | `R-ROBOTS-DISALLOW` | `map.naver.com` robots 가 `User-agent: *` 에 `Disallow: /`. `m.place`·`pcmap` 은 robots.txt 자체가 HTTP 429 (확인 불가). ToS 도 자동수집 금지 | [naver_place.md](./sources/naver_place.md) |
| `kakao_map` | **forbidden** | `R-ROBOTS-DISALLOW` | `place.map.kakao.com`·`map.kakao.com` 모두 `Disallow: /` + `Allow: /$` | [kakao_map.md](./sources/kakao_map.md) |
| `official_website` | **conditional** | `R-COND-ATTRIB` | 도메인별 robots·ToS 매트릭스 통과 도메인만 수집 + 사실정보 재공개 + 출처 표시 | [official_website.md](./sources/official_website.md) |
| `google_maps` | **forbidden** | `R-TOS-PROHIBIT` | robots 는 `/maps/place/` 허용. 그러나 Google 지도 추가 약관 **Section 2** 가 비즈니스 등록정보 DB 생성·대량 다운로드를 금지 | [google_maps.md](./sources/google_maps.md) |
| `instagram` | **forbidden** | `R-TOS-PROHIBIT` | robots.txt 상단이 서면 허가 없는 자동 수집을 금지한다고 명시 | [instagram.md](./sources/instagram.md) |
| `taling` | **forbidden** | `R-TOS-PROHIBIT` | robots 는 허용. 이용약관 **제8조** ⑤ 가 스크래핑의 상업적 이용을 금지 | [taling.md](./sources/taling.md) |
| `daangn` | **pending** | `R-PENDING-NO-TOS` | robots 는 `/kr/local-profile/` 상세 허용. 약관 본문이 클라이언트 렌더라 원문·조항 확보 실패 | [daangn.md](./sources/daangn.md) |
| `visitkorea` | **pending** | `R-PENDING-NO-TOS` | robots `User-agent: * → Allow: /`. 약관 URL HTTP 404 로 원문 확보 실패 | [visitkorea.md](./sources/visitkorea.md) |

### 제외 소스 목록 (어댑터 대상 아님)

- `forbidden` 5건: `naver_place`, `kakao_map`, `google_maps`, `instagram`, `taling`
- `pending` 2건: `daangn`, `visitkorea`

---

## 3. 이번 실사에서 드러난 패턴 — robots 만 보면 절반을 놓친다

| 유형 | 예 | 시사점 |
|---|---|---|
| robots 도 ToS 도 금지 | `naver_place`, `kakao_map`, `instagram` | 논쟁 여지 없음 |
| **robots 는 허용, ToS 가 금지** | `google_maps`(Section 2), `taling`(제8조) | robots 만 검사하는 파이프라인은 이 소스를 통과시킨다. `--check verdicts` 가 ToS 스냅샷·조항 번호를 강제하는 이유 |
| **검색엔진 봇에만 허용** | `official_website` 의 `www.manicure2004.com` (`User-agent: *` → `Disallow: /`, Yeti·Googlebot 만 `Allow: /`) | "다른 봇이 크롤하니 우리도 된다"는 논거는 성립하지 않는다 |
| robots.txt 자체가 취득 불가 | `m.place.naver.com`·`pcmap.place.naver.com` (HTTP 429, 약 1시간 간격 2회 독립 시행) | 확인 불가를 허용으로 바꾸지 않는다 (`R-ROBOTS-UNKNOWN`) |
| ToS 가 클라이언트 렌더 | `daangn` | 정적 요청만으로는 준수 근거를 만들 수 없다 → `pending` |

예비 스크리닝만 하고 실사표를 만들지 않은 호스트의 robots 스냅샷도
[`snapshots/robots/index.csv`](./snapshots/robots/index.csv) 에 함께 보존했다
(`booking.naver.com` = `Disallow : /`, `www.data.go.kr`, `www.gangnam.go.kr`, `www.visitseoul.net`).
`www.localdata.go.kr`(지방행정 인허가 데이터)은 **TCP 연결 자체가 45초 타임아웃**되어
robots·ToS 어느 것도 확인하지 못했다 — 스냅샷이 없으므로 판정하지 않았다.

---

## 4. 커버리지 손실 계상

### 4.1 산출 근거

- 모집단 표본: OpenStreetMap Overpass 질의로 얻은 강남3구(대략 bbox 37.4600,126.9950 ~ 37.5560,127.1600)
  웰니스 POI. 카테고리 `leisure=fitness_centre|sports_centre|sauna`, `amenity=spa|public_bath`,
  `shop=massage|beauty|hairdresser|herbalist`, `sport=yoga|pilates|fitness|swimming|dance`,
  `healthcare=physiotherapist|alternative`.
- 결과: `leisure` 계열 231건 중 `website`(또는 `contact:website`) 태그 보유 **16건**,
  `shop` 계열 10,870건 중 **12건**. 그중 자체 도메인이 아닌 것(네이버 블로그·인스타그램 링크)과
  웰니스로 분류할 수 없는 것(출장안마 계열 `.site` 도메인)을 제외하면 한 자릿수만 남는다.
- 실증으로 확정한 allowlist 도메인은 5개, 도달 실증 업체 상세 페이지는 12건이다
  ([`reachability/official_website.csv`](./reachability/official_website.csv)).

### 4.2 손실 구간

| 항목 | 값 | 산출 근거 |
|---|---|---|
| `naver_place` 제외로 인한 업체 커버리지 손실 | **60~85%** | 국내 로컬 업체 정보가 네이버 플레이스에 집중되며, 위 OSM 표본에서 자체 홈페이지 보유율이 한 자릿수 %로 관측된 것과 정합. [`sources/naver_place.md`](./sources/naver_place.md) |
| `kakao_map` 추가 제외로 인한 한계 손실 | **5~15%** | 네이버 미등록·카카오 등록 업체 비중. [`sources/kakao_map.md`](./sources/kakao_map.md) |
| `google_maps`·`instagram`·`taling` 제외로 인한 한계 손실 | **3~10%** | 위 세 소스에만 존재하는 업체 비중. [`sources/google_maps.md`](./sources/google_maps.md) |
| `daangn`·`visitkorea` (`pending`) 미확보로 인한 유보 손실 | **10~30%** | 당근 동네업체 프로필의 소상공인 커버리지. ToS 확보 시 회수 가능. [`sources/daangn.md`](./sources/daangn.md) |
| **잔존 커버리지 (`official_website` 단독)** | **5~20%** | 위 4.1 의 자체 홈페이지 보유율 관측치 |

> 이 구간은 **표본 기반 추정**이며 전수 조사가 아니다. 정확도를 높이려면 D1b 의 현장 표본
> 100건에서 "자체 홈페이지 보유 여부"를 함께 계측해야 한다 — 후속 조치 §6 에 등재했다.

### 4.3 H1 에 대한 영향

PRD H1 은 "강남3구 웰니스 업체의 40% 이상이 공개 채널에 가격을 노출한다"이다.
`official_website` 단독 모집단에서는 **분모가 이미 5~20% 로 축소**되므로, H1 을 그대로 측정하면
"공개 채널"의 정의가 사실상 "자체 홈페이지"로 바뀐다. **분모를 바꾸는 것이 임계를 바꾸는 것보다
쉽다** — D1a·D1b 는 이 사실을 알고 표집 절차를 확정해야 한다.

---

## 5. 계약과의 간극 (판단이 필요했던 지점)

1. **`official_website` 는 단일 호스트가 아니라 도메인 집합이다.** K-1 은 소스 단위로
   ToS 스냅샷 1건 + 조항 번호 1건을 요구하지만, 이 소스는 도메인마다 약관이 다르고
   **아예 약관 문서가 없는 도메인도 있다**(`www.fitnessm1.com`).
   본 실사는 `verdicts.csv` 의 `tos_ref` 를 allowlist 도메인 중 실제 확보한 약관 파일 하나
   (`spoany.co.kr`)로 두고, 나머지는 [`sources/official_website.md`](./sources/official_website.md)
   의 도메인 매트릭스와 [`snapshots/tos/index.csv`](./snapshots/tos/index.csv) 로 추적했다.
   "약관 부존재를 확인함"은 "확인하지 않음"과 다르므로 `pending` 으로 되돌리지 않았다.
   → 계약이 클래스 소스에 대한 `tos_ref` 규정을 명시하면 이 판단이 불필요해진다.
2. **`data_acquisition_blocked` 경로를 밟는다.** 어댑터 대상 1개는 K-6 하한 미달이며,
   계약 REQ-6 이 규정한 대로 이 판정과 대안 소스 실사 결과를 §7 에 첨부했다.
3. **위반 픽스처 위치.** 계약 `done_when` 은 `scripts/discovery/fixtures/d3/` 를 지정하지만
   `deliverable.touches` 에는 `scripts/discovery/validate_d3.py` 만 있다.
   `touches` 밖을 수정하지 않기 위해 픽스처를 `docs/discovery/D3/fixtures/` 에 두었다.
   계약의 `touches` 에 `scripts/discovery/fixtures/d3/**` 를 추가하는 정정이 필요하다.

---

## 6. 후속 조치 (재실사·에스컬레이션)

| # | 항목 | 담당 | 근거 |
|---|---|---|---|
| E-1 | **팀 리드 에스컬레이션** — 어댑터 대상 1개(K-6 미달). 제휴·API 계약 없이는 강남3구 커버리지를 확보할 수 없다 | 팀 리드 | K-6 |
| E-2 | `daangn` 재실사 — 헤드리스 렌더로 이용약관 본문 확보 후 재판정. **가장 회수 가치가 큰 소스** | research-discovery | [sources/daangn.md](./sources/daangn.md) |
| E-3 | `naver_place`·`kakao_map` 공식 API 제휴 검토 (본 태스크 `out_of_scope`) | 팀 리드 | [sources/kakao_map.md](./sources/kakao_map.md) |
| E-4 | `www.localdata.go.kr` 재시도 — 다른 네트워크 경로에서 robots·ToS 확인 | research-discovery | §3 |
| E-5 | D1b 현장 표본에 "자체 홈페이지 보유 여부" 계측 항목 추가 → §4 추정치를 실측으로 대체 | D1b | §4.2 |
| E-6 | `visitkorea` 약관 URL 재탐색 + 강남3구 웰니스 항목 열거 경로 확인 | research-discovery | [sources/visitkorea.md](./sources/visitkorea.md) |

---

## 7. 대안 소스 실사

어댑터 대상이 K-6 하한 미만이므로, K-3 필수 3종 외에 **5건**의 대안 소스를 실사했다.
(계약 요구: 3건 이상)

| 대안 소스 | verdict | 실사표 | 왜 대안이 되지 못했는가 |
|---|---|---|---|
| `google_maps` | forbidden | [sources/google_maps.md](./sources/google_maps.md) | ToS Section 2 가 비즈니스 등록정보 DB 생성을 금지 |
| `instagram` | forbidden | [sources/instagram.md](./sources/instagram.md) | robots.txt 고지 + 자동수집 약관 |
| `taling` | forbidden | [sources/taling.md](./sources/taling.md) | 이용약관 제8조 ⑤ 스크래핑 금지 |
| `daangn` | pending | [sources/daangn.md](./sources/daangn.md) | 약관 원문 확보 실패 (재실사 1순위) |
| `visitkorea` | pending | [sources/visitkorea.md](./sources/visitkorea.md) | 약관 URL 404 + 강남3구 웰니스 열거 경로 미확인 |

---

## 8. 실측 요약 (REQ-4 / REQ-6)

| 항목 | 값 |
|---|---|
| rate probe 대상 | `official_website` |
| 요청 수 | 20 (정책 `max_requests_per_min: 6`, 실제 간격 12.0초) |
| 60초 슬라이딩 윈도우 최대 요청 수 | 5 (≤ 6) |
| 429 / 403 | **0건** |
| HAR 물증 | [`probe/official_website.har`](./probe/official_website.har) |
| 자기신고 로그 | [`rate_probe_log.csv`](./rate_probe_log.csv) |
| 도달 실증 업체 상세 페이지 | 12건 (강남구 6 · 서초구 3 · 송파구 3) |
| 도달 실증 정본 | [`reachability/official_website.csv`](./reachability/official_website.csv) |

응답 스냅샷은 `docs/discovery/D3/reachability/snapshots/` 에 sha256 과 함께 보존했다.

---

## 9. 조사 도구 고지

- robots·ToS·probe 요청의 조사용 User-agent:
  `glowmate-research/0.1 (+https://github.com/ahangcorp-hyemin/glowmate; contact minseo.im@wrtn.io)`
- rate probe 는 `crawl_policy.yaml` 의 `user_agent` 값
  (`glowmate-crawler/0.1 …`)으로 시행했다.
- 후보 업체 발견에는 OpenStreetMap Overpass API 미러(`overpass.private.coffee`, robots.txt 부재)를
  3회 질의했다. **이 엔드포인트는 조사 도구이며 제품 크롤 대상이 아니므로
  `crawl_policy.yaml` 의 `allowed_path_globs` 에 포함하지 않았다.**
  `overpass-api.de` 는 `/api/` 를 robots 로 Disallow 하므로 사용하지 않았다.
- 모든 요청은 읽기 전용 GET(Overpass 는 POST 질의)이며 외부 상태를 변경하지 않았다.
- **차단 이력 없음** — 조사 전 구간에서 403·429 는 `m.place.naver.com`·`pcmap.place.naver.com`
  의 robots.txt 응답 2회뿐이며, 이는 최초 요청부터 발생했다(우리 요청량에 의한 차단이 아니다).
