// tools/ci-meta/lib/workflow.mjs
//
// `.github/workflows/*.yml` 파싱 래퍼.
// 루트 devDependencies 의 `yaml` 만 사용한다 (신규 의존 추가 금지).
//
// job 별 **원문 라인 범위**를 제공하는 이유:
//   FORBID-2 의 제외 규칙이 "job 이름이 정확히 `ci-required` 인 job 의 `if:` 조건"으로
//   한정돼 있어, 파일 단위가 아니라 라인 단위로 예외를 판정해야 하기 때문이다.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { CheckError } from './util.mjs';

export const CI_WORKFLOW = '.github/workflows/ci.yml';

export class Workflow {
  constructor(root, relPath) {
    this.root = root;
    this.relPath = relPath;
    this.abs = path.join(root, relPath);
    if (!existsSync(this.abs)) {
      throw new CheckError(`워크플로 파일이 없다: ${relPath}`);
    }
    this.text = readFileSync(this.abs, 'utf8');
    this.doc = YAML.parseDocument(this.text);
    if (this.doc.errors.length > 0) {
      throw new CheckError(
        `${relPath} YAML 파싱 오류: ${this.doc.errors.map((e) => e.message).join(' | ')}`,
      );
    }
    this.data = this.doc.toJS() ?? {};
    this.#lineStarts = [0];
    for (let i = 0; i < this.text.length; i += 1) {
      if (this.text[i] === '\n') this.#lineStarts.push(i + 1);
    }
  }

  #lineStarts;

  /** 문자 오프셋 → 1-based 라인 번호 */
  lineAt(offset) {
    let lo = 0;
    let hi = this.#lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.#lineStarts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  }

  get jobNames() {
    const jobs = this.data.jobs;
    if (!jobs || typeof jobs !== 'object') {
      throw new CheckError(`${this.relPath} 에 jobs 매핑이 없다`);
    }
    return Object.keys(jobs);
  }

  job(name) {
    return this.data.jobs?.[name] ?? null;
  }

  /** jobs 매핑 노드에서 특정 job 의 Pair 를 찾는다. */
  #jobPair(name) {
    const jobsNode = this.doc.getIn(['jobs'], true);
    if (!jobsNode?.items) return null;
    return jobsNode.items.find((pair) => String(pair.key?.value) === name) ?? null;
  }

  /** job 블록의 [시작라인, 끝라인] (1-based, 양끝 포함). 없으면 null. */
  jobLineRange(name) {
    const pair = this.#jobPair(name);
    if (!pair) return null;
    const start = pair.key?.range?.[0];
    const end = pair.value?.range?.[2] ?? pair.key?.range?.[2];
    if (start == null || end == null) return null;
    return [this.lineAt(start), this.lineAt(Math.max(start, end - 1))];
  }

  /** job 내부 특정 필드(`if` 등)의 [시작라인, 끝라인]. 없으면 null. */
  jobFieldLineRange(name, field) {
    const pair = this.#jobPair(name);
    if (!pair?.value?.items) return null;
    const f = pair.value.items.find((p) => String(p.key?.value) === field);
    if (!f) return null;
    const start = f.key?.range?.[0];
    const end = f.value?.range?.[2] ?? f.key?.range?.[2];
    if (start == null || end == null) return null;
    return [this.lineAt(start), this.lineAt(Math.max(start, end - 1))];
  }
}

/** `.github/workflows` 하위 워크플로 상대경로 목록. */
export function listWorkflowFiles(root) {
  const dir = path.join(root, '.github', 'workflows');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
    .map((f) => `.github/workflows/${f}`)
    .sort();
}

/** GitHub Actions 표현식 `${{ ... }}` 껍데기를 벗긴 정규화 문자열. */
export function normalizeExpression(value) {
  if (value == null) return '';
  const s = String(value);
  return s.replace(/\$\{\{/g, ' ').replace(/\}\}/g, ' ').trim();
}
