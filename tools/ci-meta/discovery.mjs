#!/usr/bin/env node
// tools/ci-meta/discovery.mjs — `pnpm test:discovery`
//
// FORBID-6 — Discovery 검증기의 **부재**와 **스텁**을 둘 다 잡는다.
//
//   (a) 존재 요구  : origin/main 에 머지된 Discovery 계약이 선언한
//                    `scripts/discovery/validate_d*.py` 가 리포에 없으면 실패.
//   (b) 비스텁 요구: 머지 여부와 **무관하게** 리포에 존재하는 전 `validate_d*.py` 중
//                    하나라도 인자·입력과 무관하게 항상 exit 0 이면 실패.
//
// ⚠ (b)를 (a)에 종속시키면 계약 위반이다 (감사 B-2). 두 검사는 서로 독립적으로 실행된다.
//    F1 머지 시점에는 (a)(b) 모두 대상 0건이며 이는 계약이 명시한 정상 상태다.
//    다만 "대상 0건 = 자동 통과" 를 막기 위해, 매 실행마다 (b) 판정기 자신을
//    합성 스텁/합성 실검증기로 **자기검사(self-test)** 한다. 판정기가 무력화되면 즉시 exit 1 이다.

import {
  existsSync,
  readFileSync,
  readdirSync,
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Report, repoRoot, exec, fmtSet, IS_CI, guard } from './lib/util.mjs';
import { resolveBase, mergedContractIds } from './lib/git.mjs';

const RULE = 'FORBID-6';
const DISCOVERY_DIR = 'scripts/discovery';
const SCRIPT_RE = /^validate_d[\w-]*\.py$/;
const PROBE_TIMEOUT_MS = 60_000;

/** 결손 입력 주입 프로브 — 실검증기라면 최소 1건에서 non-zero 를 내야 한다. */
const PROBES = [
  { name: 'no-args', args: [], emptyCwd: false },
  { name: 'unknown-check', args: ['--check', '__glowmate_nonexistent_check__'], emptyCwd: false },
  { name: 'all-in-empty-tree', args: ['--all'], emptyCwd: true },
  {
    name: 'missing-input-file',
    args: ['--check', 'verdict', '--input', '__glowmate_missing_input__.json'],
    emptyCwd: true,
  },
];

function pythonBin() {
  for (const bin of ['python3', 'python']) {
    const r = exec(bin, ['--version']);
    if (r.ok || (!r.missing && r.code !== null)) return bin;
  }
  return null;
}

/** 리포에 존재하는 validate_d*.py 상대경로 목록 */
export function listValidators(root) {
  const dir = path.join(root, DISCOVERY_DIR);
  if (!existsSync(dir)) return { dirExists: false, scripts: [] };
  const scripts = readdirSync(dir)
    .filter((f) => SCRIPT_RE.test(f))
    .sort()
    .map((f) => `${DISCOVERY_DIR}/${f}`);
  return { dirExists: true, scripts };
}

/**
 * 스텁 판정. 전 프로브가 exit 0 이면 스텁이다.
 * @returns {{stub:boolean, probes:Array<{name:string, code:number|null, timedOut:boolean}>}}
 */
export function probeValidator(python, absScript, emptyDir, baseCwd) {
  const probes = [];
  for (const p of PROBES) {
    const r = exec(python, [absScript, ...p.args], {
      cwd: p.emptyCwd ? emptyDir : baseCwd,
      timeout: PROBE_TIMEOUT_MS,
      killSignal: 'SIGKILL',
    });
    const timedOut = r.signal === 'SIGKILL';
    probes.push({ name: p.name, code: r.ok ? 0 : r.code, timedOut });
  }
  const stub = probes.every((p) => p.code === 0 && !p.timedOut);
  return { stub, probes };
}

/** 판정기 자기검사 — 합성 스텁은 STUB, 합성 실검증기는 non-STUB 으로 판정되어야 한다. */
function selfTestStubDetector(report, python) {
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'glowmate-f6-selftest-'));
  const emptyDir = path.join(tmp, 'empty');
  try {
    writeFileSync(path.join(tmp, 'validate_dselftest_stub.py'), 'import sys\nsys.exit(0)\n');
    writeFileSync(
      path.join(tmp, 'validate_dselftest_real.py'),
      [
        'import sys, os',
        'args = sys.argv[1:]',
        "if not args or '__glowmate_nonexistent_check__' in args:",
        '    sys.exit(2)',
        "if not os.path.exists('evidence.json'):",
        '    sys.exit(1)',
        'sys.exit(0)',
      ].join('\n') + '\n',
    );
    mkdirSync(emptyDir, { recursive: true });

    const stubRes = probeValidator(python, path.join(tmp, 'validate_dselftest_stub.py'), emptyDir, tmp);
    const realRes = probeValidator(python, path.join(tmp, 'validate_dselftest_real.py'), emptyDir, tmp);

    if (!stubRes.stub) {
      report.fail(
        RULE,
        '(b) 자기검사 실패 — 항상 exit 0 인 합성 스텁을 스텁으로 판정하지 못했다. 판정기가 무력화된 상태다',
        JSON.stringify(stubRes.probes),
      );
      return false;
    }
    if (realRes.stub) {
      report.fail(
        RULE,
        '(b) 자기검사 실패 — 결손 입력에 non-zero 를 내는 합성 실검증기를 스텁으로 오판했다',
        JSON.stringify(realRes.probes),
      );
      return false;
    }
    report.pass(
      RULE,
      `(b) 판정기 자기검사 통과 — 합성 스텁=STUB, 합성 실검증기=OK (프로브 ${PROBES.length}종: ${PROBES.map((p) => p.name).join(', ')})`,
    );
    return true;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/* ── (a) 존재 요구 ───────────────────────────────────────────────────────── */

function requiredValidatorsFromMergedContracts(root, baseRef) {
  const merged = mergedContractIds(root, baseRef);
  if (!merged.ok) return { ok: false, reason: merged.reason };
  const required = new Map(); // relPath -> contract ids
  const missingDocs = [];
  for (const id of merged.ids) {
    const doc = path.join(root, 'docs', 'tasks', `${id.replace(/-.*$/, '')}.md`);
    const docExact = path.join(root, 'docs', 'tasks', `${id}.md`);
    const file = existsSync(docExact) ? docExact : existsSync(doc) ? doc : null;
    if (!file) {
      missingDocs.push(id);
      continue;
    }
    const text = readFileSync(file, 'utf8');
    const re = /scripts\/discovery\/validate_d[\w-]*\.py/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const rel = m[0];
      if (!required.has(rel)) required.set(rel, new Set());
      required.get(rel).add(id);
    }
  }
  return { ok: true, required, mergedIds: merged.ids, commits: merged.commits, missingDocs };
}

