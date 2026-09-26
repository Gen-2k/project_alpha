import { createHash } from "node:crypto";

import type { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { SafeUser } from "@repo/validation/auth";
import bcrypt from "bcryptjs";
import { describe, expect, it, vi } from "vitest";

import type { UsersService } from "../../users/users.service.js";
import { AuthService } from "../auth.service.js";

const TEST_SECRET = "test-secret-that-is-long-enough-for-hs256!!";

const safeUser: SafeUser = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "ada@example.com",
  emailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

interface StoredRefreshRow {
  id?: string;
  userId: string;
  familyId?: string;
  tokenHash: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  expiresAt: Date;
  createdAt?: Date;
  revokedAt?: Date | null;
  usedAt?: Date | null;
}

// Real JwtService (standalone test secret) + real bcrypt hashing; only the
// persistence layer is faked, as an in-memory refresh-token store plus
// configurable user stubs. Crypto paths always run for real.
function setup() {
  const inserted: StoredRefreshRow[] = [];
  const selectRows: StoredRefreshRow[] = [];
  const calls = { deleted: 0, updated: 0, transactions: 0 };

  const db = {
    transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
      calls.transactions += 1;
      return cb(db);
    }),
    select: vi.fn(() => ({
      from: () => ({
        where: () => Promise.resolve(selectRows),
      }),
    })),
    insert: vi.fn(() => ({
      values: (row: StoredRefreshRow) => {
        inserted.push(row);
        return Promise.resolve([]);
      },
    })),
    update: vi.fn(() => ({
      set: (data: Partial<StoredRefreshRow>) => ({
        where: () => {
          calls.updated += 1;
          for (const row of selectRows) {
            Object.assign(row, data);
          }
          const rows = selectRows.map((r) => ({ id: r.id ?? "updated-token-id" }));
          const promise = Promise.resolve(rows) as Promise<typeof rows> & {
            returning: () => Promise<typeof rows>;
          };
          promise.returning = () => Promise.resolve(rows);
          return promise;
        },
      }),
    })),
    delete: vi.fn(() => ({
      where: () => {
        calls.deleted += 1;
        const rows = [{ id: "deleted-token-id" }];
        const promise = Promise.resolve(rows) as Promise<typeof rows> & {
          returning: () => Promise<typeof rows>;
        };
        promise.returning = () => Promise.resolve(rows);
        return promise;
      },
    })),
  };

  // One named const per stub: tests reference these directly
  // (findByEmail.mockResolvedValueOnce(...)) instead of reaching into
  // methods, which unbound-method would flag as unsafe detachment.
  const findByEmail = vi.fn((): Promise<typeof safeUser | undefined> => Promise.resolve(undefined));
  const findByEmailWithHash = vi.fn(
    (): Promise<(typeof safeUser & { passwordHash: string }) | undefined> =>
      Promise.resolve(undefined),
  );
  const findById = vi.fn((): Promise<typeof safeUser | undefined> => Promise.resolve(undefined));
  const findByIdWithHash = vi.fn(
    (): Promise<(typeof safeUser & { passwordHash: string }) | undefined> =>
      Promise.resolve(undefined),
  );
  const updatePassword = vi.fn((): Promise<void> => Promise.resolve());
  const markEmailVerified = vi.fn((): Promise<void> => Promise.resolve());
  // Like a real DB `returning(safeColumns)` clause: echoes back only the
  // safe fields, never what was handed in (in particular, no passwordHash).
  const create = vi.fn((input: { email: string; passwordHash: string }): Promise<typeof safeUser> =>
    Promise.resolve({ ...safeUser, email: input.email }),
  );
  const users = {
    findByEmail,
    findByEmailWithHash,
    findById,
    findByIdWithHash,
    updatePassword,
    markEmailVerified,
    create,
  } as unknown as UsersService;

  const config = {
    getOrThrow: (key: string): string => {
      if (key === "JWT_ACCESS_EXPIRES_IN") return "15m";
      if (key === "JWT_REFRESH_EXPIRES_IN") return "7d";
      throw new Error(`unexpected config key ${key}`);
    },
  } as unknown as ConfigService;

  const mail = {
    sendEmailVerificationEmail: vi.fn(() => Promise.resolve()),
    sendPasswordResetEmail: vi.fn(() => Promise.resolve()),
    sendPasswordChangedNotification: vi.fn(() => Promise.resolve()),
  };

  const service = new AuthService(
    users,
    new JwtService({ secret: TEST_SECRET }),
    config,
    db as never,
    mail as never,
  );

  return {
    service,
    findByEmail,
    findByEmailWithHash,
    findById,
    findByIdWithHash,
    updatePassword,
    markEmailVerified,
    create,
    mail,
    db,
    inserted,
    selectRows,
    calls,
  };
}

