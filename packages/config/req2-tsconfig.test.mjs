#!/usr/bin/env node
/**
 * F1 REQ-2 계약 테스트 — `pnpm -r test` 의 `@glowmate/config` 몫으로 실행된다.
 *
 * 계약 REQ-2 acceptance: "`tsc --noEmit` exit 0 **+ packages/config/tsconfig.base.json 의
 * 세 플래그 값 assert 테스트 통과**". 그 assert 테스트가 이 파일이다.
 *
 * `tsc --noEmit` 이 exit 0 인 것만으로는 REQ-2 가 충족되지 않는다 — 플래그를 끄면 오류가
 * 사라지므로 **"틀린 값 0건"이 "아무것도 검사하지 않음"으로 만족**되기 때문이다.
 * 그래서 아래 3층을 검사한다:
 *
 *   A. 기대값 자체   — tsconfig.base.json 의 세 플래그가 **존재하고** true 다.
 *                      (값이 false 인 경우뿐 아니라 **키 누락도 실패**다 — 누락이 최단 우회로다)
 *   B. 상속          — 전 TS 패키지가 그 base 를 extends 하고, 세 플래그를 재선언하지 않는다.
 *                      (extends 한 줄을 지우면 느슨한 기본값으로 컴파일된다)
 *   C. 실행 보장     — 전 TS 패키지에 `typecheck` 스크립트가 있고 `-p tsconfig.json` 을 대상으로 한다.
 *                      `pnpm -r <script>` 는 **스크립트가 없는 패키지를 오류 없이 건너뛴다.**
 *                      스크립트 부재를 통과로 처리하면 커버리지 하한이 0이 된다(검수 지적 B-E).
 *
 * 실패 출력에는 반드시 `REQ-2` 토큰이 포함된다 — F1 REQ-5 의 귀속 검증이 이 문자열로
 * job 실패를 규칙에 귀속시킨다.
 *
 * 사용법: node packages/config/req2-tsconfig.test.mjs   (또는 `pnpm --filter @glowmate/config test`)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// 워크스페이스 멤버 열거는 dep-graph 검사기와 **같은 구현**을 쓴다.
// 두 검사기가 각자 파서를 들고 있으면 "어떤 패키지가 검사 대상인가"가 갈라지고,
// 갈라진 틈이 그대로 미탐이 된다.
import { discoverMembers } from '../../tools/dep-graph/lib/workspace.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** REQ-2 가 고정한 세 플래그. 이 목록을 줄이는 것이 규칙 무력화의 최단 경로다. */
const REQUIRED_FLAGS = ['strict', 'noUncheckedIndexedAccess', 'noImplicitOverride'];
const BASE_REL = 'packages/config/tsconfig.base.json';

const violations = [];
const notes = [];

function fail(message) {
  violations.push(`[REQ-2] ${message}`);
}

/** 리포 루트 탐색 — pnpm-workspace.yaml 이 있는 최상위 디렉터리 */
function findRoot(start) {
  let dir = start;
  for (let i = 0; i < 10; i += 1) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('[REQ-2] pnpm-workspace.yaml 을 찾지 못했다 — 리포 루트를 판정할 수 없다');
}

/**
 * JSONC(주석·후행 쉼표 허용) 파서. tsconfig 는 주석을 허용하므로 JSON.parse 만으로는 읽을 수 없다.
 * 문자열 안의 `//`(예: "https://…") 를 주석으로 오인하지 않도록 문자열 상태를 추적한다.
 */
function parseJsonc(text, label) {
  let out = '';
  let inString = false;
  let inLine = false;
  let inBlock = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (inLine) {
      if (ch === '\n') {
        inLine = false;
        out += ch;
      }
      continue;
    }
    if (inBlock) {
      if (ch === '*' && next === '/') {
        inBlock = false;
        i += 1;
      }
      continue;
    }
    if (inString) {
      out += ch;
      if (ch === '\\') {
        out += next ?? '';
        i += 1;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === '/' && next === '/') {
      inLine = true;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      inBlock = true;
      i += 1;
      continue;
    }
    out += ch;
  }
  const withoutTrailingCommas = out.replace(/,(\s*[}\]])/g, '$1');
  try {
    return { ok: true, value: JSON.parse(withoutTrailingCommas) };
  } catch (e) {
    return { ok: false, error: `${label} 파싱 실패: ${e.message}` };
  }
}

