import { z } from "zod";

// Shared auth contracts: the server validates request bodies with these
// today; any future frontend form imports the same file tomorrow.
// Password rules live here once, not duplicated per consumer.

// 72 chars is bcrypt's hard truncation limit — longer passwords would be
// silently cut, so the schema refuses them loudly instead.
const passwordSchema = z.string().min(8).max(72);

// Email is trimmed and lowercased to prevent case-sensitive collation bugs
// and accidental leading/trailing whitespace. Max 255 chars matches the database column.
const emailSchema = z.string().trim().toLowerCase().pipe(z.email().max(255));

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export type RegisterDto = z.infer<typeof registerSchema>;

// Login intentionally checks shape only (non-empty strings), never strength:
// rejecting "wrong-shaped" input with 400 is fine, but strength rules here
// would leak which half of the credentials failed.
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1),
  password: z.string().min(1),
});

export type LoginDto = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export type RefreshDto = z.infer<typeof refreshSchema>;

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
