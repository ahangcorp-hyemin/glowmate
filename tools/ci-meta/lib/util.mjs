// tools/ci-meta/lib/util.mjs
//
// 공통 유틸 — 실행 컨텍스트 판정 · 프로세스 실행 · 리포터.
//
// 설계 원칙 (F1 계약 및 오케스트레이터 지시):
//   1. 판정 불가 ≠ 통과. CI 컨텍스트에서 판정 근거를 얻지 못하면 FAIL 이다.
//   2. 로컬에서는 API 의존 검사를 SKIPPED(local) 로 **명시 출력**한다. 조용히 넘기지 않는다.
//   3. 모든 FAIL 출력은 규칙 ID 토큰(REQ-5 · REQ-6 · FORBID-2 …)을 포함한다.
//      REQ-5 의 귀속 검증(실패 로그 ↔ 규칙 ID 매칭)이 이 문자열에 의존한다.
//   4. 예외를 삼키지 않는다. 검사 도중 throw 된 오류는 FAIL 로 승격된다.

import { execFileSync } from 'node:child_process';

/** GitHub Actions 러너에서 실행 중인가. */
export const IS_CI = process.env.GITHUB_ACTIONS === 'true';

export class CheckError extends Error {}

/**
 * 자식 프로세스 실행. 종료 코드를 절대 마스킹하지 않고 그대로 돌려준다.
 * @returns {{ok:boolean, code:number|null, stdout:string, stderr:string, missing:boolean}}
 */
export function exec(cmd, args, opts = {}) {
  try {
    const stdout = execFileSync(cmd, args, {
      encoding: 'utf8',
      maxBuffer: 128 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
      ...opts,
    });
    return { ok: true, code: 0, stdout, stderr: '', missing: false };
  } catch (err) {
    const missing = err && (err.code === 'ENOENT' || err.errno === -2);
    return {
      ok: false,
      code: typeof err?.status === 'number' ? err.status : null,
      stdout: err?.stdout ? String(err.stdout) : '',
      stderr: err?.stderr ? String(err.stderr) : String(err?.message ?? err),
      missing: Boolean(missing),
      signal: err?.signal ?? null,
    };
  }
}

/** 리포지토리 루트 절대경로. 확정할 수 없으면 throw (조용한 기본값 금지). */
export function repoRoot() {
  const r = exec('git', ['rev-parse', '--show-toplevel']);
  if (!r.ok) {
    throw new CheckError(
      `리포지토리 루트를 확정할 수 없다 (git rev-parse --show-toplevel 실패): ${r.stderr.trim()}`,
    );
  }
  return r.stdout.trim();
}

const LEVEL_ORDER = { FAIL: 0, SKIP: 1, PASS: 2, INFO: 3 };

/**
 * 검사 결과 수집기.
 *
 * skip() 은 "로컬이라 API 를 못 봤다"는 **명시 기록**이며 통과가 아니다.
 * CI 컨텍스트에서 skip() 을 호출하면 자동으로 FAIL 로 승격된다 —
 * CI 에서의 판정 불가는 통과가 아니기 때문이다.
 */
export class Report {
  constructor(entryName) {
    this.entryName = entryName;
    this.entries = [];
  }

  #push(level, ruleId, message, detail) {
    this.entries.push({ level, ruleId, message, detail: detail ?? null });
  }

  fail(ruleId, message, detail) {
    this.#push('FAIL', ruleId, message, detail);
  }

  pass(ruleId, message, detail) {
    this.#push('PASS', ruleId, message, detail);
  }

  info(ruleId, message, detail) {
    this.#push('INFO', ruleId, message, detail);
  }

  /**
   * 로컬에서만 허용되는 미판정 기록. CI 에서는 FAIL 로 승격한다.
   * @param {string} reason 왜 판정할 수 없는지 (반드시 구체적으로)
   */
  skip(ruleId, message, reason) {
    if (IS_CI) {
      this.fail(
        ruleId,
        `${message} — CI 컨텍스트에서 판정 불가는 통과가 아니다`,
        reason,
      );
      return;
    }
    this.#push('SKIP', ruleId, `SKIPPED(local) ${message}`, reason);
  }

  get failures() {
    return this.entries.filter((e) => e.level === 'FAIL');
  }

  get failed() {
    return this.failures.length > 0;
  }

  /** 결과를 stdout 에 출력하고 종료 코드를 반환한다 (0 = 통과). */
  print() {
    const sorted = [...this.entries].sort(
      (a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level],
    );
    const counts = { FAIL: 0, SKIP: 0, PASS: 0, INFO: 0 };
    for (const e of this.entries) counts[e.level] += 1;

    process.stdout.write(`\n=== ${this.entryName} ===\n`);
    for (const e of sorted) {
      process.stdout.write(`${e.level.padEnd(4)} [${e.ruleId}] ${e.message}\n`);
      if (e.detail) {
        for (const line of String(e.detail).split('\n')) {
          process.stdout.write(`       ${line}\n`);
        }
      }
    }
    process.stdout.write(
      `--- ${this.entryName}: FAIL=${counts.FAIL} SKIP=${counts.SKIP} PASS=${counts.PASS}\n`,
    );
    return this.failed ? 1 : 0;
  }
}

/**
 * 검사 함수를 실행하되 throw 를 FAIL 로 승격한다.
 * 조용한 catch 는 금지 — 반드시 실패로 기록된다.
 */
export async function guard(report, ruleId, name, fn) {
  try {
    await fn();
  } catch (err) {
    report.fail(
      ruleId,
      `${name} 검사가 예외로 중단됐다 (예외 = 실패로 판정한다)`,
      `${err?.stack ?? err}`,
    );
  }
}

/** 배열 → 정렬된 유일 집합 문자열 (출력용) */
export function fmtSet(iterable) {
  return `{${[...new Set(iterable)].sort().join(', ')}}`;
}
