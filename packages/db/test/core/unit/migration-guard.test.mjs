// packages/db/test/core/unit/migration-guard.test.mjs — DB 없이 판정 가능한 부분
// (FORBID-1 파괴적 DDL/매니페스트 · REQ-7 up/down 쌍 · REQ-2 플래너 부정행위 스캔)

import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  DESTRUCTIVE_PATTERNS,
  buildManifest,
  checkMigrationIntegrity,
  evaluateDestructiveException,
  loadManifest,
  scanDestructiveDDL,
  stripSqlComments,
} from '../../../schema/core/lib/destructive.mjs';
import { MIGRATIONS_DIR, loadMigrations, sha256 } from '../../../schema/core/lib/migrate.mjs';
import { PLANNER_OVERRIDE_RE, collectNodeTypes, scanPlannerOverrides } from '../../../schema/core/lib/plannerguard.mjs';

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const FIXTURES = path.join(PKG_ROOT, 'test/core/fixtures');

test('REQ-7 — 모든 마이그레이션이 up/down 쌍을 갖는다', () => {
  const migrations = loadMigrations();
  assert.ok(migrations.length >= 1);
  for (const m of migrations) {
    assert.ok(m.upSql.trim().length > 0, `${m.upFile} 가 비었다`);
    assert.ok(m.downSql.trim().length > 0, `${m.downFile} 가 비었다`);
  }
});

test('FORBID-1 (a) — 매니페스트가 현재 up 파일과 일치한다', () => {
  const manifest = loadManifest();
  assert.ok(manifest, '매니페스트 파일이 없다');
  assert.deepEqual(manifest.files, buildManifest(MIGRATIONS_DIR));
});

test('FORBID-1 (b) — 실제 up 파일에 데이터 손실형 DDL 이 없다', () => {
  for (const m of loadMigrations()) {
    assert.deepEqual(scanDestructiveDDL(m.upSql), [], `${m.upFile}`);
  }
});

test('FORBID-1 (b) — 패턴별 위반 문자열이 각각 잡힌다', () => {
  const cases = {
    'drop-table': 'DROP TABLE core.venue;',
    'drop-column': 'ALTER TABLE core.venue DROP COLUMN slug;',
    truncate: 'TRUNCATE core.price_plan;',
    'alter-type-using': "ALTER TABLE core.venue ALTER COLUMN gu TYPE text USING gu::text;",
    'drop-schema': 'DROP SCHEMA core CASCADE;',
    'drop-database': 'DROP DATABASE glowmate;',
  };
  for (const [id, sql] of Object.entries(cases)) {
    const hits = scanDestructiveDDL(sql);
    assert.ok(hits.some((h) => h.id === id), `${id} 가 잡히지 않았다: ${sql}`);
  }
  assert.equal(DESTRUCTIVE_PATTERNS.length, Object.keys(cases).length);
});

test('FORBID-1 (b) — 정상 DDL 은 오탐하지 않는다', () => {
  const benign = [
    'CREATE TABLE core.venue (id uuid PRIMARY KEY);',
    'CREATE INDEX venue_location_gist ON core.venue USING GIST (location);',
    "CREATE TYPE core.price_unit_type AS ENUM ('per_session');",
    'ALTER TABLE core.venue ADD COLUMN visibility text;',
  ];
  for (const sql of benign) assert.deepEqual(scanDestructiveDDL(sql), [], sql);
});

test('FORBID-1 (b) — 주석은 제거하되 문자열은 남긴다 (EXECUTE 우회 미탐 방지)', () => {
  assert.deepEqual(scanDestructiveDDL('-- DROP TABLE core.venue;\nSELECT 1;'), []);
  assert.deepEqual(scanDestructiveDDL('/* TRUNCATE core.venue */ SELECT 1;'), []);
  assert.ok(scanDestructiveDDL("EXECUTE 'DROP TABLE core.venue';").length > 0);
  assert.ok(stripSqlComments('-- x\nSELECT 1').includes('SELECT 1'));
});

test('FORBID-1 (a) — 신규 파일에 매니페스트 등재가 없으면 실패', () => {
  const { violations } = checkMigrationIntegrity({
    dir: MIGRATIONS_DIR,
    manifest: { files: {} },
    readBase: () => null,
    relDir: 'packages/db/migrations',
  });
  assert.ok(violations.some((v) => v.message.includes('등재되지 않은 up 파일')));
});

