#!/usr/bin/env node
/* global process, console */
/**
 * DS0-SEED-DUE-DILIGENCE 산출물 검증기.
 *
 *   node scripts/design-system/validate_ds0.mjs --all
 *   node scripts/design-system/validate_ds0.mjs --check <name> [--root <dir>]
 *   node scripts/design-system/validate_ds0.mjs --selftest
 *
 * 서브커맨드 ↔ 계약 대응
 *   --check rule-lock    REQ-1 · FORBID-5
 *   --check license      REQ-2 · FORBID-4
 *   --check ssr          REQ-3
 *   --check coverage     REQ-4
 *   --check tokens       REQ-5
 *   --check verdict      REQ-6 · FORBID-1
 *   --check appendix     REQ-7
 *   --check evidence     FORBID-2
 *   --check no-vendored  FORBID-3
 *   --selftest           위 검사들이 **의도적 위반 픽스처에서 실제로 non-zero 인지** 확인한다.
 *                        검사기가 존재하는 것과 위반을 잡는 것은 다른 문제이므로 매 실행마다 증명한다.
 *
 * 설계 원칙
 *   1. 판정 불가는 통과가 아니다. 파일 부재·파싱 실패·git 정보 부재는 전부 exit 1 이다.
 *   2. 검사 대상 0건은 통과가 아니다. 근거 0건·행 0건은 실패로 판정한다.
 *   3. 기재값을 믿지 않는다. 수치는 원본 로그·CSV·JSON 에서 **다시 계산**해 대조한다.
 *   4. 임계값을 하드코딩하지 않는다. 전부 verdict_rule.md 의 잠긴 룰 블록에서 읽는다.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..', '..');
const DEFAULT_ROOT = path.join(REPO_ROOT, 'docs', 'design-system', 'DS0');
const FIXTURES_REL = 'docs/design-system/DS0/__fixtures__';

/** rule.lock 이 커밋 시각으로 앞서야 하는 실측 산출물 (구조적 불변식이므로 검사기가 직접 안다) */
const MEASUREMENT_ARTIFACTS = [
  'probe/logs/build.log',
  'probe/logs/console.log',
  'probe/logs/nojs.html',
  'coverage.csv',
  'extracted_tokens.json',
];

// ───────────────────────────── 유틸 ─────────────────────────────

class CheckError extends Error {}

function fail(msg) {
  throw new CheckError(msg);
}

function rel(root, p) {
  return path.relative(root, p).split(path.sep).join('/');
}

function abs(root, relPath) {
  return path.join(root, relPath);
}

function mustRead(root, relPath, what) {
  const p = abs(root, relPath);
  if (!existsSync(p)) fail(`${what}: \`${relPath}\` 가 없다 (root: ${root}). 판정 불가는 통과가 아니다.`);
  return readFileSync(p, 'utf8');
}

function sha256File(p) {
  return createHash('sha256').update(readFileSync(p)).digest('hex');
}

function sha256Text(s) {
  return createHash('sha256').update(s).digest('hex');
}

/** `<!-- MARK-BEGIN -->` ~ `<!-- MARK-END -->` 사이의 펜스 블록 본문 */
function fencedBlock(text, mark, lang) {
  const re = new RegExp(
    `<!--\\s*${mark}-BEGIN\\s*-->\\s*\`\`\`${lang}\\n([\\s\\S]*?)\`\`\`\\s*<!--\\s*${mark}-END\\s*-->`,
  );
  const m = text.match(re);
  if (!m) fail(`\`${mark}\` 블록을 찾지 못했다 (형식: <!-- ${mark}-BEGIN --> \`\`\`${lang} … \`\`\` <!-- ${mark}-END -->).`);
  return m[1];
}

function parseJsonBlock(text, mark) {
  const raw = fencedBlock(text, mark, 'json');
  try {
    return JSON.parse(raw);
  } catch (err) {
    fail(`\`${mark}\` 블록이 유효한 JSON 이 아니다: ${err.message}`);
  }
}

/** rule.lock 의 `key: value` 파싱 */
function parseLock(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (t === '' || t.startsWith('#')) continue;
    const i = t.indexOf(':');
    if (i < 0) fail(`rule.lock 의 파싱 불가 라인: ${JSON.stringify(line)}`);
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

/** 최소 CSV 파서 (따옴표 필드 지원) */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ',') { row.push(field); field = ''; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    if (c === '\r') continue;
    field += c;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
}

/** git 이 그 경로를 **처음 추가한** 커밋의 UNIX 시각. 확인 불가면 null */
function firstAddedAt(repoRelPath) {
  try {
    const out = execFileSync(
      'git',
      ['log', '--diff-filter=A', '--format=%ct', '--', repoRelPath],
      { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
    if (out === '') return null;
    const times = out.split(/\s+/).map(Number).filter((n) => Number.isFinite(n));
    return times.length ? Math.min(...times) : null;
  } catch {
    return null;
  }
}

function walkFiles(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.git' || e === '.next') continue;
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) walkFiles(p, acc);
    else acc.push(p);
  }
  return acc;
}

// ───────────────────── 잠긴 룰 로드 (임계의 유일한 원천) ─────────────────────

function loadRules(root) {
  const md = mustRead(root, 'verdict_rule.md', 'rule');
  const rules = parseJsonBlock(md, 'DS0-RULES');
  for (const axis of ['license', 'ssr_compat', 'coverage', 'token_extractability']) {
    if (!rules.axes?.[axis]?.rule_id) fail(`verdict_rule.md 룰 블록에 축 \`${axis}\` 의 rule_id 가 없다.`);
  }
  return { md, rules };
}

// ─────────────────────────── 개별 검사 ───────────────────────────

