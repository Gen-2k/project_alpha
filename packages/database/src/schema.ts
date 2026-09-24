import { uuidv7 } from "@repo/database/uuid";
import { pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

// Users of the platform. Passwords are NEVER stored here — only bcrypt
// hashes (see apps/server AuthService). Reads going outward must use
// explicit column lists (safeUserColumns in UsersService), never select *.
export const users = pgTable("users", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// One row per issued refresh token, storing only its SHA-256 hash (bcrypt
// is salted, so it can't be looked up — and lookup is the whole point).
// Rotation deletes the old row on every refresh; logout deletes on demand;
// reuse of a rotated token revokes all of the user's rows (theft response).
export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  userAgent: text("user_agent"),
  ipAddress: varchar("ip_address", { length: 45 }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type NewRefreshToken = typeof refreshTokens.$inferInsert;

export { getUuidv7Timestamp, uuidv7 } from "@repo/database/uuid";