test('FORBID-1 (a) — base 와 동일하면 위반 0건', () => {
  const migrations = loadMigrations();
  const files = {};
  for (const m of migrations) files[m.upFile] = sha256(m.upSql);
  const { violations, checked } = checkMigrationIntegrity({
    dir: MIGRATIONS_DIR,
    manifest: { files },
    readBase: (rel) => migrations.find((m) => rel.endsWith(m.upFile))?.upSql ?? null,
    relDir: 'packages/db/migrations',
  });
  assert.deepEqual(violations, []);
  assert.equal(checked.inBase, migrations.length);
});

test('FORBID-1 — 매니페스트가 없으면 통과가 아니라 실패', () => {
  const { violations } = checkMigrationIntegrity({
    dir: MIGRATIONS_DIR,
    manifest: null,
    readBase: () => null,
    relDir: 'packages/db/migrations',
  });
  assert.ok(violations.some((v) => v.message.includes('매니페스트')));
});

test('FORBID-1 — 삭제된 마이그레이션(매니페스트에만 존재)도 잡는다', () => {
  const manifest = { files: { ...buildManifest(MIGRATIONS_DIR), '0000_ghost.up.sql': 'z'.repeat(64) } };
  const { violations } = checkMigrationIntegrity({
    dir: MIGRATIONS_DIR,
    manifest,
    readBase: () => null,
    relDir: 'packages/db/migrations',
  });
  assert.ok(violations.some((v) => v.message.includes('매니페스트에만 있는 up 파일')));
});

test('FORBID-1 예외 — 라벨만으로는 열리지 않는다', () => {
  const onlyLabel = evaluateDestructiveException({
    labels: ['allow-destructive'],
    author: 'implementer',
    codeownerApprovers: [],
    artifacts: [],
  });
  assert.equal(onlyLabel.allowed, false);
  assert.equal(onlyLabel.reasons.length, 2);
});

test('REQ-2 — 플래너 부정행위 스캐너가 실제 구문을 잡는다', () => {
  // 케이스 문자열을 런타임에 조립한다 — 이 파일 자신이 스캔 대상이기 때문이다.
  // 제외 목록을 두는 대신 이렇게 하면, 제외 목록에 한 줄 더하는 우회 경로가 애초에 없다.
  const seqscan = ['enable', 'seqscan'].join('_');
  const bitmap = ['enable', 'bitmapscan'].join('_');
  const pageCost = ['random', 'page', 'cost'].join('_');
  const cheats = [
    `SET ${seqscan} = off;`,
    `SELECT set_config('${seqscan}', 'off', true);`,
    `SET LOCAL ${pageCost} = 0.1;`,
    `ALTER DATABASE glowmate SET ${bitmap} = off;`,
  ];
  for (const sql of cheats) assert.ok(PLANNER_OVERRIDE_RE.test(sql), `잡히지 않았다: ${sql}`);
  const benign = ['SET search_path = core;', "SELECT set_config('core.tombstone_in_progress', 'on', true);"];
  for (const sql of benign) assert.ok(!PLANNER_OVERRIDE_RE.test(sql), `오탐: ${sql}`);
});

test('REQ-2 — 스캐너 자신을 포함해 스캔해도 위반 0건 (자기 제외 목록 없음)', () => {
  const hits = scanPlannerOverrides([path.join(PKG_ROOT, 'schema'), path.join(PKG_ROOT, 'test')]);
  assert.deepEqual(hits, []);
});

test('REQ-2 — 계획 트리 노드 수집이 중첩 계획을 훑는다', () => {
  const plan = [{ Plan: { 'Node Type': 'Bitmap Heap Scan', Plans: [{ 'Node Type': 'Bitmap Index Scan' }] } }];
  assert.deepEqual(collectNodeTypes(plan), ['Bitmap Heap Scan', 'Bitmap Index Scan']);
});

test('픽스처 — no-op down 픽스처의 down 이 실제로 비어 있다', () => {
  const fixture = loadMigrations(path.join(FIXTURES, 'migrations-noop-down'));
  assert.equal(fixture.length, 1);
  assert.equal(fixture[0].downSql.replace(/--[^\n]*/g, '').trim(), '');
  assert.ok(fixture[0].upSql.includes('CREATE TABLE'));
});
