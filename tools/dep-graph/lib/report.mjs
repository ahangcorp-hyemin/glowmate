/**
 * 판정 결과 수집기.
 *
 * 규칙: 모든 실패 메시지는 규칙 ID 토큰(`REQ-3` · `FORBID-1`)을 문자열로 포함한다.
 * F1 REQ-5 의 귀속 검증이 job 실패를 이 토큰으로 규칙에 귀속시키므로,
 * 토큰 없는 실패 메시지는 픽스처 검증을 깨뜨린다.
 */

/** 검사 항목 상태 */
export const PASS = 'PASS';
export const FAIL = 'FAIL';
export const SKIP = 'SKIPPED';

export class Report {
  constructor() {
    /** @type {{id: string, status: string, detail: string}[]} */
    this.checks = [];
    /** @type {string[]} */
    this.violations = [];
    /** @type {string[]} */
    this.notes = [];
  }

  check(id, status, detail) {
    this.checks.push({ id, status, detail });
  }

  /**
   * 위반 1건 기록. `rules` 는 반드시 REQ-3 / FORBID-1 토큰을 포함해야 한다.
   * 토큰이 빠진 호출은 즉시 예외로 잡아 조용한 귀속 실패를 막는다.
   */
  violation(rules, message) {
    const tag = rules.join('][');
    if (!/REQ-3/.test(tag) && !/FORBID-1/.test(tag)) {
      throw new Error(
        `internal: violation() 호출에 규칙 ID 토큰이 없다 (rules=${JSON.stringify(rules)}). ` +
          'REQ-3 또는 FORBID-1 을 반드시 포함해야 한다.',
      );
    }
    this.violations.push(`[${tag}] ${message}`);
  }

  note(message) {
    this.notes.push(message);
  }

  get failed() {
    return this.violations.length > 0 || this.checks.some((c) => c.status === FAIL);
  }

  print(out = console.log) {
    out('');
    out('── dep-graph boundary check ── REQ-3 (a)(b)(iii) · FORBID-1 (a)(b)(c) ──');
    for (const n of this.notes) out(`  · ${n}`);
    out('');
    for (const c of this.checks) {
      out(`  [${c.status.padEnd(7)}] ${c.id} — ${c.detail}`);
    }
    if (this.violations.length > 0) {
      out('');
      out(`  VIOLATIONS (${this.violations.length}):`);
      this.violations.forEach((v, i) => out(`    ${String(i + 1).padStart(2)}. ${v}`));
    }
    out('');
  }
}
