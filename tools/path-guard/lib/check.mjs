/**
 * FORBID-4 (F1-REPO-SCAFFOLD) 집행기 — CI job 이름 `path-guard`.
 *
 * 판정 절차
 *   1. `.github/pr-task` 에서 이 PR 이 구현하는 계약 ID 1줄을 읽는다 (부재·공백·2줄 이상 → exit 1)
 *   2. 그 ID 로 docs/tasks/*.md 의 `id:` 를 대조해 계약을 찾는다 (미등재 → exit 1)
 *   3. 계약의 `touches` 블록을 직접 파싱한다 (touches 키가 있는데 항목 0건 → exit 1)
 *   4. `git diff --name-only <base>...HEAD` 와 대조한다 (diff 획득 실패 → exit 1).
 *      base 는 기본 `origin/main` 이고, REQ-5 픽스처 브랜치(`ci-fixture/**`)에서만
 *      분기점(오버레이 커밋의 부모 = PR HEAD)이다 — 판정 근거는 lib/base-ref.mjs 참조.
 *   5. touches 글롭 밖 경로가 1건이라도 있으면 exit 1 (전 계약 공통 허용 3경로는 제외)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fail, FORBID_TOKEN } from './errors.mjs';
import { loadContracts, parseTouches } from './contract.mjs';
import { compilePatterns, matchPath, normalizePath } from './glob.mjs';
import { changedFiles, repoRoot, resolveRef } from './git.mjs';
import { resolveBase } from './base-ref.mjs';

export const PR_TASK_PATH = '.github/pr-task';
export const TASKS_DIR = 'docs/tasks';

/**
 * 전 계약 공통 허용 경로 (touches 밖이어도 통과).
 *  - .github/pr-task                          : 판정 원천 자체. 모든 PR 이 자기 ID 를 기재해야 한다
 *  - pnpm-lock.yaml                           : 의존 추가 시 반드시 갱신된다
 *  - packages/config/dependency-classes.json  : F1 REQ-3(b) 가 전 패키지에 의존 분류를 강제하므로
 *                                               의존을 추가하는 모든 하류 계약이 편집해야 한다.
 *                                               (감사 f1-gate2 §1 B-3b′ — 이 허용이 없으면 DS1·DS3 은
 *                                                boundary red 와 path-guard red 사이에서 합법 경로가 0개다)
 */
export const ALWAYS_ALLOWED = Object.freeze([
  '.github/pr-task',
  'pnpm-lock.yaml',
  'packages/config/dependency-classes.json',
]);

export function readPrTask(root) {
  const file = path.join(root, PR_TASK_PATH);
  if (!fs.existsSync(file)) {
    fail([
      `\`${PR_TASK_PATH}\` 가 없다 — 이 PR 이 구현하는 계약을 판정할 수 없다.`,
      `  해결: \`${PR_TASK_PATH}\` 에 계약 정본 ID 1줄을 기재하라 (예: F1-REPO-SCAFFOLD).`,
      `  ${FORBID_TOKEN} 은 판정 원천 부재를 통과로 처리하지 않는다.`,
    ]);
  }
  const lines = fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+#.*$/, '').trim())
    .filter((line) => line !== '' && !line.startsWith('#'));

  if (lines.length === 0) {
    fail(`\`${PR_TASK_PATH}\` 가 비어 있다 — 계약 ID 1줄을 기재하라.`);
  }
  if (lines.length > 1) {
    fail([
      `\`${PR_TASK_PATH}\` 에 계약 ID 가 ${lines.length} 줄 있다 — 태스크 1개 = PR 1개 원칙상 1줄이어야 한다.`,
      ...lines.map((line) => `  - ${line}`),
    ]);
  }
  return lines[0];
}

export function resolveContract(root, taskId) {
  const tasksDir = path.join(root, TASKS_DIR);
  if (!fs.existsSync(tasksDir)) {
    fail(`\`${TASKS_DIR}\` 디렉터리가 없다 — 계약 원문 없이는 touches 를 판정할 수 없다.`);
  }
  const { byId, duplicates, scanned } = loadContracts(tasksDir);

  const dupe = duplicates.find((d) => d.id === taskId);
  if (dupe) {
    fail([
      `계약 ID \`${taskId}\` 가 2개 이상의 계약 파일에 중복 정의되어 있다 — touches 를 확정할 수 없다.`,
      ...dupe.files.map((f) => `  - ${path.relative(root, f)}`),
    ]);
  }

  const found = byId.get(taskId);
  if (!found) {
    const hints = [...byId.keys()]
      .filter((id) => id.split('-')[0].toLowerCase() === String(taskId).split('-')[0].toLowerCase())
      .slice(0, 5);
    fail([
      `\`${PR_TASK_PATH}\` 의 계약 ID \`${taskId}\` 가 ${TASKS_DIR}/*.md 어디에도 등재되어 있지 않다 ` +
        `(계약 ${byId.size}건 / 파일 ${scanned}개 조회).`,
      '  판정 원천은 계약 파일의 `id:` 필드(정본 ID)다. 파일명 축약형(F1)이 아니라 정본 ID(F1-REPO-SCAFFOLD)를 기재하라.',
      ...(hints.length > 0 ? [`  후보: ${hints.join(', ')}`] : []),
    ]);
  }
  return found;
}

