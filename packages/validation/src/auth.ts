import { z } from "zod";

// Shared auth contracts: the server validates request bodies with these
// today; any future frontend form imports the same file tomorrow.
// Password rules live here once, not duplicated per consumer.

// 72 chars is bcrypt's hard truncation limit — longer passwords would be
// silently cut, so the schema refuses them loudly instead.
const passwordSchema = z
  .string({ error: "Password is required" })
  .min(8, "Password must be at least 8 characters long")
  .max(72, "Password must not exceed 72 characters");

// Email is trimmed and lowercased to prevent case-sensitive collation bugs
// and accidental leading/trailing whitespace. Max 255 chars matches the database column.
const emailSchema = z
  .string({ error: "Email address is required" })
  .trim()
  .toLowerCase()
  .pipe(
    z
      .email("Please provide a valid email address")
      .max(255, "Email address must not exceed 255 characters"),
  );

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
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
