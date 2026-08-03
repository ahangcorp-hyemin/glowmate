#!/usr/bin/env node
// tools/ci-meta/fixtures-run.mjs
//
// REQ-5 픽스처 오버레이 드라이버 — `.github/ci-fixtures/<name>/overlay/` 부분 트리를
// 리포 루트에 덮어써 픽스처 브랜치를 만들고, 실제 Actions 런을 발생시킨다.
//
// 계약은 이 오버레이 방식을 규정하지 않는다(감사 f1-gate2 §4-1). 규약은 `fixture.json` 이 정본이다:
//
//   { "job": "discovery", "expect": ["FORBID-6"], "branch": "ci-fixture/discovery",
//     "overlay": "overlay/", "run_id": 123 }
//
//   · `overlay` 이하가 리포 루트에 **덮어쓰기**된다.
//   · `.github/pr-task` 교체가 필요한 픽스처는 그 파일을 **오버레이 트리 안에 둔다**
//     (예: 픽스처 ⑦ 의 `overlay/.github/pr-task` = `D1a-PROTOCOL`). 픽스처 ⑦ 은
//     `scripts/discovery/validate_d*.py` 를 만드는데 그 경로는 F1 touches 밖이므로,
//     pr-task 를 바꾸지 않으면 같은 런에서 path-guard 도 red 가 되어
//     "대응 job 만 red · 나머지 7 green" 이 깨진다.
//   · 각 트리는 lockfile 정합을 유지해야 한다 — install 실패로 전 job 이 red 가 되면 귀속 검증이 깨진다.
//
// **기본은 --dry-run 이다. push 는 --push 를 명시해야만 수행한다.**
// REQ-5 필수 픽스처 8종 중 하나라도 트리가 없으면 exit 1 이다 (검사 대상 0건 통과 금지).
//
// 사용:
//   node tools/ci-meta/fixtures-run.mjs                  # dry-run: 계획만 출력 (기본)
//   node tools/ci-meta/fixtures-run.mjs --job discovery  # 특정 픽스처만
//   node tools/ci-meta/fixtures-run.mjs --push           # 실제 브랜치 생성 + push
//   node tools/ci-meta/fixtures-run.mjs --push --collect # push 후 런 URL·신선도 수집

import { existsSync, readFileSync, statSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { Report, repoRoot, exec, fmtSet, guard } from './lib/util.mjs';
import { createGitHub } from './lib/github.mjs';
import { FIXTURES, FIXTURE_MANIFEST_NAME, conventionalFixtureBranch } from './fixture-rules.mjs';
import { CI_WORKFLOW } from './lib/workflow.mjs';
import { blobSha } from './lib/git.mjs';

const RULE = 'REQ-5';
const FIXTURE_ROOT = '.github/ci-fixtures';
const PR_TASK = '.github/pr-task';

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

/** `.github/ci-fixtures/` 하위 픽스처 디렉터리 전량 */
function discoverFixtureDirs(root) {
  const base = path.join(root, FIXTURE_ROOT);
  if (!existsSync(base)) return [];
  return readdirSync(base)
    .filter((d) => statSync(path.join(base, d)).isDirectory())
    .sort();
}

/**
 * 픽스처 하나의 오버레이 계획.
 * @returns {{name, dir, overlayDir, files, branch, manifest, prTaskInOverlay, prTaskField}}
 */
function planFixture(root, name) {
  const dir = path.join(root, FIXTURE_ROOT, name);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    return { name, dir: null, overlayDir: null, files: [], branch: null, manifest: null };
  }
  const manifestPath = path.join(dir, FIXTURE_MANIFEST_NAME);
  let manifest = null;
  if (existsSync(manifestPath)) manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

  // `overlay` 필드가 정본. 없으면 관례 `overlay/`, 그것도 없으면 디렉터리 전체(fixture.json 제외).
  const declared = manifest?.overlay ? String(manifest.overlay).replace(/\/$/, '') : null;
  let overlayDir;
  let legacyFlat = false;
  if (declared && existsSync(path.join(dir, declared))) overlayDir = path.join(dir, declared);
  else if (existsSync(path.join(dir, 'overlay'))) overlayDir = path.join(dir, 'overlay');
  else {
    overlayDir = dir;
    legacyFlat = true;
  }

  let files = walk(overlayDir);
  if (legacyFlat) files = files.filter((f) => f !== FIXTURE_MANIFEST_NAME);

  return {
    name,
    dir,
    overlayDir,
    files,
    branch: manifest?.branch ?? conventionalFixtureBranch(name),
    manifest,
    prTaskInOverlay: files.includes(PR_TASK),
    prTaskField: manifest?.pr_task ?? null,
  };
}

/* ── 실행 ────────────────────────────────────────────────────────────────── */

const report = new Report(`fixtures-run (REQ-5 오버레이 드라이버, ${dryRun ? 'DRY-RUN' : 'PUSH'})`);
const root = repoRoot();

const required = FIXTURES.map((f) => f.job);
const labelOf = new Map(FIXTURES.map((f) => [f.job, f.label]));
const discovered = discoverFixtureDirs(root);
const extra = discovered.filter((d) => !required.includes(d));

