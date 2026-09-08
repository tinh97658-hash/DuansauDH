module.exports = {
  rootDir: "..",
  testEnvironment: "node",
  setupFiles: ["reflect-metadata"],
  testMatch: [
    "<rootDir>/test/**/*.spec.ts",
    "<rootDir>/test/**/*.e2e-spec.ts",
  ],
  moduleFileExtensions: ["js", "json", "ts"],
  extensionsToTreatAsEsm: [".ts"],
  transform: {
    "^.+\\.(t|j)s$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/test/tsconfig.json",
        useESM: true,
      },
    ],
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  clearMocks: true,
  restoreMocks: true,
  collectCoverageFrom: [
    "<rootDir>/src/**/*.ts",
    "!<rootDir>/src/main.ts",
    "!<rootDir>/src/database/migrations/**",
    "!<rootDir>/src/database/seed-*.ts",
  ],
  coverageDirectory: "<rootDir>/coverage",
  coverageReporters: ["text", "lcov", "cobertura"],
};
