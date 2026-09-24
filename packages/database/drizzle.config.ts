import "dotenv/config";

import { defineConfig } from "drizzle-kit";

// Reads DATABASE_URL from the environment (export it, or keep it in a
// gitignored .env next to this file — drizzle-kit does not load one itself).
// Workflow: `db:generate` after editing src/schema.ts (commits SQL to
// drizzle/), then `db:migrate` to apply. `db:push` skips files (dev only).
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  verbose: true,
  strict: true,
});
