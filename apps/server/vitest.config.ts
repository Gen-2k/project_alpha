import { defineConfig } from "vitest/config";

// Unit tests: colocated *.spec.ts next to sources. Explicit imports
// (repo convention — no vitest globals), Node environment.
export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    root: "./",
    include: ["src/**/*.spec.ts"],
    api: {
      port: 3100,
      host: "127.0.0.1",
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.spec.ts", "src/**/*.module.ts", "src/main.ts"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
