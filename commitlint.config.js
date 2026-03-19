module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat', // New feature
        'fix', // Bug fix
        'build', // Build system, dependencies
        'docs', // Documentation only
        'style', // Formatting, no code change
        'refactor', // Code change, no feature/fix
        'perf', // Performance improvement
        'test', // Tests added/updated
        'chore', // Maintenance, deps
        'security', // Security fix
      ],
    ],
    'type-case': [2, 'always', 'lower-case'],
    'type-empty': [2, 'never'],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],
    'header-max-length': [2, 'always', 100],
  },
};
