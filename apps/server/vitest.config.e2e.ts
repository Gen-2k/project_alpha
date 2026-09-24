import { defineConfig } from "vitest/config";

// End-to-end tests boot the full Nest application and hit it over HTTP
// via Supertest. Separate config so `test` stays fast (unit only).
export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    root: "./",
    include: ["test/**/*.e2e-spec.ts"],
  },
});
