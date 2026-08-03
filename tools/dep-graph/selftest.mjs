#!/usr/bin/env node
/**
 * dep-graph 검사기의 **탐지 능력** 자기 검증.
 *
 * "규칙은 강해졌으나 그 규칙이 작동하는지를 아무도 확인하지 않는다"(f1-gate2 §5) 를 막기 위한 것.
 * 각 픽스처를 임시 워크스페이스로 물질화한 뒤 index.mjs 를 별도 프로세스로 실행하고
 * 종료 코드 + 출력 문자열(규칙 ID 토큰 포함 여부)을 함께 assert 한다.
 *
 * 특히 다음 두 가지를 반드시 검증한다:
 *   - 위반 픽스처는 exit 1 이고 메시지에 REQ-3 / FORBID-1 토큰이 있다 (귀속 검증의 전제)
 *   - **합법 픽스처는 exit 0 이다** (원칙 2.5 — 아무것도 통과 못 시키는 검사기는 계약 위반이다)
 *
 * 사용법: node tools/dep-graph/selftest.mjs
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { FIXTURES } from './__fixtures__/fixtures.mjs';
import {
  Graph,
  applyLockfileDoc,
  depPathToName,
  isPostgresWireDriver,
  WS,
  NPM,
} from './lib/graph.mjs';
import { globToRegExp, makeNameMatcher } from './lib/config.mjs';
import { parseWorkspaceGlobs } from './lib/workspace.mjs';
import {
  changedFiles,
  codeownersMatch,
  ownersFor,
  parseCodeowners,
  verifySingleMaintainer,
} from './lib/approval.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENTRY = path.join(HERE, 'index.mjs');

function materialize(dir, files) {
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, substitute(content), 'utf8');
  }
}

function substitute(text) {
  const d = new Date(Date.now() + 30 * 86400000);
  const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`;
  return text.replaceAll('__EXPIRES_IN_30_DAYS__', iso);
}

function git(dir, args) {
  const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`git ${args.join(' ')} 실패: ${r.stderr || r.stdout}`);
  }
  return r.stdout;
}

function runFixture(fx) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `depgraph-fx-${fx.name}-`));
  try {
    materialize(dir, fx.files);
    if (fx.git) {
      git(dir, ['init', '-q', '-b', 'main']);
      git(dir, ['config', 'user.email', 'selftest@glowmate.local']);
      git(dir, ['config', 'user.name', 'selftest']);
      // base 커밋 = head 트리에 base 오버레이를 씌운 상태
      const headSaved = {};
      for (const rel of Object.keys(fx.base ?? {})) {
        const abs = path.join(dir, rel);
        headSaved[rel] = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null;
      }
      materialize(dir, fx.base ?? {});
      git(dir, ['add', '-A']);
      git(dir, ['commit', '-q', '-m', 'base']);
      // 작업 트리를 head 상태로 되돌린다 (커밋하지 않음 = PR diff 상태)
      for (const [rel, content] of Object.entries(headSaved)) {
        const abs = path.join(dir, rel);
        if (content === null) fs.rmSync(abs, { force: true });
        else fs.writeFileSync(abs, content, 'utf8');
      }
    }
    const env = {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      ...(fx.env ?? {}),
    };
    const r = spawnSync(process.execPath, [ENTRY, '--root', dir], {
      encoding: 'utf8',
      env,
    });
    return { code: r.status, out: `${r.stdout}\n${r.stderr}`, dir };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

let failures = 0;

// ── 단위 검증 ─────────────────────────────────────────────────────────────
// lockfile 경로는 `yaml` 모듈이 설치된 CI 에서만 실제로 돈다. 파서와 분리된
// applyLockfileDoc 을 직접 호출해 **전이 간선 판정 로직 자체**를 여기서 검증한다
// (미검증 코드 경로가 CI 에서 처음 실행되면 미탐이 조용히 생긴다).
const units = [];
function unit(name, fn) {
  try {
    const problem = fn();
    if (problem) {
      failures += 1;
      units.push(`  [FAIL] unit: ${name} — ${problem}`);
    } else {
      units.push(`  [PASS] unit: ${name}`);
    }
  } catch (e) {
    failures += 1;
    units.push(`  [FAIL] unit: ${name} — 예외 ${e.message}`);
  }
}

unit('depPathToName — 스코프·피어 접미사 처리', () => {
  const cases = [
    ['next@15.0.0', 'next'],
    ['@prisma/client@5.0.0', '@prisma/client'],
    ['@prisma/client@5.0.0(prisma@5.0.0)', '@prisma/client'],
    ['pg@8.13.0', 'pg'],
  ];
  for (const [id, expected] of cases) {
    const got = depPathToName(id);
    if (got !== expected) return `${id} → ${got} (기대 ${expected})`;
  }
  return null;
});

unit('applyLockfileDoc — 외부 전이 간선으로 드라이버 도달 판정', () => {
  const members = [{ dir: 'apps/web', name: '@fx/web', pkg: {} }];
  const graph = new Graph();
  graph.addNode(WS + 'apps/web');
  const doc = {
    importers: {
      '.': { devDependencies: { eslint: { specifier: '9', version: '9.0.0' } } },
      'apps/web': { dependencies: { 'some-ui': { specifier: '1', version: '1.0.0' } } },
    },
    snapshots: {
      'some-ui@1.0.0': { dependencies: { 'inner-orm': '2.0.0' } },
      'inner-orm@2.0.0': { dependencies: { pg: '8.13.0' } },
      'pg@8.13.0': {},
    },
  };
  const r = applyLockfileDoc(graph, doc, members);
  if (r.status !== 'ok') return `status=${r.status} (${r.detail})`;
  const hits = graph.findReachable(WS + 'apps/web', (id) => id === `${NPM}pg`);
  if (hits.length !== 1) return `pg 도달 판정 실패 (hits=${hits.length})`;
  if (hits[0].path.length !== 4) return `경로 길이 ${hits[0].path.length} (기대 4: web→some-ui→inner-orm→pg)`;
  return null;
});

unit('applyLockfileDoc — importers 섹션이 없으면 통과가 아니라 unusable', () => {
  const r = applyLockfileDoc(new Graph(), { snapshots: {} }, []);
  return r.status === 'unusable' ? null : `status=${r.status}`;
});

unit('applyLockfileDoc — link: 의존을 워크스페이스 노드로 연결', () => {
  const members = [
    { dir: 'apps/web', name: '@fx/web', pkg: {} },
    { dir: 'packages/db', name: '@fx/db', pkg: {} },
  ];
  const graph = new Graph();
  const doc = {
    importers: {
      'apps/web': { dependencies: { '@fx/db': { specifier: 'workspace:*', version: 'link:../../packages/db' } } },
    },
    snapshots: {},
  };
  applyLockfileDoc(graph, doc, members);
  const hits = graph.findReachable(WS + 'apps/web', (id) => id === `${WS}packages/db`);
  return hits.length === 1 ? null : `packages/db 도달 판정 실패 (hits=${hits.length})`;
});

unit('globToRegExp — `*` 가 스코프 경계를 넘지 않는다', () => {
  const re = globToRegExp('@prisma/*');
  if (!re.test('@prisma/client')) return '@prisma/client 이 매칭되지 않는다';
  if (re.test('@prismax/client')) return '@prismax/client 이 매칭된다';
  if (re.test('@prisma/client/sub')) return '스코프 경계를 넘어 매칭된다';
  const exact = globToRegExp('pg');
  if (exact.test('pg-promise')) return 'pg 가 pg-promise 에 매칭된다';
  return null;
});

unit('makeNameMatcher — 매칭된 패턴을 되돌려준다', () => {
  const m = makeNameMatcher(['pg', '@supabase/*']);
  if (m('@supabase/supabase-js') !== '@supabase/*') return '@supabase/* 매칭 실패';
  if (m('react') !== null) return 'react 가 매칭됐다';
  return null;
});

unit('isPostgresWireDriver — 경성 금지 목록', () => {
  if (!isPostgresWireDriver('pg')) return 'pg 미판정';
  if (!isPostgresWireDriver('@neondatabase/serverless')) return '@neondatabase/serverless 미판정';
  if (isPostgresWireDriver('@prisma/client')) return '@prisma/client 을 경성으로 판정 (승인 게이트 관할이어야 한다)';
  return null;
});

unit('parseWorkspaceGlobs — 블록 시퀀스 · 주석 · 인라인', () => {
  const a = parseWorkspaceGlobs("# c\npackages:\n  - 'apps/*'   # 주석\n  - \"packages/*\"\n\nonlyBuilt:\n  - sharp\n");
  if (JSON.stringify(a) !== JSON.stringify(['apps/*', 'packages/*'])) return `블록 파싱 ${JSON.stringify(a)}`;
  const b = parseWorkspaceGlobs("packages: ['apps/*', 'packages/*']\n");
  if (JSON.stringify(b) !== JSON.stringify(['apps/*', 'packages/*'])) return `인라인 파싱 ${JSON.stringify(b)}`;
  return null;
});

// REQ-7 (c-3) — single_maintainer 상태의 승인 대체 조건.
// GitHub API(collaborator 수) 없이 판정 로직만 떼어 검증한다.
function smRepo(files, changes) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'depgraph-sm-'));
  materialize(dir, files);
  git(dir, ['init', '-q', '-b', 'main']);
  git(dir, ['config', 'user.email', 'selftest@glowmate.local']);
  git(dir, ['config', 'user.name', 'selftest']);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'base']);
  materialize(dir, changes);
  return dir;
}

const CLASSES = 'packages/config/dependency-classes.json';
const EXCEPTIONS = 'packages/config/db-driver-exceptions.json';

unit('verifySingleMaintainer — 승인 대상 파일만 바뀐 독립 PR 은 통과', () => {
  const dir = smRepo(
    { [CLASSES]: '{"classes":{}}', 'apps/web/package.json': '{"name":"w"}' },
    { [CLASSES]: '{"classes":{"pg":"data-access"}}' },
  );
  try {
    const r = verifySingleMaintainer({
      root: dir,
      baseRef: 'main',
      requirements: [{ kind: 'classes.add-data-access', file: CLASSES, baseExists: true, detail: 'd' }],
    });
    return r.ok ? null : `실패했다: ${r.error}`;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

unit('verifySingleMaintainer — 다른 변경과 섞이면 실패', () => {
  const dir = smRepo(
    { [CLASSES]: '{"classes":{}}', 'apps/web/package.json': '{"name":"w"}' },
    { [CLASSES]: '{"classes":{"pg":"data-access"}}', 'apps/web/package.json': '{"name":"w2"}' },
  );
  try {
    const r = verifySingleMaintainer({
      root: dir,
      baseRef: 'main',
      requirements: [{ kind: 'classes.add-data-access', file: CLASSES, baseExists: true, detail: 'd' }],
    });
    if (r.ok) return '섞인 PR 이 통과했다';
    if (!r.error.includes('apps/web/package.json')) return `메시지에 혼입 파일이 없다: ${r.error}`;
    return null;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

unit('verifySingleMaintainer — 최초 도입 diff 는 (c-3) 대상이 아니다 (F1 자기차단 방지)', () => {
  const dir = smRepo(
    { 'apps/web/package.json': '{"name":"w"}' },
    { [CLASSES]: '{"classes":{}}', [EXCEPTIONS]: '[]', 'apps/web/package.json': '{"name":"w2"}' },
  );
  try {
    const r = verifySingleMaintainer({
      root: dir,
      baseRef: 'main',
      requirements: [
        { kind: 'classes.add-data-access', file: CLASSES, baseExists: false, detail: 'd' },
        { kind: 'exceptions.change', file: EXCEPTIONS, baseExists: false, detail: 'd' },
      ],
    });
    return r.ok ? null : `최초 도입인데 차단됐다: ${r.error}`;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

unit('verifySingleMaintainer — 승인 대상 파일 2개는 분리를 요구', () => {
  const dir = smRepo(
    { [CLASSES]: '{"classes":{}}', [EXCEPTIONS]: '[]' },
    { [CLASSES]: '{"classes":{"pg":"data-access"}}', [EXCEPTIONS]: '[{"package":"a"}]' },
  );
  try {
    const r = verifySingleMaintainer({
      root: dir,
      baseRef: 'main',
      requirements: [
        { kind: 'classes.add-data-access', file: CLASSES, baseExists: true, detail: 'd' },
        { kind: 'exceptions.change', file: EXCEPTIONS, baseExists: true, detail: 'd' },
      ],
    });
    return !r.ok && r.error.includes('독립 PR') ? null : `판정=${JSON.stringify(r)}`;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

unit('changedFiles — base ref 가 없으면 통과가 아니라 판정 불가', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'depgraph-nogit-'));
  try {
    const r = changedFiles(dir, 'main');
    return r.ok === false ? null : `ok=${r.ok}`;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

unit('codeownersMatch / ownersFor — 마지막 매칭 규칙이 이긴다', () => {
  const rules = parseCodeowners('* @default\n/packages/config/ @cfg-owner @second\n');
  const owners = ownersFor(rules, 'packages/config/dependency-classes.json');
  if (JSON.stringify(owners) !== JSON.stringify(['@cfg-owner', '@second'])) {
    return `owners=${JSON.stringify(owners)}`;
  }
  if (!codeownersMatch('packages/config/**', 'packages/config/a/b.json')) return '글롭 매칭 실패';
  if (codeownersMatch('/packages/db/', 'packages/config/x.json')) return '무관 경로가 매칭됐다';
  return null;
});

console.log('dep-graph selftest — 검사기 탐지 능력 검증 (REQ-3 / FORBID-1)\n');
for (const line of units) console.log(line);
console.log('');

for (const fx of FIXTURES) {
  const { code, out } = runFixture(fx);
  const problems = [];
  if (code !== fx.expectExit) problems.push(`exit ${code} (기대 ${fx.expectExit})`);
  for (const needle of fx.expectContains ?? []) {
    if (!out.includes(needle)) problems.push(`출력에 "${needle}" 없음`);
  }
  for (const needle of fx.expectNotContains ?? []) {
    if (out.includes(needle)) problems.push(`출력에 "${needle}" 이 있으면 안 됨`);
  }
  // 위반 픽스처는 반드시 규칙 ID 토큰으로 귀속 가능해야 한다 (F1 REQ-5 전제)
  if (fx.expectExit !== 0 && !/REQ-3/.test(out) && !/FORBID-1/.test(out)) {
    problems.push('실패 출력에 REQ-3 / FORBID-1 토큰이 없다 (귀속 불가)');
  }
  if (problems.length === 0) {
    console.log(`  [PASS] ${fx.name} — ${fx.describe}`);
  } else {
    failures += 1;
    console.log(`  [FAIL] ${fx.name} — ${fx.describe}`);
    for (const p of problems) console.log(`         · ${p}`);
    console.log(
      out
        .split('\n')
        .map((l) => `         | ${l}`)
        .join('\n'),
    );
  }
}

console.log('');
if (failures > 0) {
  console.error(
    `dep-graph selftest: FAIL — ${failures}건이 기대와 다르다 ` +
      `(단위 ${units.length}건 + 픽스처 ${FIXTURES.length}건 중 · REQ-3 / FORBID-1 탐지 능력 미입증)`,
  );
  process.exit(1);
}
// 성공 시에는 명시적 exit 를 두지 않는다 — 스크립트 말미의 `exit 0` 은 FORBID-2 의 마스킹 관용구다.
console.log(
  `dep-graph selftest: PASS — 단위 ${units.length}건 + 픽스처 ${FIXTURES.length}건 전부 기대대로 판정`,
);
