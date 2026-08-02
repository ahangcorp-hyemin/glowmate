// tools/ci-meta/checks/req7-codeowners.mjs
//
// REQ-7 — CODEOWNERS 7경로 등록 · Code Owner 리뷰 필수화 · 소유자 ∩ 구현 에이전트 계정 == ∅
//
// ⚠ "구현 에이전트 계정" 집합의 원천은 F1 계약에 미정의다 (감사 f1-gate2 §4-3).
//   여기서는 새 정본 파일을 만들지 않고 (그 경로는 이 컴포넌트 소유가 아니다)
//   **PR 작성자 ∪ 환경변수 `GLOWMATE_IMPLEMENTER_ACCOUNTS`(콤마 구분)** 의 합집합으로 판정한다.
//   이 결정은 완료 보고에 명시했다.

import {
  parseCodeowners,
  normalizePattern,
  normalizeOwner,
  CODEOWNERS_PATH,
} from '../lib/codeowners.mjs';
import { fmtSet } from '../lib/util.mjs';
import { changedFiles, showBlob } from '../lib/git.mjs';
import { baseBranchName, currentPullAuthor } from '../lib/github.mjs';
import {
  detectMaintainerMode,
  checkRelaxationWindow,
  checkIndependentPr,
  SINGLE_MAINTAINER_TOKEN,
} from '../lib/maintainer.mjs';

const RULE = 'REQ-7';

/**
 * (c-3) 승인 대체 대상 파일.
 *
 * `packages/config/dependency-classes.json` 은 계약이 "**승인 대상 diff 인 경우**"로 한정한다.
 * 그 판정(= `other` 신규 추가는 무승인 허용 / `data-access` 추가·분류 변경·data-access-names 매칭명의
 * `other` 위장은 승인 필요)은 REQ-3 소관이며 `tools/dep-graph/**` 에 있다. 여기서 임의로 재판정하면
 * 두 검사가 어긋나고, 무조건 독립 PR 을 요구하면 감사 B-3b′ 가 지적한 DS1·DS3 데드락이 되살아난다.
 * 따라서 이 파일은 **소관 표기와 함께 명시 출력만** 하고 판정은 dep-graph 에 남긴다.
 */
const C3_TARGETS = [
  { path: 'packages/config/db-driver-exceptions.json', owned: true },
  { path: '.github/ci-budget.json', owned: true },
  { path: 'packages/config/dependency-classes.json', owned: false, ownerNote: 'REQ-3 / tools/dep-graph 소관' },
];

/** 계약이 지정한 7경로 */
export const REQUIRED_OWNER_PATHS = [
  'packages/db',
  'packages/api',
  'packages/price-state',
  'packages/config',
  '.github/**',
  'docs/registry/**',
  'tools/**',
];

/** 구현 에이전트 계정 집합 = PR 작성자 ∪ GLOWMATE_IMPLEMENTER_ACCOUNTS */
export function implementerAccounts() {
  const set = new Set();
  const env = process.env.GLOWMATE_IMPLEMENTER_ACCOUNTS ?? '';
  for (const a of env.split(',')) {
    const t = a.trim();
    if (t) set.add(normalizeOwner(t));
  }
  const author = currentPullAuthor();
  const fromAuthor = author ? normalizeOwner(author) : null;
  if (fromAuthor) set.add(fromAuthor);
  return { accounts: set, author: fromAuthor, envCount: env.split(',').filter((s) => s.trim()).length };
}

