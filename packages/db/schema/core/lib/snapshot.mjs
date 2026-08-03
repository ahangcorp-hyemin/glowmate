// packages/db/schema/core/lib/snapshot.mjs — F2a REQ-7
//
// 스키마 덤프(카탈로그 스냅샷) + sha256.
//
// 왜 pg_dump 가 아니라 카탈로그 질의인가
//   pg_dump 는 클라이언트 바이너리 버전이 서버보다 낮으면 아예 거부한다. 러너 이미지의
//   postgresql-client 버전과 서비스 컨테이너 버전이 어긋나는 순간 REQ-7 검사가 "스키마가 달라서"가
//   아니라 "도구 버전 때문에" red 가 되고, 그때 가장 싼 해결책은 검사를 끄는 것이다.
//   카탈로그 질의는 서버 안에서 끝나므로 그 실패 모드가 없다.
//
// 대신 미탐을 막기 위해 **객체 종류를 넓게** 훑는다 — 스키마 · 확장 · 릴레이션 · 컬럼 · 제약 ·
// 인덱스 · 트리거 · 함수 · 타입(ENUM 라벨 포함) · 시퀀스 · 뷰 정의 · 코멘트 · 권한(ACL).
// 확장이 소유한 객체(pg_depend deptype='e')는 제외하되 확장 자체(이름·버전·스키마)는 기록한다 —
// PostGIS 가 만든 수천 개 함수는 up/down 과 무관하고, 확장이 사라지면 확장 항목에서 드러난다.

import { createHash } from 'node:crypto';

const SYSTEM_SCHEMAS = `('pg_catalog', 'information_schema')`;
const NOT_EXTENSION_MEMBER = (oidExpr, classname) => `
  NOT EXISTS (
    SELECT 1 FROM pg_depend d
     WHERE d.classid = '${classname}'::regclass AND d.objid = ${oidExpr} AND d.deptype = 'e'
  )`;

