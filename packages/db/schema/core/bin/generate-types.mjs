#!/usr/bin/env node
// packages/db/schema/core/bin/generate-types.mjs — `pnpm db:generate-types [--check]`
//
// 마이그레이션이 적용된 DB 로부터 packages/db/src/types.ts 를 생성한다.
// `--check` 는 파일을 쓰지 않고 커밋본과 대조만 하며, 다르면 exit 1 한다.
//
// 생성은 **격리된 시험용 DB 에 마이그레이션을 새로 적용해** 수행한다. 개발자의 DB 에 남아 있는
// 실험용 컬럼이 타입 파일로 새어 들어가면, 리포에 없는 스키마를 전제한 코드가 컴파일을 통과한다.

import fs from 'node:fs';
import path from 'node:path';
import console from 'node:console';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { requireDatabaseUrl, withClient, withScratchDatabase } from '../lib/connect.mjs';
import { migrateUp } from '../lib/migrate.mjs';
import { readCatalog, renderTypes } from '../lib/typegen.mjs';

const TYPES_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../src/types.ts');
const check = process.argv.includes('--check');
const url = requireDatabaseUrl();

const rendered = await withScratchDatabase(url, 'typegen', (scratchUrl) =>
  withClient(scratchUrl, async (client) => {
    await migrateUp(client);
    return renderTypes(await readCatalog(client));
  }),
);

if (!check) {
  fs.writeFileSync(TYPES_PATH, rendered);
  console.log(`생성: ${TYPES_PATH}`);
} else {
  const current = fs.existsSync(TYPES_PATH) ? fs.readFileSync(TYPES_PATH, 'utf8') : '';
  if (current !== rendered) {
    console.error(
      'FAIL packages/db/src/types.ts 가 마이그레이션과 어긋난다 — `pnpm db:generate-types` 로 재생성하고 커밋하라',
    );
    const a = current.split('\n');
    const b = rendered.split('\n');
    for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
      if (a[i] !== b[i]) {
        console.error(`  첫 차이 ${i + 1}행:`);
        console.error(`    커밋본 : ${a[i] ?? '<없음>'}`);
        console.error(`    재생성 : ${b[i] ?? '<없음>'}`);
        break;
      }
    }
    process.exit(1);
  }
  console.log('PASS packages/db/src/types.ts == 마이그레이션 재생성물');
}
