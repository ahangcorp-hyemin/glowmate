// packages/db/test/core/db/geo.test.mjs — `pnpm test:geo` (REQ-2)
//
// 실제 PostGIS 인스턴스(mock 금지)에 시드 50,000행을 적재하고, 반경 3km 검색의
// EXPLAIN(FORMAT JSON) 계획에 Index Scan 또는 Bitmap Index Scan 이 포함되는지 본다.
//
// 시드는 합성 픽스처다(격자 250 × 200). 실제 업체 데이터는 G3 이전에 적재하지 않는다.
// 좌표 범위는 서울 대도시권(경도 126.80~127.20 · 위도 37.40~37.70)이며, 반경 3km 는
// 전체의 약 2~3% 를 선택한다 — 선택도가 너무 높으면 순차 스캔이 정답이 되어 검사가 무의미해진다.

import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { collectNodeTypes, scanPlannerOverrides } from '../../../schema/core/lib/plannerguard.mjs';
import { useMigratedDatabase } from './helpers.mjs';

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const SEED_ROWS = 50000;
const RADIUS_M = 3000;
const CENTER = { lon: 127.0, lat: 37.55 };

const db = useMigratedDatabase('geo');

test('REQ-2 — 테스트/도구 소스에 플래너 설정 변경 구문이 없다', () => {
  const hits = scanPlannerOverrides([path.join(PKG_ROOT, 'test'), path.join(PKG_ROOT, 'schema')]);
  const formatted = hits.map((h) => `${h.file}:${h.line} ${h.text}`).join('\n');
  assert.equal(
    hits.length,
    0,
    `플래너 설정 변경 구문이 검출되었다 — 인덱스가 쓰였다는 판정이 무의미해진다:\n${formatted}`,
  );
});

test(`REQ-2 — 시드 ${SEED_ROWS}행 적재`, async () => {
  await db.client.query(
    `INSERT INTO core.venue (slug, name, category, gu, location)
     SELECT 'seed-' || g,
            '시드 업체 ' || g,
            (ARRAY['exercise_body','relax_recovery','medical_wellness','beauty_care'])[1 + (g % 4)]::core.venue_category,
            (ARRAY['gangnam','seocho','songpa'])[1 + (g % 3)]::core.gu_code,
            ST_SetSRID(
              ST_MakePoint(126.80 + ((g - 1) % 250) * 0.0016,
                           37.40 + (((g - 1) / 250)::int % 200) * 0.0015),
              4326)::geography
       FROM generate_series(1, $1) AS g`,
    [SEED_ROWS],
  );
  await db.client.query('ANALYZE core.venue');
  const res = await db.client.query('SELECT count(*)::int AS n FROM core.venue');
  assert.equal(res.rows[0].n, SEED_ROWS);
});

test('REQ-2 — 반경 3km 검색이 실제로 행을 반환한다 (공허한 초록 방지)', async () => {
  const res = await db.client.query(
    `SELECT count(*)::int AS n
       FROM core.venue
      WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)`,
    [CENTER.lon, CENTER.lat, RADIUS_M],
  );
  assert.ok(res.rows[0].n > 0, '반경 검색 결과가 0건이다 — 계획을 볼 대상 자체가 없다');
  assert.ok(
    res.rows[0].n < SEED_ROWS * 0.2,
    `반경 검색이 전체의 ${((res.rows[0].n / SEED_ROWS) * 100).toFixed(1)}% 를 선택한다 — 선택도가 너무 높아 인덱스 판정이 무의미하다`,
  );
});

test('REQ-2 — EXPLAIN 계획에 Index Scan / Bitmap Index Scan 이 포함된다', async () => {
  const res = await db.client.query(
    `EXPLAIN (FORMAT JSON)
     SELECT id FROM core.venue
      WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, $3)`,
    [CENTER.lon, CENTER.lat, RADIUS_M],
  );
  const plan = res.rows[0]['QUERY PLAN'];
  const nodeTypes = collectNodeTypes(plan);
  const indexed = nodeTypes.filter((t) => t === 'Index Scan' || t === 'Bitmap Index Scan' || t === 'Index Only Scan');
  assert.ok(
    indexed.length > 0,
    `계획에 인덱스 스캔이 없다 (노드: ${nodeTypes.join(', ')})\n${JSON.stringify(plan, null, 2)}`,
  );
});
