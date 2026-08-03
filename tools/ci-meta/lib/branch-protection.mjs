// tools/ci-meta/lib/branch-protection.mjs
//
// 브랜치 보호 판정의 **원천 해석**. REQ-6 (a) 와 REQ-7 (b) 가 공유한다.
//
// 원천이 둘이다:
//   1차 ruleset            `GET /repos/{o}/{r}/rules/branches/{branch}`  — 읽기 권한만으로 조회된다.
//   2차 legacy protection  `GET /repos/{o}/{r}/branches/{b}/protection`  — **admin 권한**을 요구하므로
//                          Actions 기본 GITHUB_TOKEN 으로는 403 이다.
//
// 두 원천은 응답 모양이 다르다:
//   ruleset : parameters.required_status_checks = [{ "context": "ci-required" }]   ← 객체 배열
//   legacy  : required_status_checks.contexts   = ["ci-required"]                  ← 문자열 배열
//             (신형 응답은 .checks = [{context, app_id}] 도 준다)
// 그래서 문자열 집합으로 정규화한 뒤 비교한다.
//
// 어느 원천으로 판정했는지는 반드시 로그에 남긴다 — 원천이 바뀌면 판정의 의미도 바뀐다.
//
// ※ ruleset 의 `bypass_actors` 는 판정 대상이 아니다. 계약이 요구하는 것은
//   "필수 체크 집합"과 "code owner 리뷰 활성 여부"뿐이다.

export const SOURCE_RULESET = 'ruleset';
export const SOURCE_LEGACY = 'legacy-protection';

/**
 * 두 원천을 모두 조회한다. 실패는 삼키지 않고 기록해 호출부가 FAIL 로 만들 수 있게 한다.
 * @returns {Promise<{ruleset:{ok:boolean,rules:any[]|null,error:Error|null},
 *                    legacy:{ok:boolean,data:any|null,error:Error|null}}>}
 */
export async function loadProtectionSources(client, branch) {
  const out = {
    ruleset: { ok: false, rules: null, error: null },
    legacy: { ok: false, data: null, error: null },
  };

  try {
    const rules = await client.branchRules(branch);
    if (Array.isArray(rules)) {
      out.ruleset = { ok: true, rules, error: null };
    } else {
      out.ruleset = {
        ok: false,
        rules: null,
        error: new Error('ruleset 응답이 배열이 아니다 (브랜치에 적용되는 룰셋이 없을 수 있다)'),
      };
    }
  } catch (err) {
    out.ruleset = { ok: false, rules: null, error: err };
  }

  try {
    const data = await client.branchProtection(branch);
    out.legacy = { ok: true, data, error: null };
  } catch (err) {
    out.legacy = { ok: false, data: null, error: err };
  }

  return out;
}

/* ── 정규화 (순수 — selftest 가 직접 검증한다) ───────────────────────────── */

/** ruleset 에서 필수 상태 체크 컨텍스트 집합. */
export function requiredContextsFromRuleset(rules) {
  if (!Array.isArray(rules)) return { found: false, contexts: [] };
  const rule = rules.find((r) => r?.type === 'required_status_checks');
  if (!rule) return { found: false, contexts: [] };
  const raw = rule.parameters?.required_status_checks;
  if (!Array.isArray(raw)) return { found: false, contexts: [] };
  const contexts = raw
    .map((c) => (typeof c === 'string' ? c : c?.context))
    .filter((c) => typeof c === 'string' && c.length > 0);
  return { found: true, contexts };
}

/** legacy branch protection 에서 필수 상태 체크 컨텍스트 집합. */
export function requiredContextsFromLegacy(protection) {
  const rsc = protection?.required_status_checks;
  if (!rsc) return { found: false, contexts: [] };
  let contexts = [];
  if (Array.isArray(rsc.contexts)) contexts = rsc.contexts.filter((c) => typeof c === 'string');
  else if (Array.isArray(rsc.checks)) {
    contexts = rsc.checks.map((c) => c?.context).filter((c) => typeof c === 'string');
  } else return { found: false, contexts: [] };
  return { found: true, contexts };
}

/** ruleset 에서 code owner 리뷰 필수 여부. */
export function requireCodeOwnerFromRuleset(rules) {
  if (!Array.isArray(rules)) return { found: false, value: null };
  const rule = rules.find((r) => r?.type === 'pull_request');
  if (!rule) return { found: false, value: null };
  const v = rule.parameters?.require_code_owner_review;
  if (typeof v !== 'boolean') return { found: false, value: null };
  return { found: true, value: v };
}

/** legacy branch protection 에서 code owner 리뷰 필수 여부. */
export function requireCodeOwnerFromLegacy(protection) {
  const v = protection?.required_pull_request_reviews?.require_code_owner_reviews;
  if (typeof v !== 'boolean') return { found: false, value: null };
  return { found: true, value: v };
}

/* ── 원천 선택 (1차 ruleset → 2차 legacy) ────────────────────────────────── */

/**
 * @returns {{found:boolean, contexts:string[], source:string|null}}
 */
export function resolveRequiredContexts(sources) {
  if (sources.ruleset.ok) {
    const r = requiredContextsFromRuleset(sources.ruleset.rules);
    if (r.found) return { ...r, source: SOURCE_RULESET };
  }
  if (sources.legacy.ok) {
    const l = requiredContextsFromLegacy(sources.legacy.data);
    if (l.found) return { ...l, source: SOURCE_LEGACY };
  }
  return { found: false, contexts: [], source: null };
}

/**
 * @returns {{found:boolean, value:boolean|null, source:string|null}}
 */
export function resolveRequireCodeOwnerReviews(sources) {
  if (sources.ruleset.ok) {
    const r = requireCodeOwnerFromRuleset(sources.ruleset.rules);
    if (r.found) return { ...r, source: SOURCE_RULESET };
  }
  if (sources.legacy.ok) {
    const l = requireCodeOwnerFromLegacy(sources.legacy.data);
    if (l.found) return { ...l, source: SOURCE_LEGACY };
  }
  return { found: false, value: null, source: null };
}

/** 두 원천의 실패 사유를 한 덩어리로 (FAIL 상세용). */
export function sourceErrorDetail(sources) {
  const lines = [];
  if (sources.ruleset.error) {
    lines.push(`${SOURCE_RULESET}: ${sources.ruleset.error.message}`);
    if (sources.ruleset.error.body) lines.push(`  ${String(sources.ruleset.error.body).slice(0, 300)}`);
  } else if (sources.ruleset.ok) {
    lines.push(`${SOURCE_RULESET}: 조회 성공 (규칙 ${sources.ruleset.rules.length}건) — 해당 규칙 타입 없음`);
  }
  if (sources.legacy.error) {
    lines.push(`${SOURCE_LEGACY}: ${sources.legacy.error.message}`);
    if (sources.legacy.error.body) lines.push(`  ${String(sources.legacy.error.body).slice(0, 300)}`);
  } else if (sources.legacy.ok) {
    lines.push(`${SOURCE_LEGACY}: 조회 성공 — 해당 필드 없음`);
  }
  return lines.join('\n');
}
