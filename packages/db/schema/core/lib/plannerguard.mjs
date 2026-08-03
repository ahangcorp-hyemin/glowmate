// packages/db/schema/core/lib/plannerguard.mjs — F2a REQ-2 부정행위 차단
//
// REQ-2 acceptance: "테스트 소스에 `enable_seqscan` 등 플래너 설정 변경 구문이 검출되면 exit 1".
//
// 이유: 인덱스가 실제로 쓰이는지를 보려는 검사인데, 순차 스캔을 꺼버리면 인덱스가 나쁘게
// 설계돼 있어도 플래너가 인덱스를 고를 수밖에 없다. 그 순간 REQ-2 는 "플래너를 강제했다"는
// 사실만 확인하게 된다.
//
// ⚠ 이 파일의 패턴 리터럴은 전부 문자 클래스로 쪼개져 있다(`enabl[e]_`). 그래야 검사 대상에
//   이 파일 자신이 포함돼도 자기 자신에 걸리지 않는다 — 자기 제외 목록을 두면 그 목록에
//   한 줄 추가하는 것이 우회의 최단 경로가 된다.

import fs from 'node:fs';
import path from 'node:path';

/** 플래너 설정을 바꾸는 구문. GUC 이름은 문자 클래스로 쪼개 자기 매치를 피한다. */
export const PLANNER_OVERRIDE_RE =
  /\b(?:SET|set_config|RESET)\b[^;\n]{0,120}?\b(?:enabl[e]_[a-z_]+|random_pag[e]_cost|seq_pag[e]_cost|cpu_[a-z_]*cos[t]|effective_cach[e]_size|ji[t]|from_collapse_limi[t]|join_collapse_limi[t]|geq[o])\b/i;

const SOURCE_EXTENSIONS = new Set(['.mjs', '.js', '.cjs', '.ts', '.sql', '.json']);

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      yield full;
    }
  }
}

/**
 * 지정 디렉터리들에서 플래너 설정 변경 구문을 찾는다.
 * @returns {{file: string, line: number, text: string}[]}
 */
export function scanPlannerOverrides(dirs) {
  const hits = [];
  let scanned = 0;
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const file of walk(dir)) {
      scanned += 1;
      const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
      lines.forEach((text, i) => {
        if (PLANNER_OVERRIDE_RE.test(text)) hits.push({ file, line: i + 1, text: text.trim() });
      });
    }
  }
  if (scanned === 0) {
    throw new Error('플래너 설정 스캔 대상 파일이 0건이다 — 검사 대상 0건을 통과로 처리하지 않는다');
  }
  return hits;
}

/** EXPLAIN(FORMAT JSON) 계획 트리에서 노드 타입을 전부 모은다. */
export function collectNodeTypes(plan, out = []) {
  if (Array.isArray(plan)) {
    for (const p of plan) collectNodeTypes(p, out);
    return out;
  }
  if (plan && typeof plan === 'object') {
    if (typeof plan['Node Type'] === 'string') out.push(plan['Node Type']);
    for (const value of Object.values(plan)) {
      if (value && typeof value === 'object') collectNodeTypes(value, out);
    }
  }
  return out;
}
