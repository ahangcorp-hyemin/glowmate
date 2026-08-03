// packages/db/schema/core/lib/connect.mjs — F2a
//
// 검사기·마이그레이션 러너가 쓰는 최소 접속 헬퍼.
//
// 원칙
//   - DATABASE_URL 이 없으면 **조용히 통과하지 않고** 즉시 실패한다. DB 없이 초록인 스키마
//     검사는 아무것도 검사하지 않는 검사이며, 그 상태가 하류 5계약의 detect 기반이 된다.
//   - mock·인메모리 스텁을 두지 않는다(REQ-2 acceptance: mock 금지).

import process from 'node:process';
import { URL } from 'node:url';
import pg from 'pg';

const { Client } = pg;

/** 필수 환경변수. 부재를 기본값으로 메우지 않는다. */
export function requireDatabaseUrl(env = process.env) {
  const url = env['DATABASE_URL'];
  if (url === undefined || url === '') {
    throw new Error(
      'DATABASE_URL 이 없다 — F2a 의 스키마 검사는 실제 PostGIS 인스턴스에서만 판정한다 (mock 금지). ' +
        '예: postgres://postgres:postgres@127.0.0.1:5432/glowmate_test',
    );
  }
  return url;
}

/** 같은 서버의 다른 데이터베이스를 가리키는 URL 을 만든다. */
export function withDatabase(url, dbName) {
  const u = new URL(url);
  u.pathname = `/${dbName}`;
  return u.toString();
}

export function databaseNameOf(url) {
  const name = new URL(url).pathname.replace(/^\//, '');
  if (name === '') throw new Error(`DATABASE_URL 에 데이터베이스 이름이 없다: ${url}`);
  return name;
}

/** 접속 → 콜백 실행 → 반드시 종료. 예외는 삼키지 않는다. */
export async function withClient(url, fn) {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/**
 * 시험용 데이터베이스를 만들고, 콜백 후 반드시 제거한다.
 *
 * DDL 을 실제로 변형하는 위반 픽스처(7종)를 공유 DB 에서 돌리면 다른 검사가 오염된다.
 * 트랜잭션 롤백으로도 대부분 되지만, 롤백에 의존하면 "정리에 실패해도 초록"인 경로가 생긴다.
 */
export async function withScratchDatabase(baseUrl, label, fn) {
  const suffix = `${process.pid.toString(36)}${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  const name = `gm_f2a_${label}_${suffix}`.slice(0, 60).toLowerCase();
  const adminUrl = withDatabase(baseUrl, 'postgres');

  await withClient(adminUrl, async (admin) => {
    await admin.query(`CREATE DATABASE ${quoteIdent(name)}`);
  });
  try {
    return await fn(withDatabase(baseUrl, name), name);
  } finally {
    await withClient(adminUrl, async (admin) => {
      await admin.query(
        'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
        [name],
      );
      await admin.query(`DROP DATABASE IF EXISTS ${quoteIdent(name)}`);
    });
  }
}

export function quoteIdent(name) {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
    throw new Error(`식별자로 쓸 수 없는 이름이다: ${name}`);
  }
  return `"${name}"`;
}
