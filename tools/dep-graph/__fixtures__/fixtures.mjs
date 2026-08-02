/**
 * dep-graph 검사기 자기 검증용 픽스처 정의 (F1 REQ-3 acceptance 픽스처 ①②③④ 대응).
 *
 * 파일로 리포에 심지 않고 selftest 가 임시 디렉터리에 물질화한다 —
 * 리포 트리에 가짜 package.json 을 남기면 다른 검사기(workspace 탐색 · lint · depcruise)의
 * 대상이 되어 서로를 오염시킨다.
 *
 * `__EXPIRES_IN_30_DAYS__` 토큰은 selftest 가 실행 시각 기준 날짜로 치환한다
 * (만료일을 상수로 박으면 그 날짜가 지나는 순간 자기 테스트가 깨진다).
 */

const NAMES = {
  _note: [
    'selftest fixture — graph.mjs 의 POSTGRES_WIRE_DRIVERS 전 패턴을 반드시 포함해야 한다',
    '(검사기가 정본 목록의 부분집합 여부를 assert 하기 때문이다)',
  ],
  names: [
    'pg',
    'pg-native',
    'pg-promise',
    'postgres',
    '@vercel/postgres',
    '@neondatabase/*',
    'slonik',
    '@prisma/*',
    '@supabase/*',
  ],
};

const OTHER_BASE = {
  next: 'other',
  react: 'other',
};

/** 최소 워크스페이스 루트 */
function root(extra = {}) {
  return {
    'pnpm-workspace.yaml': "packages:\n  - 'apps/*'\n  - 'packages/*'\n",
    'package.json': JSON.stringify({ name: 'fx-root', private: true }, null, 2),
    'packages/config/package.json': JSON.stringify({ name: '@fx/config', private: true }, null, 2),
    'packages/config/data-access-names.json': JSON.stringify(NAMES, null, 2),
    'packages/config/db-driver-exceptions.json': JSON.stringify([], null, 2),
    'packages/config/dependency-classes.json': JSON.stringify({ classes: OTHER_BASE }, null, 2),
    ...extra,
  };
}

function web(deps, devDeps = {}) {
  return {
    'apps/web/package.json': JSON.stringify(
      { name: '@fx/web', private: true, dependencies: deps, devDependencies: devDeps },
      null,
      2,
    ),
  };
}

function classes(map) {
  return {
    'packages/config/dependency-classes.json': JSON.stringify(
      { classes: { ...OTHER_BASE, ...map } },
      null,
      2,
    ),
  };
}

