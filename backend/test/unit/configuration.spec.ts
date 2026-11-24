import { environmentFiles, environmentSchema } from "../../src/config/configuration.js";
import { join } from "node:path";

const config = {
  PORT: "3001", DB_HOST: "127.0.0.1", DB_PORT: "55432",
  POSTGRES_DB: "training", POSTGRES_USER: "user@local",
  POSTGRES_PASSWORD: "p@ss:/?#%word",
  SESSION_SECRET: "test-session-secret-with-at-least-32-characters",
  FRONTEND_URL: "http://localhost:3100", API_PUBLIC_URL: "http://localhost:3001",
};

describe("shared environment configuration", () => {
  it('bounds database wait times and validates timeout configuration', () => {
    const { value } = environmentSchema.validate(config);
    expect(value.DB_LOCK_TIMEOUT_MS).toBe(5000);
    expect(value.DB_STATEMENT_TIMEOUT_MS).toBe(30000);
    expect(environmentSchema.validate({ ...config, DB_LOCK_TIMEOUT_MS: 0 }).error).toBeDefined();
    expect(environmentSchema.validate({ ...config, DB_STATEMENT_TIMEOUT_MS: -1 }).error).toBeDefined();
  });
  it("uses the repository env regardless of the working directory", () => {
    expect(environmentFiles).toEqual([join(__dirname, "../../../.env")]);
  });

  it("builds the connection from PostgreSQL settings and preserves special characters", () => {
    const { value, error } = environmentSchema.validate(config);
    expect(error).toBeUndefined();
    const url = new URL(value.DATABASE_URL);
    expect(decodeURIComponent(url.username)).toBe(config.POSTGRES_USER);
    expect(decodeURIComponent(url.password)).toBe(config.POSTGRES_PASSWORD);
    expect(url.hostname).toBe(config.DB_HOST);
    expect(url.port).toBe(config.DB_PORT);
    expect(url.pathname).toBe("/training");
  });

  it("rejects a missing database password instead of using a fallback", () => {
    expect(environmentSchema.validate({ ...config, POSTGRES_PASSWORD: undefined }).error).toBeDefined();
  });

  it("requires a valid 32-byte DATA_ENCRYPTION_KEY in production and validates format in all modes", () => {
    expect(environmentSchema.validate({ ...config, NODE_ENV: "production" }).error).toBeDefined();
    expect(environmentSchema.validate({ ...config, DATA_ENCRYPTION_KEY: "invalid-key" }).error).toBeDefined();
    const validKey = "a".repeat(64);
    expect(environmentSchema.validate({ ...config, NODE_ENV: "production", DATA_ENCRYPTION_KEY: validKey }).error).toBeUndefined();
  });
});
