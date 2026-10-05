import { z } from "zod";

// Shared auth contracts: the server validates request bodies with these
// today; any future frontend form imports the same file tomorrow.
// Password rules live here once, not duplicated per consumer.

// 72 chars is bcrypt's hard truncation limit — longer passwords would be
// silently cut, so the schema refuses them loudly instead.
export const passwordSchema = z
  .string({ error: "Password is required" })
  .min(8, "Password must be at least 8 characters long")
  .max(72, "Password must not exceed 72 characters");

// Email is trimmed and lowercased to prevent case-sensitive collation bugs
// and accidental leading/trailing whitespace. Max 255 chars matches the database column.
export const emailSchema = z
  .string({ error: "Email address is required" })
  .trim()
  .toLowerCase()
  .pipe(
    z
      .email("Please provide a valid email address")
      .max(255, "Email address must not exceed 255 characters"),
  );

// User name: optional at registration, up to 255 chars
export const nameSchema = z
  .string({ error: "Name must be a valid string" })
  .trim()
  .min(1, "Name must not be empty")
  .max(255, "Name must not exceed 255 characters");

// BCP 47 language tag (e.g. "en-US", "de-DE", "ja-JP", "zh-Hans-CN")
export const localeSchema = z
  .string({ error: "Locale is required" })
  .trim()
  .max(35, "Locale tag must not exceed 35 characters")
  .regex(
    /^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]+)*$/,
    "Please provide a valid BCP 47 language tag (e.g. en-US)",
  );

// IANA timezone identifier (e.g. "UTC", "America/New_York", "Europe/London", "Asia/Kolkata")
// Verified at runtime via Intl.DateTimeFormat (native to Node.js 24 and modern browsers)
export const timezoneSchema = z
  .string({ error: "Timezone is required" })
  .trim()
  .max(64, "Timezone identifier must not exceed 64 characters")
  .refine(
    (tz) => {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    },
    { message: "Please provide a valid IANA timezone identifier (e.g. UTC, America/New_York)" },
  );

// ISO 3166-1 alpha-2 country code (e.g. "US", "DE", "IN", "GB")
export const countryCodeSchema = z
  .string({ error: "Country code must be a 2-letter code" })
  .trim()
  .toUpperCase()
  .regex(
    /^[A-Z]{2}$/,
    "Please provide a valid 2-letter ISO 3166-1 alpha-2 country code (e.g. US, DE)",
  );

// Avatar URL: web address up to 2048 chars
export const avatarUrlSchema = z
  .string({ error: "Avatar URL must be a valid string" })
  .trim()
  .pipe(
    z
      .url("Please provide a valid URL for avatar")
      .max(2048, "Avatar URL must not exceed 2048 characters"),
  );

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema.optional(),
  locale: localeSchema.optional(),
  timezone: timezoneSchema.optional(),
  countryCode: countryCodeSchema.optional(),
});

export type RegisterDto = z.infer<typeof registerSchema>;

// Login intentionally checks shape only (non-empty strings), never strength:
// rejecting "wrong-shaped" input with 400 is fine, but strength rules here
// would leak which half of the credentials failed.
export const loginSchema = z.object({
  email: z
    .string({ error: "Email address is required" })
    .trim()
    .toLowerCase()
    .min(1, "Email address is required"),
  password: z.string({ error: "Password is required" }).min(1, "Password is required"),
});

export type LoginDto = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z
    .string({ error: "Refresh token is required" })
    .min(1, "Refresh token is required"),
});

export type RefreshDto = z.infer<typeof refreshSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z
    .string({ error: "Password reset token is required" })
    .min(1, "Password reset token is required"),
  newPassword: passwordSchema,
});

export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;

export const updatePasswordSchema = z
  .object({
    currentPassword: z
      .string({ error: "Current password is required" })
      .min(1, "Current password is required"),
    newPassword: passwordSchema,
    refreshToken: z.string().optional(),
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from your current password",
    path: ["newPassword"],
  });

export type UpdatePasswordDto = z.infer<typeof updatePasswordSchema>;

export const deleteAccountSchema = z.object({
  password: z
    .string({ error: "Password is required to confirm account deletion" })
    .min(1, "Password is required to confirm account deletion"),
});

export type DeleteAccountDto = z.infer<typeof deleteAccountSchema>;

export const verifyEmailSchema = z.object({
  token: z
    .string({ error: "Verification token is required" })
    .min(1, "Verification token is required"),
});

export type VerifyEmailDto = z.infer<typeof verifyEmailSchema>;

export const resendVerificationSchema = z.object({
  email: emailSchema,
});

export type ResendVerificationDto = z.infer<typeof resendVerificationSchema>;

export const updateProfileSchema = z
  .object({
    name: nameSchema.nullable().optional(),
    locale: localeSchema.optional(),
    timezone: timezoneSchema.optional(),
    countryCode: countryCodeSchema.nullable().optional(),
    avatarUrl: avatarUrlSchema.nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one profile field must be provided to update",
  });

export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;

export interface MessageResponseDto {
  message: string;
}

export interface RegisterResponseDto {
  message: string;
  email: string;
}

export interface DeleteAccountResponseDto {
  deleted: true;
  message: string;
}

export interface SessionDto {
  id: string;
  familyId: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  expiresAt: Date;
}

export interface UserDto {
  id: string;
  email: string;
  name: string | null;
  locale: string;
  timezone: string;
  countryCode: string | null;
  avatarUrl: string | null;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type SafeUser = UserDto;

export interface AuthTokensDto {
  accessToken: string;
  refreshToken: string;
  user: UserDto;
}

export type AuthTokens = AuthTokensDto;
