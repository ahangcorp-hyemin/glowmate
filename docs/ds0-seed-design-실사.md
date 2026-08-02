# DS0 — seed-design 채택 실사 (게이트 G5)

- 조사일: 2026-08-02 ~ 08-03
- 대상: [daangn/seed-design](https://github.com/daangn/seed-design) (SEED Design System)
- 판정 대상: glowmate (Next.js App Router, SEO 최우선 웹 서비스)
- 조사 방법: GitHub API / npm registry API 실측, 배포된 tarball 직접 다운로드 후 내용 검증, 공식 문서(`llms.txt` 원문) 대조
- **모든 수치·인용은 실측값이며, 검증하지 못한 항목은 "확인 불가"로 명시했다.**

---

## 요약 — G5 판정

| 조건 | 판정 | 한 줄 근거 |
|---|---|---|
| ① Next.js App Router SSR 동작 | **✅ 충족** | seed-design 공식 문서 사이트 자체가 Next.js 16 App Router로 만들어져 있고 `@seed-design/react`를 쓴다 |
| ② 라이선스 상업적 사용 허용 | **✅ 충족** | Apache-2.0. NOTICE에 "상업적 목적 포함 자유롭게 사용" 명문화 |
| ③ 데스크톱 웹 커버 충분 | **❌ 미충족** | 반응형 인프라는 있으나 Table/Pagination/Breadcrumb/Card 전무. 컴포넌트 무게중심이 모바일 앱(BottomSheet·PullToRefresh·FAB·ActionSheet) |

> ### 최종 권고: **옵션 A — seed-design 토큰만 추출 + shadcn/ui로 컴포넌트 소유**
>
> 3개 조건 중 ③이 미충족이므로 게이트 규칙에 따라 옵션 A. 다만 이는 "seed-design이 나쁘다"는 뜻이 **아니다** — 토큰 레이어는 예상보다 훨씬 좋고, 채택 비용이 거의 0에 가깝다. 상세는 [§8](#8-최종-권고와-이유)와 [§9](#9-권고-구성)를 볼 것.

---

## 1. 저장소 현황

`GET https://api.github.com/repos/daangn/seed-design` (2026-08-02 실측)

| 항목 | 값 |
|---|---|
| 공개 여부 | **public** (`private: false`, `archived: false`, `disabled: false`) |
| Stars | **990** |
| Forks | 71 / Watchers 30 / Open issues 62 |
| 생성 | 2021-03-11 |
| 최종 push | **2026-08-02** (조사 당일) |
| 기본 브랜치 | `dev` |
| 주 언어 | TypeScript |
| 홈페이지 | https://seed-design.io |

**유지보수 활성도 — 매우 높음.** `stats/participation` 실측 최근 52주 커밋 **1,104건**, 최근 12주 주간 커밋 `[7, 10, 1, 10, 14, 21, 36, 23, 18, 7, 32, 48]`. 조사 당일에도 커밋이 올라왔다.

최근 커밋 샘플 (`GET /repos/daangn/seed-design/commits?sha=dev`):

```
2026-08-02  docs: show which package version each component and hook shipped in (#1871)
2026-08-02  docs: add contributing guide (#1869)
2026-08-02  feat(docs): mark featured pages with a sidebar dot (#1860)
2026-07-30  docs(select): add Select component guidelines (#1867)
2026-07-30  docs(dialog): add Dialog component guideline (#1866)
```

이슈 번호가 #1871까지 올라가 있고 Renovate 봇이 의존성을 상시 관리한다. **버려진 프로젝트가 아니라 당근 내부에서 실사용 중인 활성 프로젝트다.**

### 1.1 라이선스 — Apache-2.0 (상업적 사용 가능)

- SPDX: `Apache-2.0` — https://github.com/daangn/seed-design/blob/dev/LICENSE
- npm 배포 패키지 메타데이터도 전부 `"license": "Apache-2.0"` (실측 확인)
- 과거 MIT였으나 Apache-2.0으로 전환됨 (https://seed-design.io/react/updates/changelog)

`NOTICE` 파일 원문 (https://raw.githubusercontent.com/daangn/seed-design/dev/NOTICE):

> 이 소프트웨어는 Apache License 2.0에 따라 배포되며, **상업적 목적을 포함하여 자유롭게 사용, 수정, 재배포할 수 있습니다.**
> 재배포할 때에는 Apache License 2.0 제4조에 따라 라이선스 사본을 제공하고 이 파일에 담긴 귀속 고지를 전달해야 합니다.
>
> 아래 "브랜드 리소스"에 관한 내용은 **상표에 관한 안내이며, Apache License 2.0이 정하는 조건을 변경하지 않습니다.**
> (…) 브랜드 리소스란 **로고, 상호명, 캐릭터** 등 당근마켓이나 당근마켓의 제품으로 식별될 수 있는 모든 요소를 의미합니다.
> 당근마켓과 사전 협의가 없는 경우 비상업적 목적으로만 사용이 허가되며 (…)
> - 당근마켓을 사칭하거나, 당근마켓이 제공하는 제품 또는 서비스인 것처럼 오인하게 하는 사용 (불가)
> - 당근마켓의 제품 또는 서비스와 제휴, 후원, 보증, 그 밖의 관련이 있는 것처럼 오인하게 하는 사용 (불가)

**glowmate 관점 해석:**

- ✅ 코드·토큰·컴포넌트의 상업적 사용/수정/재배포 — **문제없음**
- ⚠️ 의무사항: 배포물에 **LICENSE 사본 + NOTICE 귀속 고지 동봉**, 수정한 파일에는 **변경 사실 표기** (Apache-2.0 §4). 웹 서비스는 "배포"에 해당하지 않는 해석이 일반적이나, CLI로 스니펫을 리포에 복사해 오는 구조상 리포 내에 원본 저작권 헤더를 유지하는 것이 안전하다.
- ❌ 당근 **로고·상호명·캐릭터**는 사용 불가 — glowmate엔 애초에 무관
- ⚠️ **주의할 회색지대**: SEED의 브랜드 컬러는 `carrot`(당근 오렌지)이다. 이를 그대로 glowmate 브랜드 컬러로 쓰면 "당근과 관련 있는 것처럼 오인하게 하는 사용"에 근접할 소지가 있다. 색상값 자체가 상표는 아니지만, **carrot 팔레트는 교체하고 자체 브랜드 컬러를 쓰는 것을 권고**한다. (법적 판단이 아니라 리스크 회피 관점)
- 확인 불가: 브랜드 가이드라인 원문은 Notion 링크(https://app.notion.com/p/daangn/6fdd92981e4a42d8b29c89cbbba7a8b7)로만 제공되며 접근 검증하지 않았다.

---

## 2. 패키지 구성

`GET https://registry.npmjs.org/-/v1/search?text=seed-design` 및 각 패키지 메타데이터 실측. **전 패키지 최신 배포일 2026-07-28**, 라이선스 전부 Apache-2.0.

### 2.1 핵심 패키지

| 패키지 | 최신 | 월 다운로드 | 역할 |
|---|---|---|---|
| `@seed-design/css` | **2.3.0** | 125,990 | **토큰 + 컴포넌트 스타일의 순수 CSS 구현.** 런타임 의존성 **0** |
| `@seed-design/react` | **2.1.0** | 124,668 | React 컴포넌트 (86개). peer: `@seed-design/css`, react>=18 |
| `@seed-design/tailwind4-theme` | **2.3.0** | 2,816 | Tailwind v4 `@theme` 매핑. 의존성 0 |
| `@seed-design/tailwind3-plugin` | **2.3.0** | 13,422 | Tailwind v3 플러그인 |
| `@seed-design/rootage-artifacts` | **2.3.0** | 769 | **원본 토큰 소스 (YAML)** |
| `@seed-design/cli` | 1.6.1 | 6,833 | shadcn 방식 컴포넌트 스니펫 설치 CLI |
| `@seed-design/vite-plugin` / `rsbuild-plugin` / `webpack-plugin` | 2.1.0 | — | 테마 속성/스크립트 주입 + 컴포넌트 CSS 자동 로드 |
| `@seed-design/mcp`, `@seed-design/docs-mcp` | 2.1.0 / 0.6.0 | — | AI 연동용 MCP 서버 |

**Deprecated (사용 금지):**

- `@seed-design/design-token` 1.0.5 — 패키지 description 원문: `"DEPRECATED: see @seed-design/css for the latest version."` (월 24,817 다운로드는 레거시 관성)
- `@seed-design/stylesheet` 1.1.2 — 동일하게 DEPRECATED 표기
- `seed-design` (스코프 없음) — `0.0.0-parking.0`, 이름 선점용 더미
- `gatsby-plugin-seed-design` 0.2.7 — 2023-07-17 이후 방치

> **함정:** 검색 결과 상위에 뜨는 `@seed-design/design-token`이 이름상 "토큰 패키지"처럼 보이지만 **deprecated다.** 토큰은 `@seed-design/css`(소비용) 또는 `@seed-design/rootage-artifacts`(원본 소스)에서 가져와야 한다.

### 2.2 ① 토큰만 담긴 패키지가 별도로 존재하는가 — **예, 두 층위로 존재한다**

**(a) 소비 레이어: `@seed-design/css`** — 컴포넌트 없이 토큰만 쓸 수 있다.

`exports` 필드 실측:

```
'./*.css', './base.css', './base.min.css', './base.layered.css', './base.layered.min.css',
'./all.css', './all.min.css', './all.layered.css', './all.layered.min.css',
'./recipes/*.css', './recipes/*',
'./vars', './vars/*', './vars/component', './vars/component/*',
'./theming', './breakpoints', './package.json'
```

`./vars` 하위 실측 구조:

```
color/ (palette, fg, bg, stroke, banner, manner-temp)
dimension/  component/
duration  font-size  font-weight  gradient  line-height  radius  scale  shadow  timing-function
```

JS 상수는 CSS 변수 문자열을 그대로 노출한다 (`css/vars/color/fg.mjs` 실측):

```js
export const brand = "var(--seed-color-fg-brand)";
export const neutral = "var(--seed-color-fg-neutral)";
export const neutralMuted = "var(--seed-color-fg-neutral-muted)";
export const critical = "var(--seed-color-fg-critical)";
export const positive = "var(--seed-color-fg-positive)";
export const warning = "var(--seed-color-fg-warning)";
// ...
```

**시맨틱 토큰 체계가 매우 정갈하다.** `fg`/`bg`/`stroke` × `brand`/`critical`/`positive`/`warning`/`informative`/`neutral` × `solid`/`weak`/`pressed`/`contrast` 조합. 이 **구조**는 그 자체로 차용 가치가 크다.

**(b) 원본 소스 레이어: `@seed-design/rootage-artifacts`** — 상세는 [§5](#5-토큰-추출-경로).

### 2.3 ② React 컴포넌트 실제 커버리지 — **86개. 버튼/인풋 수준을 훨씬 넘지만, 방향이 다르다**

`@seed-design/react@2.1.0` tarball 직접 추출, `lib/components/` 디렉터리 실측 **86개**:

```
Accordion ActionButton ActionChip ActionSheet Article AspectRatio AttachmentDisplay
AttachmentInput Avatar Badge BottomSheet BottomSheetHandle Box Callout Celsius Checkbox
Chip ChipTabs Columns ConsistentWidth ContentDialog ContentPlaceholder
ContextualFloatingButton ControlChip Count Dialog Divider ExtendedActionSheet ExtendedFab
Fab Field FieldButton Fieldset Flex Float FloatingActionButton Footer Grid GridItem
HelpBubble HelpBubbleTooltip Icon IdentityPlaceholder ImageFrame Inline InlineBanner
Layout LinkContent List LoadingIndicator MannerTemp MannerTempBadge Menu MenuSheet
NavigationMenu NotificationBadge PageBanner Portal ProgressCircle PullToRefresh
QuantityPicker RadioGroup RadioGroupField ReactionButton ResponsiveDialog ResponsivePair
ResponsiveSidePanel ScrollFog SegmentedControl Select SelectBox SideNavigation SidePanel
Skeleton Slider Snackbar Stack SwipeableMenuSheet Switch Tabs TagGroup Text TextField
ToggleButton VisuallyHidden
```

**있는 것:** 리스트(`List`, `ListHeader`), 필터 계열(`Chip`, `ControlChip`, `ChipTabs`, `SegmentedControl`, `TagGroup`), 폼 일습(`TextField`, `Select`, `Checkbox`, `RadioGroup`, `Switch`, `Slider`, `QuantityPicker`, `Field`, `Fieldset`), 레이아웃 프리미티브(`Box`, `Flex`, `Grid`, `Stack`, `Inline`, `Columns`, `Layout`), 오버레이(`Dialog`, `Menu`, `Popover`\*, `HelpBubbleTooltip`, `SidePanel`, `Snackbar`).

\* `Popover`/`Tooltip`은 최상위 export 이름이 아니라 하위 패키지(`@seed-design/react-popover`, `react-tooltip`)와 `HelpBubble*` 래퍼로 제공된다.

**없는 것 (실측 확인):**

| 컴포넌트 | 존재 | glowmate 관련성 |
|---|---|---|
| `Table` / `DataTable` | ❌ | 가격 비교표에 직결 |
| `Pagination` | ❌ | SEO 목록 페이지 필수 |
| `Breadcrumb` | ❌ | SEO 구조화 내비 필수 |
| `Card` | ❌ | **시그니처 컴포넌트의 기반** |
| `Combobox` / `Command` | ❌ | 검색 UX |
| `Calendar` / `DatePicker` | ❌ | 기간 필터 |
| `Form` (스키마 연동) | ❌ | react-hook-form 연동 없음 |

**모바일 앱 전용 성격 컴포넌트 (실측):**

```
ActionSheet  BottomSheet  BottomSheetHandle  ContextualFloatingButton
ExtendedActionSheet  ExtendedFab  Fab  Float  FloatingActionButton
PullToRefresh  SwipeableMenuSheet
```

여기에 `MannerTemp`/`MannerTempBadge`(당근 매너온도), `Celsius` 같이 **당근 도메인에 완전히 종속된 컴포넌트**도 포함되어 있다. 또한 `@seed-design/stackflow`는 모바일 스택 내비게이션 프레임워크 연동 패키지다.

> **결론:** 커버리지는 "버튼/인풋 수준"을 훨씬 넘어 성숙하다. 그러나 **커버리지의 방향이 모바일 커머스 앱**이고, glowmate가 필요한 **정보 밀도형 웹 컴포넌트(Table/Card/Pagination/Breadcrumb)는 하나도 없다.** 이것이 조건 ③ 미충족의 핵심이다.

### 2.4 ③ 스타일링 방식 — **vanilla-extract 아님. 순수 CSS + CSS 변수. Tailwind 호환 공식 지원**

이번 실사에서 가장 중요한 반전. **v1의 vanilla-extract 런타임은 v2에서 폐기되었고, 지금은 빌드 산출물이 정적 `.css` 파일이다.**

`@seed-design/css@2.3.0` tarball 실측:

- `dependencies: {}`, `peerDependencies: {}` — **런타임 의존성 0**
- 산출물이 그냥 CSS 파일:

| 파일 | 크기 |
|---|---|
| `base.css` | 60.5 KB |
| `base.min.css` | 55.4 KB |
| `all.css` | 406.7 KB |
| `all.min.css` | 365.9 KB |
| `*.layered.css` | 각 +2 KB (cascade layer 래핑 버전) |

- `recipes/` 하위에 컴포넌트별 CSS 182개 파일 (컴포넌트당 `.css` / `.layered.css` / `.mjs` / `.d.ts`)

`base.css` 실제 내용 (head 실측):

```css
:root {
  --seed-safe-area-top: 0px;
  --seed-safe-area-bottom: 0px;
}
/* ... */
.seed-icon {
  width: var(--seed-icon-size);
  height: var(--seed-icon-size);
  color: var(--seed-icon-color, currentColor);
}
```

즉 **플레인 CSS 클래스 + CSS 커스텀 프로퍼티**. 빌드 타임 CSS 추출도, CSS-in-JS 런타임도, 바벨/SWC 플러그인도 필요 없다.

**Tailwind 호환 — 공식 패키지로 지원된다.** `@seed-design/tailwind4-theme@2.3.0`은 파일이 `index.css` 하나뿐이고 내용은 순수 매핑이다 (실측):

```css
@theme {
  --color-palette-gray-00: var(--seed-color-palette-gray-00);
  --color-palette-gray-100: var(--seed-color-palette-gray-100);
  /* ... */
  --color-palette-carrot-500: var(--seed-color-palette-carrot-500);
  --color-palette-blue-200: var(--seed-color-palette-blue-200);
  /* ... */
}
```

Tailwind v3용 `@seed-design/tailwind3-plugin`도 별도 제공. **토큰을 Tailwind로 끌어오는 데 Style Dictionary가 전혀 필요 없다** — [§5](#5-토큰-추출-경로) 참조.

---

## 3. Next.js App Router SSR 호환성 — **✅ 충족 (결정적 증거 확보)**

### 3.1 결정적 증거: 공식 문서 사이트가 Next.js 16 App Router다

`docs/package.json` 실측 (https://raw.githubusercontent.com/daangn/seed-design/dev/docs/package.json):

```
name: @seed-design/docs
next: ^16.2.0
react: ^19.2.3
react-dom: ^19.2.3
@seed-design/react: 2.1.0
@seed-design/css: 2.3.0
@seed-design/tailwind4-theme: 2.3.0
@tailwindcss/postcss: ^4.0.6
fumadocs-ui: ^16.8.2
build: "bun run typecheck && NEXT_EXTERNAL_TYPECHECK=1 next build --turbopack"
```

`docs/app/` 디렉터리 존재 확인 — `layout.tsx`, `page.tsx`, `robots.ts`, `sitemap.ts`, `not-found.tsx`, `metadata.ts`. **App Router가 맞다.**

즉 **seed-design.io 자체가 "Next.js App Router + React 19 + Tailwind 4 + seed-design"으로 돌아가는 프로덕션 사이트다.** 이보다 강한 호환성 증거는 없다.

더구나 SEO 작업 이력도 있다 — 이슈 #1828: `perf(docs): cut initial JS 78%, add robots/canonical/JSON-LD/section OG` (2026-07-26 close). **glowmate와 동일한 요구(SEO 웹)를 같은 스택에서 실제로 달성한 사례다.**

### 3.2 서버 컴포넌트 환경에서 동작하는가

**동작한다. 단, 컴포넌트는 클라이언트 컴포넌트다.**

`@seed-design/react@2.1.0` tarball 실측: `lib/` 하위 JS 251개 중 **226개에 `"use client"` 지시문이 있다.**

해석:
- ✅ **RSC 경계를 올바르게 선언**하고 있다 → 서버 컴포넌트 트리 안에서 import해도 깨지지 않는다
- ✅ Next.js는 클라이언트 컴포넌트도 **SSR로 HTML을 프리렌더**한다 → **SEO 영향 없음.** 크롤러는 완성된 마크업을 받는다
- ⚠️ 다만 **서버 컴포넌트로 렌더되지는 않는다** → 해당 컴포넌트만큼 클라이언트 번들과 하이드레이션 비용이 발생한다. "zero-JS 정적 페이지"는 불가능

CLI에도 RSC 옵션이 1급으로 존재한다 — `seed-design.json`의 `rsc: boolean`이 복사되는 스니펫의 `"use client"` 유지/제거를 제어하고, `init`이 "React Server Components를 사용중이신가요?"를 직접 묻는다 (https://seed-design.io/react/getting-started/cli/configuration).

SSR 대응도 설계돼 있다: `BreakpointProvider`의 `defaultBreakpoint`로 서버 렌더 시 기본 breakpoint를 지정할 수 있다 (https://seed-design.io/react/components/concepts/responsive-design).

### 3.3 빌드 타임 CSS 추출 / Vercel 배포

**CSS 추출 단계가 아예 없다.** [§2.4](#24--스타일링-방식--vanilla-extract-아님-순수-css--css-변수-tailwind-호환-공식-지원)에서 확인했듯 배포된 CSS는 정적 파일이므로 `import "@seed-design/css/all.css"` 한 줄이면 끝이다. Next.js 기본 CSS 파이프라인이 그대로 처리하고, **Vercel 배포와 충돌할 지점이 구조적으로 없다.**

공식 문서도 번들러 플러그인이 **필수가 아님**을 명시한다 — Manual 설치 가이드(https://seed-design.io/react/getting-started/installation/manual)가 "번들러 통합 없이" 쓰는 법을 정식 문서화하고 있다. 플러그인이 하는 일은 ① `<html>` 테마 data-attribute + 테마 스크립트 주입, ② 컴포넌트별 CSS 자동 로드 두 가지뿐이며, 전자는 `@seed-design/css/theming`의 `generateThemingScript({ mode })`로 직접 처리할 수 있다.

### 3.4 알려진 제약 — 공식 Next.js 가이드가 없다

**설치 가이드는 Vite / Rsbuild / Webpack / Manual 4종뿐이고 Next.js 편은 없다.** 문서 전문(`react/llms-full.txt`) grep 결과 Next.js 언급은 예제 코드의 `import dynamic from "next/dynamic"` 단 1건, "App Router" 0건이다. `@seed-design/next-plugin` 같은 패키지도 npm에 없다.

**즉 "동작은 확실하지만 공식 문서 경로는 없는" 상태다.** 다만 이건 치명적이지 않다 — 정답 레시피가 그들 리포에 코드로 존재하기 때문이다.

### 3.5 실증된 Next.js App Router 레시피 (docs 앱에서 추출)

`docs/app/layout.tsx` 실측 (https://raw.githubusercontent.com/daangn/seed-design/dev/docs/app/layout.tsx):

```tsx
import "./layer-order.css";
import "@seed-design/css/base.layered.min.css";
import "./global.css";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="ko"
      data-seed
      data-seed-user-color-scheme="light"
      data-seed-color-mode="system"
      suppressHydrationWarning
    >
      <head>
        <meta name="color-scheme" content="light dark" />
        {/* Pretendard dynamic-subset variable */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

`docs/app/layer-order.css` — 파일 전체가 한 줄이다:

```css
@layer theme, base, seed-base, components, seed-components, utilities;
```

`docs/app/global.css` (head):

```css
@import "tailwindcss" source(none);
@import "@seed-design/tailwind4-theme";
@source ".";
@source "../components";
```

`docs/next.config.mjs`에서 드러난 **실제 마찰 지점**:

```js
const config = {
  output: "export",
  transpilePackages: ["@seed-design/react", "@seed-design/stackflow"],
  turbopack: {
    // Turbopack은 아직 package exports의 커스텀 condition을 설정할 수 없다.
    // Webpack의 `seed-layered` condition과 동일한 CSS 진입점을 직접 연결한다.
    resolveAlias: layeredRecipeAliases,   // 디렉터리 스캔으로 수동 생성
  },
  webpack: (config) => {
    config.resolve.conditionNames = ["seed-layered", "..."];
    return config;
  },
};
```

**⚠️ 확인된 제약 3가지:**

1. **`transpilePackages: ["@seed-design/react"]`가 필요하다.** 당근 자신도 넣고 있다.
2. **Turbopack이 `@seed-design/css`의 커스텀 export condition(`seed-layered`)을 지원하지 못한다.** 당근은 `packages/css/recipes`를 `readdirSync`로 스캔해 `resolveAlias` 맵을 수동 생성하는 워크어라운드를 쓴다. **node_modules 기반인 외부 프로젝트에서는 이 코드를 그대로 못 쓰고 직접 각색해야 한다.** — cascade layer 방식(`.layered.css`)을 쓸 때만 해당하며, 비-layered CSS를 쓰면 회피 가능.
3. **cascade layers 기능은 공식 문서에 "Experimental" 표기**다 (https://seed-design.io/react/getting-started/styling/cascade-layers). 그런데 Tailwind로 SEED 스타일을 오버라이드하려면 바로 이 layer 순서 제어가 필요하다. **즉 "seed 컴포넌트 + Tailwind 커스터마이즈" 조합이 정확히 실험적 영역에 걸쳐 있다.**

> 조건 ① 판정: **✅ 충족.** 동작은 자체 프로덕션 사이트로 실증됨. 공식 Next.js 가이드 부재와 Turbopack layered-CSS 마찰은 감수 가능한 수준의 부채.

---

## 4. 웹/데스크톱 적합성 — **인프라는 있으나 컴포넌트 커버리지가 부족 (조건 ③ ❌)**

### 4.1 모바일 전용 가정은 박혀 있지 않다 — 오히려 데스크톱이 1급 시민이다

**(a) Breakpoint가 데스크톱까지 정의돼 있다.** `@seed-design/css/breakpoints/index.mjs` 실측:

```js
export const breakpoints = { base: 0, sm: 480, md: 768, lg: 1280, xl: 1440 };
export const mediaQueries = {
  sm: "(min-width: 480px)", md: "(min-width: 768px)",
  lg: "(min-width: 1280px)", xl: "(min-width: 1440px)",
};
```

**(b) 토큰 소스에 뷰포트가 모드로 선언돼 있고, 설명이 명시적으로 데스크톱이다.** `rootage-artifacts/collections.yaml` 실측:

```yaml
- name: viewport-width
  modes:
    - id: base
      description: "세로 모드 폰"
    - id: sm
      description: "가로 모드 폰 또는 좁은 태블릿"
    - id: md
      description: "태블릿"
    - id: lg
      description: "데스크톱"
    - id: xl
      description: "넓은 데스크톱"
```

**(c) 반응형 API가 런타임에 제공된다.** `@seed-design/react` export 실측:

```ts
export { useBreakpoint } from './hooks/useBreakpoint';
export { useBreakpointValue } from './hooks/useBreakpointValue';
export { BreakpointProvider } from './providers/BreakpointProvider';
export type { ResponsiveValue, UnwrapResponsive, BreakpointThreshold } from './types/responsive';
```

`<Box padding={{ base: "x3", md: "x4" }} />` 형태의 반응형 prop, `hideFrom`, 반응형 `Grid columns` 지원 (https://seed-design.io/react/components/concepts/responsive-design).

**(d) 공식 문서가 데스크톱을 명시한다.**

- "SEED는 **mobile-first 반응형 시스템**을 제공합니다" — https://seed-design.io/react/components/concepts/responsive-design
- "SEED React 컴포넌트는 **모바일 터치 환경과 데스크톱 마우스 환경 모두**에서 적절한 상호작용 피드백을 제공합니다" — https://seed-design.io/react/components/concepts/interaction-states
- Foundations Layout 문서는 사실상 웹 레이아웃 문서다 — https://seed-design.io/foundations/layout: "**Dashboard Layout**: 판매자 센터, 광고주 센터와 같이 복잡한 데이터를 다루는 화면", "**Contents Layout**: 당근닷컴, 어바웃 당근, 채용 페이지", 12컬럼 그리드, gutter 24px, margin 32px, **max-width 1040/1280px**
- 데스크톱 지향 블록 제공: `SideNavigation`, `Layout`(density low/medium/high + max-width 중앙 정렬), `Footer`
- `ResponsiveDialog`: "md 이상에서는 Dialog로, 그 아래에서는 Bottom Sheet로 렌더링"
- 컴포넌트 size prop 설명에 "`medium`: Breakpoint `lg` 이상(**데스크톱**)에서만 사용"

**(e) "모바일 전용"이라는 서술은 전체 문서에서 발견되지 않았다** (`모바일 전용`, `mobile-only` grep 0건).

> **즉 "모바일 전용 가정이 박혀 있다"는 통념은 사실이 아니다.** SEED V3는 당근닷컴/광고주센터 같은 웹 표면을 명시적 타깃으로 포함한다.

### 4.2 그런데 왜 조건 ③을 미충족으로 판정하는가

**"데스크톱에서 깨지지 않는가"와 "glowmate가 필요한 데스크톱 웹 컴포넌트를 덮는가"는 다른 질문이다.** 후자가 게이트 문구의 "데스크톱 웹 커버 **충분**"에 해당한다.

| 판단 근거 | 내용 |
|---|---|
| **핵심 웹 컴포넌트 부재** | `Table`, `Pagination`, `Breadcrumb`, `Card`, `Combobox`, `Calendar` **전부 없음** (실측). SEO 웹의 목록/상세/비교 화면 골격이 통째로 비어 있다 |
| **컴포넌트 무게중심** | 86개 중 11개가 모바일 앱 전용(BottomSheet·PullToRefresh·FAB·ActionSheet·SwipeableMenuSheet 등), 여기에 당근 도메인 종속(`MannerTemp`, `Celsius`)까지 포함 |
| **시그니처 컴포넌트 미지원** | glowmate의 "가격 비교 카드"는 `Card`도 `Table`도 없으니 **어차피 처음부터 직접 만들어야 한다** |
| **브랜드 컬러 교체 공식 경로 부재** | 아래 참조 |
| **커스터마이즈 조합이 Experimental** | seed 컴포넌트 + Tailwind 오버라이드는 cascade layers에 의존하고, 그 기능이 공식 Experimental 표기 |

**브랜드 컬러 교체 — 공식 경로 확인 불가.** 공식 테마 문서(https://seed-design.io/react/getting-started/styling/theming)는 내용 전체가 `data-seed-color-mode` / `data-seed-user-color-scheme` 기반의 **라이트/다크 전환**이다. 토큰 **값** 자체를 바꾸는 방법, 커스텀 브랜드 컬러, 커스텀 테마 생성에 관한 문서는 발견되지 않았다 (전체 문서 대상 "커스텀 테마", "토큰 값을 변경", "덮어쓰기", "재정의", "브랜드 컬러" grep 0건). 문서화된 스타일 변경 경로는 ① Tailwind 오버라이드(Experimental cascade layer), ② CLI 스니펫 소스 직접 수정 두 가지뿐이다.

CSS 변수를 직접 재정의(`:root { --seed-color-palette-carrot-500: ... }`)하면 기술적으로 가능할 것으로 **추정**되나, **공식 지원 경로가 아니고 SemVer 보장 대상도 아니다** — 문서는 `@seed-design/css/vars/component/*` 경로(typography 제외)가 SemVer 보장 밖이라고 명시한다. **실측 검증하지 않았으므로 확인 불가로 남긴다.**

> 조건 ③ 판정: **❌ 미충족.** 데스크톱에서 "돌아가긴 한다"는 충족하나, glowmate의 정보 밀도형 웹 화면을 **커버**하지는 못한다.

---

## 5. 토큰 추출 경로 — **현실적이다. 그런데 W3C DTCG → Style Dictionary 경로는 불필요하다**

### 5.1 토큰이 배포되는 형식 — DTCG JSON이 아니라 Rootage YAML

`@seed-design/rootage-artifacts@2.3.0` tarball 실측 파일 목록:

```
collections.yaml  color.yaml  dimension.yaml  duration.yaml  font-size.yaml
font-weight.yaml  gradient.yaml  line-height.yaml  radius.yaml  scale.yaml
shadow.yaml  timing-function.yaml
components/*.yaml   (컴포넌트별 토큰, 100+개)
__generated__/
```

실제 포맷 (`color.yaml`, `radius.yaml` 실측):

```yaml
kind: Tokens
metadata:
  id: color
  name: Color
  lastUpdated: 26-06-15
data:
  collection: color
  tokens:
    $color.palette.gray-00:
      values:
        theme-light: "#ffffff"
        theme-dark: "#000000"
    $color.palette.carrot-500:
      values:
        theme-light: "#ff6f0f"    # (예시 — 실제 값은 파일 참조)
        theme-dark: "..."
```

```yaml
kind: Tokens
metadata: { id: radius, name: Radius }
data:
  collection: global
  tokens:
    $radius.r0_5: { values: { default: 2px } }
    $radius.r1:   { values: { default: 4px } }
    $radius.r2:   { values: { default: 8px } }
    $radius.r3:   { values: { default: 12px } }
```

**이것은 W3C DTCG 포맷이 아니다.** 당근 자체 포맷("Rootage", `kind`/`metadata`/`data` 구조의 Kubernetes 스타일 매니페스트)이다. `$type`/`$value` 같은 DTCG 키가 없다. DTCG로 변환하려면 직접 변환기를 써야 한다 — 매핑 자체는 단순하지만(`values.<mode>` → `$value`, collection → mode set) **공식 DTCG export는 확인되지 않았다.**

관련 도구: `ecosystem/rootage`(변환 엔진), `ecosystem/figma-extractor`(`@seed-design/figma-extractor@1.1.3`), `@seed-design/rootage-core`(npm에 알파만 존재: `0.0.1-alpha-20251112125806`, 2025-11-12).

### 5.2 세 가지 추출 경로 비교

| 경로 | 방법 | 난이도 | 평가 |
|---|---|---|---|
| **A. Tailwind theme 직접 사용** | `@import "@seed-design/tailwind4-theme"` + `@seed-design/css` | **매우 낮음 (2줄)** | ✅ **권장** |
| **B. CSS 변수 직접 파싱** | `@seed-design/css/base.css`에서 `--seed-*` 추출 → 자체 theme 생성 | 낮음 | ✅ 브랜드 값 교체 시 유용 |
| **C. Rootage YAML → DTCG → Style Dictionary → Tailwind** | 커스텀 변환기 작성 필요 | 중간 | ⚠️ **불필요한 우회** |

**질문에 대한 직답:** 요청받은 "W3C DTCG JSON → Style Dictionary → Tailwind theme" 경로는 **현실적으로 가능하지만, 실행할 이유가 없다.**

이유: 그 파이프라인의 **최종 산출물이 이미 npm에 배포돼 있기 때문이다.** `@seed-design/tailwind4-theme@2.3.0`은 파일이 `index.css` 하나이고 내용이 통째로 Tailwind `@theme` 매핑이다. Style Dictionary가 만들어줄 결과물을 당근이 이미 만들어 배포한다.

**권장 경로 (A+B 혼합):**

```
@seed-design/css (CSS 변수 정의)
  └─ @seed-design/tailwind4-theme (@theme 매핑)  → Tailwind 유틸리티로 즉시 사용
       └─ glowmate 자체 브랜드 오버라이드 (:root에서 carrot 계열만 교체)
```

- ✅ 런타임 의존성 0, 빌드 플러그인 0
- ✅ SEED의 시맨틱 토큰 **구조**(`fg`/`bg`/`stroke` × `brand`/`critical`/`positive`/`neutral` × `solid`/`weak`/`pressed`)를 그대로 획득 — 이게 실질 가치의 대부분
- ✅ 다크 모드 값이 토큰에 이미 쌍으로 정의돼 있음 (`theme-light`/`theme-dark`)
- ⚠️ 브랜드 컬러(carrot)는 **반드시 교체** — [§1.1](#11-라이선스--apache-20-상업적-사용-가능) 상표 리스크 + glowmate 자체 아이덴티티
- ⚠️ Rootage YAML을 소스 오브 트루스로 삼으려면 DTCG 변환기를 직접 작성해야 함. **초기에는 불필요하다** — 나중에 자체 토큰 파이프라인이 필요해지면 그때 도입

> **조건: 토큰만 뽑아 쓰는 경로는 매우 현실적이다.** 오히려 이번 실사에서 확인된 seed-design의 최대 강점이 토큰 레이어다.

---

## 6. Pretendard 폰트

### 6.1 라이선스 — SIL OFL 1.1, 상업적 사용 가능

- 원문: https://github.com/orioncactus/pretendard/blob/main/LICENSE
- npm 메타데이터: `"license": "OFL-1.1"`
- ⚠️ GitHub API의 `license` 필드는 `NOASSERTION`으로 나온다 (파일 상단에 4개 저작권 헤더가 붙어 자동 감지 실패). **본문은 OFL 1.1 전문이 맞다.**

**Reserved Font Name 4개 선언:**

```
Copyright (c) 2021, Kil Hyung-jin, with Reserved Font Name 'Pretendard'.
Copyright 2014-2021 Adobe, with Reserved Font Name 'Source'.
Copyright (c) 2016 The Inter Project Authors, with Reserved Font Name 'Inter'.
Copyright 2021 The M+ FONTS Project Authors, with Reserved Font Name 'M PLUS 1'.
```

핵심 조항:
- 허용: *"use, study, copy, merge, **embed**, **modify**, redistribute, and **sell** modified and unmodified copies"*
- 금지: *"may not be **sold by itself**"* — 폰트 자체를 파는 것만 금지
- 비전염: *"The requirement for fonts to remain under this license does not apply to any **document created using** the Font Software."* → 웹서비스 코드/콘텐츠에 전염되지 않음

공식 README 요약: *"글꼴 단독 판매를 제외한 모든 상업적 행위 및 수정, 재배포가 가능합니다."*

> ✅ **glowmate 상업적 사용 문제없음.** 폰트 파일 재배포 시 저작권/라이선스 고지 동봉만 지키면 된다.

### 6.2 Subsetting 가능 여부 — 가능하지만 직접 하지 말 것

SIL 공식 OFL FAQ (https://openfontlicense.org/ofl-faq/):

- **2.6**: *"Is subsetting a webfont considered modification? **Yes.** (…) **This is permitted by the OFL but would not normally allow the use of RFNs.**"*
- **2.7**: 최적화가 "Functional Equivalence"를 보존하면 RFN 유지 가능하나 *"technically very difficult and often impractical"*

**해석:** 직접 서브셋을 만들면 엄밀히 Modified Version이므로 `font-family` 이름을 `Pretendard`가 아닌 다른 이름으로 바꿔야 안전하다.

**하지만 그럴 필요가 없다** — 저작권자 본인이 서브셋·다이나믹 서브셋을 `Pretendard` 이름 그대로 공식 배포하고 있으므로, **공식 배포본을 그대로 쓰면 Original Version 사용에 해당해 RFN 이슈가 발생하지 않는다.**

> ✅ **권고: 자체 서브셋팅 금지. 공식 다이나믹 서브셋을 사용할 것.**

### 6.3 배포 방식 — 실측

**npm:**

| 패키지 | 최신 | 배포일 | 내용 |
|---|---|---|---|
| `pretendard` | 1.3.9 | **2023-11-05** | 공식. 1,826 파일 / unpacked **97.7 MB**. 전체 포맷 + 가변 + 서브셋 + 다이나믹 서브셋 |
| `@fontsource/pretendard` | 5.3.0 | 2026-07-19 | 비공식. **가변 폰트 없음** |
| `@fontsource-variable/pretendard` | — | — | **존재하지 않음** (404) |

> ⚠️ **`@fontsource/pretendard` 함정 (실측 확인):** `metadata.json`에 `"subsets": ["latin"]`, 파일명도 `pretendard-latin-400-normal.woff2`지만 **실제로는 한글 포함 풀 폰트**다. SHA-256 대조 결과 공식 CDN의 `Pretendard-Regular.woff2`와 **바이트 단위 동일**:
> ```
> fad853f7f47c6c8b103171e7193fa095708cdcd70850a71d93aa5379e8a61d63  공식 Pretendard-Regular.woff2
> fad853f7f47c6c8b103171e7193fa095708cdcd70850a71d93aa5379e8a61d63  @fontsource .../pretendard-latin-400-normal.woff2
> ```
> weight 하나당 **766 KB**를 로드하며 `unicode.json`이 `{}`로 비어 unicode-range 분할이 전혀 없다. **사용 금지.**

**CDN (공식 문서화, 전부 HTTP 200 실측):** `https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/...`

| CSS | 크기 | @font-face | unicode-range |
|---|---|---|---|
| `static/pretendard.min.css` | 2,966 B | 9 | 0 |
| `static/pretendard-dynamic-subset.min.css` | 553,677 B | 828 | 828 |
| `variable/pretendardvariable.min.css` | 588 B | 1 | 0 |
| **`variable/pretendardvariable-dynamic-subset.min.css`** | **53,513 B** | **92** | **92** |

대체 CDN도 공식 문서화됨: cdnjs (`{"name":"pretendard","version":"1.3.9","license":"OFL-1.1"}`, 200 OK), UNPKG.

**파일 크기 실측 (CDN 직접 다운로드한 바이트):**

| 파일 | 바이트 | ≈ |
|---|---|---|
| `PretendardVariable.woff2` (풀 가변) | 2,057,688 | **1.96 MB** |
| 가변 다이나믹 서브셋 chunk 1개 | 33,228~34,568 | **약 33 KB** |
| `Pretendard-Regular.woff2` (풀 static) | 765,892 | 748 KB |
| static 다이나믹 서브셋 chunk 1개 | 12,016 | 12 KB |

→ 풀 가변 1.96 MB vs 서브셋 chunk 33 KB. 한국어 UI 한 페이지는 보통 chunk 몇 개만 받으므로 **약 60배 절감.**

### 6.4 next/font 호환성

**`next/font/google` → ❌ 불가. Pretendard는 Google Fonts에 없다 (확정).**

3중 검증:
1. `https://fonts.google.com/metadata/fonts` — 1,942개 패밀리 중 "pretendard" **0건**
2. `https://fonts.googleapis.com/css2?family=Pretendard` → **HTTP 400**
3. 대조군 `?family=Roboto` → HTTP 200

**`next/font/local` → ✅ 공식 README에 명시적으로 문서화됨** (https://github.com/orioncactus/pretendard/blob/main/packages/pretendard/README.md):

```ts
import localFont from 'next/font/local'

const pretendard = localFont({
  src: './fonts/PretendardVariable.woff2',
  display: 'swap',
  weight: '45 920',   // 미지정 시 WebKit에서 굵기 오렌더링
})
```

가변 축 범위 **45–920** (CSS `font-weight: 45 920`으로 교차 확인).

> ⚠️ **트레이드오프:** `next/font/local`은 파일 하나를 통째로 self-host하므로 **1.96 MB 단일 다운로드**가 되고 다이나믹 서브셋의 unicode-range 이점을 못 쓴다. glowmate는 SEO/LCP가 중요하므로 이 선택은 신중해야 한다.

**권장:** 92개 가변 서브셋 chunk를 `public/`에 self-host하고 `pretendardvariable-dynamic-subset.css`의 경로만 재작성. 용량 이점 + 외부 도메인 의존 제거. **폰트 파일 자체는 무수정이므로 RFN 문제도 없다.**

참고로 당근 docs 앱은 현재 jsDelivr CDN을 직접 쓰면서 코드 주석에 이렇게 적어두었다 (`docs/app/layout.tsx` 실측):

```
/* Pretendard (dynamic-subset variable weight 100–900). Rebrand PoC font,
   served from jsDelivr for now — self-host before daangn/prod. */
```

**당근조차 프로덕션 전에 self-host하겠다고 적어놨다.** glowmate는 처음부터 self-host로 가는 게 맞다.

### 6.5 seed-design은 Pretendard를 지정하지도, 번들하지도 않는다

npm tarball 직접 grep 실측:

| 패키지 | `font-family` 선언 | "pretendard" 문자열 |
|---|---|---|
| `@seed-design/css@2.3.0` | **`inherit`만** (reset용) | **0건** |
| `@seed-design/react@2.1.0` | 없음 | **0건** |
| `@seed-design/stylesheet@1.1.2` | 없음 | 0건 |
| `@seed-design/design-token@1.0.5` | 없음 | 0건 |

타이포그래피 토큰은 **font-size / font-weight / line-height / letter-spacing만** 정의한다.

> **seed-design은 서체를 소비 애플리케이션에 완전히 위임한다.** seed-design 도입이 Pretendard를 강제하지도, 제공하지도 않는다. **폰트는 별개 결정이며, 옵션 A/B 어느 쪽을 택하든 동일하게 직접 설정해야 한다.**

### 6.6 확인 불가 / 리스크

- 최신 릴리스는 `v1.3.9` (2023-11-05). 레포 마지막 push는 2026-07-23이지만 **약 2년 9개월간 새 폰트 릴리스 없음.** 안정적이라 볼 수도, 정체됐다 볼 수도 있음
- 저작권자가 서드파티 서브셋에 RFN 사용을 서면 허가한 사례 — 근거 없음

---

## 7. 대안 비교 — shadcn/ui (Radix + Tailwind)

### 7.1 중요한 전제: seed-design v2는 **이미 shadcn 모델이다**

실사 중 확인된 사실 — SEED의 공식 설치 워크플로우가 shadcn과 동일하다 (https://seed-design.io/react/getting-started/installation/manual):

```bash
npm install @seed-design/react @seed-design/css
npx @seed-design/cli@latest init          # seed-design.json 생성 (rsc/tsx/framework 질문)
npx @seed-design/cli@latest add ui:action-button   # 소스가 내 프로젝트로 복사됨
```

`docs/registry/react/ui/`에 **59개 `.tsx` 스니펫**이 있고 CLI가 이를 프로젝트로 복사한다 (실측):

```
accordion.tsx  action-button.tsx  action-sheet.tsx  alert-dialog.tsx  app-bar.tsx
app-screen.tsx  attachment-*.tsx  avatar.tsx  bottom-sheet.tsx  callout.tsx  checkbox.tsx
chip-tabs.tsx  chip.tsx  ...  side-navigation.tsx  side-panel.tsx  slider.tsx
snackbar.tsx  swipeable-menu-sheet.tsx  switch.tsx  tabs.tsx  tag-group.tsx
text-field.tsx  toggle-button.tsx
```

**즉 "옵션 B = 블랙박스 라이브러리 채택"이라는 전제가 틀렸다.** seed-design도 소스를 소유하게 해준다. 두 옵션의 차이는 "소유 여부"가 아니라 **"어느 카탈로그에서 출발하느냐"**다.

### 7.2 비교표

| 축 | seed-design (옵션 B) | shadcn/ui (옵션 A의 컴포넌트 레이어) |
|---|---|---|
| 라이선스 | Apache-2.0 (+브랜드 제한) | MIT |
| 배포 모델 | CLI 스니펫 복사 (**동일**) | CLI 스니펫 복사 |
| 접근성 기반 | 자체 headless + **Radix 일부 사용** (`@radix-ui/react-slot`, `react-compose-refs`, `react-use-controllable-state` 실측) | Radix UI 전면 |
| 스타일링 | 순수 CSS + CSS 변수 (`.seed-*` 클래스) | **Tailwind 유틸리티 인라인** |
| 커스터마이즈 자유도 | 중간 — 스니펫은 수정 가능하나 스타일이 `@seed-design/css` 레시피 클래스에 묶임. Tailwind 오버라이드는 cascade layer 순서 제어 필요(**Experimental**) | **높음** — 클래스가 JSX에 인라인. 바로 고침 |
| 카탈로그 방향 | **모바일 커머스 앱** | **데스크톱/반응형 웹** |
| Table / Pagination / Breadcrumb / Card | ❌ 전무 | ✅ 전부 있음 |
| 정보 밀도형 컴포넌트 | ❌ | ✅ Table, Data Table(TanStack), Card, HoverCard |
| Next.js App Router 공식 지원 | 가이드 없음 (동작은 실증됨) | ✅ 공식 1급 지원 |
| 폼 | 개별 필드만 | ✅ react-hook-form + zod 통합 |
| 다크모드 | ✅ 토큰에 light/dark 쌍 내장 | ✅ next-themes |
| 한국어 UX 적합성 | ✅ **한국어 서비스 기준으로 설계·검증됨** | ⚠️ 서구권 기준 |
| 토큰 체계 | ✅ **매우 우수** (시맨틱 3층 구조) | ⚠️ 얕음 (`--background`/`--foreground` 수준) |
| 디자인 완성도 | ✅ 실서비스 검증된 고품질 | 중립적 기본값 (직접 다듬어야 함) |

### 7.3 glowmate 판단축: 커스터마이즈 자유도

**"가격 비교 카드"처럼 정보 밀도 높은 커스텀 컴포넌트가 시그니처**라는 전제에서:

- seed-design에는 `Card`도 `Table`도 없다 → **어느 쪽을 택해도 직접 만든다.** 여기서는 두 옵션이 동률
- 차이는 **주변 컴포넌트**에서 갈린다. 목록/필터/페이지네이션/브레드크럼/상세 테이블 — shadcn은 있고 seed는 없다
- 그리고 **커스텀 컴포넌트를 만들 때의 마찰**에서 갈린다:
  - shadcn: 토큰이 Tailwind 유틸리티로 노출 → `className="bg-brand-solid text-fg-brand-contrast"` 로 자유 조합
  - seed 컴포넌트: `.seed-action-button` 같은 레시피 클래스가 이미 스타일을 잡고 있어, 커스텀하려면 cascade layer 순서를 제어해 Tailwind가 이기게 만들어야 함 → **Experimental 영역**

> **결정적 관찰:** seed-design의 **토큰**은 shadcn의 토큰보다 명백히 우수하고, seed-design의 **컴포넌트 카탈로그**는 glowmate 용도에서 shadcn보다 명백히 부족하다. **두 레이어를 분리해 각각 최선을 취하는 것이 지배 전략(dominant strategy)이다.**

---

## 8. 최종 권고와 이유

### 게이트 G5 판정

| 조건 | 판정 | 근거 URL |
|---|---|---|
| **① Next.js App Router SSR 동작** | **✅ 충족** | seed-design.io 자체가 Next.js 16 App Router + React 19: [docs/package.json](https://raw.githubusercontent.com/daangn/seed-design/dev/docs/package.json) · [docs/app/layout.tsx](https://raw.githubusercontent.com/daangn/seed-design/dev/docs/app/layout.tsx). `"use client"` 226/251 파일로 RSC 경계 선언. CSS는 정적 파일이라 빌드 추출 단계 없음 |
| **② 라이선스 상업적 사용 허용** | **✅ 충족** | Apache-2.0: [LICENSE](https://github.com/daangn/seed-design/blob/dev/LICENSE) · [NOTICE](https://raw.githubusercontent.com/daangn/seed-design/dev/NOTICE) "상업적 목적을 포함하여 자유롭게 사용, 수정, 재배포할 수 있습니다". 로고·상호명·캐릭터만 제외 |
| **③ 데스크톱 웹 커버 충분** | **❌ 미충족** | 반응형 인프라는 존재([breakpoints lg 1280/xl 1440](https://seed-design.io/react/components/concepts/responsive-design), [Foundations Layout](https://seed-design.io/foundations/layout))하나, `@seed-design/react@2.1.0` tarball 실측 결과 **Table·Pagination·Breadcrumb·Card·Combobox 전무**. 86개 중 11개가 모바일 앱 전용 + 당근 도메인 종속(`MannerTemp`) |

### ▶ 판정: **옵션 A — seed-design 토큰만 추출 + shadcn/ui로 컴포넌트 소유**

게이트 규칙("3가지 모두 충족될 때만 옵션 B")에 따라 ③ 미충족으로 **옵션 A**.

### 이유

1. **컴포넌트 카탈로그의 방향이 glowmate와 어긋난다.** SEED는 모바일 커머스 앱을 위해 최적화된 카탈로그다. glowmate가 가장 필요로 하는 Table/Card/Pagination/Breadcrumb이 하나도 없는 반면, 절대 안 쓸 BottomSheet/PullToRefresh/FAB/SwipeableMenuSheet/MannerTemp가 카탈로그의 상당 부분을 차지한다. **이건 품질 문제가 아니라 적합성 문제다.**

2. **시그니처 컴포넌트는 어차피 직접 만든다.** "가격 비교 카드"는 어느 쪽에도 없다. 그렇다면 **커스텀 작성 마찰이 낮은 쪽**이 유리하고, 그건 Tailwind 유틸리티가 JSX에 인라인되는 shadcn이다. seed 컴포넌트를 커스터마이즈하려면 cascade layer 순서 제어(공식 **Experimental** 표기)에 의존해야 한다.

3. **브랜드 독립성.** SEED의 브랜드 컬러는 `carrot`(당근 오렌지)이고, 토큰 값 교체의 공식 경로는 문서화되어 있지 않다(확인 불가). glowmate가 당근 오렌지를 그대로 쓰는 것은 아이덴티티 측면에서도, NOTICE의 "당근과 관련 있는 것처럼 오인하게 하는 사용" 조항 측면에서도 바람직하지 않다.

4. **반면 토큰 레이어는 채택 비용이 사실상 0이고 가치가 크다.** `@seed-design/css` + `@seed-design/tailwind4-theme` 두 패키지 모두 **런타임 의존성 0, 빌드 플러그인 불필요**, CSS/`@theme` import 2줄이면 끝난다. 얻는 것은 **한국어 서비스에서 실전 검증된 시맨틱 토큰 3층 구조**(`fg`/`bg`/`stroke` × 의미 × 강도)와 **light/dark 쌍이 완비된 팔레트**로, shadcn 기본 토큰보다 훨씬 정교하다.

5. **Style Dictionary 파이프라인은 불필요하다.** 요청받은 DTCG→Style Dictionary 경로는 가능하지만, 그 **결과물이 이미 `@seed-design/tailwind4-theme`로 배포돼 있다.** 초기에 파이프라인을 세우는 것은 순수한 오버엔지니어링이다. 자체 토큰 소스가 필요해지는 시점에 Rootage YAML → DTCG 변환기를 도입하면 된다.

6. **리스크가 낮다.** 옵션 A는 seed-design 의존을 CSS 파일 2개로 국한한다. 나중에 브랜드가 성숙해 자체 토큰으로 갈아타더라도, CSS 변수 이름만 유지하면 교체 비용이 거의 없다. 반대로 옵션 B는 86개 컴포넌트의 API·업그레이드 정책·모바일 지향 로드맵에 프로젝트를 묶는다.

### 옵션 B를 재검토해야 할 조건

다음 중 하나라도 참이 되면 판정을 뒤집을 가치가 있다:

- glowmate가 데스크톱보다 **모바일 웹뷰 중심**으로 방향을 틀 경우 → SEED 카탈로그 적합도가 급상승
- SEED가 **Table/Pagination/Card**를 추가할 경우 (활성도가 매우 높으므로 가능성 있음 — 최근 52주 커밋 1,104건)
- SEED가 **커스텀 테마/브랜드 컬러 교체 공식 경로**를 문서화할 경우
- cascade layers가 **Experimental 딱지를 뗄 경우**

---

## 9. 권고 구성

### 9.1 채택 / 미채택

| 레이어 | 결정 | 패키지 |
|---|---|---|
| 디자인 토큰 | ✅ **채택** | `@seed-design/css@^2.3.0`, `@seed-design/tailwind4-theme@^2.3.0` |
| React 컴포넌트 | ❌ 미채택 | ~~`@seed-design/react`~~ |
| 컴포넌트 레이어 | ✅ **shadcn/ui** (Radix + Tailwind v4) | — |
| 폰트 | ✅ **Pretendard** self-host (가변 다이나믹 서브셋) | 공식 `pretendard@1.3.9` 배포본 |
| 브랜드 컬러 | ⚠️ **carrot 교체 필수** | glowmate 자체 팔레트 |
| Style Dictionary | ❌ 도입 보류 | 필요해지면 그때 |

### 9.2 구현 스케치 (당근 docs 앱에서 실증된 패턴 기반)

`app/layer-order.css`:
```css
@layer theme, base, seed-base, components, seed-components, utilities;
```

`app/globals.css`:
```css
@import "tailwindcss";
@import "@seed-design/tailwind4-theme";

/* glowmate 브랜드 오버라이드 — carrot 대체 */
:root {
  --seed-color-palette-carrot-500: <glowmate-brand-500>;
  /* … 브랜드 계열 전체 */
}
```

`app/layout.tsx`:
```tsx
import "./layer-order.css";
import "@seed-design/css/base.layered.min.css";  // 55.4 KB (all.css 366 KB 대신)
import "./globals.css";
```

`next.config.ts`:
```ts
// @seed-design/react를 안 쓰므로 transpilePackages 불필요
// layered CSS를 쓸 경우에만 Turbopack resolveAlias 워크어라운드 검토
```

**옵션 A에서는 §3.5의 마찰 3가지가 대부분 소멸한다** — `transpilePackages`는 `@seed-design/react`를 안 쓰므로 불필요하고, Turbopack condition 문제는 recipes CSS를 안 쓰면 발생하지 않는다.

### 9.3 후속 확인 필요 (이번 실사에서 확인 불가)

1. **CSS 변수 직접 재정의로 브랜드 컬러 교체가 실제로 깨끗하게 동작하는지** — 공식 경로가 없으므로 PoC로 실증 필요 (`base.css`만 쓰는 경우 위험도는 낮을 것으로 추정)
2. **`base.layered.min.css`(55.4 KB)만으로 토큰이 충분한지** — 컴포넌트 레시피 없이 `--seed-*` 변수 전량이 포함되는지 실측 필요
3. 당근 브랜드 리소스 가이드라인 원문 (Notion 링크만 제공됨)
4. Rootage YAML → DTCG 변환기 필요 시점 및 공식 DTCG export 계획 유무

---

## 부록 — 검증 방법

- GitHub REST API: `/repos/daangn/seed-design`, `/license`, `/commits`, `/stats/participation`, `/contents/*`, `/search/issues`
- npm registry API: `/-/v1/search`, 개별 패키지 메타데이터, `api.npmjs.org/downloads/point/last-month`
- **npm tarball 직접 다운로드 후 압축 해제하여 파일 내용 실측** — `@seed-design/css@2.3.0`, `@seed-design/react@2.1.0`, `@seed-design/tailwind4-theme@2.3.0`, `@seed-design/rootage-artifacts@2.3.0`
- `raw.githubusercontent.com`으로 소스 파일 원문 취득 (NOTICE, docs/package.json, docs/app/layout.tsx, docs/next.config.mjs, docs/app/layer-order.css, docs/app/global.css)
- 공식 문서는 `seed-design.io/llms.txt` / `llms-full.txt` 원문 대조 (렌더링 페이지 대신 마크다운 소스)
- Pretendard: CDN 파일 직접 다운로드 후 바이트 실측, SHA-256 대조, Google Fonts 카탈로그 API 조회

**실사 기준일: 2026-08-02 ~ 08-03.** 저장소 활성도가 매우 높으므로(주당 최대 48커밋) 수 주 내 사실관계가 바뀔 수 있다. 특히 컴포넌트 카탈로그 확장 여부는 재확인 가치가 있다.
