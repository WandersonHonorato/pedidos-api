import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['coverage/**', 'node_modules/**'] },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      eqeqeq: 'error',
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },
  {
    // Painel web: roda no navegador
    files: ['public/**/*.js'],
    languageOptions: { globals: { ...globals.browser } },
  },
  {
    // Script do k6 roda no runtime do k6, não no Node
    files: ['k6/**/*.js'],
    languageOptions: { globals: { __ENV: 'readonly', __VU: 'readonly' } },
  },
];
