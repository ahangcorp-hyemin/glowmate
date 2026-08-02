// tools/ci-meta/checks/forbid2-masking.mjs
//
// FORBID-2 — 종료 코드 마스킹 / 검사 대상 축소 구성의 신규 도입 사전 차단
//
// 판정 기준은 열거가 아니라 성질이며, 패턴 사전은 `../forbid2-patterns.mjs` 에만 둔다
// (그 파일이 계약이 말하는 "검사기의 패턴 정의 파일" = 스캔 제외 대상이다).
//
// 계약 명시 제외 2종:
//   ① `.github/ci-fixtures/**` + 패턴 정의 파일 자신
//   ② job 이름이 정확히 `ci-required` 인 단 하나의 job 의 `if:` 조건
//      (검사 job 8개의 `if:`·`continue-on-error` 는 그대로 대상이다)

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { addedLinesByFile, listTree, listWorkingFiles, showBlob } from '../lib/git.mjs';
import { Workflow, listWorkflowFiles } from '../lib/workflow.mjs';
import { fmtSet, exec } from '../lib/util.mjs';
import {
  parseCodeowners,
  approvingReviewers,
  hasCodeownerApproval,
} from '../lib/codeowners.mjs';
import { currentPullAuthor, currentPullNumber } from '../lib/github.mjs';
import { AGGREGATOR_JOB } from '../fixture-rules.mjs';
import {
  FORBID2_EXCLUDED_PREFIXES,
  SELF_EXCLUDED_PATHS,
  FORBID2_LINE_PATTERNS,
  FORBID2_WORKFLOW_IF_PATTERNS,
  TRAILING_EXIT_ZERO_RE,
  DISABLE_DIRECTIVE_RE,
  DISABLE_REASON_RE,
  TEST_FILE_MATCHERS,
  TEST_DECL_PATTERNS,
  PROSE_EXTENSIONS,
  TOKEN_CONTINUE_ON_ERROR,
} from '../forbid2-patterns.mjs';

const RULE = 'FORBID-2';

export function isExcludedPath(rel) {
  if (SELF_EXCLUDED_PATHS.includes(rel)) return true;
  return FORBID2_EXCLUDED_PREFIXES.some((p) => rel.startsWith(p));
}

