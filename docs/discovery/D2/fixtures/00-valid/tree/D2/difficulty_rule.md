# D2 — SERP 난이도 판정 룰

> 계약: [docs/tasks/D2.md](../../tasks/D2.md) REQ-4 · FORBID-1 · FORBID-3
> 검증: `python scripts/discovery/validate_d2.py --check difficulty`
> 임계 하한은 계약 K-1 이 고정한다. 이 문서는 **그 이상으로만** 정의할 수 있다.

---

## 1. 임계 (K-1 하한 = 이 값. 느슨하게 정의할 수 없다)

| 항목 | 이 룰 | K-1 하한 | 방향 |
|---|---|---|---|
| `min_independent_domains` | **3** | ≥ 3 | 하한과 동일 |
| `min_ugc_ratio` | **0.5** | ≥ 0.5 | 하한과 동일 |
| `excluded_platform_domains` | 34건 | K-1 목록 14건 ⊆ | 상위집합 |

검증기(`validate_d2.py`)는 K-1 하한을 **소스에 하드코딩**하고 이 문서의 값과 비교한다.
이 문서에서 임계를 낮추면 `--check difficulty` 가 `FORBID-1` 로 exit 1 한다.

---

## 2. 판정 절차 — (키워드, 엔진) 1건에 대해

```
입력: 1페이지 상위 10개 결과 (rank 1..10, url)

1. 각 결과 URL 의 호스트를 `excluded_platform_domains` 와 대조한다.
   호스트 동일 · 서브도메인 · `domain/path` 접두 중 하나라도 맞으면 제외.
2. 남은 결과를 **등록가능 도메인**으로 환산하고 중복을 제거한다 → 독립 도메인 집합 D
3. n = |D|
4. u = |{ d ∈ D : d 가 UGC 판정 }|
5. ugc_ratio = u / n           (n = 0 이면 0)
6. enterable  ⟺  n ≥ 3  AND  ugc_ratio ≥ 0.5
   그 외      → hard
```

라벨 우선순위 (겹치는 경우):

| 조건 | 라벨 |
|---|---|
| `google_volume + naver_volume < 30` 또는 미측정 | `no_volume_data` |
| collection_log 에 `status=blocked` 기록 | `blocked` |
| 위 판정이 enterable | `enterable` |
| 그 외 | `hard` |

`no_volume_data` 와 `blocked` 는 **enterable 집계의 분자·분모 모두에서 제외**된다 (K-2).

### 2.1 UGC 비중의 분모를 "제외 후 독립 도메인" 으로 고정하는 이유

K-1 문언은 *"대형 플랫폼 제외 후 남는 개별 서비스 도메인 수 ≥ 3"* · *"**그 중** UGC 비중 ≥ 0.5"* 다.
분모를 상위 10개 전체로 넓히면 `blog.naver.com` · `cafe.naver.com` 게시물이 분자에 들어가
UGC 비중이 구조적으로 커지고 enterable 이 대폭 느슨해진다. **분모를 바꾸는 것이 임계를
바꾸는 것보다 쉽다** — 그래서 분모는 계약 문언대로 제외 후 집합으로 고정한다.

> ⚠ **계약 해석 쟁점 (미해소).** 이 문언 그대로의 룰은 한국어 SERP 에서 매우 엄격하다.
> 개인 블로그·카페 글의 대부분이 `blog.naver.com` · `tistory.com` 에 있고 그것들은 제외
> 대상이므로, 남은 독립 도메인은 대개 업체 홈페이지다 → `ugc_ratio` 가 0 에 가까워지고
> enterable 이 거의 0 이 될 수 있다. 그것은 계약이 REQ-5 대조군(`enterable` 기대 10건)으로
> 잡으려던 **반대 방향의 이탈**(룰을 극단적으로 엄격하게 잡아 enterable 을 0 으로 만드는 경로)이다.
> 본 PR 은 실측이 차단되어 대조군으로 이 룰을 교정하지 못했다 —
> [report.md](./report.md) §2 참조. **룰의 캘리브레이션은 미완이며, 이 값으로 G2 를 판정하지 않는다.**

---

## 3. 기계 판독 룰

