# daangn — 당근 동네업체 프로필 (대안 소스)

| 항목 | 값 |
|---|---|
| 소스 유형 | 대안 소스 (K-3 필수 외) |
| verdict | **pending** |
| rule_id | `R-PENDING-NO-TOS` |
| 조사일시(UTC) | 2026-08-03 |

> **`pending` 은 "조건부 허용"이 아니라 "판정 불가"다.** C1 allowlist 에 전사되지 않는다.
> ToS 원문을 확보하면 재판정한다.

---

## robots

- 스냅샷: [`snapshots/robots/daangn.txt`](../snapshots/robots/daangn.txt)
  (https://www.daangn.com/robots.txt, HTTP 200) · 정본 [`index.csv`](../snapshots/robots/index.csv)
- 첫 그룹은 AI 학습·수집 봇 40여 종에 `Disallow: /kr/` 를 건다(우리 UA 는 이 목록에 없다).
- `User-agent: *` 그룹:

```
Disallow: /ad/
Disallow: /admin
Disallow: /wv/
Disallow: /kr/buy-sell/s/*
Disallow: /kr/realty/s/*
Disallow: /kr/cars/s/*
Disallow: /kr/jobs/s/*
Disallow: /kr/local-profile/s/*
Disallow: /kr/community/s/*
Disallow: /kr/group/s/*
Allow: /wv/faqs
...
Sitemap: https://www.daangn.com/kr/sitemap-index.xml
```

→ **검색 경로(`/kr/local-profile/s/*`)만 차단되고 업체 프로필 상세(`/kr/local-profile/<slug>`)는 허용**된다.
robots 만으로는 통과한다.

## tos

- **원문 확보 실패 → 확인 불가.**
- 시도한 URL 과 결과:
  - `https://policy.daangn.com/terms.html` → HTTP 200, 235,842 B. 스냅샷은 남겼으나
    ([`snapshots/tos/daangn.terms.html`](../snapshots/tos/daangn.terms.html))
    **본문이 클라이언트 렌더**라 약관 텍스트가 응답에 없다.
    문서 전체에서 `약관` 1회(=`<title>`), `제1조`·`자동화`·`크롤`·`수집` 0회.
  - `https://www.daangn.com/policy/terms` → 같은 Gatsby 셸(동일 바이트 수)
  - `https://policy.daangn.com/page-data/terms/page-data.json` → 22 B 고정 응답(`Fixed response content`)
  - `https://terms-proxy.kr.karrotwebview.com/page-data/terms/page-data.json` → HTTP 403 (S3 AccessDenied)
  - `https://policy.daangn.com/ko/terms-of-service.html`, `/kr/terms.html`, `/terms-of-service.html`
    → 모두 22 B 고정 응답
- 따라서 **조항 번호를 특정할 수 없다.** K-1 상 `pending` 이다.
- 재시도 방법: 헤드리스 브라우저로 `policy.daangn.com/terms.html` 을 렌더해 본문을 확보한다.
  본 실사에서는 시행하지 않았다(약관 확보를 위해 렌더링 크롤러를 붙이는 것은 별도 판단이 필요).

## official_api

없다.

## access_method

- 웹 스크래핑: robots 는 허용하나 **ToS 미확인** → `pending` 이므로 착수 불가
- → 어댑터 대상에서 제외한다. ToS 확보 시 `conditional` 후보로 재평가할 가치가 가장 높은 소스다.

## rate_limit

요청률 실측 미시행. `pending` 은 `crawl_policy.yaml` 대상이 아니다(REQ-3 은
`verdict ∈ {allowed, conditional}` 에만 적용).

## risk_note

- **강남3구 웰니스 소상공인 커버리지가 넓다.** 필라테스·요가·마사지·헤어가 동네업체 프로필로
  등록되어 있고 가격·이벤트가 자주 노출된다. 네이버·카카오가 막힌 상황에서 가장 유력한 대안이다.
- 그럼에도 ToS 확인 없이 `conditional` 을 부여하면, C1 이 allowlist 에 전사한 뒤
  나중에 금지 판정이 나오는 순간 어댑터 코드·수집 원문·엔티티 해소 결과가 연쇄 폐기된다.
  **"추가 확인 필요"를 `conditional` 로 찍지 않는 것이 FORBID-2 의 취지다.**
- 후속 조치: `report.md` §6 에 재실사 항목으로 등재했다.
