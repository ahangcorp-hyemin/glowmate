// tools/ci-meta/lib/maintainer.mjs
//
// `single_maintainer` 대체 규약 (REQ-7 acceptance 개정본 · FORBID-1(c) · FORBID-5 detect).
//
// 배경: 이 리포는 push 권한 보유 계정이 1개다. "승인자 ≠ PR 작성자"는 물리적으로 충족 불가능하므로,
// 계약이 예외를 규칙 안으로 끌고 들어오면서 **만료일**과 **검증 가능한 대체 조건**을 붙였다.
//
//   (c-1) CODEOWNERS 헤더의 `single-maintainer-until: <YYYY-MM-DD>` 가 있고 오늘 ≤ 그 날짜
//         → 이 완화는 **스스로 만료한다**. 만료 후 원 요구가 되살아난다.
//   (c-2) 그 날짜가 CODEOWNERS 최초 도입일로부터 90일 이내
//   (c-3) 승인 대상 파일의 변경은 **그 파일 하나만 포함하는 독립 PR**
//
// 대체 규약은 "타인이 봤다"를 흉내내지 않는다. 검증 가능한 것만 요구하고,
// 검증 불가능한 것(타인 승인)은 만료일까지 유예했음을 `SINGLE_MAINTAINER` 토큰으로 명시 기록한다.

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { exec } from './util.mjs';
import { CODEOWNERS_PATH } from './codeowners.mjs';

export const SINGLE_MAINTAINER_TOKEN = 'SINGLE_MAINTAINER';
export const MAX_RELAXATION_DAYS = 90;
const UNTIL_RE = /single-maintainer-until\s*:\s*(\d{4}-\d{2}-\d{2})/;

/**
 * push 권한 보유 collaborator 수로 유지보수 체제를 판정한다.
 * @returns {Promise<{mode:'multi'|'single'|'unknown', logins:string[], reason:string|null}>}
 */
export async function detectMaintainerMode(gh) {
  if (!gh.available) {
    return { mode: 'unknown', logins: [], reason: gh.reason };
  }
  let collabs;
  try {
    collabs = await gh.client.collaborators();
  } catch (err) {
    return { mode: 'unknown', logins: [], reason: `collaborator 조회 실패: ${err.message}` };
  }
  const logins = collabs
    .filter((c) => c?.permissions?.push === true || c?.permissions?.admin === true)
    .map((c) => c.login)
    .sort();
  return { mode: logins.length >= 2 ? 'multi' : 'single', logins, reason: null };
}

/** CODEOWNERS 헤더의 만료일. */
export function readSingleMaintainerUntil(root) {
  const abs = path.join(root, CODEOWNERS_PATH);
  if (!existsSync(abs)) return null;
  const m = UNTIL_RE.exec(readFileSync(abs, 'utf8'));
  return m ? m[1] : null;
}

/**
 * CODEOWNERS 최초 도입일(ISO). 아직 커밋되지 않았으면(=최초 도입 PR) 현재 커밋 날짜.
 * @returns {{date:Date, source:string}|null}
 */
export function codeownersIntroducedAt(root) {
  // ⚠ `%aI`(오프셋 포함 ISO)를 Date 로 넘겨 UTC 캘린더를 취하면, KST 새벽 커밋이 전날로 밀려
  //   실제보다 하루 이른 도입일이 나오고 90일 판정이 1일 어긋난다. 그래서 **작성자 로컬 캘린더 날짜**
  //   (`%ad --date=format:%Y-%m-%d`)를 쓴다 — CODEOWNERS 헤더가 사람이 적는 도입일과 같은 기준이다.
  const fmt = ['--date=format:%Y-%m-%d', '--format=%ad'];
  const r = exec('git', ['log', '--diff-filter=A', ...fmt, '--', CODEOWNERS_PATH], { cwd: root });
  const lines = r.ok ? r.stdout.split('\n').filter(Boolean) : [];
  if (lines.length > 0) {
    return {
      date: new Date(`${lines[lines.length - 1]}T00:00:00Z`),
      source: `git log --diff-filter=A -- ${CODEOWNERS_PATH} (작성자 로컬 캘린더)`,
    };
  }
  const head = exec('git', ['log', '-1', ...fmt], { cwd: root });
  if (head.ok && head.stdout.trim()) {
    return {
      date: new Date(`${head.stdout.trim()}T00:00:00Z`),
      source: '현재 커밋 날짜 (CODEOWNERS 최초 도입 PR, 작성자 로컬 캘린더)',
    };
  }
  return null;
}