/** REQ-1 · FORBID-5 */
function checkRuleLock(root, log) {
  const { md, rules } = loadRules(root);
  const lockText = mustRead(root, 'rule.lock', 'rule-lock');
  const lock = parseLock(lockText);

  if (lock.file !== 'verdict_rule.md') fail(`rule.lock 의 file 이 \`verdict_rule.md\` 가 아니다: ${lock.file}`);
  if ((lock.algorithm ?? 'sha256') !== 'sha256') fail(`지원하지 않는 algorithm: ${lock.algorithm}`);
  const actual = sha256Text(md);
  if (!lock.sha256) fail('rule.lock 에 sha256 항목이 없다.');
  if (lock.sha256 !== actual) {
    fail(
      'FORBID-5 위반 — verdict_rule.md 가 잠금 이후 변경되었다.\n' +
        `  rule.lock : ${lock.sha256}\n  실제      : ${actual}\n` +
        '  판정 룰은 실측 이후 수정할 수 없다. 새 룰이 필요하면 rule_set_version 을 올린 새 파일과 새 lock 을 만들어라.',
    );
  }
  log(`sha256(verdict_rule.md) == rule.lock  (${actual.slice(0, 12)}…)`);

  // 4개 축 각각에 pass 기준 문장 + rule_id 가 산문으로 존재하는지
  const criteria = md.match(/\*\*pass 기준 문장:\*\*/g) ?? [];
  if (criteria.length < 4) fail(`verdict_rule.md 에 "pass 기준 문장" 이 ${criteria.length}건뿐이다 (4개 축 각각 필요).`);
  for (const [axis, spec] of Object.entries(rules.axes)) {
    if (!md.includes(spec.rule_id)) fail(`verdict_rule.md 산문에 축 \`${axis}\` 의 rule_id(${spec.rule_id})가 없다.`);
  }
  log(`4개 축 pass 기준 문장 + rule_id 확인 (${Object.values(rules.axes).map((a) => a.rule_id).join(', ')})`);

  // 커밋 순서: rule.lock ≤ 실측 산출물 최초 커밋
  const lockRepoRel = rel(REPO_ROOT, abs(root, 'rule.lock'));
  const lockAt = firstAddedAt(lockRepoRel);
  if (lockAt === null) {
    fail(
      `rule.lock 의 최초 커밋 시각을 git 에서 얻지 못했다 (${lockRepoRel}).\n` +
        '  아직 커밋되지 않았거나 git 이력이 없다. 순서를 확인할 수 없으면 통과가 아니다.',
    );
  }
  const missing = MEASUREMENT_ARTIFACTS.filter((a) => !existsSync(abs(root, a)));
  if (missing.length > 0) fail(`실측 산출물이 없다: ${missing.join(', ')} — 검사 대상 0건은 통과가 아니다.`);

  const times = [];
  for (const artifact of MEASUREMENT_ARTIFACTS) {
    const repoRel = rel(REPO_ROOT, abs(root, artifact));
    const at = firstAddedAt(repoRel);
    if (at === null) fail(`실측 산출물 \`${artifact}\` 의 최초 커밋 시각을 얻지 못했다 (${repoRel}). 커밋되지 않은 근거는 근거가 아니다.`);
    times.push({ artifact, at });
  }
  const earliest = times.reduce((a, b) => (b.at < a.at ? b : a));
  if (lockAt > earliest.at) {
    fail(
      'FORBID-5 위반 — rule.lock 이 실측 산출물보다 **뒤에** 커밋되었다.\n' +
        `  rule.lock            : ${new Date(lockAt * 1000).toISOString()}\n` +
        `  ${earliest.artifact.padEnd(21)}: ${new Date(earliest.at * 1000).toISOString()}\n` +
        '  판정 룰을 측정 뒤에 정하면 G5 는 측정 결과가 아니라 원하는 결론에 맞춘 숫자가 된다.',
    );
  }
  log(`커밋 순서 OK — rule.lock(${new Date(lockAt * 1000).toISOString()}) ≤ 최초 실측(${earliest.artifact} ${new Date(earliest.at * 1000).toISOString()})`);
}

/** REQ-2 · FORBID-4 */
function checkLicense(root, log) {
  const { rules } = loadRules(root);
  const md = mustRead(root, 'license.md', 'license');
  const lic = parseJsonBlock(md, 'DS0-LICENSE');

  if (!/^\d+\.\d+\.\d+$/.test(lic.package_version ?? '')) fail(`package_version 이 x.y.z 형식이 아니다: ${JSON.stringify(lic.package_version)}`);
  if (!/^[0-9a-f]{40}$/.test(lic.repo_commit_sha ?? '')) fail(`repo_commit_sha 가 40자 hex 가 아니다: ${JSON.stringify(lic.repo_commit_sha)}`);
  log(`package_version=${lic.package_version} · repo_commit_sha=${lic.repo_commit_sha.slice(0, 12)}…`);

  if (!Array.isArray(lic.snapshots) || lic.snapshots.length === 0) fail('license.md 의 snapshots 가 0건이다 — 원문 스냅샷 없이 라이선스를 판정할 수 없다.');
  for (const s of lic.snapshots) {
    if (!s.path) fail('snapshots 항목에 path 가 없다.');
    if (!/^[0-9a-f]{64}$/.test(s.sha256 ?? '')) fail(`snapshots[${s.path}] 의 sha256 이 64자 hex 가 아니다.`);
    if (!s.source) fail(`snapshots[${s.path}] 에 source(취득 URL 또는 버전)가 없다.`);
    const p = abs(root, s.path);
    if (!existsSync(p)) fail(`snapshots[${s.path}] 파일이 실재하지 않는다.`);
    const got = sha256File(p);
    if (got !== s.sha256) fail(`snapshots[${s.path}] sha256 불일치\n  기재: ${s.sha256}\n  실제: ${got}`);
  }
  log(`스냅샷 ${lic.snapshots.length}건 — 경로 실재 + sha256 재계산 일치`);

  const items = rules.axes.license.items;
  const enums = rules.axes.license.enum;
  const j = lic.judgments ?? {};
  for (const item of items) {
    const v = j[item];
    if (v === undefined || v === null || String(v).trim() === '') fail(`판정 항목 \`${item}\` 이 비어 있다.`);
    if (!enums.includes(v)) fail(`판정 항목 \`${item}\` 의 값 \`${v}\` 이 enum(${enums.join('|')}) 밖이다.`);
  }
  const extra = Object.keys(j).filter((k) => !items.includes(k));
  if (extra.length > 0) fail(`judgments 에 계약 밖 항목이 있다: ${extra.join(', ')}`);
  log(`3항목 판정 — ${items.map((i) => `${i}=${j[i]}`).join(' · ')}`);

  // FORBID-4
  const bad = items.filter((i) => j[i] === 'denied' || j[i] === 'unclear');
  const tokensExist = existsSync(abs(root, 'extracted_tokens.json'));
  if (bad.length > 0) {
    const reasons = [];
    if (lic.extraction_allowed === true) reasons.push('token_extraction 이 extraction_allowed=true 로 기록되어 있다');
    if (tokensExist) reasons.push('extracted_tokens.json 이 커밋되어 있다');
    if (reasons.length > 0) {
      fail(
        `FORBID-4 위반 — 라이선스 판정에 ${bad.map((b) => `${b}=${j[b]}`).join(', ')} 가 있는데 ${reasons.join(' 그리고 ')}.\n` +
          '  색·간격 같은 토큰 값도 저작물 범위에 들어갈 수 있다. 미확인 상태로 추출해 제품에 심으면 나중에 전부 교체해야 한다.',
      );
    }
    log(`denied|unclear 존재(${bad.join(', ')}) — extraction_allowed 미설정 · extracted_tokens.json 부재 확인`);
  } else {
    if (rules.axes.token_extractability.requires_extraction_allowed && lic.extraction_allowed !== true) {
      fail('3항목이 전부 allowed 인데 extraction_allowed 가 true 가 아니다 — token_extractability 축이 성립하지 않는다.');
    }
    log('3항목 전부 allowed → extraction_allowed=true 기록 가능 (FORBID-4 조건 미발동)');
  }
}

