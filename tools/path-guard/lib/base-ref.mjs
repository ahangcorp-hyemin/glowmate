/**
 * 비교 기준(base) 선택.
 *
 * 기본은 `origin/main...HEAD` 다. 예외는 REQ-5 픽스처 브랜치 하나뿐이다.
 *
 * 왜 예외가 필요한가: 픽스처 브랜치(`ci-fixture/**`)는 tools/ci-meta/fixtures-run.mjs 가
 * **PR HEAD 에서 분기해 오버레이 커밋 1개**를 얹어 만든다. 따라서 `origin/main...HEAD`
 * 는 "F1 의 전체 변경 + 오버레이"가 되고, 픽스처 ⑦ 처럼 `.github/pr-task` 를 다른 계약
 * (`D1a-PROTOCOL`)으로 바꾸는 픽스처에서는 F1 파일 전량이 그 계약의 touches 밖으로 판정돼
 * `path-guard` 까지 red 가 된다 — REQ-5 의 "대응 job 만 red · 나머지 7 green" 이 깨진다
 * (감사 docs/audit/f1-gate2.md §4-1 이 예고한 발현).
 *
 * 그 브랜치에서 "이 PR 의 변경 집합"은 **오버레이가 더한 것**이므로 분기점(HEAD~1)이 기준이다.
 *
 * 이 완화가 PR 브랜치로 새지 않도록 조건을 좁힌다:
 *   (1) ref 이름이 `ci-fixture/` 로 시작하고,
 *   (2) 이벤트가 `pull_request` 가 **아니며** (PR 로 머지되는 경로에는 절대 적용하지 않는다 —
 *       적용하면 `ci-fixture/x` 로 브랜치를 명명하고 위반 커밋을 앞에 숨기는 우회가 열린다),
 *   (3) HEAD 가 병합 커밋이 아닌 단일 부모 커밋이고,
 *   (4) HEAD 의 커밋 제목이 `ci-fixture(<name>):` 형식이며,
 *   (5) `<name>` 에 대응하는 `.github/ci-fixtures/<name>/` 트리가 실제로 존재하고,
 *   (6) HEAD~1 이 또 다른 `ci-fixture(...)` 커밋이 **아니다** (오버레이 커밋은 정확히 1개).
 * 하나라도 어긋나면 기준을 확정할 수 없으므로 **exit 1** 이다. 판정 불가는 통과가 아니다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fail } from './errors.mjs';
import { BASE_REF, gitOrFail, mergeBase, resolveRef } from './git.mjs';

export const FIXTURE_BRANCH_PREFIX = 'ci-fixture/';
export const FIXTURE_COMMIT_SUBJECT = /^ci-fixture\(([^)]+)\):/;
export const FIXTURE_ROOT = '.github/ci-fixtures';

/** 실행 중인 ref 이름. CI 는 환경변수, 로컬은 git 으로 얻는다. */
export function detectRef(env, cwd) {
  const headRef = String(env.GITHUB_HEAD_REF ?? '').trim(); // pull_request 이벤트의 소스 브랜치
  if (headRef !== '') return { name: headRef, source: 'GITHUB_HEAD_REF' };

  const refName = String(env.GITHUB_REF_NAME ?? '').trim(); // push 이벤트의 브랜치
  if (refName !== '') return { name: refName, source: 'GITHUB_REF_NAME' };

  const local = gitOrFail(
    ['rev-parse', '--abbrev-ref', 'HEAD'],
    cwd,
    '현재 ref 이름을 확인할 수 없어 비교 기준을 정할 수 없다.',
  ).trim();
  return { name: local, source: 'git rev-parse --abbrev-ref HEAD' };
}

function subjectOf(rev, cwd) {
  return gitOrFail(
    ['log', '-1', '--format=%s', rev],
    cwd,
    `커밋 제목(${rev})을 읽지 못해 픽스처 오버레이 커밋인지 검증할 수 없다.`,
  ).trim();
}

function parentsOf(cwd) {
  const line = gitOrFail(
    ['rev-list', '--parents', '-n', '1', 'HEAD'],
    cwd,
    'HEAD 의 부모 커밋을 확인할 수 없어 픽스처 분기점을 정할 수 없다.',
  ).trim();
  const [, ...parents] = line.split(/\s+/).filter(Boolean);
  return parents;
}

/**
 * 픽스처 브랜치의 분기점(= 오버레이 커밋의 부모 = PR HEAD)을 확정한다.
 * 위 조건 (3)~(6) 중 하나라도 어긋나면 fail().
 */
