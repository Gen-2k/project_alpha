import type { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import bcrypt from "bcryptjs";
import { describe, expect, it, vi } from "vitest";

import type { UsersService } from "../../users/users.service.js";
import { AuthService } from "../auth.service.js";

const TEST_SECRET = "test-secret-that-is-long-enough-for-hs256!!";

const safeUser = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "ada@example.com",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

interface StoredRefreshRow {
  id?: string;
  userId: string;
  tokenHash: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  expiresAt: Date;
  createdAt?: Date;
  revokedAt?: Date | null;
}

// Real JwtService (standalone test secret) + real bcrypt hashing; only the
// persistence layer is faked, as an in-memory refresh-token store plus
// configurable user stubs. Crypto paths always run for real.
function setup() {
  const inserted: StoredRefreshRow[] = [];
  const selectRows: StoredRefreshRow[] = [];
  const calls = { deleted: 0, updated: 0 };

  const db = {
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
          return Promise.resolve([]);
        },
      }),
    })),
    delete: vi.fn(() => ({
      where: () => {
        calls.deleted += 1;
        return Promise.resolve([]);
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
  // Like a real DB `returning(safeColumns)` clause: echoes back only the
  // safe fields, never what was handed in (in particular, no passwordHash).
  const create = vi.fn((input: { email: string; passwordHash: string }): Promise<typeof safeUser> =>
    Promise.resolve({ ...safeUser, email: input.email }),
  );
  const users = { findByEmail, findByEmailWithHash, findById, create } as unknown as UsersService;

  const config = {
    getOrThrow: (key: string): string => {
      if (key === "JWT_ACCESS_EXPIRES_IN") return "15m";
      if (key === "JWT_REFRESH_EXPIRES_IN") return "7d";
      throw new Error(`unexpected config key ${key}`);
    },
  } as unknown as ConfigService;

  const service = new AuthService(
    users,
    new JwtService({ secret: TEST_SECRET }),
    config,
    db as never,
  );

  return {
    service,
    findByEmail,
    findByEmailWithHash,
    findById,
    create,
    db,
    inserted,
    selectRows,
    calls,
  };
}

describe("AuthService", () => {
  describe("register", () => {
    it("should hash the password and issue tokens with metadata", async () => {
      const { service, create, inserted } = setup();
      const result = await service.register(
        { email: "ada@example.com", password: "correct-horse-1" },
        { ipAddress: "127.0.0.1", userAgent: "test-agent" },
      );

      expect(create).toHaveBeenCalledOnce();
      const createdWith = create.mock.calls[0]?.[0];
      expect(createdWith?.email).toBe("ada@example.com");
      expect(createdWith?.passwordHash).not.toBe("correct-horse-1");
      expect(await bcrypt.compare("correct-horse-1", createdWith?.passwordHash ?? "")).toBe(true);
      expect(result.user).toEqual(safeUser);
      expect("passwordHash" in result.user).toBe(false);
      expect(typeof result.accessToken).toBe("string");
      expect(typeof result.refreshToken).toBe("string");
      expect(inserted[0]?.ipAddress).toBe("127.0.0.1");
      expect(inserted[0]?.userAgent).toBe("test-agent");
    });

    it("should reject duplicate emails", async () => {
      const { service, findByEmail } = setup();
      findByEmail.mockResolvedValueOnce(safeUser);
      await expect(
        service.register({ email: "ada@example.com", password: "correct-horse-1" }),
      ).rejects.toThrow("Email already registered");
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

    it("should fail identically for unknown email and wrong password", async () => {
      const unknown = setup();
      await expect(
        unknown.service.login({ email: "nobody@example.com", password: "whatever-123" }),
      ).rejects.toThrow("Invalid credentials");

      const { service: wrongService, findByEmailWithHash: findHash } = setup();
      const passwordHash = await bcrypt.hash("correct-horse-1", 4);
      findHash.mockResolvedValueOnce({
        ...safeUser,
        passwordHash,
      });
      await expect(
        wrongService.login({ email: "ada@example.com", password: "wrong-password-1" }),
      ).rejects.toThrow("Invalid credentials");
    });
  });

  describe("refresh", () => {
    it("should rotate: new pair issued and old token marked rotated", async () => {
      const { service, findById, inserted, selectRows, calls } = setup();
      findById.mockResolvedValue(safeUser);

      const first = await service.register({
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

      // Immediate double-submit within grace window rejects without revoking all sessions
      await expect(service.refresh({ refreshToken: first.refreshToken })).rejects.toThrow(
        "Token already rotated",
      );
      expect(calls.deleted).toBe(0); // RevokeAll was NOT triggered!
    });

    it("should revoke all sessions if rotated token is replayed after grace period", async () => {
      const { service, findById, inserted, selectRows, calls } = setup();
      findById.mockResolvedValue(safeUser);

      const first = await service.register({
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
        "Invalid refresh token",
      );
      expect(calls.deleted).toBeGreaterThan(0); // Theft detected, revokeAll was triggered!
    });

    it("should reject expired stored rows", async () => {
      const { service, findById, selectRows, calls } = setup();
      findById.mockResolvedValue(safeUser);
      const first = await service.register({
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
      const { service, findById, inserted, selectRows } = setup();
      findById.mockResolvedValue(safeUser);
      const first = await service.register({
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
  });

  describe("sessions and logout", () => {
    it("should always succeed on logout, even for unknown tokens", async () => {
      const { service } = setup();
      await expect(service.logout({ refreshToken: "unknown" })).resolves.toEqual({
        loggedOut: true,
      });
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
    });

    it("should revoke a specific session", async () => {
      const { service, calls } = setup();
      await expect(service.revokeSession(safeUser.id, "session-1")).resolves.toEqual({
        revoked: true,
      });
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
      await expect(service.me("missing")).rejects.toThrow("Invalid credentials");
    });
  });
});
