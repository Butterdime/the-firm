module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  transform: {},
  moduleFileExtensions: ["js", "ts"],
  roots: ["<rootDir>/src"],
  testMatch: ["**/__tests__/**/*.ts", "**/?(*.)+(spec|test).ts"],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts"
  ],
  verbose: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
};