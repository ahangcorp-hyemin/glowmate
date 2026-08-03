// tools/ci-meta/checks/req5-fixtures.mjs
//
// REQ-5 — 8개 job 존재(집합 포함) · 픽스처 8종 실제 Actions 런의 신선도 · 귀속 검증
// REQ-6 (c) 런타임 — 픽스처 8종 각 런에서 `ci-required` conclusion ≠ success / skipped
//
// 정적 부분(job 이름 집합, 픽스처 트리 존재)은 로컬에서도 판정한다.
// 런 조회 부분은 GitHub API 가 필요하며, CI 에서 조회 불가면 exit 1 이다(판정 불가 ≠ 통과).

import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { Workflow, CI_WORKFLOW } from '../lib/workflow.mjs';
import { blobSha } from '../lib/git.mjs';
import { fmtSet } from '../lib/util.mjs';
import {
  FIXTURES,
  REQUIRED_JOBS,
  AGGREGATOR_JOB,
  FIXTURE_MANIFEST_NAME,
  conventionalFixtureBranch,
  isSetupStep,
  failureRegion,
  isFixtureBranch,
} from '../fixture-rules.mjs';
import { currentBranch } from '../lib/git.mjs';

const RULE = 'REQ-5';
const RULE6 = 'REQ-6';
const FIXTURE_ROOT = '.github/ci-fixtures';

/** REQ-5 (1) — 8개 job 이름 집합 포함 검사. 개수 동등 비교를 쓰지 않는다. */
export function checkJobNames(report, root) {
  const wf = new Workflow(root, CI_WORKFLOW);
  const defined = new Set(wf.jobNames);
  const missing = REQUIRED_JOBS.filter((j) => !defined.has(j));
  if (missing.length > 0) {
    report.fail(
      RULE,
      `(1) ${CI_WORKFLOW} 에 필수 job 이 없다: ${fmtSet(missing)} — 정의된 job: ${fmtSet(defined)}`,
    );
  } else {
    report.pass(
      RULE,
      `(1) 필수 8 job 전부 정의됨 (집합 포함 검사; 정의된 job ${defined.size}개, 상한 없음)`,
    );
  }
  if (!defined.has(AGGREGATOR_JOB)) {
    report.fail(RULE, `(1) 애그리게이터 job \`${AGGREGATOR_JOB}\` 이 ${CI_WORKFLOW} 에 없다`);
  }
  return wf;
}

/** 픽스처 트리 존재 + 매니페스트 읽기 (정적) */
export function readFixtureManifests(report, root) {
  const out = new Map();
  for (const fx of FIXTURES) {
    const dir = path.join(root, FIXTURE_ROOT, fx.job);
    if (!existsSync(dir) || !statSync(dir).isDirectory()) {
      report.fail(
        RULE,
        `(2) 픽스처 트리 ${FIXTURE_ROOT}/${fx.job}/ 가 없다 — ${fx.label}`,
      );
      out.set(fx.job, null);
      continue;
    }
    const manifestPath = path.join(dir, FIXTURE_MANIFEST_NAME);
    let manifest = null;
    if (existsSync(manifestPath)) {
      try {
        manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      } catch (err) {
        report.fail(
          RULE,
          `(2) ${FIXTURE_ROOT}/${fx.job}/${FIXTURE_MANIFEST_NAME} JSON 파싱 실패: ${err.message}`,
        );
      }
    }
    out.set(fx.job, manifest);
    report.pass(RULE, `(2) 픽스처 트리 존재: ${FIXTURE_ROOT}/${fx.job}/ (${fx.label})`);
  }
  return out;
}

/** 신선도 — 런의 head_sha 시점 ci.yml blob sha 가 현재 PR 의 것과 동일한가. */
async function isFresh(client, run, localSha) {
  const content = await client.contentSha(CI_WORKFLOW, run.head_sha);
  if (!content) return { fresh: false, reason: `런 head_sha=${run.head_sha} 에 ${CI_WORKFLOW} 가 없다` };
  if (content.sha !== localSha) {
    return {
      fresh: false,
      reason: `워크플로 blob sha 불일치 (런=${content.sha} / 현재 PR=${localSha}) — 과거 런 재사용 금지`,
    };
  }
  return { fresh: true, reason: null };
}

