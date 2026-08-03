// tools/ci-meta/checks/forbid5-budget.mjs
//
// FORBID-5 — `.github/ci-budget.json` 의 **기존 항목 상향**은 `.github` CODEOWNERS 승인 리뷰
//            (승인자 ≠ PR 작성자) 없이는 exit 1.
//
//  · 신규 job 항목 추가는 해당 없음 (하류 계약은 자기 job 항목만 추가한다)
//  · base 에 파일이 없는 **최초 도입 커밋은 검사 대상 제외** (F1 자기 PR 이 여기 해당한다)
//  · job당 상한 8분 초과 값 도입은 언제나 실패 (승인으로도 열리지 않는다)

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { showBlob, changedFiles } from '../lib/git.mjs';
import {
  detectMaintainerMode,
  checkIndependentPr,
  SINGLE_MAINTAINER_TOKEN,
} from '../lib/maintainer.mjs';
import { fmtSet } from '../lib/util.mjs';
import {
  parseCodeowners,
  approvingReviewers,
  hasCodeownerApproval,
} from '../lib/codeowners.mjs';
import { currentPullAuthor, currentPullNumber } from '../lib/github.mjs';

const RULE = 'FORBID-5';
const BUDGET_PATH = '.github/ci-budget.json';
const MAX_TIMEOUT_MINUTES = 8;

function parseBudgetText(text) {
  if (text == null) return null;
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  const src =
    raw && typeof raw === 'object' && !Array.isArray(raw)
      ? raw.jobs && typeof raw.jobs === 'object'
        ? raw.jobs
        : raw
      : null;
  if (!src) return null;
  const m = new Map();
  for (const [k, v] of Object.entries(src)) if (typeof v === 'number') m.set(k, v);
  return m;
}

/**
 * 기존 항목 상향 목록. 신규 항목 추가·항목 제거는 상향이 아니다.
 * @param {Map<string,number>} baseBudget
 * @param {Map<string,number>} head
 */
export function computeRaised(baseBudget, head) {
  const raised = [];
  for (const [job, baseVal] of baseBudget) {
    if (!head.has(job)) continue; // 항목 제거는 상향이 아니다 (REQ-6 의 job/예산 대응 검사가 잡는다)
    const headVal = head.get(job);
    if (headVal > baseVal) raised.push({ job, from: baseVal, to: headVal });
  }
  return raised;
}

