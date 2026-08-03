// packages/db/test/core/db/schema-core.test.mjs — `pnpm test:schema-core`
//
// REQ-1 (테이블 집합 동등 · 필수 컬럼/제약) · REQ-4 (C4 출력 6필드) · REQ-6 (화이트리스트)
// FORBID-2 (price_per_session) · FORBID-3 (화이트리스트 밖 컬럼·ENUM 라벨) · FORBID-4 (CASCADE FK)
//
// 기대값은 schema/core/lib/checks.mjs 에 하드코딩되어 있고, 이 파일은 그 판정이 위반 0건임을
// 확인한다. 위반이 실제로 잡히는지는 violations.test.mjs 가 DDL 을 변형해 확인한다
// (검사기가 항상 빈 배열을 돌려줘도 통과하는 상태를 남기지 않기 위해서다).

import assert from 'node:assert/strict';
import test from 'node:test';
import { EXPECTED_TABLES, checkCoreSchema } from '../../../schema/core/lib/checks.mjs';
import { loadWhitelist } from '../../../schema/core/lib/whitelist.mjs';
import { useMigratedDatabase } from './helpers.mjs';

const db = useMigratedDatabase('schema');

test('REQ-1 · REQ-4 · REQ-6 / FORBID-2 · FORBID-3 · FORBID-4 — 위반 0건', async () => {
  const violations = await checkCoreSchema(db.client, loadWhitelist());
  const formatted = violations.map((v) => `[${v.rule}] ${v.message}`).join('\n');
  assert.equal(violations.length, 0, `스키마 위반 ${violations.length}건:\n${formatted}`);
});

test('REQ-1 — core 스키마 테이블이 하드코딩 6개와 집합 동등', async () => {
  const res = await db.client.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'core' ORDER BY table_name`,
  );
  const actual = res.rows.map((r) => r.table_name).sort();
  // 집합 동등 — 부분집합 비교로 구현하면 7번째 테이블이 통과한다.
  assert.deepEqual(actual, [...EXPECTED_TABLES].sort());
});

test('REQ-6 — 화이트리스트가 존재하고 reserved_for_f2b 가 정확히 3개', () => {
  const wl = loadWhitelist();
  assert.deepEqual([...wl.reserved_for_f2b].sort(), [
    'price_plan.confidence',
    'price_plan.visibility',
    'venue.visibility',
  ]);
  assert.equal(wl.reserved_for_f2b.length, 3);
});

test('REQ-1 — 검사기가 실제로 테이블을 읽고 있다(공허한 초록 방지)', async () => {
  const res = await db.client.query(
    `SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema = 'core'`,
  );
  assert.ok(res.rows[0].n >= 30, `core 컬럼 수가 ${res.rows[0].n} 건이다 — 마이그레이션이 적용되지 않았을 수 있다`);
});
