const js = require('@eslint/js');
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['node_modules/', 'dist/', 'build/', 'coverage/', '*.config.js'],
  },
  {
    files: ['**/*.ts', '**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'error',
      'no-console': 'off',
    },
  }
);
