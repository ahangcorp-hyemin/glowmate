# official_website — 업체 공식 홈페이지 (도메인 집합)

| 항목 | 값 |
|---|---|
| 소스 유형 | K-3 필수 |
| verdict | **conditional** |
| rule_id | `R-COND-ATTRIB` |
| 조사일시(UTC) | 2026-08-03 |

이 소스는 단일 호스트가 아니라 **업체 도메인의 집합**이다. `verdict_rule.md` §4 에 따라
robots·ToS 판정을 도메인 단위로 수행하고, 매트릭스를 통과한 도메인만 수집한다.

---

## robots

도메인별 `User-agent: *` 그룹 기준 판정. 원문·sha256·취득일시는
[`snapshots/robots/index.csv`](../snapshots/robots/index.csv) 가 정본이다.

| 도메인 | HTTP | `*` 그룹 판정 | allowlist |
|---|---|---|---|
| `www.spoany.co.kr` | 200 | `Allow: /` + `/admode/`·`/include/`·`/api.php` 만 Disallow → 업체 상세 허용 | ✅ |
| `www.fitnessm1.com` | 200 | `Allow: /` + `*?lightbox=` 만 Disallow → 지점 페이지 허용 | ✅ |
| `soonsoobeauty.com` | 200 | 관리·회원·게시판 편집 경로만 Disallow → 루트 허용 | ✅ |
| `www.chaum.net` | 200 | `/App_Code/`·`/common/`·`/member/`·`/mypage/` 등 Disallow, 루트 허용 | ✅ (루트·`/intro/` 만) |
| `www.curveskorea.co.kr` | 200 | `/admtools/`·`/intranet/`·`/images/` 등만 Disallow | ✅ |
| `www.manicure2004.com` | 200 | **`User-agent: *` → `Disallow: /`** (Yeti·Googlebot 에만 `Allow: /`) | ❌ **제외** |
| `www.donutsanma.co.kr` | 200 | `Allow: /` (가입·로그인·장바구니만 Disallow) | ❌ 제외(사유는 risk_note) |
| `www.hitspa.net` | 404 | robots 부재 → 제한 없음 | ❌ 제외(사유는 risk_note) |

> `manicure2004.com` 은 **검색엔진 봇에만** 열려 있고 우리에게는 닫혀 있다.
> "다른 봇이 크롤하고 있으니 우리도 된다"는 논거는 성립하지 않는다.
> 이 도메인을 allowlist 에 넣으면 `--check robots-conflict` 가 FORBID-1 로 차단한다.

`www.chaum.net` 의 `/member/` 는 Disallow 이며, 이 실사에서 이용약관 원문을 얻기 위해
`/member/termsOfUse.cha` 를 **1회** 조회했다. 이는 준수 근거를 확보하기 위한 사람 주도의
일회성 열람이며, `crawl_policy.yaml` 의 `allowed_path_globs` 에는 포함하지 않았다.
rate probe·reachability 어느 쪽에도 이 URL 은 쓰이지 않는다.

## tos

| 도메인 | 이용약관 URL | HTTP | 조항 확인 | 스냅샷 |
|---|---|---|---|---|
| `www.spoany.co.kr` | `/_location_terms.php` | 200 | 제2조~제12조 (위치기반서비스 이용약관) | [official_website.spoany.co.kr.html](../snapshots/tos/official_website.spoany.co.kr.html) |
| `soonsoobeauty.com` | `/member/agreement.html` | 200 | 제1조(목적)~ | [official_website.soonsoobeauty.com.html](../snapshots/tos/official_website.soonsoobeauty.com.html) |
| `www.curveskorea.co.kr` | `/rules/service.html` | 200 | 제1조(목적)~제8조(회원에 대한 통지)~ | [official_website.curveskorea.co.kr.html](../snapshots/tos/official_website.curveskorea.co.kr.html) |
| `www.chaum.net` | `/member/termsOfUse.cha` | 200 | 제1조 목적 ~ 제8조 서비스 이용시간 등 | [official_website.chaum.net.html](../snapshots/tos/official_website.chaum.net.html) |
| `www.manicure2004.com` | `/bbs/content.php?co_id=provision` | 200 | 제1조(목적)~ (단 robots 로 이미 제외) | [official_website.manicure2004.com.html](../snapshots/tos/official_website.manicure2004.com.html) |
| `www.pilatesone.co.kr` | `/?mode=policy` | 200 | **조항 특정 실패**(약관 본문이 클라이언트 렌더). 소재지 마포구로 강남3구 밖 → allowlist 제외 | [official_website.pilatesone.co.kr.html](../snapshots/tos/official_website.pilatesone.co.kr.html) |
| `www.fitnessm1.com` | — | — | **이용약관 문서 부존재 확인**(푸터·사이트맵·`/terms-and-conditions` 404) | — |