/** REQ-3 */
function checkSsr(root, log) {
  const { rules } = loadRules(root);
  const spec = rules.axes.ssr_compat;

  const buildLog = mustRead(root, 'probe/logs/build.log', 'ssr');
  const consoleLog = mustRead(root, 'probe/logs/console.log', 'ssr');
  const nojs = mustRead(root, 'probe/logs/nojs.html', 'ssr');
  log('로그 3종 존재 — probe/logs/{build.log, console.log, nojs.html}');

  const manifestRaw = mustRead(root, 'probe/manifest.json', 'ssr');
  let manifest;
  try { manifest = JSON.parse(manifestRaw); } catch (e) { fail(`probe/manifest.json 파싱 실패: ${e.message}`); }
  const comps = manifest.components;
  if (!Array.isArray(comps) || comps.length === 0) fail('probe/manifest.json 의 components 가 0건이다.');
  if (comps.length < spec.min_components) fail(`서버 컴포넌트 트리에 렌더한 컴포넌트가 ${comps.length}종이다 (기준 ${spec.min_components}종 이상).`);
  const labels = comps.map((c) => c.label);
  if (labels.some((l) => !l || String(l).trim() === '')) fail('probe/manifest.json 에 빈 label 이 있다.');
  if (new Set(labels).size !== labels.length) fail('probe/manifest.json 의 label 이 중복된다 — 노출 건수를 셀 수 없다.');
  log(`컴포넌트 ${comps.length}종 (기준 ${spec.min_components}) · 라벨 고유`);

  // ── 로그에서 다시 계산 ──
  const exitMatches = [...buildLog.matchAll(/DS0_PROBE_BUILD_EXIT=(\d+)/g)];
  if (exitMatches.length === 0) fail('build.log 에 `DS0_PROBE_BUILD_EXIT=<n>` 라인이 없다 — 빌드 종료 코드를 확인할 수 없다.');
  const buildExit = Number(exitMatches[exitMatches.length - 1][1]);

  const patterns = spec.hydration_patterns;
  if (!Array.isArray(patterns) || patterns.length === 0) fail('잠긴 룰에 hydration_patterns 가 없다.');
  const hydration = consoleLog
    .split(/\r?\n/)
    .filter((line) => patterns.some((p) => line.toLowerCase().includes(String(p).toLowerCase()))).length;

  const hits = labels.filter((l) => nojs.includes(l)).length;

  const recorded = parseJsonBlock(mustRead(root, 'ssr_probe.md', 'ssr'), 'DS0-SSR-NUMBERS');
  const expect = {
    component_count: comps.length,
    build_exit_code: buildExit,
    hydration_mismatch_warnings: hydration,
    js_disabled_label_hits: hits,
  };
  for (const [k, v] of Object.entries(expect)) {
    if (recorded[k] !== v) {
      fail(
        `ssr_probe.md 의 \`${k}\` 가 로그 재파싱 결과와 다르다.\n  기재: ${JSON.stringify(recorded[k])}\n  실측: ${v}\n` +
          '  요약값은 근거가 아니다. 로그를 다시 만들었다면 문서 수치도 갱신하라.',
      );
    }
  }
  log(`재파싱 일치 — build_exit=${buildExit} · hydration=${hydration} · label_hits=${hits}/${comps.length}`);
}

/** REQ-4 */
function checkCoverage(root, log) {
  const { rules } = loadRules(root);
  const spec = rules.axes.coverage;

  const rows = parseCsv(mustRead(root, 'coverage.csv', 'coverage'));
  if (rows.length === 0) fail('coverage.csv 가 비어 있다.');
  const header = rows[0].map((c) => c.trim());
  const want = ['component', 'present', 'evidence_ref'];
  if (header.length !== 3 || want.some((w, i) => header[i] !== w)) {
    fail(`coverage.csv 헤더가 \`${want.join(',')}\` 이 아니다: ${header.join(',')}`);
  }
  const data = rows.slice(1);
  const required = spec.required_components;
  if (data.length !== required.length) fail(`coverage.csv 데이터 행수가 ${data.length} 이다 (기준 ${required.length}행).`);

  const seen = [];
  for (const [i, r] of data.entries()) {
    if (r.length !== 3) fail(`coverage.csv ${i + 2}행의 컬럼 수가 ${r.length} 이다 (3 이어야 한다).`);
    const [component, present, evidence] = r.map((c) => c.trim());
    if (component === '' || present === '' || evidence === '') fail(`coverage.csv ${i + 2}행에 빈 값이 있다.`);
    if (present !== 'true' && present !== 'false') fail(`coverage.csv ${i + 2}행 present 가 true|false 가 아니다: ${present}`);
    if (present === 'true' && !/^(symbol:|path:|pkg:)/.test(evidence)) {
      fail(`coverage.csv ${i + 2}행(${component}) present=true 인데 evidence_ref 가 심볼명/패키지 내부 경로 형식이 아니다: ${evidence}`);
    }
    if (present === 'false' && !/^absent-scan:/.test(evidence)) {
      fail(`coverage.csv ${i + 2}행(${component}) present=false 인데 부재 근거가 \`absent-scan:\` 형식이 아니다: ${evidence}\n  부재는 "찾지 못함"이 아니라 "0건임을 보인 것"이어야 한다.`);
    }
    seen.push(component);
  }
  const missing = required.filter((c) => !seen.includes(c));
  const extraRows = seen.filter((c) => !required.includes(c));
  if (missing.length || extraRows.length) {
    fail(`coverage.csv 의 컴포넌트 집합이 잠긴 목록과 다르다. 누락: [${missing}] · 초과: [${extraRows}]`);
  }

  const present = data.filter((r) => r[1].trim() === 'true').length;
  const ratio = Number(((present / data.length) * 100).toFixed(spec.ratio_decimals));
  const ratioStr = ratio.toFixed(spec.ratio_decimals);
  log(`충족률 ${present}/${data.length} = ${ratioStr}% (기준 ≥ ${spec.min_ratio_percent}%)`);

  // verdict.md 의 충족률과 대조
  const verdictMd = mustRead(root, 'verdict.md', 'coverage');
  const lines = verdictMd.split(/\r?\n/).filter((l) => l.includes(spec.rule_id));
  if (lines.length === 0) fail(`verdict.md 에 ${spec.rule_id} 를 언급한 줄이 없다 — 충족률을 대조할 대상이 없다.`);
  const withRatio = lines.filter((l) => l.includes(`${ratioStr}%`));
  if (withRatio.length === 0) {
    fail(`verdict.md 의 ${spec.rule_id} 줄에 재계산 충족률 ${ratioStr}% 가 없다.\n  해당 줄: ${lines[0]}`);
  }
  // 같은 줄에 실측값과 임계값 외의 다른 퍼센트가 있으면 어느 쪽이 충족률인지 확정할 수 없다.
  const thresholdStr = Number(spec.min_ratio_percent).toFixed(spec.ratio_decimals);
  for (const l of lines) {
    const others = [...l.matchAll(/(\d+\.\d)%/g)]
      .map((m) => m[1])
      .filter((v) => v !== ratioStr && v !== thresholdStr);
    if (others.length > 0) {
      fail(`verdict.md 의 ${spec.rule_id} 줄에 재계산 충족률(${ratioStr}%)·임계(${thresholdStr}%) 외의 퍼센트가 있다: ${others.join(', ')}`);
    }
  }
  log(`verdict.md 충족률 표기 일치 (${ratioStr}%)`);
}

