import type { Request } from "express";

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
