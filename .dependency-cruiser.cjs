/**
 * F1 REQ-3 (a) / FORBID-1 (a) — 소스 임포트 수준의 경계 규칙.
 *
 * 이 설정은 `tools/dep-graph/index.mjs` 의 **보조 수단**이다.
 * 판정을 dependency-cruiser 단독에 위임하지 않는다 — 설정 한 줄(`forbidden: []`)로
 * 경계 전체가 무력화되기 때문이다. 1차 판정은 dep-graph 의 자체 그래프 분석이 수행하며,
 * 이 설정의 위반은 거기에 합산된다.
 *
 * 금지 노드 목록은 packages/config/data-access-names.json 을 단일 원천으로 재사용한다
 * (검사기 안에 별도 모듈명 부인목록을 두면 두 목록이 갈라진다).
 */
const dataAccessNames = require('./packages/config/data-access-names.json');

/** `*` 만 지원하고 `/` 를 넘지 않는 글롭 → 정규식 조각 */
function globToSource(glob) {
  return glob
    .split('*')
    .map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('[^/]*');
}

if (!Array.isArray(dataAccessNames.names) || dataAccessNames.names.length === 0) {
  // 목록이 비면 규칙이 공허해진다. 조용히 통과시키지 않는다.
  throw new Error(
    'REQ-3 / FORBID-1: packages/config/data-access-names.json 의 names 가 비어 있어 경계 규칙이 공허하다',
  );
}

const dataAccessPattern = `node_modules/(${dataAccessNames.names.map(globToSource).join('|')})(/|$)`;

/** 제외 집합(REQ-3). 이 두 패키지만 DB 접근을 보유할 수 있다. */
const EXCLUDED = '^packages/(api|db)/';
/** 검사 대상: 워크스페이스 소스 전체에서 제외 집합을 뺀 것 */
const CONSUMERS = '^(apps|packages|services)/';

module.exports = {
  forbidden: [
    {
      name: 'REQ-3-a-no-db-package',
      severity: 'error',
      comment:
        'REQ-3 (a) / FORBID-1 (a): packages/api·packages/db 밖의 패키지에서 packages/db 가 도달 가능하면 안 된다',
      from: { path: CONSUMERS, pathNot: EXCLUDED },
      to: { path: '^packages/db/' },
    },
    {
      name: 'REQ-3-a-no-data-access-driver',
      severity: 'error',
      comment:
        'REQ-3 (a) / FORBID-1 (a): packages/api·packages/db 밖의 패키지에서 Postgres 와이어 드라이버 · ' +
        '데이터 접근 패키지(data-access-names.json)가 도달 가능하면 안 된다',
      from: { path: CONSUMERS, pathNot: EXCLUDED },
      to: { path: dataAccessPattern },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: {
      // 위반 재현이 목적인 픽스처 트리는 규칙 적용 대상이 아니다 (F1 FORBID-2 when 의 제외 범위와 동일).
      path: '(^|/)(node_modules|__fixtures__|ci-fixtures)(/|$)',
    },
    tsPreCompilationDeps: true,
    combinedDependencies: false,
    reporterOptions: { text: { highlightFocused: true } },
  },
};
