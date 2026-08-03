# naver_place — 네이버 플레이스 / 네이버 지도

| 항목 | 값 |
|---|---|
| 소스 유형 | K-3 필수 |
| verdict | **forbidden** |
| rule_id | `R-ROBOTS-DISALLOW` (보조: `R-ROBOTS-UNKNOWN`, `R-TOS-PROHIBIT`) |
| 조사일시(UTC) | 2026-08-03 |

---

## robots

| host | 취득 URL | 취득일시(UTC) | HTTP | sha256 | 스냅샷 |
|---|---|---|---|---|---|
| `map.naver.com` | https://map.naver.com/robots.txt | 2026-08-03T03:20:xx (index.csv 정본) | 200 | index.csv 참조 | [naver_place.map.naver.com.txt](../snapshots/robots/naver_place.map.naver.com.txt) |
| `m.place.naver.com` | https://m.place.naver.com/robots.txt | index.csv 정본 | **429** | index.csv 참조 | [naver_place.txt](../snapshots/robots/naver_place.txt) |
| `pcmap.place.naver.com` | https://pcmap.place.naver.com/robots.txt | index.csv 정본 | **429** | index.csv 참조 | [naver_place.pcmap.place.naver.com.txt](../snapshots/robots/naver_place.pcmap.place.naver.com.txt) |

정본 기록: [`snapshots/robots/index.csv`](../snapshots/robots/index.csv)

`map.naver.com` 원문 (해당 부분 발췌):

```
User-agent: *
Disallow: /
Allow: /$
Allow: /p/$
```

→ 업체 상세 경로 `https://map.naver.com/p/entry/place/<id>` 는 `Allow: /p/$` 의 `$` 앵커에
걸리지 않으므로 **Disallow 대상**이다.

`m.place.naver.com` · `pcmap.place.naver.com` 은 조사용 User-agent 로 robots.txt 자체가
**HTTP 429** 로 반환되었다(2026-08-03 02:2x 및 03:2x, 약 1시간 간격 2회 독립 시행, 본문은
robots 원문이 아니라 네이버 플레이스 HTML 오류 페이지). robots 원문을 확보하지 못했으므로
이 두 호스트는 **확인 불가**이며, 본 실사는 확인 불가를 허용으로 바꾸지 않는다
(`verdict_rule.md` §3-1, `R-ROBOTS-UNKNOWN`).

## tos

- 원문 스냅샷: [`snapshots/tos/naver_place.terms.html`](../snapshots/tos/naver_place.terms.html)
  (https://policy.naver.com/rules/service.html, HTTP 200, sha256 = `snapshots/tos/index.csv` 참조)
- 이 약관은 조(條) 번호를 쓰지 않는 서술형 형식이라 **조항 번호를 특정할 수 없다.**
  본 소스의 verdict 는 robots 근거로 이미 `forbidden` 이므로 `tos_clause` 는 판정에 쓰이지 않는다.
- 해당 문언(원문 인용):
  > 네이버의 사전 허락 없이 자동화된 수단(예: 매크로 프로그램, 로봇(봇), 스파이더, 스크래퍼 등)을
  > 이용하여 … 네이버 서비스에 게재된 회원의 아이디(ID), 게시물 등을 수집하거나 …
  > 이용자(사람)의 실제 이용을 전제로 하는 네이버 서비스의 제공 취지에 부합하지 않는 방식으로
  > 네이버 서비스를 이용하거나 …

  → 자동 수집을 사전 허락 없이 금지한다. robots 와 독립적으로도 `R-TOS-PROHIBIT` 이 성립한다.

## official_api

- **네이버 검색 API(지역)** `https://openapi.naver.com/v1/search/local.json` — 클라이언트 ID/시크릿 필요,
  1회 최대 5건·일 25,000회 제한. 업체 상세(가격·시술 메뉴)를 제공하지 않는다.
- **네이버 지도 API** 는 지도 표출용이며 업체 DB 재배포를 허용하지 않는다.
- 결론: 공식 API 로는 glowmate 가 필요로 하는 **가격·프로그램 정보를 얻을 수 없다.**
  API 제휴는 본 태스크 `out_of_scope`(소스 운영사와의 제휴 협상)이며 별도 트랙이다.

## access_method

- 웹 스크래핑: **금지** (robots Disallow + ToS 자동수집 금지)
- 공식 API: 커버리지 부족 (위 참조)
- 벌크 배포: 없음
- → **수집 경로 없음.** 어댑터 대상에서 제외한다(C2-ADAPTER-NAVER 착수 불가).

## rate_limit

요청률 실측을 시행하지 않았다. verdict 가 robots 근거로 `forbidden` 이므로
`crawl_policy.yaml` 대상이 아니며(REQ-3), rate probe 대상도 아니다(REQ-4).
robots.txt 취득 시점에 이미 429 가 반환된 사실은 사업자가 자동 접근을 억제하고 있다는
추가 신호로 `risk_note` 에 계상한다.

## risk_note

- **커버리지 영향이 가장 크다.** 강남3구 웰니스 업체의 상호·주소·영업시간·리뷰·일부 가격이
  네이버 플레이스에 집중되어 있어, 이 소스를 잃으면 H1(가격 노출 40%) 검증 모집단 자체가 흔들린다.
  손실 규모는 [`report.md`](../report.md) 에 계상한다.
- 우회 시도(User-agent 위장, 프록시 로테이션)는 robots·ToS 양쪽을 동시에 위반하며,
  서비스 공개 후 차단·통지 시 C1~C7 파이프라인과 이미 수집한 원문까지 폐기 대상이 된다.
  **기술적으로 가능한 것과 해도 되는 것은 다르다.**
- 조사 과정에서 429 를 받은 것은 읽기 전용 robots.txt 요청 1~2건 때문이다.
  계정·IP 차단 이력은 관측되지 않았으나, 차단 이력이 발생하면 계약 `rollback` §3 에 따라
  report.md 가 아니라 팀 리드에게 직접 보고한다.
