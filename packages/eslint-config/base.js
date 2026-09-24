// @repo/eslint-config/base — shared by every TS file in the repo.
//
// Type-aware rules run via Project Service: the parser asks TypeScript for
// each file's type information using the closest tsconfig, exactly like the
// editor does. No `parserOptions.project`, no `tsconfig.eslint.json`.
// Cost: slower than syntactic linting (~2-4s startup + per-file type info),
// paid once per process — acceptable in CI and invisible locally behind
// lint-staged (staged files only) and Turbo cache.
import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import prettier from "eslint-config-prettier/flat";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import tseslint from "typescript-eslint";

export default defineConfig(
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    plugins: {
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      // `any` is a warning, not an error: it fails CI via --max-warnings 0
      // but reads as "justify or remove" rather than "never".
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-non-null-assertion": "warn",
      // Decorated empty classes are a legit framework pattern (Nest
      // `@Module()` classes carry config in the decorator, not members).
      "@typescript-eslint/no-extraneous-class": ["error", { allowWithDecorator: true }],
      // Returning void from a void-expected callback (`onClick={() => set(x)}`,
      // `.then(() => log())`) is idiomatic and type-safe by design — flagging
      // it is pure friction, so this stylistic rule stays off.
      "@typescript-eslint/no-confusing-void-expression": "off",
      // style-only import ordering (tsc + bundlers don't care).
      "simple-import-sort/imports": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "always"],
      // Direct code evaluation is an injection vector; there is always a
      // safer alternative (dynamic `import()`, lookup tables). The TS-aware
      // `no-implied-eval` (setTimeout("…")) already comes from the preset.
      "no-eval": "error",
      "no-new-func": "error",
    },
  },
  // Prettier last: disables stylistic ESLint rules so formatting
  // has exactly one owner (Prettier), never two.
  prettier,
  // JS tooling configs are parsed (allowJs) but not type-checked:
  // type-aware rules would see only `any`. This is the documented
  // typescript-eslint pattern for JS files under typed linting.
  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
