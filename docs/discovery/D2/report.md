# D2 — SEO 롱테일 · SERP 난이도 실사 보고

> 계약: [docs/tasks/D2.md](../../tasks/D2.md) · 작성 2026-08-03
> **상태: 실측 차단 (BLOCKED). G2 는 미판정이다.**
> 게이트 파일: [docs/gates/G2.md](../../gates/G2.md)

---

## 0. 한 문장

**후보 키워드 생성(REQ-1)과 판정 기계(검증기 + 위반 픽스처)는 완성했고,
검색량 측정(REQ-2)에 필요한 도구 계정이 없어 그 하류인 REQ-3·5·6·7 은 수행하지 못했다.
수치를 지어내지 않았으므로 `--all` 은 exit 1 이고, G2 는 `not_decided` 다.**

---

## 1. 엔진별 집계 — **산출 불가**

이 문서에는 `google_enterable` / `naver_enterable` / `union_enterable` 을 담은
기계 판독 블록이 **의도적으로 없다.**

검증기 `--check verdict` · `--check blocked-cap` 은 이 블록을 요구하며, 없으면 exit 1 한다.
0 으로 채워 넣으면 두 검사가 "측정 없이" 통과하고, 그 순간
*"엔진별 enterable 0건 → naver_verdict=fail → final=channel_redesign"* 이라는
**측정하지 않은 게이트 판정**이 성립한다. G2 의 오탐(거짓 통과)만큼이나 미탐(거짓 기각)도
채널 전략을 잘못 바꾸므로, 빈칸을 0 으로 채우지 않는다.

## 2. 무엇이 왜 막혔는가

### (A) REQ-2 — 검색량 측정: **도구 계정 부재**

계약 K-3 은 엔진별 허용 도구를 닫힌 enum 으로 고정했다.

| 엔진 | 허용 도구 | 접근 가능 여부 | 필요한 것 |
|---|---|---|---|
| google | `google_keyword_planner` | ✗ | Google Ads 계정 + 캠페인(또는 지출 이력). OAuth 자격증명 |
| | `ahrefs` | ✗ | 유료 구독 + API 키 |
| | `semrush` | ✗ | 유료 구독 + API 키 |
| naver | `naver_searchad_keywordtool` | ✗ | 네이버 검색광고 계정 + API 키/시크릿 + CUSTOMER_ID |
| | `blackkiwi` | ✗ | 계정 로그인 (공개 API 없음) |

리포지토리·실행 환경 어디에도 이 자격증명이 없다
(`.env.example` 에 항목 자체가 없고, 환경변수 스캔 결과 0건).
enum 밖 대체 수단(Google Trends 상대지수 · 서드파티 추정치)은 계약이 허용하지 않는다.

**대체를 시도하지 않았고 수치를 만들어내지 않았다.** `keyword_metrics.csv` 는 존재하지 않는다.
전 행을 `status=no_volume_data` 로 채우는 것도 하지 않았다 — 그러려면
`google_source_tool` · `naver_source_tool` 에 **쓰지 않은 도구 이름**을 적어야 하고
(REQ-2 acceptance 가 enum 값을 요구한다), 그것은 출처의 위조다.

### (B) REQ-3 — SERP 실측: **대상 집합 미확정 + 구글 캡처 불가**

두 가지가 겹쳤다.

1. **대상 집합을 정할 수 없다.** K-2 는 실측 대상을 "검색량 합 ≥ 30 인 키워드 중 상위 100" 으로
   못박았다. 검색량이 없으면 이 집합이 정의되지 않는다. 조사자가 임의로 100건을 고르면
   그것이 바로 계약이 K-2 로 막으려던 **분모 교체**다.
2. **구글은 정적 HTTP 캡처가 불가능하다.** 실측으로 확인했다 —
   [feasibility_probe/README.md](./feasibility_probe/README.md) §3.1.
   8건 전부 JS 부트스트랩 셸만 반환했고 유기적 결과 노드가 0개였다.
   헤드리스 브라우저(Playwright/Chromium)가 필요하며 현재 환경에 없다.
   네이버는 정적 캡처로 결과가 나온다(8/8) — **엔진 간 수집 난이도가 비대칭**이며,
   이 비대칭을 방치하면 FORBID-4 가 경고한 "사실상 구글 단독 판정" 의 거울상
   (네이버만 측정된 판정)이 만들어진다.

### (C) REQ-5 — 대조군: (B)에 종속

대조군 20건은 "실측 100건과 겹치지 않는" 것이 정의다. 실측 100건이 없으면 여집합도 없다.
`control_set.enc` 는 존재하지 않는다. 봉인 스킴과 개봉·대조 로직은 구현·검증되어 있다
(`validate_d2.py --check control` · 픽스처 `00-valid`).

### (D) REQ-6 · REQ-7 — (A)(B)(C)에 종속

`blocked` 카운트도 verdict 도 실측 없이는 산출되지 않는다.
`collection_log.csv` 에 있는 16행은 실측이 아니라 **가능성 실측(probe)** 이며
`status` 가 `probe_ok` / `probe_no_organic_results` 다. `blocked` 는 0건이다
(403·429·캡차를 한 건도 받지 않았다 — 없는 차단을 지어내지 않았다).

## 3. 판단이 필요한 지점

### (A) 검색량 도구 접근 — **차단 해소 조건**

아래 중 **하나**가 주어지면 REQ-2 부터 재개할 수 있다.

