// Flat ESLint config (ESLint 10+).
// Rules:
//   1. Spanish-looking string literals must live in CopyModule.ts (warning).
//   2. `throw` in services/ must only be the 'not_implemented' placeholder (warning).

import tsParser from '@typescript-eslint/parser';

const SPANISH_CHARS = /[áéíóúñ¿¡]/;

export default [
  {
    files: ['src/**/*.{ts,tsx}'],
    // CopyModule holds the dad-facing Spanish; i18n holds the bilingual
    // caregiver dictionary — both legitimately contain Spanish literals.
    ignores: ['src/services/CopyModule.ts', 'src/i18n/**', 'src/**/__tests__/**'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
    },
    rules: {
      'no-restricted-syntax': ['warn', {
        selector: `Literal[value=/${SPANISH_CHARS.source}/]`,
        message: 'Spanish strings must live in CopyModule.ts, not inline. (FR-6.5 voseo enforcement.)',
      }],
    },
  },
  {
    files: ['src/services/*.ts'],
    ignores: ['src/services/CopyModule.ts', 'src/services/index.ts', 'src/services/__tests__/**'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    },
    rules: {
      'no-restricted-syntax': ['warn', {
        selector: "ThrowStatement[argument.callee.name!='Error']",
        message: "Services may only `throw new Error('not_implemented')` as a placeholder. Replace with Result.err(...) when implementing.",
      }],
    },
  },
];
