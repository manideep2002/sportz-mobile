module.exports = {
  preset: 'jest-expo',
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
