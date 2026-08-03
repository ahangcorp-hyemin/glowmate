# DS0 — Next.js App Router SSR 실측 (REQ-3)

> 판정 룰: [`verdict_rule.md`](./verdict_rule.md) §2.2 · `DS0-RULE-SSR-1`
> 검증: `node scripts/design-system/validate_ds0.mjs --check ssr`
> 재현: `cd docs/design-system/DS0/probe && npm install && node run-probe.mjs`

이 문서의 수치는 **요약이 아니다.** `--check ssr` 는 `probe/logs/` 원문을 다시 파싱해 아래 표의 값과 대조하며,
하나라도 어긋나면 non-zero 로 종료한다.

---

## 1. 측정 대상

| 항목 | 값 |
|---|---|
| 재현 앱 | `docs/design-system/DS0/probe/` (Next.js App Router, 페이지 1장) |
| Next.js | 15.5.22 (제품 `apps/web` 과 동일 버전) |
| React / ReactDOM | 19.2.8 / 19.2.8 |
| seed-design | `@seed-design/react@2.1.0` · `@seed-design/css@2.3.0` |
| 렌더 위치 | `app/page.tsx` — **`"use client"` 가 없는 서버 컴포넌트** |
| 브라우저 | Chrome headless (puppeteer-core, 시스템 설치본) |

`app/layout.tsx` 와 `app/page.tsx` 어느 쪽에도 `"use client"` 가 없다.
seed-design 컴포넌트는 자신이 `"use client"` 를 선언한 클라이언트 컴포넌트이며,
이 probe 는 그것을 **서버 컴포넌트 트리 안에서 렌더**한다.

## 2. 렌더한 seed-design 컴포넌트 — 6종 (기준 5종 이상)

정본은 [`probe/manifest.json`](./probe/manifest.json) 이다.

| # | symbol | 라벨 문자열 | 성격 |
|---|---|---|---|
| 1 | `ActionButton` | `DS0-PROBE-ACTIONBUTTON` | 단일 recipe |
| 2 | `Badge` | `DS0-PROBE-BADGE` | slot recipe 2단 |
| 3 | `Text` | `DS0-PROBE-TEXT` | CSS 변수 값을 계산해 인라인 스타일로 붙인다 |
| 4 | `CalloutRoot/Content/Title/Description` | `DS0-PROBE-CALLOUT` | compound + 내부 상태(`useDismissible`) |
| 5 | `ChipRoot/Label` | `DS0-PROBE-CHIP` | slot recipe context |
| 6 | `SwitchRoot/Label/Control/Thumb/HiddenInput` | `DS0-PROBE-SWITCH` | 하위 패키지 `@seed-design/react-switch`, 제어 상태 보유 |

## 3. 실측 3개 수치

| # | 지표 | 값 | 원천 로그 |
|---|---|---|---|
| (a) | `build_exit_code` (`next build` 종료 코드) | **0** | [`probe/logs/build.log`](./probe/logs/build.log) 마지막 줄 `DS0_PROBE_BUILD_EXIT=0` |
| (b) | `hydration_mismatch_warnings` (hydration mismatch 경고 건수) | **0** | [`probe/logs/console.log`](./probe/logs/console.log) — 잠긴 패턴 목록에 매칭되는 라인 0건 |
| (c) | `js_disabled_label_hits` (JS 비활성 HTML 의 텍스트 노출 건수) | **6** / 6 | [`probe/logs/nojs.html`](./probe/logs/nojs.html) — 6종 라벨 전건이 문자 그대로 존재 |

<!-- DS0-SSR-NUMBERS-BEGIN -->
```json
{
  "component_count": 6,
  "build_exit_code": 0,
  "hydration_mismatch_warnings": 0,
  "js_disabled_label_hits": 6
}
```
<!-- DS0-SSR-NUMBERS-END -->

### (b) 에 대한 보강 — production 만 보면 미탐이 난다

React 는 production 빌드에서 hydration 오류 메시지를 축약한다(`Minified React error #418` 형태).
production 콘솔만 수집하면 잠긴 패턴 목록에 걸리지 않아 **경고가 있어도 0건으로 보인다.**
그래서 `run-probe.mjs` 는 `next start`(production)와 `next dev`(development) **양쪽**에서 콘솔을 수집해
합집합을 `console.log` 에 남긴다. 수집된 전체 메시지는 3건이며 그 내역은 다음과 같다.

```
[production][console.error]  Failed to load resource: ... 404 (Not Found)      ← /favicon.ico
[development][console.info]  Download the React DevTools ...                   ← React 안내
[development][console.error] Failed to load resource: ... 404 (Not Found)      ← /favicon.ico
```

hydration 관련 메시지는 **양쪽 모드 모두에서 0건**이다.

### (c) 에 대한 보강 — script 블록을 빼도 6/6

