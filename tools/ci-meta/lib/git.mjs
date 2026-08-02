// tools/ci-meta/lib/git.mjs
//
// git 기반 조회 — base 커밋 해석 · diff 의 추가 라인 추출 · blob 읽기.
// FORBID-2(마스킹 패턴 diff 스캔) · FORBID-5(ci-budget diff) · FORBID-6(a) 가 사용한다.

import { exec, CheckError } from './util.mjs';

/**
 * base 브랜치 ref 를 해석한다.
 * @returns {{ok:true, ref:string, sha:string, mergeBase:string}|{ok:false, reason:string}}
 */
export function resolveBase(root) {
  const candidates = [];
  if (process.env.GITHUB_BASE_REF) {
    candidates.push(`origin/${process.env.GITHUB_BASE_REF}`, process.env.GITHUB_BASE_REF);
  }
  candidates.push('origin/main', 'main');

  for (const ref of candidates) {
    const r = exec('git', ['rev-parse', '--verify', `${ref}^{commit}`], { cwd: root });
    if (!r.ok) continue;
    const sha = r.stdout.trim();
    const mb = exec('git', ['merge-base', sha, 'HEAD'], { cwd: root });
    if (!mb.ok) {
      return {
        ok: false,
        reason: `${ref} 는 존재하나 HEAD 와의 merge-base 를 구할 수 없다 (얕은 클론이면 fetch-depth: 0 필요): ${mb.stderr.trim()}`,
      };
    }
    return { ok: true, ref, sha, mergeBase: mb.stdout.trim() };
  }
  return {
    ok: false,
    reason: `base ref 후보 ${candidates.join(', ')} 중 어느 것도 해석되지 않았다`,
  };
}

/**
 * 현재 워크플로/워킹트리가 올라와 있는 브랜치 이름.
 * PR 이벤트에서는 `GITHUB_HEAD_REF`(소스 브랜치), push 에서는 `GITHUB_REF_NAME` 이 원천이다.
 * @returns {{branch:string|null, source:string}}
 */
export function currentBranch(root) {
  if (process.env.GITHUB_HEAD_REF) {
    return { branch: process.env.GITHUB_HEAD_REF, source: 'GITHUB_HEAD_REF (PR 소스 브랜치)' };
  }
  if (process.env.GITHUB_REF_NAME) {
    return { branch: process.env.GITHUB_REF_NAME, source: 'GITHUB_REF_NAME' };
  }
  const ref = process.env.GITHUB_REF;
  if (ref && ref.startsWith('refs/heads/')) {
    return { branch: ref.slice('refs/heads/'.length), source: 'GITHUB_REF' };
  }
  const r = exec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root });
  if (r.ok) {
    const b = r.stdout.trim();
    return { branch: b === 'HEAD' ? null : b, source: 'git rev-parse --abbrev-ref HEAD' };
  }
  return { branch: null, source: '판정 불가' };
}

/** <rev>:<path> 의 blob 내용. 없으면 null. */
export function showBlob(root, rev, relPath) {
  const r = exec('git', ['show', `${rev}:${relPath}`], { cwd: root });
  if (!r.ok) return null;
  return r.stdout;
}

/** 특정 리비전의 트리에 존재하는 파일 목록. */
export function listTree(root, rev) {
  const r = exec('git', ['ls-tree', '-r', '--name-only', rev], { cwd: root });
  if (!r.ok) {
    throw new CheckError(`git ls-tree ${rev} 실패: ${r.stderr.trim()}`);
  }
  return r.stdout.split('\n').filter(Boolean);
}

/** 워킹트리 기준 추적 대상 파일 목록 (스테이징된 신규 파일 포함). */
export function listWorkingFiles(root) {
  const r = exec('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: root,
  });
  if (!r.ok) {
    throw new CheckError(`git ls-files 실패: ${r.stderr.trim()}`);
  }
  return r.stdout.split('\n').filter(Boolean);
}

/** 파일 하나의 blob sha (신선도 검사용). */
export function blobSha(root, relPath) {
  const r = exec('git', ['hash-object', relPath], { cwd: root });
  if (!r.ok) return null;
  return r.stdout.trim();
}