```yaml
min_independent_domains: 3
min_ugc_ratio: 0.5

# K-1 최소 제외 목록 14건 (제거 불가) + 조사자 추가분 20건.
# 추가는 "독립 도메인이 줄어 enterable 이 어려워지는" 방향이므로 항상 안전하다.
excluded_platform_domains:
  # ── K-1 최소 제외 목록 (계약 고정. 이 14건을 지우면 FORBID-1) ──
  - blog.naver.com
  - cafe.naver.com
  - m.place.naver.com
  - kin.naver.com
  - post.naver.com
  - map.kakao.com
  - place.map.kakao.com
  - search.daum.net
  - google.com/maps
  - youtube.com
  - instagram.com
  - namu.wiki
  - ko.wikipedia.org
  - tistory.com
  # ── 조사자 추가분 (대형 플랫폼·집계 사이트·SNS) ──
  - naver.com
  - naver.me
  - kakao.com
  - daum.net
  - brunch.co.kr
  - facebook.com
  - x.com
  - twitter.com
  - threads.net
  - tiktok.com
  - pinterest.com
  - coupang.com
  - 11st.co.kr
  - gmarket.co.kr
  - wadiz.kr
  - kmong.com
  - soomgo.com
  - danawa.com
  - wikipedia.org
  - modoo.at

# UGC 판정 도메인 — 개인 블로그 · 커뮤니티 게시물 호스트.
# 대형 플랫폼 제외를 통과한 뒤에도 UGC 로 셀 수 있는 도메인만 열거한다.
ugc_domains:
  - dcinside.com
  - fmkorea.com
  - ruliweb.com
  - clien.net
  - theqoo.net
  - 82cook.com
  - ppomppu.co.kr
  - bobaedream.co.kr
  - todayhumor.co.kr
  - instiz.net
  - missycoupons.com
  - pann.nate.com
  - nate.com
  - daangn.com
  - velog.io
  - medium.com
  - wordpress.com
  - blogspot.com
  - tumblr.com
  - egloos.com
  - postype.com
  - noraecoding.com
  - inven.co.kr
  - etoland.co.kr
  - mlbpark.donga.com
  - slrclub.com
  - cook.co.kr
  - momsholic.co.kr
  - jangbogo.com

# 도메인만으로 UGC 를 못 가리는 경우의 경로 패턴 (게시판 URL 관용구).
ugc_path_patterns:
  - "/board/"
  - "/bbs/"
  - "/community/"
  - "/forum/"
  - "/post/"
  - "/article/"
  - "/review/"
```

---

## 4. 스냅샷 파싱 규칙 (FORBID-3 대조의 기준)

`serp_*.csv` 의 `domain` 목록은 **자기신고가 아니라** 스냅샷 원본 HTML 을 다시 파싱한
결과와 100% 일치해야 한다. 파서는 `validate_d2.py: parse_snapshot_domains()` 이며 규칙은:

1. `<a href>` 를 문서 순서대로 수집
2. 검색엔진 리다이렉트 래퍼(`google.com/url?q=`)는 원본 URL 로 되돌린다
3. `http(s)` 절대 URL 만 남긴다
4. 엔진 chrome 호스트(검색 UI · 트래커 · 정책 페이지) 제외 — `ENGINE_CHROME_HOSTS`
5. 광고 표지가 붙은 anchor 제외 — `ENGINE_AD_MARKERS`
   (네이버 파워링크는 `onclick` 에 `i=nad-a001-…`, 링크가 `ader.naver.com` 을 경유한다)
6. 등록가능 도메인으로 환산 후 중복 제거, 앞에서 10개

`capture_mode` 컬럼은 **판정 근거가 아니다.** 로그인 여부는 스냅샷 HTML 의 지표
(`accounts.google.com/SignOutOptions` · `gb_` 아바타 노드 · 네이버 `MyView` · `data-logged-in="true"`)
정규식 스캔으로 판정한다. 1건이라도 검출되면 `--check capture-integrity` 가 exit 1 한다.

> ⚠ 파서는 [feasibility_probe](./feasibility_probe/) 의 **실제 네이버 SERP 스냅샷**으로만
> 검증했다. 구글 SERP 는 JS 렌더링 없이는 결과 노드가 나오지 않아
> (feasibility_probe/README.md 참조) 구글 경로는 **미검증**이다.
