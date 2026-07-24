module.exports = {
  preset: 'jest-expo',
  setupFiles: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/.kilo/',
    '/.agents/',
    '/supabase/functions/' // Deno-native tests — run with: deno test supabase/functions/**/*.test.ts
  ],
  modulePathIgnorePatterns: [
    '<rootDir>/.kilo/worktrees/',
    '<rootDir>/.agents/'
  ]
};
