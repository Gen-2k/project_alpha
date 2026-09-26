import { createHash, randomUUID } from "node:crypto";

import { ConflictException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { Db } from "@repo/database/client";
import { DB } from "@repo/database/client";
import { refreshTokens } from "@repo/database/schema";
import { uuidv7 } from "@repo/database/uuid";
import type {
  AuthTokens,
  LoginDto,
  RefreshDto,
  RegisterDto,
  SafeUser,
  SessionDto,
} from "@repo/validation/auth";
import bcrypt from "bcryptjs";
import { and, eq, gt, isNotNull, isNull, lt, or } from "drizzle-orm";
import type { StringValue } from "ms";
import ms from "ms";

import { UsersService } from "../users/users.service.js";
import type { JwtPayload, RefreshPayload, RequestMetadata } from "./auth.types.js";

const BCRYPT_COST = 12;
const ROTATION_GRACE_PERIOD_MS = 30_000;
// Precomputed bcrypt cost-12 hash used to equalize execution time on unknown email
// so attackers cannot perform timing attacks to enumerate registered accounts (OWASP ASVS 2.8.1).
const DUMMY_BCRYPT_HASH = "$2b$12$e8nGyvKz8vK5e.gM1L9OVuP4oN1D4hJ7gP.5rM.1gV8z7k0s3y1a2";

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
  readonly refreshExpiresInMs: number;

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
    const familyId = uuidv7();
    return this.issueTokens(user, familyId, meta);
  }

  // Unknown email and wrong password fail identically in both message and execution
  // time (constant-time check against a dummy hash when user is null) to prevent
  // account enumeration via timing attacks (OWASP ASVS 2.8.1).
  async login(dto: LoginDto, meta?: RequestMetadata): Promise<AuthTokens> {
    const user = await this.usersService.findByEmailWithHash(dto.email);
    const hashToCompare = user?.passwordHash ?? DUMMY_BCRYPT_HASH;
    const isPasswordValid = await bcrypt.compare(dto.password, hashToCompare);

    if (!user || !isPasswordValid) {
      throw new UnauthorizedException("Invalid credentials");
    }
    // Strip the hash explicitly (field by field, no rest-destructure):
    // what leaves this method is provably hash-free by construction.
    const { id, email, createdAt, updatedAt } = user;
    const familyId = uuidv7();
    return this.issueTokens({ id, email, createdAt, updatedAt }, familyId, meta);
  }

  async refresh(dto: RefreshDto, meta?: RequestMetadata): Promise<AuthTokens> {
    let payload: RefreshPayload;
    try {
      // Verify as the wide shape first: the `type` discriminator is
      // untrusted wire input until this check passes (fail closed).
      const verified = await this.jwtService.verifyAsync<
        JwtPayload & { type?: unknown; familyId?: unknown }
      >(dto.refreshToken);
      if (verified.type !== "refresh") throw new UnauthorizedException("Invalid refresh token");
      payload = {
        ...verified,
        type: "refresh",
        familyId: typeof verified.familyId === "string" ? verified.familyId : undefined,
      };
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
        // Concurrently rotated: fail closed for this request without revoking the family
        throw new UnauthorizedException("Token already rotated");
      }
      // Replay after grace window: token theft detected! Revoke the entire compromised family.
      // (RFC 6819 Section 5.2.2.3: Revoke all tokens in the affected family, leaving other devices intact).
      await this.revokeFamily(stored.familyId);
      throw new UnauthorizedException("Refresh token has been revoked");
    }

    if (stored.expiresAt.getTime() < Date.now()) {
      await this.db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash));
      throw new UnauthorizedException("Invalid refresh token");
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user) throw new UnauthorizedException("Invalid refresh token");

    return this.db.transaction(async (tx) => {
      // Mark current token as rotated. Filtering by isNull(revokedAt) atomically
      // guarantees that if two concurrent requests hit rotation with the same token,
      // only one succeeds in updating and issuing new tokens (closes race condition).
      const updated = await tx
        .update(refreshTokens)
        .set({ revokedAt: new Date() })
        .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)))
        .returning({ id: refreshTokens.id });

      if (updated.length === 0) {
        throw new UnauthorizedException("Token already rotated");
      }

      return this.issueTokens(user, stored.familyId, meta, tx);
    });
  }

  // Idempotent by design: invalidates the entire token family (session) so no
  // old or future tokens from this session can be used.
  async logout(dto: RefreshDto): Promise<{ loggedOut: true }> {
    const tokenHash = hashToken(dto.refreshToken);
    const [stored] = await this.db
      .select({ familyId: refreshTokens.familyId })
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash));

    if (stored) {
      await this.revokeFamily(stored.familyId);
    }
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
        familyId: refreshTokens.familyId,
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
    const [target] = await this.db
      .select({ familyId: refreshTokens.familyId })
      .from(refreshTokens)
      .where(
        and(
          or(eq(refreshTokens.id, sessionId), eq(refreshTokens.familyId, sessionId)),
          eq(refreshTokens.userId, userId),
        ),
      );

    if (target) {
      await this.revokeFamily(target.familyId);
    }
    return { revoked: true as const };
  }

  async me(userId: string): Promise<SafeUser> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new UnauthorizedException("Invalid credentials");
    return user;
  }

  private async issueTokens(
    user: SafeUser,
    familyId: string,
    meta?: RequestMetadata,
    executor: Pick<Db, "insert"> = this.db,
  ): Promise<AuthTokens> {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: this.accessExpiresInMs,
    });
    const refreshToken = await this.jwtService.signAsync(
      { ...payload, type: "refresh", familyId } as const,
      {
        expiresIn: this.refreshExpiresInMs,
        jwtid: randomUUID(),
      },
    );
    await executor.insert(refreshTokens).values({
      userId: user.id,
      familyId,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + this.refreshExpiresInMs),
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });
    return { accessToken, refreshToken, user };
  }

  async cleanupExpiredTokens(
    revocationRetentionMs = 24 * 60 * 60 * 1000,
  ): Promise<{ deleted: number }> {
    const now = new Date();
    const revocationCutoff = new Date(now.getTime() - revocationRetentionMs);

    const deletedRows = await this.db
      .delete(refreshTokens)
      .where(
        or(
          lt(refreshTokens.expiresAt, now),
          and(isNotNull(refreshTokens.revokedAt), lt(refreshTokens.revokedAt, revocationCutoff)),
        ),
      )
      .returning({ id: refreshTokens.id });

    return { deleted: deletedRows.length };
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.db.delete(refreshTokens).where(eq(refreshTokens.familyId, familyId));
  }

  private async revokeAll(userId: string): Promise<void> {
    await this.db.delete(refreshTokens).where(eq(refreshTokens.userId, userId));
  }
}
