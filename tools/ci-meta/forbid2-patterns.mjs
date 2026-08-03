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
 * 행 지향 **데이터 파일** 확장자.
 *
 * `PROSE_EXTENSIONS`(파일 통째 스캔 제외)와 성질이 **다르다.**
 * 데이터 파일은 스캔 대상으로 남되, **`dataExempt` 가 명시된 코드 구성 패턴만** 면제된다.
 * 즉 여기 등재는 "통째 면제"가 아니라 "코드 구성 패턴 한정 면제"다.
 *
 * ── 근거 ─────────────────────────────────────────────────────────────────
 * FORBID-2 when 은 "diff 가 CI 스텝의 **종료 코드를 마스킹하거나 검사 대상을 축소하는 구성**을
 * 신규 도입하는 경우"다. `.md` 가 금지 관용구를 **인용**하는 것이 어떤 검사도 무력화하지 않아
 * `구성`이 아니듯, 인허가 대장 CSV 의 **데이터 행**도 무엇도 무력화하지 않는다.
 * 실제로 D1a 의 실데이터 행 `VDD0E945B83AC,Hoon fit(훈핏),강남구,…` 이
 * `test-x-prefix`(`fit(`)에 걸려 Discovery PR 전체(D1a·D1b·D2·D3·D4)를 `lint` job 에서
 * 영구 차단했다 — 오탐이다.
 *
 * ── 등재하지 않는 것 ─────────────────────────────────────────────────────
 * `.json` · `.yaml` · `.yml` · `.toml` 은 **여기 없다.** 이 리포에서 그 확장자들은
 * `ci-budget.json` · `dependency-classes.json` · `.github/workflows/*.yml` 처럼
 * **실제로 동작을 규정하는 구성 파일**이며, 데이터 행이 아니라 구성이다.
 * 여기 있는 확장자는 "행 = 관측 레코드"인 형식만이다.
 *
 * ── 데이터 파일에서 여전히 유효한 검사 ───────────────────────────────────
 *  · `disable-without-reason` (아래 DISABLE_DIRECTIVE_RE) — `dataExempt` 를 붙이지 않는다.
 *    스캐너 지시자가 데이터 파일에 나타날 정당한 사유는 0이며, 나타났다면 그 파일은
 *    데이터가 아니라 확장자로 위장한 소스다. 오탐 비용 0, 미탐 방지 이득 있음.
 *  · `scanRequiredCheckExclusion` · `scanTestCountRegression` · `scanCheckerExitMasking`
 *    — 파일 확장자와 무관한 리포 전역 검사이므로 그대로 적용된다.
 *  · 자격증명 유출은 `secret-scan` job 소관(FORBID-2 아님).
 *  · 데이터의 **기대값 조작**은 각 계약의 픽스처 동결 규칙 소관(FORBID-2 아님).
 *
 * ※ `dataExempt` 는 **패턴별 opt-in** 이다. 새 패턴은 기본적으로 데이터 파일에도 적용되며,
 *   면제하려면 사유 문자열을 명시해야 한다(selftest 가 사유 길이를 검사한다).
 */
export const DATA_EXTENSIONS = ['.csv', '.tsv', '.psv', '.jsonl', '.ndjson'];

/**
 * 메시지 조립용 토큰.
 * 마스킹 관용구의 **문자열 리터럴은 이 파일에만 존재**해야 하므로,
 * 다른 검사기 파일은 리터럴을 직접 쓰지 않고 이 상수를 보간한다.
 */
export const TOKEN_CONTINUE_ON_ERROR = 'continue-on-error';

/**
 * 라인 단위 패턴 사전.
 *  - id:         실패 출력에 찍히는 하위 식별자
 *  - re:         추가된 라인에 대한 정규식
 *  - why:        성질 설명 (마스킹인가 / 대상 축소인가)
 *  - dataExempt: (선택) `DATA_EXTENSIONS` 파일에서 이 패턴을 면제하는 **사유**.
 *                생략 = 데이터 파일에도 적용(기본값). 면제는 opt-in 이며 사유가 필수다.
 */