| 옵션 | 필요한 것 | 비고 |
|---|---|---|
| 네이버 검색광고 API | `API_KEY` · `SECRET_KEY` · `CUSTOMER_ID` | 무료. 계정 개설 후 발급 |
| Google Ads API | OAuth client + refresh token + developer token | Keyword Planner 수치는 지출 이력이 없으면 광범위한 구간값으로만 나온다 |
| Ahrefs / Semrush | 구독 + API 키 | 유료 |

그리고 SERP 실측에는 추가로 **Playwright + Chromium 설치된 실행 환경**이 필요하다
(구글은 그것 없이는 불가, 네이버도 JS 렌더링 모듈이 있어 정적 캡처는 부분적이다).

### (B) K-1 UGC 비중의 분모 — **계약 해석 확정 필요**

계약 문언은 *"대형 플랫폼 제외 후 남는 개별 서비스 도메인 수 ≥ 3"* · *"**그 중** UGC 비중 ≥ 0.5"* 다.
문언 그대로 구현했다(`difficulty_rule.md` §2.1). 그런데 실측 표본 8건에서 **8/8 이 `hard`** 로 나온다
([feasibility_probe/README.md](./feasibility_probe/README.md) §5) — 한국어 SERP 의 UGC 는 거의 전부
`blog.naver.com` · `tistory.com` 에 있고 그 둘은 K-1 제외 대상이기 때문이다.

즉 이 룰은 **네이버에서 `enterable` 을 구조적으로 0 에 가깝게 만든다.** 그러면 G2 는
측정을 하든 안 하든 `channel_redesign` 이 되고, H3 은 검증되는 것이 아니라 정의상 기각된다.

두 해석이 가능하다. 어느 쪽인지 계약이 정해야 한다 — 조사자가 고르면 그 선택이 곧 결론이 된다.

| 해석 | UGC 비중의 분모 | 효과 |
|---|---|---|
| **현재 구현 (문언 그대로)** | 제외 후 남은 독립 도메인 | 엄격. 네이버 enterable ≈ 0 |
| 대안 | 상위 10개 결과 전체 (제외 전) | 느슨. "1페이지가 블로그 글 위주면 신규 도메인도 뚫린다" 는 원래 논리에 부합 |

REQ-5 대조군(`enterable` 기대 10건 / `hard` 기대 10건)이 바로 이 캘리브레이션을 강제하는 장치인데,
대조군은 실측 100건이 있어야 구성할 수 있으므로 **(A)가 풀리기 전에는 이 쟁점도 풀리지 않는다.**

### (C) 계약 `touches` 와 `done_when` 의 경로 불일치

`done_when` 은 위반 픽스처를 `scripts/discovery/fixtures/d2/` 에 두라고 하는데
그 경로는 `deliverable.touches` 3개 글롭 밖이다. F1 의 `path-guard` job(FORBID-4)이
touches 밖 변경을 exit 1 로 막으므로, 문자 그대로 따르면 이 PR 자체가 차단된다.
→ 픽스처를 **`docs/discovery/D2/fixtures/`** (touches 안)에 두었다.
계약의 `touches` 또는 `done_when` 중 하나를 정정해야 한다.

### (D) D2 의 acceptance 를 실행하는 CI job 이 없다

REQ-1~7 의 acceptance 는 전부 *"CI job `discovery` 에서 `validate_d2.py --check X` exit 0"* 이다.
그런데 F1 이 만든 `discovery` job 은 `pnpm test:discovery`(= `tools/ci-meta/discovery.mjs`)를 돌리며,
그것은 FORBID-6 의 **(a) 존재 / (b) 비스텁** 만 검사한다. `--check X` 를 돌리지 않는다.

즉 지금 상태에서 **D2 의 검사는 CI 에서 실행되지 않는다.** `validate_d2.py` 는 존재하고
결손 입력에서 non-zero 를 내므로 discovery job 은 green 이다 — 검증기가 있는데
아무도 돌리지 않는 상태다. `.github/workflows/ci.yml` 은 D2 의 touches 밖이므로
이 PR 에서 고칠 수 없다. **F1 또는 별도 계약이 `discovery` job 에
`python scripts/discovery/validate_d2.py --all` 을 추가해야 한다.**

---

## 4. 이 PR 이 실제로 완성한 것

| 항목 | 상태 | 근거 |
|---|---|---|
| REQ-1 후보 키워드 720건 | **완료** | `--check keywords` exit 0 |
| 조합 규칙 문서 | 완료 | [keyword_rule.md](./keyword_rule.md) |
| 난이도 판정 룰 (K-1 하한 이상) | 완료 (캘리브레이션 미완) | `--check difficulty` 의 임계·제외목록 검사 통과 |
| 검증기 10종 검사 | 완료 | `validate_d2.py --check {keywords,volume,serp,capture-integrity,difficulty,control,blocked-cap,blocked,verdict,fixtures}` |
| FORBID-1~6 탐지 실증 | **완료** | 위반 픽스처 8종 각각 non-zero + 사유 귀속 · 정상 픽스처 exit 0 |
| 대조군 봉인/개봉 스킴 | 구현·검증 완료 (실데이터 없음) | 픽스처 `00-valid` 의 `--check control` |
| 실환경 수집 가능성 실측 | 완료 | [feasibility_probe/](./feasibility_probe/) · 원본 HTML 16건 커밋 |
| REQ-2·3·5·6·7 | **미완 (차단)** | §2 |
| G2 판정 | **미판정** | [docs/gates/G2.md](../../gates/G2.md) `final: not_decided` |

`python scripts/discovery/validate_d2.py --all` → **exit 1**.
이것은 결함이 아니라 정확한 신호다. 통과시키려면 §3(A)의 자격증명이 필요하다.
