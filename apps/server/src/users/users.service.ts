import { ConflictException, Inject, Injectable } from "@nestjs/common";
import type { Db } from "@repo/database/client";
import { DB } from "@repo/database/client";
import type { NewUser, User } from "@repo/database/schema";
import { users } from "@repo/database/schema";
import type { SafeUser } from "@repo/validation/auth";
import { eq } from "drizzle-orm";

// Columns safe to return outward. passwordHash must never leave this
// service — every outward query selects through this projection, so no
// query can accidentally leak it via select *.
const safeUserColumns = {
  id: users.id,
  email: users.email,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
};

export type { SafeUser };

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
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

  // No existence pre-check here: the unique constraint is the source of
  // truth, which also closes the check-then-insert race. Both paths
  // report the same ConflictException (no oracle either way).
  async create(input: NewUser): Promise<SafeUser> {
    try {
      const [row] = await this.db.insert(users).values(input).returning(safeUserColumns);
      if (!row) throw new Error("User insert returned no row");
      return row;
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException("Email already registered");
      throw error;
    }
  }
}
