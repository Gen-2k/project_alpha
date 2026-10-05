import {
  avatarUrlSchema,
  countryCodeSchema,
  deleteAccountSchema,
  forgotPasswordSchema,
  localeSchema,
  loginSchema,
  nameSchema,
  refreshSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  timezoneSchema,
  updatePasswordSchema,
  updateProfileSchema,
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

  it("accepts optional regional and profile fields when provided", () => {
    const result = registerSchema.safeParse({
      email: "ada@example.com",
      password: "correct-horse-1",
      name: "Ada Lovelace",
      locale: "en-US",
      timezone: "America/New_York",
      countryCode: "us",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Ada Lovelace");
      expect(result.data.locale).toBe("en-US");
      expect(result.data.timezone).toBe("America/New_York");
      expect(result.data.countryCode).toBe("US");
    }
  });

  it("rejects invalid regional fields during registration", () => {
    expect(
      registerSchema.safeParse({
        email: "ada@example.com",
        password: "correct-horse-1",
        timezone: "Invalid/Timezone",
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

describe("nameSchema", () => {
  it("accepts valid names and trims whitespace", () => {
    const result = nameSchema.safeParse("  Ada Lovelace  ");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("Ada Lovelace");
    }
  });

  it("rejects empty names or names exceeding 255 chars", () => {
    expect(nameSchema.safeParse("").success).toBe(false);
    expect(nameSchema.safeParse("   ").success).toBe(false);
    expect(nameSchema.safeParse("a".repeat(256)).success).toBe(false);
  });
});

describe("localeSchema", () => {
  it("accepts valid BCP 47 language tags", () => {
    expect(localeSchema.safeParse("en-US").success).toBe(true);
    expect(localeSchema.safeParse("de-DE").success).toBe(true);
    expect(localeSchema.safeParse("ja-JP").success).toBe(true);
    expect(localeSchema.safeParse("zh-Hans-CN").success).toBe(true);
    expect(localeSchema.safeParse("fr").success).toBe(true);
  });

  it("rejects invalid language tags", () => {
    expect(localeSchema.safeParse("en_US").success).toBe(false);
    expect(localeSchema.safeParse("a").success).toBe(false);
    expect(localeSchema.safeParse("").success).toBe(false);
    expect(localeSchema.safeParse("x".repeat(36)).success).toBe(false);
  });
});

describe("timezoneSchema", () => {
  it("accepts valid IANA timezone identifiers", () => {
    expect(timezoneSchema.safeParse("UTC").success).toBe(true);
    expect(timezoneSchema.safeParse("America/New_York").success).toBe(true);
    expect(timezoneSchema.safeParse("Europe/London").success).toBe(true);
    expect(timezoneSchema.safeParse("Asia/Kolkata").success).toBe(true);
    expect(timezoneSchema.safeParse("Australia/Sydney").success).toBe(true);
  });

  it("rejects non-existent or invalid timezone identifiers", () => {
    expect(timezoneSchema.safeParse("Invalid/Timezone").success).toBe(false);
    expect(timezoneSchema.safeParse("Mars/Olympus").success).toBe(false);
    expect(timezoneSchema.safeParse("UTC+5").success).toBe(false);
    expect(timezoneSchema.safeParse("").success).toBe(false);
  });
});

describe("countryCodeSchema", () => {
  it("accepts and normalizes 2-letter ISO 3166-1 alpha-2 country codes", () => {
    const result1 = countryCodeSchema.safeParse("us");
    expect(result1.success).toBe(true);
    if (result1.success) expect(result1.data).toBe("US");

    const result2 = countryCodeSchema.safeParse("DE");
    expect(result2.success).toBe(true);
    if (result2.success) expect(result2.data).toBe("DE");
  });

  it("rejects invalid country codes", () => {
    expect(countryCodeSchema.safeParse("USA").success).toBe(false);
    expect(countryCodeSchema.safeParse("12").success).toBe(false);
    expect(countryCodeSchema.safeParse("U").success).toBe(false);
    expect(countryCodeSchema.safeParse("").success).toBe(false);
  });
});

describe("avatarUrlSchema", () => {
  it("accepts valid URLs", () => {
    expect(avatarUrlSchema.safeParse("https://example.com/avatar.jpg").success).toBe(true);
  });

  it("rejects invalid URLs", () => {
    expect(avatarUrlSchema.safeParse("not-a-url").success).toBe(false);
    expect(avatarUrlSchema.safeParse("").success).toBe(false);
  });
});

describe("updateProfileSchema", () => {
  it("accepts valid partial profile updates", () => {
    const result = updateProfileSchema.safeParse({
      name: "Ada Lovelace",
      locale: "en-US",
      timezone: "America/New_York",
      countryCode: "us",
      avatarUrl: "https://example.com/avatar.png",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.countryCode).toBe("US");
    }
  });

  it("accepts nullable fields to allow clearing values", () => {
    const result = updateProfileSchema.safeParse({
      name: null,
      countryCode: null,
      avatarUrl: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty update object", () => {
    const result = updateProfileSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "At least one profile field must be provided to update",
      );
    }
  });

  it("rejects invalid fields in update", () => {
    expect(updateProfileSchema.safeParse({ timezone: "Invalid/Zone" }).success).toBe(false);
  });
});
