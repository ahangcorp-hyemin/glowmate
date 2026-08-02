#!/usr/bin/env node
// tools/ci-meta/fixtures-run.mjs
//
// REQ-5 픽스처 오버레이 드라이버 — `.github/ci-fixtures/<job>/` 부분 트리를
// 리포 루트에 덮어써 `ci-fixture/<job>` 브랜치를 만들고, 실제 Actions 런을 발생시킨다.
//
// 계약은 이 오버레이 방식을 규정하지 않는다(감사 f1-gate2 §4-1). 아래 규약은 오케스트레이터 확정본이다.
//
//   · 픽스처 트리는 리포 루트에 **덮어쓰기**되는 부분 트리다.
//   · 브랜치 이름은 `ci-fixture/<job>` 고정. base 는 현재 PR 의 HEAD.
//   · 오버레이 후 `.github/pr-task` 는 **그 픽스처가 침범하는 경로를 touches 로 갖는 계약 ID** 로 교체한다.
//     예) 픽스처 ⑦ 은 `scripts/discovery/validate_d*.py` 를 만드는데 그 경로는 F1 touches 밖이다.
//         `.github/pr-task` 를 `D1a-PROTOCOL` 로 바꾸지 않으면 같은 런에서 path-guard 도 red 가 되어
//         "대응 job 만 red · 나머지 7 green" 이 깨진다.
//   · 각 트리는 lockfile 정합을 유지해야 한다 — install 실패로 전 job 이 red 가 되면 귀속 검증이 깨진다.
//
// **기본은 --dry-run 이다. push 는 --push 를 명시해야만 수행한다.**
// 픽스처 트리가 하나라도 없으면 exit 1 이다 (검사 대상 0건 통과 금지).
//
// 사용:
//   node tools/ci-meta/fixtures-run.mjs                 # dry-run: 계획만 출력 (기본)
//   node tools/ci-meta/fixtures-run.mjs --job discovery # 특정 픽스처만
//   node tools/ci-meta/fixtures-run.mjs --push          # 실제 브랜치 생성 + push
//   node tools/ci-meta/fixtures-run.mjs --push --collect # push 후 런 URL 수집까지

import { existsSync, readFileSync, statSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { Report, repoRoot, exec, fmtSet, guard } from './lib/util.mjs';
import { createGitHub } from './lib/github.mjs';
import { FIXTURES, FIXTURE_MANIFEST_NAME, conventionalFixtureBranch } from './fixture-rules.mjs';
import { CI_WORKFLOW } from './lib/workflow.mjs';
import { blobSha } from './lib/git.mjs';

const RULE = 'REQ-5';
const FIXTURE_ROOT = '.github/ci-fixtures';

/* ── 인자 ────────────────────────────────────────────────────────────────── */

const argv = process.argv.slice(2);
const opts = {
  push: argv.includes('--push'),
  collect: argv.includes('--collect'),
  job: null,
  remote: 'origin',
};
{
  const i = argv.indexOf('--job');
  if (i >= 0) opts.job = argv[i + 1] ?? null;
  const r = argv.indexOf('--remote');
  if (r >= 0) opts.remote = argv[r + 1] ?? 'origin';
}
const dryRun = !opts.push;

/* ── 트리 수집 ───────────────────────────────────────────────────────────── */

function walk(dir, base = '') {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const abs = path.join(dir, entry);
    const rel = base ? `${base}/${entry}` : entry;
    if (statSync(abs).isDirectory()) out.push(...walk(abs, rel));
    else out.push(rel);
  }
  return out;
}

/**
 * 픽스처 트리 하나를 읽어 오버레이 계획을 만든다.
 * @returns {{job:string, dir:string, files:string[], prTask:string|null, manifest:object|null}}
 */
function planFixture(root, fx) {
  const dir = path.join(root, FIXTURE_ROOT, fx.job);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    return { job: fx.job, dir: null, files: [], prTask: null, manifest: null };
  }
  const all = walk(dir);
  const manifestPath = path.join(dir, FIXTURE_MANIFEST_NAME);
  let manifest = null;
  if (existsSync(manifestPath)) manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  // fixture.json 은 드라이버 메타데이터이므로 오버레이 대상이 아니다.
  const files = all.filter((f) => f !== FIXTURE_MANIFEST_NAME);
  const prTask = manifest?.pr_task ?? null;
  return { job: fx.job, dir, files, prTask, manifest };
}

