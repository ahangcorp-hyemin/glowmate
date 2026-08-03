# D2 — 실환경 수집 가능성 실측 (feasibility probe)

> 수집 시점: **2026-08-03T02:38:45Z ~ 02:40:06Z (UTC)**
> 수집 도구: `_probe.py` (curl 1회 요청 · 재시도 없음 · 프록시 없음 · 미로그인)
> 원본: [snapshots/](./snapshots/) — HTML 16건 그대로 커밋
> 파싱 결과: [parse_result.csv](./parse_result.csv)
> 시도 로그: [../collection_log.csv](../collection_log.csv)

---

## 0. 이것은 REQ-3 의 SERP 실측이 **아니다**

REQ-3 의 실측 대상은 K-2(검색량 합 ≥ 30)가 정하는 **상위 100건**이다.
검색량 도구 접근이 없어 그 집합을 확정할 수 없다 → [../report.md](../report.md) §2.

이 실측은 그 차단 사유를 **주장이 아니라 증거로** 남기고, 검증기의 스냅샷 파서를
실제 HTML 위에서 검증하기 위한 것이다. **G2 판정에 쓰이지 않는다.**

## 1. 표집 절차 (사후 선택 금지)

`keywords.csv` 파일 순서 그대로 **인덱스 0 부터 90 간격** → 8건.
키워드를 보고 고르지 않았고, 재실행하면 같은 8건이 나온다.
(`_probe.py` 의 `SAMPLE_START=0` · `SAMPLE_STRIDE=90`)

## 2. 수집 규약 (FORBID-6 준수)

| 항목 | 값 |
|---|---|
| 조합당 요청 수 | 정확히 1회 |
| 재시도 | 없음 (`curl --retry` 미사용) |
| 프록시 로테이션 | 없음 |
| 캡차 우회 | 없음 |
| 요청 간격 | 4초 |
| 로그인 | 없음 (쿠키 미전송) |

응답이 무엇이든 그대로 `collection_log.csv` 에 기록했다. 16건 전부 HTTP 200 이었고
403 · 429 · 캡차는 **한 건도 없었다** — 따라서 `status=blocked` 행도 0건이다.

## 3. 결과

| 엔진 | 시도 | HTTP 200 | 유기적 결과 파싱 성공 | 상위 10개 확보 |
|---|---|---|---|---|
| naver | 8 | 8 | **8** | 8 |
| google | 8 | 8 | **0** | 0 |

### 3.1 구글 — 정적 HTTP 캡처로는 SERP 를 얻을 수 없다

8건 전부 `<title>Google Search</title>` 만 있는 **JS 부트스트랩 셸**(약 91KB)이 돌아왔다.
`<noscript>` 블록이 `/httpservice/retry/enablejs` 로 리다이렉트하고, 문서 전체의 절대 링크는
`support.google.com` 1개뿐이다. `gbv=1`(basic HTML) 파라미터로도 동일했다.

→ **구글 SERP 실측에는 헤드리스 브라우저 렌더링이 필요하다.**
   현재 이 환경에는 Playwright/Chromium 이 설치되어 있지 않다
   (`services/crawler` 의 Python 툴체인은 CI 에서만 설치된다).

### 3.2 네이버 — 캡처는 되지만 정적 HTML 만으로 상위 10개가 온전하지 않다

8건 전부 실제 유기적 결과가 파싱됐다. 다만 통합검색 상단의 자체 버티컬 탭
(`search.shopping.naver.com` · `map.naver.com`)이 전건에서 링크 1·2번을 고정 점유했고,
같은 사이트의 서브링크가 연속 중복으로 잡힌다(`www.daangn.com` ×2 등).
전자는 검증기의 `ENGINE_CHROME_HOSTS` 로 제외했고, 후자는 **미해결 파서 한계**다.

### 3.3 로그인 흔적 (FORBID-3)

16건 전부 로그인 지표 검출 0건. 미로그인 캡처임이 스냅샷 원본으로 확인된다
(`parse_result.csv` 의 `login_markers` 컬럼 전건 공란).

---

## 4. 파싱 결과 (네이버 8건)

```
강남구 필라테스 허리통증 가격   www.daangn.com ×2 · blog.naver.com ×2 · www.woondoc.com ×2 · sport.milaelo.com · blog.naver.com ×3
송파구 마사지 허리통증 가격    blog.naver.com ×8 · massagepick.com · www.waug.com
논현동 필라테스 허리통증 가격   blog.naver.com ×4 · www.da-gym.co.kr · www.woondoc.com · pf.kakao.com · blog.naver.com · www.instagram.com · pf.kakao.com
압구정동 마사지 허리통증 가격   in.naver.com · blog.naver.com ×7 · www.kyouhand.com
신사동 필라테스 허리통증 가격   blog.naver.com ×2 · www.goodoc.co.kr · www.woondoc.com · www.daangn.com ×2 · blog.naver.com ×4
반포동 마사지 허리통증 가격    www.makangs.com ×2 · www.daangn.com ×2 · blog.naver.com ×6
잠실동 필라테스 허리통증 가격   www.daangn.com ×2 · www.da-gym.co.kr · blog.naver.com ×6
방이동 마사지 허리통증 가격    blog.naver.com ×8 · pain.hansangsoo.com · ryoenjoy.com
```

## 5. 이 8건에 난이도 룰을 적용하면 — **8/8 이 `hard`**

`difficulty_rule.md` 를 그대로 적용한 결과(참고값. 실측이 아니므로 라벨로 기록하지 않는다):

| 키워드 | 독립 도메인 수 | ugc_ratio | 라벨 |
|---|---|---|---|
| 강남구 필라테스 허리통증 가격 | 3 | 0.33 | hard |
| 송파구 마사지 허리통증 가격 | 2 | 0.00 | hard |
| 논현동 필라테스 허리통증 가격 | 2 | 0.00 | hard |
| 압구정동 마사지 허리통증 가격 | 1 | 0.00 | hard |
| 신사동 필라테스 허리통증 가격 | 3 | 0.33 | hard |
| 반포동 마사지 허리통증 가격 | 2 | 0.50 | hard |
| 잠실동 필라테스 허리통증 가격 | 2 | 0.50 | hard |
| 방이동 마사지 허리통증 가격 | 2 | 0.00 | hard |

> **이 관측은 계약 K-1 의 해석 쟁점을 드러낸다.** 네이버 1페이지의 대부분이
> `blog.naver.com` 이고 그것은 K-1 최소 제외 목록에 있으므로, 제외 후 남는 독립 도메인은
> 2~3개(대개 업체 홈페이지)이고 그 안에서 UGC 비중은 0~0.5 다. 즉 **K-1 문언을 그대로
> 적용하면 네이버의 `enterable` 은 구조적으로 0 에 가깝고, G2 는 측정 전에 이미
> `channel_redesign` 으로 결정된다.**
>
> 이것은 계약이 REQ-5 대조군(`enterable` 기대 10건)으로 잡으려던 **반대 방향의 이탈**
> — 룰을 극단적으로 엄격하게 잡아 enterable 을 0 으로 만드는 경로 — 이며,
> 표본 8건은 그 경로가 실재함을 보여준다. 해석 확정이 필요하다:
> [../report.md](../report.md) §3 판단 필요 지점 (B).
