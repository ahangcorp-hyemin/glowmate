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
import { baseBranchName, isPlanLimited, PLAN_LIMITED_TOKEN } from '../lib/github.mjs';
import {
  loadProtectionSources,
  resolveRequiredContexts,
  sourceErrorDetail,
} from '../lib/branch-protection.mjs';

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
 *   R6C-5 비영 종료 : **non-success 판정의 산출물이 non-zero 종료의 조건으로 연결되는가.**
 *                     + ci-required 의 job/step 에 continue-on-error 가 켜져 있으면 FAIL.
 *
 * R6C-5 를 "어딘가에 non-zero 종료가 있는가"에서 위 형태로 좁힌 이유 (f1-pr-review §10 권고 7):
 *   아래 구현은 non-zero 종료가 **존재**하지만 non-success 를 발견해도 실패하지 않는다.
 *     const bad = entries.filter(([, v]) => v.result !== 'success');
 *     if (entries.length === 0) process.exit(1);   // ← non-zero 는 존재한다
 *     console.log(`${bad.length}건 실패`);          // ← 그러나 bad 에 대해서는 종료하지 않는다
 *   이 형태가 통과하면 ci-required 는 언제나 success 이고 8개 job 이 전부 red 여도 머지가 열린다.
 *   B-8 의 본체는 "실패로 끝나는 코드가 존재하는가"가 아니라 "non-success 를 발견했을 때
 *   실패로 전파하는가"이므로, 판정을 **연결성**(non-success 판정 → 종료 조건)으로 옮긴다.
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

/* ────────────────────────────────────────────────────────────────────────────
 * R6C-5 연결성 판정 — "non-success 판정 → 종료 조건" 데이터 흐름을 정적으로 추적한다.
 *
 * 두 갈래로 오염(taint)을 전파한다:
 *   A(needs 파생)  : needs / *.result 를 읽어 만든 값. **연결 근거로 쓰지 않는다** —
 *                    `entries.length === 0` 같은 가드도 A 를 참조하기 때문이다.
 *   B(non-success) : A 또는 *.result 에 대한 `success` 비교의 산출물. 이것만 연결 근거다.
 * 종료 지점마다 가드 텍스트(step `if:` + 감싸는 if 조건 + 같은 줄 접두)를 모아,
 * 그 안에 success 비교나 B 이름이 나타나면 "연결됨"으로 본다.
 * 판정 불가(가드를 못 읽음 · 종료 지점 없음)는 통과가 아니라 실패다.
 * ──────────────────────────────────────────────────────────────────────────── */

// non-success 판정으로 인정하는 비교 형태. `v.result !== 'success'` · `[ "$r" = "success" ]` ·
// `contains(needs.*.result, 'success')` · `grep -q success` 등.
const RE_SUCCESS_CMP = new RegExp(
  [
    String.raw`(?:!==|!=|===|==|=~|<>|=)\s*['"\x60]?success['"\x60]?`,
    String.raw`['"\x60]?success['"\x60]?\s*(?:!==|!=|===|==|=~)`,
    String.raw`(?:contains|includes|indexOf|startsWith|match|every|some)\s*\([^()]*success`,
    String.raw`\bgrep\b[^\n]*\bsuccess\b`,
  ].join('|'),
);

// A 오염의 뿌리 — needs / result 참조
const RE_NEEDS_ROOT = /\bneeds\b|\.\s*result\b|NEEDS_JSON/;