/** REQ-5 */
function checkTokens(root, log) {
  const { rules } = loadRules(root);
  const spec = rules.axes.token_extractability;

  const md = mustRead(root, 'token_extraction.md', 'tokens');
  const cmd = fencedBlock(md, 'DS0-EXTRACT-CMD', 'bash').trim();
  if (cmd.length < 40) fail('token_extraction.md 의 추출 커맨드가 비어 있거나 너무 짧다 — 재실행 가능한 커맨드여야 한다.');

  const raw = mustRead(root, 'extracted_tokens.json', 'tokens');
  let doc;
  try { doc = JSON.parse(raw); } catch (e) { fail(`extracted_tokens.json 이 유효한 JSON 이 아니다: ${e.message}`); }

  const meta = doc.$meta ?? {};
  for (const k of ['source_package', 'source_version', 'output_path']) {
    if (!meta[k]) fail(`extracted_tokens.json 의 $meta.${k} 가 없다.`);
  }
  if (!cmd.includes(meta.source_package)) fail(`추출 커맨드가 $meta.source_package(${meta.source_package})를 참조하지 않는다 — 커맨드와 산출물이 연결되지 않는다.`);
  if (!cmd.includes(meta.source_version)) fail(`추출 커맨드가 $meta.source_version(${meta.source_version})을 참조하지 않는다.`);
  if (!cmd.includes(meta.output_path)) fail(`추출 커맨드가 $meta.output_path(${meta.output_path})에 쓰지 않는다.`);
  log(`추출 커맨드 ↔ 산출물 연결 확인 (${meta.source_package}@${meta.source_version})`);

  // 리프 = required_leaf_fields 를 전부 가진 객체
  const need = spec.required_leaf_fields;
  const leaves = [];
  (function walk(node) {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node && typeof node === 'object') {
      if (need.every((f) => Object.prototype.hasOwnProperty.call(node, f))) { leaves.push(node); return; }
      Object.values(node).forEach(walk);
    }
  })(doc.tokens ?? doc);

  if (leaves.length < spec.min_leaf_tokens) fail(`리프 토큰이 ${leaves.length}개다 (기준 ${spec.min_leaf_tokens}개 이상).`);
  for (const [i, leaf] of leaves.entries()) {
    for (const f of need) {
      const v = leaf[f];
      if (typeof v !== 'string' || v.trim() === '') fail(`리프 #${i} 의 \`${f}\` 가 비어 있거나 문자열이 아니다 — 원본 값이 보존되지 않았다.`);
    }
  }
  const distinct = new Set(leaves.map((l) => l.original_key)).size;
  if (distinct < spec.min_leaf_tokens) {
    fail(`고유 original_key 가 ${distinct}개다 (기준 ${spec.min_leaf_tokens}개 이상). 같은 키를 반복해 리프 수만 늘릴 수 없다.`);
  }
  if (meta.leaf_count !== undefined && meta.leaf_count !== leaves.length) {
    fail(`$meta.leaf_count(${meta.leaf_count})가 실제 리프 수(${leaves.length})와 다르다.`);
  }
  log(`리프 ${leaves.length}개 · 고유 키 ${distinct}개 (기준 ${spec.min_leaf_tokens}) · 원본 필드 ${need.join('/')} 전건 보존`);

  // FORBID-4 와의 접합 — 추출물이 있는데 라이선스가 미확인이면 안 된다
  const lic = parseJsonBlock(mustRead(root, 'license.md', 'tokens'), 'DS0-LICENSE');
  const bad = rules.axes.license.items.filter((i) => lic.judgments?.[i] === 'denied' || lic.judgments?.[i] === 'unclear');
  if (bad.length > 0) fail(`FORBID-4 위반 — extracted_tokens.json 이 있는데 라이선스 판정에 ${bad.join(', ')} 가 denied|unclear 다.`);
  if (spec.requires_extraction_allowed && lic.extraction_allowed !== true) fail('extraction_allowed 가 true 가 아닌데 extracted_tokens.json 이 커밋되어 있다.');
}

/** 축 값을 근거에서 **독립적으로** 다시 계산한다 (REQ-6 의 "룰 매핑 재평가") */
function reevaluateAxes(root, rules) {
  const out = {};

  const lic = parseJsonBlock(mustRead(root, 'license.md', 'verdict'), 'DS0-LICENSE');
  out.license = rules.axes.license.items.every((i) => lic.judgments?.[i] === rules.axes.license.pass_requires_all) ? 'pass' : 'fail';

  const ssrSpec = rules.axes.ssr_compat;
  const nums = parseJsonBlock(mustRead(root, 'ssr_probe.md', 'verdict'), 'DS0-SSR-NUMBERS');
  const ratioLabels = nums.component_count > 0 ? nums.js_disabled_label_hits / nums.component_count : 0;
  out.ssr_compat =
    nums.build_exit_code === ssrSpec.required_build_exit_code &&
    nums.hydration_mismatch_warnings <= ssrSpec.max_hydration_mismatch_warnings &&
    ratioLabels >= ssrSpec.required_label_hit_ratio &&
    nums.component_count >= ssrSpec.min_components
      ? 'pass'
      : 'fail';

  const covSpec = rules.axes.coverage;
  const rows = parseCsv(mustRead(root, 'coverage.csv', 'verdict')).slice(1);
  const present = rows.filter((r) => r[1].trim() === 'true').length;
  const ratio = Number(((present / rows.length) * 100).toFixed(covSpec.ratio_decimals));
  out.coverage = ratio >= covSpec.min_ratio_percent ? 'pass' : 'fail';

  const tokSpec = rules.axes.token_extractability;
  const doc = JSON.parse(mustRead(root, 'extracted_tokens.json', 'verdict'));
  const leaves = [];
  (function walk(node) {
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node && typeof node === 'object') {
      if (tokSpec.required_leaf_fields.every((f) => Object.prototype.hasOwnProperty.call(node, f))) { leaves.push(node); return; }
      Object.values(node).forEach(walk);
    }
  })(doc.tokens ?? doc);
  out.token_extractability =
    leaves.length >= tokSpec.min_leaf_tokens && (!tokSpec.requires_extraction_allowed || lic.extraction_allowed === true)
      ? 'pass'
      : 'fail';

  return out;
}