export async function checkForbid5(report, ctx) {
  const { root, base, gh } = ctx;

  const abs = path.join(root, BUDGET_PATH);
  if (!existsSync(abs)) {
    report.fail(RULE, `${BUDGET_PATH} 가 없다 — 예산 정본 부재는 REQ-6/FORBID-5 판정 불가다`);
    return;
  }
  const head = parseBudgetText(readFileSync(abs, 'utf8'));
  if (head == null) {
    report.fail(RULE, `${BUDGET_PATH} 를 파싱할 수 없다`);
    return;
  }

  if (!base.ok) {
    report.skip(RULE, 'ci-budget.json 상향 diff 검사 미수행', base.reason);
    return;
  }

  const baseText = showBlob(root, base.mergeBase, BUDGET_PATH);
  if (baseText == null) {
    report.pass(
      RULE,
      `base(${base.ref})에 ${BUDGET_PATH} 가 없다 — 최초 도입 커밋이므로 상향 판정 대상 제외 (계약 명시)`,
    );
  }

  // 상한 8분 초과는 최초 도입이든 아니든 항상 위반이다.
  const over = [...head.entries()].filter(([, v]) => v > MAX_TIMEOUT_MINUTES);
  if (over.length > 0) {
    report.fail(
      RULE,
      `${BUDGET_PATH} 에 job당 상한 ${MAX_TIMEOUT_MINUTES}분을 초과하는 항목이 있다: ${over.map(([k, v]) => `${k}=${v}`).join(', ')}`,
    );
  } else {
    report.pass(RULE, `${BUDGET_PATH} 전 항목 ≤ ${MAX_TIMEOUT_MINUTES}분 (${head.size}건)`);
  }

  if (baseText == null) return;

  const baseBudget = parseBudgetText(baseText);
  if (baseBudget == null) {
    report.fail(RULE, `base(${base.ref})의 ${BUDGET_PATH} 를 파싱할 수 없어 상향 여부를 판정할 수 없다`);
    return;
  }

  const raised = computeRaised(baseBudget, head);
  const added = [...head.keys()].filter((k) => !baseBudget.has(k));
  if (added.length > 0) {
    report.info(RULE, `신규 job 예산 항목 ${fmtSet(added)} — 계약상 상향에 해당하지 않음`);
  }

  if (raised.length === 0) {
    report.pass(RULE, `${BUDGET_PATH} 기존 항목 상향 0건 (base ${baseBudget.size}건 대조)`);
    return;
  }

  const detail = raised.map((r) => `${r.job}: ${r.from} → ${r.to}`).join('\n');

  // single_maintainer 상태에서는 승인 리뷰 대신 REQ-7 (c-3) 독립 PR 요구가 적용된다(계약 detect 개정본).
  const maint = await detectMaintainerMode(gh);
  if (maint.mode === 'single') {
    report.info(
      RULE,
      `${SINGLE_MAINTAINER_TOKEN} — push 권한 collaborator ${maint.logins.length}명(${fmtSet(maint.logins)}). ` +
        `${BUDGET_PATH} 상향에 승인 리뷰 대신 REQ-7 (c-3) 독립 PR 요구를 적용한다`,
    );
    let changed;
    try {
      changed = changedFiles(root, base.mergeBase);
    } catch (err) {
      report.fail(RULE, '변경 파일 목록을 산출할 수 없어 독립 PR 요구를 판정할 수 없다', err.message);
      return;
    }
    const res = checkIndependentPr(changed, BUDGET_PATH);
    if (res.ok) {
      report.pass(
        RULE,
        `${SINGLE_MAINTAINER_TOKEN} ${BUDGET_PATH} 기존 항목 ${raised.length}건 상향이 독립 PR 이다` +
          (res.note ? ` — ${res.note}` : ''),
        detail,
      );
    } else {
      report.fail(
        RULE,
        `${SINGLE_MAINTAINER_TOKEN} ${BUDGET_PATH} 기존 항목 ${raised.length}건 상향이 독립 PR 이 아니다 — 함께 변경된 파일 ${res.others.length}건`,
        `${detail}\n--- 함께 변경된 파일 ---\n${res.others.slice(0, 20).join('\n')}`,
      );
    }
    return;
  }
  if (maint.mode === 'unknown') {
    report.skip(
      RULE,
      `${BUDGET_PATH} 상향 ${raised.length}건 — 유지보수 체제 미확정으로 승인/독립PR 중 어느 규약을 적용할지 판정 불가`,
      `${maint.reason ?? ''}\n${detail}`,
    );
    return;
  }

  if (!gh.available) {
    report.skip(
      RULE,
      `기존 항목 상향 ${raised.length}건의 \`.github\` CODEOWNERS 승인 리뷰 미검증`,
      `${gh.reason}\n${detail}`,
    );
    return;
  }

  const { exists, rules } = parseCodeowners(root);
  if (!exists) {
    report.fail(RULE, `${BUDGET_PATH} 상향이 있으나 .github/CODEOWNERS 가 없어 승인 요건을 판정할 수 없다`, detail);
    return;
  }
  const author = currentPullAuthor();
  const pr = currentPullNumber();
  const rev = await approvingReviewers(gh.client, pr, author);
  if (!rev.ok) {
    report.fail(RULE, `${BUDGET_PATH} 상향의 승인 리뷰를 조회할 수 없다 — 미판정을 허용으로 처리하지 않는다`, `${rev.reason}\n${detail}`);
    return;
  }
  const res = await hasCodeownerApproval(gh.client, rules, BUDGET_PATH, rev.approvers);
  if (res.unresolved.length > 0) {
    report.fail(RULE, `${BUDGET_PATH} 소유자 팀 멤버십 확인 실패 — 미판정을 허용으로 처리하지 않는다`, `${res.unresolved.join('\n')}\n${detail}`);
    return;
  }
  if (!res.approved) {
    report.fail(
      RULE,
      `${BUDGET_PATH} 기존 항목 ${raised.length}건 상향에 \`.github\` CODEOWNERS 승인 리뷰(승인자 ≠ 작성자)가 없다 — 소유자 ${fmtSet(res.owners)} / 승인자 ${fmtSet(rev.approvers)}`,
      detail,
    );
  } else {
    report.pass(RULE, `${BUDGET_PATH} 상향 ${raised.length}건 — 소유자 승인 확인 ${fmtSet(res.matched)}`, detail);
  }
}
