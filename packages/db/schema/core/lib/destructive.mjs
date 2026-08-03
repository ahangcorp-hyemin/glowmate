// packages/db/schema/core/lib/destructive.mjs — F2a FORBID-1
//
// (a) 머지된 up 파일의 내용 변경 차단 — sha256 매니페스트 + base(origin/main) 원본 대조
// (b) 신규 up 파일의 데이터 손실형 DDL 차단 — 정규식 검사
//
// 왜 이 두 갈래인가: source_record 의 원문 스냅샷은 재수집 불가능한 자산이다. 소스가 차단되거나
// 페이지가 내려가면 영구 소실되고, "이 가격은 언제 어디서 왔는가"의 추적이 끊겨 정정·삭제 요청에
// 응답할 근거가 사라진다. 머지된 마이그레이션을 조용히 고치는 것과, up 방향에서 컬럼을 지우는 것이
// 그 소실로 가는 두 개의 최단 경로다.
//
// down 스크립트의 DROP 은 대상이 아니다(동일 버전 되돌림용) — `*.up.sql` 만 스캔한다.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { MIGRATIONS_DIR, sha256 } from './migrate.mjs';

export const MANIFEST_PATH = path.join(MIGRATIONS_DIR, 'manifest.sha256.json');

/**
 * 데이터 손실형 DDL 패턴.
 *
 * 앞의 4종은 계약 FORBID-1 when 이 열거한 것이고, 뒤의 2종은 그보다 파괴적인데 열거에서 빠진
 * 상위 개념이다(스키마·데이터베이스 통째). 미탐을 줄이는 방향으로만 목록을 늘린다.
 */
export const DESTRUCTIVE_PATTERNS = [
  { id: 'drop-table', re: /\bDROP\s+(?:FOREIGN\s+)?TABLE\b/i, why: '테이블 삭제' },
  { id: 'drop-column', re: /\bDROP\s+COLUMN\b/i, why: '컬럼 삭제' },
  { id: 'truncate', re: /\bTRUNCATE\b/i, why: '전 행 삭제' },
  { id: 'alter-type-using', re: /\bALTER\b[\s\S]*\bTYPE\b[\s\S]*\bUSING\b/i, why: '타입 변환(USING) — 변환 실패분이 소실된다' },
  { id: 'drop-schema', re: /\bDROP\s+SCHEMA\b/i, why: '스키마 통째 삭제' },
  { id: 'drop-database', re: /\bDROP\s+DATABASE\b/i, why: '데이터베이스 삭제' },
];

/** 주석만 제거한다. 문자열 리터럴은 남긴다 — EXECUTE '<DDL>' 우회를 놓치지 않기 위해서다. */
export function stripSqlComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ');
}

/** 파괴적 DDL 스캔. 매치 목록을 돌려준다(빈 배열 = 없음). */
export function scanDestructiveDDL(sql) {
  const cleaned = stripSqlComments(sql);
  const statements = cleaned.split(';');
  const found = [];
  for (const stmt of statements) {
    for (const p of DESTRUCTIVE_PATTERNS) {
      if (p.re.test(stmt)) {
        found.push({ id: p.id, why: p.why, snippet: stmt.trim().replace(/\s+/g, ' ').slice(0, 120) });
      }
    }
  }
  return found;
}

/**
 * base ref 가 실제로 해석되는지 확인한다.
 *
 * 이 검사가 없으면 ref 해석 실패 시 모든 파일이 "base 에 없음 = 신규"로 판정되어
 * (a) 머지된 파일 동결 검사가 통째로 공허해진다. 판정 불가는 통과가 아니다.
 */
export function verifyBaseRef(root, ref) {
  try {
    execFileSync('git', ['rev-parse', '--verify', `${ref}^{commit}`], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return true;
  } catch {
    return false;
  }
}

/** base(origin/main) 의 파일 내용을 읽는다. 없으면 null. */
export function gitBaseFileReader(root, baseRef = 'origin/main') {
  return (relPath) => {
    try {
      return execFileSync('git', ['show', `${baseRef}:${relPath}`], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: 32 * 1024 * 1024,
      });
    } catch {
      return null;
    }
  };
}

export function loadManifest(file = MANIFEST_PATH) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function buildManifest(dir = MIGRATIONS_DIR) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.up.sql')).sort();
  const out = {};
  for (const f of files) out[f] = sha256(fs.readFileSync(path.join(dir, f), 'utf8'));
  return out;
}

/**
 * FORBID-1 판정.
 *
 * @param {object} opts
 * @param {string} opts.dir             마이그레이션 디렉터리
 * @param {object|null} opts.manifest   매니페스트 JSON ({files: {name: sha}})
 * @param {(relPath: string) => (string|null)} opts.readBase  base 원본 리더
 * @param {string} opts.relDir          repo 루트 기준 마이그레이션 디렉터리 경로
 * @returns {{violations: {rule: string, message: string}[], checked: object}}
 */
