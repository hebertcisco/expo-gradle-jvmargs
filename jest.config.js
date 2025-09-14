/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/__tests__'],
  moduleFileExtensions: ['js', 'json'],
  verbose: false,
  // Avoid using babel-jest; tests and sources are CommonJS.
  transform: {},
};
