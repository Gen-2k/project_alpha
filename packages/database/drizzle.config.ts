import { resolve } from "node:path";

import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

// Reads DATABASE_URL from:
// 1. Process environment (CI/CD, Docker)
// 2. Local packages/database/.env (if explicitly created)
// 3. Fallback to apps/server/.env (single source of truth for local dev)
dotenv.config();
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: resolve(process.cwd(), "../../apps/server/.env") });
}
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  verbose: true,
  strict: true,
});
