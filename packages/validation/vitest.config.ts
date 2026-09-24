import { defineConfig } from "vitest/config";

// Unit tests for schemas: *.test.ts next to sources. Explicit imports
// (repo convention — no vitest globals), Node environment.
export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    root: "./",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
