// packages/db/test/core/db/violations.test.mjs — `pnpm test:violations-core`
//
// **위반을 실제로 주입해** 각 검사가 red 가 되는지 확인한다.
// 이것이 없으면 checkCoreSchema 가 항상 빈 배열을 돌려주는 구현도 전 검사를 통과한다.
//
// done_when 의 위반 픽스처 7종 + no-op down 1종에 1:1 대응한다.
//   ① price_per_session NOT NULL          → FORBID-2
//   ② 화이트리스트 밖 컬럼                 → FORBID-3 (REQ-6)
//   ③ core 스키마 7번째 테이블             → REQ-1
//   ④ 금지 축 사전 등재                    → FORBID-3
//   ⑤ CASCADE FK                          → FORBID-4
//   ⑥ source_record DELETE                → REQ-5 / FORBID-5
//   ⑦ up 마이그레이션 DROP COLUMN          → FORBID-1 (b)
//   ⑧ no-op down                          → REQ-7
// (추가) 머지된 up 파일 편집               → FORBID-1 (a)
//
// DDL 변형은 트랜잭션 안에서 하고 ROLLBACK 한다 — Postgres 의 DDL 은 트랜잭션 대상이다.

import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkCoreSchema } from '../../../schema/core/lib/checks.mjs';
import { loadWhitelist, lintWhitelist } from '../../../schema/core/lib/whitelist.mjs';
import {
  checkMigrationIntegrity,
  evaluateDestructiveException,
  gitBaseFileReader,
  scanDestructiveDDL,
} from '../../../schema/core/lib/destructive.mjs';
import { MIGRATIONS_DIR, loadMigrations } from '../../../schema/core/lib/migrate.mjs';
import { runRoundtrip } from '../../../schema/core/lib/roundtrip.mjs';
import { requireDatabaseUrl, withClient, withScratchDatabase } from '../../../schema/core/lib/connect.mjs';
import { insertSourceRecord, useMigratedDatabase } from './helpers.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(HERE, '../fixtures');
const REPO_ROOT = path.resolve(HERE, '../../../../..');

const db = useMigratedDatabase('violations');
const whitelist = loadWhitelist();

/** 변형을 트랜잭션 안에서 적용하고 검사한 뒤 되돌린다. */
async function withMutation(sqls, fn) {
  await db.client.query('BEGIN');
  try {
    for (const sql of sqls) await db.client.query(sql);
    return await fn();
  } finally {
    await db.client.query('ROLLBACK');
  }
}

function rulesOf(violations) {
  return violations.map((v) => v.rule);
}

test('기준선 — 변형 없는 상태에서는 위반 0건', async () => {
  const violations = await checkCoreSchema(db.client, whitelist);
  assert.equal(violations.length, 0, violations.map((v) => `[${v.rule}] ${v.message}`).join('\n'));
});

test('위반 픽스처 ① price_per_session NOT NULL → FORBID-2 실패', async () => {
  const violations = await withMutation(
    ['ALTER TABLE core.price_plan ALTER COLUMN price_per_session SET NOT NULL'],
    () => checkCoreSchema(db.client, whitelist),
  );
  assert.ok(rulesOf(violations).includes('FORBID-2'), `FORBID-2 가 잡히지 않았다: ${JSON.stringify(violations)}`);
});

test('위반 픽스처 ①b price_per_session DEFAULT 0 → FORBID-2 실패', async () => {
  const violations = await withMutation(
    ['ALTER TABLE core.price_plan ALTER COLUMN price_per_session SET DEFAULT 0'],
    () => checkCoreSchema(db.client, whitelist),
  );
  assert.ok(
    violations.some((v) => v.rule === 'FORBID-2' && v.message.includes('DEFAULT')),
    `DEFAULT 주입이 잡히지 않았다: ${JSON.stringify(violations)}`,
  );
});

test('위반 픽스처 ② 화이트리스트 밖 컬럼 → FORBID-3 실패', async () => {
  const violations = await withMutation(['ALTER TABLE core.venue ADD COLUMN nickname text'], () =>
    checkCoreSchema(db.client, whitelist),
  );
  assert.ok(
    violations.some((v) => v.rule === 'FORBID-3' && v.message.includes('venue.nickname')),
    `화이트리스트 밖 컬럼이 잡히지 않았다: ${JSON.stringify(violations)}`,
  );
});

test('위반 픽스처 ③ core 스키마 7번째 테이블 → REQ-1 실패', async () => {
  const violations = await withMutation(['CREATE TABLE core.venue_extra (id uuid PRIMARY KEY)'], () =>
    checkCoreSchema(db.client, whitelist),
  );
  assert.ok(
    violations.some((v) => v.rule === 'REQ-1' && v.message.includes('venue_extra')),
    `7번째 테이블이 잡히지 않았다: ${JSON.stringify(violations)}`,
  );
});