export async function checkReq5Runs(report, ctx, manifests, wf) {
  const { root, gh } = ctx;

  // 픽스처 브랜치 면제 — REQ-5 (2)(3) 은 **PR 의 메타 검증**이지 픽스처 자신의 검증이 아니다.
  // 픽스처 브랜치에서 다시 픽스처 런을 조회하면 자기 자신을 검증하는 순환이 되고,
  // 그 시점에 다른 픽스처 런은 아직 존재하지도 않는다.
  // ⚠ PR 브랜치에서는 아래 판정이 그대로 엄격하게 돈다. 이 면제는 `ci-fixture/` 접두사에만 걸린다.
  const branchInfo = currentBranch(root);
  if (isFixtureBranch(branchInfo.branch)) {
    const why =
      'REQ-5 (2)(3) 은 PR 의 메타 검증이므로 픽스처 브랜치에서는 검사 대상이 아니다 ' +
      '(자기 자신을 검증하는 순환 + 다른 픽스처 런 부재). PR 브랜치에서는 엄격하게 판정한다';
    report.exempt(RULE, '(2)(3) 픽스처 8종의 실제 Actions 런 신선도·귀속 검증', {
      allowed: true,
      branch: branchInfo.branch,
      why: `${why} · 판정 원천: ${branchInfo.source}`,
    });
    report.exempt(RULE6, `(c) 런타임 — 픽스처 8종 각 런의 \`${AGGREGATOR_JOB}\` conclusion 검증`, {
      allowed: true,
      branch: branchInfo.branch,
      why: `${why} · 판정 원천: ${branchInfo.source}`,
    });
    return;
  }
  report.info(
    RULE,
    `(2)(3) 판정 컨텍스트: 브랜치 ${branchInfo.branch ?? '<불명>'} (${branchInfo.source}) — 픽스처 브랜치가 아니므로 엄격 판정한다`,
  );

  if (!gh.available) {
    report.skip(
      RULE,
      `(2)(3) 픽스처 8종의 실제 Actions 런 신선도·귀속 검증 미수행`,
      gh.reason,
    );
    report.skip(
      RULE6,
      `(c) 런타임 — 픽스처 8종 각 런의 \`${AGGREGATOR_JOB}\` conclusion ≠ success/skipped 미검증`,
      gh.reason,
    );
    return;
  }

  const localSha = blobSha(root, CI_WORKFLOW);
  if (!localSha) {
    report.fail(RULE, `(2) ${CI_WORKFLOW} 의 blob sha 를 계산할 수 없어 신선도 판정 불가`);
    return;
  }

  const allJobNames = wf.jobNames.filter((n) => n !== AGGREGATOR_JOB);

  for (const fx of FIXTURES) {
    const manifest = manifests.get(fx.job);
    const label = `${fx.label} → job \`${fx.job}\``;

    let run = null;
    let resolution = '';
    try {
      if (manifest?.run_id) {
        run = await gh.client.run(manifest.run_id);
        resolution = `fixture.json run_id=${manifest.run_id}`;
        const f = await isFresh(gh.client, run, localSha);
        if (!f.fresh) {
          report.fail(RULE, `(2) ${label} 지정 런이 신선하지 않다 — ${f.reason}`);
          continue;
        }
      } else {
        const branch = manifest?.branch ?? conventionalFixtureBranch(fx.job);
        resolution = `branch=${branch}`;
        const runs = await gh.client.workflowRunsForBranch(branch);
        const sorted = runs
          .filter((r) => !r.path || r.path === CI_WORKFLOW)
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const reasons = [];
        for (const cand of sorted) {
          const f = await isFresh(gh.client, cand, localSha);
          if (f.fresh) {
            run = cand;
            break;
          }
          reasons.push(`run#${cand.id}: ${f.reason}`);
        }
        if (!run) {
          report.fail(
            RULE,
            `(2) ${label} — ${branch} 에서 현재 PR 의 워크플로 정의로 재실행된 런을 찾지 못했다 (신선도 미충족 · 과거 red 런 재사용 금지)`,
            reasons.slice(0, 5).join('\n') || `${branch} 에 런이 0건이다`,
          );
          continue;
        }
      }
    } catch (err) {
      report.fail(RULE, `(2) ${label} 런 조회 실패 (${resolution}) — 판정 불가는 통과가 아니다`, err.message);
      continue;
    }

    if (run.status !== 'completed') {
      report.fail(
        RULE,
        `(3) ${label} 런 #${run.id} 이 아직 완료되지 않았다 (status=${run.status}) — 미완 런을 통과로 처리하지 않는다`,
      );
      continue;
    }

    let jobs;
    try {
      jobs = await gh.client.runJobs(run.id);
    } catch (err) {
      report.fail(RULE, `(3) ${label} 런 #${run.id} 의 job 목록 조회 실패`, err.message);
      continue;
    }
    const byName = new Map(jobs.map((j) => [j.name, j]));

    // 대응 job 만 red
    const target = byName.get(fx.job);
    if (!target) {
      report.fail(
        RULE,
        `(3) ${label} 런 #${run.id} 에 job \`${fx.job}\` 이 없다 — 실행된 job: ${fmtSet(byName.keys())}`,
      );
      continue;
    }
    if (target.conclusion !== 'failure') {
      report.fail(
        RULE,
        `(3) ${label} 런 #${run.id} 에서 대응 job 이 red 가 아니다 (conclusion=${target.conclusion}) — ${run.html_url}`,
      );
    } else {
      report.pass(RULE, `(3) ${label} 런 #${run.id} 대응 job red 확인 — ${run.html_url}`);
    }

    // 나머지 검사 job 은 green
    const others = allJobNames.filter((n) => n !== fx.job);
    const notGreen = [];
    for (const n of others) {
      const j = byName.get(n);
      if (!j) notGreen.push(`${n}=<런에 없음>`);
      else if (j.conclusion !== 'success') notGreen.push(`${n}=${j.conclusion}`);
    }
    if (notGreen.length > 0) {
      report.fail(
        RULE,
        `(3) ${label} 런 #${run.id} 에서 나머지 검사 job 이 green 이 아니다: ${notGreen.join(', ')} — 결합 실패(예: install 실패)면 귀속 검증이 성립하지 않는다`,
      );
    } else {
      report.pass(RULE, `(3) ${label} 런 #${run.id} 나머지 ${others.length}개 job green 확인`);
    }

    // 귀속 — 실패 **스텝**이 검사 스텝이어야 하고, 실패 지점 로그가 규칙 ID 와 매칭돼야 한다.
    const expected = Array.isArray(manifest?.expect) && manifest.expect.length > 0 ? manifest.expect : fx.expect;
    if (target.conclusion === 'failure') {
      // (i) 실패 스텝 판정 — 셋업/설치에서 난 red 는 결합 실패이지 규칙 탐지가 아니다.
      const failedSteps = (target.steps ?? []).filter((s) => s.conclusion === 'failure');
      if (failedSteps.length === 0) {
        report.fail(
          RULE,
          `(3) ${label} 런 #${run.id} 은 red 인데 실패한 스텝을 특정할 수 없다 — 귀속 판정 불가`,
        );
      } else {
        const setupFailures = failedSteps.filter((s) => isSetupStep(s.name));
        if (setupFailures.length > 0) {
          report.fail(
            RULE,
            `(3) ${label} 런 #${run.id} 이 셋업/설치 스텝에서 red 다: ${fmtSet(setupFailures.map((s) => s.name))} — ` +
              `결합 실패(lockfile 불일치 등)는 규칙 탐지가 아니다 (REQ-5 말미: 각 트리는 lockfile 정합을 유지해야 한다)`,
          );
        } else {
          report.pass(
            RULE,
            `(3) ${label} 실패 스텝이 검사 스텝이다: ${fmtSet(failedSteps.map((s) => s.name))}`,
          );
        }
      }

      // (ii) 실패 지점 로그가 규칙 ID 와 매칭
      let log;
      try {
        log = await gh.client.jobLog(target.id);
      } catch (err) {
        report.fail(
          RULE,
          `(3) ${label} 런 #${run.id} 의 실패 로그를 조회할 수 없어 귀속 검증 불가`,
          err.message,
        );
        log = null;
      }
      if (log != null) {
        // ci.yml 은 각 job 첫 스텝에서 규칙 ID 를 echo 한다. 로그 전체를 보면 green 런에서도
        // 항상 토큰이 존재해 귀속 검증이 공허해지므로, **실패 지점 구간**만 판정 대상으로 삼는다.
        const region = failureRegion(log);
        const hit = expected.find((tok) => region.text.includes(tok));
        if (!hit) {
          const inWholeLog = expected.find((tok) => log.includes(tok));
          report.fail(
            RULE,
            `(3) ${label} 런 #${run.id} 의 **실패 지점**에서 기대 규칙 ID 를 찾지 못했다 (기대 ${fmtSet(expected)}, 판정 구간=${region.mode}) — ` +
              (inWholeLog
                ? `토큰 \`${inWholeLog}\` 는 로그 어딘가(첫 스텝 echo 등)에 있으나 실패 지점에는 없다. 다른 이유로 red 인 픽스처는 탐지력을 입증하지 못한다`
                : `로그 어디에도 기대 토큰이 없다`),
          );
        } else {
          report.pass(
            RULE,
            `(3) ${label} 귀속 확인 — 실패 지점(${region.mode})에 \`${hit}\` 존재`,
          );
        }
      }
    }

    // REQ-6 (c) 런타임 — ci-required conclusion ≠ success / skipped
    const agg = byName.get(AGGREGATOR_JOB);
    if (!agg) {
      report.fail(
        RULE6,
        `(c) ${label} 런 #${run.id} 에 \`${AGGREGATOR_JOB}\` job 이 없다 — 실패 전파 집행 여부를 확인할 수 없다`,
      );
    } else if (agg.conclusion === 'success' || agg.conclusion === 'skipped') {
      report.fail(
        RULE6,
        `(c) ${label} 런 #${run.id} 에서 \`${AGGREGATOR_JOB}\` 이 ${agg.conclusion} 이다 — ` +
          `브랜치 보호는 skipped 필수 체크를 통과로 취급하므로, 이 상태면 전 job red 에서도 머지가 열린다 — ${run.html_url}`,
      );
    } else if (agg.conclusion == null) {
      report.fail(
        RULE6,
        `(c) ${label} 런 #${run.id} 의 \`${AGGREGATOR_JOB}\` conclusion 이 null 이다 (status=${agg.status}) — 미판정을 통과로 처리하지 않는다`,
      );
    } else {
      report.pass(
        RULE6,
        `(c) ${label} 런 #${run.id} \`${AGGREGATOR_JOB}\` conclusion=${agg.conclusion} (≠ success/skipped) — 실패 전파 집행 확인`,
      );
    }
  }
}
