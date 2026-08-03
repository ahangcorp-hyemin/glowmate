#!/usr/bin/env node
// tools/ci-meta/discovery-checks.mjs — `pnpm test:discovery-checks`
//
// **Discovery·DS 계약의 acceptance 를 실제로 실행하는 CI 경로.**
//
// 존재 이유: D1a·D2·D3·DS0 네 계약의 REQ acceptance 는 전부
// "CI job `discovery` 에서 `--check X` exit 0" 인데, `discovery` job 은 `pnpm test:discovery`
// (= FORBID-6 의 (a)존재·(b)비스텁 판정)만 돌렸고 **`--check`/`--all` 을 아무도 실행하지 않았다.**
// 검증기가 리포에 있어도 CI 가 돌리지 않으면 그 계약의 on_violation:block_merge 는
// 집행 주체가 없는 선언에 그친다 — CLAUDE.md 가 지목한 "탐지 허구"다.
//
// 역할 분담:
//   · `discovery.mjs`       — 검증기가 **있는가 / 스텁이 아닌가** (FORBID-6)
//   · `discovery-checks.mjs`— 검증기를 **실제로 돌려 통과하는가** (각 계약의 REQ acceptance)
// 둘은 같은 job 에서 순서대로 실행되며 어느 쪽이 non-zero 여도 job 이 red 다.
//
// 판정 원칙 (lib/util.mjs 참조): 판정 불가 ≠ 통과. 조용한 catch·기본값 금지.
// 실패 출력은 규칙 ID 토큰 `FORBID-6` 을 포함한다 (REQ-5 픽스처 ⑦ 귀속 검증이 이 문자열에 의존).

import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { Report, repoRoot, exec, fmtSet } from './lib/util.mjs';

const RULE = 'FORBID-6';

/** 검증기를 돌릴 때 넘기는 인자. 각 계약 acceptance 가 지정한 전수 실행 모드다. */
const RUN_ARGS = ['--all'];

/**
 * 검증기 1건당 상한. `.github/ci-budget.json` 의 discovery 예산(4분)을 지키기 위한 값이며,
 * 초과는 **실패**로 처리한다 (timeout 을 통과로 처리하면 무한 루프 검증기가 영구 초록이 된다).
 */
const TIMEOUT_MS = 90_000;

/** 실패 출력에 붙이는 로그 꼬리 길이 (전량 삼키지 않되 로그를 잠기게 하지도 않는다) */
const TAIL_LINES = 40;

/**
 * 검증기 계열. 리포에 **존재하는 전부**를 돌린다 — 목록을 손으로 관리하면
 * 하류가 검증기를 추가하고 여기 등재하지 않는 순간 다시 탐지 허구가 된다.
 */
const FAMILIES = [
  {
    label: 'Discovery 증거 검증기',
    dir: 'scripts/discovery',
    fileRe: /^validate_d[\w-]*\.py$/,
    runner: 'python',
  },
  {
    label: 'Design System 검증기',
    dir: 'scripts/design-system',
    fileRe: /^validate_ds[\w-]*\.mjs$/,
    runner: 'node',
  },
];

function pythonBin() {
  for (const bin of ['python3', 'python']) {
    const r = exec(bin, ['--version']);
    if (r.ok || (!r.missing && r.code !== null)) return bin;
  }
  return null;
}

function tail(text) {
  const lines = String(text ?? '').split('\n').filter((l) => l.length > 0);
  if (lines.length <= TAIL_LINES) return lines.join('\n');
  return [`… (앞 ${lines.length - TAIL_LINES}줄 생략)`, ...lines.slice(-TAIL_LINES)].join('\n');
}

/** 계열별로 리포에 존재하는 검증기 상대경로를 산출한다. */
function discover(root) {
  const found = [];
  for (const fam of FAMILIES) {
    const abs = path.join(root, fam.dir);
    if (!existsSync(abs)) {
      report.info(RULE, `${fam.dir} 부재 — ${fam.label} 0건`);
      continue;
    }
    const files = readdirSync(abs)
      .filter((f) => fam.fileRe.test(f))
      .sort();
    report.info(
      RULE,
      `${fam.dir} — ${fam.label} ${files.length}건 ${fmtSet(files)} (패턴 ${fam.fileRe})`,
    );
    for (const f of files) found.push({ fam, rel: `${fam.dir}/${f}` });
  }
  return found;
}

