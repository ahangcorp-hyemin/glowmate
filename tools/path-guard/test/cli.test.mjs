/**
 * 통합 테스트 — 임시 git 리포에서 `node tools/path-guard/index.mjs` 를 실제로 실행해
 * 종료 코드와 출력 문자열을 검증한다.
 *
 * 검사기 자신이 침묵 통과하지 않는지가 핵심이므로, 통과 케이스보다 실패 케이스가 많다.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { cleanEnv } from './helpers/env.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENTRY = path.resolve(HERE, '..', 'index.mjs');

function git(cwd, ...args) {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (res.status !== 0) {
    throw new Error(`git ${args.join(' ')} 실패: ${res.stderr}`);
  }
  return res.stdout.trim();
}

function write(root, rel, content) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

const CONTRACT = `# T1 — 테스트 계약

\`\`\`yaml
id:            T1-DEMO
deliverable:
  pr_count:    1
  touches:
    - apps/web/**                      # 웹
    - packages/api/package.json
  artifacts:
    - "x"
\`\`\`
`;

/** 계약 + 초기 커밋 + origin/main ref 를 갖춘 임시 리포를 만든다. */
function makeRepo({ contract = CONTRACT, prTask = 'T1-DEMO', withOrigin = true } = {}) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'path-guard-')));
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'path-guard test');
  write(root, 'docs/tasks/T1.md', contract);
  write(root, 'README.md', 'base\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'base');
  if (withOrigin) git(root, 'update-ref', 'refs/remotes/origin/main', git(root, 'rev-parse', 'HEAD'));
  if (prTask !== null) write(root, '.github/pr-task', `${prTask}\n`);
  return root;
}

function commitChanges(root, files) {
  for (const [rel, content] of Object.entries(files)) write(root, rel, content);
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'change');
}

/**
 * CLI 실행. 이 파일의 모든 케이스는 **CI 환경변수가 하나도 없는** 상태를 전제한다
 * (GITHUB_REF_NAME · GITHUB_HEAD_REF · GITHUB_EVENT_NAME 미주입 →
 *  ref 는 임시 리포의 `git rev-parse --abbrev-ref HEAD` = `main` 으로 판정되고,
 *  픽스처 완화 경로는 타지 않는다). 주변 job 의 값이 새면 결과가 바뀌므로
 *  cleanEnv() 로 상속을 끊는다 — helpers/env.mjs 참조.
 */
function run(root) {
  const res = spawnSync(process.execPath, [ENTRY], {
    cwd: root,
    encoding: 'utf8',
    env: cleanEnv(),
  });
  return { code: res.status, out: res.stdout, err: res.stderr };
}

test('touches 안의 변경만 있으면 exit 0', () => {
  const root = makeRepo();
  commitChanges(root, {
    'apps/web/src/app/page.tsx': 'export default () => null;\n',
    'packages/api/package.json': '{}\n',
  });
  const { code, out, err } = run(root);
  assert.equal(code, 0, `stderr: ${err}`);
  assert.match(out, /위반 0건/);
});

test('touches 밖 경로 1건이면 exit 1 · FORBID-4 토큰과 위반 경로 출력', () => {
  const root = makeRepo();
  commitChanges(root, {
    'apps/web/src/app/page.tsx': 'x\n',
    'packages/db/schema/core/venue.sql': '-- 타 태스크 소유\n',
  });
  const { code, err } = run(root);
  assert.equal(code, 1);
  assert.match(err, /FORBID-4/);
  assert.match(err, /packages\/db\/schema\/core\/venue\.sql/);
  assert.doesNotMatch(err, /apps\/web\/src\/app\/page\.tsx/);
});

test('전 계약 공통 허용 3경로는 touches 밖이어도 exit 0', () => {
  const root = makeRepo();
  commitChanges(root, {
    'apps/web/src/app/page.tsx': 'x\n',
    'pnpm-lock.yaml': 'lockfileVersion: 9\n',
    'packages/config/dependency-classes.json': '{"@radix-ui/react-dialog":"other"}\n',
  });
  const { code, out, err } = run(root);
  assert.equal(code, 0, `stderr: ${err}`);
  assert.match(out, /공통 허용: pnpm-lock\.yaml/);
  assert.match(out, /공통 허용: packages\/config\/dependency-classes\.json/);
  assert.match(out, /공통 허용: \.github\/pr-task/);
});

