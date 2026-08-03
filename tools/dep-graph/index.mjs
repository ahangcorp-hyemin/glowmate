#!/usr/bin/env node
/**
 * F1 REQ-3 / FORBID-1 — 워크스페이스 경계 검사기 (`pnpm test:dep-graph`).
 *
 * 제외 집합은 packages/api · packages/db 두 패키지다. 그 밖의 모든 워크스페이스 패키지에 대해:
 *
 *   (a) 도달성   — 의존 그래프상 packages/db 및 Postgres 와이어 드라이버(데이터 접근 패키지) 노드가
 *                  도달 불가능해야 한다.                                      → REQ-3 (a) · FORBID-1 (a)
 *   (b) 분류     — dependencies + devDependencies 전 항목이 dependency-classes.json 에 분류돼 있어야 하고
 *                  (미분류 1건이면 exit 1), `data-access` 분류 의존을 가지면 exit 1.
 *                                                                             → REQ-3 (b) · FORBID-1 (b)
 *   (iii) 위장   — data-access-names.json 에 매칭되는 이름을 `other` 로 등재하면 승인 대상이다.
 *                                                                             → REQ-3 (iii)
 *   승인 게이트  — data-access 신규 추가 · 분류 변경 · 위장 등재 · 예외 파일 항목 변경은
 *                  packages/config CODEOWNERS 승인(승인자 ≠ PR 작성자)을 요구한다.
 *   예외         — db-driver-exceptions.json 항목은 사유 · 만료일(≤90일) · 승인자 3필드 필수.
 *                                                                             → FORBID-1 (c)
 *
 * 판정 원칙
 *   - 실패 메시지는 규칙 ID 토큰(REQ-3 / FORBID-1)을 반드시 포함한다 (F1 REQ-5 귀속 검증).
 *   - 검사 대상이 0건이면 통과가 아니라 실패다 (공허한 초록 금지).
 *   - CI 컨텍스트에서 판정에 필요한 정보를 얻지 못하면 실패다 (판정 불가 ≠ 통과).
 *   - 종료 코드를 마스킹하지 않는다 (FORBID-2).
 *
 * 사용법: node tools/dep-graph/index.mjs [--root <dir>]
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { Report, PASS, FAIL, SKIP } from './lib/report.mjs';
import { discoverMembers } from './lib/workspace.mjs';
import {
  CLASSES_FILE,
  CONFIG_DIR,
  EXCEPTIONS_FILE,
  NAMES_FILE,
  CLASS_DATA_ACCESS,
  CLASS_OTHER,
  loadClasses,
  loadDataAccessNames,
  loadExceptions,
  makeNameMatcher,
  readJson,
  findException,
  EXCEPTION_MAX_DAYS,
} from './lib/config.mjs';
import {
  WS,
  NPM,
  DEP_FIELDS,
  POSTGRES_WIRE_DRIVERS,
  isPostgresWireDriver,
  buildPackageGraph,
  augmentWithLockfile,
  describeNode,
  formatPath,
  shortNode,
} from './lib/graph.mjs';
import {
  isCI,
  resolveBaseRef,
  computeApprovalRequirements,
  countPushCollaborators,
  verifyApproval,
  verifySingleMaintainer,
} from './lib/approval.mjs';
import { runDependencyCruiser } from './lib/depcruise.mjs';

/** REQ-3 statement 가 고정한 제외 집합. 이 값을 늘리면 경계가 사라진다. */
export const EXCLUDED_DIRS = ['packages/api', 'packages/db'];
/** (a) 의 1차 금지 노드: packages/db 워크스페이스 패키지 */
const DB_PACKAGE_DIR = 'packages/db';

function parseArgs(argv) {
  const args = { root: process.cwd() };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--root') {
      args.root = path.resolve(argv[i + 1] ?? '.');
      i += 1;
    } else if (argv[i].startsWith('--root=')) {
      args.root = path.resolve(argv[i].slice('--root='.length));
    } else {
      throw new Error(`알 수 없는 인자: ${argv[i]}`);
    }
  }
  return args;
}

