// tools/ci-meta/fixture-rules.mjs
//
// REQ-5 픽스처 8종 ↔ 대응 job ↔ 실패 로그에 나타나야 하는 규칙 ID 토큰 매핑.
//
// 계약(F1 REQ-5): "그 red 의 실패 사유가 해당 검사 규칙 ID 또는 계약이 지정한 에러 문자열과
// 일치한다(귀속 검증)". 아래 expect 목록 중 **하나라도** 실패 job 로그에 나타나면 귀속으로 인정한다.

/** CI 워크플로가 반드시 정의해야 하는 8개 검사 job (집합 포함 검사 — 개수 동등 비교 금지) */
export const REQUIRED_JOBS = [
  'typecheck',
  'lint',
  'boundary',
  'test',
  'python',
  'secret-scan',
  'discovery',
  'path-guard',
];

/** 애그리게이터 job 이름 (브랜치 보호의 유일한 필수 체크) */
export const AGGREGATOR_JOB = 'ci-required';

/**
 * 픽스처 8종. key = `.github/ci-fixtures/<key>/` 디렉터리명 = 대응 job 이름.
 */
export const FIXTURES = [
  {
    job: 'boundary',
    label: '① @vercel/postgres 의존 (드라이버 도달)',
    expect: ['REQ-3', 'FORBID-1'],
  },
  {
    job: 'lint',
    // 라벨에 lint disable 지시자 리터럴을 쓰지 않는다 — 이 파일이 FORBID-2 스캔 대상이기 때문이다.
    label: '② 사유 주석 없는 lint disable 지시자',
    expect: ['FORBID-2'],
  },
  {
    job: 'test',
    label: '③ force-dynamic 페이지 라우트',
    expect: ['FORBID-3', 'REQ-8'],
  },
  {
    job: 'typecheck',
    label: '④ 타입 오류',
    expect: ['REQ-2', 'error TS'],
  },
  {
    job: 'secret-scan',
    label: '⑤ 가짜 자격증명',
    expect: ['secret', 'SECRET'],
  },
  {
    job: 'python',
    label: '⑥ pytest 실패',
    expect: ['REQ-4', 'FAILED', 'assert'],
  },
  {
    job: 'discovery',
    label: '⑦ 항상 exit 0 인 스텁 validate 스크립트',
    expect: ['FORBID-6'],
  },
  {
    job: 'path-guard',
    label: '⑧ touches 밖 경로 변경',
    expect: ['FORBID-4'],
  },
];

/**
 * 픽스처 런 조회 규약 (오버레이 방식은 계약에 미규정 — f1-gate2 §4-1).
 *
 * 우선순위:
 *   1) `.github/ci-fixtures/<job>/fixture.json`
 *      { "branch": "...", "run_id": 123456, "expect": ["REQ-3"] }
 *      run_id 가 있으면 그 런을 직접 조회한다(가장 명시적).
 *   2) fixture.json 의 branch, 없으면 관례 브랜치 `ci-fixture/<job>` 의 최신 런.
 *
 * 어느 쪽으로도 런을 특정하지 못하면 CI 에서 exit 1 이다 (미판정 ≠ 통과).
 */
export const FIXTURE_MANIFEST_NAME = 'fixture.json';
export function conventionalFixtureBranch(job) {
  return `ci-fixture/${job}`;
}

/**
 * 픽스처 브랜치 판정.
 *
 * REQ-5 (2)(3) 은 **PR 의 메타 검증**이지 픽스처 자신의 검증이 아니다. 픽스처 브랜치에서 다시
 * "픽스처 8종의 런을 조회해 귀속을 판정"하면 자기 자신을 검증하는 순환이 되고, 그 시점에 다른
 * 픽스처 런은 아직 없다. 그래서 픽스처 브랜치에서만 그 두 항목을 면제한다.
 *
 * ⚠ 이 완화가 PR 브랜치로 새면 REQ-5 전체가 무력화된다. 그래서 접두사를 **정확히**
 *   `ci-fixture/` 로 못박고, selftest 가 `main`·`feat/**` 등이 매칭되지 않음을 매 실행 검증한다.
 */
export const FIXTURE_BRANCH_PREFIX = 'ci-fixture/';

export function isFixtureBranch(branch) {
  if (typeof branch !== 'string') return false;
  const b = branch.trim().replace(/^refs\/heads\//, '');
  return b.startsWith(FIXTURE_BRANCH_PREFIX) && b.length > FIXTURE_BRANCH_PREFIX.length;
}

/**
 * 셋업/설치 스텝 판정.
 *
 * 픽스처 런에서 red 가 **셋업·설치 단계**에서 났다면 그것은 규칙 위반 탐지가 아니라
 * 결합 실패(lockfile 불일치 등)다. 계약 REQ-5 말미가 명시적으로 배제한 상태이며,
 * 이 경우 job 이 red 라도 귀속 검증은 실패로 판정해야 한다.
 */
export const SETUP_STEP_RE =
  /^(set up job|checkout|complete job|post\b|actions\/checkout|pnpm\/action-setup|actions\/setup-|astral-sh\/setup-|setup |install |install$|pnpm install|의존성|체크아웃|셋업)/i;

export function isSetupStep(stepName) {
  return SETUP_STEP_RE.test(String(stepName ?? '').trim());
}

/**
 * 실패 로그에서 **귀속 판정 구간**을 잘라낸다.
 *
 * ci.yml 은 각 job 첫 스텝에서 규칙 ID 를 echo 하므로, 로그 전체를 대상으로
 * `log.includes(token)` 을 하면 **green 런에서도 항상 참**이 되어 귀속 검증이 공허해진다.
 * 그래서 실패 지점(`##[error]`) 주변만 판정 구간으로 삼는다.
 */
export function failureRegion(log) {
  const lines = String(log).split('\n');
  const idx = lines.findLastIndex((l) => l.includes('##[error]'));
  if (idx >= 0) {
    return { mode: 'error-marker', text: lines.slice(Math.max(0, idx - 120), idx + 20).join('\n') };
  }
  return { mode: 'tail-200(##[error] 마커 없음)', text: lines.slice(-200).join('\n') };
}
