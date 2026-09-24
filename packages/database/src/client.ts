// Self-import (not "./schema.js"): shared packages are consumed as SOURCE
// (Node type-strips .ts directly), so imports must resolve to files that
// really exist. "./schema.js" has no on-disk file — only schema.ts does —
// and Node, unlike Vitest/tsc, does not guess extensions. The package
// specifier always resolves via exports. Same rule for every packages/*
// file, tests included.
import * as schema from "@repo/database/schema";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// Injection token + factory. Nest provides it (see apps/server DatabaseModule);
// tests override it with a stub. The postgres-js client pools internally,
// so one instance per process is correct — never per request.
export const DB = Symbol("DB");

export type Db = PostgresJsDatabase<typeof schema>;

export function createDb(url: string): Db {
  const client = postgres(url, { max: 10 });
  return drizzle(client, { schema });
}
