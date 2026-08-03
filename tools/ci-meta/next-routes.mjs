#!/usr/bin/env node
// tools/ci-meta/next-routes.mjs — CI job `test` (`pnpm test:routes`)
//
// REQ-8    apps/web 의 Static/ISR **페이지 라우트**가 2개 이상. 라우트 0개 자동 통과 방지.
// FORBID-3 페이지 라우트의 렌더링 기본값을 동적으로 전환하는 것을 차단.
//          1차 수단: `next build` 요약에서 페이지 라우트만 필터해 동적 항목 0건 + Static/ISR ≥ 2
//          2차 수단: 페이지 라우트 파일에 한정한 5개 토큰 grep
//          → 둘 중 하나라도 실패하면 exit 1.
//
// 계약이 대상에서 제외한 것 (FORBID-3 when 괄호):
//   Route Handler `apps/web/src/app/api/**` · Server Action · middleware 는 **정의상 동적**이라 위반이 아니다.
//   `/api/health` 가 `ƒ` 로 찍히는 것을 위반으로 잡으면 F1 자기 PR 이 red 가 된다.
//
// 입력: 인자로 받은 `next build` 로그 파일 경로, 없으면 stdin.
//   pnpm --filter @glowmate/web exec next build | tee /tmp/next-build.log
//   node tools/ci-meta/next-routes.mjs /tmp/next-build.log
//
// 로그를 못 읽거나 요약 섹션을 못 찾으면 **exit 1**.
// 파싱 실패를 통과로 처리하는 것이 여기서 가장 위험한 미탐이다.
//
// 판정의 순수 부분은 `lib/next-summary.mjs` 에 있다 (selftest 가 import 해도 실행되지 않도록 분리).

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Report, repoRoot, fmtSet, guard } from './lib/util.mjs';
import {
  APP_DIR,
  MIN_STATIC_PAGE_ROUTES,
  DYNAMIC_TOKENS,
  parseBuildSummary,
  isApiRoute,
  isInternalRoute,
  pageRouteFiles,
  isCommentLine,
} from './lib/next-summary.mjs';

const REQ = 'REQ-8';
const FORBID = 'FORBID-3';

/* ── 입력 ────────────────────────────────────────────────────────────────── */

function loadBuildLog(arg) {
  if (arg && arg !== '-') {
    if (!existsSync(arg)) return { ok: false, reason: `next build 로그 파일이 없다: ${arg}` };
    try {
      return { ok: true, text: readFileSync(arg, 'utf8'), source: arg };
    } catch (err) {
      return { ok: false, reason: `로그 파일을 읽을 수 없다 (${arg}): ${err.message}` };
    }
  }
  let text = null;
  try {
    text = readFileSync(0, 'utf8');
  } catch {
    text = null;
  }
  if (text == null || text.trim() === '') {
    return {
      ok: false,
      reason: 'stdin 으로 들어온 next build 로그가 비어 있다 (인자로 로그 파일 경로를 주거나 파이프로 연결하라)',
    };
  }
  return { ok: true, text, source: '<stdin>' };
}

/* ── 실행 ────────────────────────────────────────────────────────────────── */

const report = new Report(`next-routes (${REQ} · ${FORBID})`);
const root = repoRoot();

