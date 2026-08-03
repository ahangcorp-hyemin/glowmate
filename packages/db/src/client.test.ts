import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createDbClient, readDbConfig, type EnvSource } from './client.ts';

/**
 * 검수 §10 권고 9 — `pnpm -r test` 가 수집 0건으로 공허하게 통과하던 것을 실질 테스트로 바꾼다.
 *
 * "틀린 값 0건"이 "아무것도 검사하지 않음"으로 만족되는 상태는 이 프로젝트의 반복 실패 유형이다.
 * 여기서 검사하는 것은 **조용한 실패를 하지 않는다**는 성질이다 — 설정이 없거나 잘못됐을 때
 * 기본값으로 넘어가면 소비자가 빈 결과를 정상으로 오해한 채 진행한다.
 */

const base: EnvSource = { DATABASE_URL: 'postgres://u:p@h:5432/db' };

test('DATABASE_URL 이 없으면 기본값으로 넘어가지 않고 실패한다', () => {
  assert.throws(() => readDbConfig({}), /DATABASE_URL/);
  assert.throws(() => readDbConfig({ DATABASE_URL: '' }), /DATABASE_URL/);
});

test('DB_MAX_CONNECTIONS 기본값은 5 다 — Vercel 함수당 풀 고갈 상한', () => {
  assert.equal(readDbConfig(base).maxConnections, 5);
});

test('DB_MAX_CONNECTIONS 가 양의 정수가 아니면 실패한다', () => {
  for (const bad of ['0', '-1', 'abc', '2.5']) {
    assert.throws(
      () => readDbConfig({ ...base, DB_MAX_CONNECTIONS: bad }),
      /DB_MAX_CONNECTIONS/,
      `"${bad}" 를 통과시키면 안 된다`,
    );
  }
});

test('연결 문자열은 그대로 전달된다', () => {
  assert.equal(readDbConfig(base).connectionString, 'postgres://u:p@h:5432/db');
});

test('미구현 팩토리는 조용히 성공하지 않고 소리내어 실패한다', () => {
  // 스텁이 빈 클라이언트를 돌려주면 소비자가 빈 결과를 정상으로 오해한다.
  assert.throws(() => createDbClient(readDbConfig(base)), /F2a/);
});