`nojs.html` 에는 RSC flight 페이로드가 `<script>` 안에 함께 들어 있다. 라벨이 그 페이로드에만 있고
본문에는 없다면 "텍스트 노출"이라 부를 수 없으므로 따로 확인했다.
`<script>…</script>` 를 전부 제거한 뒤에도 **6종 전건이 그대로 존재**한다(즉 `<main>` 본문에 실제로 렌더된다).

---

## 4. 관측된 마찰 — 판정에 반영하지 않았으나 DS3 가 알아야 할 것

전부 이 probe 에서 **실제로 재현**된 것이다. 추정은 "확인 불가"로 표시했다.

### 4.1 namespace 형태 export 는 서버 컴포넌트에서 참조할 수 없다 (재현됨)

`Callout.Root` 처럼 쓰는 namespace 객체(`Callout` · `Chip` · `Switch`)를 서버 컴포넌트에서 참조하면
`next build` 가 **exit 1** 로 실패한다.

```
Error: Failed to collect configuration for /
  cause: Attempted to call __exportAll() from the server but __exportAll is on the client.
         It's not possible to invoke a client function from the server,
         it can only be rendered as a Component or passed to props of a Client Component.
```

평면 심볼(`CalloutRoot` · `ChipRoot` · `SwitchRoot` …)로 import 하면 정상 동작한다.
공식 문서의 예제는 대부분 namespace 표기를 쓰므로, **문서를 그대로 따라 서버 컴포넌트에 붙이면 빌드가 깨진다.**
현재 `app/page.tsx` 는 평면 심볼을 쓴다.

### 4.2 Next 가 자동 생성하는 tsconfig 로는 타입이 어긋난다 (재현됨)

`next build` 가 tsconfig 를 자동 생성할 때 `moduleResolution: "node"` 를 넣는다.
이 상태에서는 하위 패키지(`@seed-design/react-switch` 등)의 `exports` 맵이 무시되어
`SwitchRootProps` 에 `children` 이 없는 것으로 해석되고 빌드가 타입 오류로 실패한다.

```
Type error: Property 'children' does not exist on type
  'IntrinsicAttributes & SwitchRootProps & RefAttributes<HTMLLabelElement>'.
```

`moduleResolution: "Bundler"` 로 바꾸면 해소된다. 제품 설정(`packages/config/tsconfig.base.json`)은
이미 `Bundler` 이므로 glowmate 에서는 문제가 되지 않는다.

### 4.3 `transpilePackages` 는 **필수가 아니었다** (재현됨)

seed-design 자신의 문서 앱은 `transpilePackages: ["@seed-design/react"]` 를 쓴다.
이 probe 에서 해당 설정을 제거하고 `next build` 를 돌린 결과 **exit 0** 이었다(Next 15.5.22 기준).
상류와 같은 조건에서 측정하기 위해 최종 로그는 설정을 켠 상태에서 산출했고,
필수가 아니라는 사실을 여기에 남긴다.

### 4.4 클라이언트 번들 비용 (참고 수치)

`build.log` 의 라우트 표 기준, 컴포넌트 6종만 올린 페이지의 First Load JS 가 **247 kB** 다
(공유 청크 102 kB + 페이지 145 kB). seed-design 컴포넌트는 전부 클라이언트 컴포넌트이므로
"zero-JS 정적 페이지"는 성립하지 않는다. 이 수치는 `DS0-RULE-SSR-1` 의 판정 요소가 **아니다**
(룰이 잠긴 뒤에 임계를 새로 만들지 않는다). LCP/번들 예산은 DS3 이후의 소관이다.

### 4.5 CSS 로드 방식

`app/layout.tsx` 는 `@seed-design/css/all.min.css` 한 줄만 import 한다.
빌드 타임 CSS 추출 단계도, 번들러 플러그인도, cascade layer 설정도 없이 동작했다.

---

## 5. 재현 절차

```bash
cd docs/design-system/DS0/probe
npm install                 # package.json 의 버전은 전부 정확한 x.y.z 로 고정되어 있다
node run-probe.mjs          # logs/build.log · logs/console.log · logs/nojs.html 재생성
```

- `run-probe.mjs` 는 판정을 하지 않는다. 빌드/서버 기동/콘솔 수집/HTML 취득만 하고 로그를 남긴다.
- 빌드가 실패하면 로그를 남긴 뒤 **exit 1 로 중단**한다. 실패를 성공으로 삼키지 않는다.
- 로그를 다시 생성하면 `build.log` 의 sha256 이 바뀐다. `verdict.md` 의 evidence sha256 도 함께 갱신해야
  `--check evidence` 가 통과한다(근거 무결성을 실제로 검사하기 때문이다).
- `node_modules` · `.next` · `package-lock.json` · `next-env.d.ts` 는 커밋하지 않는다
  (앞의 셋은 `.gitignore` 대상이고 `next-env.d.ts` 는 `next build` 가 다시 만든다). 실제 설치 버전은
  [`probe/installed-versions.json`](./probe/installed-versions.json) 에 남겼다.
