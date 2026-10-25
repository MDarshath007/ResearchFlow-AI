/**
 * Jest configuration for ResearchFlow server.
 *
 * The server uses "type": "module" (ESM), so Jest must run with
 *   NODE_OPTIONS=--experimental-vm-modules
 * which is embedded in the test script inside package.json.
 *
 * @see https://jestjs.io/docs/ecmascript-modules
 */
export default {
  // Use the experimental ESM mode
  testEnvironment: 'node',

  // Test file locations
  testMatch: [
    '<rootDir>/tests/**/*.test.js',
    '<rootDir>/tests/**/*.test.mjs',
  ],

  // Transform nothing — Jest will receive native ESM
  transform: {},

  // A reasonable timeout for supertest HTTP calls that hit mocked mongoose
  testTimeout: 15000,

  // Verbose output so each test name is printed
  verbose: true,
};
