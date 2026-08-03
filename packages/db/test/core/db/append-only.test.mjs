// packages/db/test/core/db/append-only.test.mjs — `pnpm test:append-only` (REQ-5 / FORBID-5)
//
// source_record 는 append-only 다. UPDATE·DELETE 는 DB 레벨에서 거부되고,
// 보존기간 만료·파기 요구는 core.tombstone_source_record(id, reason) 로만 처리된다.
//
// 왜 DB 레벨인가: 애플리케이션 규칙으로 두면 "이번 한 번만" 실행하는 스크립트가 반드시 생기고,
// 그 순간 어느 가격이 어느 원문에서 왔는지 영구히 알 수 없게 된다.

import assert from 'node:assert/strict';
import test from 'node:test';
import { insertSourceRecord, useMigratedDatabase } from './helpers.mjs';

const db = useMigratedDatabase('appendonly');

async function expectRejected(promise, label) {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  throw new Error(`${label} — 거부되어야 할 구문이 성공했다`);
}

test('REQ-5 — UPDATE 1건이 예외로 거부된다', async () => {
  const id = await insertSourceRecord(db.client, 'https://example.test/update');
  const err = await expectRejected(
    db.client.query(`UPDATE core.source_record SET source_url = 'https://evil.test' WHERE id = $1`, [id]),
    'source_record UPDATE',
  );
  assert.match(err.message, /append-only/);
});

test('FORBID-5 — tombstone 함수를 우회한 raw_payload 직접 UPDATE 도 거부된다', async () => {
  const id = await insertSourceRecord(db.client, 'https://example.test/bypass');
  const err = await expectRejected(
    db.client.query(
      `UPDATE core.source_record
          SET raw_payload = NULL, tombstoned_at = now(), tombstone_reason = '우회'
        WHERE id = $1`,
      [id],
    ),
    'tombstone 우회 UPDATE',
  );
  assert.match(err.message, /append-only/);
});

test('FORBID-5 — 플래그를 스스로 세워도 tombstone 효과 밖의 변경은 거부된다', async () => {
  const id = await insertSourceRecord(db.client, 'https://example.test/flag');
  await db.client.query(`SELECT set_config('core.tombstone_in_progress', 'on', false)`);
  const err = await expectRejected(
    db.client.query(
      `UPDATE core.source_record
          SET source_url = 'https://evil.test', tombstoned_at = now(), tombstone_reason = 'x'
        WHERE id = $1`,
      [id],
    ),
    '플래그 위조 UPDATE',
  );
  assert.match(err.message, /tombstone 효과/);
  await db.client.query(`SELECT set_config('core.tombstone_in_progress', 'off', false)`);
});

test('REQ-5 — DELETE 1건이 예외로 거부된다', async () => {
  const id = await insertSourceRecord(db.client, 'https://example.test/delete');
  const err = await expectRejected(
    db.client.query('DELETE FROM core.source_record WHERE id = $1', [id]),
    'source_record DELETE',
  );
  assert.match(err.message, /append-only/);
  const res = await db.client.query('SELECT count(*)::int AS n FROM core.source_record WHERE id = $1', [id]);
  assert.equal(res.rows[0].n, 1, 'DELETE 가 거부됐는데 행이 사라졌다');
});

test('REQ-5 — tombstone 함수 호출 후 행은 남고 raw_payload 만 비워진다', async () => {
  const id = await insertSourceRecord(db.client, 'https://example.test/tombstone');
  await db.client.query('SELECT core.tombstone_source_record($1, $2)', [id, '보존기간 만료(테스트)']);

  const res = await db.client.query(
    `SELECT raw_payload, tombstoned_at, tombstone_reason, source_url, source_license_status
       FROM core.source_record WHERE id = $1`,
    [id],
  );
  assert.equal(res.rowCount, 1, 'tombstone 후 행이 조회되지 않는다');
  const row = res.rows[0];
  assert.equal(row.raw_payload, null);
  assert.notEqual(row.tombstoned_at, null);
  assert.equal(row.tombstone_reason, '보존기간 만료(테스트)');
  // 출처 추적에 필요한 필드는 남아 있어야 한다 — 이게 사라지면 정정 요청에 답할 수 없다.
  assert.equal(row.source_url, 'https://example.test/tombstone');
  assert.equal(row.source_license_status, 'conditional');
});

test('REQ-5 — 사유 없는 tombstone 은 거부된다', async () => {
  const id = await insertSourceRecord(db.client, 'https://example.test/noreason');
  const err = await expectRejected(
    db.client.query('SELECT core.tombstone_source_record($1, $2)', [id, '   ']),
    '사유 없는 tombstone',
  );
  assert.match(err.message, /사유/);
});

test('REQ-5 — 원문 없는 행은 애초에 INSERT 되지 않는다', async () => {
  const err = await expectRejected(
    db.client.query(
      `INSERT INTO core.source_record (source_url, raw_payload, fetched_at, source_license_status)
       VALUES ('https://example.test/nopayload', NULL, now(), 'allowed')`,
    ),
    'raw_payload NULL INSERT',
  );
  assert.equal(err.code, '23514');
});