/* ── 실행 ────────────────────────────────────────────────────────────────── */

const report = new Report(`fixtures-run (REQ-5 오버레이 드라이버, ${dryRun ? 'DRY-RUN' : 'PUSH'})`);
const root = repoRoot();

const targets = opts.job ? FIXTURES.filter((f) => f.job === opts.job) : FIXTURES;
if (targets.length === 0) {
  report.fail(RULE, `--job ${opts.job} 에 해당하는 픽스처가 없다 (유효: ${fmtSet(FIXTURES.map((f) => f.job))})`);
  process.exit(report.print());
}

const headSha = exec('git', ['rev-parse', 'HEAD'], { cwd: root });
if (!headSha.ok) {
  report.fail(RULE, 'HEAD 를 해석할 수 없다 — 픽스처 브랜치의 base 를 확정할 수 없다', headSha.stderr);
  process.exit(report.print());
}
const base = headSha.stdout.trim();
report.info(
  RULE,
  `base=현재 PR HEAD ${base.slice(0, 8)} · 워크플로 blob sha=${blobSha(root, CI_WORKFLOW) ?? '<계산 불가>'} · 대상 픽스처 ${targets.length}종`,
);

const plans = [];
await guard(report, RULE, '픽스처 트리 수집', async () => {
  for (const fx of targets) {
    const plan = planFixture(root, fx);
    plans.push({ fx, plan });
    if (!plan.dir) {
      report.fail(
        RULE,
        `픽스처 트리 ${FIXTURE_ROOT}/${fx.job}/ 가 없다 — ${fx.label}. 트리 없이 드라이버를 성공으로 끝내지 않는다`,
      );
      continue;
    }
    if (plan.files.length === 0) {
      report.fail(
        RULE,
        `픽스처 트리 ${FIXTURE_ROOT}/${fx.job}/ 에 오버레이할 파일이 0건이다 (fixture.json 제외) — 위반을 담지 않은 트리는 탐지력을 입증하지 못한다`,
      );
      continue;
    }
    if (!plan.prTask) {
      report.info(
        RULE,
        `${fx.job}: fixture.json 에 \`pr_task\` 가 없다 — \`.github/pr-task\` 를 교체하지 않는다. ` +
          `픽스처가 F1 touches 밖 경로를 건드리면 같은 런에서 path-guard 도 red 가 되어 "나머지 7 green" 이 깨진다`,
      );
    }
    report.pass(
      RULE,
      `${fx.job}: 오버레이 ${plan.files.length}개 파일` +
        (plan.prTask ? ` · .github/pr-task → ${plan.prTask}` : ''),
      plan.files.map((f) => `  ${f}`).join('\n'),
    );
  }
});

if (report.failed) {
  report.fail(RULE, '픽스처 트리 준비가 끝나지 않아 브랜치를 만들지 않는다');
  process.exit(report.print());
}

/* ── 오버레이 & push ─────────────────────────────────────────────────────── */

function overlayCommands(plan) {
  const branch = conventionalFixtureBranch(plan.job);
  const cmds = [
    `git checkout -B ${branch} ${base}`,
    ...plan.files.map(
      (f) => `mkdir -p "$(dirname ${f})" && cp ${FIXTURE_ROOT}/${plan.job}/${f} ${f}`,
    ),
  ];
  if (plan.prTask) cmds.push(`printf '%s\\n' '${plan.prTask}' > .github/pr-task`);
  cmds.push(
    `git add -A`,
    `git commit -m "ci-fixture(${plan.job}): REQ-5 위반 픽스처 오버레이"`,
    `git push --force-with-lease ${opts.remote} ${branch}`,
  );
  return { branch, cmds };
}

