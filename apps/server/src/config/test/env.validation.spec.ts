import { describe, expect, it } from "vitest";

import { validateEnv } from "../env.validation.js";

describe("validateEnv", () => {
  const validBase = {
    DATABASE_URL: "postgres://user:pass@localhost:5432/db",
    JWT_SECRET: "this-is-a-very-long-secret-key-that-is-over-32-chars",
  };

  it("should validate and apply defaults for optional fields", () => {
    const env = validateEnv(validBase);
    expect(env.NODE_ENV).toBe("development");
    expect(env.LOG_LEVEL).toBe("info");
    expect(env.PORT).toBe(3001);
    expect(env.CORS_ORIGIN).toBe("http://localhost:3000");
    expect(env.JWT_ACCESS_EXPIRES_IN).toBe("15m");
    expect(env.JWT_REFRESH_EXPIRES_IN).toBe("7d");
    expect(env.DATABASE_URL).toBe(validBase.DATABASE_URL);
    expect(env.JWT_SECRET).toBe(validBase.JWT_SECRET);
  });

  it("should accept custom valid values", () => {
    const env = validateEnv({
      ...validBase,
      NODE_ENV: "production",
      LOG_LEVEL: "warn",
      PORT: "8080",
      CORS_ORIGIN: "https://example.com,https://app.example.com",
      JWT_ACCESS_EXPIRES_IN: "30m",
      JWT_REFRESH_EXPIRES_IN: "14d",
    });
    expect(env.NODE_ENV).toBe("production");
    expect(env.LOG_LEVEL).toBe("warn");
    expect(env.PORT).toBe(8080);
    expect(env.CORS_ORIGIN).toBe("https://example.com,https://app.example.com");
    expect(env.JWT_ACCESS_EXPIRES_IN).toBe("30m");
    expect(env.JWT_REFRESH_EXPIRES_IN).toBe("14d");
  });

  it("should throw if JWT_SECRET is shorter than 32 characters", () => {
    expect(() =>
      validateEnv({
        ...validBase,
        JWT_SECRET: "too-short",
      }),
    ).toThrow("Invalid environment variables");
  });

  it("should throw if DATABASE_URL is not a valid URL", () => {
    expect(() =>
      validateEnv({
        ...validBase,
        DATABASE_URL: "not-a-valid-url",
      }),
    ).toThrow("Invalid environment variables");
  });

  it("should throw if PORT is out of valid port range", () => {
    expect(() =>
      validateEnv({
        ...validBase,
        PORT: 70000,
      }),
    ).toThrow("Invalid environment variables");
  });

  it("should throw if JWT duration format is invalid", () => {
    expect(() =>
      validateEnv({
        ...validBase,
        JWT_ACCESS_EXPIRES_IN: "15hours",
      }),
    ).toThrow("Invalid environment variables");
  });

  it("should throw if LOG_LEVEL is invalid", () => {
    expect(() =>
      validateEnv({
        ...validBase,
        LOG_LEVEL: "verbose_nonsense",
      }),
    ).toThrow("Invalid environment variables");
  });

  it("should throw if NODE_ENV is invalid", () => {
    expect(() =>
      validateEnv({
        ...validBase,
        NODE_ENV: "staging_invalid",
      }),
    ).toThrow("Invalid environment variables");
  });
});
