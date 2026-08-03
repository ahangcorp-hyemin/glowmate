/**
 * 승인 게이트 (REQ-3 (ii)(iii) · FORBID-1 (c)).
 *
 * 승인이 필요한 diff:
 *   - dependency-classes.json 에 `data-access` 분류 신규 추가
 *   - dependency-classes.json 기존 항목의 분류 변경 (방향 무관 — data-access → other 강등이 최단 우회로다)
 *   - data-access-names.json 에 매칭되는 이름을 `other` 로 신규 등재/변경 (위장)
 *   - db-driver-exceptions.json 의 항목 추가·변경
 *
 * 판정 원칙:
 *   - CI 컨텍스트(GITHUB_ACTIONS=true)에서 승인 여부를 **판정할 수 없으면 실패**다.
 *     판정 불가를 통과로 처리하면 게이트가 사라진다.
 *   - 로컬에서는 파일 기반 검사만 하고 승인 검사는 SKIPPED(local) 로 명시 출력한다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export function isCI(env = process.env) {
  return env.GITHUB_ACTIONS === 'true';
}

function git(root, args) {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  return { ok: r.status === 0, stdout: r.stdout ?? '', stderr: r.stderr ?? '', status: r.status };
}

/** base ref 후보를 순서대로 시도한다. */
export function resolveBaseRef(root, env = process.env) {
  const candidates = [];
  if (env.GITHUB_BASE_REF) {
    candidates.push(`origin/${env.GITHUB_BASE_REF}`, env.GITHUB_BASE_REF);
  }
  if (env.DEP_GRAPH_BASE_REF) candidates.push(env.DEP_GRAPH_BASE_REF);
  candidates.push('origin/main', 'main');
  for (const ref of candidates) {
    const r = git(root, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
    if (r.ok && r.stdout.trim() !== '') return { ok: true, ref, sha: r.stdout.trim() };
  }
  return { ok: false, tried: candidates };
}

/** base 시점의 파일 내용. 파일이 없으면 exists=false (최초 도입 커밋) */
export function readAtRef(root, ref, rel) {
  const r = git(root, ['show', `${ref}:${rel}`]);
  if (!r.ok) return { exists: false };
  return { exists: true, text: r.stdout };
}

function safeParse(text) {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * 승인 필요 항목 산출.
 * @returns {{ok: boolean, error?: string, requirements: {kind: string, detail: string}[]}}
 */
export function computeApprovalRequirements({
  root,
  baseRef,
  headClasses,
  headExceptionsRaw,
  matchDataAccessName,
  classesFile,
  exceptionsFile,
}) {
  const requirements = [];

  // ── dependency-classes.json ────────────────────────────────────────────
  const baseClassesFile = readAtRef(root, baseRef, classesFile);
  let baseClasses = {};
  if (baseClassesFile.exists) {
    const parsed = safeParse(baseClassesFile.text);
    if (!parsed.ok) {
      return { ok: false, error: `${classesFile} (base=${baseRef}) 파싱 실패: ${parsed.error}`, requirements };
    }
    baseClasses = parsed.value?.classes ?? {};
  }

  // baseExists=false 는 **최초 도입 diff** 다. REQ-7 (c-3) 독립 PR 요구의 대상이 아니다
  // — 이 파일들을 처음 만드는 F1 자신의 PR 이 차단되면 안 된다(P7 자기차단).
  const classesBaseExists = baseClassesFile.exists;
  for (const [name, cls] of Object.entries(headClasses)) {
    const before = Object.prototype.hasOwnProperty.call(baseClasses, name) ? baseClasses[name] : null;
    const spoofPattern = matchDataAccessName(name);
    if (before === null) {
      if (cls === 'data-access') {
        requirements.push({
          kind: 'classes.add-data-access',
          file: classesFile,
          baseExists: classesBaseExists,
          detail: `${classesFile}: "${name}" 을 data-access 로 신규 등재`,
        });
      } else if (spoofPattern) {
        requirements.push({
          kind: 'classes.add-spoof',
          file: classesFile,
          baseExists: classesBaseExists,
          detail:
            `${classesFile}: "${name}" 은 data-access-names.json 의 "${spoofPattern}" 에 매칭되는데 ` +
            `"${cls}" 로 신규 등재 (위장 등재 — REQ-3 (iii))`,
        });
      }
      // (i) `other` 신규 추가는 어느 상태에서도 승인 불필요 — DS1·DS3 의 합법 경로다.
    } else if (before !== cls) {
      requirements.push({
        kind: 'classes.change',
        file: classesFile,
        baseExists: classesBaseExists,
        detail: `${classesFile}: "${name}" 의 분류가 "${before}" → "${cls}" 로 변경됨`,
      });
    }
  }
  for (const name of Object.keys(baseClasses)) {
    if (!Object.prototype.hasOwnProperty.call(headClasses, name)) {
      requirements.push({
        kind: 'classes.remove',
        file: classesFile,
        baseExists: classesBaseExists,
        detail: `${classesFile}: "${name}" 등재가 삭제됨 (허용목록 축소)`,
      });
    }
  }

  // ── db-driver-exceptions.json ──────────────────────────────────────────
  const baseExcFile = readAtRef(root, baseRef, exceptionsFile);
  let baseEntries = [];
  if (baseExcFile.exists) {
    const parsed = safeParse(baseExcFile.text);
    if (!parsed.ok) {
      return { ok: false, error: `${exceptionsFile} (base=${baseRef}) 파싱 실패: ${parsed.error}`, requirements };
    }
    baseEntries = Array.isArray(parsed.value) ? parsed.value : [];
  }
  const key = (e) => JSON.stringify([e?.package, e?.dependency, e?.reason, e?.expires_at, e?.approved_by]);
  const baseKeys = new Set(baseEntries.map(key));
  const headEntries = Array.isArray(headExceptionsRaw) ? headExceptionsRaw : [];
  for (const e of headEntries) {
    if (!baseKeys.has(key(e))) {
      requirements.push({
        kind: 'exceptions.change',
        file: exceptionsFile,
        baseExists: baseExcFile.exists,
        detail: `${exceptionsFile}: 항목 추가·변경 (${e?.package ?? '?'} → ${e?.dependency ?? '?'})`,
      });
    }
  }

  return { ok: true, requirements };
}

// ── CODEOWNERS ───────────────────────────────────────────────────────────
const CODEOWNERS_PATHS = ['.github/CODEOWNERS', 'CODEOWNERS', 'docs/CODEOWNERS'];

export function loadCodeowners(root) {
  for (const rel of CODEOWNERS_PATHS) {
    const abs = path.join(root, rel);
    if (fs.existsSync(abs)) {
      return { ok: true, file: rel, rules: parseCodeowners(fs.readFileSync(abs, 'utf8')) };
    }
  }
  return { ok: false, error: `CODEOWNERS 파일이 없다 (탐색: ${CODEOWNERS_PATHS.join(', ')})` };
}

export function parseCodeowners(text) {
  const rules = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (line === '') continue;
    const parts = line.split(/\s+/);
    const pattern = parts[0];
    const owners = parts.slice(1).filter((o) => o.startsWith('@') || o.includes('@'));
    rules.push({ pattern, owners });
  }
  return rules;
}

/** gitignore 류 패턴 매칭(디렉터리 접두 · `*` 지원)의 최소 구현 */
export function codeownersMatch(pattern, filePath) {
  let p = pattern;
  if (p.startsWith('/')) p = p.slice(1);
  const dirOnly = p.endsWith('/');
  if (dirOnly) p = p.slice(0, -1);
  const anchored = pattern.startsWith('/') || p.includes('/');
  const re = new RegExp(
    `${anchored ? '^' : '(^|/)'}${p
      .split('**')
      .map((seg) =>
        seg
          .split('*')
          .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
          .join('[^/]*'),
      )
      .join('.*')}${dirOnly ? '(/|$)' : '($|/)'}`,
  );
  return re.test(filePath);
}

export function ownersFor(rules, filePath) {
  let owners = null;
  for (const rule of rules) {
    if (codeownersMatch(rule.pattern, filePath)) owners = rule.owners;
  }
  return owners;
}

// ── GitHub API ───────────────────────────────────────────────────────────
export function ghToken(env = process.env) {
  return env.GITHUB_TOKEN || env.GH_TOKEN || null;
}

export function prContext(env = process.env) {
  const repo = env.GITHUB_REPOSITORY ?? null;
  let number = null;
  let author = null;
  const eventPath = env.GITHUB_EVENT_PATH;
  if (eventPath && fs.existsSync(eventPath)) {
    try {
      const ev = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
      number = ev?.pull_request?.number ?? ev?.number ?? null;
      author = ev?.pull_request?.user?.login ?? null;
    } catch {
      // 이벤트 페이로드를 못 읽으면 아래 GITHUB_REF 경로로 넘어간다. 실패는 호출측이 판정한다.
    }
  }
  if (number === null && typeof env.GITHUB_REF === 'string') {
    const m = /^refs\/pull\/(\d+)\//.exec(env.GITHUB_REF);
    if (m) number = Number(m[1]);
  }
  return { repo, number, author, eventName: env.GITHUB_EVENT_NAME ?? null };
}

async function api(url, token) {
  const res = await fetch(url, {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'user-agent': 'glowmate-dep-graph',
      'x-github-api-version': '2022-11-28',
    },
  });
  if (!res.ok) {
    return { ok: false, error: `GitHub API ${res.status} ${res.statusText} — ${url}` };
  }
  return { ok: true, value: await res.json() };
}

