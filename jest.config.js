module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // ESM module under node_modules that ts-jest doesn't transform; the verse
    // cache only needs a no-op filesystem in tests.
    '^expo-file-system/legacy$': '<rootDir>/__mocks__/expoFileSystemLegacy.js',
  },
};