const report = new Report('discovery-checks (Discovery·DS 검증기 실행)');
const root = repoRoot();

const targets = discover(root);

if (targets.length === 0) {
  // ★ 0건 처리 — 명시 출력 후 통과.
  //   F1 머지 시점에는 실제로 0건이며, "검사 대상 0건" 을 조용히 통과시키지 않기 위해
  //   그 사실 자체를 로그에 남긴다. 이 상태에서의 탐지력은 별도 수단이 담보한다:
  //   (1) FORBID-6 (a) 존재 요구 — 머지된 계약이 선언한 검증기가 없으면 discovery.mjs 가 red,
  //   (2) REQ-5 픽스처 ⑦ — 항상 exit 0 인 스텁이 discovery job 만 red 로 만드는지 실제 런으로 입증.
  report.pass(
    RULE,
    '검증기 0건이라 통과 — 리포에 실행 대상 검증기가 없다 ' +
      `(탐색 경로: ${fmtSet(FAMILIES.map((f) => `${f.dir}/${f.fileRe.source}`))}). ` +
      '이 상태의 탐지력은 FORBID-6 (a) 존재 요구와 REQ-5 픽스처 ⑦ 가 별도로 입증한다',
  );
  process.exit(report.print());
}

const needsPython = targets.some((t) => t.fam.runner === 'python');
const python = needsPython ? pythonBin() : null;
if (needsPython && !python) {
  report.fail(
    RULE,
    'python 실행 파일(python3/python)이 없어 Discovery 검증기를 실행할 수 없다 — 판정 불가는 통과가 아니다',
    `대상: ${fmtSet(targets.filter((t) => t.fam.runner === 'python').map((t) => t.rel))}`,
  );
  process.exit(report.print());
}

const started = Date.now();
const failures = [];

for (const { fam, rel } of targets) {
  const bin = fam.runner === 'python' ? python : process.execPath;
  const cmd = `${fam.runner === 'python' ? python : 'node'} ${rel} ${RUN_ARGS.join(' ')}`;
  const t0 = Date.now();
  const r = exec(bin, [path.join(root, rel), ...RUN_ARGS], {
    cwd: root,
    timeout: TIMEOUT_MS,
    killSignal: 'SIGKILL',
    env: { ...process.env, PYTHONUNBUFFERED: '1' },
  });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);

  if (r.ok) {
    report.pass(RULE, `${rel} — \`${cmd}\` exit 0 (${secs}s)`, tail(r.stdout));
    continue;
  }

  const timedOut = r.signal === 'SIGKILL';
  const codeText = timedOut
    ? `타임아웃 ${TIMEOUT_MS / 1000}s 초과 (SIGKILL)`
    : `exit ${r.code === null ? '알 수 없음' : r.code}`;
  failures.push({ rel, codeText });
  report.fail(
    RULE,
    r.missing
      ? `${rel} — 실행기 \`${fam.runner}\` 를 찾을 수 없어 검증기를 돌리지 못했다 (판정 불가는 통과가 아니다)`
      : `${rel} — \`${cmd}\` 가 ${codeText} 로 종료했다 (${secs}s). ` +
        '이 검증기를 선언한 계약의 acceptance 가 충족되지 않았다',
    [tail(r.stdout), tail(r.stderr)].filter(Boolean).join('\n'),
  );
}

report.info(
  RULE,
  `검증기 ${targets.length}건 실행 완료 · 총 ${((Date.now() - started) / 1000).toFixed(1)}s ` +
    `(검증기당 상한 ${TIMEOUT_MS / 1000}s)`,
);

if (failures.length > 0) {
  report.fail(
    RULE,
    `검증기 ${failures.length}/${targets.length}건 실패 — ` +
      failures.map((f) => `${f.rel}(${f.codeText})`).join(', '),
  );
}

process.exit(report.print());