/**
 * REQ-7 acceptance (c) — push 권한 보유 collaborator 수.
 *
 * 2 이상이면 타인 승인 리뷰를 요구하고, 1이면 `single_maintainer` 대체 규약((c-3) 독립 PR)이 적용된다.
 * **조회 실패는 판정 불가이므로 실패다** — 실패를 "1명"으로 간주하면 누구나 완화 규약으로 내려올 수 있다.
 * @returns {Promise<{ok: boolean, error?: string, count?: number, logins?: string[]}>}
 */
export async function countPushCollaborators({ env = process.env } = {}) {
  const token = ghToken(env);
  if (!token) {
    return { ok: false, error: 'GITHUB_TOKEN/GH_TOKEN 이 없어 collaborator 수를 조회할 수 없다' };
  }
  const repo = env.GITHUB_REPOSITORY;
  if (!repo) {
    return { ok: false, error: 'GITHUB_REPOSITORY 가 없어 collaborator 수를 조회할 수 없다' };
  }
  const res = await api(
    `https://api.github.com/repos/${repo}/collaborators?affiliation=all&per_page=100`,
    token,
  );
  if (!res.ok) return { ok: false, error: `${res.error} (collaborator 조회 실패)` };
  if (!Array.isArray(res.value)) {
    return { ok: false, error: 'collaborator 응답이 배열이 아니다' };
  }
  const pushers = res.value.filter((c) => c?.permissions?.push === true);
  return { ok: true, count: pushers.length, logins: pushers.map((c) => c.login) };
}

