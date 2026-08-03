// packages/db/test/core/unit/whitelist.test.mjs — DB 없이 판정 가능한 부분 (REQ-6 / FORBID-3)
//
// 이 디렉터리의 테스트는 `pnpm test`(F1 test job)에서 DB 없이 돈다.
// DB 가 필요한 판정은 test/core/db/ 에 있고 db-schema job 이 돌린다.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  FORBIDDEN_LABEL_PATTERNS,
  FORBIDDEN_NAME_PATTERNS,
  RESERVED_FOR_F2B,
  allowedColumnsFor,
  lintWhitelist,
  loadWhitelist,
} from '../../../schema/core/lib/whitelist.mjs';

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures');

test('REQ-6 — 커밋된 화이트리스트는 위반 0건', () => {
  const violations = lintWhitelist(loadWhitelist());
  assert.equal(violations.length, 0, violations.map((v) => `[${v.rule}] ${v.message}`).join('\n'));
});

test('REQ-6 — reserved_for_f2b 는 계약이 못박은 3컬럼과 집합 동등', () => {
  const wl = loadWhitelist();
  assert.deepEqual([...wl.reserved_for_f2b].sort(), [...RESERVED_FOR_F2B].sort());
});

test('REQ-6 — reserved 컬럼은 아직 존재하지 않지만 허용 집합에는 들어간다', () => {
  const wl = loadWhitelist();
  assert.ok(allowedColumnsFor(wl, 'venue').has('visibility'));
  assert.ok(allowedColumnsFor(wl, 'price_plan').has('confidence'));
  assert.ok(!allowedColumnsFor(wl, 'need_tag').has('visibility'));
});

test('REQ-6 — reserved 개수가 3이 아니면 실패', () => {
  const wl = globalThis.structuredClone(loadWhitelist());
  wl.reserved_for_f2b = [...RESERVED_FOR_F2B, 'venue.something_else'];
  const violations = lintWhitelist(wl);
  assert.ok(violations.some((v) => v.rule === 'REQ-6' && v.message.includes('길이가 4')));
});

test('REQ-6 — reserved 항목을 바꿔치기하면 실패', () => {
  const wl = globalThis.structuredClone(loadWhitelist());
  wl.reserved_for_f2b = ['venue.visibility', 'price_plan.visibility', 'venue.free_pass'];
  const violations = lintWhitelist(wl);
  assert.ok(violations.some((v) => v.message.includes('누락: price_plan.confidence')));
  assert.ok(violations.some((v) => v.message.includes('초과 등재: venue.free_pass')));
});

test('FORBID-3 — 금지 축 픽스처가 실패한다 (컬럼명 + ENUM 라벨 양쪽)', () => {
  const fixture = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'whitelist-forbidden-axis.json'), 'utf8'));
  const violations = lintWhitelist(fixture);
  assert.ok(violations.length >= 7, `잡힌 위반이 ${violations.length}건뿐이다`);
  const messages = violations.map((v) => v.message).join('\n');
  for (const token of ['gender', 'age_band', 'target_audience', 'user_agent', 'device_id', 'women', '30대']) {
    assert.ok(messages.includes(token), `${token} 가 잡히지 않았다:\n${messages}`);
  }
});

test('FORBID-3 — 패턴 사전이 비어 있지 않다 (공허한 검사 방지)', () => {
  assert.ok(FORBIDDEN_NAME_PATTERNS.length >= 5);
  assert.ok(FORBIDDEN_LABEL_PATTERNS.length >= 2);
});

test('FORBID-3 — 정상 컬럼명은 오탐하지 않는다', () => {
  const benign = [
    'id', 'slug', 'name', 'category', 'gu', 'location', 'created_at', 'updated_at',
    'price_per_session', 'session_count', 'parser_version', 'source_url', 'raw_payload',
    'fetched_at', 'visited_at', 'editor_id', 'ontology_id', 'evidence_snippet', 'is_promotional',
  ];
  for (const col of benign) {
    for (const p of FORBIDDEN_NAME_PATTERNS) {
      assert.ok(!p.re.test(col), `오탐: ${col} 이 패턴 ${p.id} 에 매치되었다`);
    }
  }
});

test('REQ-6 — tables 가 비면 실패 (빈 기대값을 통과시키지 않는다)', () => {
  assert.ok(lintWhitelist({ tables: {}, enums: {}, reserved_for_f2b: RESERVED_FOR_F2B }).length > 0);
  assert.ok(lintWhitelist({}).length > 0);
});
