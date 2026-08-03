// packages/db/test/core/db/helpers.mjs — DB 테스트 공용 헬퍼 (F2a)
//
// 모든 DB 테스트는 **격리된 시험용 데이터베이스**를 만들어 마이그레이션을 적용한 뒤 돌린다.
// 공유 DB 를 쓰면 위반 픽스처(DDL 변형)가 다른 검사를 오염시키고, 정리에 실패해도 초록인
// 경로가 생긴다.

import process from 'node:process';
import { after, before } from 'node:test';
import pg from 'pg';
import { requireDatabaseUrl, withClient, withDatabase, quoteIdent } from '../../../schema/core/lib/connect.mjs';
import { migrateUp } from '../../../schema/core/lib/migrate.mjs';

const { Client } = pg;

/**
 * 시험용 DB 를 만들고 마이그레이션을 적용한다.
 * 반환된 객체의 `.client` 는 before 훅 이후에 사용 가능하다.
 */
export function useMigratedDatabase(label) {
  const ctx = { client: null, url: null, name: null };
  const baseUrl = requireDatabaseUrl();
  const adminUrl = withDatabase(baseUrl, 'postgres');
  const suffix = `${process.pid.toString(36)}${Date.now().toString(36)}`;
  const name = `gm_f2a_${label}_${suffix}`.toLowerCase().slice(0, 60);

  before(async () => {
    await withClient(adminUrl, (admin) => admin.query(`CREATE DATABASE ${quoteIdent(name)}`));
    ctx.name = name;
    ctx.url = withDatabase(baseUrl, name);
    ctx.client = new Client({ connectionString: ctx.url });
    await ctx.client.connect();
    await migrateUp(ctx.client);
  });

  after(async () => {
    if (ctx.client) await ctx.client.end();
    await withClient(adminUrl, async (admin) => {
      await admin.query(
        'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
        [name],
      );
      await admin.query(`DROP DATABASE IF EXISTS ${quoteIdent(name)}`);
    });
  });

  return ctx;
}

/** 픽스처용 venue 1건을 넣고 id 를 돌려준다. */
export async function insertVenue(client, slug = 'test-venue') {
  const res = await client.query(
    `INSERT INTO core.venue (slug, name, category, gu, location)
     VALUES ($1, $2, 'exercise_body', 'gangnam',
             ST_SetSRID(ST_MakePoint(127.0276, 37.4979), 4326)::geography)
     RETURNING id`,
    [slug, `테스트 업체 ${slug}`],
  );
  return res.rows[0].id;
}

/** 픽스처용 source_record 1건을 넣고 id 를 돌려준다. */
export async function insertSourceRecord(client, url = 'https://example.test/price') {
  const res = await client.query(
    `INSERT INTO core.source_record (source_url, raw_payload, fetched_at, source_license_status)
     VALUES ($1, $2::jsonb, now(), 'conditional')
     RETURNING id`,
    [url, JSON.stringify({ blob_key: 'blob/1', body_sha256: 'a'.repeat(64), http_status: 200 })],
  );
  return res.rows[0].id;
}

/** SQLSTATE 를 확인하며 실패를 기대하는 실행. 성공하면 그 자체가 테스트 실패다. */
export async function expectSqlState(client, sql, params, expectedCode) {
  try {
    await client.query(sql, params);
  } catch (err) {
    if (err.code !== expectedCode) {
      throw new Error(`기대 SQLSTATE ${expectedCode} 이지만 ${err.code} 였다: ${err.message}`);
    }
    return err;
  }
  throw new Error(`거부되어야 할 구문이 성공했다 (기대 SQLSTATE ${expectedCode}): ${sql.trim().slice(0, 120)}`);
}
