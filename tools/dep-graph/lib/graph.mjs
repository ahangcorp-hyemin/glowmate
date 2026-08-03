/**
 * 의존 그래프 구성 + 도달성 판정 (REQ-3 (a) / FORBID-1 (a)).
 *
 * 그래프 원천은 두 겹이다:
 *   1) 각 워크스페이스 패키지의 package.json + 워크스페이스 링크  — 항상 사용
 *   2) pnpm-lock.yaml 의 importers/snapshots (외부→외부 전이 간선) — 있으면 우선 사용
 *
 * lockfile 이 없거나 파싱할 수 없으면 전이 간선을 알 수 없다 = **미탐**이다.
 * 따라서 그 상태를 조용히 통과시키지 않고 호출측(index.mjs)이
 * CI 컨텍스트에서는 exit 1, 로컬에서는 명시적 경고로 처리한다.
 */
import fs from 'node:fs';
import path from 'node:path';

export const WS = 'ws:';
export const NPM = 'npm:';

export const DEP_FIELDS = ['dependencies', 'devDependencies'];
export const REACH_FIELDS = [
  'dependencies',
  'devDependencies',
  'optionalDependencies',
  'peerDependencies',
];

/**
 * REQ-3 (a) 의 **경성 금지 노드** — "Postgres 와이어 드라이버".
 *
 * (a) 는 도달 자체를 금지하므로 여는 문이 db-driver-exceptions.json 하나뿐이다.
 * 반면 Prisma·Supabase 류 데이터 접근 클라이언트는 계약상 (b) 분류 + (iii) 위장 승인 게이트가
 * 담당한다 — 그쪽까지 (a) 로 경성 금지하면 승인 게이트가 열어줄 수 있는 문이 0개가 되어
 * 원칙 2.5(합법 경로 보장)를 깬다. 그래서 두 층을 분리한다.
 *
 * 이 목록의 전 항목은 packages/config/data-access-names.json 에도 반드시 존재해야 하며
 * (index.mjs 가 실행 시 assert 한다) 이름 열거만으로 판정하지 않는다 —
 * (b) 허용목록 · (iii) 위장 검사 · 승인 게이트가 함께 작동한다.
 */
export const POSTGRES_WIRE_DRIVERS = [
  'pg',
  'pg-native',
  'pg-promise',
  'postgres',
  '@vercel/postgres',
  '@neondatabase/*',
  'slonik',
];

export function isPostgresWireDriver(name) {
  return POSTGRES_WIRE_DRIVERS.some((p) =>
    p.includes('*')
      ? new RegExp(`^${p.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')}$`).test(name)
      : p === name,
  );
}

export class Graph {
  constructor() {
    /** @type {Map<string, Map<string, string>>} to -> via(설명) */
    this.edges = new Map();
    /** @type {Set<string>} */
    this.nodes = new Set();
  }

  addNode(id) {
    this.nodes.add(id);
    if (!this.edges.has(id)) this.edges.set(id, new Map());
  }

  addEdge(from, to, via) {
    this.addNode(from);
    this.addNode(to);
    const m = this.edges.get(from);
    if (!m.has(to)) m.set(to, via);
  }

  /**
   * from 에서 target 판정 함수가 true 인 노드까지의 최단 경로들을 모두 찾는다.
   * @returns {{node: string, path: string[], via: string[]}[]}
   */
  findReachable(from, isTarget) {
    const found = [];
    const seen = new Set([from]);
    /** @type {{id: string, path: string[], via: string[]}[]} */
    let frontier = [{ id: from, path: [from], via: [] }];
    while (frontier.length > 0) {
      const next = [];
      for (const cur of frontier) {
        for (const [to, via] of this.edges.get(cur.id) ?? []) {
          if (seen.has(to)) continue;
          seen.add(to);
          const node = { id: to, path: [...cur.path, to], via: [...cur.via, via] };
          if (isTarget(to)) found.push({ node: to, path: node.path, via: node.via });
          next.push(node);
        }
      }
      frontier = next;
    }
    return found;
  }
}

/** package.json 기반 그래프 (항상 구성) */
export function buildPackageGraph(root, members) {
  const graph = new Graph();
  const byName = new Map(members.map((m) => [m.name, m]));
  for (const m of members) graph.addNode(WS + m.dir);

  for (const m of members) {
    for (const field of REACH_FIELDS) {
      const deps = m.pkg[field];
      if (deps === null || typeof deps !== 'object') continue;
      for (const depName of Object.keys(deps)) {
        const linked = byName.get(depName);
        const to = linked ? WS + linked.dir : NPM + depName;
        graph.addEdge(WS + m.dir, to, `${m.dir}/package.json:${field}`);
      }
    }
  }
  return graph;
}

