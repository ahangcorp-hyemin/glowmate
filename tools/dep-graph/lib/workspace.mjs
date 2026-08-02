/**
 * 워크스페이스 멤버 탐색.
 *
 * pnpm-workspace.yaml 의 `packages:` 글롭만 읽으면 되므로 외부 YAML 파서를 쓰지 않는다
 * (루트 devDependencies 는 CI 에서만 설치되며, 이 검사기는 node_modules 없이도 동작해야 한다).
 * 파싱에 실패해 목록이 비면 **조용히 통과하지 않고 호출측에서 exit 1** 로 처리한다.
 */
import fs from 'node:fs';
import path from 'node:path';

/** `packages:` 시퀀스만 뽑는 최소 파서. 인라인 리스트와 블록 시퀀스를 모두 지원한다. */
export function parseWorkspaceGlobs(text) {
  const lines = text.split(/\r?\n/);
  const globs = [];
  let inBlock = false;
  for (const raw of lines) {
    const line = stripComment(raw);
    if (line.trim() === '') continue;
    const topLevel = /^\S/.test(line);
    if (topLevel) {
      const m = /^packages\s*:\s*(.*)$/.exec(line);
      if (m) {
        const inline = m[1].trim();
        if (inline.startsWith('[')) {
          for (const item of inline.replace(/^\[/, '').replace(/\]\s*$/, '').split(',')) {
            const v = unquote(item.trim());
            if (v) globs.push(v);
          }
          inBlock = false;
        } else if (inline === '') {
          inBlock = true;
        } else {
          globs.push(unquote(inline));
          inBlock = false;
        }
        continue;
      }
      inBlock = false;
      continue;
    }
    if (inBlock) {
      const m = /^\s+-\s+(.*)$/.exec(line);
      if (m) {
        const v = unquote(m[1].trim());
        if (v) globs.push(v);
      }
    }
  }
  return globs;
}

function stripComment(line) {
  // 따옴표 밖의 `#` 만 주석으로 취급한다.
  let quote = null;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
    } else if (ch === '#' && (i === 0 || /\s/.test(line[i - 1]))) {
      return line.slice(0, i);
    }
  }
  return line;
}

function unquote(v) {
  const t = v.trim();
  if ((t.startsWith("'") && t.endsWith("'")) || (t.startsWith('"') && t.endsWith('"'))) {
    return t.slice(1, -1);
  }
  return t;
}

/** 디렉터리 글롭(`*`, `**`) 해석. 파일 시스템을 실제로 훑는다. */
function expandGlob(root, glob) {
  const segments = glob.split('/').filter((s) => s !== '' && s !== '.');
  let current = [''];
  for (const seg of segments) {
    const next = [];
    for (const dir of current) {
      const abs = path.join(root, dir);
      if (seg === '**') {
        next.push(dir);
        for (const sub of walkDirs(abs)) next.push(dir === '' ? sub : `${dir}/${sub}`);
        continue;
      }
      if (seg.includes('*')) {
        const re = new RegExp(`^${seg.split('*').map(escapeRe).join('[^/]*')}$`);
        for (const entry of readDirs(abs)) {
          if (re.test(entry)) next.push(dir === '' ? entry : `${dir}/${entry}`);
        }
        continue;
      }
      if (readDirs(abs).includes(seg)) next.push(dir === '' ? seg : `${dir}/${seg}`);
    }
    current = [...new Set(next)];
  }
  return current.filter((d) => d !== '');
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function readDirs(abs) {
  try {
    return fs
      .readdirSync(abs, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name !== 'node_modules' && !e.name.startsWith('.'))
      .map((e) => e.name);
  } catch (e) {
    // 존재하지 않는 글롭 경로(예: apps/ 가 아직 없음)는 정상 상태이므로 빈 목록이다.
    // 그 외의 오류(권한 등)는 삼키지 않고 올린다 — 조용한 빈 결과는 검사 대상 소실로 이어진다.
    if (e.code === 'ENOENT' || e.code === 'ENOTDIR') return [];
    throw e;
  }
}

function walkDirs(abs, prefix = '') {
  const out = [];
  for (const name of readDirs(abs)) {
    const rel = prefix === '' ? name : `${prefix}/${name}`;
    out.push(rel);
    out.push(...walkDirs(path.join(abs, name), rel));
  }
  return out;
}

/**
 * @returns {{globs: string[], members: {dir: string, name: string, pkg: object}[], errors: string[]}}
 */
export function discoverMembers(root) {
  const errors = [];
  const wsPath = path.join(root, 'pnpm-workspace.yaml');
  if (!fs.existsSync(wsPath)) {
    return { globs: [], members: [], errors: [`pnpm-workspace.yaml 이 없다 (${wsPath})`] };
  }
  const globs = parseWorkspaceGlobs(fs.readFileSync(wsPath, 'utf8'));
  if (globs.length === 0) {
    errors.push('pnpm-workspace.yaml 의 packages: 목록이 비어 있거나 파싱되지 않았다');
    return { globs, members: [], errors };
  }
  const include = globs.filter((g) => !g.startsWith('!'));
  const exclude = globs.filter((g) => g.startsWith('!')).map((g) => g.slice(1));
  const excluded = new Set(exclude.flatMap((g) => expandGlob(root, g)));

  const dirs = [...new Set(include.flatMap((g) => expandGlob(root, g)))]
    .filter((d) => !excluded.has(d))
    .sort();

  const members = [];
  for (const dir of dirs) {
    const pkgPath = path.join(root, dir, 'package.json');
    if (!fs.existsSync(pkgPath)) continue; // 글롭에 걸렸지만 패키지가 아닌 디렉터리
    let pkg;
    try {
      pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    } catch (e) {
      errors.push(`${dir}/package.json 파싱 실패: ${e.message}`);
      continue;
    }
    if (typeof pkg.name !== 'string' || pkg.name === '') {
      errors.push(`${dir}/package.json 에 name 이 없다`);
      continue;
    }
    members.push({ dir, name: pkg.name, pkg });
  }
  return { globs, members, errors };
}