export async function checkReq7(report, ctx) {
  const { root, gh } = ctx;

  // ── (a) 7경로 등록 + 소유자 비어있지 않음 ──────────────────────────────
  const { exists, rules } = parseCodeowners(root);
  if (!exists) {
    report.fail(RULE, `(a) ${CODEOWNERS_PATH} 가 없다 — 7경로 소유자 등록을 판정할 수 없다`);
    return;
  }
  if (rules.length === 0) {
    report.fail(RULE, `(a) ${CODEOWNERS_PATH} 에 규칙이 0건이다 (검사 대상 0건을 통과로 처리하지 않는다)`);
    return;
  }

  const declared = new Map();
  for (const r of rules) declared.set(normalizePattern(r.pattern), r);

  for (const req of REQUIRED_OWNER_PATHS) {
    const key = normalizePattern(req);
    const rule = declared.get(key);
    if (!rule) {
      report.fail(
        RULE,
        `(a) ${CODEOWNERS_PATH} 에 경로 \`${req}\` 규칙이 없다 (등록된 패턴: ${fmtSet([...declared.keys()])})`,
      );
      continue;
    }
    if (rule.owners.length === 0) {
      report.fail(RULE, `(a) ${CODEOWNERS_PATH}:${rule.line} 경로 \`${req}\` 의 소유자 필드가 비어 있다`);
      continue;
    }
    report.pass(RULE, `(a) \`${req}\` → ${rule.owners.join(' ')} (${CODEOWNERS_PATH}:${rule.line})`);
  }

  // ── (c) — 유지보수 체제에 따라 원 요구 / 대체 규약 분기 ────────────────
  const { accounts, author, envCount } = implementerAccounts();
  const allOwners = new Set();
  for (const req of REQUIRED_OWNER_PATHS) {
    const rule = declared.get(normalizePattern(req));
    if (rule) for (const o of rule.owners) allOwners.add(o);
  }

  const maint = await detectMaintainerMode(gh);
  if (maint.mode === 'single') {
    report.info(
      RULE,
      `${SINGLE_MAINTAINER_TOKEN} — push 권한 보유 collaborator 가 ${maint.logins.length}명(${fmtSet(maint.logins)})이다. ` +
        `타인 승인이 물리적으로 불가능하므로 REQ-7 (c) 대신 (c-1)(c-2)(c-3) 대체 규약을 적용한다. ` +
        `이 유예는 만료일을 가지며 만료 후 원 요구가 되살아난다`,
    );
    checkSingleMaintainerRelaxation(report, ctx);
  } else if (maint.mode === 'multi') {
    report.info(
      RULE,
      `push 권한 보유 collaborator ${maint.logins.length}명 ${fmtSet(maint.logins)} — ` +
        `${SINGLE_MAINTAINER_TOKEN} 완화 미적용, (c) 원 요구로 판정한다`,
    );
    checkOwnerDisjointness(report, allOwners, accounts, author, envCount);
  } else {
    // 체제를 확정하지 못했다. CI 라면 판정 불가 = 실패. 로컬이면 명시 스킵하되,
    // 정적으로 판정 가능한 (c-1)(c-2)(c-3) 과 (c) 교집합은 그대로 수행해 정보량을 남긴다.
    report.skip(
      RULE,
      '(c) 유지보수 체제(push 권한 collaborator 수) 미확정 — single_maintainer 대체 규약 적용 여부를 판정할 수 없다',
      maint.reason ?? 'collaborator 조회 불가',
    );
    checkOwnerDisjointness(report, allOwners, accounts, author, envCount);
    checkSingleMaintainerRelaxation(report, ctx);
  }

  // ── (b) require_code_owner_reviews == true ────────────────────────────
  if (!gh.available) {
    report.skip(RULE, '(b) require_code_owner_reviews == true 미검증', gh.reason);
    return;
  }
  const branch = baseBranchName();
  let protection;
  try {
    protection = await gh.client.branchProtection(branch);
  } catch (err) {
    report.fail(
      RULE,
      `(b) 브랜치 \`${branch}\` 보호 설정 조회 실패 — 판정 불가는 통과가 아니다`,
      `${err.message}\n${err.body ?? ''}`,
    );
    return;
  }
  const flag = protection?.required_pull_request_reviews?.require_code_owner_reviews;
  if (flag === true) {
    report.pass(RULE, `(b) ${branch} 브랜치 보호: require_code_owner_reviews == true`);
  } else {
    report.fail(
      RULE,
      `(b) ${branch} 브랜치 보호의 require_code_owner_reviews 가 true 가 아니다 (실제값: ${JSON.stringify(flag)}) — CODEOWNERS 가 파일 속 문자열로만 남는다`,
    );
  }
}

