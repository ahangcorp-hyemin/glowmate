// tools/ci-meta/lib/next-summary.mjs
//
// `next build` 라우트 요약 파싱 + 페이지 라우트 판정의 **순수 부분**.
// 진입점(`next-routes.mjs`)에서 분리한 이유: selftest 가 import 해도 검사기가 실행되지 않아야 한다.

import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

export const APP_DIR = 'apps/web/src/app';
export const API_PREFIX = '/api';
export const MIN_STATIC_PAGE_ROUTES = 2;

/** Next.js 라우트 요약 마커 */
export const MARKERS = {
  '○': { kind: 'static', label: 'Static' },
  '●': { kind: 'static', label: 'SSG/ISR' },
  'ƒ': { kind: 'dynamic', label: 'Dynamic' },
  'λ': { kind: 'dynamic', label: 'Dynamic(λ)' },
  Λ: { kind: 'dynamic', label: 'Dynamic(Λ)' },
};

/** 계약에 분류 규정이 없는 마커 (PPR 등) — 임의 판정하지 않고 실패시킨다. */
export const UNCLASSIFIED_MARKERS = ['◐'];

/** Next.js 내부 생성 라우트 — 저자가 만든 페이지가 아니므로 ≥2 카운트에서 제외한다. */
export const INTERNAL_ROUTES = new Set([
  '/_not-found',
  '/_error',
  '/_app',
  '/_document',
  '/404',
  '/500',
]);

// ANSI 이스케이프 제거. 정규식 리터럴에 ESC 제어문자를 직접 넣으면 eslint no-control-regex 에 걸리고,
// 그 규칙을 disable 하는 것은 FORBID-2 대상이다. 그래서 문자 코드로 조립한다.
const ANSI_RE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*[A-Za-z]`, 'g');
const ALL_MARKERS = [...Object.keys(MARKERS), ...UNCLASSIFIED_MARKERS].join('');
// 라우트 경로는 반드시 `/` 로 시작해야 한다 —
// 범례 줄(`○  (Static) …`)과 `ƒ Middleware` 를 라우트로 오인하지 않기 위한 조건이다.
const ROUTE_LINE_RE = new RegExp(`^[\\s│├└┌─+]*([${ALL_MARKERS}])\\s+(/\\S*)`, 'u');
const SUMMARY_HEADER_RE = /^\s*Route\s*\((app|pages)\)/;

/** FORBID-3 이 지정한 5개 토큰 (페이지 라우트 파일 한정) */
export const DYNAMIC_TOKENS = [
  { id: "dynamic='force-dynamic'", re: /\bdynamic\s*=\s*['"`]force-dynamic['"`]/ },
  { id: 'revalidate=0', re: /\brevalidate\s*=\s*0(?!\d)/ },
  { id: 'unstable_noStore', re: /\bunstable_noStore\b/ },
  { id: "fetchCache='force-no-store'", re: /\bfetchCache\s*=\s*['"`]force-no-store['"`]/ },
  { id: "cache:'no-store'", re: /\bcache\s*:\s*['"`]no-store['"`]/ },
];

/**
 * `next build` 요약에서 라우트를 뽑는다.
 * @returns {{headerFound:boolean, routes:Array<{marker,kind,label,route}>, unknown:Array<{marker,route}>}}
 */
export function parseBuildSummary(text) {
  const lines = String(text).replace(ANSI_RE, '').split('\n');
  const routes = [];
  const unknown = [];
  let headerFound = false;
  const seen = new Set();

  for (const line of lines) {
    if (SUMMARY_HEADER_RE.test(line)) {
      headerFound = true;
      continue;
    }
    const m = ROUTE_LINE_RE.exec(line);
    if (!m) continue;
    const [, marker, route] = m;
    const meta = MARKERS[marker];
    if (!meta) {
      unknown.push({ marker, route });
      continue;
    }
    const key = `${marker} ${route}`;
    if (seen.has(key)) continue;
    seen.add(key);
    routes.push({ marker, kind: meta.kind, label: meta.label, route });
  }
  return { headerFound, routes, unknown };
}

export function isApiRoute(route) {
  return route === API_PREFIX || route.startsWith(`${API_PREFIX}/`);
}

export function isInternalRoute(route) {
  return INTERNAL_ROUTES.has(route);
}

function walkFiles(dir, base = '') {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const abs = path.join(dir, entry);
    const rel = base ? `${base}/${entry}` : entry;
    if (statSync(abs).isDirectory()) out.push(...walkFiles(abs, rel));
    else out.push(rel);
  }
  return out;
}

/**
 * 2차 수단 대상: `apps/web/src/app/**` 의 `page.tsx` 와 **그 세그먼트 레이아웃**(`layout.tsx`).
 * 제외: `apps/web/src/app/api/**` (Route Handler — 정의상 동적이므로 FORBID-3 대상이 아니다).
 */
export function pageRouteFiles(root) {
  const dir = path.join(root, APP_DIR);
  if (!existsSync(dir)) return { ok: false, files: [] };
  const files = walkFiles(dir)
    .filter((f) => /(^|\/)(page|layout)\.(tsx|ts|jsx|js|mjs)$/.test(f))
    .filter((f) => !(f === 'api' || f.startsWith('api/')))
    .map((f) => `${APP_DIR}/${f}`)
    .sort();
  return { ok: true, files };
}

/** 주석 줄은 선언이 아니다 (위반 재현 설명 주석을 오탐하지 않기 위함). */
export function isCommentLine(line) {
  return /^\s*(\/\/|\*|\/\*)/.test(line);
}
