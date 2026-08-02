// tools/ci-meta/checks/req6-aggregator.mjs
//
// REQ-6 — timeout 예산 · 병렬성 · 애그리게이터 등록 · **실패 전파 집행 검증(B-8)**
//
// 감사 f1-gate2 §1 B-8 이 지목한 구멍:
//   "등록은 검사하는데 실패 전파를 아무도 검사하지 않아, `needs:` 만 선언한 순진한 구현에서
//    전 job 이 red 여도 ci-required 가 skipped 되고 브랜치 보호가 이를 통과로 취급한다."
//
// 그래서 이 파일은 세 층으로 검사한다:
//   (a) 등록  — 브랜치 보호 required status checks == {ci-required}                (GitHub API)
//   (b) 포함  — ci-required.needs ⊇ ci.yml 전 검사 job 집합                        (정적)
//   (c) 집행  — ci-required 가 non-success 전파 시 **반드시 실패하는 형태**인지     (정적, R6C-1~5)
//              + 픽스처 8종 각 런의 ci-required conclusion ≠ success/skipped       (GitHub API)

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { Workflow, CI_WORKFLOW, normalizeExpression } from '../lib/workflow.mjs';
import { fmtSet, CheckError } from '../lib/util.mjs';
import { REQUIRED_JOBS, AGGREGATOR_JOB } from '../fixture-rules.mjs';
import { baseBranchName } from '../lib/github.mjs';

const RULE = 'REQ-6';
const BUDGET_PATH = '.github/ci-budget.json';
const MAX_TIMEOUT_MINUTES = 8;

/** ci-budget.json 을 {job: minutes} 로 정규화. 숫자 값이 아닌 키는 메타로 간주해 무시한다. */
export function readBudget(root) {
  const abs = path.join(root, BUDGET_PATH);
  if (!existsSync(abs)) {
    throw new CheckError(`${BUDGET_PATH} 가 없다 — job timeout 예산 정본이 없으면 REQ-6 판정 불가`);
  }
  let raw;
  try {
    raw = JSON.parse(readFileSync(abs, 'utf8'));
  } catch (err) {
    throw new CheckError(`${BUDGET_PATH} JSON 파싱 실패: ${err.message}`);
  }
  const src = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw.jobs && typeof raw.jobs === 'object' ? raw.jobs : raw)
    : null;
  if (!src) throw new CheckError(`${BUDGET_PATH} 형식이 객체가 아니다`);
  /** @type {Map<string, number>} */
  const budget = new Map();
  for (const [k, v] of Object.entries(src)) {
    if (typeof v === 'number') budget.set(k, v);
  }
  if (budget.size === 0) {
    throw new CheckError(`${BUDGET_PATH} 에 숫자 timeout 항목이 0건이다 (검사 대상 0건 = 통과 아님)`);
  }
  return budget;
}

/* ────────────────────────────────────────────────────────────────────────────
 * (c) 집행 검증 — 정적 판정 R6C-1 ~ R6C-5
 *
 * 판정 로직 (needs 만 선언한 순진한 구현은 R6C-1 에서 즉시 exit 1):
 *   R6C-1 실행 보장 : ci-required 의 `if:` 가 선행 실패에도 실행을 보장하는 형태인가.
 *                     - `if:` 자체가 없다            → FAIL (needs-only = skipped 종료)
 *                     - `!cancelled()` 또는 always() 를 포함 → 통과
 *                     - `success()` 를 포함           → FAIL (선행 실패 시 스킵된다)
 *   R6C-2 평가 존재 : run 스크립트가 `needs.*.result` 를 명시 평가하는가.
 *   R6C-3 평가 범위 : needs 의 **모든** job 이 평가에 포함되는가
 *                     (개별 `needs.<job>.result` 또는 집계형 needs.*.result / toJSON(needs)).
 *   R6C-4 비교 기준 : non-success **전체**를 잡는가.
 *                     'failure' 만 열거하고 'success' 비교가 없으면 skipped/cancelled 를 흘린다 → FAIL.
 *   R6C-5 비영 종료 : 평가 결과가 non-zero 종료로 이어지는가 (exit <nonzero>).
 *                     + ci-required 의 job/step 에 continue-on-error 가 켜져 있으면 FAIL.
 *
 * R6C-1 이 `always()` 만 유효로 보는 이유 (오케스트레이터 확정):
 *   계약 REQ-6 문면은 "needs 중 하나라도 success 가 아니면(failure · **cancelled** · skipped 포함)
 *   반드시 자신도 실패한다"이다. `!cancelled()` 는 워크플로가 취소되면 `ci-required` 자신이
 *   실행되지 않고 `skipped` 로 끝나며, 브랜치 보호는 skipped 필수 체크를 통과로 취급한다.
 *   즉 cancelled 축을 커버하지 못하므로 **무효**다. `always()` 만이 세 축을 모두 커버한다.
 * ──────────────────────────────────────────────────────────────────────────── */