function fixtureBase(root, ref) {
  const subject = subjectOf('HEAD', root);
  const m = FIXTURE_COMMIT_SUBJECT.exec(subject);
  if (!m) {
    fail([
      `ref \`${ref.name}\` 는 픽스처 브랜치 형식이지만 HEAD 가 픽스처 오버레이 커밋이 아니다 — 비교 기준을 확정할 수 없다.`,
      `  HEAD 제목: ${subject}`,
      '  기대 형식: `ci-fixture(<name>): ...` (tools/ci-meta/fixtures-run.mjs 가 만드는 커밋)',
      `  기준을 못 정하는 상태를 통과로 처리하지 않는다. 일반 브랜치라면 이름을 \`${FIXTURE_BRANCH_PREFIX}\` 로 시작하지 마라.`,
    ]);
  }
  const name = m[1];

  const fixtureDir = path.join(root, FIXTURE_ROOT, name);
  if (!fs.existsSync(fixtureDir)) {
    fail([
      `픽스처 오버레이 커밋이 가리키는 \`${FIXTURE_ROOT}/${name}/\` 트리가 리포지토리에 없다 — 실제 픽스처인지 확인할 수 없다.`,
      `  HEAD 제목: ${subject}`,
      '  커밋 제목만으로 완화 모드에 들어가지 않는다.',
    ]);
  }

  const parents = parentsOf(root);
  if (parents.length !== 1) {
    fail([
      `픽스처 오버레이 커밋의 부모가 ${parents.length}개다 (기대: 1개) — 분기점을 확정할 수 없다.`,
      '  픽스처 브랜치는 PR HEAD 의 직계 자식 커밋 1개여야 한다 (병합 커밋 금지).',
    ]);
  }

  const parentSubject = subjectOf('HEAD~1', root);
  if (FIXTURE_COMMIT_SUBJECT.test(parentSubject)) {
    fail([
      '픽스처 오버레이 커밋이 2개 이상 쌓여 있어 분기점을 확정할 수 없다.',
      `  HEAD:    ${subject}`,
      `  HEAD~1:  ${parentSubject}`,
      '  HEAD~1 만 기준으로 잡으면 앞선 오버레이 커밋의 변경이 판정에서 빠진다(미탐).',
      '  픽스처 브랜치는 PR HEAD 에서 다시 만들어라 (fixtures-run.mjs 는 `git checkout -B` 로 항상 그렇게 만든다).',
    ]);
  }

  const sha = resolveRef('HEAD~1', root);
  return {
    mode: 'fixture',
    fixture: name,
    spec: sha,
    sha,
    ref,
    lines: [
      `  기준: 픽스처 분기점 HEAD~1 (${sha.slice(0, 7)}) — ci-fixture(${name}) 오버레이 커밋 1개만 판정`,
      `        ref=${ref.name} (${ref.source}) · 이 완화는 ci-fixture/** 이외의 ref 에는 적용되지 않는다`,
    ],
  };
}

/** 기본 경로: origin/main 과의 공통 조상. */
function defaultBase(root, ref, note) {
  resolveRef(BASE_REF, root);
  const sha = mergeBase(BASE_REF, 'HEAD', root);
  return {
    mode: 'default',
    fixture: null,
    spec: BASE_REF,
    sha,
    ref,
    lines: [
      `  기준: ${BASE_REF}...HEAD (${sha.slice(0, 7)}) · ref=${ref.name} (${ref.source})`,
      ...(note ? [`        ${note}`] : []),
    ],
  };
}

/** 비교 기준을 결정한다. 실패는 전부 예외(exit 1). */
export function resolveBase({ cwd, env = process.env } = {}) {
  const ref = detectRef(env, cwd);
  const eventName = String(env.GITHUB_EVENT_NAME ?? '').trim();
  const looksFixture = ref.name.startsWith(FIXTURE_BRANCH_PREFIX);

  if (!looksFixture) return defaultBase(cwd, ref);

  if (eventName === 'pull_request') {
    // PR 로 머지되는 경로에는 완화를 적용하지 않는다. 적용하면 브랜치 이름만 바꿔
    // 위반 커밋을 앞에 숨기는 우회가 열린다.
    return defaultBase(
      cwd,
      ref,
      'ci-fixture/** 이지만 pull_request 이벤트이므로 픽스처 완화를 적용하지 않는다.',
    );
  }

  return fixtureBase(cwd, ref);
}