/** REQ-6 · FORBID-1 */
function checkVerdict(root, log) {
  const { rules } = loadRules(root);
  const doc = parseJsonBlock(mustRead(root, 'verdict.md', 'verdict'), 'DS0-VERDICT');
  const mapping = rules.verdict_mapping;

  if (!mapping.enum.includes(doc.verdict)) fail(`verdict 값 \`${doc.verdict}\` 이 enum(${mapping.enum.join('|')}) 밖이다.`);
  if (doc.verdict_rule_id !== mapping.rule_id) fail(`verdict_rule_id 가 ${mapping.rule_id} 가 아니다: ${doc.verdict_rule_id}`);

  const axisNames = Object.keys(rules.axes);
  for (const axis of axisNames) {
    const a = doc.axes?.[axis];
    if (!a) fail(`verdict.md 에 축 \`${axis}\` 가 없다.`);
    if (!['pass', 'fail'].includes(a.value)) fail(`축 \`${axis}\` 의 value 가 pass|fail 이 아니다: ${a.value}`);
    if (a.rule_id !== rules.axes[axis].rule_id) fail(`축 \`${axis}\` 의 rule_id 가 잠긴 값(${rules.axes[axis].rule_id})과 다르다: ${a.rule_id}`);
    if (!a.evidence_ref || String(a.evidence_ref).trim() === '') fail(`축 \`${axis}\` 의 evidence_ref 가 비어 있다.`);
    if (!existsSync(abs(root, a.evidence_ref))) fail(`축 \`${axis}\` 의 evidence_ref 가 가리키는 파일이 없다: ${a.evidence_ref}`);
  }
  log(`4개 축 (value, rule_id, evidence_ref) 존재 · 근거 파일 실재`);

  // 룰 재평가
  const recomputed = reevaluateAxes(root, rules);
  for (const axis of axisNames) {
    if (recomputed[axis] !== doc.axes[axis].value) {
      fail(
        `축 \`${axis}\` 의 기재값(${doc.axes[axis].value})이 근거 재평가 결과(${recomputed[axis]})와 다르다.\n` +
          '  판정은 근거에서 유도되어야 한다. 기재값을 근거로 삼지 않는다.',
      );
    }
  }
  log(`축 재평가 일치 — ${axisNames.map((a) => `${a}=${recomputed[a]}`).join(' · ')}`);

  // 매핑 재평가
  const expected = mapping.option_b_requires_pass.every((a) => recomputed[a] === 'pass') ? 'option_b' : 'option_a';
  if (expected !== doc.verdict) {
    fail(`verdict 기재값(${doc.verdict})이 ${mapping.rule_id} 재평가 결과(${expected})와 다르다.`);
  }
  if (expected === 'option_a') {
    const unmet = mapping.option_a_requires_pass.filter((a) => recomputed[a] !== 'pass');
    if (unmet.length > 0) {
      fail(
        `판정 불가 — option_b 요건이 미충족인데 option_a 의 전제(${unmet.join(', ')})도 fail 이다.\n` +
          '  두 옵션 모두 성립하지 않는 상태를 통과로 처리하지 않는다. G5 는 undecided 로 남는다.',
      );
    }
  }
  log(`${mapping.rule_id} 재평가 일치 — verdict=${doc.verdict}`);

  // FORBID-1
  if (doc.verdict === 'option_b') {
    const evidence = Array.isArray(doc.evidence) ? doc.evidence : [];
    for (const axis of axisNames) {
      const items = evidence.filter((e) => e.axis === axis);
      if (items.length === 0) fail(`FORBID-1 위반 — verdict=option_b 인데 축 \`${axis}\` 의 evidence 항목이 0건이다.`);
      for (const it of items) {
        if (!it.evidence_ref || String(it.evidence_ref).trim() === '') fail(`FORBID-1 위반 — 축 \`${axis}\` 의 evidence_ref 가 비어 있다.`);
        if (!existsSync(abs(root, it.evidence_ref))) {
          fail(
            `FORBID-1 위반 — verdict=option_b 인데 축 \`${axis}\` 의 근거 파일이 없다: ${it.evidence_ref}\n` +
              '  근거 없이 채택한 뒤 SSR 비호환·라이선스 문제가 드러나면 DS3~DS7 이 전부 재작업이다. 미확인은 option_a 쪽으로 기운다.',
          );
        }
      }
    }
    log('FORBID-1 — option_b 의 4개 축 근거 파일 전수 실재 확인');
  } else {
    log('FORBID-1 조건 미발동 (verdict=option_a)');
  }
}