await guard(report, RULE, '오버레이', async () => {
  for (const { fx, plan } of plans) {
    const { branch, cmds } = overlayCommands(plan);
    if (dryRun) {
      report.info(
        RULE,
        `DRY-RUN ${fx.job} → 브랜치 ${branch}`,
        cmds.map((c) => `  $ ${c}`).join('\n'),
      );
      continue;
    }

    const startBranch = exec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root });
    if (!startBranch.ok) {
      report.fail(RULE, `${fx.job}: 현재 브랜치를 확인할 수 없어 오버레이를 중단한다`, startBranch.stderr);
      return;
    }
    const dirty = exec('git', ['status', '--porcelain'], { cwd: root });
    if (!dirty.ok || dirty.stdout.trim() !== '') {
      report.fail(
        RULE,
        `${fx.job}: 워킹트리가 깨끗하지 않아 오버레이를 중단한다 — 커밋되지 않은 변경이 픽스처 브랜치에 섞이면 귀속 검증이 깨진다`,
        dirty.stdout,
      );
      return;
    }

    const co = exec('git', ['checkout', '-B', branch, base], { cwd: root });
    if (!co.ok) {
      report.fail(RULE, `${fx.job}: 브랜치 ${branch} 생성 실패`, co.stderr);
      return;
    }
    for (const f of plan.files) {
      const src = path.join(plan.dir, f);
      const dst = path.join(root, f);
      const mk = exec('mkdir', ['-p', path.dirname(dst)]);
      if (!mk.ok) {
        report.fail(RULE, `${fx.job}: ${path.dirname(f)} 생성 실패`, mk.stderr);
        return;
      }
      writeFileSync(dst, readFileSync(src));
    }
    if (plan.prTask) writeFileSync(path.join(root, '.github/pr-task'), `${plan.prTask}\n`);

    const add = exec('git', ['add', '-A'], { cwd: root });
    if (!add.ok) {
      report.fail(RULE, `${fx.job}: git add 실패`, add.stderr);
      return;
    }
    const commit = exec(
      'git',
      ['commit', '-m', `ci-fixture(${plan.job}): REQ-5 위반 픽스처 오버레이`],
      { cwd: root },
    );
    if (!commit.ok) {
      report.fail(RULE, `${fx.job}: git commit 실패 (오버레이가 아무 변경도 만들지 않았을 수 있다)`, commit.stderr || commit.stdout);
      return;
    }
    const push = exec('git', ['push', '--force-with-lease', opts.remote, branch], { cwd: root });
    if (!push.ok) {
      report.fail(RULE, `${fx.job}: ${branch} push 실패`, push.stderr);
      return;
    }
    report.pass(RULE, `${fx.job}: ${branch} push 완료 (${plan.files.length}개 파일 오버레이)`);

    const back = exec('git', ['checkout', startBranch.stdout.trim()], { cwd: root });
    if (!back.ok) {
      report.fail(RULE, `${fx.job}: 원래 브랜치(${startBranch.stdout.trim()})로 복귀 실패 — 수동 복구 필요`, back.stderr);
      return;
    }
  }
});

/* ── 런 URL 수집 ─────────────────────────────────────────────────────────── */

if (opts.collect) {
  await guard(report, RULE, '런 수집', async () => {
    const gh = createGitHub();
    if (!gh.available) {
      report.fail(RULE, '--collect 인데 GitHub API 를 쓸 수 없다', gh.reason);
      return;
    }
    const localSha = blobSha(root, CI_WORKFLOW);
    for (const { fx, plan } of plans) {
      const branch = conventionalFixtureBranch(plan.job);
      const runs = await gh.client.workflowRunsForBranch(branch);
      const sorted = runs
        .filter((r) => !r.path || r.path === CI_WORKFLOW)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      if (sorted.length === 0) {
        report.fail(RULE, `${fx.job}: ${branch} 에 런이 0건이다`);
        continue;
      }
      const latest = sorted[0];
      const content = await gh.client.contentSha(CI_WORKFLOW, latest.head_sha);
      const fresh = content && content.sha === localSha;
      report.info(
        RULE,
        `${fx.job}: run #${latest.id} status=${latest.status} conclusion=${latest.conclusion} 신선도=${fresh ? 'OK' : 'MISMATCH'}`,
        [
          `  ${latest.html_url}`,
          `  fixture.json 에 기록할 값: {"branch": "${branch}", "run_id": ${latest.id}}`,
        ].join('\n'),
      );
      if (!fresh) {
        report.fail(
          RULE,
          `${fx.job}: 최신 런의 워크플로 blob sha 가 현재 PR 과 다르다 — index.mjs 의 신선도 검사에서 무효 처리된다`,
        );
      }
    }
  });
}

if (dryRun) {
  report.info(
    RULE,
    'DRY-RUN 이므로 브랜치를 만들지도 push 하지도 않았다. 실제 실행: `node tools/ci-meta/fixtures-run.mjs --push` (수집까지: `--push --collect`)',
  );
}

process.exit(report.print());