test('dependency-classes.json 이 아닌 packages/config 파일은 공통 허용이 아니다', () => {
  const root = makeRepo();
  commitChanges(root, { 'packages/config/tsconfig.base.json': '{}\n' });
  const { code, err } = run(root);
  assert.equal(code, 1);
  assert.match(err, /FORBID-4/);
  assert.match(err, /packages\/config\/tsconfig\.base\.json/);
});

test('.github/pr-task 부재면 exit 1', () => {
  const root = makeRepo({ prTask: null });
  commitChanges(root, { 'apps/web/x.ts': 'x\n' });
  const { code, err } = run(root);
  assert.equal(code, 1);
  assert.match(err, /FORBID-4/);
  assert.match(err, /pr-task/);
});

test('미등재 계약 ID 면 exit 1', () => {
  const root = makeRepo({ prTask: 'T9-NOT-A-CONTRACT' });
  commitChanges(root, { 'apps/web/x.ts': 'x\n' });
  const { code, err } = run(root);
  assert.equal(code, 1);
  assert.match(err, /FORBID-4/);
  assert.match(err, /등재되어 있지 않다/);
});

test('파일명 축약형(T1)은 정본 ID 가 아니므로 exit 1', () => {
  const root = makeRepo({ prTask: 'T1' });
  commitChanges(root, { 'apps/web/x.ts': 'x\n' });
  const { code, err } = run(root);
  assert.equal(code, 1);
  assert.match(err, /T1-DEMO/); // 후보 힌트
});

test('pr-task 가 비어 있으면 exit 1', () => {
  const root = makeRepo({ prTask: '' });
  commitChanges(root, { 'apps/web/x.ts': 'x\n' });
  const { code, err } = run(root);
  assert.equal(code, 1);
  assert.match(err, /비어 있다/);
});

test('pr-task 에 계약 ID 가 2줄이면 exit 1', () => {
  const root = makeRepo({ prTask: 'T1-DEMO\nT2-OTHER' });
  commitChanges(root, { 'apps/web/x.ts': 'x\n' });
  const { code, err } = run(root);
  assert.equal(code, 1);
  assert.match(err, /1줄이어야 한다/);
});

test('계약에 touches 항목이 있으나 파싱 불가면 exit 1 (침묵 통과 금지)', () => {
  const broken = CONTRACT.replace(
    '  touches:\n    - apps/web/**                      # 웹\n    - packages/api/package.json\n',
    '  touches: [apps/web/**,\n    packages/api/package.json\n',
  );
  const root = makeRepo({ contract: broken });
  commitChanges(root, { 'apps/web/x.ts': 'x\n' });
  const { code, err } = run(root);
  assert.equal(code, 1);
  assert.match(err, /파싱하지 못했다/);
});

test('계약에 touches 키가 없으면 exit 1', () => {
  const noTouches = CONTRACT.replace(/ {2}touches:[\s\S]*? {2}artifacts:/, '  artifacts:');
  const root = makeRepo({ contract: noTouches });
  commitChanges(root, { 'apps/web/x.ts': 'x\n' });
  const { code, err } = run(root);
  assert.equal(code, 1);
  assert.match(err, /touches:` 블록이 없다/);
});

test('origin/main 이 없으면 exit 1 (빈 diff 통과 금지)', () => {
  const root = makeRepo({ withOrigin: false });
  commitChanges(root, { 'apps/web/x.ts': 'x\n' });
  const { code, err } = run(root);
  assert.equal(code, 1);
  assert.match(err, /FORBID-4/);
  assert.match(err, /origin\/main/);
});

test('origin/main 대비 커밋이 0건이면 exit 1', () => {
  const root = makeRepo();
  const { code, err } = run(root); // 커밋 없이 실행 (.github/pr-task 는 미커밋 상태)
  assert.equal(code, 1);
  assert.match(err, /커밋 0건/);
});

test('삭제·rename 된 원본 경로도 판정 대상이다', () => {
  const root = makeRepo();
  commitChanges(root, { 'apps/web/keep.ts': 'x\n' });
  fs.rmSync(path.join(root, 'README.md'));
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'delete README (touches 밖)');
  const { code, err } = run(root);
  assert.equal(code, 1);
  assert.match(err, /README\.md/);
});
