// packages/db/schema/core/lib/typegen.mjs — F2a (packages/db/src/types.ts 생성)
//
// 타입을 손으로 쓰면 스키마와 갈라진다. 갈라진 타입은 컴파일을 통과시키면서 런타임에 틀린다.
// 그래서 **마이그레이션이 적용된 DB 의 카탈로그**를 원천으로 생성하고, CI 는 `--check` 로
// 커밋본과 재생성물이 같은지 대조한다.

const TYPE_MAP = {
  uuid: 'string',
  text: 'string',
  'character varying': 'string',
  'character': 'string',
  integer: 'number',
  smallint: 'number',
  bigint: 'string', // node-postgres 는 int8 을 문자열로 준다 (정밀도 보존)
  boolean: 'boolean',
  'timestamp with time zone': 'Date',
  'timestamp without time zone': 'Date',
  date: 'string',
  numeric: 'string', // 부동소수 손실을 막기 위해 문자열로 온다
  jsonb: 'unknown',
  json: 'unknown',
};

export function pascal(name) {
  return name
    .split('_')
    .filter(Boolean)
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join('');
}

export async function readCatalog(client, schema = 'core') {
  const enums = (
    await client.query(
      `SELECT t.typname AS name, e.enumlabel AS label
         FROM pg_type t
         JOIN pg_namespace n ON n.oid = t.typnamespace
         JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE n.nspname = $1
        ORDER BY t.typname, e.enumsortorder`,
      [schema],
    )
  ).rows;

  const columns = (
    await client.query(
      `SELECT table_name, column_name, data_type, udt_name, is_nullable, ordinal_position
         FROM information_schema.columns
        WHERE table_schema = $1
        ORDER BY table_name, ordinal_position`,
      [schema],
    )
  ).rows;

  return { enums, columns };
}

export function renderTypes({ enums, columns }, schema = 'core') {
  if (columns.length === 0) {
    throw new Error(`${schema} 스키마에 컬럼이 0건이다 — 빈 타입 파일을 생성하지 않는다`);
  }

  const enumMap = new Map();
  for (const row of enums) {
    if (!enumMap.has(row.name)) enumMap.set(row.name, []);
    enumMap.get(row.name).push(row.label);
  }

  const lines = [];
  lines.push('// packages/db/src/types.ts');
  lines.push('//');
  lines.push('// ⚠ 생성 파일이다. 직접 편집하지 마라 — 편집분은 다음 생성에서 사라지고,');
  lines.push('//   CI(db-schema job)의 `pnpm db:generate-types --check` 가 즉시 실패한다.');
  lines.push('//');
  lines.push('// 원천: packages/db/migrations/** 를 적용한 DB 의 카탈로그 (F2a-CORE-SCHEMA)');
  lines.push('// 재생성: cd packages/db && DATABASE_URL=... pnpm db:generate-types');
  lines.push('');

  for (const [name, labels] of [...enumMap.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`/** core.${name} */`);
    lines.push(`export type ${pascal(name)} = ${labels.map((l) => `'${l}'`).join(' | ')};`);
    lines.push('');
  }

  const byTable = new Map();
  for (const col of columns) {
    if (!byTable.has(col.table_name)) byTable.set(col.table_name, []);
    byTable.get(col.table_name).push(col);
  }

  for (const [table, cols] of [...byTable.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`/** core.${table} */`);
    lines.push(`export interface ${pascal(table)}Row {`);
    for (const col of cols) {
      const ts = tsTypeOf(col, enumMap);
      // `unknown | null` 은 `unknown` 과 같은 타입이고 린트가 중복으로 잡는다.
      const nullable = col.is_nullable === 'YES' && ts !== 'unknown' ? ' | null' : '';
      lines.push(`  readonly ${col.column_name}: ${ts}${nullable};`);
    }
    lines.push('}');
    lines.push('');
  }

  lines.push('/** core 스키마 테이블 → 행 타입 대응 */');
  lines.push('export interface CoreTables {');
  for (const table of [...byTable.keys()].sort()) {
    lines.push(`  readonly ${table}: ${pascal(table)}Row;`);
  }
  lines.push('}');
  lines.push('');

  return lines.join('\n');
}

function tsTypeOf(col, enumMap) {
  if (col.data_type === 'USER-DEFINED') {
    if (enumMap.has(col.udt_name)) return pascal(col.udt_name);
    if (col.udt_name === 'geography' || col.udt_name === 'geometry') {
      // PostGIS 값은 드라이버가 EWKB hex 문자열로 준다. 좌표를 쓰려면 SQL 에서
      // ST_X/ST_Y 로 뽑아라 — 문자열을 파싱하는 코드가 생기면 그게 곧 두 번째 진리가 된다.
      return 'string';
    }
    throw new Error(`매핑되지 않은 사용자 정의 타입: ${col.table_name}.${col.column_name} (${col.udt_name})`);
  }
  const mapped = TYPE_MAP[col.data_type];
  if (!mapped) {
    throw new Error(`매핑되지 않은 타입: ${col.table_name}.${col.column_name} (${col.data_type})`);
  }
  return mapped;
}
