import {
  deleteAccountSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  updatePasswordSchema,
  verifyEmailSchema,
} from "@repo/validation/auth";
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
    expect(
      registerSchema.safeParse({
        email: `${"a".repeat(250)}@example.com`,
        password: "correct-horse-1",
      }).success,
    ).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts any non-empty credentials and normalizes email", () => {
    const result = loginSchema.safeParse({ email: "  Ada@Example.COM  ", password: "b" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("ada@example.com");
      expect(result.data.password).toBe("b");
    }
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

describe("forgotPasswordSchema", () => {
  it("accepts a valid email and normalizes it", () => {
    const result = forgotPasswordSchema.safeParse({ email: "  User@Example.COM  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("user@example.com");
    }
  });

  it("rejects invalid email formats", () => {
    expect(forgotPasswordSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
    expect(forgotPasswordSchema.safeParse({ email: "" }).success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("accepts a valid token and password", () => {
    expect(
      resetPasswordSchema.safeParse({
        token: "random-reset-token-hex",
        newPassword: "fresh-strong-password-1",
      }).success,
    ).toBe(true);
  });

  it("rejects empty token, short password, or overlong password", () => {
    expect(
      resetPasswordSchema.safeParse({
        token: "",
        newPassword: "fresh-strong-password-1",
      }).success,
    ).toBe(false);

    expect(
      resetPasswordSchema.safeParse({
        token: "token",
        newPassword: "short",
      }).success,
    ).toBe(false);

    expect(
      resetPasswordSchema.safeParse({
        token: "token",
        newPassword: "x".repeat(73),
      }).success,
    ).toBe(false);
  });
});

describe("updatePasswordSchema", () => {
  it("accepts valid and different current and new passwords", () => {
    expect(
      updatePasswordSchema.safeParse({
        currentPassword: "old-password-123",
        newPassword: "new-password-456",
      }).success,
    ).toBe(true);
  });

  it("rejects identical current and new passwords", () => {
    const result = updatePasswordSchema.safeParse({
      currentPassword: "same-password-123",
      newPassword: "same-password-123",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "New password must be different from your current password",
      );
    }
  });

  it("rejects invalid password constraints", () => {
    expect(
      updatePasswordSchema.safeParse({
        currentPassword: "",
        newPassword: "new-password-456",
      }).success,
    ).toBe(false);

    expect(
      updatePasswordSchema.safeParse({
        currentPassword: "old-password-123",
        newPassword: "short",
      }).success,
    ).toBe(false);
  });
});

describe("deleteAccountSchema", () => {
  it("accepts non-empty password", () => {
    expect(deleteAccountSchema.safeParse({ password: "my-password" }).success).toBe(true);
  });

  it("rejects empty password", () => {
    expect(deleteAccountSchema.safeParse({ password: "" }).success).toBe(false);
  });
});

describe("verifyEmailSchema", () => {
  it("accepts non-empty verification token", () => {
    expect(verifyEmailSchema.safeParse({ token: "raw-verification-token" }).success).toBe(true);
  });

  it("rejects empty verification token", () => {
    expect(verifyEmailSchema.safeParse({ token: "" }).success).toBe(false);
  });
});

describe("resendVerificationSchema", () => {
  it("accepts valid email and normalizes it", () => {
    const result = resendVerificationSchema.safeParse({ email: "  User@Example.COM  " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("user@example.com");
    }
  });

  it("rejects invalid email formats", () => {
    expect(resendVerificationSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
  });
});