const QUERIES = {
  schemas: `
    SELECT n.nspname AS schema,
           obj_description(n.oid, 'pg_namespace') AS comment,
           n.nspacl::text AS acl
      FROM pg_namespace n
     WHERE n.nspname NOT IN ${SYSTEM_SCHEMAS}
       AND n.nspname NOT LIKE 'pg\\_%'
     ORDER BY 1`,

  extensions: `
    SELECT e.extname AS name, e.extversion AS version, n.nspname AS schema
      FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
     ORDER BY 1, 3`,

  relations: `
    SELECT n.nspname AS schema, c.relname AS name, c.relkind AS kind,
           c.relpersistence AS persistence,
           array_to_string(c.reloptions, ',') AS options,
           c.relacl::text AS acl,
           c.relrowsecurity AS row_security,
           obj_description(c.oid, 'pg_class') AS comment
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname NOT IN ${SYSTEM_SCHEMAS}
       AND n.nspname NOT LIKE 'pg\\_%'
       AND ${NOT_EXTENSION_MEMBER('c.oid', 'pg_class')}
     ORDER BY 1, 2`,

  columns: `
    SELECT n.nspname AS schema, c.relname AS relation, a.attname AS name, a.attnum AS ord,
           format_type(a.atttypid, a.atttypmod) AS type,
           a.attnotnull AS not_null,
           pg_get_expr(ad.adbin, ad.adrelid) AS default_expr,
           a.attidentity AS identity,
           a.attgenerated AS generated,
           col_description(c.oid, a.attnum) AS comment
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_attrdef ad ON ad.adrelid = a.attrelid AND ad.adnum = a.attnum
     WHERE n.nspname NOT IN ${SYSTEM_SCHEMAS}
       AND n.nspname NOT LIKE 'pg\\_%'
       AND a.attnum > 0 AND NOT a.attisdropped
       AND ${NOT_EXTENSION_MEMBER('c.oid', 'pg_class')}
     ORDER BY 1, 2, 4`,

  constraints: `
    SELECT n.nspname AS schema, rel.relname AS relation, con.conname AS name,
           con.contype AS type, pg_get_constraintdef(con.oid) AS definition,
           con.condeferrable AS deferrable, con.convalidated AS validated
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = rel.relnamespace
     WHERE n.nspname NOT IN ${SYSTEM_SCHEMAS}
       AND n.nspname NOT LIKE 'pg\\_%'
       AND ${NOT_EXTENSION_MEMBER('rel.oid', 'pg_class')}
     ORDER BY 1, 2, 3`,

  indexes: `
    SELECT n.nspname AS schema, c.relname AS relation, i.relname AS name,
           pg_get_indexdef(x.indexrelid) AS definition
      FROM pg_index x
      JOIN pg_class c ON c.oid = x.indrelid
      JOIN pg_class i ON i.oid = x.indexrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname NOT IN ${SYSTEM_SCHEMAS}
       AND n.nspname NOT LIKE 'pg\\_%'
       AND ${NOT_EXTENSION_MEMBER('c.oid', 'pg_class')}
     ORDER BY 1, 2, 3`,

  triggers: `
    SELECT n.nspname AS schema, c.relname AS relation, t.tgname AS name,
           pg_get_triggerdef(t.oid) AS definition, t.tgenabled AS enabled
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE NOT t.tgisinternal
       AND n.nspname NOT IN ${SYSTEM_SCHEMAS}
       AND n.nspname NOT LIKE 'pg\\_%'
     ORDER BY 1, 2, 3`,

  routines: `
    SELECT n.nspname AS schema, p.proname AS name,
           pg_get_function_identity_arguments(p.oid) AS args,
           pg_get_function_result(p.oid) AS result,
           p.prokind AS kind, p.prosecdef AS security_definer,
           p.provolatile AS volatility, l.lanname AS language,
           md5(p.prosrc) AS body_md5,
           p.proacl::text AS acl
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      JOIN pg_language l ON l.oid = p.prolang
     WHERE n.nspname NOT IN ${SYSTEM_SCHEMAS}
       AND n.nspname NOT LIKE 'pg\\_%'
       AND ${NOT_EXTENSION_MEMBER('p.oid', 'pg_proc')}
     ORDER BY 1, 2, 3`,

  types: `
    SELECT n.nspname AS schema, t.typname AS name, t.typtype AS type,
           (SELECT string_agg(e.enumlabel, '|' ORDER BY e.enumsortorder)
              FROM pg_enum e WHERE e.enumtypid = t.oid) AS enum_labels,
           pg_catalog.format_type(t.typbasetype, t.typtypmod) AS domain_base,
           t.typnotnull AS domain_not_null
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE n.nspname NOT IN ${SYSTEM_SCHEMAS}
       AND n.nspname NOT LIKE 'pg\\_%'
       AND t.typtype IN ('e', 'd', 'r')
       AND ${NOT_EXTENSION_MEMBER('t.oid', 'pg_type')}
     ORDER BY 1, 2`,

  sequences: `
    SELECT n.nspname AS schema, c.relname AS name,
           format_type(s.seqtypid, NULL) AS type, s.seqstart AS start,
           s.seqincrement AS increment, s.seqmin AS min, s.seqmax AS max, s.seqcycle AS cycle
      FROM pg_sequence s
      JOIN pg_class c ON c.oid = s.seqrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname NOT IN ${SYSTEM_SCHEMAS}
       AND n.nspname NOT LIKE 'pg\\_%'
       AND ${NOT_EXTENSION_MEMBER('c.oid', 'pg_class')}
     ORDER BY 1, 2`,

  views: `
    SELECT n.nspname AS schema, c.relname AS name, pg_get_viewdef(c.oid, true) AS definition
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE c.relkind IN ('v', 'm')
       AND n.nspname NOT IN ${SYSTEM_SCHEMAS}
       AND n.nspname NOT LIKE 'pg\\_%'
       AND ${NOT_EXTENSION_MEMBER('c.oid', 'pg_class')}
     ORDER BY 1, 2`,
};

/** 카탈로그 스냅샷을 채취한다. 결과는 결정적으로 직렬화 가능한 순수 데이터다. */
export async function captureSnapshot(client) {
  const out = {};
  for (const [section, sql] of Object.entries(QUERIES)) {
    const res = await client.query(sql);
    out[section] = res.rows;
  }
  return out;
}

/** 키 순서에 좌우되지 않는 직렬화. 같은 스키마면 같은 문자열이 나와야 한다. */
export function serializeSnapshot(snapshot) {
  return `${JSON.stringify(snapshot, canonicalReplacer, 2)}\n`;
}

function canonicalReplacer(_key, value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
  const sorted = {};
  for (const k of Object.keys(value).sort()) sorted[k] = value[k];
  return sorted;
}

export function snapshotDigest(snapshot) {
  return createHash('sha256').update(serializeSnapshot(snapshot), 'utf8').digest('hex');
}

/** 두 스냅샷의 첫 차이들을 사람이 읽을 수 있게 요약한다(최대 20건). */
export function diffSnapshots(a, b, labelA = 'A', labelB = 'B') {
  const diffs = [];
  const sections = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const section of [...sections].sort()) {
    const rowsA = (a[section] ?? []).map((r) => JSON.stringify(r, canonicalReplacer));
    const rowsB = (b[section] ?? []).map((r) => JSON.stringify(r, canonicalReplacer));
    const setB = new Set(rowsB);
    const setA = new Set(rowsA);
    for (const row of rowsA) if (!setB.has(row)) diffs.push(`- [${section}] ${labelA} 에만 있음: ${row}`);
    for (const row of rowsB) if (!setA.has(row)) diffs.push(`+ [${section}] ${labelB} 에만 있음: ${row}`);
  }
  return diffs.slice(0, 20);
}
