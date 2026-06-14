module.exports = {
  testEnvironment: "node",
  coveragePathIgnorePatterns: ["/node_modules/"],
  testMatch: ["**/__tests__/**/*.test.js"],
  setupFilesAfterEnv: ["<rootDir>/src/__tests__/setup/jest.setup.js"],
  testTimeout: 30000,
  collectCoverageFrom: [
    "src/**/*.js",
    "!src/__tests__/**",
    "!src/db/**",
  ],
  verbose: true,
};