export const FIXTURES = [
  // ── ④ 합법 경로 (원칙 2.5) — 순수 UI 의존을 other 로 등재하면 반드시 green ──────
  {
    name: '04-ui-dep-as-other-LEGAL',
    describe: '순수 UI 의존(@radix-ui/react-dialog)을 other 로 등재 → exit 0 (DS1·DS3 의 합법 경로)',
    files: {
      ...root(),
      ...web({ next: '15.0.0', react: '19.0.0', '@radix-ui/react-dialog': '1.1.0' }),
      ...classes({ '@radix-ui/react-dialog': 'other' }),
    },
    expectExit: 0,
    expectContains: ['REQ-3(b) classification', '미분류 0건'],
    expectNotContains: ['VIOLATIONS'],
  },

  // ── ① 드라이버 도달 ────────────────────────────────────────────────────────────
  {
    name: '01-driver-reachable',
    describe: 'apps/web → (워크스페이스 링크) packages/db → pg 전이 도달 → exit 1',
    files: {
      ...root(),
      ...web({ next: '15.0.0', '@fx/db': 'workspace:*' }),
      'packages/db/package.json': JSON.stringify(
        { name: '@fx/db', private: true, dependencies: { pg: '8.13.0' } },
        null,
        2,
      ),
    },
    expectExit: 1,
    expectContains: [
      'REQ-3(a)',
      'FORBID-1(a)',
      '도달 가능',
      'Postgres 와이어 드라이버 pg',
      '워크스페이스 패키지 packages/db',
    ],
  },
  {
    name: '01b-driver-direct',
    describe: '@vercel/postgres 를 apps/web 이 직접 의존 → 도달성 + 미분류 동시 위반 → exit 1',
    files: {
      ...root(),
      ...web({ next: '15.0.0', '@vercel/postgres': '0.10.0' }),
    },
    expectExit: 1,
    expectContains: ['REQ-3(a)', 'FORBID-1(a)', '@vercel/postgres'],
  },

  // ── ② data-access 분류 의존 ────────────────────────────────────────────────────
  {
    name: '02-prisma-data-access',
    describe: '@prisma/client 를 data-access 로 등재 (도달성만으로는 안 잡히는 경로) → exit 1',
    files: {
      ...root(),
      ...web({ next: '15.0.0' }, { '@prisma/client': '5.0.0' }),
      ...classes({ '@prisma/client': 'data-access' }),
    },
    expectExit: 1,
    expectContains: ['REQ-3(b)', 'FORBID-1(b)', 'data-access 로 분류돼 있다'],
  },

  // ── ③ 미분류 의존 ──────────────────────────────────────────────────────────────
  {
    name: '03-unclassified-dep',
    describe: '신규 의존이 dependency-classes.json 에 미분류 → exit 1 (허용목록)',
    files: {
      ...root(),
      ...web({ next: '15.0.0', 'some-new-lib': '1.0.0' }),
    },
    expectExit: 1,
    expectContains: ['REQ-3(b)', '미분류', 'some-new-lib'],
  },

  // ── (iii) 위장 등재 — 로컬은 SKIPPED 명시, CI 는 승인 없으면 실패 ───────────────
  {
    name: '05-spoof-local',
    describe: 'data-access-names 매칭 이름을 other 로 등재 → 로컬은 exit 0 이되 SKIPPED(local) 로 명시',
    files: {
      ...root(),
      ...web({ next: '15.0.0', '@prisma/client': '5.0.0' }),
      ...classes({ '@prisma/client': 'other' }),
    },
    expectExit: 0,
    expectContains: [
      'REQ-3(iii)',
      '위장 등재 후보 1건',
      'SKIPPED(local)',
      '@prisma/client',
      'GATED(도달성)',
    ],
    expectNotContains: ['VIOLATIONS'],
  },
  {
    name: '05d-data-access-transitive-unregistered',
    describe:
      '미등재 데이터 접근 패키지가 워크스페이스 링크를 통해 전이 도달 → (b)로 못 보는 경로를 (a)가 잡는다',
    files: {
      ...root(),
      ...web({ next: '15.0.0', '@fx/ui': 'workspace:*' }),
      'packages/ui/package.json': JSON.stringify(
        { name: '@fx/ui', private: true, dependencies: { '@supabase/supabase-js': '2.0.0' } },
        null,
        2,
      ),
    },
    expectExit: 1,
    expectContains: ['REQ-3(a)', 'FORBID-1(a)', '@supabase/supabase-js', '[apps/web]'],
  },
  {
    name: '05b-spoof-ci-unapproved',
    describe: '동일 위장 등재를 CI 컨텍스트에서 실행 → 승인 판정 불가이므로 exit 1',
    files: {
      ...root(),
      ...web({ next: '15.0.0', '@prisma/client': '5.0.0' }),
      ...classes({ '@prisma/client': 'other' }),
    },
    // base 커밋에는 위장 등재가 없다 → diff 가 승인 대상이 된다
    base: {
      'packages/config/dependency-classes.json': JSON.stringify({ classes: OTHER_BASE }, null, 2),
      'apps/web/package.json': JSON.stringify(
        { name: '@fx/web', private: true, dependencies: { next: '15.0.0' }, devDependencies: {} },
        null,
        2,
      ),
    },
    git: true,
    env: { GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'glowmate/fixture', GITHUB_EVENT_NAME: 'pull_request' },
    expectExit: 1,
    // 토큰이 없으면 collaborator 수를 알 수 없다 = 적용 규약(승인 리뷰 / single_maintainer)을
    // 판정할 수 없다 = 실패다. 판정 불가를 1명(완화 규약)으로 간주하면 게이트가 사라진다.
    expectContains: [
      'REQ-3(iii)',
      '승인 필요한 변경',
      '위장 등재',
      '적용 규약',
      'collaborator',
      'GITHUB_TOKEN',
    ],
  },
  {
    name: '05c-classes-change-ci-unapproved',
    describe: '기존 항목의 분류 변경(other → data-access)도 CI 에서 승인 없이는 exit 1',
    files: {
      ...root(),
      ...web({ next: '15.0.0' }),
      ...classes({ react: 'data-access' }),
    },
    base: {
      'packages/config/dependency-classes.json': JSON.stringify({ classes: OTHER_BASE }, null, 2),
    },
    git: true,
    env: { GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'glowmate/fixture', GITHUB_EVENT_NAME: 'pull_request' },
    expectExit: 1,
    expectContains: ['REQ-3(ii)', '분류가 "other" → "data-access" 로 변경됨'],
  },

  // ── 검사 대상 0건 = 공허한 초록 금지 ───────────────────────────────────────────
  {
    name: '06-zero-targets',
    describe: '제외 집합 밖 패키지가 0건이면 통과가 아니라 exit 1',
    files: {
      'pnpm-workspace.yaml': "packages:\n  - 'packages/api'\n  - 'packages/db'\n",
      'package.json': JSON.stringify({ name: 'fx-root', private: true }, null, 2),
      'packages/config/data-access-names.json': JSON.stringify(NAMES, null, 2),
      'packages/config/db-driver-exceptions.json': JSON.stringify([], null, 2),
      'packages/config/dependency-classes.json': JSON.stringify({ classes: OTHER_BASE }, null, 2),
      'packages/api/package.json': JSON.stringify({ name: '@fx/api', private: true }, null, 2),
      'packages/db/package.json': JSON.stringify({ name: '@fx/db', private: true }, null, 2),
    },
    expectExit: 1,
    expectContains: ['REQ-3', '검사 대상 워크스페이스 패키지가 0건'],
  },

  // ── FORBID-1 (c) 예외 파일 3필드 ───────────────────────────────────────────────
  {
    name: '07-exception-missing-fields',
    describe: '사유·만료일·승인자 없이 예외 등재 → exit 1',
    files: {
      ...root({
        'packages/config/db-driver-exceptions.json': JSON.stringify(
          [{ package: 'apps/web', dependency: 'pg' }],
          null,
          2,
        ),
      }),
      ...web({ next: '15.0.0' }),
    },
    expectExit: 1,
    expectContains: ['FORBID-1(c)', 'reason', 'expires_at', 'approved_by'],
  },
  {
    name: '07b-exception-expired',
    describe: '만료일이 90일을 초과하는 예외 → exit 1',
    files: {
      ...root({
        'packages/config/db-driver-exceptions.json': JSON.stringify(
          [
            {
              package: 'apps/web',
              dependency: 'pg',
              reason: '마이그레이션 기간 한정 직접 접근',
              expires_at: '2099-01-01',
              approved_by: '@platform-owner',
            },
          ],
          null,
          2,
        ),
      }),
      ...web({ next: '15.0.0' }),
    },
    expectExit: 1,
    expectContains: ['FORBID-1(c)', '90일을 초과'],
  },
  {
    name: '08-exception-valid-LEGAL',
    describe: '3필드를 갖춘 유효 예외로 등재된 드라이버는 exit 0 (예외 경로의 합법 동작)',
    files: {
      ...root({
        'packages/config/db-driver-exceptions.json': JSON.stringify(
          [
            {
              package: 'apps/web',
              dependency: 'pg',
              reason: '리드 이관 스크립트 임시 직접 접근 (이슈 #12)',
              expires_at: '__EXPIRES_IN_30_DAYS__',
              approved_by: '@platform-owner',
            },
          ],
          null,
          2,
        ),
      }),
      ...web({ next: '15.0.0', pg: '8.13.0' }),
      ...classes({ pg: 'data-access' }),
    },
    expectExit: 0,
    expectContains: ['EXEMPT', 'apps/web'],
    expectNotContains: ['VIOLATIONS'],
  },

  // ── 정본 파일이 비면 검사가 공허해진다 ─────────────────────────────────────────
  {
    name: '09-empty-allowlist',
    describe: 'dependency-classes.json 의 classes 가 비면 허용목록이 공허 → exit 1',
    files: {
      ...root({ 'packages/config/dependency-classes.json': JSON.stringify({ classes: {} }, null, 2) }),
      ...web({ next: '15.0.0' }),
    },
    expectExit: 1,
    expectContains: ['REQ-3(b)', '공허'],
  },
];