export function checkMigrationIntegrity({ dir = MIGRATIONS_DIR, manifest, readBase, relDir = 'packages/db/migrations' }) {
  const violations = [];
  const add = (rule, message) => violations.push({ rule, message });

  const upFiles = fs.readdirSync(dir).filter((f) => f.endsWith('.up.sql')).sort();
  if (upFiles.length === 0) {
    add('FORBID-1', `up 마이그레이션이 0건이다: ${relDir} — 검사 대상 0건을 통과로 처리하지 않는다`);
    return { violations, checked: { upFiles: 0, inBase: 0, newFiles: 0 } };
  }

  if (!manifest || typeof manifest.files !== 'object' || manifest.files === null) {
    add('FORBID-1', `매니페스트(${relDir}/manifest.sha256.json)가 없거나 files 객체가 없다 — (a) 대조 근거가 없다`);
    return { violations, checked: { upFiles: upFiles.length, inBase: 0, newFiles: 0 } };
  }

  const manifestFiles = manifest.files;
  let inBase = 0;
  let newFiles = 0;

  for (const file of upFiles) {
    const rel = `${relDir}/${file}`;
    const current = fs.readFileSync(path.join(dir, file), 'utf8');
    const currentSha = sha256(current);

    // 매니페스트 완전성 — 파일이 있는데 등재가 없으면 (a) 검사가 그 파일만 비껴간다.
    if (!(file in manifestFiles)) {
      add('FORBID-1', `매니페스트에 등재되지 않은 up 파일: ${rel} — 등재 없이는 변경 탐지가 불가능하다`);
    } else if (manifestFiles[file] !== currentSha) {
      add(
        'FORBID-1',
        `매니페스트 sha256 불일치: ${rel} (매니페스트=${manifestFiles[file].slice(0, 12)} / 현재=${currentSha.slice(0, 12)})`,
      );
    }

    const baseContent = readBase(rel);
    if (baseContent === null) {
      // base 에 없는 파일 = 최초 도입 → (b) 정규식 검사 대상
      newFiles += 1;
      const hits = scanDestructiveDDL(current);
      for (const hit of hits) {
        add(
          'FORBID-1',
          `신규 up 마이그레이션에 데이터 손실형 DDL: ${rel} [${hit.id}] ${hit.why} — "${hit.snippet}". ` +
            '신규 컬럼 추가 → 백필 → 별도 태스크에서 폐기 순서를 따를 것',
        );
      }
    } else {
      // base 에 있는 파일 = 머지된 마이그레이션 → (a) 내용 동결
      inBase += 1;
      if (sha256(baseContent) !== currentSha) {
        add(
          'FORBID-1',
          `머지된 up 마이그레이션이 편집되었다: ${rel} — 적용된 DB 와 파일이 갈라지고, 되돌림 단위가 엉킨다. ` +
            '변경이 필요하면 새 버전의 마이그레이션을 추가한다',
        );
      }
    }
  }

  for (const file of Object.keys(manifestFiles)) {
    if (!upFiles.includes(file)) {
      add('FORBID-1', `매니페스트에만 있는 up 파일: ${relDir}/${file} — 머지된 마이그레이션이 삭제되었을 수 있다`);
    }
  }

  return { violations, checked: { upFiles: upFiles.length, inBase, newFiles } };
}

/**
 * 예외(파괴적 DDL 허용) 판정 — **순수 함수**.
 *
 * 계약: `allow-destructive` 라벨만으로는 불가하며 packages/db CODEOWNERS 승인 리뷰
 * (승인자 ≠ PR 작성자) + 백업 아티팩트 첨부가 **함께** 있어야 한다.
 *
 * 셋 중 하나라도 확인되지 않으면 예외가 아니다. 조회 불가도 예외가 아니다(판정 불가 ≠ 통과).
 */
export function evaluateDestructiveException({
  labels = [],
  codeownerApprovers = [],
  author = null,
  artifacts = [],
} = {}) {
  const reasons = [];
  const hasLabel = labels.map((l) => String(l).toLowerCase()).includes('allow-destructive');
  if (!hasLabel) reasons.push('`allow-destructive` 라벨이 없다');

  const validApprovers = codeownerApprovers.filter((a) => a && author && a !== author);
  if (validApprovers.length === 0) {
    reasons.push('packages/db CODEOWNERS 의 승인 리뷰(승인자 ≠ PR 작성자)가 없다');
  }

  const backups = artifacts.filter((a) => /^db-backup[-_.]/i.test(String(a)));
  if (backups.length === 0) reasons.push('백업 아티팩트(db-backup-*)가 첨부되지 않았다');

  return { allowed: reasons.length === 0, reasons, approvers: validApprovers, backups };
}
