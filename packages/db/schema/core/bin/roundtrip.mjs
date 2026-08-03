#!/usr/bin/env node
// packages/db/schema/core/bin/roundtrip.mjs — `pnpm db:roundtrip` (F2a REQ-7)
//
// 3개 스냅샷(pre / post-up / post-down)을 채취해 post-down == pre 및 post-up(2회차) == post-up(1회차)
// 를 assert 한다. 왕복은 **격리된 시험용 데이터베이스**에서 수행한다 — 운영/개발 DB 에서 down 을
// 돌리는 것을 정상 절차로 만들지 않기 위해서다.
//
// --dir <경로> 로 다른 마이그레이션 디렉터리를 지정할 수 있다(no-op down 픽스처 검증용).

import path from 'node:path';
import console from 'node:console';
import process from 'node:process';
import { requireDatabaseUrl, withClient, withScratchDatabase } from '../lib/connect.mjs';
import { runRoundtrip } from '../lib/roundtrip.mjs';
import { MIGRATIONS_DIR } from '../lib/migrate.mjs';

const args = process.argv.slice(2);
const dirIdx = args.indexOf('--dir');
const dir = dirIdx === -1 ? MIGRATIONS_DIR : path.resolve(args[dirIdx + 1] ?? '');

const url = requireDatabaseUrl();

const result = await withScratchDatabase(url, 'roundtrip', (scratchUrl) =>
  withClient(scratchUrl, (client) => runRoundtrip(client, { dir, log: (m) => console.log(`  ${m}`) })),
);

console.log('');
console.log(`REQ-7 왕복 판정 (${path.basename(dir)})`);
for (const [k, v] of Object.entries(result.digests)) console.log(`  ${k.padEnd(9)} ${v}`);

if (!result.ok) {
  console.error('');
  for (const f of result.failures) console.error(`FAIL ${f}`);
  for (const d of result.details) console.error(`     ${d}`);
  process.exit(1);
}

console.log('PASS REQ-7 — post-down == pre, post-up(2회차) == post-up(1회차)');
