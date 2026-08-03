// packages/db/test/core/db/constraints-core.test.mjs — `pnpm test:constraints-core` (REQ-3)
//
// (a) price_unit_type='unparseable' → failure_reason NOT NULL
// (b) price_unit_type NOT IN ('per_session','single_session') → price_per_session IS NULL
// (c) price_per_session IS NULL OR price_per_session > 0
// 그리고 raw_text NULL 은 23502.
//
// **짝이 되는 정상 동작**: C4 불변식 정합 픽스처 3종이 전부 INSERT 성공해야 한다.
// 이것이 없으면 "전부 거부하는 스키마"가 만점을 받는다 — 그 상태에서 C4 는 착수 즉시 대기가 된다.

import assert from 'node:assert/strict';
import test from 'node:test';
import { expectSqlState, insertSourceRecord, insertVenue, useMigratedDatabase } from './helpers.mjs';

const db = useMigratedDatabase('constraints');
const ids = { venue: null, source: null };

test('픽스처 준비', async () => {
  ids.venue = await insertVenue(db.client, 'constraints-venue');
  ids.source = await insertSourceRecord(db.client);
});

function insertPlan(overrides = {}) {
  const row = {
    price_unit_type: 'per_session',
    total_amount_krw: 650000,
    session_count: 10,
    price_per_session: 65000,
    price_per_month_krw: null,
    period_days: null,
    failure_reason: null,
    raw_text: '10회 65만원',
    source_snippet: '10회 65만원',
    parser_version: 'test-0',
    ...overrides,
  };
  return db.client.query(
    `INSERT INTO core.price_plan
       (venue_id, source_record_id, raw_text, price_unit_type, total_amount_krw, session_count,
        price_per_session, price_per_month_krw, period_days, failure_reason,
        source_snippet, captured_at, parser_version)
     VALUES ($1, $2, $3, $4::core.price_unit_type, $5, $6, $7, $8, $9, $10, $11, now(), $12)
     RETURNING id`,
    [
      ids.venue,
      ids.source,
      row.raw_text,
      row.price_unit_type,
      row.total_amount_krw,
      row.session_count,
      row.price_per_session,
      row.price_per_month_krw,
      row.period_days,
      row.failure_reason,
      row.source_snippet,
      row.parser_version,
    ],
  );
}

test('REQ-3 (a) — unparseable 인데 failure_reason 이 없으면 23514', async () => {
  await expectSqlState(
    db.client,
    `INSERT INTO core.price_plan
       (venue_id, source_record_id, raw_text, price_unit_type, source_snippet, captured_at, parser_version)
     VALUES ($1, $2, '문의', 'unparseable', '문의', now(), 'test-0')`,
    [ids.venue, ids.source],
    '23514',
  );
});

test('REQ-3 (b) — period_pass 에 price_per_session 을 넣으면 23514', async () => {
  await expectSqlState(
    db.client,
    `INSERT INTO core.price_plan
       (venue_id, source_record_id, raw_text, price_unit_type, total_amount_krw, period_days,
        price_per_month_krw, price_per_session, source_snippet, captured_at, parser_version)
     VALUES ($1, $2, '3개월 무제한 45만', 'period_pass', 450000, 90, 150000, 5000, '3개월 무제한 45만', now(), 'test-0')`,
    [ids.venue, ids.source],
    '23514',
  );
});

test('REQ-3 (b) — unparseable 에 price_per_session 을 넣어도 23514', async () => {
  await expectSqlState(
    db.client,
    `INSERT INTO core.price_plan
       (venue_id, source_record_id, raw_text, price_unit_type, price_per_session, failure_reason,
        source_snippet, captured_at, parser_version)
     VALUES ($1, $2, '문의', 'unparseable', 65000, 'OUT_OF_RANGE', '문의', now(), 'test-0')`,
    [ids.venue, ids.source],
    '23514',
  );
});

test('REQ-3 (c) — price_per_session = 0 이면 23514', async () => {
  await expectSqlState(
    db.client,
    `INSERT INTO core.price_plan
       (venue_id, source_record_id, raw_text, price_unit_type, total_amount_krw, session_count,
        price_per_session, source_snippet, captured_at, parser_version)
     VALUES ($1, $2, '10회 0원', 'per_session', 650000, 10, 0, '10회 0원', now(), 'test-0')`,
    [ids.venue, ids.source],
    '23514',
  );
});

test('REQ-3 (c) — price_per_session 이 음수여도 23514', async () => {
  await expectSqlState(
    db.client,
    `INSERT INTO core.price_plan
       (venue_id, source_record_id, raw_text, price_unit_type, total_amount_krw, session_count,
        price_per_session, source_snippet, captured_at, parser_version)
     VALUES ($1, $2, '10회 -65만', 'per_session', 650000, 10, -65000, '10회 -65만', now(), 'test-0')`,
    [ids.venue, ids.source],
    '23514',
  );
});

test('REQ-3 — raw_text NULL 은 23502', async () => {
  await expectSqlState(
    db.client,
    `INSERT INTO core.price_plan
       (venue_id, source_record_id, raw_text, price_unit_type, total_amount_krw, session_count,
        price_per_session, source_snippet, captured_at, parser_version)
     VALUES ($1, $2, NULL, 'per_session', 650000, 10, 65000, '10회 65만', now(), 'test-0')`,
    [ids.venue, ids.source],
    '23502',
  );
});

test('REQ-3 — C4 불변식 픽스처 ① single_session (price_per_session = total_amount_krw) INSERT 성공', async () => {
  const res = await insertPlan({
    price_unit_type: 'single_session',
    total_amount_krw: 80000,
    session_count: 1,
    price_per_session: 80000,
    failure_reason: null,
    raw_text: '1회 8만원',
    source_snippet: '1회 8만원',
  });
  assert.equal(res.rowCount, 1);
});

test('REQ-3 — C4 불변식 픽스처 ② period_pass (price_per_session NULL · failure_reason NULL) INSERT 성공', async () => {
  const res = await insertPlan({
    price_unit_type: 'period_pass',
    total_amount_krw: 450000,
    session_count: null,
    price_per_session: null,
    price_per_month_krw: 150000,
    period_days: 90,
    failure_reason: null,
    raw_text: '3개월 무제한 45만원',
    source_snippet: '3개월 무제한 45만원',
  });
  assert.equal(res.rowCount, 1);
});

test('REQ-3 — C4 불변식 픽스처 ③ unparseable (금액 4종 NULL · failure_reason 有) INSERT 성공', async () => {
  const res = await insertPlan({
    price_unit_type: 'unparseable',
    total_amount_krw: null,
    session_count: null,
    price_per_session: null,
    price_per_month_krw: null,
    period_days: null,
    failure_reason: 'PRICE_NOT_FOUND',
    raw_text: '가격은 전화 문의',
    source_snippet: '가격은 전화 문의',
  });
  assert.equal(res.rowCount, 1);
});

test('REQ-3 — per_session 정상 픽스처도 INSERT 성공 (전량 거부 구현 방지)', async () => {
  const res = await insertPlan({ raw_text: '10회 65만원(정상)', source_snippet: '10회 65만원' });
  assert.equal(res.rowCount, 1);
});

test('REQ-3 — 저장된 행이 실제로 4건이다 (INSERT 가 조용히 사라지지 않았다)', async () => {
  const res = await db.client.query('SELECT count(*)::int AS n FROM core.price_plan');
  assert.equal(res.rows[0].n, 4);
});
