// tools/ci-meta/selftest.mjs
//
// **판정기 자기검사.** `pnpm test:ci-meta` 실행 시 항상 함께 돈다.
//
// 존재 이유: F1 머지 시점에는 위반이 0건이므로 전 검사가 PASS 로 나온다.
// 그 상태에서는 "검사 로직이 실제로 위반을 잡는가"가 입증되지 않는다 — 감사 f1-gate2 가
// 지적한 체계적 패턴 #2("규칙은 강해졌으나 그 규칙이 작동하는지를 아무도 확인하지 않는다")다.
// 그래서 각 판정 함수를 **합성 위반 입력**에 걸어 반드시 실패로 판정하는지,
// **합성 정상 입력**에 걸어 통과로 판정하는지를 매 실행 검증한다.
// 하나라도 어긋나면 그 자체로 exit 1 이다.
//
// 특히 B-8: `needs:` 만 선언한 순진한 애그리게이터가 R6C-1 에서 실제로 걸리는지를 여기서 못박는다.

import YAML from 'yaml';
import { analyzeEnforcementJob } from './checks/req6-aggregator.mjs';
import { computeRaised } from './checks/forbid5-budget.mjs';
import { isProseFile, isExcludedPath } from './checks/forbid2-masking.mjs';
import { normalizePattern, matchesPattern, ownersForPath } from './lib/codeowners.mjs';
import { evaluateRelaxationWindow, checkIndependentPr } from './lib/maintainer.mjs';
import {
  parseBuildSummary,
  isApiRoute,
  isInternalRoute,
  DYNAMIC_TOKENS,
} from './lib/next-summary.mjs';
import {
  FORBID2_LINE_PATTERNS,
  FORBID2_WORKFLOW_IF_PATTERNS,
  DISABLE_DIRECTIVE_RE,
  DISABLE_REASON_RE,
  TOKEN_CONTINUE_ON_ERROR,
} from './forbid2-patterns.mjs';

const NEEDS = ['typecheck', 'lint', 'boundary', 'test', 'python', 'secret-scan', 'discovery', 'path-guard'];
const NEEDS_YAML = NEEDS.map((n) => `      - ${n}`).join('\n');

function job(yamlBody) {
  return YAML.parse(`jobs:\n  ci-required:\n${yamlBody}\n`).jobs['ci-required'];
}

function failedIds(findings) {
  return findings.filter((f) => !f.ok).map((f) => f.id);
}

/* ── REQ-6 (c) 집행 판정 케이스 ──────────────────────────────────────────── */