/** pnpm-lock.yaml 의 이름을 추출: `@scope/name@1.2.3(peer)` → `@scope/name` */
export function depPathToName(id) {
  if (typeof id !== 'string' || id === '') return null;
  const start = id.startsWith('@') ? 1 : 0;
  const at = id.indexOf('@', start);
  const name = at === -1 ? id : id.slice(0, at);
  return name === '' ? null : name;
}

/**
 * lockfile 을 읽어 그래프에 전이 간선을 추가한다.
 * @returns {Promise<{status: 'ok'|'absent'|'no-parser'|'unusable', detail: string, edges?: number}>}
 */
export async function augmentWithLockfile(graph, root, members) {
  const lockPath = path.join(root, 'pnpm-lock.yaml');
  if (!fs.existsSync(lockPath)) {
    return { status: 'absent', detail: 'pnpm-lock.yaml 이 없다 — 외부 전이 의존을 판정할 수 없다' };
  }
  let YAML;
  try {
    YAML = (await import('yaml')).default ?? (await import('yaml'));
  } catch {
    return {
      status: 'no-parser',
      detail:
        "pnpm-lock.yaml 은 있으나 'yaml' 모듈을 로드할 수 없다 (pnpm install 미수행) — 전이 의존 미판정",
    };
  }
  let doc;
  try {
    doc = YAML.parse(fs.readFileSync(lockPath, 'utf8'));
  } catch (e) {
    return { status: 'unusable', detail: `pnpm-lock.yaml 파싱 실패: ${e.message}` };
  }
  return applyLockfileDoc(graph, doc, members);
}

/**
 * 파싱된 lockfile 문서를 그래프에 반영한다 (YAML 파서와 분리해 단위 검증이 가능하도록).
 * @returns {{status: 'ok'|'unusable', detail: string, edges?: number}}
 */
export function applyLockfileDoc(graph, doc, members) {
  if (doc === null || typeof doc !== 'object') {
    return { status: 'unusable', detail: 'pnpm-lock.yaml 최상위가 맵이 아니다' };
  }

  const dirToMember = new Map(members.map((m) => [m.dir, m]));
  let edgeCount = 0;

  // importers: 워크스페이스 디렉터리 → 직접 의존
  const importers = doc.importers ?? {};
  if (typeof importers !== 'object' || Object.keys(importers).length === 0) {
    return { status: 'unusable', detail: 'pnpm-lock.yaml 에 importers 섹션이 없다' };
  }
  for (const [dir, spec] of Object.entries(importers)) {
    const norm = dir === '.' ? '.' : dir.replace(/^\.\//, '');
    const member = dirToMember.get(norm);
    if (!member) continue; // 루트(.) 등 워크스페이스 멤버가 아닌 importer
    for (const field of REACH_FIELDS) {
      const deps = spec?.[field];
      if (deps === null || typeof deps !== 'object') continue;
      for (const [depName, entry] of Object.entries(deps)) {
        const version = typeof entry === 'string' ? entry : entry?.version;
        const linkTarget = typeof version === 'string' && version.startsWith('link:')
          ? path.posix.normalize(path.posix.join(norm, version.slice('link:'.length)))
          : null;
        const linkedMember = linkTarget ? dirToMember.get(linkTarget) : null;
        const to = linkedMember ? WS + linkedMember.dir : NPM + depName;
        graph.addEdge(WS + member.dir, to, `pnpm-lock.yaml:importers.${norm}.${field}`);
        edgeCount += 1;
      }
    }
  }

  // snapshots(v9+) 또는 packages(v6) : 외부 → 외부 전이 간선
  const snapshots = doc.snapshots ?? doc.packages ?? {};
  for (const [id, spec] of Object.entries(snapshots)) {
    const fromName = depPathToName(id.startsWith('/') ? id.slice(1) : id);
    if (!fromName) continue;
    for (const field of REACH_FIELDS) {
      const deps = spec?.[field];
      if (deps === null || typeof deps !== 'object') continue;
      for (const depName of Object.keys(deps)) {
        graph.addEdge(NPM + fromName, NPM + depName, `pnpm-lock.yaml:snapshots["${id}"].${field}`);
        edgeCount += 1;
      }
    }
  }

  return { status: 'ok', detail: `pnpm-lock.yaml 에서 간선 ${edgeCount}개 반영`, edges: edgeCount };
}

export function describeNode(id) {
  if (id.startsWith(WS)) return `워크스페이스 패키지 ${id.slice(WS.length)}`;
  const name = id.slice(NPM.length);
  return isPostgresWireDriver(name) ? `Postgres 와이어 드라이버 ${name}` : `데이터 접근 패키지 ${name}`;
}

export function formatPath(nodePath, via) {
  const parts = [];
  for (let i = 0; i < nodePath.length; i += 1) {
    parts.push(shortNode(nodePath[i]));
    if (i < via.length) parts.push(`-(${via[i]})->`);
  }
  return parts.join(' ');
}

export function shortNode(id) {
  return id.startsWith(WS) ? `[${id.slice(WS.length)}]` : id.slice(NPM.length);
}