// ── 1차 수단 — next build 요약 파싱 ───────────────────────────────────────
await guard(report, FORBID, '1차 수단 (next build 요약)', async () => {
  const loaded = loadBuildLog(process.argv[2]);
  if (!loaded.ok) {
    report.fail(
      FORBID,
      `${REQ}/${FORBID} 1차 수단 — next build 요약을 읽을 수 없다. 파싱 실패를 통과로 처리하지 않는다`,
      loaded.reason,
    );
    return;
  }

  const { headerFound, routes, unknown } = parseBuildSummary(loaded.text);
  report.info(
    FORBID,
    `1차 수단 입력: ${loaded.source} · 요약 헤더 ${headerFound ? '발견' : '미발견'} · 라우트 ${routes.length}건`,
  );

  if (!headerFound && routes.length === 0) {
    report.fail(
      FORBID,
      `${REQ}/${FORBID} 1차 수단 — next build 요약 섹션(\`Route (app)\`)을 찾지 못했다. ` +
        `빌드 로그 형식이 바뀌었거나 빌드가 요약을 출력하기 전에 끝났다. 판정 불가를 통과로 처리하지 않는다`,
    );
    return;
  }
  if (routes.length === 0) {
    report.fail(
      FORBID,
      `${REQ}/${FORBID} 1차 수단 — 요약에서 라우트를 1건도 파싱하지 못했다 (라우트 0개 자동 통과 방지)`,
    );
    return;
  }
  if (unknown.length > 0) {
    report.fail(
      FORBID,
      `${REQ}/${FORBID} 1차 수단 — 계약에 분류 규정이 없는 렌더링 마커가 있다: ` +
        unknown.map((u) => `${u.marker} ${u.route}`).join(', ') +
        ` — Static/ISR 인지 동적인지 임의 판정하지 않는다. 계약 개정이 필요하다`,
    );
    return;
  }

  const pageRoutes = routes.filter((r) => !isApiRoute(r.route));
  const apiRoutes = routes.filter((r) => isApiRoute(r.route));
  if (apiRoutes.length > 0) {
    report.info(
      FORBID,
      `Route Handler ${apiRoutes.length}건 ${fmtSet(apiRoutes.map((r) => `${r.marker}${r.route}`))} — ` +
        `계약상 정의상 동적이므로 대상 제외 (FORBID-3 when 괄호)`,
    );
  }

  // (1) 동적 페이지 라우트 0건
  const dynamicPages = pageRoutes.filter((r) => r.kind === 'dynamic');
  if (dynamicPages.length > 0) {
    report.fail(
      FORBID,
      `${FORBID} 1차 수단 — 동적으로 렌더되는 **페이지 라우트**가 ${dynamicPages.length}건 있다: ` +
        dynamicPages.map((r) => `${r.marker} ${r.route}`).join(', ') +
        ` — 페이지 기본값이 동적이면 W1·W4 의 대량 정적 생성(H3)이 성립하지 않는다`,
    );
  } else {
    report.pass(FORBID, `1차 수단 — 동적 페이지 라우트 0건 (페이지 라우트 ${pageRoutes.length}건 검사)`);
  }

  // (2) Static/ISR 페이지 라우트 ≥ 2 (Next 내부 생성 라우트는 카운트 제외)
  const authored = pageRoutes.filter((r) => !isInternalRoute(r.route));
  const internal = pageRoutes.filter((r) => isInternalRoute(r.route));
  if (internal.length > 0) {
    report.info(
      FORBID,
      `Next 내부 생성 라우트 ${fmtSet(internal.map((r) => `${r.marker}${r.route}`))} — ` +
        `저자가 만든 페이지가 아니므로 ≥${MIN_STATIC_PAGE_ROUTES} 카운트에서 제외 (동적 여부 검사에는 포함)`,
    );
  }
  const staticPages = authored.filter((r) => r.kind === 'static');
  if (staticPages.length < MIN_STATIC_PAGE_ROUTES) {
    report.fail(
      REQ,
      `${REQ} 1차 수단 — Static/ISR 페이지 라우트가 ${staticPages.length}건으로 ${MIN_STATIC_PAGE_ROUTES}건 미만이다 ` +
        `(${fmtSet(staticPages.map((r) => `${r.marker}${r.route}`))}) — ${FORBID} 의 검사가 공허해지지 않도록 정적 라우트 하한을 강제한다`,
    );
  } else {
    report.pass(
      REQ,
      `${REQ} — Static/ISR 페이지 라우트 ${staticPages.length}건 ≥ ${MIN_STATIC_PAGE_ROUTES} ` +
        `${fmtSet(staticPages.map((r) => `${r.marker}${r.route}`))}`,
    );
  }
});

// ── 2차 수단 — 페이지 라우트 파일 토큰 grep ──────────────────────────────
await guard(report, FORBID, '2차 수단 (토큰 grep)', async () => {
  const { ok, files } = pageRouteFiles(root);
  if (!ok) {
    report.fail(FORBID, `${FORBID} 2차 수단 — ${APP_DIR} 가 없어 페이지 라우트 파일을 검사할 수 없다`);
    return;
  }
  if (files.length === 0) {
    report.fail(
      FORBID,
      `${FORBID} 2차 수단 — 검사 대상 페이지 라우트 파일이 0건이다 (${APP_DIR}) — 대상 0건을 통과로 처리하지 않는다`,
    );
    return;
  }

  const hits = [];
  for (const rel of files) {
    const text = readFileSync(path.join(root, rel), 'utf8');
    text.split('\n').forEach((line, i) => {
      if (isCommentLine(line)) return;
      for (const t of DYNAMIC_TOKENS) {
        if (t.re.test(line)) hits.push({ rel, line: i + 1, token: t.id, text: line.trim() });
      }
    });
  }

  if (hits.length > 0) {
    for (const h of hits) {
      report.fail(
        FORBID,
        `${FORBID} 2차 수단 — ${h.rel}:${h.line} 페이지 라우트에 동적 전환 토큰 \`${h.token}\``,
        h.text.slice(0, 200),
      );
    }
  } else {
    report.pass(
      FORBID,
      `2차 수단 — 페이지 라우트 파일 ${files.length}건에서 동적 전환 토큰 ${DYNAMIC_TOKENS.length}종 0건 ` +
        `(${APP_DIR}/api/** 는 Route Handler 이므로 대상 제외)`,
    );
  }
});

process.exit(report.print());
