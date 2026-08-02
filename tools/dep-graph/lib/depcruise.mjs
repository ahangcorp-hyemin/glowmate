/**
 * dependency-cruiser 보조 실행 (REQ-3 (a) 의 **소스 임포트 수준** 보강).
 *
 * package.json/lockfile 그래프는 "선언된 의존"을 본다. dependency-cruiser 는 실제 import 문을 본다.
 * 둘은 서로를 대체하지 않는다 — 이 검사기는 자체 그래프 판정을 1차 수단으로 쓰고,
 * dependency-cruiser 는 보조 수단으로만 사용한다 (설정 한 줄로 판정 전체가 무력화되는 것을 막기 위함).
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const BIN_CANDIDATES = [
  'node_modules/.bin/depcruise',
  'node_modules/dependency-cruiser/bin/dependency-cruise.mjs',
];

export function findBinary(root) {
  for (const rel of BIN_CANDIDATES) {
    const abs = path.join(root, rel);
    if (fs.existsSync(abs)) return abs;
  }
  return null;
}

/**
 * @returns {{status: 'ok'|'unavailable'|'no-target'|'error', detail: string, violations: object[]}}
 */
export function runDependencyCruiser(root, targetDirs) {
  const dirs = targetDirs.filter((d) => fs.existsSync(path.join(root, d)));
  if (dirs.length === 0) {
    return { status: 'no-target', detail: '스캔할 소스 디렉터리가 없다', violations: [] };
  }
  const configPath = path.join(root, '.dependency-cruiser.cjs');
  if (!fs.existsSync(configPath)) {
    return { status: 'error', detail: '.dependency-cruiser.cjs 가 없다', violations: [] };
  }
  const bin = findBinary(root);
  if (bin === null) {
    return {
      status: 'unavailable',
      detail: 'dependency-cruiser 바이너리가 없다 (pnpm install 미수행)',
      violations: [],
    };
  }
  const args = bin.endsWith('.mjs')
    ? [bin, '--config', '.dependency-cruiser.cjs', '--output-type', 'json', ...dirs]
    : ['--config', '.dependency-cruiser.cjs', '--output-type', 'json', ...dirs];
  const cmd = bin.endsWith('.mjs') ? process.execPath : bin;
  const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) {
    return { status: 'error', detail: `실행 실패: ${r.error.message}`, violations: [] };
  }
  let parsed;
  try {
    parsed = JSON.parse(r.stdout);
  } catch (e) {
    return {
      status: 'error',
      detail: `출력 파싱 실패 (exit=${r.status}): ${e.message} :: ${(r.stderr || '').slice(0, 400)}`,
      violations: [],
    };
  }
  const violations = parsed?.summary?.violations ?? [];
  return {
    status: 'ok',
    detail: `모듈 ${parsed?.summary?.totalCruised ?? 0}개 스캔 · 위반 ${violations.length}건`,
    violations,
  };
}
