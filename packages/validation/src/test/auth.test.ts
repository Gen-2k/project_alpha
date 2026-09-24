import { loginSchema, refreshSchema, registerSchema } from "@repo/validation/auth";
import { describe, expect, it } from "vitest";

describe("registerSchema", () => {
  it("accepts a valid email and password", () => {
    expect(
      registerSchema.safeParse({ email: "ada@example.com", password: "correct-horse-1" }).success,
    ).toBe(true);
  });

  it("normalizes and trims email during register", () => {
    const result = registerSchema.safeParse({
      email: "  Ada@Example.COM  ",
      password: "correct-horse-1",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("ada@example.com");
    }
  });

  it("rejects bad emails, short passwords, and overlong passwords", () => {
    expect(
      registerSchema.safeParse({ email: "not-an-email", password: "correct-horse-1" }).success,
    ).toBe(false);
    expect(registerSchema.safeParse({ email: "ada@example.com", password: "short" }).success).toBe(
      false,
    );
    expect(
      registerSchema.safeParse({ email: "ada@example.com", password: "x".repeat(73) }).success,
    ).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts any non-empty credentials", () => {
    expect(loginSchema.safeParse({ email: "a", password: "b" }).success).toBe(true);
  });

  it("rejects empty or missing fields", () => {
    expect(loginSchema.safeParse({ email: "", password: "b" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a" }).success).toBe(false);
  });
});

describe("refreshSchema", () => {
  it("accepts a non-empty token and rejects anything else", () => {
    expect(refreshSchema.safeParse({ refreshToken: "token" }).success).toBe(true);
    expect(refreshSchema.safeParse({ refreshToken: "" }).success).toBe(false);
    expect(refreshSchema.safeParse({}).success).toBe(false);
  });
});
