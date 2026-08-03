// packages/db/schema/core/lib/whitelist.mjs — F2a REQ-6 / FORBID-3
//
// 허용 컬럼 화이트리스트(packages/db/test/allowed-columns.core.json)의 로딩과 정합 검사.
//
// 금지 축 패턴은 **데이터가 아니라 이 소스에** 둔다. 데이터 파일에 두면 컬럼을 등재하려는
// 사람이 같은 PR 에서 패턴을 지우는 것이 최단 경로가 되고, 검사는 형식만 남는다.
// 이 파일은 packages/db CODEOWNERS 경로다.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const WHITELIST_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../test/allowed-columns.core.json',
);

/** REQ-6 이 못박은 예약 3컬럼. 이 목록은 계약 본문에서 왔고 코드가 늘릴 수 없다. */
export const RESERVED_FOR_F2B = ['venue.visibility', 'price_plan.visibility', 'price_plan.confidence'];

/**
 * 금지 축 — 성별 · 연령대 추정 · 개인 식별/추적자 계열.
 *
 * 이름을 바꾼 같은 것을 잡기 위해 컬럼명뿐 아니라 **ENUM 라벨**에도 적용한다.
 * (`target_audience ENUM('women','men')` 은 컬럼명 정규식만으로는 통과한다.)
 */
export const FORBIDDEN_NAME_PATTERNS = [
  { id: 'gender', re: /(^|_)(gender|sex|genders)(_|$)/i, why: '성별 축' },
  { id: 'target-audience', re: /target_?audience|audience_?segment|persona_?gender/i, why: '성별을 우회 표기한 축' },
  { id: 'age', re: /(^|_)(age|ages|age_band|age_group|age_range|age_bucket|birth|birth_year|birthday|birthdate)(_|$)/i, why: '연령대 추정 축' },
  { id: 'tracking-id', re: /user_?agent|device_?id|device_?fingerprint|fingerprint|advertis(ing|er)_?id|idfa|gaid/i, why: '개인 식별/추적자' },
  { id: 'network-id', re: /(^|_)(ip|ip_address|ip_addr|client_ip|remote_addr)(_|$)/i, why: '개인 식별 가능한 네트워크 식별자' },
  { id: 'sensitive-attr', re: /(^|_)(race|ethnicit(y|ies)|religion|nationality|marital_status|income|disabilit(y|ies)|pregnan\w*)(_|$)/i, why: '민감정보 축' },
  { id: 'national-id', re: /(resident|social_security|ssn|passport)_?(no|number|id)?/i, why: '고유식별정보' },
];

/** ENUM 라벨 전용 패턴 — 값 자체가 성별·연령대인 경우. */
export const FORBIDDEN_LABEL_PATTERNS = [
  { id: 'gender-label', re: /^(m|f|male|female|men|women|man|woman|unisex|남성|여성|남자|여자|남|여)$/i, why: '성별 라벨' },
  { id: 'age-label', re: /^(\d{2}대|\d{2}s|age_?\d+|teens?|twenties|thirties|forties|fifties|seniors?)$/i, why: '연령대 라벨' },
];

export function loadWhitelist(file = WHITELIST_PATH) {
  const raw = fs.readFileSync(file, 'utf8');
  const parsed = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null) throw new Error(`화이트리스트 형식 오류: ${file}`);
  return parsed;
}

/**
 * 화이트리스트 **자체**의 정합 검사. DB 없이 판정 가능한 부분이며,
 * 위반은 `{rule, message}` 배열로 돌려준다(빈 배열 = 위반 없음).
 */