export function touchesOf(contract, root) {
  const rel = path.relative(root, contract.file);
  const { present, entries, form } = parseTouches(contract.body);
  if (!present) {
    fail([
      `계약 \`${contract.id}\` (${rel}) 에 \`touches:\` 블록이 없다 — 변경 허용 범위를 판정할 수 없다.`,
      '  deliverable.touches 는 계약 규격(docs/02-task-contract-spec.md §1)의 필수 필드다.',
    ]);
  }
  if (entries.length === 0) {
    fail([
      `계약 \`${contract.id}\` (${rel}) 의 \`touches:\` 를 파싱하지 못했다 (형식: ${form}, 항목 0건).`,
      '  원문에 touches 키가 있는데 항목이 0건이면 "위반 없음"이 아니라 파싱 실패다.',
      '  판정 불가를 통과로 처리하지 않는다 — 계약 표기를 규격에 맞추거나 파서를 고쳐라.',
    ]);
  }
  return entries;
}

export function classify(files, touches) {
  const compiled = compilePatterns(touches);
  const allowed = new Set(ALWAYS_ALLOWED.map(normalizePath));
  const inside = [];
  const commonAllowed = [];
  const violations = [];

  for (const raw of files) {
    const file = normalizePath(raw);
    if (allowed.has(file)) {
      commonAllowed.push(file);
      continue;
    }
    const hit = matchPath(file, compiled);
    if (hit) inside.push({ file, pattern: hit });
    else violations.push(file);
  }
  return { inside, commonAllowed, violations };
}

/** 검사 본체. 실패는 전부 PathGuardError 로 던진다. 성공 시 리포트를 반환한다. */
export function runCheck({ cwd = process.cwd(), env = process.env } = {}) {
  const root = repoRoot(cwd);
  const taskId = readPrTask(root);
  const contract = resolveContract(root, taskId);
  const touches = touchesOf(contract, root);

  // 비교 기준은 base-ref.mjs 가 결정한다 (기본 origin/main, 픽스처 브랜치만 분기점).
  // 어떤 기준을 썼는지는 성공·실패 양쪽 출력에 반드시 남긴다.
  const base = resolveBase({ cwd: root, env });
  const headSha = resolveRef('HEAD', root);
  if (base.sha === headSha) {
    fail([
      `이 ref 의 변경 집합이 존재하지 않는다 (기준 커밋 == HEAD, 커밋 0건).`,
      ...base.lines,
      '  체크아웃 ref 가 잘못되었을 가능성이 높다. 빈 변경 집합을 통과로 처리하지 않는다.',
    ]);
  }

  const files = changedFiles(base.spec, root);
  const { inside, commonAllowed, violations } = classify(files, touches);

  if (violations.length > 0) {
    fail([
      `계약 \`${contract.id}\` (${path.relative(root, contract.file)}) 의 touches 글롭 밖 경로 ` +
        `${violations.length}건이 변경되었다 — 타 태스크 소유 경로 선행 작성 금지.`,
      ...violations.map((file) => `  - ${file}`),
      '',
      ...base.lines,
      `  허용 범위(touches ${touches.length}건): ${touches.join(', ')}`,
      `  전 계약 공통 허용: ${ALWAYS_ALLOWED.join(', ')}`,
      '  범위 밖 작업이 정말 필요하면 계약을 개정하라. 검사기를 우회하지 마라.',
    ]);
  }

  return {
    taskId: contract.id,
    contractFile: path.relative(root, contract.file),
    baseMode: base.mode,
    baseRef: base.spec,
    baseSha: base.sha,
    fixture: base.fixture,
    headSha,
    touches,
    files,
    inside,
    commonAllowed,
    lines: [
      `path-guard: 계약 ${contract.id} (${path.relative(root, contract.file)}) · touches ${touches.length}건`,
      ...base.lines,
      `  HEAD: ${headSha.slice(0, 7)}`,
      `  변경 ${files.length}건 = touches 내 ${inside.length}건 + 공통 허용 ${commonAllowed.length}건 + 위반 0건`,
      ...commonAllowed.map((file) => `  · 공통 허용: ${file}`),
    ],
  };
}