/** 비실행 산문 파일은 "구성"이 아니므로 패턴 스캔 대상이 아니다 (근거는 패턴 정의 파일 주석). */
export function isProseFile(rel) {
  const lower = rel.toLowerCase();
  return PROSE_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/** 워크플로 파일에서 `ci-required` job 의 `if:` 가 차지하는 라인 범위 (제외 ②) */
function aggregatorIfLineRange(root, rel) {
  try {
    const wf = new Workflow(root, rel);
    if (!wf.job(AGGREGATOR_JOB)) return null;
    return wf.jobFieldLineRange(AGGREGATOR_JOB, 'if');
  } catch {
    // 파싱 불가는 제외 근거가 될 수 없다 — 제외 없음으로 처리하고 스캔을 계속한다.
    return null;
  }
}

/** base 대비 추가된 라인 (untracked 신규 파일은 전량 추가로 간주) */
function collectAddedLines(root, baseSha) {
  const map = addedLinesByFile(root, baseSha);
  const untracked = exec('git', ['ls-files', '--others', '--exclude-standard'], { cwd: root });
  if (untracked.ok) {
    for (const rel of untracked.stdout.split('\n').filter(Boolean)) {
      if (map.has(rel)) continue;
      const abs = path.join(root, rel);
      if (!existsSync(abs)) continue;
      let text;
      try {
        text = readFileSync(abs, 'utf8');
      } catch {
        continue; // 바이너리 등
      }
      map.set(
        rel,
        text.split('\n').map((t, i) => ({ line: i + 1, text: t })),
      );
    }
  }
  return map;
}

function isTestFile(rel) {
  for (const m of TEST_FILE_MATCHERS) if (m.re.test(rel)) return m.lang;
  return null;
}

function countDecls(lang, text) {
  const re = new RegExp(TEST_DECL_PATTERNS[lang].source, TEST_DECL_PATTERNS[lang].flags);
  let n = 0;
  while (re.exec(text) !== null) n += 1;
  return n;
}

/** 테스트 선언 총수 (정적 수집) */
function collectTestCount(files, readFn) {
  let total = 0;
  const perFile = new Map();
  for (const rel of files) {
    if (isExcludedPath(rel)) continue;
    const lang = isTestFile(rel);
    if (!lang) continue;
    const text = readFn(rel);
    if (text == null) continue;
    const n = countDecls(lang, text);
    total += n;
    perFile.set(rel, n);
  }
  return { total, perFile };
}

/** ci.yml 의 ci-required.needs 집합 (임의 리비전의 텍스트에서) */
function needsFromText(text) {
  if (text == null) return null;
  let data;
  try {
    data = YAML.parse(text);
  } catch {
    return null;
  }
  const job = data?.jobs?.[AGGREGATOR_JOB];
  if (!job) return null;
  const needs = job.needs;
  if (needs == null) return new Set();
  return new Set(Array.isArray(needs) ? needs.map(String) : [String(needs)]);
}

export async function checkForbid2(report, ctx) {
  const { root, base } = ctx;

  if (!base.ok) {
    report.skip(RULE, 'diff 스캔 미수행 (마스킹 패턴 사전 검사)', base.reason);
  } else {
    await scanDiff(report, ctx);
    scanRequiredCheckExclusion(report, ctx);
    scanTestCountRegression(report, ctx);
  }

  // 워크플로 전수: 검사 job 의 continue-on-error 는 diff 여부와 무관하게 현 상태로도 위반이다.
  scanWorkflowStateWide(report, root);
}

async function scanDiff(report, ctx) {
  const { root, base } = ctx;
  const added = collectAddedLines(root, base.mergeBase);
  const workflowFiles = new Set(listWorkflowFiles(root));
  const aggregatorIfRanges = new Map();
  for (const rel of workflowFiles) aggregatorIfRanges.set(rel, aggregatorIfLineRange(root, rel));

  const findings = [];
  const disablesWithReason = [];
  let scannedFiles = 0;
  let proseSkipped = 0;

  for (const [rel, lines] of added) {
    if (isExcludedPath(rel)) continue;
    if (isProseFile(rel)) {
      proseSkipped += 1;
      continue;
    }
    scannedFiles += 1;
    const isWorkflow = workflowFiles.has(rel);
    const aggIf = aggregatorIfRanges.get(rel) ?? null;

    for (const { line, text } of lines) {
      const inAggregatorIf =
        isWorkflow && aggIf != null && line >= aggIf[0] && line <= aggIf[1];

      for (const p of FORBID2_LINE_PATTERNS) {
        if (p.re.test(text)) {
          findings.push({ rel, line, text, id: p.id, why: p.why });
        }
      }

      if (isWorkflow) {
        for (const p of FORBID2_WORKFLOW_IF_PATTERNS) {
          if (!p.re.test(text)) continue;
          if (inAggregatorIf) {
            report.info(
              RULE,
              `제외② 적용: ${rel}:${line} 은 애그리게이터 \`${AGGREGATOR_JOB}\` 의 if: 조건이다 (REQ-6 실패 전파 요구를 만족시키는 수단)`,
            );
            continue;
          }
          findings.push({ rel, line, text, id: p.id, why: p.why });
        }
      }

      if (DISABLE_DIRECTIVE_RE.test(text)) {
        if (DISABLE_REASON_RE.test(text)) {
          disablesWithReason.push({ rel, line, text });
        } else {
          findings.push({
            rel,
            line,
            text,
            id: 'disable-without-reason',
            why: '사유 주석(`-- reason: <이슈 URL>`) 없는 disable 지시자 = 검사 대상 축소',
          });
        }
      }
    }

    // 스크립트 말미 `exit 0`
    const trailing = trailingExitZeroLines(root, rel);
    for (const ln of trailing) {
      if (lines.some((l) => l.line === ln)) {
        findings.push({
          rel,
          line: ln,
          text: 'exit 0',
          id: 'trailing-exit-zero',
          why: '스크립트 말미 exit 0 = 앞선 실패를 성공으로 종료',
        });
      }
    }
  }

  report.info(
    RULE,
    `diff 스캔 대상 파일 ${scannedFiles}건 (base=${ctx.base.ref} ${ctx.base.mergeBase.slice(0, 8)}) · 비실행 산문 파일 ${proseSkipped}건 제외`,
  );
  if (scannedFiles === 0 && proseSkipped === 0) {
    report.fail(
      RULE,
      'diff 에서 스캔 가능한 변경 파일이 0건이다 — 검사 대상 0건을 통과로 처리하지 않는다 (base 해석 또는 diff 산출이 잘못됐을 가능성)',
    );
  }

  for (const f of findings) {
    report.fail(
      RULE,
      `${f.rel}:${f.line} 마스킹/대상축소 패턴 \`${f.id}\` — ${f.why}`,
      f.text.trim().slice(0, 200),
    );
  }
  if (findings.length === 0) {
    report.pass(RULE, `추가된 라인에서 마스킹/대상축소 패턴 0건 (패턴 ${FORBID2_LINE_PATTERNS.length + FORBID2_WORKFLOW_IF_PATTERNS.length + 2}종)`);
  }

  // 사유 주석이 있는 disable 은 "해당 경로 CODEOWNERS 승인 리뷰"까지 있어야 허용된다.
  if (disablesWithReason.length > 0) {
    await requireApprovalForDisables(report, ctx, disablesWithReason);
  }
}

function trailingExitZeroLines(root, rel) {
  const out = [];
  const abs = path.join(root, rel);
  if (!existsSync(abs)) return out;
  if (!/\.(sh|bash|zsh)$/.test(rel) && !/^\.github\/workflows\//.test(rel)) return out;
  let text;
  try {
    text = readFileSync(abs, 'utf8');
  } catch {
    return out;
  }
  const lines = text.split('\n');
  if (/\.(sh|bash|zsh)$/.test(rel)) {
    for (let i = lines.length - 1; i >= 0; i -= 1) {
      const t = lines[i].trim();
      if (!t) continue;
      if (TRAILING_EXIT_ZERO_RE.test(lines[i])) out.push(i + 1);
      break;
    }
    return out;
  }
  // 워크플로: 각 run 블록의 마지막 비공백 라인
  let inRun = false;
  let indent = 0;
  let lastNonEmpty = -1;
  const flush = () => {
    if (inRun && lastNonEmpty >= 0 && TRAILING_EXIT_ZERO_RE.test(lines[lastNonEmpty])) {
      out.push(lastNonEmpty + 1);
    }
    inRun = false;
    lastNonEmpty = -1;
  };
  for (let i = 0; i < lines.length; i += 1) {
    const l = lines[i];
    const m = /^(\s*)-?\s*run\s*:\s*[|>][-+]?\s*$/.exec(l);
    if (m) {
      flush();
      inRun = true;
      indent = m[1].length;
      continue;
    }
    if (inRun) {
      if (l.trim() === '') continue;
      const curIndent = l.length - l.trimStart().length;
      if (curIndent <= indent) {
        flush();
        continue;
      }
      lastNonEmpty = i;
    }
  }
  flush();
  return out;
}

async function requireApprovalForDisables(report, ctx, disables) {
  const { root, gh } = ctx;
  const { exists, rules } = parseCodeowners(root);
  if (!exists) {
    report.fail(
      RULE,
      `사유 주석이 있는 disable ${disables.length}건이 있으나 ${'.github/CODEOWNERS'} 가 없어 승인 요건을 판정할 수 없다`,
    );
    return;
  }
  if (!gh.available) {
    report.skip(
      RULE,
      `사유 주석 있는 disable ${disables.length}건의 CODEOWNERS 승인 리뷰 미검증: ${disables.map((d) => `${d.rel}:${d.line}`).join(', ')}`,
      gh.reason,
    );
    return;
  }
  const author = currentPullAuthor();
  const pr = currentPullNumber();
  const rev = await approvingReviewers(gh.client, pr, author);
  if (!rev.ok) {
    report.fail(RULE, `승인 리뷰를 조회할 수 없어 disable 허용 여부를 판정할 수 없다`, rev.reason);
    return;
  }
  for (const d of disables) {
    const res = await hasCodeownerApproval(gh.client, rules, d.rel, rev.approvers);
    if (res.unresolved.length > 0) {
      report.fail(
        RULE,
        `${d.rel}:${d.line} disable 의 소유자 팀 멤버십을 확인할 수 없다 — 미판정을 허용으로 처리하지 않는다`,
        res.unresolved.join('\n'),
      );
      continue;
    }
    if (!res.approved) {
      report.fail(
        RULE,
        `${d.rel}:${d.line} 사유 주석은 있으나 해당 경로 CODEOWNERS 승인 리뷰(승인자 ≠ 작성자)가 없다 — 소유자 ${fmtSet(res.owners)} / 승인자 ${fmtSet(rev.approvers)}`,
      );
    } else {
      report.pass(RULE, `${d.rel}:${d.line} disable 허용 (사유 주석 + 소유자 승인 ${fmtSet(res.matched)})`);
    }
  }
}

/** "필수 체크에서 job 제외" — ci-required.needs 에서 job 이 빠지는 diff */
function scanRequiredCheckExclusion(report, ctx) {
  const { root, base } = ctx;
  const rel = '.github/workflows/ci.yml';
  const headText = existsSync(path.join(root, rel)) ? readFileSync(path.join(root, rel), 'utf8') : null;
  const baseText = showBlob(root, base.mergeBase, rel);
  const headNeeds = needsFromText(headText);
  const baseNeeds = needsFromText(baseText);

  if (baseNeeds == null) {
    report.info(RULE, `base 에 ${rel} 의 \`${AGGREGATOR_JOB}\` 이 없다 — 최초 도입 커밋이므로 needs 축소 비교 대상 아님`);
    return;
  }
  if (headNeeds == null) {
    report.fail(RULE, `base 에 있던 \`${AGGREGATOR_JOB}\` 이 현재 ${rel} 에서 사라졌다 — 필수 체크 제거`);
    return;
  }
  const removed = [...baseNeeds].filter((n) => !headNeeds.has(n));
  if (removed.length > 0) {
    report.fail(
      RULE,
      `\`${AGGREGATOR_JOB}.needs\` 에서 job 이 제외됐다: ${fmtSet(removed)} — 필수 체크에서 job 제외 = 검사 대상 축소`,
    );
  } else {
    report.pass(RULE, `\`${AGGREGATOR_JOB}.needs\` 에서 제외된 job 0건`);
  }
}

/** 테스트 수집 건수가 base 대비 감소하면 실패 */
function scanTestCountRegression(report, ctx) {
  const { root, base } = ctx;
  const baseFiles = listTree(root, base.mergeBase);
  const headFiles = listWorkingFiles(root);

  const baseCount = collectTestCount(baseFiles, (rel) => showBlob(root, base.mergeBase, rel));
  const headCount = collectTestCount(headFiles, (rel) => {
    const abs = path.join(root, rel);
    if (!existsSync(abs)) return null;
    try {
      return readFileSync(abs, 'utf8');
    } catch {
      return null;
    }
  });

  if (headCount.total < baseCount.total) {
    const dropped = [...baseCount.perFile.entries()]
      .filter(([rel, n]) => (headCount.perFile.get(rel) ?? 0) < n)
      .map(([rel, n]) => `${rel}: ${n} → ${headCount.perFile.get(rel) ?? 0}`);
    report.fail(
      RULE,
      `테스트 수집 건수가 base 대비 감소했다 (${baseCount.total} → ${headCount.total})`,
      dropped.join('\n'),
    );
  } else {
    report.pass(
      RULE,
      `테스트 수집 건수 비감소 확인 (base ${baseCount.total} → head ${headCount.total}, 테스트 파일 ${headCount.perFile.size}건)`,
    );
  }
}

/**
 * diff 와 무관하게 현재 워크플로 상태에서 검사 job 의 continue-on-error 를 잡는다.
 * (계약 제외 ②는 `ci-required` 의 `if:` 뿐이며, continue-on-error 는 어느 job 이든 대상이다.)
 */
function scanWorkflowStateWide(report, root) {
  for (const rel of listWorkflowFiles(root)) {
    let wf;
    try {
      wf = new Workflow(root, rel);
    } catch (err) {
      report.fail(RULE, `${rel} 파싱 실패로 마스킹 구성을 판정할 수 없다`, err.message);
      continue;
    }
    for (const name of wf.jobNames) {
      const job = wf.job(name);
      if (job?.[TOKEN_CONTINUE_ON_ERROR] === true) {
        report.fail(
          RULE,
          `${rel} job \`${name}\` 에 ${TOKEN_CONTINUE_ON_ERROR}=true — job 실패가 마스킹된다`,
        );
      }
      const steps = Array.isArray(job?.steps) ? job.steps : [];
      steps.forEach((s, i) => {
        if (s?.[TOKEN_CONTINUE_ON_ERROR] === true) {
          report.fail(
            RULE,
            `${rel} job \`${name}\` step[${i}]${s.name ? ` (${s.name})` : ''} 에 ${TOKEN_CONTINUE_ON_ERROR}=true — 스텝 실패가 마스킹된다`,
          );
        }
      });
    }
  }
}
