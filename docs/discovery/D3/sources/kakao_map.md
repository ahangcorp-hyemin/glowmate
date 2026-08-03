# kakao_map — 카카오맵 / 카카오 플레이스

| 항목 | 값 |
|---|---|
| 소스 유형 | K-3 필수 |
| verdict | **forbidden** |
| rule_id | `R-ROBOTS-DISALLOW` |
| 조사일시(UTC) | 2026-08-03 |

---

## robots

| host | 취득 URL | HTTP | 스냅샷 |
|---|---|---|---|
| `place.map.kakao.com` | https://place.map.kakao.com/robots.txt | 200 | [kakao_map.txt](../snapshots/robots/kakao_map.txt) |
| `map.kakao.com` | https://map.kakao.com/robots.txt | 200 | [kakao_map.map.kakao.com.txt](../snapshots/robots/kakao_map.map.kakao.com.txt) |

취득일시(UTC)·sha256 정본: [`snapshots/robots/index.csv`](../snapshots/robots/index.csv)

`place.map.kakao.com` 원문 전문 중 마지막 그룹:

```
User-agent: *
Disallow: /
Allow: /$
```

→ 업체 상세 경로 `https://place.map.kakao.com/<placeId>` 는 `Allow: /$` 의 `$` 앵커에
걸리지 않으므로 **Disallow 대상**이다. `map.kakao.com` 도 동일하게 `Disallow: /` + `Allow: /$` 다.

또한 두 파일 모두 상단에 GPTBot·ClaudeBot·CCBot 등 자동 수집 에이전트를 개별 차단하고 있으며,
`map.kakao.com` 은 주석으로 명시한다:
`# BOT ACCESS FOR THE PURPOSES OF AI TRAINING AND RETRIEVAL-AUGMENTED GENERATION (RAG) IS STRICTLY PROHIBITED.`

## tos

- 원문 스냅샷: [`snapshots/tos/kakao_map.terms.html`](../snapshots/tos/kakao_map.terms.html)
  (https://www.kakao.com/policy/terms?type=ts&lang=ko — 카카오 통합서비스약관, HTTP 200)
- 이 약관도 서술형이라 조 번호가 거의 없어 **조항 번호 특정 불가**다.
  verdict 는 robots 근거로 이미 `forbidden` 이므로 `tos_clause` 는 판정에 쓰이지 않는다.
- 관련 문언: "다른 이용자의 개인정보를 수집, 저장, 공개하는 행위"를 금지행위로 열거한다.

## official_api

- **카카오 로컬 API** `https://dapi.kakao.com/v2/local/search/keyword.json` — REST 키 필요.
  장소명·주소·카테고리·좌표·`place_url` 을 제공하지만 **가격·프로그램 정보는 제공하지 않는다.**
  응답의 `place_url` 은 `http://place.map.kakao.com/<id>` 로, robots Disallow 경로다.
- 결론: 공식 API 로 얻는 필드는 glowmate 의 UVP(회당 단가 비교)를 성립시키지 못한다.
  API 이용약관 검토·제휴는 `out_of_scope`.

## access_method

- 웹 스크래핑: **금지** (robots `Disallow: /`)
- 공식 API: 가격 필드 부재 → UVP 미충족
- 벌크 배포: 없음
- → **수집 경로 없음.** 어댑터 대상에서 제외한다(C3-ADAPTER-KAKAO 착수 불가).

## rate_limit

요청률 실측 미시행. verdict 가 `forbidden` 이므로 `crawl_policy.yaml`·rate probe 대상이 아니다.

## risk_note

- 네이버 다음으로 커버리지 기여가 크다. 특히 강남3구 신규 개업 업체의 초기 등록이 빠른 편이다.
- robots 가 `Disallow: /` 로 전면 차단이라 "일부 경로만 수집" 같은 절충안이 성립하지 않는다.
- 카카오 로컬 API 는 **업체 seed 목록** 확보에는 쓸 수 있으나, 가격은 결국
  `official_website` 에서 가져와야 한다. 제휴·API 계약은 본 태스크 범위 밖이므로
  [`report.md`](../report.md) 의 에스컬레이션 항목으로 넘긴다.