export async function run({ root, env = process.env, now = new Date() }) {
  const report = new Report();
  const ci = isCI(env);
  report.note(`root=${root}`);
  report.note(`context=${ci ? 'CI (GITHUB_ACTIONS)' : 'local'}`);
  report.note(`제외 집합(REQ-3) = ${EXCLUDED_DIRS.join(', ')}`);

  // ── 0. 정본 설정 로딩 ───────────────────────────────────────────────
  const classesRes = loadClasses(root);
  const namesRes = loadDataAccessNames(root);
  const excRes = loadExceptions(root, now);

  for (const e of classesRes.errors ?? []) {
    report.violation(['REQ-3(b)', 'FORBID-1'], e);
  }
  for (const e of namesRes.errors ?? []) {
    report.violation(['REQ-3(iii)', 'FORBID-1'], e);
  }
  for (const e of excRes.errors ?? []) {
    report.violation(['FORBID-1(c)', 'REQ-3'], e);
  }
  if (!classesRes.classes || !namesRes.names) {
    report.check('config', FAIL, '정본 설정 파일을 읽지 못해 판정 불가');
    report.print();
    return { code: 1, report };
  }
  const classes = classesRes.classes;
  const matchDataAccessName = makeNameMatcher(namesRes.names);
  report.check(
    'config',
    classesRes.ok && namesRes.ok && excRes.ok ? PASS : FAIL,
    `${CLASSES_FILE} 분류 ${Object.keys(classes).length}건 · ` +
      `${NAMES_FILE} 이름 ${namesRes.names.length}건 · ` +
      `${EXCEPTIONS_FILE} 예외 ${excRes.entries.length}건 (필수 3필드 · 만료 ≤ ${EXCEPTION_MAX_DAYS}일)`,
  );

  // ── 1. 워크스페이스 멤버 탐색 ───────────────────────────────────────
  const ws = discoverMembers(root);
  for (const e of ws.errors) report.violation(['REQ-3', 'FORBID-1'], `워크스페이스 탐색 실패: ${e}`);
  const excluded = ws.members.filter((m) => EXCLUDED_DIRS.includes(m.dir));
  const targets = ws.members.filter((m) => !EXCLUDED_DIRS.includes(m.dir));

  if (targets.length === 0) {
    report.violation(
      ['REQ-3', 'FORBID-1'],
      '검사 대상 워크스페이스 패키지가 0건이다 — 검사가 공허하므로 통과로 처리하지 않는다 ' +
        `(멤버 ${ws.members.length}건, 글롭 ${JSON.stringify(ws.globs)})`,
    );
    report.check('targets', FAIL, '검사 대상 0건');
  } else {
    report.check(
      'targets',
      PASS,
      `검사 대상 ${targets.length}건 [${targets.map((t) => t.dir).join(', ')}] · ` +
        `제외 ${excluded.length}건 [${excluded.map((t) => t.dir).join(', ') || '-'}]`,
    );
  }
  report.note(
    '워크스페이스 루트(./package.json)는 pnpm-workspace 멤버가 아니므로 (b) 분류 대상이 아니다 — ' +
      '단 직접 의존의 데이터 접근 패키지 여부는 아래에서 검사한다',
  );

  const memberNames = new Set(ws.members.map((m) => m.name));

  // ── 2. 루트 package.json 직접 의존 가드 ─────────────────────────────
  const rootPkg = readJson(root, 'package.json');
  if (!rootPkg.ok) {
    report.violation(['REQ-3', 'FORBID-1'], `루트 package.json 을 읽지 못했다: ${rootPkg.error}`);
  } else {
    const hits = [];
    for (const field of DEP_FIELDS) {
      for (const dep of Object.keys(rootPkg.value?.[field] ?? {})) {
        const m = matchDataAccessName(dep);
        if (m) hits.push(`${field}."${dep}" (패턴 ${m})`);
      }
    }
    for (const h of hits) {
      report.violation(
        ['REQ-3(a)', 'FORBID-1(a)'],
        `워크스페이스 루트 package.json 이 데이터 접근 패키지를 직접 의존한다: ${h}`,
      );
    }
    report.check(
      'root-direct-deps',
      hits.length === 0 ? PASS : FAIL,
      `루트 직접 의존 ${hits.length}건이 data-access-names 에 매칭`,
    );
  }

  // ── 3. (b) 분류 허용목록 + data-access 0건 ──────────────────────────
  let inspectedDeps = 0;
  let unclassified = 0;
  let dataAccessDeps = 0;
  for (const t of targets) {
    for (const field of DEP_FIELDS) {
      const deps = t.pkg[field];
      if (deps === null || typeof deps !== 'object') continue;
      for (const depName of Object.keys(deps)) {
        if (memberNames.has(depName)) continue; // 워크스페이스 내부 링크는 외부 의존이 아니다
        inspectedDeps += 1;
        const cls = Object.prototype.hasOwnProperty.call(classes, depName) ? classes[depName] : null;
        if (cls === null) {
          unclassified += 1;
          report.violation(
            ['REQ-3(b)', 'FORBID-1(b)'],
            `${t.dir} 의 ${field}."${depName}" 이 ${CLASSES_FILE} 에 미분류다 — ` +
              '허용목록이므로 미분류 1건이면 실패다. 해당 PR 안에서 분류를 등재하라 ' +
              `(\`other\` 등재는 승인 불필요, \`data-access\` 등재·분류 변경·위장 등재는 ${CONFIG_DIR} CODEOWNERS 승인 필요)`,
          );
          continue;
        }
        if (cls === CLASS_DATA_ACCESS) {
          const exc = findException(excRes.entries, t.dir, t.name, depName);
          if (exc) {
            report.note(
              `EXEMPT ${t.dir} → "${depName}" (${EXCEPTIONS_FILE}, 만료 ${exc.expires_at}, 승인 ${exc.approved_by})`,
            );
            continue;
          }
          dataAccessDeps += 1;
          report.violation(
            ['REQ-3(b)', 'FORBID-1(b)'],
            `${t.dir} 의 ${field}."${depName}" 은 data-access 로 분류돼 있다 — ` +
              `제외 집합(${EXCLUDED_DIRS.join(' · ')}) 밖의 패키지는 data-access 의존을 가질 수 없다`,
          );
        }
      }
    }
  }
  report.check(
    'REQ-3(b) classification',
    unclassified === 0 && dataAccessDeps === 0 ? PASS : FAIL,
    `외부 의존 ${inspectedDeps}건 검사 · 미분류 ${unclassified}건 · data-access ${dataAccessDeps}건`,
  );

  // ── 4. (iii) 위장 등재 목록 ─────────────────────────────────────────
  const spoofs = [];
  for (const [name, cls] of Object.entries(classes)) {
    const pattern = matchDataAccessName(name);
    if (pattern && cls !== CLASS_DATA_ACCESS) {
      spoofs.push({ name, cls, pattern });
    }
  }
  report.check(
    'REQ-3(iii) spoof',
    PASS,
    spoofs.length === 0
      ? '알려진 데이터 접근 이름을 other 로 등재한 항목 없음'
      : `위장 등재 후보 ${spoofs.length}건 — ${spoofs
          .map((s) => `"${s.name}"→${s.cls} (패턴 ${s.pattern})`)
          .join(', ')} · 승인 게이트 대상`,
  );

  // ── 5. (a) 도달성 ───────────────────────────────────────────────────
  const graph = buildPackageGraph(root, ws.members);
  const lock = await augmentWithLockfile(graph, root, ws.members);
  if (lock.status === 'ok') {
    report.check('lockfile', PASS, lock.detail);
  } else if (ci) {
    report.violation(
      ['REQ-3(a)', 'FORBID-1(a)'],
      `CI 컨텍스트에서 전이 의존을 판정할 수 없다: ${lock.detail}. ` +
        '판정 불가를 통과로 처리하면 (a) 가 미탐이 되므로 실패로 보고한다',
    );
    report.check('lockfile', FAIL, lock.detail);
  } else {
    report.check(
      'lockfile',
      SKIP,
      `${lock.detail} — 로컬이므로 package.json + 워크스페이스 링크 그래프로 대체 판정한다 ` +
        '(외부 전이 간선 미판정 = 미탐 가능. CI 에서는 실패로 처리된다)',
    );
  }

  const dbNode = WS + DB_PACKAGE_DIR;
  const isForbiddenNode = (id) => {
    if (id === dbNode) return true;
    if (id.startsWith(NPM)) return matchDataAccessName(id.slice(NPM.length)) !== null;
    return false;
  };
  let reachHits = 0;
  let gatedHits = 0;
  for (const t of targets) {
    const found = graph.findReachable(WS + t.dir, isForbiddenNode);
    for (const hit of found) {
      const depName = hit.node.startsWith(NPM) ? hit.node.slice(NPM.length) : hit.node.slice(WS.length);
      const exc = findException(excRes.entries, t.dir, t.name, depName);
      if (exc) {
        report.note(
          `EXEMPT(도달성) ${t.dir} → ${shortNode(hit.node)} (${EXCEPTIONS_FILE}, 만료 ${exc.expires_at}, 승인 ${exc.approved_by})`,
        );
        continue;
      }
      // 경성 금지: packages/db 와 Postgres 와이어 드라이버. 여는 문은 예외 파일뿐이다.
      const hard = hit.node === dbNode || isPostgresWireDriver(depName);
      if (!hard && classes[depName] === CLASS_OTHER) {
        // Prisma·Supabase 류는 (b) 분류 + (iii) 위장 승인 게이트 관할이다.
        // `other` 등재 자체가 CODEOWNERS 승인을 통과한 상태이므로 (a) 로 이중 차단하지 않는다
        // — 이중 차단하면 승인 게이트가 열어줄 수 있는 문이 0개가 되어 원칙 2.5 를 깬다.
        gatedHits += 1;
        report.note(
          `GATED(도달성) ${t.dir} → ${shortNode(hit.node)} — ${CLASSES_FILE} 에 other 로 등재된 ` +
            '데이터 접근 이름이다. 등재 diff 는 REQ-3 (iii) 승인 게이트가 판정한다',
        );
        continue;
      }
      reachHits += 1;
      report.violation(
        ['REQ-3(a)', 'FORBID-1(a)'],
        `${t.dir} 에서 ${describeNode(hit.node)} 가 도달 가능하다: ${formatPath(hit.path, hit.via)}` +
          (hard
            ? ` — 경성 금지 노드다. 해제하려면 ${EXCEPTIONS_FILE} 등재(사유·만료일 ≤ ${EXCEPTION_MAX_DAYS}일·승인자)가 필요하다`
            : ` — ${CLASSES_FILE} 에 미분류이거나 data-access 로 분류된 데이터 접근 패키지다`),
      );
    }
  }
  report.check(
    'REQ-3(a) reachability',
    reachHits === 0 ? PASS : FAIL,
    `대상 ${targets.length}개 · 그래프 노드 ${graph.nodes.size}개 · 도달 위반 ${reachHits}건` +
      (gatedHits > 0 ? ` · 승인 게이트 관할 ${gatedHits}건` : '') +
      ` (경성 금지: [${DB_PACKAGE_DIR}] + 와이어 드라이버 ${POSTGRES_WIRE_DRIVERS.length}패턴 / ` +
      `연성: data-access-names ${namesRes.names.length}패턴)`,
  );

  // (a) 경성 목록은 정본(data-access-names.json)의 부분집합이어야 한다 — 두 목록이 갈라지면 미탐이 생긴다
  const uncovered = POSTGRES_WIRE_DRIVERS.filter(
    (p) => matchDataAccessName(p.replaceAll('*', 'x')) === null,
  );
  for (const p of uncovered) {
    report.violation(
      ['REQ-3(a)', 'REQ-3(iii)'],
      `와이어 드라이버 "${p}" 가 ${NAMES_FILE} 에 없다 — 정본 목록이 검사기보다 좁으면 ` +
        '`other` 위장 등재가 (iii) 승인 게이트를 우회한다',
    );
  }
  report.check(
    'wire-driver 목록 정합',
    uncovered.length === 0 ? PASS : FAIL,
    `와이어 드라이버 ${POSTGRES_WIRE_DRIVERS.length}패턴이 ${NAMES_FILE} 에 전부 포함됨`,
  );

  // ── 6. dependency-cruiser 보조 판정 ─────────────────────────────────
  const srcDirs = targets
    .map((t) => `${t.dir}/src`)
    .filter((d) => fs.existsSync(path.join(root, d)));
  const dc = runDependencyCruiser(root, srcDirs);
  if (dc.status === 'ok') {
    for (const v of dc.violations) {
      report.violation(
        ['REQ-3(a)', 'FORBID-1(a)'],
        `dependency-cruiser 규칙 "${v.rule?.name}" 위반: ${v.from} → ${v.to}`,
      );
    }
    report.check(
      'REQ-3(a) depcruise(보조)',
      dc.violations.length === 0 ? PASS : FAIL,
      dc.detail,
    );
  } else if (dc.status === 'no-target') {
    report.check('REQ-3(a) depcruise(보조)', SKIP, `${dc.detail} — 소스가 생기면 자동으로 활성화된다`);
  } else if (ci) {
    report.violation(
      ['REQ-3(a)', 'FORBID-1(a)'],
      `CI 컨텍스트에서 dependency-cruiser 보조 판정을 수행할 수 없다: ${dc.detail}`,
    );
    report.check('REQ-3(a) depcruise(보조)', FAIL, dc.detail);
  } else {
    report.check('REQ-3(a) depcruise(보조)', SKIP, `${dc.detail} (local)`);
  }

  // ── 7. 승인 게이트 ──────────────────────────────────────────────────
  const excRaw = readJson(root, EXCEPTIONS_FILE);
  if (!ci) {
    const pending = [
      ...spoofs.map((s) => `위장 등재 후보 "${s.name}"→${s.cls}`),
      ...excRes.entries.map((e) => `예외 항목 (${e.package} → ${e.dependency})`),
    ];
    report.check(
      'approval gate',
      SKIP,
      `SKIPPED(local) — 승인 검사(CODEOWNERS 승인 리뷰 / SINGLE_MAINTAINER (c-3) 독립 PR)는 ` +
        'CI 에서만 판정한다. ' +
        `현재 승인 대상 후보 ${pending.length}건${pending.length > 0 ? `: ${pending.join(' / ')}` : ''}`,
    );
  } else {
    const base = resolveBaseRef(root, env);
    if (!base.ok) {
      report.violation(
        ['REQ-3(ii)', 'REQ-3(iii)', 'FORBID-1(c)'],
        `CI 컨텍스트에서 base ref 를 찾지 못해 승인 대상 diff 를 판정할 수 없다 ` +
          `(시도: ${base.tried.join(', ')})`,
      );
      report.check('approval gate', FAIL, 'base ref 판정 불가');
    } else {
      const reqs = computeApprovalRequirements({
        root,
        baseRef: base.ref,
        headClasses: classes,
        headExceptionsRaw: excRaw.ok ? excRaw.value : [],
        matchDataAccessName,
        classesFile: CLASSES_FILE,
        exceptionsFile: EXCEPTIONS_FILE,
      });
      if (!reqs.ok) {
        report.violation(['REQ-3(ii)', 'FORBID-1(c)'], `승인 대상 diff 산출 실패: ${reqs.error}`);
        report.check('approval gate', FAIL, reqs.error);
      } else if (reqs.requirements.length === 0) {
        report.check('approval gate', PASS, `base=${base.ref} 대비 승인 대상 diff 없음`);
      } else {
        // REQ-7 acceptance (c) — push 권한 보유 collaborator 수로 적용 규약을 가른다.
        // 조회 실패는 판정 불가 = 실패다 (실패를 1명으로 간주하면 누구나 완화 규약으로 내려온다).
        const collab = await countPushCollaborators({ env });
        if (!collab.ok) {
          for (const r of reqs.requirements) {
            report.violation(
              ['REQ-3(ii)', 'REQ-3(iii)', 'FORBID-1(c)'],
              `승인 필요한 변경인데 적용 규약(승인 리뷰 / single_maintainer)을 판정할 수 없다 — ` +
                `${r.detail} :: ${collab.error}`,
            );
          }
          report.check('approval gate', FAIL, collab.error);
        } else if (collab.count >= 2) {
          const verdict = await verifyApproval({ root, env, ownerPath: CLASSES_FILE });
          if (verdict.ok) {
            report.check(
              'approval gate',
              PASS,
              `push collaborator ${collab.count}명 · 승인 대상 ${reqs.requirements.length}건 · ` +
                `승인자 "${verdict.approver}" (≠ PR 작성자)`,
            );
            for (const r of reqs.requirements) report.note(`APPROVED ${r.kind}: ${r.detail}`);
          } else {
            for (const r of reqs.requirements) {
              report.violation(
                ['REQ-3(ii)', 'REQ-3(iii)', 'FORBID-1(c)'],
                `승인 필요한 변경인데 승인을 확인하지 못했다 — ${r.detail} :: ${verdict.error}`,
              );
            }
            report.check('approval gate', FAIL, verdict.error);
          }
        } else {
          // single_maintainer — 타인 승인이 물리적으로 불가능한 상태.
          // 완화가 아니라 치환이다: 승인 리뷰 대신 REQ-7 (c-3) 독립 PR 요구를 적용한다.
          // 3필드 검사(FORBID-1 c)와 위장 검사(iii)는 위에서 그대로 수행됐다.
          // (c-1) 만료일 검사는 REQ-7 소관(tools/ci-meta)이므로 여기서 중복 구현하지 않는다.
          report.note(
            `SINGLE_MAINTAINER — push 권한 보유 collaborator 가 ${collab.count}명` +
              `(${(collab.logins ?? []).join(', ')})이므로 "승인자 ≠ PR 작성자" 를 충족할 수 없다. ` +
              'REQ-7 (c-3) 독립 PR 요구로 치환해 판정한다 (만료일 검사는 REQ-7/ci-meta 소관)',
          );
          const sm = verifySingleMaintainer({
            root,
            baseRef: base.ref,
            requirements: reqs.requirements,
          });
          if (sm.ok) {
            report.check(
              'approval gate',
              PASS,
              `SINGLE_MAINTAINER · 승인 대상 ${reqs.requirements.length}건 · ${sm.detail}`,
            );
            for (const r of reqs.requirements) report.note(`SINGLE_MAINTAINER ${r.kind}: ${r.detail}`);
          } else {
            for (const r of reqs.requirements) {
              report.violation(
                ['REQ-3(ii)', 'REQ-3(iii)', 'FORBID-1(c)'],
                `SINGLE_MAINTAINER 상태의 승인 대체 조건을 만족하지 못했다 — ${r.detail} :: ${sm.error}`,
              );
            }
            report.check('approval gate', FAIL, `SINGLE_MAINTAINER · ${sm.error}`);
          }
        }
      }
    }
  }

  report.print();
  return { code: report.failed ? 1 : 0, report };
}

const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  const { code } = await run({ root: args.root });
  if (code === 0) {
    console.log('dep-graph: PASS — REQ-3 (a)(b)(iii) · FORBID-1 (a)(b)(c) 위반 없음');
  } else {
    console.error(
      'dep-graph: FAIL — REQ-3 / FORBID-1 위반이 있다. 위 VIOLATIONS 목록을 해소하라 (exit 1)',
    );
  }
  process.exit(code);
}
