import type { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";

// JWT access-token payload. Refresh tokens add `type: "refresh"` so tokens
// cannot be confused across boundaries: AuthService.refresh rejects non-refresh
// tokens, and JwtAuthGuard rejects refresh tokens from Bearer auth (OWASP ASVS V3.5.3).
export interface JwtPayload {
  sub: string;
  email: string;
  locale?: string;
}

export type RefreshPayload = JwtPayload & { type: "refresh"; familyId?: string; jti?: string };

// The single place request.user is typed. The guard is the only code
// allowed to populate it (one sanctioned cast, in the guard).
export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

export interface RequestMetadata {
  ipAddress?: string;
  userAgent?: string;
}

// Token-email lifetimes live here (not in the service) so AuthService and
// MailService derive DB expiry and display values from the same constants.
export const RESET_TOKEN_LIFETIME_MS = 15 * 60 * 1000;
export const VERIFICATION_TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1000;

export const REFRESH_COOKIE_NAME = "refreshToken";
export const REFRESH_COOKIE_PATH = "/api/v1/auth";

// Validated source first, raw env as fallback: ConfigModule is global, but
// these helpers are also called from contexts without DI (and unit tests).
export function resolveCookieSecure(config?: Pick<ConfigService, "get">): boolean {
  const fromConfig = config?.get<string>("NODE_ENV");
  return (fromConfig ?? process.env.NODE_ENV) === "production";
}

export function setRefreshTokenCookie(
  res: Response,
  token: string,
  maxAge: number,
  secure: boolean,
): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: REFRESH_COOKIE_PATH,
    maxAge,
  });
}

export function clearRefreshTokenCookie(res: Response, secure: boolean): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure,
    sameSite: "strict",
    path: REFRESH_COOKIE_PATH,
  });
}

export function extractRequestMetadata(req: Request): RequestMetadata {
  const forwarded = req.headers["x-forwarded-for"];
  const forwardedIp = Array.isArray(forwarded)
    ? forwarded[0]
    : typeof forwarded === "string"
      ? forwarded.split(",")[0]?.trim()
      : undefined;
  const ipAddress = forwardedIp ?? req.ip;
  const userAgent = req.headers["user-agent"];
  return { ipAddress, userAgent };
}
