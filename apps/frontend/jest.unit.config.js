const base = require('./jest.config.base');

module.exports = {
  ...base,
  testMatch: ['<rootDir>/tests/unit/**/*.spec.ts', '<rootDir>/tests/unit/**/*.spec.tsx'],
};