const AGGREGATOR_CASES = [
  {
    name: 'B-8 순진한 구현 — needs 만 선언 (if 없음)',
    yaml: `    runs-on: ubuntu-latest\n    needs:\n${NEEDS_YAML}\n    steps:\n      - run: echo done`,
    expectFail: ['R6C-1', 'R6C-2'],
  },
  {
    name: 'if 가 success() — 선행 실패 시 스킵',
    yaml: `    runs-on: ubuntu-latest\n    if: success()\n    needs:\n${NEEDS_YAML}\n    steps:\n      - run: echo done`,
    expectFail: ['R6C-1', 'R6C-2'],
  },
  {
    name: 'if 가 !cancelled() — 취소 시 자신이 skipped 로 통과 처리된다 (cancelled 축 미커버)',
    yaml: `    runs-on: ubuntu-latest\n    if: \${{ !cancelled() }}\n    needs:\n${NEEDS_YAML}\n    env:\n      N: \${{ toJSON(needs) }}\n    steps:\n      - run: |\n          node -e "const n=JSON.parse(process.env.N);if(Object.values(n).some(v=>v.result!=='success'))process.exit(1)"`,
    expectFail: ['R6C-1'],
  },
  {
    name: "failure 만 열거 — skipped/cancelled 가 통과로 샌다",
    yaml: `    runs-on: ubuntu-latest\n    if: always()\n    needs:\n${NEEDS_YAML}\n    steps:\n      - run: |\n          if [ "\${{ contains(needs.*.result, 'failure') }}" = "true" ]; then exit 1; fi`,
    expectFail: ['R6C-4'],
  },
  {
    name: '평가는 하지만 non-zero 종료가 없다',
    yaml: `    runs-on: ubuntu-latest\n    if: always()\n    needs:\n${NEEDS_YAML}\n    steps:\n      - run: echo "\${{ toJSON(needs) }}" | grep success`,
    expectFail: ['R6C-5'],
  },
  {
    name: 'needs 일부만 개별 평가 (2/8)',
    yaml: `    runs-on: ubuntu-latest\n    if: always()\n    needs:\n${NEEDS_YAML}\n    steps:\n      - run: |\n          [ "\${{ needs.typecheck.result }}" = "success" ] || exit 1\n          [ "\${{ needs.lint.result }}" = "success" ] || exit 1`,
    expectFail: ['R6C-3'],
  },
  {
    name: '집행 스텝이 continue-on-error 로 마스킹됨',
    yaml: `    runs-on: ubuntu-latest\n    if: always()\n    needs:\n${NEEDS_YAML}\n    steps:\n      - ${TOKEN_CONTINUE_ON_ERROR}: true\n        run: |\n          node -e "const n=JSON.parse(process.env.N);if(Object.values(n).some(v=>v.result!=='success'))process.exit(1)"\n        env:\n          N: \${{ toJSON(needs) }}`,
    expectFail: ['R6C-5'],
  },
  {
    name: '정상 — always() + 집계 평가 + success 비교 + non-zero 종료 (확정된 ci.yml 형태)',
    yaml: `    runs-on: ubuntu-latest\n    if: always()\n    needs:\n${NEEDS_YAML}\n    env:\n      N: \${{ toJSON(needs) }}\n    steps:\n      - run: |\n          node -e "const n=JSON.parse(process.env.N);const b=Object.entries(n).filter(([,v])=>v.result!=='success');if(b.length)process.exit(1)"`,
    expectFail: [],
  },
];

/* ── FORBID-2 패턴 사전 케이스 ──────────────────────────────────────────── */

const MASK = String.fromCharCode(124, 124); // 리터럴 회피: 이 파일도 스캔 대상이다
const F2_POSITIVE = [
  { id: 'continue-on-error', line: `    continue${'-'}on${'-'}error: true` },
  { id: 'or-true', line: `pytest ${MASK} true` },
  { id: 'or-colon', line: `pytest ${MASK} :` },
  { id: 'set-plus-e', line: 'set +e' },
  { id: 'pass-with-no-tests', line: `jest --pass${'W'}ithNoTests` },
  { id: 'test-skip-only', line: `describe${'.'}skip('x', () => {})` },
  { id: 'test-x-prefix', line: `x${'it'}('x', () => {})` },
  { id: 'pytest-skip', line: `@pytest${'.'}mark${'.'}skip` },
];
const F2_NEGATIVE = [
  'const ok = a || b;',
  'set -euo pipefail',
  'it("renders", () => {})',
  'run: pnpm test',
];

/* ── 실행 ────────────────────────────────────────────────────────────────── */

