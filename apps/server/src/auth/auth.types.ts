import type { Request } from "express";

// JWT access-token payload. Refresh tokens add `type: "refresh"` so an
// access token can never be mistaken for a refresh token (checked in
// AuthService.refresh — fail closed on confusion).
export interface JwtPayload {
  sub: string;
  email: string;
}

export type RefreshPayload = JwtPayload & { type: "refresh" };

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
