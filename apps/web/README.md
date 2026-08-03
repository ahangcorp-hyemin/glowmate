# @glowmate/web

Next.js 15 App Router 앱. F1-REPO-SCAFFOLD 의 REQ-2 · REQ-8 · FORBID-3 을 담당한다.

## 라우트 구성

| 라우트 | 파일 | `next build` 판정 | 근거 |
|---|---|---|---|
| `/` | `src/app/page.tsx` | `○ Static` | 요청 시점 API·캐시 해제 옵션 없음 |
| `/venues` | `src/app/venues/page.tsx` | `○ Static` | 목록이 빌드 시점 상수 |
| `/venues/[slug]` | `src/app/venues/[slug]/page.tsx` | `● SSG` + `revalidate 1h` (ISR) | `generateStaticParams` 로 전 slug 프리렌더 |
| `GET /api/health` | `src/app/api/health/route.ts` | `ƒ Dynamic` | Route Handler — FORBID-3 대상 아님 |

REQ-8 은 "Static 또는 ISR 페이지 라우트 ≥ 2" 를 요구한다. 위 표에서 페이지 라우트 중
동적(`ƒ`)은 0건이고, `ƒ` 는 Route Handler 하나뿐이다 — 이 상태가 곧 F1 done_when 의
"Route Handler 가 동적이어도 test job 이 green" 을 검증하는 표본이다.

## 페이지 라우트에 두지 않는 것 (FORBID-3)

`src/app` 하위의 `page.tsx` 와 세그먼트 레이아웃에는 아래 5개를 선언하지 않는다.

- `dynamic = 'force-dynamic'`
- `revalidate = 0`
- `unstable_noStore()`
- `fetchCache = 'force-no-store'`
- `fetch(..., { cache: 'no-store' })`

채널 1순위가 SEO 이고 W1·W4 의 대량 정적 생성이 이 기본값 위에 서 있다. 양수 `revalidate`
(예: `/venues/[slug]` 의 `3600`)는 ISR 이므로 금지 대상이 아니다 — 금지되는 것은 `0` 이다.

Route Handler(`src/app/api` 하위) · Server Action · middleware 는 정의상 동적이며 규칙 대상이 아니다.

## 데이터

`src/lib/venues.ts` 의 로컬 상수 배열이다. apps/web 은 REQ-3 의 DB 접근 제외 집합
(`packages/api` · `packages/db`) **밖**이므로 `packages/db` 나 Postgres 와이어 드라이버를
import 하면 boundary job 이 exit 1 이다. 실데이터 연결은 F5 · W1 소관이다.

## 스크립트

| 명령 | 내용 |
|---|---|
| `pnpm --filter @glowmate/web build` | `next build` |
| `pnpm --filter @glowmate/web typecheck` | `tsc --noEmit` (base 의 strict 3플래그 상속) |
| `pnpm --filter @glowmate/web test` | `node --test src/lib/venues.test.ts` |
