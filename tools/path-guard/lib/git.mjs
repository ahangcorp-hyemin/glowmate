/**
 * git 조회 래퍼. 모든 실패는 예외로 올린다.
 *
 * 특히 `origin/main` 이 없거나(얕은 클론·fetch-depth:1) merge-base 를 못 구하는
 * 환경에서 "빈 diff = 위반 0건"으로 통과시키지 않는다. 그 경로가 열리면
 * path-guard 는 CI 설정 한 줄로 영구 초록이 된다.
 */
import { spawnSync } from 'node:child_process';
import { fail } from './errors.mjs';

export const BASE_REF = 'origin/main';

function git(args, cwd) {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (res.error) {
    fail(`git 실행 실패 (${args.join(' ')}) — ${res.error.message}`);
  }
  return res;
}

export function gitOrFail(args, cwd, hint) {
  const res = git(args, cwd);
  if (res.status !== 0) {
    fail([
      `${hint}`,
      `  명령: git ${args.join(' ')}`,
      `  exit: ${res.status}`,
      `  stderr: ${(res.stderr || '').trim()}`,
    ]);
  }
  return res.stdout;
}

export function repoRoot(cwd) {
  return gitOrFail(
    ['rev-parse', '--show-toplevel'],
    cwd,
    'git 저장소 루트를 찾지 못했다 (path-guard 는 리포지토리 안에서 실행해야 한다).',
  ).trim();
}

export function resolveRef(ref, cwd) {
  return gitOrFail(
    ['rev-parse', '--verify', `${ref}^{commit}`],
    cwd,
    `기준 ref \`${ref}\` 를 해석하지 못해 변경 집합을 판정할 수 없다. ` +
      'CI 체크아웃이 얕은 클론(fetch-depth:1)이면 `fetch-depth: 0` 또는 ' +
      `\`git fetch origin main\` 으로 ${ref} 를 확보하라. ` +
      '판정 불가를 통과로 처리하지 않는다.',
  ).trim();
}

export function mergeBase(baseRef, headRef, cwd) {
  return gitOrFail(
    ['merge-base', baseRef, headRef],
    cwd,
    `\`${baseRef}\` 와 \`${headRef}\` 의 공통 조상을 찾지 못해 변경 집합을 판정할 수 없다 ` +
      '(얕은 클론이면 히스토리를 전부 받아야 한다).',
  ).trim();
}

/**
 * `git diff --name-only <base>...HEAD` 의 파일 목록.
 * -z 로 NUL 구분해 경로 인용/유니코드 이스케이프 문제를 피하고,
 * --no-renames 로 rename 의 원본 경로까지 판정 대상에 포함시킨다.
 */
export function changedFiles(baseRef, cwd) {
  const out = gitOrFail(
    ['diff', '--name-only', '--no-renames', '-z', `${baseRef}...HEAD`],
    cwd,
    `\`git diff ${baseRef}...HEAD\` 가 실패해 변경 집합을 판정할 수 없다.`,
  );
  return out.split('\0').filter((p) => p !== '');
}
