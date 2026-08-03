# taling — 탈잉 (클래스 중개 플랫폼, 대안 소스)

| 항목 | 값 |
|---|---|
| 소스 유형 | 대안 소스 (K-3 필수 외) |
| verdict | **forbidden** |
| rule_id | `R-TOS-PROHIBIT` |
| 조사일시(UTC) | 2026-08-03 |

강남3구 요가·필라테스·PT 클래스가 다수 등록되어 있고 **수강료가 공개**되어 있어
가격 소스 후보로 실사했다.

---

## robots

- 스냅샷: [`snapshots/robots/taling.txt`](../snapshots/robots/taling.txt) ·
  [`taling.www.taling.me.txt`](../snapshots/robots/taling.www.taling.me.txt)
  (https://taling.me/robots.txt, https://www.taling.me/robots.txt, 둘 다 HTTP 200, 동일 내용)
- `User-agent: *` 그룹은 `/auth/`·`/my-account/`·`/my-class/`·`/order-result/`·`/vod/play/` 등
  로그인·주문 경로만 Disallow 한다. **클래스 상세 경로는 robots 상 허용**이며 sitemap.xml 도 공개한다.
- 즉 robots 만으로는 통과한다.

## tos

- 원문 스냅샷: [`snapshots/tos/taling.terms.html`](../snapshots/tos/taling.terms.html)
  (https://talingrules.oopy.io/01248985-cd6f-4efa-89a3-a27298b810a6 — 탈잉 이용약관, HTTP 200.
  `www.taling.me` 푸터의 "이용약관" 링크가 이 문서를 가리킨다.)
- **tos_clause: `제8조` (중개서비스의 활용 방식과 제한 정책)**. 원문 인용:
  > ⑤ 탈잉 사이트, 모바일 탈잉 정보, 데이터를 정당한 권한 없이 스스로 또는 제3자를 통하여
  > 복사, 퍼가기, **스크래핑** 하거나 기타의 방법으로 상업적으로 이용한 경우

  가격 비교 서비스는 명백한 상업적 이용이며, 스크래핑을 조문으로 직접 금지한다.
  → `R-TOS-PROHIBIT`, verdict `forbidden`.

## official_api

없다. 공개된 제3자 API 를 제공하지 않는다.

## access_method

- 웹 스크래핑: robots 허용이나 **ToS 제8조 ⑤ 금지** → 채택 불가
- → 어댑터 대상에서 제외한다.

## rate_limit

요청률 실측 미시행 (verdict `forbidden`). google_maps 와 같은 이유로,
ToS 가 금지한 행위를 실사 단계에서 실행하지 않았다.

## risk_note

- 이 소스는 **robots 만 검사하는 파이프라인이 두 번째로 놓치는 지점**이다.
  국내 중개 플랫폼은 robots 를 열어 두고 약관으로 스크래핑을 금지하는 패턴이 일반적이다
  (`report.md` §3 의 패턴 정리 참조).
- 탈잉의 클래스 상세에는 **튜터 실명·프로필 사진**이 포함된다. 설령 수집이 허용되더라도
  K-5 상 재공개 불가 필드가 다수여서 제품 가치 대비 리스크가 높다.