/** REQ-7 */
function checkAppendix(root, log) {
  loadRules(root); // 룰 블록이 없으면 여기서 실패시킨다 (판정 불가는 통과가 아니다)
  const md = mustRead(root, 'verdict.md', 'appendix');
  const doc = parseJsonBlock(md, 'DS0-VERDICT');

  if (doc.verdict === 'option_a') {
    const m = md.match(/<!--\s*DS0-APPENDIX-MAPPING-BEGIN\s*-->([\s\S]*?)<!--\s*DS0-APPENDIX-MAPPING-END\s*-->/);
    if (!m) fail('option_a 인데 DS0-APPENDIX-MAPPING 블록이 없다 — 토큰 매핑 표가 부록으로 첨부되어야 한다.');
    const rows = m[1]
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.startsWith('|') && !/^\|\s*-+/.test(l))
      .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()))
      .filter((cells) => cells.length >= 2 && !/^seed/i.test(cells[0]));
    if (rows.length < 20) fail(`토큰 매핑 표가 ${rows.length}행이다 (기준 20행 이상).`);

    const doc2 = JSON.parse(mustRead(root, 'extracted_tokens.json', 'appendix'));
    const keys = new Set();
    (function walk(node) {
      if (Array.isArray(node)) { node.forEach(walk); return; }
      if (node && typeof node === 'object') {
        if (typeof node.original_key === 'string') keys.add(node.original_key);
        else Object.values(node).forEach(walk);
      }
    })(doc2.tokens ?? doc2);
    if (keys.size === 0) fail('extracted_tokens.json 에서 original_key 를 하나도 찾지 못했다 — 부분집합 검사를 수행할 수 없다.');

    const strip = (s) => s.replace(/`/g, '').trim();
    const orphans = [];
    for (const cells of rows) {
      const left = strip(cells[0]);
      const right = strip(cells[1]);
      if (left === '' || right === '') fail(`매핑 표에 빈 셀이 있다: ${JSON.stringify(cells)}`);
      if (!keys.has(left)) orphans.push(left);
    }
    if (orphans.length > 0) {
      fail(
        `매핑 표의 좌변 ${orphans.length}건이 extracted_tokens.json 에 실재하지 않는다: ${orphans.slice(0, 5).join(', ')}${orphans.length > 5 ? ' …' : ''}\n` +
          '  실재하지 않는 키로 만든 매핑은 DS1 에서 전부 깨진다.',
      );
    }
    log(`option_a 부록 — 매핑 표 ${rows.length}행 · 좌변 전건이 extracted_tokens.json 의 부분집합`);
    return;
  }

  // option_b — 부재 컴포넌트 전건에 대체 계획
  const m = md.match(/<!--\s*DS0-APPENDIX-FALLBACK-BEGIN\s*-->([\s\S]*?)<!--\s*DS0-APPENDIX-FALLBACK-END\s*-->/);
  if (!m) fail('option_b 인데 DS0-APPENDIX-FALLBACK 블록이 없다 — 부재 컴포넌트 대체 계획표가 첨부되어야 한다.');
  const plans = new Map();
  for (const line of m[1].split(/\r?\n/)) {
    const t = line.trim();
    if (!t.startsWith('|') || /^\|\s*-+/.test(t)) continue;
    const cells = t.split('|').slice(1, -1).map((c) => c.replace(/`/g, '').trim());
    if (cells.length >= 2) plans.set(cells[0], cells[1]);
  }
  const rows = parseCsv(mustRead(root, 'coverage.csv', 'appendix')).slice(1);
  const absent = rows.filter((r) => r[1].trim() === 'false').map((r) => r[0].trim());
  if (absent.length === 0) fail('option_b 인데 coverage.csv 의 부재 컴포넌트가 0건이다 — 대체 계획 검사가 공회전한다. 검사 대상 0건은 통과가 아니다.');
  const unplanned = absent.filter((c) => !plans.get(c) || plans.get(c) === '');
  if (unplanned.length > 0) fail(`option_b 인데 부재 컴포넌트에 대체 계획이 없다: ${unplanned.join(', ')}`);
  log(`option_b 부록 — 부재 ${absent.length}종 전건에 대체 계획 존재`);
}

/** FORBID-2 */
function checkEvidence(root, log) {
  const { rules } = loadRules(root);
  const spec = rules.evidence;
  const doc = parseJsonBlock(mustRead(root, 'verdict.md', 'evidence'), 'DS0-VERDICT');
  const evidence = Array.isArray(doc.evidence) ? doc.evidence : [];
  if (evidence.length === 0) fail('verdict.md 의 evidence 가 0건이다 — 근거 없는 판정은 판정이 아니다.');

  const secondary = spec.secondary_source_extensions.map((e) => `.${e.toLowerCase()}`);
  const byAxis = new Map();

  for (const [i, e] of evidence.entries()) {
    for (const f of spec.required_fields) {
      if (!e[f] || String(e[f]).trim() === '') {
        fail(`FORBID-2 위반 — evidence[${i}] 에 \`${f}\` 가 없다.\n  근거는 (파일 경로 · sha256 · 취득 URL 또는 버전) 3요소를 전부 가져야 한다.`);
      }
    }
    if (!e.axis || !rules.axes[e.axis]) fail(`evidence[${i}] 의 axis \`${e.axis}\` 가 판정 축이 아니다.`);
    if (!/^[0-9a-f]{64}$/.test(e.sha256)) fail(`evidence[${i}](${e.evidence_ref}) 의 sha256 이 64자 hex 가 아니다.`);
    const p = abs(root, e.evidence_ref);
    if (!existsSync(p)) fail(`evidence[${i}] 의 파일이 실재하지 않는다: ${e.evidence_ref}`);
    const got = sha256File(p);
    if (got !== e.sha256) fail(`evidence[${i}](${e.evidence_ref}) 의 sha256 불일치\n  기재: ${e.sha256}\n  실제: ${got}`);
    if (!byAxis.has(e.axis)) byAxis.set(e.axis, []);
    byAxis.get(e.axis).push(e);
  }
  log(`evidence ${evidence.length}건 — 3요소 존재 · 파일 실재 · sha256 재계산 일치`);

  for (const axis of Object.keys(rules.axes)) {
    const items = byAxis.get(axis) ?? [];
    if (items.length === 0) fail(`축 \`${axis}\` 의 evidence 가 0건이다 — 검사 대상 0건은 통과가 아니다.`);
    const axisValue = doc.axes?.[axis]?.value;
    const primary = items.filter((e) => !secondary.includes(path.extname(String(e.evidence_ref)).toLowerCase()));
    if (axisValue === 'pass' && primary.length === 0) {
      fail(
        `FORBID-2 위반 — 축 \`${axis}\` 가 pass 인데 근거가 2차 자료(${secondary.join('/')})뿐이다.\n` +
          '  이 워크스트림의 원천은 코드다. 패키지 tarball · 커밋 SHA · LICENSE 원문 · 실행 로그가 없으면 pass 를 줄 수 없다.',
      );
    }
  }
  log(`축별 근거 ≥1건 · pass 축에 1차 근거 존재`);
}

// ── FORBID-3 탐지 정의 로드 ────────────────────────────────────────
// 패턴을 이 파일 본문에 두면 검사기 자신이 자기 패턴에 걸린다(P7 자기차단).
// 그러면 개발 에이전트가 반드시 우회하고 우회 관용구를 학습하므로, 정의는 데이터로 분리한다.
//   docs/design-system/DS0/forbid3_patterns.json
function loadForbid3Patterns(root) {
  const raw = mustRead(root, 'forbid3_patterns.json', 'no-vendored');
  let def;
  try { def = JSON.parse(raw); } catch (e) { fail(`forbid3_patterns.json 파싱 실패: ${e.message}`); }
  if (!def.package_ref_pattern) fail('forbid3_patterns.json 에 package_ref_pattern 이 없다.');
  if (!Array.isArray(def.tier_a) || def.tier_a.length === 0) fail('forbid3_patterns.json 의 tier_a 가 0건이다 — 탐지 정의 없이 통과시키지 않는다.');
  if (!Array.isArray(def.seed_unique_symbols) || def.seed_unique_symbols.length === 0) fail('forbid3_patterns.json 의 seed_unique_symbols 가 0건이다.');
  const codeExt = new Set(def.code_extensions ?? []);
  const pkgRe = new RegExp(def.package_ref_pattern);

  const tierA = def.tier_a.map((sig) => {
    const exts = sig.extensions;
    const extOk = (ext) => {
      if (!exts) return true;
      if (exts.includes('*code*')) return codeExt.has(ext);
      return exts.includes(ext);
    };
    if (sig.kind === 'regex') {
      const re = new RegExp(sig.pattern);
      return { id: sig.id, why: sig.why, test: (text, ext) => extOk(ext) && re.test(text) };
    }
    if (sig.kind === 'unique_export') {
      const res = def.seed_unique_symbols.flatMap((s) => [
        new RegExp(`export\\s+(const|function|class|default)\\s+${s}\\b`),
        new RegExp(`export\\s*\\{[^}]*\\b${s}\\b[^}]*\\}`),
      ]);
      return { id: sig.id, why: sig.why, test: (text, ext) => extOk(ext) && res.some((re) => re.test(text)) };
    }
    if (sig.kind === 'attribution') {
      const idRe = new RegExp(sig.identity_pattern, 'i');
      const attrRes = (sig.attribution_patterns ?? []).map((p) => new RegExp(p));
      if (attrRes.length === 0) fail(`forbid3_patterns.json 의 ${sig.id} 에 attribution_patterns 가 없다.`);
      return {
        id: sig.id,
        why: sig.why,
        test: (text, ext) => extOk(ext) && idRe.test(text) && attrRes.some((re) => re.test(text)),
      };
    }
    return fail(`forbid3_patterns.json 의 알 수 없는 kind: ${sig.kind}`);
  });

  return { codeExt, pkgRe, tierA };
}

