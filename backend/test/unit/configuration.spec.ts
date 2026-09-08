import { environmentFiles, environmentSchema } from "../../src/config/configuration.js";
import { fileURLToPath } from "node:url";

const config = {
  PORT: "3001", DB_HOST: "127.0.0.1", DB_PORT: "55432",
  POSTGRES_DB: "training", POSTGRES_USER: "user@local",
  POSTGRES_PASSWORD: "p@ss:/?#%word",
  SESSION_SECRET: "test-session-secret-with-at-least-32-characters",
  FRONTEND_URL: "http://localhost:3100", API_PUBLIC_URL: "http://localhost:3001",
};

describe("shared environment configuration", () => {
  it("uses the repository env regardless of the working directory", () => {
    expect(environmentFiles).toEqual([fileURLToPath(new URL("../../../.env", import.meta.url))]);
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
});
