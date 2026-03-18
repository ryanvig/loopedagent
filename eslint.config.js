// eslint.config.js
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  ...tseslint.configs.recommended,
  {
    ignores: ['node_modules/', 'dist/', 'build/', 'coverage/', '**/*.config.js', '**/*.test.ts'],
  },
  {
    files: ['src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'error',
      'no-console': 'off',
    },
  }
);
