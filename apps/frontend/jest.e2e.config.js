const base = require('./jest.config.base');

module.exports = {
  ...base,
  testMatch: ['<rootDir>/tests/e2e/**/*.spec.ts', '<rootDir>/tests/e2e/**/*.spec.tsx'],
};