let names = [...required, ...extra];
if (opts.job) {
  if (!names.includes(opts.job)) {
    report.fail(RULE, `--job ${opts.job} 에 해당하는 픽스처가 없다 (유효: ${fmtSet(names)})`);
    process.exit(report.print());
  }
  names = [opts.job];
}

const headSha = exec('git', ['rev-parse', 'HEAD'], { cwd: root });
if (!headSha.ok) {
  report.fail(RULE, 'HEAD 를 해석할 수 없다 — 픽스처 브랜치의 base 를 확정할 수 없다', headSha.stderr);
  process.exit(report.print());
}
const base = headSha.stdout.trim();
report.info(
  RULE,
  `base=현재 PR HEAD ${base.slice(0, 8)} · 워크플로 blob sha=${blobSha(root, CI_WORKFLOW) ?? '<계산 불가>'} · ` +
    `REQ-5 필수 ${required.length}종 + 추가 ${extra.length}종 ${fmtSet(extra)}`,
);

const plans = [];
await guard(report, RULE, '픽스처 트리 수집', async () => {
  for (const name of names) {
    const plan = planFixture(root, name);
    const isRequired = required.includes(name);
    const label = labelOf.get(name) ?? '(REQ-3 등 추가 픽스처)';
    plans.push({ name, plan, isRequired, label });

    if (!plan.dir) {
      // REQ-5 필수 8종의 부재는 실패. 추가 픽스처는 --job 으로 지목했을 때만 도달한다.
      report.fail(RULE, `픽스처 트리 ${FIXTURE_ROOT}/${name}/ 가 없다 — ${label}. 트리 없이 드라이버를 성공으로 끝내지 않는다`);
      continue;
    }
    if (plan.files.length === 0) {
      report.fail(
        RULE,
        `픽스처 ${name} 의 오버레이 파일이 0건이다 (${path.relative(root, plan.overlayDir)}) — 위반을 담지 않은 트리는 탐지력을 입증하지 못한다`,
      );
      continue;
    }
    report.pass(
      RULE,
      `${name}${isRequired ? '' : ' (추가)'}: 오버레이 ${plan.files.length}개 파일 → ${plan.branch}` +
        (plan.prTaskInOverlay ? ` · ${PR_TASK} 오버레이 포함` : ''),
      plan.files.map((f) => `  ${f}`).join('\n'),
    );
  }

  const withoutPrTask = plans
    .filter((p) => p.plan.dir && !p.plan.prTaskInOverlay && !p.plan.prTaskField)
    .map((p) => p.name);
  if (withoutPrTask.length > 0) {
    report.info(
      RULE,
      `오버레이에 ${PR_TASK} 가 없는 픽스처: ${fmtSet(withoutPrTask)} — F1 touches 안의 경로만 건드린다면 정상이다. ` +
        `touches 밖 경로를 건드리는 픽스처는 pr-task 를 함께 오버레이하지 않으면 같은 런에서 path-guard 도 red 가 되어 "나머지 7 green" 이 깨진다`,
    );
  }
});

if (report.failed) {
  report.fail(RULE, '픽스처 트리 준비가 끝나지 않아 브랜치를 만들지 않는다');
  process.exit(report.print());
}

/* ── 오버레이 & push ─────────────────────────────────────────────────────── */

function overlayCommands(plan) {
  const rel = path.relative(root, plan.overlayDir);
  return [
    `git checkout -B ${plan.branch} ${base}`,
    ...plan.files.map((f) => `mkdir -p "$(dirname ${f})" && cp ${rel}/${f} ${f}`),
    ...(plan.prTaskField && !plan.prTaskInOverlay
      ? [`printf '%s\\n' '${plan.prTaskField}' > ${PR_TASK}`]
      : []),
    `git add -A`,
    `git commit -m "ci-fixture(${plan.name}): REQ-5 위반 픽스처 오버레이"`,
    `git push --force-with-lease ${opts.remote} ${plan.branch}`,
  ];
}

