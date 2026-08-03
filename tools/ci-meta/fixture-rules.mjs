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
    // `assert` 처럼 일반적인 토큰은 ruff 실패로도 매칭되어 귀속이 공허해진다(검수 지적).
    // pytest 고유 출력으로 좁힌다.
    expect: ['FAILED services/crawler/tests/', 'FAILED tests/', '=== FAILURES ==='],
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
export const FIXTURE_ROOT = '.github/ci-fixtures';

export function conventionalFixtureBranch(job) {
  return `ci-fixture/${job}`;
}

/**
 * 귀속 검증에 쓰기에 **너무 일반적인** 토큰.
 *
 * 검수 지적: 픽스처 ⑥ 의 `expect` 에 `assert` 가 들어 있어 ruff 실패로도 매칭됐다.
 * 그러면 "그 규칙 때문에 red 였다"가 증명되지 않는다. 기대 토큰이 아래에 해당하면
 * 그 사실 자체를 실패로 드러낸다 — 파일 소유자가 누구든 규칙은 집행돼야 한다.
 */
export const GENERIC_EXPECT_TOKENS = new Set([
  'assert',
  'error',
  'Error',
  'ERROR',
  'fail',
  'Fail',
  'FAIL',
  'FAILED',
  'failed',
  'exit 1',
  'true',
  'false',
]);

/**
 * `.github/ci-fixtures/*` 전량을 서술자로 만든다.
 *
 * REQ-5 필수 8종에 더해 **REQ-3 픽스처 ②③④**(`boundary-prisma`·`boundary-unclassified`·
 * `boundary-ui-other`)도 검증 대상에 넣는다. 계약 FORBID-1 detect 가 요구한 메타테스트인데
 * ①만 자동화돼 있었다(검수 차단 B-D).
 *
 * `expected_result` 는 `red`(대응 job 만 red) 또는 `green`(전 job green)이다.
 * ④ `boundary-ui-other` 가 green 이어야 한다는 것이 특히 중요하다 —
 * red 가 되는 회귀는 DS1·DS3 에 합법 경로가 0개가 됐다는 뜻이다(원칙 2.5).
 *
 * @param {(rel:string)=>({exists:boolean, json:any|null})} readManifest
 * @param {string[]} dirNames `.github/ci-fixtures/` 하위 디렉터리 이름 목록
 */
export function discoverFixtureDescriptors(dirNames, readManifest) {
  const byName = new Map();

  // 1) 계약이 명시한 필수 8종 — 트리가 없어도 서술자는 만든다(부재를 실패로 드러내야 한다).
  for (const fx of FIXTURES) {
    byName.set(fx.job, {
      name: fx.job,
      job: fx.job,
      label: fx.label,
      expect: fx.expect,
      expectedResult: 'red',
      required: true,
      manifest: null,
      present: false,
    });
  }

  // 2) 리포에 실재하는 픽스처 디렉터리를 덮어쓰거나 추가한다.
  for (const name of dirNames) {
    const { exists, json } = readManifest(`${FIXTURE_ROOT}/${name}/${FIXTURE_MANIFEST_NAME}`);
    const base = byName.get(name);
    const job = json?.job ?? base?.job ?? name;
    const expectedResult = json?.expected_result ?? base?.expectedResult ?? 'red';
    const expect = Array.isArray(json?.expect) ? json.expect : (base?.expect ?? []);
    byName.set(name, {
      name,
      job,
      label: json?.label ?? base?.label ?? '(추가 픽스처)',
      expect,
      expectedResult,
      required: Boolean(base?.required),
      manifest: exists ? json : null,
      manifestExists: exists,
      present: true,
    });
  }

  return [...byName.values()];
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
 * 면제가 허용되는 **이벤트 허용목록**.
 *
 * ★ PR 검수 차단 B-B: 브랜치 이름 접두사만 보면 하류 PR 이 소스 브랜치를 `ci-fixture/*` 로
 *   짓는 것만으로 REQ-5(2)(3)·REQ-6(c) 런타임 검증 전체를 끌 수 있었다.
 *   `GITHUB_HEAD_REF` 는 **pull_request 이벤트에서만** 설정되므로, 그것을 우선 읽는 구현은
 *   PR 컨텍스트를 배제하기는커녕 우선적으로 면제해 준다.
 *
 * 픽스처 런은 `ci.yml` 의 `push: branches: ['ci-fixture/**']` 로 발생한다.
 * 그래서 **push / workflow_dispatch 만** 면제 대상이며, `pull_request` 는 어떤 브랜치명이든 면제되지 않는다.
 * 부인목록이 아니라 허용목록인 이유: 새 이벤트 타입이 생겨도 조용히 면제가 열리지 않게 하기 위해서다.
 */
export const FIXTURE_EXEMPT_EVENTS = new Set(['push', 'workflow_dispatch']);

/**
 * 픽스처 면제 허용 여부.
 * @param {{branch:string|null, fromEnv:boolean}} branchInfo
 * @param {string} eventName GITHUB_EVENT_NAME
 * @returns {{allowed:boolean, reason:string}}
 */
export function fixtureExemptionAllowed(branchInfo, eventName) {
  const event = String(eventName ?? '');
  if (!isFixtureBranch(branchInfo?.branch)) {
    return { allowed: false, reason: `브랜치 ${branchInfo?.branch ?? '<불명>'} 는 픽스처 브랜치가 아니다` };
  }
  if (!branchInfo.fromEnv) {
    return {
      allowed: false,
      reason:
        `브랜치를 워크플로 컨텍스트가 아니라 워킹트리에서 읽었다 — ` +
        `드라이버가 중단돼 리포가 픽스처 브랜치에 남아 있을 수 있으므로 면제 근거가 되지 못한다`,
    };
  }
  if (!FIXTURE_EXEMPT_EVENTS.has(event)) {
    return {
      allowed: false,
      reason:
        `이벤트 \`${event || '<없음>'}\` 는 면제 허용목록 {${[...FIXTURE_EXEMPT_EVENTS].join(', ')}} 에 없다 — ` +
        `pull_request 는 브랜치명이 무엇이든 면제되지 않는다 (검수 차단 B-B)`,
    };
  }
  return { allowed: true, reason: `이벤트 ${event} · 브랜치 ${branchInfo.branch}` };
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
