#!/usr/bin/env node
// tools/ci-meta/index.mjs — `pnpm test:ci-meta`
//
// F1-REPO-SCAFFOLD 의 CI 메타 검사기 총괄 진입점.
//   REQ-5    8 job 존재 · 픽스처 8종 런의 신선도 · 대응 job 만 red · 귀속 검증
//   REQ-6    timeout 예산 · 병렬성 · 필수 체크 등록 · **실패 전파 집행 검증(B-8)**
//   REQ-7    CODEOWNERS 7경로 · Code Owner 리뷰 필수화 · 소유자 ∩ 구현 에이전트 == ∅
//   FORBID-2 종료 코드 마스킹 / 검사 대상 축소 패턴 diff 스캔
//   FORBID-5 ci-budget.json 기존 항목 상향의 승인 요구
//
// 종료 코드: FAIL 이 1건이라도 있으면 1. 마스킹하지 않는다.
// CI 컨텍스트에서 판정 근거를 얻지 못하면(예: GitHub API 조회 불가) 그것도 FAIL 이다.

import { Report, repoRoot, guard, IS_CI } from './lib/util.mjs';
import { resolveBase } from './lib/git.mjs';
import { createGitHub } from './lib/github.mjs';
import { checkJobNames, readFixtureManifests, checkReq5Runs } from './checks/req5-fixtures.mjs';
import { checkReq6 } from './checks/req6-aggregator.mjs';
import { checkReq7 } from './checks/req7-codeowners.mjs';
import { checkForbid2 } from './checks/forbid2-masking.mjs';
import { checkForbid5 } from './checks/forbid5-budget.mjs';
import { runSelfTests } from './selftest.mjs';

const report = new Report('ci-meta (REQ-5 · REQ-6 · REQ-7 · FORBID-2 · FORBID-5)');

const root = repoRoot();
const gh = createGitHub();
const base = resolveBase(root);

report.info(
  'ci-meta',
  `context=${IS_CI ? 'CI' : 'local'} root=${root} github-api=${gh.available ? 'available' : `unavailable(${gh.reason})`} base=${base.ok ? `${base.ref}@${base.mergeBase.slice(0, 8)}` : `unresolved(${base.reason})`}`,
);

if (!base.ok && IS_CI) {
  report.fail(
    'ci-meta',
    'CI 컨텍스트에서 base 커밋을 해석할 수 없다 — diff 기반 검사(FORBID-2 · FORBID-5)를 수행할 수 없으므로 통과로 처리하지 않는다',
    base.reason,
  );
}

const ctx = { root, gh, base };

// 판정기 자기검사 — 위반 0건인 리포에서도 검사 로직이 실제로 위반을 잡는지 매 실행 입증한다.
await guard(report, 'ci-meta', '판정기 자기검사', async () => {
  const results = runSelfTests();
  if (results.length === 0) {
    report.fail('ci-meta', '자기검사 케이스가 0건이다 — 판정기의 탐지력이 입증되지 않았다');
    return;
  }
  for (const r of results) {
    if (r.ok) report.pass(r.rule, r.message);
    else report.fail(r.rule, r.message);
  }
});

let wf = null;
await guard(report, 'REQ-5', 'job 이름 집합', async () => {
  wf = checkJobNames(report, root);
});

let manifests = new Map();
await guard(report, 'REQ-5', '픽스처 트리', async () => {
  manifests = readFixtureManifests(report, root);
});

if (wf) {
  await guard(report, 'REQ-5', '픽스처 런 신선도·귀속 + REQ-6(c) 런타임', async () => {
    await checkReq5Runs(report, ctx, manifests, wf);
  });
}

await guard(report, 'REQ-6', 'timeout 예산·병렬성·필수 체크 등록·집행', async () => {
  await checkReq6(report, ctx);
});

await guard(report, 'REQ-7', 'CODEOWNERS', async () => {
  await checkReq7(report, ctx);
});

await guard(report, 'FORBID-2', '마스킹/대상축소 패턴 스캔', async () => {
  await checkForbid2(report, ctx);
});

await guard(report, 'FORBID-5', 'ci-budget 상향 승인', async () => {
  await checkForbid5(report, ctx);
});

process.exit(report.print());
