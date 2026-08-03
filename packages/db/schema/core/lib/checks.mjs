// packages/db/schema/core/lib/checks.mjs — F2a REQ-1 · REQ-4 · REQ-6 / FORBID-2 · FORBID-3 · FORBID-4
//
// 기대값은 **이 소스에 하드코딩**한다(계약 acceptance 요구). 데이터 파일에서 읽으면
// 기대값을 바꾸는 것이 실패를 없애는 최단 경로가 되고, 검사는 자기 자신을 확인하게 된다.
//
// 반환은 `{rule, message}` 배열이다. 빈 배열이면 위반 없음. 호출자가 exit code 로 옮긴다.

import { allowedColumnsFor, lintWhitelist } from './whitelist.mjs';

/** REQ-1 — core 스키마 테이블 목록. **집합 동등**으로 비교한다(부분집합 비교 금지). */
export const EXPECTED_TABLES = [
  'venue',
  'price_plan',
  'need_tag',
  'venue_need_tag',
  'editor_report',
  'source_record',
];

/** REQ-1 — 테이블별 필수 컬럼(최소 집합). */
export const REQUIRED_COLUMNS = {
  venue: ['id', 'slug', 'name', 'category', 'gu', 'location'],
  price_plan: ['total_amount_krw', 'session_count', 'raw_text', 'source_record_id'],
  need_tag: ['slug', 'ontology_id'],
  venue_need_tag: ['venue_id', 'need_tag_id', 'evidence_snippet'],
  editor_report: ['venue_id', 'visited_at'],
  source_record: ['source_url', 'raw_payload', 'fetched_at'],
};

/** REQ-1 — 필수 제약. */
export const REQUIRED_UNIQUE = [
  { table: 'venue', columns: ['slug'] },
  { table: 'need_tag', columns: ['slug'] },
];
export const REQUIRED_PRIMARY_KEY = {
  venue_need_tag: ['venue_id', 'need_tag_id'],
};
export const REQUIRED_FOREIGN_KEY = [
  { table: 'editor_report', column: 'venue_id', references: 'venue' },
  { table: 'price_plan', column: 'source_record_id', references: 'source_record' },
  { table: 'price_plan', column: 'venue_id', references: 'venue' },
];

/** REQ-2 — geography(Point,4326) NOT NULL + GiST. */
export const GEO_COLUMN = { table: 'venue', column: 'location', udt: 'geography', srid: 4326, type: 'Point' };

/** REQ-4 — C4 출력 6필드의 (타입, NULL 허용) 기대값. */
export const C4_OUTPUT_COLUMNS = {
  price_unit_type: { data_type: 'USER-DEFINED', udt_name: 'price_unit_type', is_nullable: 'NO' },
  price_per_month_krw: { data_type: 'integer', is_nullable: 'YES' },
  period_days: { data_type: 'integer', is_nullable: 'YES' },
  source_snippet: { data_type: 'text', is_nullable: 'NO' },
  captured_at: { data_type: 'timestamp with time zone', is_nullable: 'NO' },
  parser_version: { data_type: 'text', is_nullable: 'NO' },
};

/** REQ-4 — price_unit_type ENUM 라벨 집합(순서 무관, 집합 동등). */
export const PRICE_UNIT_TYPE_LABELS = ['per_session', 'period_pass', 'single_session', 'unparseable'];

const SCHEMA = 'core';

