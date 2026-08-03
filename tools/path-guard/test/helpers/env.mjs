/**
 * selftest 가 spawn 하는 CLI 의 환경을 **명시적으로 통제**한다.
 *
 * 왜 필요한가: path-guard 의 판정 축(비교 기준 선택)은 `GITHUB_REF_NAME` ·
 * `GITHUB_HEAD_REF` · `GITHUB_EVENT_NAME` 을 읽는다. selftest 를 CI job 안에서 돌리면
 * 그 job 자신의 값이 자식 프로세스에 상속되어, **임시 리포의 브랜치가 무엇이든**
 * 픽스처 브랜치 판정 경로를 먼저 타 버린다. 실제로 `ci-fixture/*` 런에서
 * "touches 밖 경로" 대신 "오버레이 커밋이 아니다" 가 나와 39건이 전부 깨졌다.
 *
 * 통과 이유가 코드가 아니라 주변 환경이 되는 상태를 막기 위해,
 * `{ ...process.env }` 를 넘기지 않고 **화이트리스트 + 명시 주입**만 사용한다.
 */

/** 판정에 영향을 주므로 상속을 끊는 변수들 (문서화 목적으로 export 한다). */
export const JUDGEMENT_ENV_KEYS = Object.freeze([
  'GITHUB_ACTIONS',
  'GITHUB_EVENT_NAME',
  'GITHUB_REF_NAME',
  'GITHUB_REF',
  'GITHUB_HEAD_REF',
  'GITHUB_BASE_REF',
  'GITHUB_REPOSITORY',
  'GITHUB_SHA',
  'GITHUB_WORKFLOW',
  'GITHUB_RUN_ID',
  'CI',
]);

/** 프로세스 실행에 필요한 최소 변수만 통과시킨다. */
const PASS_THROUGH = Object.freeze([
  'PATH',
  'HOME',
  'TMPDIR',
  'TEMP',
  'TMP',
  'LANG',
  'LC_ALL',
  'USER',
  'LOGNAME',
  'SHELL',
  'SystemRoot',
  'COMSPEC',
  'PATHEXT',
  'USERPROFILE',
]);

/**
 * 자식 프로세스용 환경을 만든다.
 * @param {Record<string, string|undefined>} inject 이 테스트가 **의도적으로** 주입하는 값.
 *   값이 `undefined` 면 주입하지 않는다(= 그 변수는 존재하지 않는 상태).
 */
export function cleanEnv(inject = {}) {
  const env = {};
  for (const key of PASS_THROUGH) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  // 자식이 git 을 실행한다. 시스템 git 설정·자격증명 프롬프트의 영향도 끊는다.
  env.GIT_CONFIG_NOSYSTEM = '1';
  env.GIT_TERMINAL_PROMPT = '0';

  for (const [key, value] of Object.entries(inject)) {
    if (value === undefined) continue;
    env[key] = String(value);
  }
  return env;
}
