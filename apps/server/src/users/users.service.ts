import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Db } from "@repo/database/client";
import { DB } from "@repo/database/client";
import type { NewUser, User } from "@repo/database/schema";
import { organizationMembers, organizations, users } from "@repo/database/schema";
import type { SafeUser } from "@repo/validation/auth";
import { and, eq, inArray, ne } from "drizzle-orm";

import { isUniqueViolation } from "../common/utils/shared.util.js";

// Columns safe to return outward. passwordHash must never leave this
// service — every outward query selects through this projection, so no
// query can accidentally leak it via select *.
const safeUserColumns = {
  id: users.id,
  email: users.email,
  name: users.name,
  locale: users.locale,
  timezone: users.timezone,
  countryCode: users.countryCode,
  avatarUrl: users.avatarUrl,
  emailVerifiedAt: users.emailVerifiedAt,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
};

export type { SafeUser };

// Single rule for "sole owner": orgs owned by the user with no other owner.
// Shared by delete() (atomic, inside a transaction) and
// findSoleOwnedOrganizationNames() (friendly message for the controller),
// so the two can never disagree on what counts.
function soleOwnedWithoutCoOwner<T extends { id: string }>(
  owned: readonly T[],
  otherOwners: readonly { organizationId: string }[],
): T[] {
  const withCoOwner = new Set(otherOwners.map((o) => o.organizationId));
  return owned.filter((r) => !withCoOwner.has(r.id));
}

@Injectable()
export class UsersService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async findByEmail(email: string): Promise<SafeUser | undefined> {
    const [row] = await this.db.select(safeUserColumns).from(users).where(eq(users.email, email));
    return row;
  }

  async findById(id: string): Promise<SafeUser | undefined> {
    const [row] = await this.db.select(safeUserColumns).from(users).where(eq(users.id, id));
    return row;
  }

  // Auth-internal only: login must verify the hash, so this returns the
  // full row including passwordHash. Never expose its result outward.
  async findByEmailWithHash(email: string): Promise<User | undefined> {
    const [row] = await this.db.select().from(users).where(eq(users.email, email));
    return row;
  }

  // Auth-internal only: authenticated password operations verify the hash
  // for the current bearer user.
  async findByIdWithHash(id: string): Promise<User | undefined> {
    const [row] = await this.db.select().from(users).where(eq(users.id, id));
    return row;
  }

  async updatePassword(
    id: string,
    passwordHash: string,
    executor: Pick<Db, "update"> = this.db,
  ): Promise<void> {
    await executor
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, id));
  }

  async markEmailVerified(id: string, executor: Pick<Db, "update"> = this.db): Promise<void> {
    await executor
      .update(users)
      .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, id));
  }

  async updateProfile(
    id: string,
    input: Partial<Pick<NewUser, "name" | "locale" | "timezone" | "countryCode" | "avatarUrl">>,
    executor: Pick<Db, "update"> = this.db,
  ): Promise<SafeUser> {
    const [row] = await executor
      .update(users)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning(safeUserColumns);
    if (!row) {
      throw new NotFoundException("User profile not found");
    }
    return row;
  }

  async delete(id: string): Promise<void> {
    // Atomic sole-owner guard: the controller checks first for a friendly
    // message with org names, but the check-then-delete race is closed here
    // inside the same transaction (concurrent ownership transfer cannot
    // slip between check and delete).
    await this.db.transaction(async (tx) => {
      const owned = await tx
        .select({ id: organizations.id })
        .from(organizationMembers)
        .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
        .where(and(eq(organizationMembers.userId, id), eq(organizationMembers.role, "owner")))
        .for("update");

      if (owned.length > 0) {
        const orgIds = owned.map((r) => r.id);
        const otherOwners = await tx
          .select({ organizationId: organizationMembers.organizationId })
          .from(organizationMembers)
          .where(
            and(
              inArray(organizationMembers.organizationId, orgIds),
              eq(organizationMembers.role, "owner"),
              ne(organizationMembers.userId, id),
            ),
          )
          .for("update");

        const soleOwned = soleOwnedWithoutCoOwner(owned, otherOwners);
        if (soleOwned.length > 0) {
          throw new BadRequestException(
            "Cannot delete account while you are the sole owner of an organization. Please transfer ownership or delete the organization first.",
          );
        }
      }

      await tx.delete(users).where(eq(users.id, id));
    });
  }

  async findSoleOwnedOrganizationNames(userId: string): Promise<string[]> {
    const rows = await this.db
      .select({
        id: organizations.id,
        name: organizations.name,
      })
      .from(organizationMembers)
      .innerJoin(organizations, eq(organizations.id, organizationMembers.organizationId))
      .where(and(eq(organizationMembers.userId, userId), eq(organizationMembers.role, "owner")));

    if (rows.length === 0) {
      return [];
    }

    const orgIds = rows.map((r) => r.id);
    const otherOwners = await this.db
      .select({ organizationId: organizationMembers.organizationId })
      .from(organizationMembers)
      .where(
        and(
          inArray(organizationMembers.organizationId, orgIds),
          eq(organizationMembers.role, "owner"),
          ne(organizationMembers.userId, userId),
        ),
      );

    return soleOwnedWithoutCoOwner(rows, otherOwners).map((r) => r.name);
  }

  // No existence pre-check here: the unique constraint is the source of
  // truth, which also closes the check-then-insert race. Both paths
  // report the same ConflictException (no oracle either way).
  async create(input: NewUser, executor: Pick<Db, "insert"> = this.db): Promise<SafeUser> {
    try {
      const [row] = await executor.insert(users).values(input).returning(safeUserColumns);
      if (!row) throw new Error("Failed to create user record");
      return row;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException("An account with this email address already exists");
      }
      throw error;
    }
  }
}