/* ── 실행 ────────────────────────────────────────────────────────────────── */

const report = new Report('discovery (FORBID-6)');
const root = repoRoot();
const base = resolveBase(root);

report.info(
  RULE,
  `context=${IS_CI ? 'CI' : 'local'} base=${base.ok ? base.ref : `unresolved(${base.reason})`}`,
);

// ── (a) 존재 요구 — (b)와 완전히 독립적으로 실행된다 ─────────────────────
await guard(report, RULE, '(a) 존재 요구', async () => {
  if (!base.ok) {
    report.skip(RULE, '(a) 머지된 Discovery 계약의 검증기 존재 요구 미검증', base.reason);
    return;
  }
  const res = requiredValidatorsFromMergedContracts(root, base.ref);
  if (!res.ok) {
    report.fail(RULE, '(a) 머지된 계약 목록을 산출할 수 없다 — 판정 불가는 통과가 아니다', res.reason);
    return;
  }
  report.info(
    RULE,
    `(a) 판정 원천: ${base.ref} 의 .github/pr-task 이력 커밋 ${res.commits}건 → 머지된 계약 ${res.mergedIds.length}건 ${fmtSet(res.mergedIds)}`,
  );
  if (res.missingDocs.length > 0) {
    report.fail(
      RULE,
      `(a) 머지 기록은 있으나 계약 문서를 찾을 수 없는 ID: ${fmtSet(res.missingDocs)} — 요구 검증기 집합을 확정할 수 없다`,
    );
  }
  if (res.required.size === 0) {
    report.pass(
      RULE,
      '(a) 대상 0건 — 머지된 Discovery 계약이 아직 없다 (F1 머지 시점의 계약 명시 정상 상태). 탐지력은 REQ-5 픽스처 ⑦로 별도 입증된다',
    );
    return;
  }
  for (const [rel, ids] of res.required) {
    if (existsSync(path.join(root, rel))) {
      report.pass(RULE, `(a) ${rel} 존재 (요구 계약: ${fmtSet(ids)})`);
    } else {
      report.fail(
        RULE,
        `(a) 머지된 계약 ${fmtSet(ids)} 가 선언한 ${rel} 가 리포에 없다 — 없는 검증기를 도는 discovery job 은 영구 초록이다`,
      );
    }
  }
});

// ── (b) 비스텁 요구 — (a)의 결과와 무관하게 항상 실행된다 ────────────────
await guard(report, RULE, '(b) 비스텁 요구', async () => {
  const { dirExists, scripts } = listValidators(root);
  report.info(
    RULE,
    `(b) ${DISCOVERY_DIR} ${dirExists ? '존재' : '부재'} — 검사 대상 validate_d*.py ${scripts.length}건 ${fmtSet(scripts)}`,
  );

  const python = pythonBin();
  if (!python) {
    if (IS_CI) {
      report.fail(RULE, '(b) python 실행 파일이 없어 스텁 판정을 수행할 수 없다 — 판정 불가는 통과가 아니다');
    } else {
      report.skip(RULE, '(b) 스텁 판정 및 판정기 자기검사 미수행', 'python3/python 실행 파일이 없다');
    }
    return;
  }

  // 대상이 0건이어도 판정기 자체는 매 실행마다 검증한다 (0건 자동 통과 방지).
  const selfOk = selfTestStubDetector(report, python);
  if (!selfOk) return;

  if (scripts.length === 0) {
    report.pass(
      RULE,
      '(b) 대상 0건 — 리포에 validate_d*.py 가 없다 (F1 머지 시점의 계약 명시 정상 상태). 판정기 자기검사는 위에서 통과했다',
    );
    return;
  }

  const tmp = mkdtempSync(path.join(os.tmpdir(), 'glowmate-f6-empty-'));
  try {
    for (const rel of scripts) {
      const abs = path.join(root, rel);
      const res = probeValidator(python, abs, tmp, root);
      const detail = res.probes
        .map((p) => `${p.name}: exit=${p.code}${p.timedOut ? ' (timeout)' : ''}`)
        .join('\n');
      if (res.stub) {
        report.fail(
          RULE,
          `(b) ${rel} 는 인자·입력과 무관하게 항상 exit 0 이다 (스텁) — 스텁 상태를 discovery job 성공으로 처리하지 않는다`,
          detail,
        );
      } else {
        report.pass(RULE, `(b) ${rel} 비스텁 확인 (결손 입력에서 non-zero 반환)`, detail);
      }
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

process.exit(report.print());