function dayDiff(a, b) {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

/**
 * 오늘 날짜.
 * 실행 환경의 **로컬 캘린더**를 쓴다 — UTC 를 쓰면 KST 에서 하루 이른 날짜가 되어
 * 만료일 판정이 최대 1일 관대해진다. 만료 판정은 관대한 쪽으로 틀리면 안 된다.
 */
function todayUtc() {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
}

/**
 * (c-1) 만료일 유효 · (c-2) 도입일로부터 90일 이내.
 * @returns {Array<{ok:boolean, id:string, message:string}>}
 */
export function checkRelaxationWindow(root) {
  const intro = codeownersIntroducedAt(root);
  return evaluateRelaxationWindow(
    readSingleMaintainerUntil(root),
    intro ? intro.date : null,
    intro ? intro.source : null,
    todayUtc(),
  );
}

/**
 * (c-1)(c-2) 의 순수 판정부. selftest 가 만료·90일초과 케이스를 직접 검증한다.
 * @param {string|null} until  `YYYY-MM-DD`
 * @param {Date|null} introDate CODEOWNERS 최초 도입일
 * @param {string|null} introSource
 * @param {Date} today UTC 자정
 */
export function evaluateRelaxationWindow(until, introDate, introSource, today) {
  const out = [];
  if (!until) {
    out.push({
      ok: false,
      id: 'c-1',
      message:
        `${CODEOWNERS_PATH} 헤더에 \`single-maintainer-until: <YYYY-MM-DD>\` 가 없다 — ` +
        `만료일 없는 완화는 영구화된다. 대체 규약을 쓰려면 만료일을 명시해야 한다`,
    });
    return out;
  }

  const untilDate = new Date(`${until}T00:00:00Z`);
  if (Number.isNaN(untilDate.getTime())) {
    out.push({ ok: false, id: 'c-1', message: `single-maintainer-until 값이 날짜가 아니다: ${until}` });
    return out;
  }

  if (today.getTime() > untilDate.getTime()) {
    out.push({
      ok: false,
      id: 'c-1',
      message:
        `single_maintainer 완화가 만료됐다 (만료일 ${until}, 오늘 ${today.toISOString().slice(0, 10)}) — ` +
        `REQ-7 (c) 원 요구(소유자 ∩ 구현 에이전트 == ∅ · 타인 승인)가 되살아난다. 완화 연장은 계약 개정 사안이다`,
    });
  } else {
    out.push({
      ok: true,
      id: 'c-1',
      message: `완화 유효 — 만료일 ${until} (잔여 ${dayDiff(untilDate, today)}일)`,
    });
  }

  if (!introDate || Number.isNaN(introDate.getTime())) {
    out.push({
      ok: false,
      id: 'c-2',
      message: `${CODEOWNERS_PATH} 최초 도입일을 확정할 수 없어 90일 상한을 판정할 수 없다 — 미판정을 통과로 처리하지 않는다`,
    });
    return out;
  }
  const introDay = new Date(
    Date.UTC(introDate.getUTCFullYear(), introDate.getUTCMonth(), introDate.getUTCDate()),
  );
  const span = dayDiff(untilDate, introDay);
  if (span > MAX_RELAXATION_DAYS) {
    out.push({
      ok: false,
      id: 'c-2',
      message:
        `만료일 ${until} 이 CODEOWNERS 최초 도입일 ${introDay.toISOString().slice(0, 10)} 로부터 ` +
        `${span}일 뒤다 — 상한 ${MAX_RELAXATION_DAYS}일 초과 (${introSource ?? '도입일 원천 미상'})`,
    });
  } else if (span < 0) {
    out.push({
      ok: false,
      id: 'c-2',
      message: `만료일 ${until} 이 CODEOWNERS 최초 도입일 ${introDay.toISOString().slice(0, 10)} 보다 앞선다`,
    });
  } else {
    out.push({
      ok: true,
      id: 'c-2',
      message: `만료일이 도입일(${introDay.toISOString().slice(0, 10)}) 로부터 ${span}일 (≤${MAX_RELAXATION_DAYS}일, ${introSource ?? '도입일 원천 미상'})`,
    });
  }
  return out;
}

/**
 * (c-3) 독립 PR 판정.
 *
 * `.github/pr-task` 는 "다른 변경"으로 세지 않는다 — FORBID-4 가 그 파일을 **전 계약 공통 허용**으로
 * 규정했고, 그것을 갱신하지 못하면 (c-3) 을 만족시키는 PR 이 path-guard 에서 반드시 red 가 되어
 * 합법 경로가 0개가 된다(규격 §3.4 "계약이 자기 PR 을 차단" 안티패턴). 예외 적용 시 명시 출력한다.
 *
 * @param {string[]} changed  PR 의 변경 파일 전량
 * @param {string} target     승인 대체 대상 파일
 */
export function checkIndependentPr(changed, target) {
  const others = changed.filter((f) => f !== target);
  const prTaskOnly = others.length > 0 && others.every((f) => f === '.github/pr-task');
  if (others.length === 0) {
    return { ok: true, others, note: null };
  }
  if (prTaskOnly) {
    return {
      ok: true,
      others,
      note: `.github/pr-task 는 FORBID-4 의 전 계약 공통 허용 경로이므로 "다른 변경"으로 세지 않았다`,
    };
  }
  return { ok: false, others, note: null };
}