/**
 * base..worktree diff 에서 **추가된 라인**만 파일별로 뽑는다.
 * 새 파일 라인 번호를 함께 반환하므로 라인 단위 예외 처리(ci-required 의 if:)가 가능하다.
 *
 * @returns {Map<string, Array<{line:number, text:string}>>}
 */
export function addedLinesByFile(root, baseSha) {
  const r = exec(
    'git',
    ['diff', '--unified=0', '--no-color', '--no-ext-diff', '--find-renames', baseSha, '--'],
    { cwd: root },
  );
  if (!r.ok) {
    throw new CheckError(`git diff ${baseSha} 실패: ${r.stderr.trim()}`);
  }
  return parseUnifiedDiff(r.stdout);
}

/**
 * base..워킹트리에서 변경(추가·수정·삭제·이름변경)된 파일 전량 + untracked 신규 파일.
 * REQ-7 (c-3) 독립 PR 판정이 사용한다.
 */
export function changedFiles(root, baseSha) {
  const r = exec('git', ['diff', '--name-only', '--no-renames', baseSha, '--'], { cwd: root });
  if (!r.ok) {
    throw new CheckError(`git diff --name-only ${baseSha} 실패: ${r.stderr.trim()}`);
  }
  const set = new Set(r.stdout.split('\n').filter(Boolean));
  const untracked = exec('git', ['ls-files', '--others', '--exclude-standard'], { cwd: root });
  if (untracked.ok) for (const f of untracked.stdout.split('\n').filter(Boolean)) set.add(f);
  return [...set].sort();
}

export function parseUnifiedDiff(diffText) {
  /** @type {Map<string, Array<{line:number, text:string}>>} */
  const out = new Map();
  let current = null;
  let newLine = 0;

  for (const raw of diffText.split('\n')) {
    if (raw.startsWith('+++ ')) {
      const p = raw.slice(4).trim();
      current = p === '/dev/null' ? null : p.replace(/^b\//, '');
      if (current && !out.has(current)) out.set(current, []);
      continue;
    }
    if (raw.startsWith('--- ') || raw.startsWith('diff --git ')) continue;
    if (raw.startsWith('@@')) {
      const m = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
      if (m) newLine = Number(m[1]);
      continue;
    }
    if (!current) continue;
    if (raw.startsWith('+')) {
      out.get(current).push({ line: newLine, text: raw.slice(1) });
      newLine += 1;
    }
  }
  // 변경 라인이 0건인 파일 엔트리는 제거 (모드 변경 등)
  for (const [k, v] of out) if (v.length === 0) out.delete(k);
  return out;
}

/**
 * origin/main 에 머지된 계약 ID 집합을 `.github/pr-task` 의 이력에서 산출한다.
 *
 * 각 PR 은 `.github/pr-task` 에 자신이 구현하는 계약 ID 를 1줄로 기재한다(F1 FORBID-4).
 * 따라서 base 브랜치에서 그 파일을 건드린 전 커밋의 값 집합 = 머지된 계약 ID 집합이다.
 * F1b 의 docs/tasks.json 에 의존하지 않는 자립 경로다.
 *
 * @returns {{ok:true, ids:string[], commits:number}|{ok:false, reason:string}}
 */
export function mergedContractIds(root, baseRef) {
  const log = exec(
    'git',
    ['log', '--format=%H', baseRef, '--', '.github/pr-task'],
    { cwd: root },
  );
  if (!log.ok) {
    return { ok: false, reason: `git log ${baseRef} -- .github/pr-task 실패: ${log.stderr.trim()}` };
  }
  const shas = log.stdout.split('\n').filter(Boolean);
  const ids = new Set();
  for (const sha of shas) {
    const content = showBlob(root, sha, '.github/pr-task');
    if (content == null) continue;
    for (const line of content.split('\n')) {
      const t = line.replace(/#.*$/, '').trim();
      if (t) ids.add(t);
    }
  }
  return { ok: true, ids: [...ids].sort(), commits: shas.length };
}
