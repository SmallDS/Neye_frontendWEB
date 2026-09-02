import { defineConfig } from '@vben/eslint-config';

export default defineConfig([
  {
    ignores: [
      'packages/neye-api/src/generated/**',
      'packages/neye-api/openapi.yaml',
      'openapi/**',
    ],
  },
  {
    files: ['**/*.vue'],
    rules: {
      'vue/html-closing-bracket-newline': 'off',
      'vue/multiline-html-element-content-newline': 'off',
    },
  },
]);
