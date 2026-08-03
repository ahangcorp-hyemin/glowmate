// packages/db/schema/core/lib/github-evidence.mjs — F2a FORBID-1 예외 근거 조회
//
// 예외는 **세 가지가 함께** 있을 때만 성립한다(계약 detect):
//   ① `allow-destructive` 라벨  ② packages/db CODEOWNERS 승인 리뷰(승인자 ≠ PR 작성자)
//   ③ 백업 아티팩트(db-backup-*) 첨부
//
// 이 모듈은 근거를 **수집만** 하고 판정하지 않는다(판정은 evaluateDestructiveException).
// 조회에 실패하면 빈 근거를 돌려주며, 그 결과 예외는 성립하지 않는다 — 판정 불가는 통과가 아니다.
//
// ⚠ 유지보수자가 1명인 동안에는 "승인자 ≠ PR 작성자"가 물리적으로 불가능하므로 이 예외 경로는
//   열리지 않는다. 그때의 정상 경로는 우회가 아니라 **계약 개정 요청**이다
//   (신규 컬럼 추가 → 백필 → 별도 태스크 폐기 순서로도 대부분 해결된다).

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');
const CODEOWNERS = path.join(REPO_ROOT, '.github/CODEOWNERS');
const TARGET_PATH = 'packages/db/migrations/';

async function api(url, token) {
  // globalThis.fetch — Node 18+ 전역이며 별도 import 경로가 없다.
  const res = await globalThis.fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'glowmate-f2a-db-schema',
    },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status} ${url}`);
  return res.json();
}

/** packages/db 경로의 CODEOWNERS 소유자(개인 계정만). 팀 소유자는 해석하지 않는다. */
export function codeownersForMigrations(file = CODEOWNERS) {
  if (!fs.existsSync(file)) return [];
  const owners = [];
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (line === '') continue;
    const [pattern, ...rest] = line.split(/\s+/);
    const normalized = pattern.replace(/^\//, '').replace(/\/$/, '/');
    if (!TARGET_PATH.startsWith(normalized) && normalized !== TARGET_PATH) continue;
    for (const owner of rest) {
      if (owner.startsWith('@') && !owner.includes('/')) owners.push(owner.slice(1).toLowerCase());
    }
  }
  return [...new Set(owners)];
}

export async function fetchExceptionEvidence(env = process.env) {
  const token = env['GH_TOKEN'] ?? env['GITHUB_TOKEN'];
  const repo = env['GITHUB_REPOSITORY'];
  const eventPath = env['GITHUB_EVENT_PATH'];
  const runId = env['GITHUB_RUN_ID'];

  if (!token || !repo || !eventPath || !fs.existsSync(eventPath)) {
    return {
      source: 'unavailable — GH_TOKEN / GITHUB_REPOSITORY / GITHUB_EVENT_PATH 중 일부가 없다',
      input: { labels: [], codeownerApprovers: [], author: null, artifacts: [] },
    };
  }

  const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
  const pr = event.pull_request;
  if (!pr) {
    return {
      source: 'unavailable — pull_request 이벤트가 아니다 (예외는 PR 컨텍스트에서만 판정한다)',
      input: { labels: [], codeownerApprovers: [], author: null, artifacts: [] },
    };
  }

  const author = String(pr.user?.login ?? '').toLowerCase();
  const labels = (pr.labels ?? []).map((l) => String(l.name ?? '').toLowerCase());
  const owners = new Set(codeownersForMigrations());

  const reviews = await api(`https://api.github.com/repos/${repo}/pulls/${pr.number}/reviews?per_page=100`, token);
  const latestByUser = new Map();
  for (const r of reviews) {
    const login = String(r.user?.login ?? '').toLowerCase();
    if (login === '') continue;
    latestByUser.set(login, r.state);
  }
  const codeownerApprovers = [...latestByUser.entries()]
    .filter(([login, state]) => state === 'APPROVED' && owners.has(login))
    .map(([login]) => login);

  let artifacts = [];
  if (runId) {
    const res = await api(`https://api.github.com/repos/${repo}/actions/runs/${runId}/artifacts?per_page=100`, token);
    artifacts = (res.artifacts ?? []).map((a) => String(a.name));
  }

  return {
    source: `PR #${pr.number} (author=${author}, CODEOWNERS=${[...owners].join(',') || '없음'})`,
    input: { labels, codeownerApprovers, author, artifacts },
  };
}