function readJsonc(abs, label) {
  if (!fs.existsSync(abs)) return { ok: false, error: `${label} 이 없다` };
  return parseJsonc(fs.readFileSync(abs, 'utf8'), label);
}

/** 워크스페이스 멤버 중 **TS 패키지** 판정 */
function isTsPackage(root, member) {
  // 기준: tsconfig.json 이 있거나 .ts/.tsx 소스를 가진 워크스페이스 멤버.
  //
  // `tsconfig.json 존재`만으로 판정하면 그 파일을 지우는 것이 검사를 벗어나는 최단 경로가 된다.
  // 그래서 "TS 소스가 있는데 tsconfig.json 이 없는" 상태도 TS 패키지로 보고 아래에서 실패시킨다.
  //
  // `@glowmate/config` 자신은 TS 소스가 0개이고 tsconfig.json 도 없다 — 이 패키지는 tsconfig **기대값을
  // 제공하는 쪽**이지 상속하는 쪽이 아니므로 (B)(C) 대상이 아니다. TS 소스를 갖게 되면 자동으로 대상이 된다.
  const dir = path.join(root, member.dir);
  if (fs.existsSync(path.join(dir, 'tsconfig.json'))) return true;
  return hasTsSource(dir);
}

const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'build', 'coverage', '.turbo']);

function hasTsSource(dir, depth = 0) {
  if (depth > 6) return false;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    if (e.code === 'ENOENT' || e.code === 'ENOTDIR') return false;
    throw e;
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name) || e.name.startsWith('.')) continue;
      if (hasTsSource(path.join(dir, e.name), depth + 1)) return true;
    } else if (/\.tsx?$/.test(e.name) && !e.name.endsWith('.d.ts')) {
      return true;
    }
  }
  return false;
}

/** extends 체인을 따라가며 (파일 절대경로, 파싱 결과) 목록을 만든다 */
function resolveExtendsChain(root, tsconfigAbs) {
  const chain = [];
  let currentAbs = tsconfigAbs;
  for (let depth = 0; depth < 6; depth += 1) {
    const parsed = readJsonc(currentAbs, path.relative(root, currentAbs));
    if (!parsed.ok) return { ok: false, error: parsed.error, chain };
    chain.push({ abs: currentAbs, rel: path.relative(root, currentAbs), config: parsed.value });
    const ext = parsed.value?.extends;
    if (ext === undefined) return { ok: true, chain, terminated: true };
    const extList = Array.isArray(ext) ? ext : [ext];
    if (extList.length !== 1) {
      return {
        ok: false,
        error: `${path.relative(root, currentAbs)} 의 extends 가 ${extList.length}개다 — 상속 경로가 모호하다`,
        chain,
      };
    }
    const spec = extList[0];
    const nextAbs = resolveExtendsSpec(root, currentAbs, spec);
    if (nextAbs === null) {
      return {
        ok: false,
        error: `${path.relative(root, currentAbs)} 의 extends "${spec}" 를 해석할 수 없다`,
        chain,
      };
    }
    currentAbs = nextAbs;
  }
  return { ok: false, error: 'extends 체인이 6단계를 넘는다', chain };
}

function resolveExtendsSpec(root, fromAbs, spec) {
  if (typeof spec !== 'string' || spec === '') return null;
  if (spec.startsWith('.') || spec.startsWith('/')) {
    const abs = path.resolve(path.dirname(fromAbs), spec);
    if (fs.existsSync(abs)) return abs;
    return fs.existsSync(`${abs}.json`) ? `${abs}.json` : null;
  }
  // 패키지 지정자: 워크스페이스 내부 패키지만 해석한다 (외부 프리셋 상속은 REQ-2 상 허용 대상이 아니다)
  const m = /^(@[^/]+\/[^/]+|[^/]+)\/(.+)$/.exec(spec);
  if (m === null) return null;
  const [, pkgName, subPath] = m;
  const members = MEMBERS.filter((mem) => mem.name === pkgName);
  if (members.length !== 1) return null;
  const abs = path.join(root, members[0].dir, subPath);
  if (fs.existsSync(abs)) return abs;
  return fs.existsSync(`${abs}.json`) ? `${abs}.json` : null;
}

