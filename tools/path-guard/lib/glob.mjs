/**
 * 계약 touches 글롭 → 정규식 변환.
 *
 * 지원 문법 (docs/tasks/*.md 의 실제 표기 변이형에 맞춘 최소 집합):
 *   `**`     여러 세그먼트   — `apps/web/**`  → apps/web 아래 전부
 *   더블스타 뒤 슬래시       — 0개 이상 세그먼트
 *   `*`      한 세그먼트 내부 (`/` 를 넘지 않음) — `ops/alerts/o3-*.yml`
 *   `?`      한 글자 (`/` 제외)
 *   `{a,b}`  택일 — `packages/ui/src/components/{venue,tag}/*.cases.tsx`
 *   그 외 문자는 리터럴 (`<SOURCE_ID>` 같은 템플릿 자리표시자도 리터럴로 취급)
 *
 * 디렉터리 표기는 계약 전체가 `dir/**` 형태를 쓴다. 안전을 위해 `dir/` 로 끝나는
 * 항목만 `dir/**` 로 확장하고, 확장자 없는 맨 디렉터리명(`tools`)을 임의로
 * 디렉터리로 승격하지 않는다 — 그 승격은 글롭 범위를 조용히 넓혀
 * touches 밖 변경을 통과시키는 미탐이 된다.
 */
const REGEXP_SPECIAL = /[.+^$()|[\]\\]/;

function escapeChar(ch) {
  return REGEXP_SPECIAL.test(ch) ? `\\${ch}` : ch;
}

export function normalizePath(p) {
  let out = String(p).trim().replace(/\\/g, '/');
  while (out.startsWith('./')) out = out.slice(2);
  return out;
}

/** 글롭 문자열을 앵커된 정규식으로 변환한다. */
export function globToRegExp(pattern) {
  const raw = normalizePath(pattern);
  if (raw === '') throw new Error('빈 글롭 패턴은 허용하지 않는다');

  const src = raw.endsWith('/') ? `${raw}**` : raw;
  let out = '';
  let braceDepth = 0;

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];

    if (ch === '*') {
      if (src[i + 1] === '*') {
        i += 1;
        if (src[i + 1] === '/') {
          i += 1;
          out += '(?:[^/]+/)*'; // `**/` 는 0개 이상 세그먼트
        } else {
          out += '.*'; // 꼬리 `**` 는 여러 세그먼트
        }
      } else {
        out += '[^/]*'; // `*` 는 한 세그먼트 내부
      }
      continue;
    }
    if (ch === '?') {
      out += '[^/]';
      continue;
    }
    if (ch === '{') {
      braceDepth += 1;
      out += '(?:';
      continue;
    }
    if (ch === '}' && braceDepth > 0) {
      braceDepth -= 1;
      out += ')';
      continue;
    }
    if (ch === ',' && braceDepth > 0) {
      out += '|';
      continue;
    }
    out += escapeChar(ch);
  }

  if (braceDepth !== 0) {
    throw new Error(`글롭의 중괄호가 닫히지 않았다: ${raw}`);
  }
  return new RegExp(`^${out}$`);
}

/** 패턴 목록을 1회 컴파일해 재사용한다. */
export function compilePatterns(patterns) {
  return patterns.map((pattern) => ({ pattern, re: globToRegExp(pattern) }));
}

/** 경로가 컴파일된 패턴 중 하나라도 매칭되면 그 패턴을, 아니면 null 을 돌려준다. */
export function matchPath(filePath, compiled) {
  const target = normalizePath(filePath);
  for (const { pattern, re } of compiled) {
    if (re.test(target)) return pattern;
  }
  return null;
}
