// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    files: ['src/__tests__/**/*.{ts,tsx}'],
    rules: {
      // Jest mock factories are hoisted, so test doubles must be required lazily.
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
]);