// 종료 지점(비영 종료)의 앵커. RE_NONZERO_EXIT 와 같은 형태를 위치와 함께 잡기 위한 앵커 버전.
const RE_EXIT_AT = /^(?:process\s*\.\s*exit|sys\s*\.\s*exit|exit)\s*(?:\(\s*[1-9][0-9]*\s*\)|\s+[1-9][0-9]*\b|\s+["']?\$)/;

// 따옴표 안이 산문이 아니라 **스크립트**로 보이는가 (재귀 분석 대상 판정).
// 산문 메시지가 우연히 'exit 1' 을 담는 경우와 구분한다.
const RE_EMBEDDED_SCRIPT = /(?:process|sys)\s*\.\s*exit\s*\(|(?:[;&|\n)]|\bthen\b|\bdo\b)\s*exit\s+[1-9]/;

/** 한 줄에서 대입되는 식별자 이름들. 비교 연산자(`==` `!=` `>=` `=>` `=~`)는 제외한다. */
function assignedNames(line) {
  const out = [];
  const re = /([A-Za-z_$][\w$]*)(\s*)=/g;
  let m;
  while ((m = re.exec(line)) !== null) {
    const eqIdx = m.index + m[0].length - 1;
    const next = line[eqIdx + 1];
    if (next === '=' || next === '~' || next === '>') continue; // ==, =~, =>
    const before = line[m.index - 1];
    if (before === '.') continue; // obj.prop = … 은 새 이름을 만들지 않는다
    out.push(m[1]);
  }
  return out;
}

function referencesAny(text, names) {
  for (const n of names) {
    if (new RegExp(`\\b${escapeRe(n)}\\b`).test(text)) return n;
  }
  return null;
}

/** run 스크립트 텍스트에서 A(needs 파생) · B(non-success 판정) 오염 집합을 계산한다. */
export function collectTaint(text) {
  const lines = String(text ?? '').split('\n');
  const A = new Set();
  const B = new Set();
  for (let pass = 0; pass < 8; pass += 1) {
    let changed = false;
    for (const line of lines) {
      const names = assignedNames(line);
      if (names.length === 0) continue;
      const fromNeeds = RE_NEEDS_ROOT.test(line) || referencesAny(line, A) !== null;
      const isCmp = fromNeeds && RE_SUCCESS_CMP.test(line);
      const fromBad = referencesAny(line, B) !== null;
      for (const n of names) {
        if (fromNeeds && !A.has(n)) { A.add(n); changed = true; }
        if ((isCmp || fromBad) && !B.has(n)) { B.add(n); changed = true; }
      }
    }
    if (!changed) break;
  }
  return { A, B };
}

/** 따옴표 문자열의 끝 인덱스. 줄을 넘는 따옴표(`'` `"`)는 그 줄 끝에서 닫힌 것으로 본다. */
function skipString(text, i) {
  const q = text[i];
  for (let j = i + 1; j < text.length; j += 1) {
    if (text[j] === '\\') { j += 1; continue; }
    if (text[j] === q) return j;
    if (text[j] === '\n' && q !== '`') return j - 1;
  }
  return text.length - 1;
}

/** `(` 로 시작하는 구간의 짝 맞는 `)` 인덱스. 못 찾으면 -1. */
function matchParen(text, open) {
  let depth = 0;
  for (let j = open; j < text.length; j += 1) {
    const c = text[j];
    if (c === '"' || c === "'" || c === '`') { j = skipString(text, j); continue; }
    if (c === '(') depth += 1;
    else if (c === ')') {
      depth -= 1;
      if (depth === 0) return j;
    }
  }
  return -1;
}

/**
 * run 스크립트에서 비영 종료 지점을 찾고, 각 지점을 감싸는 **가드 텍스트**를 모은다.
 * 가드 = 감싸는 `if`/`elif`/`else` 조건(JS 블록 · 셸 `if … then … fi`) + 같은 줄의 앞부분.
 */
export function findExitSites(runText, outerGuards = []) {
  const text = String(runText ?? '');
  const sites = [];
  /** @type {Array<{kind:'js'|'sh', cond:string, depth:number}>} */
  const stack = [];
  let braceDepth = 0;
  let lineStart = 0;
  let pending = null; // 중괄호 없는 `if (…)` 의 단문 가드
  let elseCandidate = null;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '\n') { lineStart = i + 1; continue; }
    if (ch === '"' || ch === "'" || ch === '`') {
      const end = skipString(text, i);
      // `node -e "…"` 처럼 따옴표 안에 스크립트가 통째로 들어 있는 형태가 실제 ci.yml 의
      // 한 줄 변형이다. 문자열을 통째로 건너뛰면 그 안의 종료 지점을 못 본다 —
      // 코드로 보이는 문자열은 바깥 가드를 물려받아 재귀 분석한다.
      const inner = text.slice(i + 1, end);
      if (RE_EMBEDDED_SCRIPT.test(inner)) {
        const outer = [
          ...outerGuards,
          ...stack.map((s) => s.cond),
          ...(pending != null ? [pending] : []),
          text.slice(lineStart, i),
        ];
        for (const s of findExitSites(inner, outer)) sites.push(s);
      }
      i = end;
      continue;
    }
    if (ch === '/' && text[i + 1] === '/') {
      const nl = text.indexOf('\n', i);
      if (nl < 0) break;
      i = nl - 1;
      continue;
    }
    if (ch === '{') { braceDepth += 1; continue; }
    if (ch === '}') {
      braceDepth = Math.max(0, braceDepth - 1);
      elseCandidate = null;
      while (stack.length > 0 && stack[stack.length - 1].kind === 'js' && stack[stack.length - 1].depth >= braceDepth) {
        elseCandidate = stack.pop().cond;
      }
      pending = null;
      continue;
    }
    if (ch === ';') { pending = null; continue; }
    if (!/[A-Za-z_$]/.test(ch)) continue;
    const prev = i > 0 ? text[i - 1] : '';
    if (/[\w$.]/.test(prev)) continue; // 식별자 중간
    const tokenMatch = /^[A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)*/.exec(text.slice(i));
    if (!tokenMatch) continue;
    const token = tokenMatch[0].replace(/\s+/g, '');
    const tokenEnd = i + tokenMatch[0].length;

    if (token === 'if' || token === 'elif') {
      const rest = text.slice(tokenEnd);
      const lead = /^\s*/.exec(rest)[0].length;
      if (rest[lead] === '(') {
        const open = tokenEnd + lead;
        const close = matchParen(text, open);
        if (close < 0) { i = tokenEnd - 1; continue; }
        const cond = text.slice(open + 1, close);
        const after = /^\s*/.exec(text.slice(close + 1))[0].length;
        if (text[close + 1 + after] === '{') {
          stack.push({ kind: 'js', cond, depth: braceDepth });
        } else {
          pending = cond;
        }
        i = close;
        continue;
      }
      // 셸 `if … ; then`
      const thenIdx = rest.search(/(^|[\s;])then([\s;]|$)/);
      if (thenIdx >= 0) {
        const cond = rest.slice(0, thenIdx);
        stack.push({ kind: 'sh', cond, depth: braceDepth });
        i = tokenEnd + thenIdx + rest.slice(thenIdx).indexOf('then') + 3;
        continue;
      }
      i = tokenEnd - 1;
      continue;
    }
    if (token === 'fi') {
      for (let k = stack.length - 1; k >= 0; k -= 1) {
        if (stack[k].kind === 'sh') { stack.splice(k, 1); break; }
      }
      i = tokenEnd - 1;
      continue;
    }
    if (token === 'else') {
      if (elseCandidate != null) {
        const rest = text.slice(tokenEnd);
        const lead = /^\s*/.exec(rest)[0].length;
        const negated = `!(${elseCandidate})`;
        if (rest[lead] === '{') stack.push({ kind: 'js', cond: negated, depth: braceDepth });
        else pending = negated;
        elseCandidate = null;
      }
      i = tokenEnd - 1;
      continue;
    }
    if (token === 'exit' || token === 'process.exit' || token === 'sys.exit') {
      if (RE_EXIT_AT.test(text.slice(i))) {
        const linePrefix = text.slice(lineStart, i);
        const guards = [
          ...outerGuards,
          ...stack.map((s) => s.cond),
          ...(pending != null ? [pending] : []),
          linePrefix,
        ].filter((g) => String(g ?? '').trim() !== '');
        sites.push({
          snippet: text.slice(i, Math.min(text.length, i + 40)).split('\n')[0].trim(),
          guards,
          guardText: guards.join('\n'),
        });
      }
      i = tokenEnd - 1;
      continue;
    }
    i = tokenEnd - 1;
  }
  return sites;
}