test('위반 픽스처 ③b core 스키마 뷰 추가도 REQ-1 실패', async () => {
  const violations = await withMutation(['CREATE VIEW core.venue_public AS SELECT id, slug FROM core.venue'], () =>
    checkCoreSchema(db.client, whitelist),
  );
  assert.ok(
    violations.some((v) => v.rule === 'REQ-1' && v.message.includes('venue_public')),
    `core 스키마 뷰가 잡히지 않았다: ${JSON.stringify(violations)}`,
  );
});

test('추가 주입 — 필수 컬럼 제거 → REQ-1 실패', async () => {
  const violations = await withMutation(['ALTER TABLE core.editor_report DROP COLUMN visited_at'], () =>
    checkCoreSchema(db.client, whitelist),
  );
  assert.ok(
    violations.some((v) => v.rule === 'REQ-1' && v.message.includes('editor_report.visited_at')),
    `필수 컬럼 누락이 잡히지 않았다: ${JSON.stringify(violations)}`,
  );
});

test('추가 주입 — UNIQUE 제약 제거 → REQ-1 실패', async () => {
  const violations = await withMutation(['ALTER TABLE core.venue DROP CONSTRAINT venue_slug_key'], () =>
    checkCoreSchema(db.client, whitelist),
  );
  assert.ok(
    violations.some((v) => v.rule === 'REQ-1' && v.message.includes('UNIQUE')),
    `UNIQUE 제약 누락이 잡히지 않았다: ${JSON.stringify(violations)}`,
  );
});

test('추가 주입 — C4 출력 필드의 NOT NULL 해제 → REQ-4 실패', async () => {
  const violations = await withMutation(
    ['ALTER TABLE core.price_plan ALTER COLUMN parser_version DROP NOT NULL'],
    () => checkCoreSchema(db.client, whitelist),
  );
  assert.ok(
    violations.some((v) => v.rule === 'REQ-4' && v.message.includes('parser_version')),
    `REQ-4 타입/NULL 기대값 검사가 동작하지 않았다: ${JSON.stringify(violations)}`,
  );
});

test('추가 주입 — ENUM 라벨 추가 → FORBID-3 실패', async () => {
  const violations = await withMutation(
    [`ALTER TYPE core.venue_category ADD VALUE 'unlisted_axis'`],
    () => checkCoreSchema(db.client, whitelist),
  );
  assert.ok(
    violations.some((v) => v.rule === 'FORBID-3' && v.message.includes('unlisted_axis')),
    `화이트리스트 밖 ENUM 라벨이 잡히지 않았다: ${JSON.stringify(violations)}`,
  );
});

test('추가 주입 — GiST 인덱스 제거 → REQ-2 실패', async () => {
  const violations = await withMutation(['DROP INDEX core.venue_location_gist'], () =>
    checkCoreSchema(db.client, whitelist),
  );
  assert.ok(
    violations.some((v) => v.rule === 'REQ-2' && v.message.includes('GiST')),
    `GiST 인덱스 부재가 잡히지 않았다: ${JSON.stringify(violations)}`,
  );
});

test('위반 픽스처 ④ 금지 축 사전 등재 → FORBID-3 실패', async () => {
  const { readFile } = await import('node:fs/promises');
  const fixture = JSON.parse(await readFile(path.join(FIXTURES, 'whitelist-forbidden-axis.json'), 'utf8'));
  const violations = lintWhitelist(fixture);
  const messages = violations.map((v) => `[${v.rule}] ${v.message}`).join('\n');
  for (const token of ['gender', 'age_band', 'target_audience', 'user_agent', 'device_id']) {
    assert.ok(messages.includes(token), `금지 축 컬럼 ${token} 가 잡히지 않았다:\n${messages}`);
  }
  // 이름을 바꾼 같은 것 — ENUM 라벨 women/men 도 잡혀야 한다.
  assert.ok(messages.includes("target_audience='women'"), `ENUM 라벨 위장이 잡히지 않았다:\n${messages}`);
  assert.ok(messages.includes("age_group='30대'"), `연령대 라벨이 잡히지 않았다:\n${messages}`);
});

test('위반 픽스처 ⑤ venue 참조 FK 의 ON DELETE CASCADE → FORBID-4 실패', async () => {
  const violations = await withMutation(
    [
      'ALTER TABLE core.price_plan DROP CONSTRAINT price_plan_venue_id_fkey',
      `ALTER TABLE core.price_plan
         ADD CONSTRAINT price_plan_venue_id_fkey FOREIGN KEY (venue_id)
         REFERENCES core.venue (id) ON DELETE CASCADE`,
    ],
    () => checkCoreSchema(db.client, whitelist),
  );
  assert.ok(
    violations.some((v) => v.rule === 'FORBID-4'),
    `CASCADE FK 가 잡히지 않았다: ${JSON.stringify(violations)}`,
  );
});