/**
 * 허용 목록에 등재된 파일에서도, 패키지명은 **문자열 리터럴 안에서만** 나타날 수 있다.
 * 따옴표로 감싼 부분을 제거한 뒤에도 패키지명이 남으면 위반이다.
 */
function referenceFormOk(line, pkgRe) {
  const t = line.trim();
  if (t.startsWith('//') || t.startsWith('/*') || t.startsWith('*') || t.startsWith('#')) return true;
  const stripped = line.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""').replace(/`[^`]*`/g, '``');
  return !pkgRe.test(stripped);
}

/** FORBID-3 */
function checkNoVendored(root, log) {
  // 조건: verdict 가 option_a 인 경우에만 발동한다 (계약 FORBID-3 when)
  let verdict = null;
  if (existsSync(abs(root, 'verdict.md'))) {
    verdict = parseJsonBlock(readFileSync(abs(root, 'verdict.md'), 'utf8'), 'DS0-VERDICT').verdict;
  }
  if (verdict !== 'option_a') {
    log(`FORBID-3 조건 미발동 (verdict=${verdict ?? '미기재'}) — 배제 판정이 아니므로 벤더링 금지가 발동하지 않는다`);
    return;
  }

  const { codeExt, pkgRe, tierA } = loadForbid3Patterns(root);
  const isDefaultRoot = path.resolve(root) === path.resolve(DEFAULT_ROOT);
  let files;
  if (isDefaultRoot) {
    // 리포 전 파일 (git 추적 대상). 커밋되지 않은 것은 배포되지 않으므로 대상이 아니다.
    let listed;
    try {
      listed = execFileSync('git', ['ls-files', '-z'], { cwd: REPO_ROOT, encoding: 'utf8' });
    } catch (e) {
      fail(`git ls-files 실패 — 스캔 대상을 확정할 수 없다: ${e.message}`);
    }
    files = listed.split('\0').filter(Boolean).map((f) => path.join(REPO_ROOT, f));
  } else {
    files = walkFiles(root);
  }
  if (files.length === 0) fail('스캔 대상 파일이 0건이다 — 검사 대상 0건은 통과가 아니다.');

  const allowlistPath = abs(root, 'vendoring_allowlist.json');
  let allow = new Map();
  if (existsSync(allowlistPath)) {
    const al = JSON.parse(readFileSync(allowlistPath, 'utf8'));
    for (const e of al.entries ?? []) {
      if (!e.path || !e.reason) fail('vendoring_allowlist.json 의 항목에 path 또는 reason 이 없다 — 사유 없는 예외는 예외가 아니다.');
      allow.set(e.path, e.reason);
    }
  }

  /**
   * 예외 2가지.
   *  - snapshots/license/**   계약 FORBID-3 detect 가 명시한 예외 (LICENSE 원문 보관소)
   *  - __fixtures__/**        위반을 **의도적으로** 담은 픽스처 트리.
   *                           단 이 예외는 리포 전체 스캔일 때만 적용된다.
   *                           픽스처 루트를 직접 지정해 스캔할 때(=selftest)는 예외가 아니다 —
   *                           즉 이 트리는 검사되지 않는 사각지대가 아니라 다른 모드로 검사된다.
   */
  const isExempt = (repoRel, rootRel) =>
    isDefaultRoot
      ? repoRel.startsWith('docs/design-system/DS0/snapshots/license/') || repoRel.startsWith(`${FIXTURES_REL}/`)
      : rootRel.startsWith('snapshots/license/');

  const violations = [];
  let scanned = 0;
  const allowlistHits = new Set();

  for (const f of files) {
    const repoRel = rel(REPO_ROOT, f);
    const rootRel = rel(root, f);
    if (isExempt(repoRel, rootRel)) continue;
    let text;
    try { text = readFileSync(f, 'utf8'); } catch { continue; }
    if (text.includes('\0')) continue;
    scanned += 1;
    const ext = path.extname(f).toLowerCase();

    for (const sig of tierA) {
      if (sig.test(text, ext)) violations.push(`${repoRel} — [${sig.id}] ${sig.why}`);
    }

    if (codeExt.has(ext) && pkgRe.test(text)) {
      const key = isDefaultRoot ? repoRel : rel(root, f);
      if (!allow.has(key)) {
        violations.push(`${repoRel} — [B-pkg-ref] 코드 파일이 상류 패키지를 참조하는데 vendoring_allowlist.json 에 없다`);
      } else {
        allowlistHits.add(key);
        const badLines = text
          .split(/\r?\n/)
          .map((line, i) => ({ line, i }))
          .filter(({ line }) => pkgRe.test(line))
          .filter(({ line }) => !referenceFormOk(line, pkgRe));
        for (const { line, i } of badLines) {
          violations.push(`${repoRel}:${i + 1} — [B-form] 허용된 참조 형태가 아니다: ${line.trim().slice(0, 120)}`);
        }
      }
    }
  }

  if (scanned === 0) fail('읽을 수 있는 스캔 대상이 0건이다 — 검사 대상 0건은 통과가 아니다.');
  const stale = [...allow.keys()].filter((k) => !allowlistHits.has(k));
  if (stale.length > 0) {
    fail(`vendoring_allowlist.json 에 더 이상 해당 없는 항목이 있다: ${stale.join(', ')}\n  죽은 예외는 다음 벤더링의 통로가 된다. 지워라.`);
  }
  if (violations.length > 0) {
    fail(
      `FORBID-3 위반 ${violations.length}건 — verdict=option_a 인데 배제된 상류 자산이 리포에 남아 있다.\n` +
        violations.map((v) => `  - ${v}`).join('\n') +
        '\n  배제 판정된 자산이 남으면 이후 개발 에이전트가 "이미 있으니까" 가져다 쓴다.',
    );
  }
  log(`스캔 ${scanned}개 파일 · 위반 0건 (허용목록 ${allow.size}건 전부 실사용)`);
}

