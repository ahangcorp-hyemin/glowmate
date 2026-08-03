// tools/ci-meta/forbid2-patterns.mjs
//
// ★ 이 파일은 FORBID-2 의 **패턴 정의 파일**이다.
//   F1 계약 FORBID-2 when 절: "단 `.github/ci-fixtures/**` 와 **검사기의 패턴 정의 파일**은
//   위반 재현이 목적이므로 대상에서 제외한다".
//   → SELF_EXCLUDED_PATHS 에 자기 자신을 등재해 자기 PR 을 차단하지 않는다(P7 예방).
//   → 마스킹 관용구의 **문자열 리터럴은 반드시 이 파일에만 존재**해야 한다.
//     다른 검사기 파일에 리터럴을 두면 그 파일이 스스로 스캔에 걸린다.
//
// 판정 기준은 열거가 아니라 "종료 코드 마스킹 또는 검사 대상 축소"라는 **성질**이며,
// 아래 사전은 계약이 예시로 든 전건을 포함한다.

/** FORBID-2 스캔에서 제외되는 경로 (계약 명시 제외 2종 중 ①) */
export const FORBID2_EXCLUDED_PREFIXES = [
  '.github/ci-fixtures/', // 위반 재현이 목적인 픽스처 트리
];

/** 검사기의 패턴 정의 파일 자신 (계약 명시 제외 2종 중 ①의 후단) */
export const SELF_EXCLUDED_PATHS = ['tools/ci-meta/forbid2-patterns.mjs'];

/**
 * 비실행 산문 파일 확장자.
 *
 * FORBID-2 when 은 "diff 가 **CI 스텝의 종료 코드를 마스킹하거나 검사 대상을 축소하는 구성**을
 * 신규 도입하는 경우"다. 계약 문서·감사 보고서(.md)가 금지 관용구를 **인용**하는 것은
 * 어떤 검사도 무력화하지 않으므로 `구성`이 아니다. 확장자 기준이므로 `docs/foo.sh` 같은
 * 실행 가능한 파일은 어느 디렉터리에 있든 그대로 스캔 대상이다.
 *
 * ※ 이 규칙이 없으면 F1 자기 PR 이 자신의 계약 문서(docs/tasks/F1.md 의 FORBID-2 열거)
 *   때문에 차단된다 — 규격 §3.4 "계약이 자기 PR 을 차단" 안티패턴.
 */
export const PROSE_EXTENSIONS = ['.md', '.mdx', '.txt', '.rst', '.adoc', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.lock'];

/**
 * 메시지 조립용 토큰.
 * 마스킹 관용구의 **문자열 리터럴은 이 파일에만 존재**해야 하므로,
 * 다른 검사기 파일은 리터럴을 직접 쓰지 않고 이 상수를 보간한다.
 */
export const TOKEN_CONTINUE_ON_ERROR = 'continue-on-error';

/**
 * 라인 단위 패턴 사전.
 *  - id:      실패 출력에 찍히는 하위 식별자
 *  - re:      추가된 라인에 대한 정규식
 *  - files:   대상 파일 판정 (null = 전체)
 *  - why:     성질 설명 (마스킹인가 / 대상 축소인가)
 */
export const FORBID2_LINE_PATTERNS = [
  {
    id: 'continue-on-error',
    re: /continue-on-error\s*:\s*(true|['"]true['"])/i,
    why: '스텝/잡 실패를 성공으로 마스킹',
  },
  {
    id: 'or-true',
    re: /\|\|\s*true(\s|$|;|&|\)|`|"|')/,
    why: '종료 코드 마스킹',
  },
  {
    id: 'or-colon',
    re: /\|\|\s*:(\s|$|;|&|\)|`|"|')/,
    why: '종료 코드 마스킹 (: 는 no-op 성공 커맨드)',
  },
  {
    id: 'set-plus-e',
    re: /(^|[\s;&|])set\s+\+e(\s|$|;|&)/,
    why: '이후 전 명령의 실패 전파 해제',
  },
  {
    id: 'pass-with-no-tests',
    re: /--passWithNoTests\b/,
    why: '검사 대상 0건을 통과로 처리',
  },
  {
    id: 'test-skip-only',
    re: /(^|[^.\w$])(describe|it|test|suite|context)\s*\.\s*(skip|only|todo|failing)\s*\(/,
    why: '테스트 대상 축소 (skip/only)',
  },
  {
    id: 'test-x-prefix',
    re: /(^|[^.\w$])(xdescribe|xit|xtest|fdescribe|fit)\s*\(/,
    why: '테스트 대상 축소 (x/f 프리픽스)',
  },
  {
    id: 'pytest-skip',
    re: /@pytest\.mark\.(skip|skipif|xfail)\b|pytest\.skip\s*\(|@unittest\.skip/,
    why: '테스트 대상 축소 (pytest/unittest skip)',
  },
  {
    id: 'node-test-skip',
    re: /(^|[^.\w$])(test|it|describe)\s*\([^)]*\{\s*skip\s*:\s*true/,
    why: '테스트 대상 축소 (node:test skip 옵션)',
  },
];

/**
 * `if:` 조건 패턴. 워크플로 파일에만 적용하며,
 * 계약 명시 제외 2종 중 ② — job 이름이 정확히 `ci-required` 인 단 하나의 job 의 `if:` 라인은
 * 호출부에서 라인 범위로 제외된다. 검사 job 8개의 `if:` 는 그대로 대상이다.
 */
export const FORBID2_WORKFLOW_IF_PATTERNS = [
  {
    id: 'if-always',
    re: /^\s*if\s*:.*\balways\s*\(\s*\)/,
    why: '선행 실패와 무관하게 실행 = 실패 전파 마스킹',
  },
];

/** 스크립트 말미 `exit 0` (성공 강제 종료) */
export const TRAILING_EXIT_ZERO_RE = /^\s*exit\s+0\s*(#.*)?$/;

/** eslint / depcruise disable 지시자 */
export const DISABLE_DIRECTIVE_RE =
  /(eslint-disable(-next-line|-line)?|depcruise-disable|dependency-cruiser-disable)\b/;

/** 사유 주석 형식: `-- reason: <이슈 URL>` */
export const DISABLE_REASON_RE = /--\s*reason\s*:\s*https?:\/\/\S+/;

/** 테스트 선언 카운트 규칙 (base 대비 감소 금지) */
export const TEST_FILE_MATCHERS = [
  { lang: 'py', re: /(^|\/)(test_[^/]*\.py|[^/]*_test\.py)$/ },
  { lang: 'py', re: /(^|\/)tests?\/[^/]*\.py$/ },
  { lang: 'js', re: /\.(test|spec)\.[cm]?[jt]sx?$/ },
  { lang: 'js', re: /(^|\/)__tests__\/[^/]*\.[cm]?[jt]sx?$/ },
];

export const TEST_DECL_PATTERNS = {
  py: /^[ \t]*(async[ \t]+)?def[ \t]+test_\w*/gm,
  js: /(^|[^.\w$])(it|test)(\.\w+)*\s*\(/g,
};
