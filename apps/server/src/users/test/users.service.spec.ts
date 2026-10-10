import type { Db } from "@repo/database/client";
import { describe, expect, it } from "vitest";

import { UsersService } from "../users.service.js";

const safeRow = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "ada@example.com",
  name: "Ada Lovelace",
  locale: "en-US",
  timezone: "UTC",
  countryCode: "US",
  avatarUrl: null,
  emailVerifiedAt: new Date("2026-01-01T00:00:00.000Z"),
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

// Minimal drizzle-chain stub: select/from/where and insert/values/returning
// resolve to canned rows. Keeps unit tests fast and hermetic; the real
// queries against Postgres are proven by live boot, not mocks.
function fakeDb(options?: {
  selectRows?: unknown[];
  selectQueue?: unknown[][];
  insertRows?: unknown[];
  insertError?: Error;
  updateRows?: unknown[];
  updateSpy?: () => void;
  deleteSpy?: () => void;
}): Db {
  const selectQueue = options?.selectQueue ? [...options.selectQueue] : undefined;
  const nextSelectRows = () => {
    if (selectQueue && selectQueue.length > 0) {
      return selectQueue.shift() ?? [];
    }
    return options?.selectRows ?? [safeRow];
  };

  const db = {
    transaction: (cb: (tx: unknown) => Promise<unknown>) => cb(db),
    select: () => ({
      from: () => {
        const rows = nextSelectRows();
        const whereResult = Object.assign(Promise.resolve(rows), {
          for: () => Promise.resolve(rows),
        });
        return {
          where: () => whereResult,
          innerJoin: () => ({
            where: () => whereResult,
          }),
        };
      },
    }),
    insert: () => ({
      values: () => ({
        returning: () => {
          if (options?.insertError !== undefined) {
            return Promise.reject(options.insertError);
          }
          return Promise.resolve(options?.insertRows ?? [safeRow]);
        },
      }),
    }),
    update: () => ({
      set: () => ({
        where: () => {
          options?.updateSpy?.();
          const returningPromise = Promise.resolve(options?.updateRows ?? [safeRow]);
          return Object.assign(returningPromise, {
            returning: () => returningPromise,
          });
        },
      }),
    }),
    delete: () => ({
      where: () => {
        options?.deleteSpy?.();
        return Promise.resolve();
      },
    }),
  };
  return db as unknown as Db;
}

