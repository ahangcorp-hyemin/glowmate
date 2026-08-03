// packages/db/schema/core/lib/roundtrip.mjs — F2a REQ-7
//
// up → down → up 왕복의 두 가지 동일성을 판정한다.
//   (1) 되돌림 실효성 : post-down 스냅샷 sha256 == **적용 이전(pre)** 스냅샷 sha256
//   (2) 재적용 동일성 : post-up(2회차) == post-up(1회차)
//
// (1)이 없으면 빈 down 스크립트가 통과한다 — "되돌릴 수 있다"고 적힌 롤백 절차가 실제로는
// 아무것도 되돌리지 않는 상태이며, 그 사실은 사고가 난 다음에야 발견된다.

import { bootstrap, migrateDown, migrateUp, MIGRATIONS_DIR } from './migrate.mjs';
import { captureSnapshot, diffSnapshots, snapshotDigest } from './snapshot.mjs';

/**
 * @param {import('pg').Client} client  **비어 있는** 데이터베이스에 연결된 클라이언트
 * @returns {Promise<{ok: boolean, digests: object, failures: string[], details: string[]}>}
 */
export async function runRoundtrip(client, { dir = MIGRATIONS_DIR, log = () => {} } = {}) {
  // bootstrap(원장 + PostGIS)은 마이그레이션 이전 상태의 일부다. pre 스냅샷 전에 수행해
  // "확장이 있었는가"가 왕복 판정에 섞이지 않게 한다.
  await bootstrap(client);

  const applied = await client.query('SELECT count(*)::int AS n FROM public.schema_migration');
  if (applied.rows[0].n !== 0) {
    throw new Error(
      `REQ-7: 왕복 검사는 마이그레이션이 적용되지 않은 DB 에서 시작해야 한다 (현재 적용 ${applied.rows[0].n}건)`,
    );
  }

  const pre = await captureSnapshot(client);
  log(`pre        sha256=${snapshotDigest(pre)}`);

  await migrateUp(client, { dir, log });
  const postUp1 = await captureSnapshot(client);
  log(`post-up#1  sha256=${snapshotDigest(postUp1)}`);

  await migrateDown(client, { dir, to: null, log });
  const postDown = await captureSnapshot(client);
  log(`post-down  sha256=${snapshotDigest(postDown)}`);

  const failures = [];
  const details = [];

  if (snapshotDigest(postDown) !== snapshotDigest(pre)) {
    // 여기서 멈춘다. 되돌리지 못한 DB 에 다시 up 을 적용하면 "이미 존재한다" 류의 2차 오류가
    // 나면서 진짜 원인(빈 down)이 로그에서 가려진다.
    failures.push(
      'REQ-7 (1) 되돌림 실효성 위반 — down 직후 스냅샷이 적용 이전과 다르다 ' +
        `(pre=${snapshotDigest(pre).slice(0, 12)} / post-down=${snapshotDigest(postDown).slice(0, 12)})`,
    );
    details.push(...diffSnapshots(pre, postDown, 'pre', 'post-down'));
    return {
      ok: false,
      digests: {
        pre: snapshotDigest(pre),
        postUp1: snapshotDigest(postUp1),
        postDown: snapshotDigest(postDown),
        postUp2: '<미실행 — 되돌림 실패로 중단>',
      },
      failures,
      details,
    };
  }

  await migrateUp(client, { dir, log });
  const postUp2 = await captureSnapshot(client);
  log(`post-up#2  sha256=${snapshotDigest(postUp2)}`);

  if (snapshotDigest(postUp2) !== snapshotDigest(postUp1)) {
    failures.push(
      'REQ-7 (2) 재적용 동일성 위반 — 2회차 up 결과가 1회차와 다르다 ' +
        `(1회차=${snapshotDigest(postUp1).slice(0, 12)} / 2회차=${snapshotDigest(postUp2).slice(0, 12)})`,
    );
    details.push(...diffSnapshots(postUp1, postUp2, 'post-up#1', 'post-up#2'));
  }

  return {
    ok: failures.length === 0,
    digests: {
      pre: snapshotDigest(pre),
      postUp1: snapshotDigest(postUp1),
      postDown: snapshotDigest(postDown),
      postUp2: snapshotDigest(postUp2),
    },
    failures,
    details,
  };
}
