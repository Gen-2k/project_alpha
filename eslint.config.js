// Single ESLint flat config for the whole monorepo (ESLint 9+ has exactly
// one root config — no per-package eslint.config.js files).
// Presets live in packages/eslint-config/* and are scoped here with `files`.
// Library packages (types/utils/…) intentionally get base rules only: they
// must stay runtime-agnostic (no browser/Node globals). A package that needs
// runtime APIs adds its own override block below.
import base from "./packages/eslint-config/base.js";
import node from "./packages/eslint-config/node.js";
import react from "./packages/eslint-config/react.js";

// Add future frontend apps alongside `web` here (e.g. "apps/admin/**").
const REACT_FILES = [
  "apps/web/**/*.{ts,tsx}",
  "apps/admin/**/*.{ts,tsx}",
  "packages/ui/**/*.{ts,tsx}",
];

// Add future backend apps alongside `server` here (e.g. "apps/worker/**"),
// plus future server-only packages (e.g. "packages/database/**").
// Isomorphic packages (validation, api-client) and pure types stay on
// base rules only — see the comment at the top of this file.
const NODE_FILES = [
  "apps/server/**/*.ts",
  "apps/api/**/*.ts",
  "apps/worker/**/*.ts",
  "packages/database/**/*.ts",
];

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "**/coverage/**",
      "**/.turbo/**",
      "**/.next/**",
      "**/vite.config.*.timestamp*",
    ],
  },
  ...base,
  ...react.map((c) => ({ ...c, files: REACT_FILES })),
  ...node.map((c) => ({ ...c, files: NODE_FILES })),
  // E2E specs assert over untyped HTTP boundaries (Supertest bodies,
  // `getHttpServer()` returns `any` by Nest's own typing) — the no-unsafe-*
  // family would flag every assertion without catching real bugs.
  // Async safety (floating/misused promises) and hygiene stay fully on.
  {
    files: ["**/*.e2e-spec.ts"],
    rules: {
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
    },
  },
];
