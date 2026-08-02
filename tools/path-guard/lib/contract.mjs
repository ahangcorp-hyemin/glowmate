/**
 * docs/tasks/<ID>.md 계약의 `touches` 블록을 직접 파싱한다.
 *
 * 왜 직접 파싱인가: `docs/tasks.json` 은 F1b-CONTRACT-GOVERNANCE 소유 산출물이다.
 * F1 이 단독 머지된 중간 상태에서도 path-guard 가 동작해야 하므로(F1.md FORBID-4 detect
 * "F1b 의 docs/tasks.json 에 의존하지 않는 자립 경로"), 계약 원문만 읽는다.
 *
 * 파싱 실패는 절대 통과가 아니다. 원문에 `touches:` 키가 있는데 항목을 하나도
 * 뽑지 못하면 호출자가 exit 1 한다 (scripts/tasks_manifest.py:20-22 가 남긴
 * "빈 리스트 = 조용한 통과 = 오탐보다 위험한 미탐" 경고와 같은 취지).
 */
import fs from 'node:fs';
import path from 'node:path';

const YAML_FENCE = /```yaml\n([\s\S]*?)```/g;
const ID_LINE = /^id:[ \t]*(.+?)[ \t]*$/m;

/** 한 줄에서 YAML 주석(` # ...`)을 떼고 따옴표를 벗긴다. */
export function stripComment(line) {
  let out = String(line).replace(/\s+#.*$/, '').trim();
  if (
    (out.startsWith('"') && out.endsWith('"') && out.length >= 2) ||
    (out.startsWith("'") && out.endsWith("'") && out.length >= 2)
  ) {
    out = out.slice(1, -1).trim();
  }
  return out;
}

/** 마크다운 문서에서 ```yaml 펜스 블록 전부를 뽑는다 (C3.md 처럼 2개인 파일이 있다). */
export function extractYamlBlocks(text) {
  const blocks = [];
  YAML_FENCE.lastIndex = 0;
  let m = YAML_FENCE.exec(text);
  while (m !== null) {
    blocks.push(m[1]);
    m = YAML_FENCE.exec(text);
  }
  return blocks;
}

export function readContractId(yamlBody) {
  const m = ID_LINE.exec(yamlBody);
  if (!m) return null;
  const id = stripComment(m[1]);
  return id === '' ? null : id;
}

/**
 * `touches:` 블록을 파싱한다.
 * 반환: { present: boolean, entries: string[], form: 'block'|'inline'|'scalar'|null }
 *  - present=false → 계약에 touches 키 자체가 없음 (호출자가 판정 불가로 처리)
 *  - present=true, entries=[] → 파싱 실패 (호출자가 exit 1)
 */
export function parseTouches(yamlBody) {
  const lines = String(yamlBody).split(/\r?\n/);
  const keyIdx = lines.findIndex((line) => /^[ \t]*touches:/.test(line));
  if (keyIdx === -1) return { present: false, entries: [], form: null };

  const keyLine = lines[keyIdx];
  const indent = keyLine.length - keyLine.replace(/^[ \t]*/, '').length;
  const rest = keyLine.replace(/^[ \t]*touches:/, '');

  // 1) 인라인 리스트 — `touches: [a, b]`. 대괄호가 여러 줄에 걸쳐도 최초 `]` 까지 읽는다.
  if (/^[ \t]*\[/.test(rest)) {
    const tail = [rest, ...lines.slice(keyIdx + 1)].join('\n');
    const open = tail.indexOf('[');
    const close = tail.indexOf(']', open + 1);
    if (close === -1) {
      // 닫히지 않은 리스트 = 파싱 실패. 빈 배열로 돌려 호출자가 exit 1 하게 한다.
      return { present: true, entries: [], form: 'inline' };
    }
    const inner = tail.slice(open + 1, close);
    const entries = inner
      .split(/\r?\n/)
      .map((line) => line.replace(/\s+#.*$/, ''))
      .join('\n')
      .split(',')
      .map((item) => stripComment(item))
      .filter((item) => item !== '');
    return { present: true, entries, form: 'inline' };
  }

  // 2) 스칼라 1건 — `touches: packages/x/**`
  const scalar = stripComment(rest);
  if (scalar !== '' && !scalar.startsWith('#')) {
    return { present: true, entries: [scalar], form: 'scalar' };
  }

  // 3) 블록 리스트 — 다음 줄부터 `- ` 항목이 이어진다.
  const entries = [];
  for (let i = keyIdx + 1; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === '') continue; // 빈 줄은 블록을 끝내지 않는다
    const lineIndent = line.length - line.replace(/^[ \t]*/, '').length;
    if (lineIndent <= indent) break; // 형제 키(artifacts: 등) → 블록 종료
    if (trimmed.startsWith('#')) continue; // 이어지는 주석 줄 (DS1.md 참조)
    if (!trimmed.startsWith('-')) break; // 리스트 항목이 아니면 블록 종료
    const value = stripComment(trimmed.replace(/^-[ \t]*/, ''));
    if (value !== '') entries.push(value);
  }
  return { present: true, entries, form: 'block' };
}

/**
 * docs/tasks/*.md 전부를 읽어 정본 ID → 계약 위치 맵을 만든다.
 * 파일명이 축약형(F1.md)이고 정본 ID 가 F1-REPO-SCAFFOLD 이므로 `id:` 필드로만 대조한다.
 */
export function loadContracts(tasksDir) {
  const files = fs
    .readdirSync(tasksDir)
    .filter((name) => name.endsWith('.md'))
    .sort();

  const byId = new Map();
  const duplicates = [];
  for (const name of files) {
    const file = path.join(tasksDir, name);
    const text = fs.readFileSync(file, 'utf8');
    for (const body of extractYamlBlocks(text)) {
      const id = readContractId(body);
      if (!id) continue;
      if (byId.has(id)) {
        duplicates.push({ id, files: [byId.get(id).file, file] });
        continue;
      }
      byId.set(id, { id, file, body });
    }
  }
  return { byId, duplicates, scanned: files.length };
}