// ── 실행 ────────────────────────────────────────────────────────────────
const ROOT = findRoot(HERE);
const ws = discoverMembers(ROOT);
for (const e of ws.errors) fail(`워크스페이스 탐색 실패: ${e}`);
const MEMBERS = ws.members;

if (MEMBERS.length === 0) {
  fail('워크스페이스 멤버가 0건이다 — 검사 대상이 없으면 통과가 아니라 실패다');
}

// ── A. tsconfig.base.json 의 세 플래그 ──────────────────────────────────
const baseAbs = path.join(ROOT, BASE_REL);
const base = readJsonc(baseAbs, BASE_REL);
if (!base.ok) {
  fail(`${base.error} — REQ-2 의 기대값 원천이 없으면 전 검사가 공허하다`);
} else {
  const opts = base.value?.compilerOptions;
  if (opts === null || typeof opts !== 'object' || Array.isArray(opts)) {
    fail(`${BASE_REL} 에 compilerOptions 객체가 없다`);
  } else {
    for (const flag of REQUIRED_FLAGS) {
      if (!Object.prototype.hasOwnProperty.call(opts, flag)) {
        fail(
          `${BASE_REL} 의 compilerOptions 에 "${flag}" 키가 없다 — ` +
            '값을 false 로 바꾸는 것보다 키를 지우는 것이 더 짧은 우회로이므로 누락도 실패다',
        );
      } else if (opts[flag] !== true) {
        fail(`${BASE_REL} 의 "${flag}" 가 ${JSON.stringify(opts[flag])} 다 — true 여야 한다`);
      }
    }
  }
  if (base.value?.extends !== undefined) {
    fail(
      `${BASE_REL} 이 다른 설정을 extends 한다 (${JSON.stringify(base.value.extends)}) — ` +
        '기대값 원천은 자기 자신 안에서 세 플래그를 선언해야 한다',
    );
  }
}

// ── B/C. TS 패키지별 상속 · typecheck 스크립트 ──────────────────────────
const tsPackages = MEMBERS.filter((m) => isTsPackage(ROOT, m));
notes.push(
  `워크스페이스 멤버 ${MEMBERS.length}건 중 TS 패키지 ${tsPackages.length}건: ` +
    `${tsPackages.map((m) => m.dir).join(', ') || '(없음)'}`,
);
notes.push(
  `TS 패키지 아님: ${MEMBERS.filter((m) => !tsPackages.includes(m))
    .map((m) => m.dir)
    .join(', ') || '(없음)'}`,
);

if (tsPackages.length === 0) {
  fail(
    'TS 패키지를 1건도 찾지 못했다 — 검사 대상 0건은 통과가 아니라 실패다 ' +
      '(전건 통과가 "아무것도 검사하지 않음"으로 만족되는 것을 막는다)',
  );
}