/** @returns {Array<{ok:boolean, rule:string, message:string}>} */
export function runSelfTests() {
  const out = [];
  const ok = (rule, message) => out.push({ ok: true, rule, message });
  const bad = (rule, message) => out.push({ ok: false, rule, message });

  // REQ-6 (c)
  for (const c of AGGREGATOR_CASES) {
    let findings;
    try {
      findings = analyzeEnforcementJob(job(c.yaml));
    } catch (err) {
      bad('REQ-6', `자기검사 케이스 "${c.name}" 실행 중 예외: ${err.message}`);
      continue;
    }
    const got = failedIds(findings);
    const missing = c.expectFail.filter((id) => !got.includes(id));
    if (c.expectFail.length === 0) {
      if (got.length > 0) {
        bad('REQ-6', `(c) 자기검사 — 정상 애그리게이터를 위반으로 오판했다: ${got.join(', ')} ("${c.name}")`);
      } else {
        ok('REQ-6', `(c) 자기검사 통과 — "${c.name}" 정상 판정`);
      }
      continue;
    }
    if (missing.length > 0) {
      bad(
        'REQ-6',
        `(c) 자기검사 — "${c.name}" 을(를) 잡지 못했다. 기대 위반 ${missing.join(', ')} / 실제 ${got.join(', ') || '없음'}`,
      );
    } else {
      ok('REQ-6', `(c) 자기검사 통과 — "${c.name}" → ${got.join(', ')}`);
    }
  }

  // FORBID-2 패턴 사전
  const byId = new Map(
    [...FORBID2_LINE_PATTERNS, ...FORBID2_WORKFLOW_IF_PATTERNS].map((p) => [p.id, p]),
  );
  for (const t of F2_POSITIVE) {
    const p = byId.get(t.id);
    if (!p) {
      bad('FORBID-2', `자기검사 — 패턴 \`${t.id}\` 가 사전에 없다`);
      continue;
    }
    if (!p.re.test(t.line)) {
      bad('FORBID-2', `자기검사 — 패턴 \`${t.id}\` 가 합성 위반 라인을 잡지 못했다`);
    }
  }
  {
    const ifPat = byId.get('if-always');
    const line = `    if: al${'ways'}()`;
    if (!ifPat || !ifPat.re.test(line)) {
      bad('FORBID-2', '자기검사 — 워크플로 if 패턴이 합성 위반 라인을 잡지 못했다');
    }
  }
  for (const line of F2_NEGATIVE) {
    for (const p of FORBID2_LINE_PATTERNS) {
      if (p.re.test(line)) {
        bad('FORBID-2', `자기검사 — 패턴 \`${p.id}\` 가 정상 라인을 오탐했다: ${line}`);
      }
    }
  }
  if (!DISABLE_DIRECTIVE_RE.test(`// es${'lint-disable'}-next-line no-console`)) {
    bad('FORBID-2', '자기검사 — disable 지시자 정규식이 합성 위반을 잡지 못했다');
  }
  if (!DISABLE_REASON_RE.test('-- reason: https://example.com/issues/1')) {
    bad('FORBID-2', '자기검사 — 사유 주석 정규식이 정상 형식을 인식하지 못했다');
  }
  if (DISABLE_REASON_RE.test('-- reason: 나중에 고칠 것')) {
    bad('FORBID-2', '자기검사 — 사유 주석 정규식이 URL 없는 사유를 허용했다');
  }
  if (!isProseFile('docs/tasks/F1.md') || isProseFile('scripts/ci/run.sh')) {
    bad('FORBID-2', '자기검사 — 산문 파일 판정이 잘못됐다 (.md 제외 / .sh 는 대상이어야 한다)');
  }
  if (!isExcludedPath('.github/ci-fixtures/lint/x.ts') || isExcludedPath('apps/web/src/x.ts')) {
    bad('FORBID-2', '자기검사 — 계약 명시 제외① 판정이 잘못됐다');
  }
  if (!out.some((e) => !e.ok && e.rule === 'FORBID-2')) {
    ok('FORBID-2', `자기검사 통과 — 패턴 ${F2_POSITIVE.length + 1}종 탐지 · 정상 라인 ${F2_NEGATIVE.length}건 무탐 · 제외 규칙 정합`);
  }

  // FORBID-5 상향 판정
  {
    const base = new Map([['lint', 5], ['test', 8]]);
    const raisedUp = computeRaised(base, new Map([['lint', 6], ['test', 8]]));
    const raisedNew = computeRaised(base, new Map([['lint', 5], ['test', 8], ['dag-check', 3]]));
    const raisedDown = computeRaised(base, new Map([['lint', 4], ['test', 8]]));
    if (raisedUp.length !== 1 || raisedUp[0].job !== 'lint') {
      bad('FORBID-5', '자기검사 — 기존 항목 상향(5→6)을 잡지 못했다');
    } else if (raisedNew.length !== 0) {
      bad('FORBID-5', '자기검사 — 신규 job 항목 추가를 상향으로 오판했다 (계약상 해당 없음)');
    } else if (raisedDown.length !== 0) {
      bad('FORBID-5', '자기검사 — 하향(5→4)을 상향으로 오판했다');
    } else {
      ok('FORBID-5', '자기검사 통과 — 상향 탐지 / 신규추가·하향 무탐');
    }
  }

  // REQ-7 CODEOWNERS 매칭
  {
    const rules = [
      { pattern: 'packages/db', owners: ['@team-a'], line: 1 },
      { pattern: '.github/**', owners: ['@team-b'], line: 2 },
    ];
    const problems = [];
    if (normalizePattern('/packages/db/') !== 'packages/db') problems.push('정규화(/packages/db/)');
    if (normalizePattern('.github/**') !== '.github') problems.push('정규화(.github/**)');
    if (!matchesPattern('packages/db', 'packages/db/src/client.ts')) problems.push('하위경로 매칭');
    if (matchesPattern('packages/db', 'packages/dbx/src/a.ts')) problems.push('접두 오탐 방지');
    if (ownersForPath(rules, '.github/ci-budget.json')[0] !== '@team-b') problems.push('소유자 조회');
    if (problems.length > 0) {
      bad('REQ-7', `자기검사 — CODEOWNERS 매칭 로직 오류: ${problems.join(', ')}`);
    } else {
      ok('REQ-7', '자기검사 통과 — 패턴 정규화·하위경로 매칭·소유자 조회 정합');
    }
  }

  // REQ-7 single_maintainer 대체 규약 — (c-1) 만료 · (c-2) 90일 · (c-3) 독립 PR
  {
    const D = (s) => new Date(`${s}T00:00:00Z`);
    const failIds = (r) => r.filter((f) => !f.ok).map((f) => f.id);
    const problems = [];

    // (c-1) 만료 전 → 통과 / 만료 후 → 실패. 완화가 스스로 만료하는지가 핵심이다.
    if (failIds(evaluateRelaxationWindow('2026-11-01', D('2026-08-03'), 'x', D('2026-10-31'))).length !== 0) {
      problems.push('만료 전인데 실패 판정');
    }
    if (!failIds(evaluateRelaxationWindow('2026-11-01', D('2026-08-03'), 'x', D('2026-11-02'))).includes('c-1')) {
      problems.push('만료일 초과를 잡지 못했다 (완화가 영구화된다)');
    }
    // (c-2) 90일 초과
    if (!failIds(evaluateRelaxationWindow('2027-06-01', D('2026-08-03'), 'x', D('2026-10-01'))).includes('c-2')) {
      problems.push('90일 상한 초과를 잡지 못했다');
    }
    // 헤더 자체가 없으면 실패
    if (!failIds(evaluateRelaxationWindow(null, D('2026-08-03'), 'x', D('2026-10-01'))).includes('c-1')) {
      problems.push('single-maintainer-until 헤더 부재를 잡지 못했다');
    }
    // 도입일 미상 → 미판정을 통과로 처리하지 않는다
    if (!failIds(evaluateRelaxationWindow('2026-11-01', null, null, D('2026-10-01'))).includes('c-2')) {
      problems.push('도입일 미상을 통과로 처리했다');
    }

    // (c-3) 독립 PR
    const T = '.github/ci-budget.json';
    if (!checkIndependentPr([T], T).ok) problems.push('독립 PR 을 위반으로 오판');
    if (checkIndependentPr([T, 'apps/web/src/page.tsx'], T).ok) problems.push('다른 변경이 섞인 PR 을 통과');
    if (!checkIndependentPr([T, '.github/pr-task'], T).ok) {
      problems.push('.github/pr-task(FORBID-4 공통 허용) 동반을 위반으로 오판 — 합법 경로가 0개가 된다');
    }

    if (problems.length > 0) {
      bad('REQ-7', `자기검사 — single_maintainer 대체 규약 판정 오류: ${problems.join(' / ')}`);
    } else {
      ok('REQ-7', '자기검사 통과 — (c-1) 만료 탐지 · (c-2) 90일 상한 탐지 · (c-3) 독립 PR 판정 정합');
    }
  }

  // REQ-8 / FORBID-3 — next build 요약 파싱 · 페이지 라우트 필터 · 5토큰
  {
    const summary = [
      'Route (app)                                 Size  First Load JS',
      '┌ ○ /                                      136 B         101 kB',
      '├ ○ /_not-found                            136 B         101 kB',
      '├ ƒ /api/health                              0 B            0 B',
      '├ ƒ /dyn                                   136 B         101 kB',
      '└ ● /venues/[slug]                         136 B         101 kB',
      '    ├ /venues/aaa',
      'ƒ Middleware                                 27 kB',
      '+ First Load JS shared by all               101 kB',
      '',
      '○  (Static)   prerendered as static content',
      '●  (SSG)      prerendered as static HTML (uses generateStaticParams)',
      'ƒ  (Dynamic)  server-rendered on demand',
    ].join('\n');
    const problems = [];
    const parsed = parseBuildSummary(summary);

    if (!parsed.headerFound) problems.push('요약 헤더 미인식');
    const got = parsed.routes.map((r) => `${r.marker}${r.route}`).sort().join(',');
    const want = ['○/', '○/_not-found', 'ƒ/api/health', 'ƒ/dyn', '●/venues/[slug]'].sort().join(',');
    if (got !== want) problems.push(`라우트 파싱 불일치: ${got}`);
    // 범례 줄 · Middleware · prerender 하위 경로를 라우트로 오인하면 안 된다
    if (parsed.routes.some((r) => !r.route.startsWith('/'))) problems.push('범례 줄을 라우트로 오인');
    if (parsed.routes.some((r) => r.route === '/venues/aaa')) {
      problems.push('prerender 하위 경로를 라우트로 오인');
    }
    // 요약이 없으면 헤더 미발견 + 라우트 0건이어야 한다 (파싱 실패를 통과로 처리 금지의 근거)
    const empty = parseBuildSummary('Failed to compile.');
    if (empty.headerFound || empty.routes.length !== 0) problems.push('요약 부재 판정 오류');
    // PPR 등 미분류 마커는 unknown 으로 들어와야 한다
    const ppr = parseBuildSummary('Route (app)\n┌ ◐ /ppr    1 kB');
    if (ppr.unknown.length !== 1) problems.push('미분류 마커(◐)를 unknown 으로 잡지 못했다');

    if (!isApiRoute('/api/health') || !isApiRoute('/api')) problems.push('Route Handler 판정 누락');
    if (isApiRoute('/apiary') || isApiRoute('/venues')) problems.push('Route Handler 오탐');
    if (!isInternalRoute('/_not-found') || isInternalRoute('/venues')) problems.push('내부 라우트 판정 오류');

    // 5토큰: 각각 합성 위반을 잡고, 정상 라인은 무탐이어야 한다
    const positives = [
      "export const dynamic = 'force-dynamic';",
      'export const revalidate = 0;',
      'import { unstable_noStore } from "next/cache";',
      "export const fetchCache = 'force-no-store';",
      "fetch(url, { cache: 'no-store' });",
    ];
    positives.forEach((line, i) => {
      if (!DYNAMIC_TOKENS[i].re.test(line)) {
        problems.push(`토큰 \`${DYNAMIC_TOKENS[i].id}\` 가 합성 위반을 잡지 못했다`);
      }
    });
    for (const benign of ["export const revalidate = 3600;", "export const dynamic = 'force-static';"]) {
      for (const t of DYNAMIC_TOKENS) {
        if (t.re.test(benign)) problems.push(`토큰 \`${t.id}\` 가 정상 라인을 오탐: ${benign}`);
      }
    }

    if (problems.length > 0) {
      bad('FORBID-3', `자기검사 — next build 요약/토큰 판정 오류: ${problems.join(' / ')}`);
    } else {
      ok(
        'FORBID-3',
        `자기검사 통과 — 요약 파싱 · 범례/Middleware 무탐 · Route Handler 제외 · 미분류 마커 격리 · 5토큰 탐지/무탐`,
      );
    }
  }

  return out;
}