await guard(report, RULE, '오버레이', async () => {
  if (dryRun) {
    for (const { name, plan, label } of plans) {
      report.info(
        RULE,
        `DRY-RUN ${name} → ${plan.branch} (${label})`,
        overlayCommands(plan).map((c) => `  $ ${c}`).join('\n'),
      );
    }
    return;
  }

  // 시작 브랜치를 **루프 밖에서 한 번** 잡고 finally 로 반드시 복귀한다.
  // 루프 안에서 잡으면, 중간 실패로 조기 return 할 때 리포가 `ci-fixture/**` 에 남는다.
  // 그 상태는 이후 로컬 실행·수동 작업의 기준 브랜치를 통째로 바꿔놓는다 (실제로 한 번 발생했다).
  const startBranch = exec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root });
  if (!startBranch.ok || !startBranch.stdout.trim() || startBranch.stdout.trim() === 'HEAD') {
    report.fail(RULE, '현재 브랜치를 확인할 수 없어 오버레이를 시작하지 않는다', startBranch.stderr);
    return;
  }
  const origin = startBranch.stdout.trim();
  if (origin.startsWith('ci-fixture/')) {
    report.fail(
      RULE,
      `현재 브랜치가 이미 픽스처 브랜치다 (${origin}) — 이전 실행이 중단된 상태일 수 있다. ` +
        `PR 브랜치로 복귀한 뒤 다시 실행하라 (\`git checkout <PR 브랜치>\`)`,
    );
    return;
  }
  const dirty = exec('git', ['status', '--porcelain'], { cwd: root });
  if (!dirty.ok || dirty.stdout.trim() !== '') {
    report.fail(
      RULE,
      '워킹트리가 깨끗하지 않아 오버레이를 시작하지 않는다 — 커밋되지 않은 변경이 픽스처 브랜치에 섞이면 귀속 검증이 깨진다',
      dirty.stdout,
    );
    return;
  }
  report.info(RULE, `시작 브랜치=${origin} — 성공/실패와 무관하게 종료 시 이 브랜치로 복귀한다`);

  try {
    await overlayAll(report, root, plans, base, origin);
  } finally {
    const back = exec('git', ['checkout', origin], { cwd: root });
    if (!back.ok) {
      report.fail(
        RULE,
        `원래 브랜치(${origin})로 복귀 실패 — 리포가 픽스처 브랜치에 남아 있다. 수동 복구 필요`,
        back.stderr,
      );
    } else {
      report.pass(RULE, `원래 브랜치(${origin})로 복귀 완료`);
    }
  }
});

async function overlayAll(report, root, plans, base, origin) {
  for (const { name, plan } of plans) {
    const co = exec('git', ['checkout', '-B', plan.branch, base], { cwd: root });
    if (!co.ok) {
      report.fail(RULE, `${name}: 브랜치 ${plan.branch} 생성 실패`, co.stderr);
      return;
    }
    for (const f of plan.files) {
      const dst = path.join(root, f);
      mkdirSync(path.dirname(dst), { recursive: true });
      writeFileSync(dst, readFileSync(path.join(plan.overlayDir, f)));
    }
    if (plan.prTaskField && !plan.prTaskInOverlay) {
      writeFileSync(path.join(root, PR_TASK), `${plan.prTaskField}\n`);
    }

    const add = exec('git', ['add', '-A'], { cwd: root });
    if (!add.ok) {
      report.fail(RULE, `${name}: git add 실패`, add.stderr);
      return;
    }
    const commit = exec(
      'git',
      ['commit', '-m', `ci-fixture(${name}): REQ-5 위반 픽스처 오버레이`],
      { cwd: root },
    );
    if (!commit.ok) {
      report.fail(
        RULE,
        `${name}: git commit 실패 (오버레이가 아무 변경도 만들지 않았을 수 있다 — 그러면 위반이 주입되지 않아 job 이 red 가 되지 않는다)`,
        commit.stderr || commit.stdout,
      );
      return;
    }
    const push = exec('git', ['push', '--force-with-lease', opts.remote, plan.branch], { cwd: root });
    if (!push.ok) {
      report.fail(RULE, `${name}: ${plan.branch} push 실패`, push.stderr);
      return;
    }
    report.pass(RULE, `${name}: ${plan.branch} push 완료 (${plan.files.length}개 파일 오버레이)`);

    // 다음 픽스처는 origin 기준으로 다시 오버레이해야 하므로 매번 복귀한다.
    // (최종 복귀는 호출부의 finally 가 보장한다.)
    const back = exec('git', ['checkout', origin], { cwd: root });
    if (!back.ok) {
      report.fail(RULE, `${name}: 원래 브랜치(${origin})로 복귀 실패`, back.stderr);
      return;
    }
  }
}

/* ── 런 URL 수집 ─────────────────────────────────────────────────────────── */

if (opts.collect) {
  await guard(report, RULE, '런 수집', async () => {
    const gh = createGitHub();
    if (!gh.available) {
      report.fail(RULE, '--collect 인데 GitHub API 를 쓸 수 없다', gh.reason);
      return;
    }
    const localSha = blobSha(root, CI_WORKFLOW);
    for (const { name, plan } of plans) {
      const runs = await gh.client.workflowRunsForBranch(plan.branch);
      const sorted = runs
        .filter((r) => !r.path || r.path === CI_WORKFLOW)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      if (sorted.length === 0) {
        report.fail(RULE, `${name}: ${plan.branch} 에 런이 0건이다`);
        continue;
      }
      const latest = sorted[0];
      const content = await gh.client.contentSha(CI_WORKFLOW, latest.head_sha);
      const fresh = Boolean(content) && content.sha === localSha;
      report.info(
        RULE,
        `${name}: run #${latest.id} status=${latest.status} conclusion=${latest.conclusion} 신선도=${fresh ? 'OK' : 'MISMATCH'}`,
        [
          `  ${latest.html_url}`,
          `  fixture.json 에 기록할 값: "run_id": ${latest.id}`,
        ].join('\n'),
      );
      if (!fresh) {
        report.fail(
          RULE,
          `${name}: 최신 런의 워크플로 blob sha 가 현재 PR 과 다르다 — index.mjs 의 신선도 검사에서 무효 처리된다`,
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
