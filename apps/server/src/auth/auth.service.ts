import { createHash } from "node:crypto";

import { ConflictException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { Db } from "@repo/database/client";
import { DB } from "@repo/database/client";
import { refreshTokens } from "@repo/database/schema";
import type {
  AuthTokens,
  LoginDto,
  RefreshDto,
  RegisterDto,
  SafeUser,
  SessionDto,
} from "@repo/validation/auth";
import bcrypt from "bcryptjs";
import { and, eq, gt, isNull } from "drizzle-orm";
import type { StringValue } from "ms";
import ms from "ms";

import { UsersService } from "../users/users.service.js";
import type { JwtPayload, RefreshPayload, RequestMetadata } from "./auth.types.js";

const BCRYPT_COST = 12;
const ROTATION_GRACE_PERIOD_MS = 30_000;

export type { AuthTokens };

// Refresh tokens are stored as SHA-256 hashes, never raw: bcrypt is salted
// so it cannot be looked up, and lookup-by-hash is the whole point (rotation
// checks + logout deletes). A leaked hash can't be reversed into a token.
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

@Injectable()
export class AuthService {
  // Milliseconds, converted once: jsonwebtoken accepts ms numbers, and a
  // number leaves no ambiguity about units at signing time. The single
  // cast is sound because env validation already constrains shape to
  // /^\d+[smhd]$/ (a subset of StringValue).
  private readonly accessExpiresInMs: number;
  private readonly refreshExpiresInMs: number;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    config: ConfigService,
    @Inject(DB) private readonly db: Db,
  ) {
    this.accessExpiresInMs = ms(config.getOrThrow<string>("JWT_ACCESS_EXPIRES_IN") as StringValue);
    this.refreshExpiresInMs = ms(
      config.getOrThrow<string>("JWT_REFRESH_EXPIRES_IN") as StringValue,
    );
  }

  async register(dto: RegisterDto, meta?: RequestMetadata): Promise<AuthTokens> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) throw new ConflictException("Email already registered");

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST);
    const user = await this.usersService.create({ email: dto.email, passwordHash });
    return this.issueTokens(user, meta);
  }

  // Unknown email and wrong password fail identically: distinguishing them
  // would let attackers enumerate registered emails.
  async login(dto: LoginDto, meta?: RequestMetadata): Promise<AuthTokens> {
    const user = await this.usersService.findByEmailWithHash(dto.email);
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid credentials");
    }
    // Strip the hash explicitly (field by field, no rest-destructure):
    // what leaves this method is provably hash-free by construction.
    const { id, email, createdAt, updatedAt } = user;
    return this.issueTokens({ id, email, createdAt, updatedAt }, meta);
  }

  async refresh(dto: RefreshDto, meta?: RequestMetadata): Promise<AuthTokens> {
    let payload: RefreshPayload;
    try {
      // Verify as the wide shape first: the `type` discriminator is
      // untrusted wire input until this check passes (fail closed).
      const verified = await this.jwtService.verifyAsync<JwtPayload & { type?: unknown }>(
        dto.refreshToken,
      );
      if (verified.type !== "refresh") throw new UnauthorizedException("Invalid refresh token");
      payload = { ...verified, type: "refresh" };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    const tokenHash = hashToken(dto.refreshToken);
    const [stored] = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash));

    if (!stored) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    // Grace period check: prevents race condition where concurrent requests
    // from the same client nuke all user sessions.
    if (stored.revokedAt) {
      const isWithinGrace = Date.now() - stored.revokedAt.getTime() < ROTATION_GRACE_PERIOD_MS;
      if (isWithinGrace) {
        // Concurrently rotated: fail closed for this request without revoking all sessions
        throw new UnauthorizedException("Token already rotated");
      }
      // Replay after grace window: assume theft, revoke everything for this user.
      await this.revokeAll(payload.sub);
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (stored.expiresAt.getTime() < Date.now()) {
      await this.db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash));
      throw new UnauthorizedException("Invalid refresh token");
    }

    // Mark current token as rotated
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.tokenHash, tokenHash));

    const user = await this.usersService.findById(payload.sub);
    if (!user) throw new UnauthorizedException("Invalid refresh token");
    return this.issueTokens(user, meta);
  }

  // Idempotent by design: unknown or expired tokens still succeed, so
  // logout responses never reveal whether a token was valid.
  async logout(dto: RefreshDto): Promise<{ loggedOut: true }> {
    await this.db
      .delete(refreshTokens)
      .where(eq(refreshTokens.tokenHash, hashToken(dto.refreshToken)));
    return { loggedOut: true as const };
  }

  async logoutAll(userId: string): Promise<{ loggedOut: true }> {
    await this.revokeAll(userId);
    return { loggedOut: true as const };
  }

  async listSessions(userId: string): Promise<SessionDto[]> {
    const rows = await this.db
      .select({
        id: refreshTokens.id,
        ipAddress: refreshTokens.ipAddress,
        userAgent: refreshTokens.userAgent,
        createdAt: refreshTokens.createdAt,
        expiresAt: refreshTokens.expiresAt,
      })
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.userId, userId),
          isNull(refreshTokens.revokedAt),
          gt(refreshTokens.expiresAt, new Date()),
        ),
      );
    return rows;
  }

  async revokeSession(userId: string, sessionId: string): Promise<{ revoked: true }> {
    await this.db
      .delete(refreshTokens)
      .where(and(eq(refreshTokens.id, sessionId), eq(refreshTokens.userId, userId)));
    return { revoked: true as const };
  }

  async me(userId: string): Promise<SafeUser> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException("Invalid credentials");
    return user;
  }

  private async issueTokens(user: SafeUser, meta?: RequestMetadata): Promise<AuthTokens> {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: this.accessExpiresInMs,
    });
    const refreshToken = await this.jwtService.signAsync({ ...payload, type: "refresh" } as const, {
      expiresIn: this.refreshExpiresInMs,
    });
    await this.db.insert(refreshTokens).values({
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + this.refreshExpiresInMs),
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });
    return { accessToken, refreshToken, user };
  }

  private async revokeAll(userId: string): Promise<void> {
    await this.db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
  }
}
