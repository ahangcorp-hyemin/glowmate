// tools/ci-meta/lib/codeowners.mjs
//
// `.github/CODEOWNERS` 파싱 + 경로 매칭 + 승인 리뷰 판정.
// REQ-7 · FORBID-2(사유 있는 disable 의 승인 요구) · FORBID-5(예산 상향 승인) 가 공유한다.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const CODEOWNERS_PATH = '.github/CODEOWNERS';

/** @returns {{exists:boolean, rules:Array<{pattern:string, owners:string[], line:number}>}} */
export function parseCodeowners(root) {
  const abs = path.join(root, CODEOWNERS_PATH);
  if (!existsSync(abs)) return { exists: false, rules: [] };
  const text = readFileSync(abs, 'utf8');
  const rules = [];
  text.split('\n').forEach((raw, idx) => {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) return;
    const parts = line.split(/\s+/);
    const pattern = parts[0];
    const owners = parts.slice(1).filter(Boolean);
    rules.push({ pattern, owners, line: idx + 1 });
  });
  return { exists: true, rules };
}

/** 비교용 정규화: 선행 `/`·후행 `/`·후행 `/**` 제거 */
export function normalizePattern(p) {
  let s = p.trim();
  if (s.startsWith('/')) s = s.slice(1);
  s = s.replace(/\/\*\*$/, '');
  s = s.replace(/\/$/, '');
  return s;
}

/** CODEOWNERS 글롭 → 정규식 */
export function patternToRegExp(pattern) {
  let p = pattern.trim();
  const anchored = p.startsWith('/');
  if (anchored) p = p.slice(1);
  const dirOnly = p.endsWith('/');
  if (dirOnly) p = p.slice(0, -1);

  let re = '';
  for (let i = 0; i < p.length; i += 1) {
    const c = p[i];
    if (c === '*') {
      if (p[i + 1] === '*') {
        re += '.*';
        i += 1;
        if (p[i + 1] === '/') i += 1;
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') re += '[^/]';
    else if ('.+^${}()|[]\\'.includes(c)) re += `\\${c}`;
    else re += c;
  }
  const prefix = anchored || p.includes('/') ? '^' : '^(?:.*/)?';
  // 디렉터리 패턴이거나 접미 `/**` 가 없는 경우에도 하위 전체를 포함한다.
  return new RegExp(`${prefix}${re}(?:/.*)?$`);
}

export function matchesPattern(pattern, filePath) {
  return patternToRegExp(pattern).test(filePath);
}

/** CODEOWNERS 의미론: 마지막으로 매칭된 규칙이 이긴다. */
export function ownersForPath(rules, filePath) {
  let owners = [];
  for (const r of rules) {
    if (matchesPattern(r.pattern, filePath)) owners = r.owners;
  }
  return owners;
}

export function normalizeOwner(o) {
  return String(o).replace(/^@/, '').toLowerCase();
}

/**
 * PR 의 승인 리뷰 중 작성자 본인이 아닌 승인자 로그인 집합.
 * @returns {Promise<{ok:true, approvers:string[]}|{ok:false, reason:string}>}
 */
export async function approvingReviewers(client, prNumber, author) {
  if (!prNumber) return { ok: false, reason: 'PR 번호를 확정할 수 없다 (GITHUB_EVENT_PATH / GITHUB_REF 부재)' };
  let reviews;
  try {
    reviews = await client.pullReviews(prNumber);
  } catch (err) {
    return { ok: false, reason: `PR #${prNumber} 리뷰 조회 실패: ${err.message}` };
  }
  /** 사용자별 최신 리뷰 상태 */
  const latest = new Map();
  for (const r of reviews) {
    const login = r?.user?.login;
    if (!login) continue;
    if (r.state === 'COMMENTED') continue; // 코멘트는 승인 상태를 바꾸지 않는다
    latest.set(login, r.state);
  }
  const approvers = [...latest.entries()]
    .filter(([login, state]) => state === 'APPROVED' && normalizeOwner(login) !== normalizeOwner(author ?? ''))
    .map(([login]) => login);
  return { ok: true, approvers };
}

/**
 * 특정 경로의 CODEOWNERS 소유자 중 승인자가 있는가.
 * 팀 소유자(@org/team)는 API 로 멤버십을 확인한다. 확인 실패는 통과가 아니라 unresolved 다.
 * @returns {Promise<{approved:boolean, matched:string[], unresolved:string[]}>}
 */
export async function hasCodeownerApproval(client, rules, filePath, approvers) {
  const owners = ownersForPath(rules, filePath);
  const matched = [];
  const unresolved = [];
  const approverSet = new Set(approvers.map(normalizeOwner));

  for (const owner of owners) {
    const bare = owner.replace(/^@/, '');
    if (bare.includes('/')) {
      const [org, slug] = bare.split('/');
      for (const a of approvers) {
        try {
          const m = await client.teamMembership(org, slug, a);
          if (m && m.state === 'active') matched.push(`${owner}:${a}`);
        } catch (err) {
          unresolved.push(`${owner} 멤버십 조회 실패(${a}): ${err.message}`);
        }
      }
    } else if (approverSet.has(normalizeOwner(bare))) {
      matched.push(bare);
    }
  }
  return { approved: matched.length > 0, matched, unresolved, owners };
}
