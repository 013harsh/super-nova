require("dotenv").config({ path: ".env.test" });
module.exports = {
  testEnvironment: "node",
  coveragePathIgnorePatterns: ["/node_modules/"],
  testMatch: ["**/__tests__/**/*.test.js"],
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  testTimeout: 60000,
  maxWorkers: 1,
  setupFiles: ["<rootDir>/src/__tests__/setup/jest.setup.js"],
};