/** (c) 원 요구 — 소유자 집합 ∩ 구현 에이전트 계정 == ∅ */
function checkOwnerDisjointness(report, allOwners, accounts, author, envCount) {
  if (accounts.size === 0) {
    // 판정 근거가 0건이다. CI 면 실패(미판정 ≠ 통과), 로컬이면 명시 스킵.
    report.skip(
      RULE,
      '(c) 소유자 ∩ 구현 에이전트 계정 == ∅ 미검증',
      'PR 작성자를 확정할 수 없고 GLOWMATE_IMPLEMENTER_ACCOUNTS 도 비어 있다 — 구현 에이전트 계정 집합이 0건이면 교집합 검사가 공허하다',
    );
  } else {
    const overlap = [...allOwners].filter((o) => accounts.has(normalizeOwner(o)));
    if (overlap.length > 0) {
      report.fail(
        RULE,
        `(c) CODEOWNERS 소유자와 구현 에이전트 계정이 겹친다: ${fmtSet(overlap)} — 자기 PR 을 자기가 승인하는 경로가 열린다`,
        `구현 에이전트 계정 집합 = PR 작성자(${author ?? 'none'}) ∪ GLOWMATE_IMPLEMENTER_ACCOUNTS(${envCount}건)`,
      );
    } else {
      report.pass(
        RULE,
        `(c) 소유자 ${fmtSet(allOwners)} ∩ 구현 에이전트 계정 ${fmtSet(accounts)} == ∅`,
      );
    }
  }
}

/**
 * single_maintainer 대체 규약 — (c-1) 만료 · (c-2) 90일 상한 · (c-3) 독립 PR.
 * 전부 assert 한다. 하나라도 어긋나면 exit 1.
 */
function checkSingleMaintainerRelaxation(report, ctx) {
  const { root, base } = ctx;

  // (c-1)(c-2) — 정적
  for (const f of checkRelaxationWindow(root)) {
    if (f.ok) report.pass(RULE, `(${f.id}) ${SINGLE_MAINTAINER_TOKEN} ${f.message}`);
    else report.fail(RULE, `(${f.id}) ${SINGLE_MAINTAINER_TOKEN} ${f.message}`);
  }

  // (c-3) — 승인 대체: 대상 파일 변경은 독립 PR 이어야 한다
  if (!base.ok) {
    report.skip(RULE, `(c-3) ${SINGLE_MAINTAINER_TOKEN} 독립 PR 요구 미검증`, base.reason);
    return;
  }
  let changed;
  try {
    changed = changedFiles(root, base.mergeBase);
  } catch (err) {
    report.fail(RULE, `(c-3) PR 의 변경 파일 목록을 산출할 수 없어 독립 PR 요구를 판정할 수 없다`, err.message);
    return;
  }

  let anyTarget = false;
  for (const t of C3_TARGETS) {
    if (!changed.includes(t.path)) continue;

    // 최초 도입(base 에 파일 없음)은 대상 제외 — 그렇지 않으면 F1 자기 PR 이 차단된다(P7).
    if (showBlob(root, base.mergeBase, t.path) == null) {
      report.pass(
        RULE,
        `(c-3) ${SINGLE_MAINTAINER_TOKEN} ${t.path} 는 base(${base.ref})에 없다 — 최초 도입이므로 독립 PR 요구 대상 제외 (계약 명시)`,
      );
      continue;
    }

    if (!t.owned) {
      // 승인 대상 diff 인지의 판정이 이 컴포넌트 소관이 아니다. 조용히 넘기지 않고 명시 기록한다.
      report.info(
        RULE,
        `(c-3) ${SINGLE_MAINTAINER_TOKEN} ${t.path} 가 변경됐다 — "승인 대상 diff" 여부와 독립 PR 요구 판정은 ${t.ownerNote}. ` +
          `이 검사기는 그 판정을 대신하지 않는다 (무조건 독립 PR 을 요구하면 DS1·DS3 의 합법 경로가 0개가 된다)`,
      );
      continue;
    }

    anyTarget = true;
    const res = checkIndependentPr(changed, t.path);
    if (res.ok) {
      report.pass(
        RULE,
        `(c-3) ${SINGLE_MAINTAINER_TOKEN} ${t.path} 변경이 독립 PR 이다` + (res.note ? ` — ${res.note}` : ''),
      );
    } else {
      report.fail(
        RULE,
        `(c-3) ${SINGLE_MAINTAINER_TOKEN} ${t.path} 변경이 독립 PR 이 아니다 — 함께 변경된 파일 ${res.others.length}건. ` +
          `타인 승인을 쓸 수 없는 동안 승인을 대체하는 유일한 검증 수단이 "독립 PR"이므로 다른 변경과 섞을 수 없다`,
        res.others.slice(0, 20).join('\n'),
      );
    }
  }

  if (!anyTarget) {
    report.pass(
      RULE,
      `(c-3) ${SINGLE_MAINTAINER_TOKEN} 승인 대체 대상 파일의 기존 변경 0건 — 독립 PR 요구가 발동하지 않는다`,
    );
  }
}
