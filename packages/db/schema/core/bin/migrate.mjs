#!/usr/bin/env node
// packages/db/schema/core/bin/migrate.mjs — `pnpm db:migrate` / `pnpm db:migrate:down`
//
// 사용법 (cwd = packages/db)
//   node schema/core/bin/migrate.mjs up
//   node schema/core/bin/migrate.mjs down [--to <version>]
//   node schema/core/bin/migrate.mjs status
//
// DATABASE_URL 이 없으면 실패한다. 실행 대상이 없을 때도 그 사실을 출력한다 —
// "아무것도 안 했는데 초록"이 무엇을 뜻하는지 로그에서 구분되어야 한다.

import console from 'node:console';
import process from 'node:process';
import { requireDatabaseUrl, withClient } from '../lib/connect.mjs';
import { appliedVersions, bootstrap, loadMigrations, migrateDown, migrateUp } from '../lib/migrate.mjs';

const [, , command = 'up', ...rest] = process.argv;

function argValue(flag) {
  const i = rest.indexOf(flag);
  if (i === -1) return null;
  const v = rest[i + 1];
  if (v === undefined) throw new Error(`${flag} 에 값이 없다`);
  return v;
}

const url = requireDatabaseUrl();

await withClient(url, async (client) => {
  if (command === 'up') {
    const done = await migrateUp(client, { log: (m) => console.log(m) });
    console.log(done.length === 0 ? 'up: 적용할 마이그레이션 없음 (이미 최신)' : `up: ${done.length}건 적용`);
    return;
  }
  if (command === 'down') {
    const to = argValue('--to');
    const done = await migrateDown(client, { to, log: (m) => console.log(m) });
    console.log(done.length === 0 ? 'down: 되돌릴 마이그레이션 없음' : `down: ${done.length}건 되돌림`);
    return;
  }
  if (command === 'status') {
    const all = loadMigrations();
    // 원장이 없으면 만든다. 조회 실패를 빈 목록으로 삼키면 "전부 pending" 이라는 거짓 상태가 출력된다.
    await bootstrap(client);
    const applied = new Set(await appliedVersions(client));
    for (const m of all) {
      console.log(`${applied.has(m.version) ? '[applied]' : '[pending]'} ${m.key}`);
    }
    return;
  }
  throw new Error(`알 수 없는 명령: ${command} (up | down | status)`);
});