export function lintWhitelist(wl) {
  const violations = [];
  const add = (rule, message) => violations.push({ rule, message });

  if (!wl || typeof wl.tables !== 'object' || wl.tables === null) {
    add('REQ-6', '화이트리스트에 `tables` 객체가 없다 — 기대값 원천이 비면 검사가 공허해진다');
    return violations;
  }
  if (typeof wl.enums !== 'object' || wl.enums === null) {
    add('FORBID-3', '화이트리스트에 `enums` 객체가 없다 — ENUM 라벨 등재가 강제되지 않는다');
  }

  const tableNames = Object.keys(wl.tables);
  if (tableNames.length === 0) add('REQ-6', '`tables` 가 비었다 — 검사 대상 0건을 통과로 처리하지 않는다');

  for (const [table, cols] of Object.entries(wl.tables)) {
    if (!Array.isArray(cols) || cols.length === 0) {
      add('REQ-6', `\`tables.${table}\` 가 배열이 아니거나 비었다`);
      continue;
    }
    const seen = new Set();
    for (const col of cols) {
      if (seen.has(col)) add('REQ-6', `중복 등재: ${table}.${col}`);
      seen.add(col);
      for (const p of FORBIDDEN_NAME_PATTERNS) {
        if (p.re.test(col)) {
          add('FORBID-3', `금지 축 사전 등재: ${table}.${col} — ${p.why} (패턴 ${p.id})`);
        }
      }
    }
  }

  for (const [enumName, labels] of Object.entries(wl.enums ?? {})) {
    if (!Array.isArray(labels) || labels.length === 0) {
      add('FORBID-3', `\`enums.${enumName}\` 가 배열이 아니거나 비었다`);
      continue;
    }
    for (const p of FORBIDDEN_NAME_PATTERNS) {
      if (p.re.test(enumName)) add('FORBID-3', `금지 축 ENUM 타입 사전 등재: ${enumName} — ${p.why} (패턴 ${p.id})`);
    }
    for (const label of labels) {
      for (const p of FORBIDDEN_LABEL_PATTERNS) {
        if (p.re.test(String(label))) {
          add('FORBID-3', `금지 축 ENUM 라벨 사전 등재: ${enumName}='${label}' — ${p.why} (패턴 ${p.id})`);
        }
      }
      for (const p of FORBIDDEN_NAME_PATTERNS) {
        if (p.re.test(String(label))) {
          add('FORBID-3', `금지 축 ENUM 라벨 사전 등재: ${enumName}='${label}' — ${p.why} (패턴 ${p.id})`);
        }
      }
    }
  }

  // REQ-6 — reserved_for_f2b 는 정확히 3개이며 계약 본문의 3컬럼과 집합 동등이어야 한다.
  const reserved = wl.reserved_for_f2b;
  if (!Array.isArray(reserved)) {
    add('REQ-6', '`reserved_for_f2b` 배열이 없다 — F2b 가 이 파일을 수정해야만 컬럼을 추가할 수 있게 된다');
  } else {
    if (reserved.length !== 3) {
      add('REQ-6', `\`reserved_for_f2b\` 길이가 ${reserved.length} 다 — 계약이 못박은 값은 3 이다`);
    }
    const got = new Set(reserved);
    const want = new Set(RESERVED_FOR_F2B);
    for (const r of want) if (!got.has(r)) add('REQ-6', `\`reserved_for_f2b\` 누락: ${r}`);
    for (const r of got) if (!want.has(r)) add('REQ-6', `\`reserved_for_f2b\` 초과 등재: ${r} (계약 본문 3컬럼 외)`);
    for (const r of reserved) {
      const [table, col] = String(r).split('.');
      if (!table || !col) {
        add('REQ-6', `\`reserved_for_f2b\` 항목 형식 오류: ${r} (기대: table.column)`);
        continue;
      }
      if (!(table in wl.tables)) add('REQ-6', `\`reserved_for_f2b\` 가 화이트리스트에 없는 테이블을 가리킨다: ${r}`);
    }
  }

  return violations;
}

/** 테이블별 허용 컬럼 집합(예약분 포함)을 만든다. */
export function allowedColumnsFor(wl, table) {
  const base = new Set(wl.tables?.[table] ?? []);
  for (const r of wl.reserved_for_f2b ?? []) {
    const [t, c] = String(r).split('.');
    if (t === table && c) base.add(c);
  }
  return base;
}