test('위반 픽스처 ⑥ source_record DELETE → 예외', async () => {
  const id = await insertSourceRecord(db.client, 'https://example.test/violation-delete');
  let raised = null;
  try {
    await db.client.query('DELETE FROM core.source_record WHERE id = $1', [id]);
  } catch (err) {
    raised = err;
  }
  assert.ok(raised, 'source_record DELETE 가 성공했다');
  assert.match(raised.message, /append-only/);
});

test('위반 픽스처 ⑦ up 마이그레이션 DROP COLUMN → FORBID-1 (b) 실패', () => {
  const { violations } = checkMigrationIntegrity({
    dir: path.join(FIXTURES, 'migrations-drop-column'),
    manifest: { files: { '0002_drop_column.up.sql': 'x'.repeat(64) } },
    readBase: () => null, // base 에 없는 신규 파일 = (b) 스캔 대상
    relDir: 'packages/db/test/core/fixtures/migrations-drop-column',
  });
  assert.ok(
    violations.some((v) => v.rule === 'FORBID-1' && v.message.includes('drop-column')),
    `DROP COLUMN 이 잡히지 않았다: ${JSON.stringify(violations)}`,
  );
});

test('위반 픽스처 ⑦b 머지된 up 파일 편집 → FORBID-1 (a) 실패', () => {
  const { violations } = checkMigrationIntegrity({
    dir: MIGRATIONS_DIR,
    manifest: { files: { '0001_core_schema.up.sql': 'y'.repeat(64) } },
    // base 에는 다른 내용이 있었다고 주입한다 = 머지 후 편집된 상태
    readBase: () => '-- base 에 머지되어 있던 원본 내용\nCREATE SCHEMA core;\n',
    relDir: 'packages/db/migrations',
  });
  assert.ok(
    violations.some((v) => v.rule === 'FORBID-1' && v.message.includes('편집되었다')),
    `머지된 파일 편집이 잡히지 않았다: ${JSON.stringify(violations)}`,
  );
  assert.ok(
    violations.some((v) => v.message.includes('매니페스트 sha256 불일치')),
    '매니페스트 대조가 동작하지 않았다',
  );
});

test('FORBID-1 (a) — base 리더가 실제 git 에서 파일을 읽는다', () => {
  const read = gitBaseFileReader(REPO_ROOT, 'origin/main');
  // origin/main 에 존재하는 파일은 내용이 나와야 하고,
  const existing = read('packages/db/package.json');
  assert.ok(existing && existing.includes('@glowmate/db'), 'base 파일을 읽지 못했다 — (a) 검사가 항상 신규로 판정된다');
  // 존재하지 않는 파일은 null 이어야 한다(= 신규 도입으로 판정).
  assert.equal(read('packages/db/migrations/9999_does_not_exist.up.sql'), null);
});

test('FORBID-1 — 실제 up 마이그레이션에는 데이터 손실형 DDL 이 없다', () => {
  const migrations = loadMigrations();
  assert.ok(migrations.length > 0);
  for (const m of migrations) {
    assert.deepEqual(scanDestructiveDDL(m.upSql), [], `${m.upFile} 에 데이터 손실형 DDL 이 있다`);
  }
});

test('FORBID-1 예외 — 세 조건 중 하나라도 없으면 예외가 아니다', () => {
  const full = {
    labels: ['allow-destructive'],
    codeownerApprovers: ['reviewer'],
    author: 'implementer',
    artifacts: ['db-backup-2026-08-03'],
  };
  assert.equal(evaluateDestructiveException(full).allowed, true);
  assert.equal(evaluateDestructiveException({ ...full, labels: [] }).allowed, false);
  assert.equal(evaluateDestructiveException({ ...full, codeownerApprovers: [] }).allowed, false);
  assert.equal(evaluateDestructiveException({ ...full, artifacts: [] }).allowed, false);
  // 자기 승인은 승인이 아니다.
  assert.equal(evaluateDestructiveException({ ...full, codeownerApprovers: ['implementer'] }).allowed, false);
  // 근거를 조회하지 못한 상태도 예외가 아니다.
  assert.equal(evaluateDestructiveException({}).allowed, false);
});

test('위반 픽스처 ⑧ no-op down → REQ-7 실패', async () => {
  const url = requireDatabaseUrl();
  const result = await withScratchDatabase(url, 'noopdown', (scratchUrl) =>
    withClient(scratchUrl, (client) =>
      runRoundtrip(client, { dir: path.join(FIXTURES, 'migrations-noop-down') }),
    ),
  );
  assert.equal(result.ok, false, 'no-op down 이 REQ-7 을 통과했다 — 되돌림 실효성 검사가 공허하다');
  assert.ok(
    result.failures.some((f) => f.includes('되돌림 실효성')),
    `기대한 실패 사유가 아니다: ${result.failures.join(' / ')}`,
  );
});