/** base 이후 변경된 파일 집합 (커밋된 diff + 작업 트리 diff 의 합집합) */
export function changedFiles(root, baseRef) {
  const committed = git(root, ['diff', '--name-only', `${baseRef}...HEAD`]);
  const working = git(root, ['diff', '--name-only', 'HEAD']);
  if (!committed.ok || !working.ok) {
    return {
      ok: false,
      error: `변경 파일 목록을 얻지 못했다 (base=${baseRef}): ${(committed.stderr || working.stderr).trim()}`,
    };
  }
  const files = new Set(
    `${committed.stdout}\n${working.stdout}`
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l !== ''),
  );
  return { ok: true, files: [...files].sort() };
}

/**
 * REQ-7 (c-3) — `single_maintainer` 상태의 승인 대체 조건.
 *
 * 승인 대상 diff 를 가진 파일은 **그 파일 하나만 포함하는 독립 PR** 이어야 한다.
 * 타인 승인을 흉내내지 않고 검증 가능한 것(독립 PR)만 요구한다.
 * 최초 도입 diff(baseExists=false)는 대상이 아니다.
 *
 * @returns {{ok: boolean, error?: string, detail?: string}}
 */
export function verifySingleMaintainer({ root, baseRef, requirements }) {
  const subject = [...new Set(requirements.filter((r) => r.baseExists).map((r) => r.file))];
  const initial = requirements.filter((r) => !r.baseExists);
  if (subject.length === 0) {
    return {
      ok: true,
      detail:
        `(c-3) 대상 없음 — 승인 대상 ${requirements.length}건이 전부 최초 도입 diff 다 ` +
        `(${[...new Set(initial.map((r) => r.file))].join(', ')})`,
    };
  }
  if (subject.length > 1) {
    return {
      ok: false,
      error:
        `(c-3) 승인 대상 파일이 ${subject.length}개다 (${subject.join(', ')}) — ` +
        '각각 그 파일 하나만 포함하는 독립 PR 로 분리하라',
    };
  }
  const file = subject[0];
  const cf = changedFiles(root, baseRef);
  if (!cf.ok) return { ok: false, error: `${cf.error} — (c-3) 독립 PR 여부를 판정할 수 없다` };
  if (cf.files.length === 0) {
    return {
      ok: false,
      error: `(c-3) base=${baseRef} 대비 변경 파일이 0건인데 승인 대상 diff 가 산출됐다 — 판정 불가`,
    };
  }
  const others = cf.files.filter((f) => f !== file);
  if (others.length > 0) {
    return {
      ok: false,
      error:
        `(c-3) ${file} 의 승인 대상 변경은 **그 파일 하나만 포함하는 독립 PR** 이어야 한다. ` +
        `함께 변경된 파일 ${others.length}건: ${others.slice(0, 10).join(', ')}` +
        (others.length > 10 ? ' …' : ''),
    };
  }
  return { ok: true, detail: `(c-3) 독립 PR 확인 — 변경 파일이 ${file} 1건뿐이다` };
}

