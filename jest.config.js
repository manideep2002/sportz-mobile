module.exports = {
  preset: 'jest-expo',
  testPathIgnorePatterns: ['/node_modules/', '/.kilo/', '/.agents/'],
  modulePathIgnorePatterns: [
    '<rootDir>/.kilo/worktrees/',
    '<rootDir>/.agents/'
  ]
};