/**
 * 애그리게이터 스텝들에서 "non-success 판정 → non-zero 종료" 연결을 판정한다.
 * @returns {{sites: Array, linked: object|null, tainted: string[]}}
 */
export function analyzeExitLinkage(steps) {
  const all = [];
  const taintedAll = new Set();
  for (const step of Array.isArray(steps) ? steps : []) {
    const run = String(step?.run ?? '');
    if (run.trim() === '') continue;
    const stepIf = normalizeExpression(step?.if);
    const stepEnv = step?.env ? JSON.stringify(step.env) : '';
    const { B } = collectTaint([stepEnv, run].join('\n'));
    for (const n of B) taintedAll.add(n);
    const outer = [stepIf].filter((g) => g.trim() !== '');
    for (const site of findExitSites(run, outer)) {
      const badName = referencesAny(site.guardText, B);
      const cmp = RE_SUCCESS_CMP.test(site.guardText);
      all.push({
        ...site,
        linked: Boolean(badName) || cmp,
        via: badName ? `non-success 판정 결과 \`${badName}\`` : cmp ? "가드 안의 'success' 비교" : null,
      });
    }
  }
  return {
    sites: all,
    linked: all.find((s) => s.linked) ?? null,
    tainted: [...taintedAll],
  };
}

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

  // R6C-5 non-success 판정 → non-zero 종료 연결 + 마스킹 부재
  if (hasAnyResult) {
    const linkage = analyzeExitLinkage(steps);
    if (linkage.sites.length === 0) {
      findings.push({
        id: 'R6C-5',
        ok: false,
        message: RE_NONZERO_EXIT.test(runText)
          ? `run 텍스트에 non-zero 종료 형태가 보이나 실행 경로상의 종료 지점으로 판정할 수 없다 — ` +
            `판정 불가는 통과가 아니다 (needs 결과를 평가한 뒤 그 결과를 조건으로 exit 1 할 것)`
          : `결과 평가 스텝에 non-zero 종료(exit <nonzero>)가 없다 — 평가만 하고 실패시키지 않는다`,
      });
    } else if (!linkage.linked) {
      const detail = linkage.sites
        .map((s) => `\`${s.snippet}\` (가드: ${oneLine(s.guardText) || '없음'})`)
        .join(' / ');
      findings.push({
        id: 'R6C-5',
        ok: false,
        message:
          `non-zero 종료 ${linkage.sites.length}건이 있으나 어느 것도 non-success 판정` +
          `(\`result !== 'success'\` 비교의 산출물)을 조건으로 삼지 않는다 — ` +
          `실패로 끝나는 코드가 존재하는 것과 non-success 를 발견했을 때 실패로 전파하는 것은 다르다. ` +
          `이 형태의 ${AGGREGATOR_JOB} 는 선행 job 이 전부 red 여도 success 로 끝난다. ` +
          `종료 지점: ${detail}` +
          (linkage.tainted.length > 0
            ? ` / 판정 결과 값 ${fmtSet(linkage.tainted)} 은(는) 종료 조건에 쓰이지 않는다`
            : ''),
      });
    } else {
      findings.push({
        id: 'R6C-5',
        ok: true,
        message:
          `non-success 판정이 non-zero 종료로 연결됨 — \`${linkage.linked.snippet}\` ` +
          `(연결 근거: ${linkage.linked.via})`,
      });
    }
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

function oneLine(s, max = 160) {
  const flat = String(s ?? '').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
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
  const sources = await loadProtectionSources(gh.client, branch);
  const resolved = resolveRequiredContexts(sources);

  if (!resolved.found) {
    const planErr = [sources.ruleset.error, sources.legacy.error].find((e) => e && isPlanLimited(e));
    if (planErr) {
      report.fail(
        RULE,
        `(a) ${PLAN_LIMITED_TOKEN} — 이 리포지토리에서는 브랜치 보호를 켤 수 없다. ` +
          `required status checks 를 {${AGGREGATOR_JOB}} 로 등록하는 것이 **설정 자체로 불가능**하므로 ` +
          `REQ-6 (a) 를 충족할 수 없다. 조회 실패가 아니라 기능 부재다 — 통과로 처리하지 않는다`,
        sourceErrorDetail(sources),
      );
      return;
    }
    report.fail(
      RULE,
      `(a) 브랜치 \`${branch}\` 의 필수 상태 체크를 ruleset·legacy 어느 원천으로도 판정할 수 없다 — 판정 불가는 통과가 아니다`,
      sourceErrorDetail(sources),
    );
    return;
  }

  const set = new Set(resolved.contexts);
  if (set.size === 1 && set.has(AGGREGATOR_JOB)) {
    report.pass(
      RULE,
      `(a) required status checks == {${AGGREGATOR_JOB}} (source=${resolved.source}, branch=${branch})`,
    );
  } else {
    report.fail(
      RULE,
      `(a) 브랜치 보호 required status checks 집합이 {${AGGREGATOR_JOB}} 와 다르다: ${fmtSet(set)} ` +
        `(source=${resolved.source}, branch=${branch}) — 계약은 포함이 아니라 **집합 동등**을 요구한다`,
    );
  }
}