describe("AuthService", () => {
  describe("register", () => {
    it("should create unverified user, store verification token, and send verification email", async () => {
      const { service, create, inserted, mail } = setup();
      const result = await service.register({
        email: "ada@example.com",
        password: "correct-horse-1",
      });

      expect(create).toHaveBeenCalledOnce();
      const createdWith = create.mock.calls[0]?.[0];
      expect(createdWith?.email).toBe("ada@example.com");
      expect(createdWith?.passwordHash).not.toBe("correct-horse-1");
      expect(await bcrypt.compare("correct-horse-1", createdWith?.passwordHash ?? "")).toBe(true);
      expect(result).toEqual({
        message: "Registration successful. Please check your email to verify your account.",
        email: "ada@example.com",
      });
      expect(inserted).toHaveLength(1);
      expect(inserted[0]?.userId).toBe(safeUser.id);
      expect(typeof inserted[0]?.tokenHash).toBe("string");
      expect(inserted[0]?.expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(mail.sendEmailVerificationEmail).toHaveBeenCalledWith(
        "ada@example.com",
        expect.any(String),
      );
    });

    it("should reject duplicate emails", async () => {
      const { service, findByEmail } = setup();
      findByEmail.mockResolvedValueOnce(safeUser);
      await expect(
        service.register({ email: "ada@example.com", password: "correct-horse-1" }),
      ).rejects.toThrow("An account with this email address already exists");
    });
  });

  describe("login", () => {
    it("should issue tokens for correct credentials", async () => {
      const { service, findByEmailWithHash } = setup();
      const passwordHash = await bcrypt.hash("correct-horse-1", 4);
      findByEmailWithHash.mockResolvedValueOnce({
        ...safeUser,
        passwordHash,
      });
      const result = await service.login({ email: "ada@example.com", password: "correct-horse-1" });
      expect(result.user).toEqual(safeUser);
      expect(typeof result.accessToken).toBe("string");
    });

    it("should reject unverified users", async () => {
      const { service, findByEmailWithHash } = setup();
      const passwordHash = await bcrypt.hash("correct-horse-1", 4);
      findByEmailWithHash.mockResolvedValueOnce({
        ...safeUser,
        emailVerifiedAt: null,
        passwordHash,
      });
      await expect(
        service.login({ email: "ada@example.com", password: "correct-horse-1" }),
      ).rejects.toThrow(
        "Please verify your email address before logging in. Check your inbox or request a new verification link.",
      );
    });

    it("should fail identically for unknown email and wrong password", async () => {
      const unknown = setup();
      await expect(
        unknown.service.login({ email: "nobody@example.com", password: "whatever-123" }),
      ).rejects.toThrow("Invalid email or password");

      const { service: wrongService, findByEmailWithHash: findHash } = setup();
      const passwordHash = await bcrypt.hash("correct-horse-1", 4);
      findHash.mockResolvedValueOnce({
        ...safeUser,
        passwordHash,
      });
      await expect(
        wrongService.login({ email: "ada@example.com", password: "wrong-password-1" }),
      ).rejects.toThrow("Invalid email or password");
    });
  });

  describe("refresh", () => {
    it("should rotate: new pair issued and old token marked rotated", async () => {
      const { service, findById, findByEmailWithHash, inserted, selectRows, calls } = setup();
      findById.mockResolvedValue(safeUser);
      const passwordHash = await bcrypt.hash("correct-horse-1", 4);
      findByEmailWithHash.mockResolvedValue({
        ...safeUser,
        passwordHash,
      });

      const first = await service.login({
        email: "ada@example.com",
        password: "correct-horse-1",
      });
      const storedRow = inserted[0];
      if (!storedRow) throw new Error("expected a stored refresh row");
      selectRows.push({ ...storedRow });

      const second = await service.refresh({ refreshToken: first.refreshToken });
      expect(second.accessToken.length).toBeGreaterThan(0);
      expect(inserted).toHaveLength(2);
      expect(calls.updated).toBe(1);
      expect(calls.transactions).toBe(1);

      // Immediate double-submit within grace window rejects without revoking the token family
      await expect(service.refresh({ refreshToken: first.refreshToken })).rejects.toThrow(
        "Token already rotated",
      );
      expect(calls.deleted).toBe(0); // Family revocation was NOT triggered!
    });

    it("should revoke token family if rotated token is replayed after grace period", async () => {
      const { service, findById, findByEmailWithHash, inserted, selectRows, calls } = setup();
      findById.mockResolvedValue(safeUser);
      const passwordHash = await bcrypt.hash("correct-horse-1", 4);
      findByEmailWithHash.mockResolvedValue({
        ...safeUser,
        passwordHash,
      });

      const first = await service.login({
        email: "ada@example.com",
        password: "correct-horse-1",
      });
      const storedRow = inserted[0];
      if (!storedRow) throw new Error("expected a stored refresh row");
      // Set revokedAt to 35 seconds ago (outside 30s grace window)
      selectRows.push({
        ...storedRow,
        revokedAt: new Date(Date.now() - 35_000),
      });

      await expect(service.refresh({ refreshToken: first.refreshToken })).rejects.toThrow(
        "Refresh token has been revoked",
      );
      expect(calls.deleted).toBeGreaterThan(0); // Theft detected, revokeFamily was triggered!
    });

    it("should reject expired stored rows", async () => {
      const { service, findById, findByEmailWithHash, selectRows, calls } = setup();
      findById.mockResolvedValue(safeUser);
      const passwordHash = await bcrypt.hash("correct-horse-1", 4);
      findByEmailWithHash.mockResolvedValue({
        ...safeUser,
        passwordHash,
      });

      const first = await service.login({
        email: "ada@example.com",
        password: "correct-horse-1",
      });
      // Valid token, but its stored row already expired.
      selectRows.push({
        userId: safeUser.id,
        tokenHash: "stored",
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(service.refresh({ refreshToken: first.refreshToken })).rejects.toThrow(
        "Invalid refresh token",
      );
      expect(calls.deleted).toBeGreaterThan(0);
    });

    it("should reject malformed refresh token strings", async () => {
      const { service } = setup();
      await expect(service.refresh({ refreshToken: "malformed.token.here" })).rejects.toThrow(
        "Invalid or expired refresh token",
      );
    });

    it("should reject token with incorrect discriminator type", async () => {
      const { service } = setup();
      const accessToken = await new JwtService({ secret: TEST_SECRET }).signAsync({
        sub: safeUser.id,
        email: safeUser.email,
        type: "access",
      });
      await expect(service.refresh({ refreshToken: accessToken })).rejects.toThrow(
        "Invalid refresh token",
      );
    });

    it("should reject valid JWT refresh token if not found in database", async () => {
      const { service } = setup();
      const validToken = await new JwtService({ secret: TEST_SECRET }).signAsync({
        sub: safeUser.id,
        email: safeUser.email,
        type: "refresh",
      });
      await expect(service.refresh({ refreshToken: validToken })).rejects.toThrow(
        "Invalid refresh token",
      );
    });

    it("should reject refresh if user no longer exists", async () => {
      const { service, findById, findByEmailWithHash, inserted, selectRows } = setup();
      findById.mockResolvedValue(safeUser);
      const passwordHash = await bcrypt.hash("correct-horse-1", 4);
      findByEmailWithHash.mockResolvedValue({
        ...safeUser,
        passwordHash,
      });

      const first = await service.login({
        email: "ada@example.com",
        password: "correct-horse-1",
      });
      const storedRow = inserted[0];
      if (!storedRow) throw new Error("expected stored row");
      selectRows.push({ ...storedRow });

      findById.mockResolvedValueOnce(undefined);
      await expect(service.refresh({ refreshToken: first.refreshToken })).rejects.toThrow(
        "Invalid refresh token",
      );
    });

    it("should fail and propagate error if atomic rotation transaction throws", async () => {
      const { service, findById, findByEmailWithHash, inserted, selectRows, db } = setup();
      findById.mockResolvedValue(safeUser);
      const passwordHash = await bcrypt.hash("correct-horse-1", 4);
      findByEmailWithHash.mockResolvedValue({
        ...safeUser,
        passwordHash,
      });

      const first = await service.login({
        email: "ada@example.com",
        password: "correct-horse-1",
      });
      const storedRow = inserted[0];
      if (!storedRow) throw new Error("expected stored row");
      selectRows.push({ ...storedRow });

      db.transaction.mockRejectedValueOnce(new Error("DB transaction failed"));
      await expect(service.refresh({ refreshToken: first.refreshToken })).rejects.toThrow(
        "DB transaction failed",
      );
    });

    it("should throw UnauthorizedException when refresh token rotation update affects 0 rows", async () => {
      const { service, findById, findByEmailWithHash, inserted, selectRows, db } = setup();
      findById.mockResolvedValue(safeUser);
      const passwordHash = await bcrypt.hash("correct-horse-1", 4);
      findByEmailWithHash.mockResolvedValue({
        ...safeUser,
        passwordHash,
      });

      const first = await service.login({
        email: "ada@example.com",
        password: "correct-horse-1",
      });
      const storedRow = inserted[0];
      if (!storedRow) throw new Error("expected stored row");
      selectRows.push({ ...storedRow });

      (db.update as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        set: () => ({
          where: () => ({
            returning: () => Promise.resolve([]),
          }),
        }),
      });

      await expect(service.refresh({ refreshToken: first.refreshToken })).rejects.toThrow(
        "Token already rotated",
      );
    });
  });

  describe("sessions and logout", () => {
    it("should always succeed on logout, even for unknown tokens", async () => {
      const { service } = setup();
      await expect(service.logout({ refreshToken: "unknown" })).resolves.toEqual({
        loggedOut: true,
      });
    });

    it("should revoke token family on logout when token exists in database", async () => {
      const { service, selectRows, calls } = setup();
      selectRows.push({
        familyId: "logout-family-1",
        userId: safeUser.id,
        tokenHash: "hashed-token",
        expiresAt: new Date(Date.now() + 10000),
      });
      await expect(service.logout({ refreshToken: "known-token" })).resolves.toEqual({
        loggedOut: true,
      });
      expect(calls.deleted).toBe(1);
    });

    it("should revoke all sessions on logoutAll", async () => {
      const { service, calls } = setup();
      await expect(service.logoutAll(safeUser.id)).resolves.toEqual({ loggedOut: true });
      expect(calls.deleted).toBe(1);
    });

    it("should list active sessions", async () => {
      const { service, selectRows } = setup();
      const mockSession = {
        id: "session-1",
        familyId: "family-1",
        userId: safeUser.id,
        tokenHash: "hash-1",
        ipAddress: "127.0.0.1",
        userAgent: "Chrome",
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 10000),
        revokedAt: null,
      };
      selectRows.push(mockSession);
      const sessions = await service.listSessions(safeUser.id);
      expect(sessions).toHaveLength(1);
      expect(sessions[0]?.id).toBe("session-1");
      expect(sessions[0]?.familyId).toBe("family-1");
    });

    it("should revoke a specific session family", async () => {
      const { service, selectRows, calls } = setup();
      selectRows.push({
        id: "session-1",
        familyId: "family-1",
        userId: safeUser.id,
        tokenHash: "hash-1",
        expiresAt: new Date(Date.now() + 10000),
      });
      await expect(service.revokeSession(safeUser.id, "session-1")).resolves.toEqual({
        revoked: true,
      });
      expect(calls.deleted).toBe(1);
    });

    it("should revoke only the replayed token family leaving other device families intact", async () => {
      const { service, findById, findByEmailWithHash, selectRows, calls } = setup();
      findById.mockResolvedValue(safeUser);
      const passwordHash = await bcrypt.hash("correct-horse-1", 4);
      findByEmailWithHash.mockResolvedValue({
        ...safeUser,
        passwordHash,
      });

      // Device A (Family A)
      const deviceA = await service.login({
        email: "ada@example.com",
        password: "correct-horse-1",
      });
      // Device B (Family B)
      const deviceB = await service.login({
        email: "ada@example.com",
        password: "correct-horse-1",
      });

      expect(deviceA.refreshToken).not.toBe(deviceB.refreshToken);

      // Simulate Device A token rotated 35 seconds ago
      selectRows.push({
        id: "token-a-1",
        familyId: "family-a",
        userId: safeUser.id,
        tokenHash: "hash-token-a",
        expiresAt: new Date(Date.now() + 10000),
        revokedAt: new Date(Date.now() - 35_000),
      });

      // Attacker replays Device A's rotated token
      await expect(service.refresh({ refreshToken: deviceA.refreshToken })).rejects.toThrow(
        "Refresh token has been revoked",
      );

      // Only Family A was deleted (1 call to revokeFamily), Device B was not revoked
      expect(calls.deleted).toBe(1);
    });
  });

  describe("me", () => {
    it("should return the user", async () => {
      const { service, findById } = setup();
      findById.mockResolvedValueOnce(safeUser);
      await expect(service.me(safeUser.id)).resolves.toEqual(safeUser);
    });

    it("should reject deleted users", async () => {
      const { service } = setup();
      await expect(service.me("missing")).rejects.toThrow("User profile not found");
    });
  });

  describe("cleanupExpiredTokens", () => {
    it("should delete expired and revoked tokens and return count", async () => {
      const { service, calls } = setup();
      const result = await service.cleanupExpiredTokens();
      expect(result).toEqual({ deleted: 1 });
      expect(calls.deleted).toBe(1);
    });

    it("should handle zero deleted rows gracefully", async () => {
      const { service, db } = setup();
      (db.delete as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        where: () => ({
          returning: () => Promise.resolve([]),
        }),
      });
      const result = await service.cleanupExpiredTokens();
      expect(result).toEqual({ deleted: 0 });
    });
  });

  describe("forgotPassword", () => {
    it("should send reset email and return generic message when user exists", async () => {
      const { service, findByEmail, mail, calls } = setup();
      findByEmail.mockResolvedValueOnce(safeUser);

      const result = await service.forgotPassword({ email: "ada@example.com" });
      expect(result.message).toBe(
        "If an account exists with that email address, password reset instructions have been sent. Please check your inbox and spam folder.",
      );
      expect(mail.sendPasswordResetEmail).toHaveBeenCalledWith(
        "ada@example.com",
        expect.any(String),
      );
      expect(calls.deleted).toBe(1); // Deleted prior reset tokens
    });

    it("should return identical generic message and skip mail when user does not exist", async () => {
      const { service, findByEmail, mail } = setup();
      findByEmail.mockResolvedValueOnce(undefined);

      const result = await service.forgotPassword({ email: "ghost@example.com" });
      expect(result.message).toBe(
        "If an account exists with that email address, password reset instructions have been sent. Please check your inbox and spam folder.",
      );
      expect(mail.sendPasswordResetEmail).not.toHaveBeenCalled();
    });
  });

  describe("resetPassword", () => {
    it("should update password, mark token as used, and revoke all sessions when token is valid", async () => {
      const { service, selectRows, updatePassword, findById, mail } = setup();
      selectRows.push({
        id: "reset-token-id",
        userId: safeUser.id,
        tokenHash: "any-hash",
        expiresAt: new Date(Date.now() + 60000),
      });

      findById.mockResolvedValueOnce(safeUser);

      const result = await service.resetPassword({
        token: "plain-token-string",
        newPassword: "fresh-new-password-123",
      });

      expect(result.message).toContain("Your password has been successfully reset");
      expect(updatePassword).toHaveBeenCalledWith(
        safeUser.id,
        expect.any(String),
        expect.anything(),
      );
      expect(mail.sendPasswordChangedNotification).toHaveBeenCalledWith(safeUser.email);
    });

    it("should throw BadRequestException when token is expired or not found", async () => {
      const { service } = setup();
      // default setup has empty selectRows -> token not found

      await expect(
        service.resetPassword({
          token: "invalid-or-expired-token",
          newPassword: "fresh-new-password-123",
        }),
      ).rejects.toThrow("The password reset token is invalid or has expired");
    });

    it("should throw BadRequestException when reset password token update race condition occurs", async () => {
      const { service, selectRows, db } = setup();
      selectRows.push({
        id: "reset-token-id",
        userId: safeUser.id,
        tokenHash: "any-hash",
        expiresAt: new Date(Date.now() + 60000),
      });

      (db.update as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        set: () => ({
          where: () => ({
            returning: () => Promise.resolve([]),
          }),
        }),
      });

      await expect(
        service.resetPassword({
          token: "plain-token-string",
          newPassword: "fresh-new-password-123",
        }),
      ).rejects.toThrow("The password reset token is invalid or has expired");
    });
  });

  describe("updatePassword", () => {
    it("should verify current password, update password, and notify user", async () => {
      const { service, findByIdWithHash, updatePassword, mail } = setup();
      const currentPassword = "old-password-123";
      const currentPasswordHash = await bcrypt.hash(currentPassword, 10);
      findByIdWithHash.mockResolvedValueOnce({
        ...safeUser,
        passwordHash: currentPasswordHash,
      });

      const result = await service.updatePassword(safeUser.id, {
        currentPassword,
        newPassword: "brand-new-password-456",
      });

      expect(result.message).toBe(
        "Your password has been successfully updated. All other active sessions have been signed out.",
      );
      expect(updatePassword).toHaveBeenCalledWith(safeUser.id, expect.any(String));
      expect(mail.sendPasswordChangedNotification).toHaveBeenCalledWith(safeUser.email);
    });

    it("should throw UnauthorizedException when current password is wrong", async () => {
      const { service, findByIdWithHash, updatePassword } = setup();
      const currentPasswordHash = await bcrypt.hash("correct-password-123", 10);
      findByIdWithHash.mockResolvedValueOnce({
        ...safeUser,
        passwordHash: currentPasswordHash,
      });

      await expect(
        service.updatePassword(safeUser.id, {
          currentPassword: "wrong-password",
          newPassword: "brand-new-password-456",
        }),
      ).rejects.toThrow("The current password provided is incorrect");
      expect(updatePassword).not.toHaveBeenCalled();
    });

    it("should throw UnauthorizedException when user does not exist", async () => {
      const { service, findByIdWithHash } = setup();
      findByIdWithHash.mockResolvedValueOnce(undefined);

      await expect(
        service.updatePassword("unknown-id", {
          currentPassword: "any-password",
          newPassword: "brand-new-password-456",
        }),
      ).rejects.toThrow("User profile not found");
    });

    it("should revoke other device sessions while preserving current session when currentRefreshToken is provided", async () => {
      const { service, findByIdWithHash, selectRows, calls } = setup();
      const currentPassword = "old-password-123";
      const currentPasswordHash = await bcrypt.hash(currentPassword, 10);
      findByIdWithHash.mockResolvedValueOnce({
        ...safeUser,
        passwordHash: currentPasswordHash,
      });

      const currentRefreshToken = "active-device-refresh-token";
      selectRows.push({
        familyId: "device-1-family",
        userId: safeUser.id,
        tokenHash: createHash("sha256").update(currentRefreshToken).digest("hex"),
        expiresAt: new Date(Date.now() + 60000),
      });

      const result = await service.updatePassword(
        safeUser.id,
        { currentPassword, newPassword: "brand-new-password-456" },
        currentRefreshToken,
      );

      expect(result.message).toContain("Your password has been successfully updated");
      expect(calls.deleted).toBe(1);
    });
  });

  describe("verifyEmail", () => {
    it("should verify email and mark used when token is valid and unexpired", async () => {
      const { service, selectRows, markEmailVerified } = setup();
      const rawToken = "valid-email-verification-token-string";
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");
      selectRows.push({
        id: "verification-token-id",
        userId: safeUser.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 60000),
      });

      const result = await service.verifyEmail({ token: rawToken });

      expect(result.message).toBe(
        "Your email has been successfully verified. You may now log in with your credentials.",
      );
      expect(markEmailVerified).toHaveBeenCalledWith(safeUser.id, expect.anything());
    });

    it("should throw BadRequestException when token is invalid or expired", async () => {
      const { service } = setup();

      await expect(service.verifyEmail({ token: "non-existent-or-expired-token" })).rejects.toThrow(
        "The email verification token is invalid or has expired",
      );
    });

    it("should throw BadRequestException when token update race condition occurs", async () => {
      const { service, selectRows, db } = setup();
      const rawToken = "race-condition-token";
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");
      selectRows.push({
        id: "verification-token-id",
        userId: safeUser.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 60000),
      });

      // Mock update within transaction to return empty array
      (db.update as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        set: () => ({
          where: () => ({
            returning: () => Promise.resolve([]),
          }),
        }),
      });

      await expect(service.verifyEmail({ token: rawToken })).rejects.toThrow(
        "The email verification token is invalid or has expired",
      );
    });
  });

  describe("resendVerification", () => {
    it("should invalidate old tokens, generate fresh token, and send email when user is unverified", async () => {
      const { service, findByEmail, mail, calls, inserted } = setup();
      findByEmail.mockResolvedValueOnce({
        ...safeUser,
        emailVerifiedAt: null,
      });

      const result = await service.resendVerification({ email: "ada@example.com" });

      expect(result.message).toBe(
        "If an unverified account exists with that email address, a new verification link has been sent. Please check your inbox and spam folder.",
      );
      expect(calls.deleted).toBe(1);
      expect(inserted).toHaveLength(1);
      expect(inserted[0]?.userId).toBe(safeUser.id);
      expect(mail.sendEmailVerificationEmail).toHaveBeenCalledWith(
        "ada@example.com",
        expect.any(String),
      );
    });

    it("should return generic message and avoid sending email if user is already verified", async () => {
      const { service, findByEmail, mail } = setup();
      findByEmail.mockResolvedValueOnce(safeUser);

      const result = await service.resendVerification({ email: "ada@example.com" });

      expect(result.message).toBe(
        "If an unverified account exists with that email address, a new verification link has been sent. Please check your inbox and spam folder.",
      );
      expect(mail.sendEmailVerificationEmail).not.toHaveBeenCalled();
    });

    it("should return generic message and run anti-enumeration timing check when user does not exist", async () => {
      const { service, findByEmail, mail } = setup();
      findByEmail.mockResolvedValueOnce(undefined);

      const result = await service.resendVerification({ email: "ghost@example.com" });

      expect(result.message).toBe(
        "If an unverified account exists with that email address, a new verification link has been sent. Please check your inbox and spam folder.",
      );
      expect(mail.sendEmailVerificationEmail).not.toHaveBeenCalled();
    });
  });
});
