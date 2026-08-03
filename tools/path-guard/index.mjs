#!/usr/bin/env node
/**
 * FORBID-4 집행기 진입점 — CI job 이름은 `path-guard` 로 고정 (C2·C3 계약이 인용).
 *
 *   node tools/path-guard/index.mjs      (= pnpm test:path-guard)
 *
 * 종료 코드는 마스킹하지 않는다: 위반·판정 불가·예기치 못한 오류 전부 exit 1.
 */
import { PathGuardError, FORBID_TOKEN } from './lib/errors.mjs';
import { runCheck } from './lib/check.mjs';

try {
  const report = runCheck({ cwd: process.cwd() });
  for (const line of report.lines) console.log(line);
  process.exit(0);
} catch (err) {
  if (err instanceof PathGuardError) {
    console.error(err.message);
  } else {
    console.error(
      `${FORBID_TOKEN} path-guard: 검사가 완료되지 못했다 (판정 불가는 통과가 아니다).\n` +
        `${err && err.stack ? err.stack : String(err)}`,
    );
  }
  process.exit(1);
}