describe("UsersService", () => {
  describe("findByEmail", () => {
    it("should return the safe user", async () => {
      const user = await new UsersService(fakeDb()).findByEmail("ada@example.com");
      expect(user).toMatchObject({ id: safeRow.id, email: safeRow.email });
    });

    it("should return undefined for unknown emails", async () => {
      const user = await new UsersService(fakeDb({ selectRows: [] })).findByEmail("no@one.com");
      expect(user).toBeUndefined();
    });
  });

  describe("findById", () => {
    it("should return the user by id", async () => {
      const user = await new UsersService(fakeDb()).findById(safeRow.id);
      expect(user).toMatchObject({ id: safeRow.id, email: safeRow.email });
    });

    it("should return undefined for unknown id", async () => {
      const user = await new UsersService(fakeDb({ selectRows: [] })).findById("unknown-id");
      expect(user).toBeUndefined();
    });
  });

  describe("findByEmailWithHash", () => {
    it("should return full user row including passwordHash", async () => {
      const fullRow = { ...safeRow, passwordHash: "hashed-pw" };
      const user = await new UsersService(fakeDb({ selectRows: [fullRow] })).findByEmailWithHash(
        "ada@example.com",
      );
      expect(user).toEqual(fullRow);
    });

    it("should return undefined for unknown email", async () => {
      const user = await new UsersService(fakeDb({ selectRows: [] })).findByEmailWithHash(
        "no@one.com",
      );
      expect(user).toBeUndefined();
    });
  });

  describe("findByIdWithHash", () => {
    it("should return full user row including passwordHash by id", async () => {
      const fullRow = { ...safeRow, passwordHash: "hashed-pw" };
      const user = await new UsersService(fakeDb({ selectRows: [fullRow] })).findByIdWithHash(
        safeRow.id,
      );
      expect(user).toEqual(fullRow);
    });

    it("should return undefined for unknown id", async () => {
      const user = await new UsersService(fakeDb({ selectRows: [] })).findByIdWithHash(
        "unknown-id",
      );
      expect(user).toBeUndefined();
    });
  });

  describe("updatePassword", () => {
    it("should execute update with new passwordHash", async () => {
      let updated = false;
      const service = new UsersService(fakeDb({ updateSpy: () => (updated = true) }));
      await service.updatePassword(safeRow.id, "new-hash");
      expect(updated).toBe(true);
    });
  });

  describe("markEmailVerified", () => {
    it("should execute update with emailVerifiedAt", async () => {
      let updated = false;
      const service = new UsersService(fakeDb({ updateSpy: () => (updated = true) }));
      await service.markEmailVerified(safeRow.id);
      expect(updated).toBe(true);
    });
  });

  describe("delete", () => {
    it("should execute delete for user id", async () => {
      let deleted = false;
      const service = new UsersService(
        fakeDb({ selectRows: [], deleteSpy: () => (deleted = true) }),
      );
      await service.delete(safeRow.id);
      expect(deleted).toBe(true);
    });

    it("should refuse delete while sole owner inside the transaction", async () => {
      const owned = [{ id: "11111111-1111-4111-8111-111111111111" }];
      const service = new UsersService(fakeDb({ selectQueue: [owned, []] }));
      await expect(service.delete(safeRow.id)).rejects.toThrow("sole owner of an organization");
    });

    it("should proceed with delete when a co-owner exists", async () => {
      let deleted = false;
      const owned = [{ id: "11111111-1111-4111-8111-111111111111" }];
      const coOwners = [{ organizationId: "11111111-1111-4111-8111-111111111111" }];
      const service = new UsersService(
        fakeDb({ selectQueue: [owned, coOwners], deleteSpy: () => (deleted = true) }),
      );
      await service.delete(safeRow.id);
      expect(deleted).toBe(true);
    });
  });

  describe("create", () => {
    it("should create without ever exposing passwordHash", async () => {
      const created = await new UsersService(fakeDb()).create({
        email: "ada@example.com",
        passwordHash: "hashed",
      });
      expect(created).toEqual(safeRow);
      expect("passwordHash" in created).toBe(false);
    });

    it("should throw if insert returns no row", async () => {
      const service = new UsersService(fakeDb({ insertRows: [] }));
      await expect(
        service.create({ email: "ada@example.com", passwordHash: "hashed" }),
      ).rejects.toThrow("Failed to create user record");
    });

    it("should map duplicate emails to ConflictException", async () => {
      // A real Error carrying Postgres's unique-violation code, exactly
      // what the driver throws on a duplicate (plain objects would trip
      // prefer-promise-reject-errors, and rightly so).
      const uniqueViolation = Object.assign(new Error("duplicate key"), { code: "23505" });
      const service = new UsersService(fakeDb({ insertError: uniqueViolation }));
      await expect(
        service.create({ email: "ada@example.com", passwordHash: "hashed" }),
      ).rejects.toThrow("An account with this email address already exists");
    });

    it("should rethrow non-unique errors untouched", async () => {
      const service = new UsersService(fakeDb({ insertError: new Error("db down") }));
      await expect(
        service.create({ email: "ada@example.com", passwordHash: "hashed" }),
      ).rejects.toThrow("db down");
    });

    it("should insert using custom executor when provided", async () => {
      let customCalled = false;
      const customExecutor = {
        insert: () => ({
          values: () => ({
            returning: () => {
              customCalled = true;
              return Promise.resolve([safeRow]);
            },
          }),
        }),
      } as unknown as Pick<Db, "insert">;

      const created = await new UsersService(fakeDb()).create(
        { email: "ada@example.com", passwordHash: "hashed" },
        customExecutor,
      );
      expect(created).toEqual(safeRow);
      expect(customCalled).toBe(true);
    });
  });

  describe("updateProfile", () => {
    it("should update profile preferences and return the updated safe user", async () => {
      const updatedUser = {
        ...safeRow,
        name: "Ada King",
        timezone: "Europe/London",
      };
      const service = new UsersService(fakeDb({ updateRows: [updatedUser] }));
      const result = await service.updateProfile(safeRow.id, {
        name: "Ada King",
        timezone: "Europe/London",
      });
      expect(result).toEqual(updatedUser);
    });

    it("should throw NotFoundException if user to update does not exist", async () => {
      const service = new UsersService(fakeDb({ updateRows: [] }));
      await expect(service.updateProfile("non-existent-id", { name: "Ghost" })).rejects.toThrow(
        "User profile not found",
      );
    });

    it("should use custom executor when provided", async () => {
      let customCalled = false;
      const customExecutor = {
        update: () => ({
          set: () => ({
            where: () => ({
              returning: () => {
                customCalled = true;
                return Promise.resolve([safeRow]);
              },
            }),
          }),
        }),
      } as unknown as Pick<Db, "update">;

      const service = new UsersService(fakeDb());
      await service.updateProfile(safeRow.id, { name: "Ada" }, customExecutor);
      expect(customCalled).toBe(true);
    });
  });

  describe("findSoleOwnedOrganizationNames", () => {
    it("should return empty array if user owns no organizations", async () => {
      const service = new UsersService(fakeDb({ selectRows: [] }));
      const result = await service.findSoleOwnedOrganizationNames(safeRow.id);
      expect(result).toEqual([]);
    });

    it("should return empty array if all owned organizations have other owners", async () => {
      const service = new UsersService(
        fakeDb({
          selectQueue: [[{ id: "org-1", name: "Acme Corp" }], [{ organizationId: "org-1" }]],
        }),
      );
      const result = await service.findSoleOwnedOrganizationNames(safeRow.id);
      expect(result).toEqual([]);
    });

    it("should return names of organizations where user is the only owner", async () => {
      const service = new UsersService(
        fakeDb({
          selectQueue: [
            [
              { id: "org-1", name: "Acme Corp" },
              { id: "org-2", name: "Beta Labs" },
            ],
            [{ organizationId: "org-2" }],
          ],
        }),
      );
      const result = await service.findSoleOwnedOrganizationNames(safeRow.id);
      expect(result).toEqual(["Acme Corp"]);
    });
  });
});