async function fetchState(client) {
  const tables = (
    await client.query(
      `SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name`,
      [SCHEMA],
    )
  ).rows;

  const columns = (
    await client.query(
      `SELECT table_name, column_name, data_type, udt_name, is_nullable, column_default, ordinal_position
         FROM information_schema.columns WHERE table_schema = $1
        ORDER BY table_name, ordinal_position`,
      [SCHEMA],
    )
  ).rows;

  const enums = (
    await client.query(
      `SELECT t.typname AS name, e.enumlabel AS label
         FROM pg_type t
         JOIN pg_namespace n ON n.oid = t.typnamespace
         JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE n.nspname = $1
        ORDER BY t.typname, e.enumsortorder`,
      [SCHEMA],
    )
  ).rows;

  const constraints = (
    await client.query(
      `SELECT rel.relname AS table_name, con.conname AS name, con.contype AS type,
              pg_get_constraintdef(con.oid) AS definition,
              (SELECT array_agg(att.attname::text ORDER BY k.ord)
                 FROM unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord)
                 JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = k.attnum
              ) AS columns,
              fref.relname AS referenced_table,
              con.confdeltype AS delete_action
         FROM pg_constraint con
         JOIN pg_class rel ON rel.oid = con.conrelid
         JOIN pg_namespace n ON n.oid = rel.relnamespace
         LEFT JOIN pg_class fref ON fref.oid = con.confrelid
        WHERE n.nspname = $1
        ORDER BY rel.relname, con.conname`,
      [SCHEMA],
    )
  ).rows;

  const indexes = (
    await client.query(
      `SELECT c.relname AS table_name, i.relname AS name, am.amname AS method,
              pg_get_indexdef(x.indexrelid) AS definition
         FROM pg_index x
         JOIN pg_class c ON c.oid = x.indrelid
         JOIN pg_class i ON i.oid = x.indexrelid
         JOIN pg_am am ON am.oid = i.relam
         JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = $1
        ORDER BY c.relname, i.relname`,
      [SCHEMA],
    )
  ).rows;

  const geoColumns = (
    await client.query(
      `SELECT f_table_name AS table_name, f_geography_column AS column_name, srid, type
         FROM geography_columns WHERE f_table_schema = $1`,
      [SCHEMA],
    )
  ).rows;

  return { tables, columns, enums, constraints, indexes, geoColumns };
}

function columnsOf(state, table) {
  return state.columns.filter((c) => c.table_name === table);
}

