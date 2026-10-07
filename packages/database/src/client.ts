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

const dbClients = new WeakMap<Db, ReturnType<typeof postgres>>();

export function createDb(url: string): Db {
  const client = postgres(url, { max: 10 });
  const db = drizzle(client, { schema });
  dbClients.set(db, client);
  return db;
}

// Graceful shutdown: DatabaseModule calls this on destroy so SIGTERM/HMR
// can drain PG instead of leaking connections. Unknown (e.g. stubbed test)
// dbs resolve silently.
export async function closeDb(db: Db): Promise<void> {
  const client = dbClients.get(db);
  if (client) {
    // postgres-js `end` timeout is in seconds: wait up to 5s for drain.
    await client.end({ timeout: 5 });
  }
}
