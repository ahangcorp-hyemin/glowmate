import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { API_SCAFFOLD } from './index.ts';

/**
 * 검수 §10 권고 9 — `pnpm -r test` 가 수집 0건으로 공허하게 통과하던 것을 실질 테스트로 바꾼다.
 *
 * packages/api 는 F5 가 채울 빈 스캐폴드다. 그래서 검사할 동작이 없는 대신,
 * **"아직 비어 있다"는 상태 자체**를 잠근다. 이 패키지는 REQ-3 의 제외 집합
 * (DB 접근을 보유할 수 있는 두 패키지 중 하나)이라 의존이 늘어나는 순간
 * 경계 판정의 의미가 달라진다 — 그 변화가 사고가 아니라 의도이게 만든다.
 */

const pkgPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
const pkg: { dependencies?: Record<string, string> } = JSON.parse(readFileSync(pkgPath, 'utf8'));

test('스캐폴드 표식이 노출된다', () => {
  assert.equal(API_SCAFFOLD, true);
});

test('런타임 의존이 0건이다 — F5 가 추가할 때 이 테스트를 함께 갱신해야 한다', () => {
  const deps = Object.keys(pkg.dependencies ?? {});
  assert.deepEqual(
    deps,
    [],
    `packages/api 에 런타임 의존이 생겼다: ${deps.join(', ')}. ` +
      '의도한 변경이면 이 테스트를 갱신하라. 의도하지 않았다면 REQ-3 경계를 다시 확인하라.',
  );
});
