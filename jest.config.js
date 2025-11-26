module.exports = {
  testEnvironment: 'node',
  coveragePathIgnorePatterns: ['/node_modules/'],
  testTimeout: 30000,
  // Improve test isolation: reset modules and restore mocks between tests
  resetModules: true,
  restoreMocks: true,
  collectCoverageFrom: [
    'controllers/**/*.js',
    'middleware/**/*.js',
    'models/**/*.js',
    'routes/**/*.js',
    'utils/**/*.js'
  ],
  coverageDirectory: 'coverage',
  verbose: true
};
