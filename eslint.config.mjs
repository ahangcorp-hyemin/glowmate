import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * 루트 플랫 설정 — `pnpm lint` (`eslint . --report-unused-disable-directives --max-warnings 0`) 의 유일한 진입점.
 *
 * `.github/ci-fixtures/**` 를 ignores 에 두는 이유(F1 FORBID-2 when 의 제외 절과 같은 근거):
 * 픽스처 트리는 위반을 **의도적으로** 담고 있다. 본 트리의 lint 가 그것을 읽으면
 * F1 자기 PR 이 자기 픽스처 때문에 red 가 된다(P7 자기차단). 픽스처는 독립 트리로
 * 별도 Actions 런에서만 평가된다.
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/out/**',
      '**/dist/**',
      '.github/ci-fixtures/**',
      'services/crawler/**',
      // next build 가 매 빌드마다 다시 쓰는 생성 파일. 손으로 고칠 수 없으므로 규칙 대상이 아니다.
      '**/next-env.d.ts',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    rules: {
      // 조용한 실패 금지 — 이 프로젝트의 반복 실패 유형 중 하나다.
      '@typescript-eslint/no-floating-promises': 'off', // 타입 인지 린트 미사용(속도). 대신 typecheck job 이 본다.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },

  {
    // CommonJS 설정 파일 — dependency-cruiser 는 .cjs 설정만 받는다.
    // require() 는 이 파일 형식의 유일한 import 수단이므로 규칙 대상에서 뺀다.
    files: ['**/*.cjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  {
    // 검사기·설정·계약 테스트 스크립트는 Node 런타임 전역을 쓴다.
    // `packages/**/*.mjs` 를 포함하는 이유: REQ-2 계약 테스트가 packages/config 에 있다.
    // 이 목록이 좁으면 검사기를 추가할 때마다 lint 가 깨지고, 그때의 최단 경로는
    // 사유 주석 없는 lint 억제 지시자를 심는 것이다 — FORBID-2 위반이다.
    // (이 주석에 그 지시자 리터럴을 쓰지 않는 이유: 이 파일이 FORBID-2 스캔 대상이다.)
    files: ['tools/**/*.mjs', 'packages/**/*.mjs', 'apps/**/*.mjs', '*.mjs', '*.cjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        fetch: 'readonly',
        __dirname: 'readonly',
        module: 'writable',
        require: 'readonly',
      },
    },
  },
);
