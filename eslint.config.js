const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  ...tseslint.configs.recommended,
  {
    ignores: ['node_modules/', 'dist/', 'build/', 'coverage/'],
  },
  {
    files: ['**/*.ts', '**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'error',
      'no-console': 'off',
    },
  }
);
