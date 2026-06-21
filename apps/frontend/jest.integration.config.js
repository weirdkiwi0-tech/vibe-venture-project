const base = require('./jest.config.base');

module.exports = {
  ...base,
  testMatch: ['<rootDir>/tests/integration/**/*.spec.ts', '<rootDir>/tests/integration/**/*.spec.tsx'],
};