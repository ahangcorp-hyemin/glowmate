import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compilePatterns, globToRegExp, matchPath, normalizePath } from '../lib/glob.mjs';

const hits = (file, patterns) => matchPath(file, compilePatterns(patterns));

test('`**` 는 여러 세그먼트에 매칭된다', () => {
  assert.ok(globToRegExp('apps/web/**').test('apps/web/src/app/page.tsx'));
  assert.ok(globToRegExp('apps/web/**').test('apps/web/x'));
  assert.ok(!globToRegExp('apps/web/**').test('apps/webx/y'));
  assert.ok(!globToRegExp('apps/web/**').test('apps/api/x'));
});

test('`*` 는 한 세그먼트 안에서만 매칭된다', () => {
  assert.ok(globToRegExp('ops/alerts/o3-*.yml').test('ops/alerts/o3-deploy.yml'));
  assert.ok(!globToRegExp('ops/alerts/o3-*.yml').test('ops/alerts/nested/o3-a.yml'));
  assert.ok(!globToRegExp('ops/alerts/o3-*.yml').test('ops/alerts/o3-a/b.yml'));
});

test('정확 경로는 정확히만 매칭된다', () => {
  assert.ok(globToRegExp('packages/api/package.json').test('packages/api/package.json'));
  assert.ok(!globToRegExp('packages/api/package.json').test('packages/api/package.json.bak'));
  assert.ok(!globToRegExp('packages/api/package.json').test('x/packages/api/package.json'));
});

test('중괄호 택일 (DS5 계약 표기)', () => {
  const p = 'packages/ui/src/components/{venue,tag,filter,list}/*.cases.tsx';
  assert.ok(globToRegExp(p).test('packages/ui/src/components/venue/Card.cases.tsx'));
  assert.ok(globToRegExp(p).test('packages/ui/src/components/list/List.cases.tsx'));
  assert.ok(!globToRegExp(p).test('packages/ui/src/components/price/P.cases.tsx'));
});

test('정규식 특수문자는 리터럴로 취급된다 (라우트 그룹·동적 세그먼트)', () => {
  assert.ok(
    globToRegExp('apps/web/src/app/(browse)/**').test('apps/web/src/app/(browse)/page.tsx'),
  );
  assert.ok(
    globToRegExp('apps/web/src/app/api/venues/[slug]/route.ts').test(
      'apps/web/src/app/api/venues/[slug]/route.ts',
    ),
  );
  assert.ok(!globToRegExp('apps/web/src/app/api/venues/[slug]/route.ts').test(
    'apps/web/src/app/api/venues/s/route.ts',
  ));
});

test('맨 디렉터리명을 디렉터리로 승격하지 않는다 (범위 확대 미탐 방지)', () => {
  assert.equal(hits('tools/ci-meta/index.mjs', ['tools/ci-meta']), null);
  assert.equal(hits('tools/ci-meta/index.mjs', ['tools/ci-meta/**']), 'tools/ci-meta/**');
  assert.equal(hits('tools/ci-meta/index.mjs', ['tools/ci-meta/']), 'tools/ci-meta/');
});

test('경로 정규화', () => {
  assert.equal(normalizePath('./a/b'), 'a/b');
  assert.equal(hits('./apps/web/page.tsx', ['apps/web/**']), 'apps/web/**');
});

test('빈 패턴·닫히지 않은 중괄호는 예외', () => {
  assert.throws(() => globToRegExp('   '), /빈 글롭/);
  assert.throws(() => globToRegExp('a/{b,c'), /중괄호/);
});