// ───────────────────────────── selftest ─────────────────────────────

const FIXTURES = [
  { dir: 'baseline-option-a', check: null, expect: 'pass', note: 'option_a 정상 트리 — 전 검사 통과해야 한다' },
  { dir: 'baseline-option-b', check: null, expect: 'pass', note: 'option_b 정상 트리 — 전 검사 통과해야 한다' },
  { dir: 'forbid1-option-b-missing-evidence', check: 'verdict', expect: 'fail', baseline: 'baseline-option-b', forbid: 'FORBID-1' },
  { dir: 'forbid2-image-only-evidence', check: 'evidence', expect: 'fail', baseline: 'baseline-option-a', forbid: 'FORBID-2' },
  { dir: 'forbid3-vendored-source', check: 'no-vendored', expect: 'fail', baseline: 'baseline-option-a', forbid: 'FORBID-3' },
  { dir: 'forbid4-unclear-license-with-tokens', check: 'license', expect: 'fail', baseline: 'baseline-option-a', forbid: 'FORBID-4' },
  { dir: 'forbid5-rule-tampered', check: 'rule-lock', expect: 'fail', baseline: 'baseline-option-a', forbid: 'FORBID-5' },
  { dir: 'forbid5-lock-after-measurement', check: 'rule-lock', expect: 'fail', baseline: 'baseline-option-a', forbid: 'FORBID-5' },
];

const ALL_CHECKS = ['rule-lock', 'license', 'ssr', 'coverage', 'tokens', 'verdict', 'appendix', 'evidence', 'no-vendored'];

const CHECKS = {
  'rule-lock': checkRuleLock,
  license: checkLicense,
  ssr: checkSsr,
  coverage: checkCoverage,
  tokens: checkTokens,
  verdict: checkVerdict,
  appendix: checkAppendix,
  evidence: checkEvidence,
  'no-vendored': checkNoVendored,
};

function runCheck(name, root) {
  const lines = [];
  try {
    CHECKS[name](root, (m) => lines.push(m));
    return { ok: true, lines };
  } catch (err) {
    lines.push(err instanceof CheckError ? err.message : `예기치 못한 오류: ${err.stack ?? err}`);
    return { ok: false, lines };
  }
}

function runSelftest() {
  const fixturesRoot = path.join(REPO_ROOT, FIXTURES_REL);
  if (!existsSync(fixturesRoot)) {
    console.error(`✗ selftest: 픽스처 디렉터리가 없다 (${FIXTURES_REL}). 탐지력을 증명하지 못하면 통과가 아니다.`);
    return false;
  }
  let ok = true;
  console.log('\n── selftest — 탐지력 증명 (의도적 위반 픽스처) ──');
  for (const fx of FIXTURES) {
    const root = path.join(fixturesRoot, fx.dir);
    if (!existsSync(root)) {
      console.error(`✗ ${fx.dir}: 픽스처가 없다`);
      ok = false;
      continue;
    }
    if (fx.expect === 'pass') {
      for (const name of ALL_CHECKS) {
        const r = runCheck(name, root);
        if (!r.ok) {
          console.error(`✗ ${fx.dir} / --check ${name}: 정상 픽스처가 실패했다 (오탐)\n${r.lines.map((l) => `    ${l}`).join('\n')}`);
          ok = false;
        }
      }
      if (ok) console.log(`  ✓ ${fx.dir}: 전 검사(${ALL_CHECKS.length}종) 통과 — ${fx.note}`);
      continue;
    }
    // 위반 픽스처: 대상 검사는 반드시 실패해야 하고, 같은 검사가 baseline 에서는 통과해야 한다(변별력).
    const bad = runCheck(fx.check, root);
    const base = runCheck(fx.check, path.join(fixturesRoot, fx.baseline));
    if (bad.ok) {
      console.error(`✗ ${fx.dir}: --check ${fx.check} 가 위반을 통과시켰다 (${fx.forbid} 미탐)`);
      ok = false;
    } else if (!base.ok) {
      console.error(`✗ ${fx.dir}: --check ${fx.check} 가 baseline(${fx.baseline})에서도 실패한다 — 변별력이 없다`);
      ok = false;
    } else {
      console.log(`  ✓ ${fx.dir}: --check ${fx.check} non-zero (${fx.forbid}) · baseline 통과`);
      console.log(`      ${bad.lines[bad.lines.length - 1].split('\n')[0]}`);
    }
  }
  return ok;
}

// ───────────────────────────── main ─────────────────────────────

function main(argv) {
  const args = argv.slice(2);
  let root = DEFAULT_ROOT;
  const checks = [];
  let all = false;
  let selftest = false;

  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--all') all = true;
    else if (a === '--selftest') selftest = true;
    else if (a === '--root') { root = path.resolve(args[++i] ?? ''); }
    else if (a === '--check') {
      const name = args[++i];
      if (!CHECKS[name]) { console.error(`알 수 없는 검사: ${name}\n사용 가능: ${ALL_CHECKS.join(', ')}`); return 2; }
      checks.push(name);
    } else if (a === '--help' || a === '-h') {
      console.log(`사용법:\n  --all\n  --check <${ALL_CHECKS.join('|')}> [--root <dir>]\n  --selftest`);
      return 0;
    } else { console.error(`알 수 없는 인자: ${a}`); return 2; }
  }

  if (!all && !selftest && checks.length === 0) {
    console.error('검사를 지정하지 않았다. --all 또는 --check <name> 을 쓰라. (아무것도 하지 않은 실행을 통과로 처리하지 않는다)');
    return 2;
  }

  const toRun = all ? ALL_CHECKS : checks;
  let ok = true;
  if (toRun.length > 0) {
    console.log(`DS0 검증 — root: ${rel(REPO_ROOT, root) || '.'}`);
    for (const name of toRun) {
      const r = runCheck(name, root);
      if (r.ok) {
        console.log(`✓ ${name}`);
        for (const l of r.lines) console.log(`    ${l}`);
      } else {
        ok = false;
        console.error(`✗ ${name}`);
        for (const l of r.lines) console.error(`    ${l}`);
      }
    }
  }
  if (all || selftest) {
    if (!runSelftest()) ok = false;
  }
  return ok ? 0 : 1;
}

process.exit(main(process.argv));
