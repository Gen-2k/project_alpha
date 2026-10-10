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
      // Verified 2026-10-10: 100/100/94.8/100. Branches stay at 90 because
      // decorator metadata, live-DNS and runtime-impossible fallbacks cannot
      // be meaningfully covered; everything else must not regress.
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 90,
        statements: 100,
      },
    },
  },
});