/** 전 검사 실행. 위반 배열을 돌려준다. */
export async function checkCoreSchema(client, whitelist) {
  const violations = [];
  const add = (rule, message) => violations.push({ rule, message });
  const state = await fetchState(client);

  // ── REQ-1 (1) 테이블 집합 동등 ────────────────────────────────────────
  const actualTables = state.tables.map((t) => t.table_name).sort();
  const expected = [...EXPECTED_TABLES].sort();
  const missing = expected.filter((t) => !actualTables.includes(t));
  const extra = actualTables.filter((t) => !expected.includes(t));
  if (missing.length > 0) add('REQ-1', `core 스키마에 없는 테이블: ${missing.join(', ')}`);
  if (extra.length > 0) {
    add(
      'REQ-1',
      `core 스키마에 계약 밖 객체가 있다: ${extra.join(', ')} — 6테이블 집합 동등 위반. ` +
        '품질·공개판정 객체는 F2b, 운영·법적 객체는 F2c 의 별도 스키마에 만든다',
    );
  }
  if (actualTables.length === 0) {
    add('REQ-1', 'core 스키마에 테이블이 0건이다 — 마이그레이션이 적용되지 않았다(빈 결과를 통과로 처리하지 않는다)');
    return violations;
  }

  // ── REQ-1 (2) 필수 컬럼 ──────────────────────────────────────────────
  for (const [table, required] of Object.entries(REQUIRED_COLUMNS)) {
    const have = new Set(columnsOf(state, table).map((c) => c.column_name));
    for (const col of required) {
      if (!have.has(col)) add('REQ-1', `필수 컬럼 누락: ${table}.${col}`);
    }
  }

  // ── REQ-1 (3) 필수 제약 ──────────────────────────────────────────────
  for (const u of REQUIRED_UNIQUE) {
    const found = state.constraints.some(
      (c) =>
        c.table_name === u.table &&
        (c.type === 'u' || c.type === 'p') &&
        sameSet(c.columns ?? [], u.columns),
    );
    if (!found) add('REQ-1', `UNIQUE 제약 누락: ${u.table}(${u.columns.join(', ')})`);
  }
  for (const [table, cols] of Object.entries(REQUIRED_PRIMARY_KEY)) {
    const pk = state.constraints.find((c) => c.table_name === table && c.type === 'p');
    if (!pk) add('REQ-1', `PRIMARY KEY 누락: ${table}`);
    else if (!sameSet(pk.columns ?? [], cols)) {
      add('REQ-1', `PRIMARY KEY 불일치: ${table}(${(pk.columns ?? []).join(', ')}) — 기대 (${cols.join(', ')})`);
    }
  }
  for (const fk of REQUIRED_FOREIGN_KEY) {
    const found = state.constraints.some(
      (c) =>
        c.table_name === fk.table &&
        c.type === 'f' &&
        c.referenced_table === fk.references &&
        (c.columns ?? []).includes(fk.column),
    );
    if (!found) add('REQ-1', `FK 누락: ${fk.table}.${fk.column} → ${fk.references}`);
  }

  // ── REQ-2 (정적 부분) geography(Point,4326) NOT NULL + GiST ──────────
  const geo = state.geoColumns.find(
    (g) => g.table_name === GEO_COLUMN.table && g.column_name === GEO_COLUMN.column,
  );
  if (!geo) {
    add('REQ-2', `${GEO_COLUMN.table}.${GEO_COLUMN.column} 이 geography 컬럼이 아니다`);
  } else {
    if (Number(geo.srid) !== GEO_COLUMN.srid) add('REQ-2', `${GEO_COLUMN.table}.${GEO_COLUMN.column} SRID=${geo.srid} — 기대 ${GEO_COLUMN.srid}`);
    if (String(geo.type) !== GEO_COLUMN.type) add('REQ-2', `${GEO_COLUMN.table}.${GEO_COLUMN.column} 지오메트리 타입=${geo.type} — 기대 ${GEO_COLUMN.type}`);
  }
  const locCol = columnsOf(state, GEO_COLUMN.table).find((c) => c.column_name === GEO_COLUMN.column);
  if (locCol && locCol.is_nullable !== 'NO') {
    add('REQ-2', `${GEO_COLUMN.table}.${GEO_COLUMN.column} 이 NULL 허용이다 — 좌표 없는 업체가 반경 검색에서 조용히 사라진다`);
  }
  const gist = state.indexes.some(
    (i) => i.table_name === GEO_COLUMN.table && i.method === 'gist' && i.definition.includes(GEO_COLUMN.column),
  );
  if (!gist) add('REQ-2', `${GEO_COLUMN.table}.${GEO_COLUMN.column} 에 GiST 인덱스가 없다`);

  // ── REQ-4 C4 출력 6필드 ──────────────────────────────────────────────
  const priceCols = new Map(columnsOf(state, 'price_plan').map((c) => [c.column_name, c]));
  for (const [name, want] of Object.entries(C4_OUTPUT_COLUMNS)) {
    const got = priceCols.get(name);
    if (!got) {
      add('REQ-4', `price_plan.${name} 이 없다 — C4 가 산출값을 저장할 자리가 없다`);
      continue;
    }
    if (got.data_type !== want.data_type) {
      add('REQ-4', `price_plan.${name} data_type=${got.data_type} — 기대 ${want.data_type}`);
    }
    if (want.udt_name && got.udt_name !== want.udt_name) {
      add('REQ-4', `price_plan.${name} udt_name=${got.udt_name} — 기대 ${want.udt_name}`);
    }
    if (got.is_nullable !== want.is_nullable) {
      add('REQ-4', `price_plan.${name} is_nullable=${got.is_nullable} — 기대 ${want.is_nullable}`);
    }
  }
  const unitLabels = state.enums.filter((e) => e.name === 'price_unit_type').map((e) => e.label);
  if (!sameSet(unitLabels, PRICE_UNIT_TYPE_LABELS)) {
    add(
      'REQ-4',
      `price_unit_type ENUM 라벨 집합 불일치: {${unitLabels.join(', ')}} — 기대 {${PRICE_UNIT_TYPE_LABELS.join(', ')}}`,
    );
  }

  // ── FORBID-2 price_per_session ───────────────────────────────────────
  const pps = priceCols.get('price_per_session');
  if (!pps) {
    add('FORBID-2', 'price_plan.price_per_session 이 없다 — 회당 단가를 기록할 자리가 없다');
  } else {
    if (pps.is_nullable !== 'YES') {
      add(
        'FORBID-2',
        'price_plan.price_per_session 이 NOT NULL 이다 — "파싱 실패"를 기록할 자리가 사라지고 0원/가짜 평균가가 노출된다',
      );
    }
    if (pps.column_default !== null) {
      add('FORBID-2', `price_plan.price_per_session 에 DEFAULT(${pps.column_default}) 가 있다 — 추정값이 확정값으로 저장된다`);
    }
  }

  // ── FORBID-4 venue 참조 FK 의 CASCADE ────────────────────────────────
  const venueFks = state.constraints.filter((c) => c.type === 'f' && c.referenced_table === 'venue');
  if (venueFks.length === 0) {
    add('FORBID-4', 'venue 를 참조하는 FK 가 0건이다 — 검사 대상 0건을 통과로 처리하지 않는다');
  }
  for (const fk of venueFks) {
    if (fk.delete_action === 'c') {
      add(
        'FORBID-4',
        `${fk.table_name}.${(fk.columns ?? []).join(',')} → venue 의 FK 가 ON DELETE CASCADE 다 — ` +
          '업체 삭제가 source_record·editor_report 까지 지워 지표 시계열과 법적 증빙이 동시에 끊긴다',
      );
    }
  }

  // ── REQ-6 / FORBID-3 화이트리스트 ────────────────────────────────────
  violations.push(...lintWhitelist(whitelist));

  const wlTables = Object.keys(whitelist.tables ?? {});
  for (const t of wlTables) {
    if (!actualTables.includes(t)) {
      add('REQ-6', `화이트리스트가 존재하지 않는 테이블을 등재하고 있다: ${t} — 죽은 등재는 검사를 헐겁게 만든다`);
    }
  }
  for (const table of actualTables) {
    const allowed = allowedColumnsFor(whitelist, table);
    if (allowed.size === 0) {
      add('FORBID-3', `화이트리스트에 없는 테이블의 컬럼 전부가 미등재다: ${table}`);
      continue;
    }
    for (const col of columnsOf(state, table)) {
      if (!allowed.has(col.column_name)) {
        add(
          'FORBID-3',
          `화이트리스트 밖 컬럼: ${table}.${col.column_name} — 등재(= CODEOWNERS 승인) 없이 컬럼을 추가할 수 없다`,
        );
      }
    }
  }

  // ENUM 라벨: 실재 집합과 화이트리스트가 정확히 일치해야 한다.
  const actualEnums = new Map();
  for (const row of state.enums) {
    if (!actualEnums.has(row.name)) actualEnums.set(row.name, []);
    actualEnums.get(row.name).push(row.label);
  }
  const wlEnums = whitelist.enums ?? {};
  for (const [name, labels] of actualEnums) {
    const want = wlEnums[name];
    if (!Array.isArray(want)) {
      add('FORBID-3', `화이트리스트에 없는 ENUM 타입: core.${name} — 라벨 등재 없이 축을 만들 수 없다`);
      continue;
    }
    const unknown = labels.filter((l) => !want.includes(l));
    const absent = want.filter((l) => !labels.includes(l));
    if (unknown.length > 0) add('FORBID-3', `화이트리스트 밖 ENUM 라벨: core.${name} = {${unknown.join(', ')}}`);
    if (absent.length > 0) add('REQ-6', `화이트리스트에만 있는 ENUM 라벨: core.${name} = {${absent.join(', ')}}`);
  }
  for (const name of Object.keys(wlEnums)) {
    if (!actualEnums.has(name)) add('REQ-6', `화이트리스트가 존재하지 않는 ENUM 을 등재하고 있다: core.${name}`);
  }

  return violations;
}

function sameSet(a, b) {
  const sa = [...new Set(a)].sort();
  const sb = [...new Set(b)].sort();
  return sa.length === sb.length && sa.every((v, i) => v === sb[i]);
}
