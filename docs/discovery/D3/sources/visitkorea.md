# visitkorea — 한국관광공사 '대한민국 구석구석' (대안 소스)

| 항목 | 값 |
|---|---|
| 소스 유형 | 대안 소스 (K-3 필수 외) |
| verdict | **pending** |
| rule_id | `R-PENDING-NO-TOS` |
| 조사일시(UTC) | 2026-08-03 |

공공기관이 운영하고 robots 가 전면 개방된 몇 안 되는 소스여서 실사했다.
결론은 **법적으로는 유망하나 ToS 를 확보하지 못했고, 강남3구 웰니스 커버리지도 확인하지 못했다.**

---

## robots

- 스냅샷: [`snapshots/robots/visitkorea.txt`](../snapshots/robots/visitkorea.txt)
  (https://korean.visitkorea.or.kr/robots.txt, HTTP 200) · 정본 [`index.csv`](../snapshots/robots/index.csv)
- 그룹 구성: Group 1(Googlebot)·Group 2(Googlebot-mobile)에만 `/kor/`·`/cms/`·`/search/search_list.do?keyword`
  등을 Disallow 하고, **Group 3 은 `User-agent: *` → `Allow: /`** 다.
- 우리 UA 는 Group 3 에 속하므로 업체 상세(`/detail/ms_detail.do?cotid=<uuid>`)는 허용된다.
- 카테고리별 sitemap 11종을 공개한다.

## tos

- **원문 확보 실패 → 확인 불가.**
  - `https://korean.visitkorea.or.kr/kor/bz15/where/terms.do` → **HTTP 404**
    (스냅샷 [`snapshots/tos/visitkorea.terms.html`](../snapshots/tos/visitkorea.terms.html) 은
    404 응답 본문이며 약관 원문이 아니다 — index.csv 의 `http_status=404` 로 구분된다)
  - 메인 페이지 푸터의 약관 링크는 JS 렌더 이후 삽입되어 정적 응답에서 추출되지 않았다.
- 조항 번호 특정 불가 → K-1 상 `pending`.
- 참고: 구석구석 콘텐츠 상당수는 공공누리 유형 표기를 달고 있으나, **표기 확인을 스냅샷으로
  남기지 못했으므로 판정 근거로 쓰지 않는다.** 추정을 사실로 적지 않는다.

## official_api

- **TourAPI 4.0** (`https://apis.data.go.kr/B551011/KorService2/...`) — 공공데이터포털 인증키 필요.
  관광지·레포츠·쇼핑 분류로 상호·주소·좌표·홈페이지를 제공한다. **가격은 제공하지 않는다.**
- 인증키를 발급받지 않아 응답을 확인하지 못했다(확인 불가).

## access_method

- 웹 스크래핑: robots 상 허용. 상세 페이지는 SSR 이라 정적 파싱이 가능함을 조사 중 확인했다.
- 그러나 ToS 미확보(`pending`)로 착수 불가.
- 추가로, 강남3구 웰니스 항목을 열거할 서버 렌더 목록 경로를 찾지 못했다
  (검색 결과 목록이 AJAX 로 로드되며, sitemap 은 지역 정보를 담지 않는다).
  **즉 ToS 를 확보하더라도 REQ-6 의 "강남3구 업체 상세 10건"을 만족시킬 수 있을지 미검증이다.**

## rate_limit

요청률 실측 미시행 (`pending`).

## risk_note

- 관광 포털이므로 웰니스 업체 커버리지가 스파·찜질방·한방체험에 치우쳐 있고,
  3050 여성의 실사용 대상인 필라테스·요가·PT 스튜디오는 거의 등재되지 않는다.
  **법적으로 열려 있어도 제품 커버리지에는 거의 기여하지 못할 가능성이 높다.**
- 재실사 시 우선 순위는 daangn 보다 낮다.