for (const m of tsPackages) {
  const tsconfigAbs = path.join(ROOT, m.dir, 'tsconfig.json');
  if (!fs.existsSync(tsconfigAbs)) {
    fail(
      `${m.dir} 는 TS 소스를 가진 워크스페이스 패키지인데 tsconfig.json 이 없다 — ` +
        `${BASE_REL} 의 세 플래그를 상속하지 않는다`,
    );
  } else {
    const resolved = resolveExtendsChain(ROOT, tsconfigAbs);
    if (!resolved.ok) {
      fail(`${m.dir}/tsconfig.json: ${resolved.error}`);
    } else {
      const inherits = resolved.chain.some((c) => path.resolve(c.abs) === path.resolve(baseAbs));
      if (!inherits) {
        fail(
          `${m.dir}/tsconfig.json 이 ${BASE_REL} 을 extends 하지 않는다 ` +
            `(상속 체인: ${resolved.chain.map((c) => c.rel).join(' → ')}) — ` +
            '상속이 끊기면 그 패키지는 느슨한 기본값으로 컴파일된다',
        );
      }
      // 재선언 금지: base 자신을 제외한 체인의 모든 설정
      for (const link of resolved.chain) {
        if (path.resolve(link.abs) === path.resolve(baseAbs)) continue;
        const opts = link.config?.compilerOptions ?? {};
        for (const flag of REQUIRED_FLAGS) {
          if (Object.prototype.hasOwnProperty.call(opts, flag)) {
            fail(
              `${link.rel} 이 "${flag}" 를 ${JSON.stringify(opts[flag])} 로 재선언한다 — ` +
                `세 플래그는 ${BASE_REL} 에서만 선언한다 (하위 재선언은 상속을 무력화하는 우회로다)`,
            );
          }
        }
      }
    }
  }

  // C. (검수 지적 B-E) typecheck 스크립트의 **존재**를 보장한다.
  //    `pnpm -r typecheck` 는 스크립트가 없는 패키지를 오류 없이 건너뛰므로,
  //    스크립트를 지우면 그 패키지의 타입 오류가 CI 에서 사라진다.
  const scripts = m.pkg?.scripts ?? {};
  const script = scripts.typecheck;
  if (typeof script !== 'string' || script.trim() === '') {
    fail(
      `${m.dir}/package.json 에 typecheck 스크립트가 없다 — ` +
        '`pnpm -r typecheck` 는 스크립트가 없는 패키지를 조용히 건너뛰므로 ' +
        '부재는 "타입 검사 면제"와 같다 (검수 지적 B-E)',
    );
  } else {
    if (!/\btsc\b/.test(script)) {
      fail(`${m.dir} 의 typecheck 스크립트가 tsc 를 실행하지 않는다: "${script}"`);
    }
    const project = /(?:^|\s)(?:-p|--project)(?:=|\s+)(\S+)/.exec(script);
    if (project === null) {
      fail(
        `${m.dir} 의 typecheck 스크립트가 -p/--project 로 대상을 지정하지 않는다: "${script}" — ` +
          '대상 미지정은 검사 범위를 암묵값에 맡긴다',
      );
    } else if (project[1].replace(/^\.\//, '') !== 'tsconfig.json') {
      fail(
        `${m.dir} 의 typecheck 대상이 "${project[1]}" 다 — ` +
          'tsconfig.json (세 플래그를 상속하는 설정) 이어야 한다',
      );
    }
    for (const flag of REQUIRED_FLAGS) {
      const off = new RegExp(`--${flag}(?:=|\\s+)false\\b`, 'i');
      if (off.test(script)) {
        fail(`${m.dir} 의 typecheck 스크립트가 커맨드라인에서 "${flag}" 를 끈다: "${script}"`);
      }
    }
  }
}

// ── 보고 ────────────────────────────────────────────────────────────────
console.log('');
console.log('── REQ-2 계약 테스트 ── tsconfig 세 플래그 · 상속 · typecheck 스크립트 존재 ──');
console.log(`  · root=${ROOT}`);
for (const n of notes) console.log(`  · ${n}`);
console.log('');
console.log(`  [${violations.length === 0 ? 'PASS' : 'FAIL'}] 검사 플래그 ${REQUIRED_FLAGS.join(' · ')}`);
console.log(`  [${violations.length === 0 ? 'PASS' : 'FAIL'}] TS 패키지 ${tsPackages.length}건 (상속 · 재선언 금지 · typecheck 스크립트)`);

if (violations.length > 0) {
  console.log('');
  console.log(`  VIOLATIONS (${violations.length}):`);
  violations.forEach((v, i) => console.log(`    ${String(i + 1).padStart(2)}. ${v}`));
  console.log('');
  console.error(
    `REQ-2 계약 테스트: FAIL — 위반 ${violations.length}건. ` +
      `tsc 가 exit 0 이어도 세 플래그가 꺼져 있으면 REQ-2 는 충족되지 않는다`,
  );
  process.exitCode = 1;
} else {
  console.log('');
  console.log(
    `REQ-2 계약 테스트: PASS — 세 플래그 true · TS 패키지 ${tsPackages.length}건 전부 상속 · ` +
      'typecheck 스크립트 존재',
  );
}