/**
 * 승인 검증. 승인자는 packages/config CODEOWNERS 소유자 집합에 속하고 PR 작성자와 달라야 한다.
 * @returns {Promise<{ok: boolean, error?: string, approver?: string}>}
 */
export async function verifyApproval({ root, env = process.env, ownerPath }) {
  const token = ghToken(env);
  if (!token) return { ok: false, error: 'GITHUB_TOKEN/GH_TOKEN 이 없어 승인 여부를 판정할 수 없다' };
  const ctx = prContext(env);
  if (!ctx.repo) return { ok: false, error: 'GITHUB_REPOSITORY 가 없어 승인 여부를 판정할 수 없다' };
  if (ctx.number === null) {
    return {
      ok: false,
      error: `PR 번호를 알 수 없다 (event=${ctx.eventName ?? 'unknown'}) — 승인 여부를 판정할 수 없다`,
    };
  }

  const co = loadCodeowners(root);
  if (!co.ok) return { ok: false, error: `${co.error} — 승인자 집합을 판정할 수 없다` };
  const owners = ownersFor(co.rules, ownerPath);
  if (owners === null || owners.length === 0) {
    return { ok: false, error: `${co.file} 에 ${ownerPath} 의 소유자가 없다 — 승인자 집합을 판정할 수 없다` };
  }

  let author = ctx.author;
  if (!author) {
    const pr = await api(`https://api.github.com/repos/${ctx.repo}/pulls/${ctx.number}`, token);
    if (!pr.ok) return { ok: false, error: `${pr.error} (PR 작성자 조회 실패)` };
    author = pr.value?.user?.login ?? null;
  }
  if (!author) return { ok: false, error: 'PR 작성자를 판정할 수 없다' };

  const reviews = await api(
    `https://api.github.com/repos/${ctx.repo}/pulls/${ctx.number}/reviews?per_page=100`,
    token,
  );
  if (!reviews.ok) return { ok: false, error: `${reviews.error} (리뷰 조회 실패)` };

  // 소유자 집합 전개 (팀은 멤버 조회로 확장. 조회 실패 = 판정 불가 = 실패)
  const individuals = new Set();
  for (const owner of owners) {
    const handle = owner.startsWith('@') ? owner.slice(1) : owner;
    if (handle.includes('/')) {
      const [org, slug] = handle.split('/');
      const members = await api(
        `https://api.github.com/orgs/${org}/teams/${slug}/members?per_page=100`,
        token,
      );
      if (!members.ok) {
        return { ok: false, error: `${members.error} (팀 @${handle} 멤버 조회 실패 — 승인자 판정 불가)` };
      }
      for (const m of members.value) individuals.add(m.login.toLowerCase());
    } else {
      individuals.add(handle.toLowerCase());
    }
  }

  const approvers = new Set();
  const latestByUser = new Map();
  for (const r of reviews.value) {
    const login = r?.user?.login;
    if (!login) continue;
    if (r.state === 'APPROVED' || r.state === 'CHANGES_REQUESTED' || r.state === 'DISMISSED') {
      latestByUser.set(login.toLowerCase(), r.state);
    }
  }
  for (const [login, state] of latestByUser) if (state === 'APPROVED') approvers.add(login);

  const authorLc = author.toLowerCase();
  for (const a of approvers) {
    if (a !== authorLc && individuals.has(a)) return { ok: true, approver: a };
  }
  return {
    ok: false,
    error:
      `${ownerPath} 의 CODEOWNERS 승인(승인자 ≠ PR 작성자 "${author}")이 없다. ` +
      `소유자=${[...individuals].join(', ') || '(없음)'} / 승인자=${[...approvers].join(', ') || '(없음)'}`,
  };
}
