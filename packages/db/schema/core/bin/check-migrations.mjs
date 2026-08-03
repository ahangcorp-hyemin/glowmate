#!/usr/bin/env node
// packages/db/schema/core/bin/check-migrations.mjs — `pnpm db:check-migrations` (F2a FORBID-1)
//
//   (a) 머지된 up 파일의 sha256 매니페스트 + base 원본 대조
//   (b) 신규 up 파일의 데이터 손실형 DDL 정규식 검사
//
// 예외(파괴적 DDL 허용)는 라벨만으로 열리지 않는다 — packages/db CODEOWNERS 승인 리뷰
// (승인자 ≠ PR 작성자) + 백업 아티팩트가 함께 있어야 한다. 조회할 수 없으면 예외가 아니다.
//
// `--write-manifest` 는 매니페스트를 현재 파일 상태로 갱신한다. base 에 이미 존재하는 파일의
// 내용이 바뀐 상태에서는 갱신해도 (a) 가 base 원본 대조로 잡으므로 매니페스트 세탁이 통하지 않는다.

import fs from 'node:fs';
import path from 'node:path';
import console from 'node:console';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  MANIFEST_PATH,
  buildManifest,
  checkMigrationIntegrity,
  evaluateDestructiveException,
  gitBaseFileReader,
  loadManifest,
  verifyBaseRef,
} from '../lib/destructive.mjs';
import { MIGRATIONS_DIR } from '../lib/migrate.mjs';
import { fetchExceptionEvidence } from '../lib/github-evidence.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const args = process.argv.slice(2);

if (args.includes('--write-manifest')) {
  const files = buildManifest(MIGRATIONS_DIR);
  fs.writeFileSync(
    MANIFEST_PATH,
    `${JSON.stringify(
      {
        _note: [
          'F2a FORBID-1 (a) — 머지된 up 마이그레이션의 sha256 매니페스트.',
          '`pnpm db:check-migrations` 가 이 값과 현재 파일, 그리고 base(origin/main) 원본을 함께 대조한다.',
          '갱신: `pnpm db:check-migrations --write-manifest` (신규 마이그레이션 추가 시에만).',
        ],
        files,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`매니페스트 갱신: ${path.relative(REPO_ROOT, MANIFEST_PATH)} (${Object.keys(files).length}건)`);
  process.exit(0);
}

const baseRef = process.env['DB_MIGRATION_BASE_REF'] ?? 'origin/main';
if (!verifyBaseRef(REPO_ROOT, baseRef)) {
  console.error(
    `FAIL [FORBID-1] base ref 를 해석할 수 없다: ${baseRef} — 해석 실패 상태로 검사하면 ` +
      '모든 파일이 "신규"로 판정되어 머지된 마이그레이션 동결 검사가 통째로 공허해진다. ' +
      '(CI: actions/checkout 의 fetch-depth: 0 확인)',
  );
  process.exit(1);
}

const { violations, checked } = checkMigrationIntegrity({
  dir: MIGRATIONS_DIR,
  manifest: loadManifest(),
  readBase: gitBaseFileReader(REPO_ROOT, baseRef),
});

console.log(
  `FORBID-1 검사 — up 파일 ${checked.upFiles}건 (base 존재 ${checked.inBase}건 = 내용 동결 대상 / 신규 ${checked.newFiles}건 = DDL 스캔 대상) · base=${baseRef}`,
);

if (violations.length === 0) {
  console.log('PASS FORBID-1 — 머지된 up 파일 변경 0건, 신규 up 파일의 데이터 손실형 DDL 0건');
  process.exit(0);
}

// 위반이 있을 때만 예외 근거를 조회한다.
const evidence = await fetchExceptionEvidence();
const decision = evaluateDestructiveException(evidence.input);

console.error('');
for (const v of violations) console.error(`FAIL [${v.rule}] ${v.message}`);
console.error('');
console.error(`예외 판정: ${decision.allowed ? '허용' : '불가'} (근거 조회: ${evidence.source})`);
for (const r of decision.reasons) console.error(`  · ${r}`);

if (decision.allowed) {
  console.error(
    `예외 승인됨 — 승인자 ${decision.approvers.join(', ')} · 백업 아티팩트 ${decision.backups.join(', ')}`,
  );
  process.exit(0);
}
process.exit(1);
