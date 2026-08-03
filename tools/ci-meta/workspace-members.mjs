#!/usr/bin/env node
// tools/ci-meta/workspace-members.mjs — `pnpm test:workspace`
//
// REQ-1 — pnpm workspace 가 apps/web · packages/api · packages/db · packages/config 4개를
//         **반드시 포함**한다 (추가 패키지 허용).
//
// ⚠ 계약 명시: "개수 동등 비교(=== 4)를 사용하면 실패로 간주한다."
//   DS1 이 packages/ui 를 신설하는 등 하류가 패키지를 추가하므로 **상한을 두지 않는다**.
//   이 파일에는 워크스페이스 멤버 수에 대한 동등/상한 비교가 존재하지 않는다.
//
// 판정 원천: `pnpm list -r --depth -1 --json` (계약 acceptance 가 지정한 명령).
//   pnpm 이 없는 환경에서는 pnpm-workspace.yaml + package.json 을 직접 읽어 판정한다.
//   어느 쪽도 불가능하면 exit 1 이다 (판정 불가 ≠ 통과).

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { Report, repoRoot, exec, fmtSet, IS_CI, guard } from './lib/util.mjs';

const RULE = 'REQ-1';

/** 계약이 요구하는 워크스페이스 멤버 (리포 루트 기준 디렉터리 경로) */
export const REQUIRED_MEMBER_DIRS = [
  'apps/web',
  'packages/api',
  'packages/db',
  'packages/config',
];

function fromPnpm(root) {
  const r = exec('pnpm', ['list', '-r', '--depth', '-1', '--json'], { cwd: root });
  if (r.missing) return { ok: false, reason: 'pnpm 실행 파일이 없다' };
  if (!r.ok) return { ok: false, reason: `pnpm list 실패 (exit ${r.code}): ${r.stderr.trim().slice(0, 400)}` };
  let parsed;
  try {
    parsed = JSON.parse(r.stdout);
  } catch (err) {
    return { ok: false, reason: `pnpm list 출력 JSON 파싱 실패: ${err.message}` };
  }
  const list = Array.isArray(parsed) ? parsed : [parsed];
  const members = list
    .filter((p) => p && p.path)
    .map((p) => ({
      dir: path.relative(root, p.path).split(path.sep).join('/') || '.',
      name: p.name ?? null,
    }))
    .filter((m) => m.dir !== '.');
  return { ok: true, source: 'pnpm list -r --depth -1 --json', members };
}

function expandGlob(root, pattern) {
  // pnpm-workspace 의 `dir/*` 형태만 처리한다 (본 리포의 사용 형태).
  const out = [];
  if (pattern.endsWith('/*')) {
    const parent = pattern.slice(0, -2);
    const abs = path.join(root, parent);
    if (!existsSync(abs)) return out;
    for (const e of readdirSync(abs)) {
      const d = path.join(abs, e);
      if (statSync(d).isDirectory() && existsSync(path.join(d, 'package.json'))) {
        out.push(`${parent}/${e}`);
      }
    }
    return out;
  }
  if (existsSync(path.join(root, pattern, 'package.json'))) out.push(pattern);
  return out;
}

function fromWorkspaceFile(root) {
  const abs = path.join(root, 'pnpm-workspace.yaml');
  if (!existsSync(abs)) return { ok: false, reason: 'pnpm-workspace.yaml 이 없다' };
  let data;
  try {
    data = YAML.parse(readFileSync(abs, 'utf8'));
  } catch (err) {
    return { ok: false, reason: `pnpm-workspace.yaml 파싱 실패: ${err.message}` };
  }
  const patterns = Array.isArray(data?.packages) ? data.packages : [];
  if (patterns.length === 0) return { ok: false, reason: 'pnpm-workspace.yaml 의 packages 가 비어 있다' };
  const dirs = new Set();
  for (const p of patterns) {
    if (String(p).startsWith('!')) continue;
    for (const d of expandGlob(root, String(p))) dirs.add(d);
  }
  const members = [...dirs].sort().map((dir) => {
    let name = null;
    try {
      name = JSON.parse(readFileSync(path.join(root, dir, 'package.json'), 'utf8')).name ?? null;
    } catch {
      name = null;
    }
    return { dir, name };
  });
  return { ok: true, source: 'pnpm-workspace.yaml + package.json (pnpm 미사용 폴백)', members };
}

const report = new Report('workspace-members (REQ-1)');
const root = repoRoot();

await guard(report, RULE, '워크스페이스 멤버 집합', async () => {
  let result = fromPnpm(root);
  if (!result.ok) {
    if (IS_CI) {
      report.fail(
        RULE,
        `CI 컨텍스트에서 \`pnpm list -r --depth -1 --json\` 을 수행할 수 없다 — 판정 불가는 통과가 아니다`,
        result.reason,
      );
      return;
    }
    report.info(RULE, `pnpm 판정 불가 → 정적 폴백 사용: ${result.reason}`);
    result = fromWorkspaceFile(root);
    if (!result.ok) {
      report.fail(RULE, '워크스페이스 멤버를 어떤 수단으로도 산출할 수 없다', result.reason);
      return;
    }
  }

  const dirs = new Set(result.members.map((m) => m.dir));
  report.info(
    RULE,
    `판정 원천: ${result.source} — 멤버 ${result.members.length}건 ${fmtSet(dirs)} (개수 상한 없음)`,
  );

  if (dirs.size === 0) {
    report.fail(RULE, '워크스페이스 멤버가 0건이다 (검사 대상 0건을 통과로 처리하지 않는다)');
    return;
  }

  // 집합 포함 검사 — 동등 비교 아님.
  const missing = REQUIRED_MEMBER_DIRS.filter((d) => !dirs.has(d));
  if (missing.length > 0) {
    report.fail(
      RULE,
      `pnpm workspace 에 필수 멤버가 없다: ${fmtSet(missing)} — 현재 멤버 ${fmtSet(dirs)}`,
    );
  } else {
    const extra = [...dirs].filter((d) => !REQUIRED_MEMBER_DIRS.includes(d));
    report.pass(
      RULE,
      `필수 4개 멤버 ${fmtSet(REQUIRED_MEMBER_DIRS)} 전부 포함 (추가 멤버 ${extra.length}건 ${fmtSet(extra)} 은 허용)`,
    );
  }

  for (const m of result.members) {
    if (!m.name) {
      report.fail(RULE, `워크스페이스 멤버 \`${m.dir}\` 의 package.json 에 name 이 없다`);
    }
  }
});

process.exit(report.print());
