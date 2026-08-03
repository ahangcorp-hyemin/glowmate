import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { extractYamlBlocks, loadContracts, parseTouches, readContractId } from '../lib/contract.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const TASKS_DIR = path.join(ROOT, 'docs', 'tasks');

const yaml = (body) => body;

test('블록 리스트 + 꼬리 주석 + 이어지는 주석 줄 (DS1.md 표기)', () => {
  const body = yaml(`deliverable:
  pr_count: 1
  touches:
    - packages/ui/styles/brand.css              # 팔레트 재정의
    # 주석만 있는 줄은 건너뛴다
    - packages/config/test/workspace.test.ts    # 기대값 갱신 1건만
                                                #   (규칙 안의 명시적 예외)
    - "packages/ui/package.json"
  artifacts:
    - "x"
`);
  const { present, entries, form } = parseTouches(body);
  assert.equal(present, true);
  assert.equal(form, 'block');
  assert.deepEqual(entries, [
    'packages/ui/styles/brand.css',
    'packages/config/test/workspace.test.ts',
    'packages/ui/package.json',
  ]);
});

test('인라인 리스트 (규격 §1 예시 표기)', () => {
  const { entries, form } = parseTouches('  touches:     [packages/pipeline/src/price/**]\n');
  assert.equal(form, 'inline');
  assert.deepEqual(entries, ['packages/pipeline/src/price/**']);
});

test('여러 줄에 걸친 인라인 리스트도 최초 `]` 까지 읽는다', () => {
  const body = `  touches: [apps/web/**,
    packages/api/package.json,   # 꼬리 주석
    tools/path-guard/**]
  artifacts: [x]
`;
  const { entries } = parseTouches(body);
  assert.deepEqual(entries, ['apps/web/**', 'packages/api/package.json', 'tools/path-guard/**']);
});

test('touches 키가 없으면 present=false (판정 불가로 구분된다)', () => {
  assert.deepEqual(parseTouches('deliverable:\n  pr_count: 1\n'), {
    present: false,
    entries: [],
    form: null,
  });
});

test('닫히지 않은 인라인 리스트는 present=true·entries=0 (파싱 실패 = exit 1 대상)', () => {
  const { present, entries } = parseTouches('  touches: [apps/web/**,\n    packages/api/**\n');
  assert.equal(present, true);
  assert.equal(entries.length, 0);
});

test('빈 블록 리스트도 present=true·entries=0', () => {
  const { present, entries } = parseTouches('  touches:\n  artifacts:\n    - x\n');
  assert.equal(present, true);
  assert.equal(entries.length, 0);
});

test('yaml 펜스 2개인 문서에서 id 별로 블록을 구분한다 (C3.md)', () => {
  const text = fs.readFileSync(path.join(TASKS_DIR, 'C3.md'), 'utf8');
  const blocks = extractYamlBlocks(text);
  assert.ok(blocks.length >= 2);
  const ids = blocks.map(readContractId);
  assert.ok(ids.includes('C3-ADAPTER-KAKAO'));
});

test('실제 계약 전량: id 로 해석되고 touches 파싱 결과가 비지 않는다', () => {
  const { byId } = loadContracts(TASKS_DIR);
  assert.ok(byId.has('F1-REPO-SCAFFOLD'));
  assert.ok(byId.size >= 40, `계약 ${byId.size}건만 해석됨`);

  const empty = [];
  for (const [id, contract] of byId) {
    const { present, entries } = parseTouches(contract.body);
    if (present && entries.length === 0) empty.push(`${id} (${path.basename(contract.file)})`);
  }
  assert.deepEqual(empty, [], `touches 파싱 결과가 빈 계약: ${empty.join(', ')}`);
});

test('F1 계약의 touches 가 계약 원문과 일치한다', () => {
  const { byId } = loadContracts(TASKS_DIR);
  const { entries } = parseTouches(byId.get('F1-REPO-SCAFFOLD').body);
  for (const expected of [
    'package.json',
    'pnpm-workspace.yaml',
    'apps/web/**',
    'packages/config/**',
    'services/crawler/**',
    '.github/workflows/ci.yml',
    '.github/pr-task',
    'tools/path-guard/**',
  ]) {
    assert.ok(entries.includes(expected), `누락: ${expected}`);
  }
  assert.ok(!entries.some((e) => e.includes('#')), '주석이 경로에 섞였다');
});
