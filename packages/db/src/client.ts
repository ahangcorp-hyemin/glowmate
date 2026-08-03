/**
 * 커넥션 팩토리 골격 (F1 REQ-3).
 *
 * packages/db 는 REQ-3 의 제외 집합이다 — Postgres 와이어 드라이버 의존을 보유할 수 있는
 * 두 패키지(packages/api · packages/db) 중 하나. 다만 드라이버 의존 추가와 실제 풀 구현은
 * F2a 소관이며(F1 out_of_scope), 본 파일은 그 자리를 잡아두는 타입 경계까지다.
 *
 * 여기에 드라이버를 import 하지 않는 이유: F1 이 드라이버를 넣으면 F2a 의 첫 PR 이
 * 이미 존재하는 의존을 두고 시작하게 되어 되돌림 단위가 엉킨다(FORBID-4 because).
 */

export interface QueryResult<TRow> {
  readonly rows: readonly TRow[];
  readonly rowCount: number;
}

export interface DbClient {
  query<TRow>(sql: string, params?: readonly unknown[]): Promise<QueryResult<TRow>>;
  close(): Promise<void>;
}

export interface DbConfig {
  /** Postgres 연결 문자열. 값은 런타임 환경변수에서만 오며 리포에 상수로 두지 않는다. */
  readonly connectionString: string;
  /** Vercel 함수당 커넥션 고갈을 막기 위한 상한 (FORBID-1 because 참조). */
  readonly maxConnections: number;
}

/**
 * 환경변수 원천. `process.env` 를 그대로 받을 수 있는 형태이되 @types/node 에 의존하지 않는다 —
 * packages/db 는 F2a 가 드라이버를 붙이기 전까지 런타임 의존이 0개인 상태를 유지한다.
 * 기본값을 두지 않는 이유: 호출자가 어떤 env 를 읽는지 명시하게 해 테스트에서 주입 가능하게 한다.
 */
export type EnvSource = Readonly<Record<string, string | undefined>>;

export function readDbConfig(env: EnvSource): DbConfig {
  const connectionString = env['DATABASE_URL'];
  if (connectionString === undefined || connectionString === '') {
    throw new Error('DATABASE_URL 이 설정되지 않았다');
  }

  const rawMax = env['DB_MAX_CONNECTIONS'];
  const maxConnections = rawMax === undefined ? 5 : Number.parseInt(rawMax, 10);
  if (!Number.isInteger(maxConnections) || maxConnections < 1) {
    throw new Error(`DB_MAX_CONNECTIONS 가 양의 정수가 아니다: ${String(rawMax)}`);
  }

  return { connectionString, maxConnections };
}

/**
 * F2a 가 드라이버를 붙일 때까지 호출 시 실패한다.
 *
 * 스텁이 조용히 성공하면 소비자가 빈 결과를 정상으로 오해한 채 진행하고,
 * 그 상태가 F5 의 조회 계층까지 흘러간다. 미구현은 소리내어 실패해야 한다.
 */
export function createDbClient(_config: DbConfig): DbClient {
  throw new Error('createDbClient 는 F2a-CORE-SCHEMA 에서 구현된다 (F1 은 타입 경계까지)');
}