확인한 5개 도메인의 약관은 모두 전자상거래 표준약관 계열로, **자동 수집·스크래핑을 금지하는
조항은 없다.** 대신 공통적으로 회사 저작물의 무단 복제·배포·영리 이용을 제한하는 조항을 둔다.
이것이 `conditional` 로 판정한 이유이며, 부과 조건은 [`republish_policy.md`](../republish_policy.md)
가 규정하는 **사실 정보만 재공개 + 출처 표시 + 원문 링크**다.

`www.fitnessm1.com` 처럼 약관 문서 자체가 없는 도메인은 계약상 제한이 없는 상태이므로
robots 준수 + 저작권법상 인용 범위 준수만 적용한다. 이 상태는 "확인이 덜 끝난 것"이 아니라
**부존재를 확인한 것**이며, 소스 단위 verdict 를 `pending` 으로 되돌리지 않는다.
(계약 모델과의 간극은 `report.md` §5 에 기록했다.)

## official_api

없다. 업체 공식 홈페이지는 API 를 제공하지 않는다.
일부 도메인(`www.spoany.co.kr`)은 `/sitemap.xml` 을 제공하며, 이는 크롤 진입점으로 활용한다.
`sitemap.xml` 은 robots.txt 가 스스로 광고하는 경로이므로 접근에 문제가 없다.

## access_method

- **HTTP GET + 서버 렌더 HTML 파싱.** 대상 페이지는 전부 SSR 이며 JS 실행 없이 상호명·주소가
  추출된다(실증: [`reachability/official_website.csv`](../reachability/official_website.csv)).
- 진입점: `sitemap.xml` → 지점 목록 페이지 → 지점 상세 페이지.
  `www.spoany.co.kr` 는 `branch.php` 목록에 `data-branchidx` 로 지점 ID 가 들어 있어
  `branch_view.php?idx=<id>` 로 상세를 연다.
- 렌더링이 필요한 도메인(Wix·Gatsby 등)은 Playwright 로 처리한다 —
  다만 `www.fitnessm1.com` 은 Wix 임에도 상호명·주소가 SSR 되어 정적 파싱으로 충분했다.
- `allowed_path_globs` 는 **본 실사에서 실제로 요청해 본 경로만** 담는다
  ([`crawl_policy.yaml`](../crawl_policy.yaml)).

## rate_limit

- 정책값: `max_requests_per_min: 6`, `max_concurrency: 1` (K-2 하한 준수).
- 실측: 20회 요청을 12.0초 간격으로 시행 → 60초 슬라이딩 윈도우 최대 5요청.
  **429·403 0건.** 물증 [`probe/official_website.har`](../probe/official_website.har),
  자기신고 로그 [`rate_probe_log.csv`](../rate_probe_log.csv).
- 사업자 측 명시적 rate limit 고지는 어느 도메인에도 없다.
  `www.fitnessm1.com` 은 dotbot·AhrefsBot 에 `Crawl-delay: 10` 을 지정하는데, 우리 정책의
  10초 간격 이상(12초)이 이 값을 상회하므로 정책상 위반이 없다.

## risk_note

- **개별 도메인의 소멸·개편 위험이 크다.** 업체 홈페이지는 예고 없이 폐쇄·리뉴얼되며,
  그때마다 파서가 깨진다. C1 은 도메인별 실패를 격리해야 한다.
- **allowlist 가 곧 커버리지 상한이다.** 강남3구 웰니스 업체 중 자체 도메인을 운영하는 비율이
  낮아, 이 소스만으로는 H1 모집단을 채우지 못한다. 손실 계상은 [`report.md`](../report.md).
- `www.donutsanma.co.kr` 은 OSM 에서 `shop=massage` 로 태깅되어 후보에 올랐으나,
  실제 사이트(`/contact`)는 강남구 삼성동 소재의 **클럽**을 소개한다. 웰니스 업체로 볼 근거가
  없어 allowlist 에서 제외했다. `www.hitspa.net` 은 페이지 어디에도 소재지 표기가 없어
  강남3구 실증이 불가능해 제외했다. **분류 근거가 없으면 넣지 않는다.**
- 조사 중 OSM 에서 발견된 `*.site` / `강남출장마사지` 계열 도메인은 웰니스 업체로 볼 수 없어
  전량 제외했다. 이 판단 기준은 C1 allowlist 심사에 그대로 승계되어야 한다.
- 재공개 리스크: 업체 홈페이지의 사진·소개문은 업체 저작물이다. 사실 정보(상호·주소·가격·
  영업시간)만 재공개하고 서술문·이미지는 링크로 대체한다 → [`republish_policy.md`](../republish_policy.md).
