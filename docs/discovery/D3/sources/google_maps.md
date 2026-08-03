# google_maps — Google 지도 (대안 소스)

| 항목 | 값 |
|---|---|
| 소스 유형 | 대안 소스 (K-3 필수 외) |
| verdict | **forbidden** |
| rule_id | `R-TOS-PROHIBIT` |
| 조사일시(UTC) | 2026-08-03 |

> **이 소스가 "기술적으로 가능 ≠ 해도 된다"의 교과서 사례다.**
> robots.txt 는 업체 상세 경로를 명시적으로 **허용**하지만, ToS 가 우리가 하려는 일을
> 조항으로 콕 집어 금지한다.

---

## robots

- 스냅샷: [`snapshots/robots/google_maps.txt`](../snapshots/robots/google_maps.txt)
  (https://www.google.com/robots.txt, HTTP 200) · 취득일시·sha256 은
  [`index.csv`](../snapshots/robots/index.csv) 정본.
- `User-agent: *` 그룹 발췌:

```
Disallow: /maps/
Allow: /maps/$
Allow: /maps/place/
Allow: /maps/search/
```

→ 업체 상세 경로 `https://www.google.com/maps/place/<name>/...` 는 **Allow** 다.
robots 만 보면 수집이 가능하다.

## tos

- 원문 스냅샷 (국문): [`snapshots/tos/google_maps.additional-terms.html`](../snapshots/tos/google_maps.additional-terms.html)
  (https://www.google.com/help/terms_maps/, HTTP 200)
- 원문 스냅샷 (영문, 조항 번호 확인용): [`snapshots/tos/google_maps.additional-terms-en.html`](../snapshots/tos/google_maps.additional-terms-en.html)
  (https://www.google.com/help/terms_maps/?hl=en, HTTP 200)
- 일반 서비스 약관: [`snapshots/tos/google_maps.tos.html`](../snapshots/tos/google_maps.tos.html)
- **tos_clause: `Section 2` (Prohibited Conduct / 금지된 행위)**. 국문판은 "이 2항" 으로 표기한다.
  원문 인용:
  > 금지된 행위. Google 지도를 사용할 라이선스를 받으려면 이 2항을 반드시 준수해야 합니다.
  > … Google 지도의 일부를 재배포 또는 판매하거나 Google 지도를 기반으로 새 제품이나 서비스를 개발
  > … 콘텐츠를 대량으로 다운로드하거나 콘텐츠의 일괄 피드를 생성(타인이 이러한 행위를 하도록 허용하는 경우 포함)
  > … Google 지도를 대체할 수 있거나 Google 지도와 상당히 유사한 서비스에 사용할 의도로 Google 지도를
  > 이용하여 다른 매핑 관련 데이터 세트(… **비즈니스 등록정보 데이터베이스** …)를 생성하거나 확장

  glowmate 가 하려는 일은 "강남3구 웰니스 **비즈니스 등록정보 데이터베이스**를 생성·확장"이며,
  이는 인용된 금지행위에 정면으로 해당한다. → `R-TOS-PROHIBIT`, verdict `forbidden`.

## official_api

- **Google Places API** 는 사용 가능하지만 유료이며, Places 데이터의 **영구 저장·재배포를 금지**한다
  (캐싱 30일 제한, `place_id` 외 필드 저장 불가). 가격 비교 서비스의 정적 생성(H3/W1)과
  근본적으로 충돌한다.
- 비용도 강남3구 수천 업체 × 갱신 주기를 감당하기 어렵다.
- 결론: API 경로도 제품 요구와 맞지 않는다. 유료 계약·제휴는 `out_of_scope`.

## access_method

- 웹 스크래핑: robots 상 허용이나 **ToS 금지** → 채택 불가
- 공식 API: 저장·재배포 제한 → 채택 불가
- → 어댑터 대상에서 제외한다.

## rate_limit

요청률 실측 미시행. verdict 가 `forbidden` 이므로 `crawl_policy.yaml`·rate probe 대상이 아니다.
robots 허용만 보고 probe 를 돌리면 ToS 위반 행위를 실사 단계에서 실행하는 셈이 되므로
**의도적으로 시행하지 않았다.**

## risk_note

- robots 만 보고 판정하는 파이프라인은 이 소스를 통과시킨다. `--check verdicts` 가
  ToS 스냅샷·조항 번호를 요구하는 이유가 여기에 있다.
- 강남3구 웰니스 업체 커버리지는 네이버·카카오보다 얕지만 리뷰/영업시간 품질은 높다.
  잃는 것이 있으나, 위반 시 Google 계정·API 키 정지 + 서비스 중단 리스크가 훨씬 크다.