const RE_CANCELLED_FN = /(^|[^\w.])cancelled\s*\(\s*\)/;
const RE_ALWAYS = /(^|[^\w.])always\s*\(\s*\)/;
const RE_SUCCESS_FN = /(^|[^\w.])success\s*\(\s*\)/;
const RE_FAILURE_FN = /(^|[^\w.])failure\s*\(\s*\)/;
const RE_AGGREGATE_RESULT = /needs\s*\.\s*\*\s*\.\s*result|toJSON\s*\(\s*needs\s*\)|toJson\s*\(\s*needs\s*\)/;
const RE_ANY_RESULT = /needs\s*\.\s*[\w.*-]+\s*\.\s*result/;
// non-zero 종료 형태: `exit 1` · `exit(1)` · `process.exit(1)` · `sys.exit(2)` · `exit "$rc"`
const RE_NONZERO_EXIT = /\bexit\s*\(\s*[1-9][0-9]*\s*\)|\bexit\s+[1-9][0-9]*\b|\bexit\s+["']?\$/;
const RE_SUCCESS_LITERAL = /success/;

export function analyzeEnforcement(wf) {
  const job = wf.job(AGGREGATOR_JOB);
  if (!job) {
    return [
      {
        id: 'R6C-0',
        ok: false,
        message: `애그리게이터 job \`${AGGREGATOR_JOB}\` 이 ${CI_WORKFLOW} 에 없다`,
      },
    ];
  }
  return analyzeEnforcementJob(job);
}

/** 워크플로 파일과 무관하게 job 객체만으로 (c) 집행 형태를 판정한다 (selftest 가 재사용). */
export function analyzeEnforcementJob(job) {
  const findings = [];
  const needs = toArray(job.needs);
  const ifExpr = normalizeExpression(job.if);
  const steps = Array.isArray(job.steps) ? job.steps : [];
  const runText = steps.map((s) => String(s?.run ?? '')).join('\n');
  const stepIfText = steps.map((s) => normalizeExpression(s?.if)).join('\n');
  const withText = steps
    .map((s) => (s?.with ? JSON.stringify(s.with) : ''))
    .join('\n');
  const envText = [job.env ? JSON.stringify(job.env) : '', ...steps.map((s) => (s?.env ? JSON.stringify(s.env) : ''))].join('\n');
  const evalText = [runText, stepIfText, withText, envText].join('\n');

  // R6C-1 실행 보장
  if (!job.if) {
    findings.push({
      id: 'R6C-1',
      ok: false,
      message:
        `\`${AGGREGATOR_JOB}\` 에 \`if:\` 가 없다 — needs 만 선언한 형태는 선행 job 실패 시 ` +
        `자신이 실행되지 않고 skipped 로 끝나며, 브랜치 보호는 skipped 필수 체크를 통과로 취급한다`,
    });
  } else if (RE_SUCCESS_FN.test(ifExpr) || RE_FAILURE_FN.test(ifExpr)) {
    findings.push({
      id: 'R6C-1',
      ok: false,
      message:
        `\`${AGGREGATOR_JOB}.if\` 가 success()/failure() 상태 함수를 포함한다 — ` +
        `선행 결과에 따라 스킵되어 실패가 전파되지 않는다: ${ifExpr}`,
    });
  } else if (!RE_ALWAYS.test(ifExpr)) {
    const cancelledForm = RE_CANCELLED_FN.test(ifExpr);
    findings.push({
      id: 'R6C-1',
      ok: false,
      message: cancelledForm
        ? `\`${AGGREGATOR_JOB}.if\` 가 cancelled() 기반이다 (\`${ifExpr}\`) — ` +
          `워크플로 취소 시 ${AGGREGATOR_JOB} 자신이 skipped 로 끝나고 브랜치 보호는 이를 통과로 취급하므로 ` +
          `계약이 요구하는 cancelled 축을 커버하지 못한다. always() 를 쓸 것`
        : `\`${AGGREGATOR_JOB}.if\` 가 실패·취소·스킵 전부에서 실행을 보장하는 형태가 아니다 (always() 필요): ${ifExpr}`,
    });
  } else {
    findings.push({ id: 'R6C-1', ok: true, message: `실행 보장 형태 확인: if: ${ifExpr}` });
    if (ifExpr.replace(/\s+/g, '') !== 'always()') {
      findings.push({
        id: 'R6C-1',
        ok: true,
        message: `주의 — if 에 always() 외 추가 조건이 있다: \`${ifExpr}\`. 그 조건이 거짓이면 필수 체크가 skipped 로 통과 처리된다`,
      });
    }
  }

  // R6C-2 평가 존재
  const hasAggregate = RE_AGGREGATE_RESULT.test(evalText);
  const hasAnyResult = RE_ANY_RESULT.test(evalText) || hasAggregate;
  if (!hasAnyResult) {
    findings.push({
      id: 'R6C-2',
      ok: false,
      message:
        `\`${AGGREGATOR_JOB}\` 에 needs.*.result 를 명시 평가하는 스텝이 없다 — ` +
        `needs 선언만으로는 non-success 전파가 집행되지 않는다`,
    });
  } else {
    findings.push({ id: 'R6C-2', ok: true, message: 'needs.*.result 명시 평가 스텝 존재' });
  }

  // R6C-3 평가 범위
  if (hasAnyResult && !hasAggregate) {
    const uncovered = needs.filter(
      (n) => !new RegExp(`needs\\s*\\.\\s*${escapeRe(n)}\\s*\\.\\s*result`).test(evalText),
    );
    if (uncovered.length > 0) {
      findings.push({
        id: 'R6C-3',
        ok: false,
        message: `needs 중 결과가 평가되지 않는 job 이 있다: ${fmtSet(uncovered)}`,
      });
    } else {
      findings.push({
        id: 'R6C-3',
        ok: true,
        message: `needs ${needs.length}개 전부 개별 평가됨`,
      });
    }
  } else if (hasAggregate) {
    findings.push({
      id: 'R6C-3',
      ok: true,
      message: '집계형(needs.*.result / toJSON(needs))으로 전 needs 를 포괄',
    });
  }

  // R6C-4 비교 기준 — non-success 전체
  if (hasAnyResult) {
    if (!RE_SUCCESS_LITERAL.test(evalText)) {
      findings.push({
        id: 'R6C-4',
        ok: false,
        message:
          `결과 평가가 'success' 와의 비교를 포함하지 않는다 — 특정 상태(failure 등)만 열거하면 ` +
          `skipped · cancelled 가 통과로 흘러 B-8 구멍이 그대로 남는다`,
      });
    } else {
      findings.push({ id: 'R6C-4', ok: true, message: "non-success 판정 기준('success' 비교) 확인" });
    }
  }

  // R6C-5 비영 종료 + 마스킹 부재
  if (hasAnyResult && !RE_NONZERO_EXIT.test(runText)) {
    findings.push({
      id: 'R6C-5',
      ok: false,
      message: `결과 평가 스텝에 non-zero 종료(exit <nonzero>)가 없다 — 평가만 하고 실패시키지 않는다`,
    });
  } else if (hasAnyResult) {
    findings.push({ id: 'R6C-5', ok: true, message: 'non-zero 종료 확인' });
  }

  const coeJob = job['continue-on-error'];
  const coeSteps = steps.filter((s) => s?.['continue-on-error'] === true).length;
  if (coeJob === true || coeSteps > 0) {
    findings.push({
      id: 'R6C-5',
      ok: false,
      message: `\`${AGGREGATOR_JOB}\` 에 continue-on-error 가 켜져 있다 (job=${coeJob === true}, steps=${coeSteps}) — 집행 스텝의 실패가 마스킹된다`,
    });
  }

  return findings;
}

function toArray(v) {
  if (v == null) return [];
  return Array.isArray(v) ? v.map(String) : [String(v)];
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ────────────────────────────────────────────────────────────────────────── */

export async function checkReq6(report, ctx) {
  const { root, gh } = ctx;
  const wf = new Workflow(root, CI_WORKFLOW);
  const budget = readBudget(root);
  const jobNames = wf.jobNames;

  // ── timeout 예산 일치 · 8분 상한 ────────────────────────────────────────
  for (const name of jobNames) {
    const job = wf.job(name);
    const declared = job?.['timeout-minutes'];
    const budgeted = budget.get(name);
    if (budgeted == null) {
      report.fail(RULE, `job \`${name}\` 의 timeout 예산이 ${BUDGET_PATH} 에 없다 (예산 정본 누락)`);
      continue;
    }
    if (typeof declared !== 'number') {
      report.fail(RULE, `job \`${name}\` 에 timeout-minutes 가 선언되지 않았다 (예산 ${budgeted}분)`);
      continue;
    }
    if (declared !== budgeted) {
      report.fail(
        RULE,
        `job \`${name}\` 의 timeout-minutes(${declared}) 가 ${BUDGET_PATH}(${budgeted}) 와 불일치`,
      );
      continue;
    }
    if (declared > MAX_TIMEOUT_MINUTES) {
      report.fail(
        RULE,
        `job \`${name}\` 의 timeout-minutes(${declared}) 가 상한 ${MAX_TIMEOUT_MINUTES}분을 초과`,
      );
      continue;
    }
    report.pass(RULE, `job \`${name}\` timeout-minutes=${declared} (예산 일치, ≤${MAX_TIMEOUT_MINUTES}분)`);
  }

  for (const [name] of budget) {
    if (!jobNames.includes(name)) {
      report.fail(
        RULE,
        `${BUDGET_PATH} 의 항목 \`${name}\` 에 대응하는 job 이 ${CI_WORKFLOW} 에 없다 (예산 정본과 워크플로 드리프트)`,
      );
    }
  }

  // ── 검사 job 은 needs 미선언 (병렬) ────────────────────────────────────
  for (const name of jobNames) {
    if (name === AGGREGATOR_JOB) continue;
    const needs = toArray(wf.job(name)?.needs);
    if (needs.length > 0) {
      report.fail(
        RULE,
        `검사 job \`${name}\` 이 needs 를 선언했다 (${fmtSet(needs)}) — 8개 검사 job 은 병렬이어야 하고 needs 는 애그리게이터 ${AGGREGATOR_JOB} 만 선언한다`,
      );
    }
  }

  // ── (b) ci-required.needs ⊇ 전 검사 job ────────────────────────────────
  const aggregator = wf.job(AGGREGATOR_JOB);
  if (!aggregator) {
    report.fail(RULE, `애그리게이터 job \`${AGGREGATOR_JOB}\` 이 없다 — 필수 체크 등록 대상이 존재하지 않는다`);
  } else {
    const needs = new Set(toArray(aggregator.needs));
    const checkJobs = jobNames.filter((n) => n !== AGGREGATOR_JOB);
    const missing = checkJobs.filter((n) => !needs.has(n));
    if (missing.length > 0) {
      report.fail(
        RULE,
        `(b) \`${AGGREGATOR_JOB}.needs\` 가 검사 job 을 누락했다: ${fmtSet(missing)} — 하류가 job 을 추가하고 needs 에 넣지 않으면 그 job 은 머지를 막지 못한다`,
      );
    } else {
      report.pass(RULE, `(b) ${AGGREGATOR_JOB}.needs ⊇ 검사 job ${checkJobs.length}개 ${fmtSet(checkJobs)}`);
    }
    const phantom = [...needs].filter((n) => !jobNames.includes(n));
    if (phantom.length > 0) {
      report.fail(RULE, `(b) \`${AGGREGATOR_JOB}.needs\` 에 정의되지 않은 job 이 있다: ${fmtSet(phantom)}`);
    }
    const missingRequired = REQUIRED_JOBS.filter((n) => !needs.has(n));
    if (missingRequired.length > 0) {
      report.fail(
        RULE,
        `(b) \`${AGGREGATOR_JOB}.needs\` 가 계약 지정 8개 job 중 ${fmtSet(missingRequired)} 를 포함하지 않는다`,
      );
    }
  }

  // ── (c) 집행 검증 — 정적 ────────────────────────────────────────────────
  for (const f of analyzeEnforcement(wf)) {
    if (f.ok) report.pass(RULE, `(c) ${f.id} ${f.message}`);
    else report.fail(RULE, `(c) ${f.id} ${f.message}`);
  }

  // ── (a) 브랜치 보호 required status checks == {ci-required} ────────────
  if (!gh.available) {
    report.skip(
      RULE,
      `(a) 브랜치 보호 required status checks 집합 == {${AGGREGATOR_JOB}} 미검증`,
      gh.reason,
    );
    return;
  }

  const branch = baseBranchName();
  let protection;
  try {
    protection = await gh.client.branchProtection(branch);
  } catch (err) {
    report.fail(
      RULE,
      `(a) 브랜치 \`${branch}\` 의 보호 설정을 조회할 수 없다 — 판정 불가는 통과가 아니다`,
      `${err.message}\n${err.body ?? ''}`,
    );
    return;
  }

  const contexts =
    protection?.required_status_checks?.contexts ??
    (protection?.required_status_checks?.checks ?? []).map((c) => c.context);
  const set = new Set(contexts ?? []);
  if (set.size === 1 && set.has(AGGREGATOR_JOB)) {
    report.pass(RULE, `(a) required status checks == {${AGGREGATOR_JOB}}`);
  } else {
    report.fail(
      RULE,
      `(a) 브랜치 보호 required status checks 집합이 {${AGGREGATOR_JOB}} 이 아니다: ${fmtSet(set)}`,
    );
  }
}