export const FORBID2_LINE_PATTERNS = [
  {
    id: 'continue-on-error',
    re: /continue-on-error\s*:\s*(true|['"]true['"])/i,
    why: '스텝/잡 실패를 성공으로 마스킹',
    dataExempt:
      'GitHub Actions 스텝/잡 키다. 데이터 행에 같은 문자열이 있어도 어떤 워크플로도 그것을 읽지 않는다',
  },
  {
    id: 'or-true',
    re: /\|\|\s*true(\s|$|;|&|\)|`|"|')/,
    why: '종료 코드 마스킹',
    dataExempt:
      '셸 제어 연산자다. 데이터 행의 파이프 문자는 구분자·자유 텍스트이며 실행되지 않는다',
  },
  {
    id: 'or-colon',
    re: /\|\|\s*:(\s|$|;|&|\)|`|"|')/,
    why: '종료 코드 마스킹 (: 는 no-op 성공 커맨드)',
    dataExempt:
      '셸 제어 연산자다. 데이터 행의 파이프 문자는 구분자·자유 텍스트이며 실행되지 않는다',
  },
  {
    id: 'set-plus-e',
    re: /(^|[\s;&|])set\s+\+e(\s|$|;|&)/,
    why: '이후 전 명령의 실패 전파 해제',
    dataExempt: '셸 옵션 구성이다. 데이터 행은 셸에 의해 해석되지 않는다',
  },
  {
    id: 'pass-with-no-tests',
    re: /--passWithNoTests\b/,
    why: '검사 대상 0건을 통과로 처리',
    dataExempt: '테스트 러너 CLI 플래그다. 데이터 행은 러너 인자로 전달되지 않는다',
  },
  {
    id: 'test-skip-only',
    re: /(^|[^.\w$])(describe|it|test|suite|context)\s*\.\s*(skip|only|todo|failing)\s*\(/,
    why: '테스트 대상 축소 (skip/only)',
    dataExempt:
      '테스트 프레임워크 호출 구문이다. 데이터 파일은 테스트 수집 대상이 아니므로 스킵될 테스트가 존재하지 않는다',
  },
  {
    id: 'test-x-prefix',
    re: /(^|[^.\w$])(xdescribe|xit|xtest|fdescribe|fit)\s*\(/,
    why: '테스트 대상 축소 (x/f 프리픽스)',
    dataExempt:
      '테스트 프레임워크 호출 구문이다. 데이터 파일은 테스트 수집 대상이 아니다. ' +
      '실제 오탐 사례: 인허가 대장 상호명 `Hoon fit(훈핏)` 이 `fit(` 으로 매칭돼 D 배치 전체를 차단했다',
  },
  {
    id: 'pytest-skip',
    re: /@pytest\.mark\.(skip|skipif|xfail)\b|pytest\.skip\s*\(|@unittest\.skip/,
    why: '테스트 대상 축소 (pytest/unittest skip)',
    dataExempt: 'pytest/unittest 데코레이터다. 데이터 파일은 pytest 수집 대상이 아니다',
  },
  {
    id: 'node-test-skip',
    re: /(^|[^.\w$])(test|it|describe)\s*\([^)]*\{\s*skip\s*:\s*true/,
    why: '테스트 대상 축소 (node:test skip 옵션)',
    dataExempt: 'node:test 호출 옵션이다. 데이터 파일은 node:test 수집 대상이 아니다',
  },
];

/**
 * `if:` 조건 패턴. 워크플로 파일에만 적용하며,
 * 계약 명시 제외 2종 중 ② — job 이름이 정확히 `ci-required` 인 단 하나의 job 의 `if:` 라인은
 * 호출부에서 라인 범위로 제외된다. 검사 job 8개의 `if:` 는 그대로 대상이다.
 *
 * `dataExempt` 를 붙이지 않는다 — 이 패턴은 애초에 워크플로 파일에만 적용되고,
 * 워크플로 확장자(`.yml`)는 `DATA_EXTENSIONS` 에 없다. 면제할 이유가 없다.
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

/**
 * ★ PR 검수 차단 B-C — **검사기 자신의 종료 코드 무력화**.
 *
 * `tools/dep-graph/index.mjs` 의 `process.exit(code)` → `process.exit(0)` 한 줄이면
 * "FAIL 이다"라고 출력하면서 exit 0 을 내고, boundary 검사 전체가 죽는다.
 * 기존 `TRAILING_EXIT_ZERO_RE` 는 `.sh/.bash/.zsh` 와 워크플로 `run:` 블록에만 적용돼
 * 검사기 본체(`.mjs`)가 대상 밖이었다. 그 백스톱을 채운다.
 *
 * **판정 방식 — 파일 단위 핀(pin).**
 * 처음에는 "최상위(들여쓰기 0) 리터럴 0 종료"로 좁혔으나, 실제 공격 지점
 * (`dep-graph/index.mjs:485` 의 `  process.exit(code);`)은 함수 안이라 들여쓰기돼 있어 **못 잡았다**.
 * 반대로 들여쓰기를 무시하면 `path-guard/index.mjs:15`(예외 기반 구조에서 위반 0건일 때만
 * 도달하는 성공 종료)를 오탐한다. 조건부인지 아닌지를 정적으로 가르는 것은 신뢰할 수 없다.
 *
 * 그래서 **리터럴 `exit(0)` 을 갖는 파일 자체를 핀으로 고정**한다.
 *   · 아래 허용목록에 없는 검사기 파일에 리터럴 `exit(0)` 이 나타나면 위반이다.
 *   · 허용 항목은 **사유를 함께 적는다.** 목록이 늘어나는 것은 diff 에 드러나고,
 *     `tools/**` 는 CODEOWNERS 소유 경로다.
 * 검사기의 종료 코드는 **판정 결과에서 파생**되어야 한다(`process.exit(report.print())` ·
 * `process.exit(code)`). 리터럴 0 은 판정과 무관한 성공 선언이므로 기본이 금지다.
 */
export const CHECKER_FILE_RE = /^tools\/.*\.(mjs|cjs|js|py)$/;
export const LITERAL_ZERO_EXIT_RE = /(?:process|sys|os)\.(?:exit|_exit)\s*\(\s*0\s*\)/;

/**
 * 리터럴 `exit(0)` 이 허용되는 검사기 파일 (사유 필수).
 * 항목 추가는 "이 검사기는 왜 판정과 무관하게 성공을 선언해도 되는가"를 설명해야 한다.
 */
export const CHECKER_LITERAL_EXIT_ALLOWLIST = [
  {
    file: 'tools/path-guard/index.mjs',
    reason:
      'runCheck() 가 위반·판정불가에 예외를 던지는 구조라 이 지점 도달 자체가 "위반 0건" 판정이다. ' +
      '종료 코드가 판정에서 파생된다는 성질이 예외 흐름으로 보장된다.',
  },
];

/** 소스 라인에서 문자열 리터럴·주석을 제거한다 (문자열 안의 exit(0) 오탐 방지). */
export function stripLiteralsAndComments(line, lang) {
  const trimmed = line.trimStart();
  if (trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.startsWith('//')) return '';
  if (lang === 'py' && trimmed.startsWith('#')) return '';
  let s = line
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/`(?:\\.|[^`\\])*`/g, '``');
  const cut = lang === 'py' ? s.indexOf('#') : s.indexOf('//');
  if (cut >= 0) s = s.slice(0, cut);
  return s;
}

/**
 * eslint / depcruise disable 지시자.
 *
 * ★ 데이터 파일에서도 **면제하지 않는다**(`dataExempt` 없음). 근거는 `DATA_EXTENSIONS` 주석 참조 —
 *   스캐너 지시자가 데이터 행에 나타날 정당한 사유가 0이므로 오탐 비용이 없고,
 *   나타났다면 그 파일은 데이터가 아니라 확장자로 위장한 소스라는 신호다.
 */
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
