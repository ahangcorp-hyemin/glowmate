/**
 * path-guard 판정 실패의 단일 예외 타입.
 *
 * 이 도구의 모든 실패는 예외로 던지고 index.mjs 가 exit 1 로 변환한다.
 * "판정 불가"를 통과로 삼키는 경로를 만들지 않기 위해, 성공 반환값은
 * 검사를 실제로 끝까지 수행했을 때만 존재한다.
 */
export class PathGuardError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PathGuardError';
  }
}

/** 실패 메시지는 언제나 `FORBID-4` 토큰을 포함한다(REQ-5 귀속 검증이 이 문자열에 의존). */
export const FORBID_TOKEN = 'FORBID-4';

export function fail(lines) {
  const body = Array.isArray(lines) ? lines.join('\n') : String(lines);
  throw new PathGuardError(`${FORBID_TOKEN} path-guard: ${body}`);
}
