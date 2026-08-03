// packages/db/schema/core/lib/migrate.mjs — F2a
//
// 마이그레이션 러너. up/down 쌍이 없는 버전은 **로드 단계에서 실패**한다(REQ-7 전제).
//
// 원장(ledger)은 core 스키마 밖(public.schema_migration)에 둔다 —
// REQ-1 이 core 를 6테이블 집합 동등으로 못박았기 때문이다.
//
// bootstrap(원장 + PostGIS 확장)은 마이그레이션이 아니라 **환경 준비**다. down 이 확장을
// 지우지 않는 이유와 짝을 이룬다: 확장을 up/down 대상으로 만들면 되돌림 단위가
// 데이터베이스 밖으로 넘어가 REQ-7 의 왕복 동일성이 환경 상태에 좌우된다.

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MIGRATIONS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../migrations',
);

const FILE_RE = /^(\d{4})_([a-z0-9_]+)\.(up|down)\.sql$/;

export function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** 마이그레이션 목록을 버전 오름차순으로 로드한다. up/down 짝이 없으면 실패. */
export function loadMigrations(dir = MIGRATIONS_DIR) {
  const entries = fs.readdirSync(dir).filter((f) => f.endsWith('.sql'));
  const byVersion = new Map();

  for (const file of entries) {
    const m = FILE_RE.exec(file);
    if (!m) {
      throw new Error(
        `마이그레이션 파일명 규약 위반: ${file} (기대: NNNN_name.up.sql / NNNN_name.down.sql)`,
      );
    }
    const [, version, name, direction] = m;
    const key = `${version}_${name}`;
    const rec = byVersion.get(key) ?? { version, name, key };
    rec[direction] = path.join(dir, file);
    byVersion.set(key, rec);
  }

  const list = [...byVersion.values()].sort((a, b) => a.version.localeCompare(b.version));
  const broken = list.filter((r) => !r.up || !r.down);
  if (broken.length > 0) {
    throw new Error(
      `REQ-7 위반 — up/down 쌍이 없는 마이그레이션: ${broken.map((r) => r.key).join(', ')}`,
    );
  }
  if (list.length === 0) {
    throw new Error(`마이그레이션이 0건이다: ${dir} — 빈 목록을 성공으로 처리하지 않는다`);
  }
  return list.map((r) => ({
    ...r,
    upSql: fs.readFileSync(r.up, 'utf8'),
    downSql: fs.readFileSync(r.down, 'utf8'),
    upFile: path.basename(r.up),
    downFile: path.basename(r.down),
  }));
}

export async function bootstrap(client) {
  await client.query('CREATE EXTENSION IF NOT EXISTS postgis');
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migration (
      version     text PRIMARY KEY,
      name        text NOT NULL,
      up_sha256   text NOT NULL,
      applied_at  timestamptz NOT NULL DEFAULT now()
    )
  `);
}

export async function appliedVersions(client) {
  const res = await client.query('SELECT version FROM public.schema_migration ORDER BY version');
  return res.rows.map((r) => r.version);
}

/** 미적용 마이그레이션을 순서대로 적용한다. 각 버전은 단일 트랜잭션. */
export async function migrateUp(client, { dir = MIGRATIONS_DIR, log = () => {} } = {}) {
  await bootstrap(client);
  const applied = new Set(await appliedVersions(client));
  const pending = loadMigrations(dir).filter((m) => !applied.has(m.version));

  for (const m of pending) {
    await client.query('BEGIN');
    try {
      await client.query(m.upSql);
      await client.query(
        'INSERT INTO public.schema_migration (version, name, up_sha256) VALUES ($1, $2, $3)',
        [m.version, m.name, sha256(m.upSql)],
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`up ${m.upFile} 적용 실패: ${err.message}`);
    }
    log(`up   ${m.upFile}`);
  }
  return pending.map((m) => m.version);
}

/** to 버전 **초과**의 적용분을 역순으로 되돌린다. to=null 이면 전부 되돌린다. */
export async function migrateDown(client, { dir = MIGRATIONS_DIR, to = null, log = () => {} } = {}) {
  await bootstrap(client);
  const applied = new Set(await appliedVersions(client));
  const targets = loadMigrations(dir)
    .filter((m) => applied.has(m.version))
    .filter((m) => to === null || m.version > to)
    .reverse();

  for (const m of targets) {
    await client.query('BEGIN');
    try {
      await client.query(m.downSql);
      await client.query('DELETE FROM public.schema_migration WHERE version = $1', [m.version]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw new Error(`down ${m.downFile} 실행 실패: ${err.message}`);
    }
    log(`down ${m.downFile}`);
  }
  return targets.map((m) => m.version);
}
