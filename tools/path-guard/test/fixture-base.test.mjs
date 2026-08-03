/**
 * REQ-5 픽스처 브랜치의 비교 기준 선택 검증.
 *
 * 핵심은 두 방향이다:
 *   (1) 픽스처 ⑦ 형태(오버레이가 `.github/pr-task` 를 다른 계약으로 교체)에서 green 이 되는가
 *   (2) 그 완화가 PR 브랜치·위장 브랜치로 새지 않는가 (픽스처 ⑧ 은 여전히 red)
 *
 * 환경변수 통제: 자식 CLI 는 주변 프로세스의 CI 변수를 **상속하지 않는다**(helpers/env.mjs).
 * 각 케이스가 주입하는 값은 다음과 같다.
 *
 *   | 케이스                         | GITHUB_REF_NAME      | GITHUB_HEAD_REF     | GITHUB_EVENT_NAME |
 *   |--------------------------------|----------------------|---------------------|-------------------|
 *   | 픽스처 ⑦ green                 | ci-fixture/discovery | (없음)              | push              |
 *   | 픽스처 ⑧ red                   | ci-fixture/path-guard| (없음)              | push              |
 *   | PR 이벤트 완화 차단            | (없음)               | ci-fixture/discovery| pull_request      |
 *   | 위장 브랜치 / 없는 픽스처 / 2커밋| ci-fixture/<각각>    | (없음)              | push              |
 *   | 일반 브랜치                    | feat/f1-repo-scaffold| (없음)              | pull_request      |
 *   | 로컬 실행                      | (없음)               | (없음)              | (없음)            |
 *   | 오염 회귀 테스트               | (없음 — 주변에만 존재) | (없음)            | (없음)            |
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { cleanEnv, JUDGEMENT_ENV_KEYS } from './helpers/env.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ENTRY = path.resolve(HERE, '..', 'index.mjs');

function git(cwd, ...args) {
  const res = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (res.status !== 0) throw new Error(`git ${args.join(' ')} 실패: ${res.stderr}`);
  return res.stdout.trim();
}

function write(root, rel, content) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

const CONTRACT_F = `# F — 본 계약

\`\`\`yaml
id:            F-MAIN
deliverable:
  touches:
    - apps/web/**
    - tools/**
    - .github/**
    - docs/tasks/**
\`\`\`
`;

const CONTRACT_D = `# D — 하류 계약

\`\`\`yaml
id:            D-DOWNSTREAM
deliverable:
  touches:
    - scripts/discovery/validate_d1a.py
    - docs/discovery/D1a/**
\`\`\`
`;

/** PR HEAD(본 PR 의 대량 변경) 까지 만들어 둔 리포. */
function makePrRepo() {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'path-guard-fx-')));
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'path-guard test');
  write(root, 'README.md', 'base\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'base');
  git(root, 'update-ref', 'refs/remotes/origin/main', git(root, 'rev-parse', 'HEAD'));

  // 본 PR: 계약 + 픽스처 트리 + 대량 구현 파일
  write(root, 'docs/tasks/F.md', CONTRACT_F);
  write(root, 'docs/tasks/D.md', CONTRACT_D);
  write(root, '.github/pr-task', 'F-MAIN\n');
  write(root, '.github/ci-fixtures/discovery/fixture.json', '{"job":"discovery"}\n');
  write(root, '.github/ci-fixtures/path-guard/fixture.json', '{"job":"path-guard"}\n');
  for (let i = 0; i < 20; i += 1) write(root, `apps/web/src/f${i}.ts`, 'export {};\n');
  write(root, 'tools/path-guard/x.mjs', '// x\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'F-MAIN 구현');
  return root;
}

/** 픽스처 오버레이 커밋 1개를 PR HEAD 위에 얹는다 (fixtures-run.mjs 와 동일 형식). */
function overlay(root, { branch, name, files, subject }) {
  git(root, 'checkout', '-q', '-B', branch);
  for (const [rel, content] of Object.entries(files)) write(root, rel, content);
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', subject ?? `ci-fixture(${name}): REQ-5 위반 픽스처 오버레이`);
}

/**
 * CLI 실행. 판정 축이 되는 CI 환경변수는 상속하지 않고(helpers/env.mjs),
 * 각 케이스가 **필요한 값만 명시 주입**한다. 주입값은 각 테스트 이름·인자에 드러난다.
 */
function run(root, inject = {}) {
  const res = spawnSync(process.execPath, [ENTRY], {
    cwd: root,
    encoding: 'utf8',
    env: cleanEnv(inject),
  });
  return { code: res.status, out: res.stdout, err: res.stderr };
}

test('픽스처 ⑦ — pr-task 를 하류 계약으로 바꾼 오버레이는 green (기준 = 분기점)', () => {
  const root = makePrRepo();
  overlay(root, {
    branch: 'ci-fixture/discovery',
    name: 'discovery',
    files: {
      '.github/pr-task': 'D-DOWNSTREAM\n',
      'scripts/discovery/validate_d1a.py': 'import sys\nsys.exit(0)\n',
    },
  });
  const { code, out, err } = run(root, {
    GITHUB_REF_NAME: 'ci-fixture/discovery',
    GITHUB_EVENT_NAME: 'push',
  });
  assert.equal(code, 0, `stderr: ${err}`);
  assert.match(out, /픽스처 분기점 HEAD~1/);
  assert.match(out, /ci-fixture\(discovery\)/);
  assert.match(out, /변경 2건/); // pr-task + validate_d1a.py 만. F-MAIN 의 22개 파일은 기준 밖
});

test('픽스처 ⑧ — touches 밖 경로 오버레이는 여전히 red (탐지력 유지)', () => {
  const root = makePrRepo();
  overlay(root, {
    branch: 'ci-fixture/path-guard',
    name: 'path-guard',
    files: { 'docs/notes/out-of-touches.md': '# 밖\n' },
  });
  const { code, err } = run(root, {
    GITHUB_REF_NAME: 'ci-fixture/path-guard',
    GITHUB_EVENT_NAME: 'push',
  });
  assert.equal(code, 1);
  assert.match(err, /FORBID-4/);
  assert.match(err, /docs\/notes\/out-of-touches\.md/);
  assert.match(err, /픽스처 분기점 HEAD~1/); // 어떤 기준을 썼는지 실패 출력에도 남는다
});

test('픽스처 완화는 pull_request 이벤트에 적용되지 않는다 (우회 차단)', () => {
  const root = makePrRepo();
  overlay(root, {
    branch: 'ci-fixture/discovery',
    name: 'discovery',
    files: {
      '.github/pr-task': 'D-DOWNSTREAM\n',
      'scripts/discovery/validate_d1a.py': 'x\n',
    },
  });
  const { code, err } = run(root, {
    GITHUB_HEAD_REF: 'ci-fixture/discovery',
    GITHUB_EVENT_NAME: 'pull_request',
  });
  assert.equal(code, 1);
  assert.match(err, /픽스처 완화를 적용하지 않는다/);
  assert.match(err, /apps\/web\/src\/f0\.ts/); // origin/main 기준이므로 본 PR 변경 전량이 대상
});

test('ci-fixture/** 이름만 흉내낸 브랜치는 exit 1 (오버레이 커밋 형식 검증)', () => {
  const root = makePrRepo();
  overlay(root, {
    branch: 'ci-fixture/sneaky',
    name: 'sneaky',
    files: { 'docs/secret.md': 'x\n' },
    subject: 'chore: 평범한 커밋',
  });
  const { code, err } = run(root, {
    GITHUB_REF_NAME: 'ci-fixture/sneaky',
    GITHUB_EVENT_NAME: 'push',
  });
  assert.equal(code, 1);
  assert.match(err, /픽스처 오버레이 커밋이 아니다/);
});

test('대응 픽스처 트리가 없는 이름이면 exit 1 (커밋 제목만으로 완화하지 않는다)', () => {
  const root = makePrRepo();
  overlay(root, {
    branch: 'ci-fixture/ghost',
    name: 'ghost',
    files: { 'docs/secret.md': 'x\n' },
  });
  const { code, err } = run(root, {
    GITHUB_REF_NAME: 'ci-fixture/ghost',
    GITHUB_EVENT_NAME: 'push',
  });
  assert.equal(code, 1);
  assert.match(err, /ci-fixtures\/ghost\/` 트리가 리포지토리에 없다/);
});

test('오버레이 커밋이 2개 이상 쌓이면 exit 1 (앞선 커밋 미탐 방지)', () => {
  const root = makePrRepo();
  overlay(root, {
    branch: 'ci-fixture/path-guard',
    name: 'path-guard',
    files: { 'docs/notes/first.md': 'x\n' },
  });
  overlay(root, {
    branch: 'ci-fixture/path-guard',
    name: 'path-guard',
    files: { 'docs/notes/second.md': 'x\n' },
  });
  const { code, err } = run(root, {
    GITHUB_REF_NAME: 'ci-fixture/path-guard',
    GITHUB_EVENT_NAME: 'push',
  });
  assert.equal(code, 1);
  assert.match(err, /오버레이 커밋이 2개 이상/);
});

test('일반 브랜치는 origin/main 기준을 쓰고 그 사실을 출력한다', () => {
  const root = makePrRepo();
  write(root, '.github/pr-task', 'F-MAIN\n');
  git(root, 'add', '-A');
  const { code, out, err } = run(root, {
    GITHUB_REF_NAME: 'feat/f1-repo-scaffold',
    GITHUB_EVENT_NAME: 'pull_request',
  });
  assert.equal(code, 0, `stderr: ${err}`);
  assert.match(out, /기준: origin\/main\.\.\.HEAD/);
  assert.match(out, /ref=feat\/f1-repo-scaffold \(GITHUB_REF_NAME\)/);
});

test('주변 CI 환경변수(GITHUB_REF_NAME=ci-fixture/lint 등) 오염이 selftest 판정에 새지 않는다', () => {
  // 회귀 방어: selftest 를 `path-guard` job 안에서 돌리면 그 job 의 GITHUB_* 가 자식에게
  // 상속되어, 임시 리포의 브랜치가 main 이어도 픽스처 판정 경로를 타 버렸다.
  // run() 이 cleanEnv() 를 쓰지 않게 되돌아가면 이 테스트가 즉시 깨진다.
  const root = makePrRepo();
  const saved = Object.fromEntries(JUDGEMENT_ENV_KEYS.map((k) => [k, process.env[k]]));
  Object.assign(process.env, {
    GITHUB_ACTIONS: 'true',
    GITHUB_EVENT_NAME: 'push',
    GITHUB_REF_NAME: 'ci-fixture/lint',
    GITHUB_HEAD_REF: 'ci-fixture/lint',
    GITHUB_REPOSITORY: 'ahangcorp-hyemin/glowmate',
    CI: 'true',
  });
  try {
    const { code, out, err } = run(root); // 주입 없음 → 임시 리포 브랜치(main) 기준이어야 한다
    assert.equal(code, 0, `stderr: ${err}`);
    assert.match(out, /기준: origin\/main\.\.\.HEAD/);
    assert.doesNotMatch(out + err, /픽스처 분기점/);
    assert.doesNotMatch(out + err, /ci-fixture\/lint/);
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('로컬 실행(환경변수 없음)에서도 브랜치 이름으로 픽스처 모드가 결정된다', () => {
  const root = makePrRepo();
  overlay(root, {
    branch: 'ci-fixture/discovery',
    name: 'discovery',
    files: {
      '.github/pr-task': 'D-DOWNSTREAM\n',
      'scripts/discovery/validate_d1a.py': 'x\n',
    },
  });
  const { code, out, err } = run(root); // GITHUB_* 전부 빈 값 → git rev-parse 사용
  assert.equal(code, 0, `stderr: ${err}`);
  assert.match(out, /git rev-parse --abbrev-ref HEAD/);
});
