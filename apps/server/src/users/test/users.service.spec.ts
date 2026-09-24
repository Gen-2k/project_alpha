import type { Db } from "@repo/database/client";
import { describe, expect, it } from "vitest";

import { UsersService } from "../users.service.js";

const safeRow = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "ada@example.com",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

// Minimal drizzle-chain stub: select/from/where and insert/values/returning
// resolve to canned rows. Keeps unit tests fast and hermetic; the real
// queries against Postgres are proven by live boot, not mocks.
function fakeDb(options?: {
  selectRows?: unknown[];
  insertRows?: unknown[];
  insertError?: Error;
}): Db {
  const selectRows = options?.selectRows ?? [safeRow];
  return {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(selectRows),
      }),
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
  } as unknown as Db;
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
      ).rejects.toThrow("User insert returned no row");
    });

    it("should map duplicate emails to ConflictException", async () => {
      // A real Error carrying Postgres's unique-violation code, exactly
      // what the driver throws on a duplicate (plain objects would trip
      // prefer-promise-reject-errors, and rightly so).
      const uniqueViolation = Object.assign(new Error("duplicate key"), { code: "23505" });
      const service = new UsersService(fakeDb({ insertError: uniqueViolation }));
      await expect(
        service.create({ email: "ada@example.com", passwordHash: "hashed" }),
      ).rejects.toThrow("Email already registered");
    });

    it("should rethrow non-unique errors untouched", async () => {
      const service = new UsersService(fakeDb({ insertError: new Error("db down") }));
      await expect(
        service.create({ email: "ada@example.com", passwordHash: "hashed" }),
      ).rejects.toThrow("db down");
    });
  });
});
