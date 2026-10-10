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
import checkFile from "eslint-plugin-check-file";
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
      "check-file": checkFile,
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
      // Strict naming conventions across the monorepo
      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: "default",
          format: ["camelCase"],
          leadingUnderscore: "allow",
          trailingUnderscore: "allow",
        },
        {
          selector: "variable",
          format: ["camelCase", "UPPER_CASE", "PascalCase"],
          leadingUnderscore: "allow",
          trailingUnderscore: "allow",
        },
        {
          selector: "function",
          format: ["camelCase", "PascalCase"],
        },
        {
          selector: "parameter",
          format: ["camelCase"],
          leadingUnderscore: "allow",
        },
        {
          selector: "class",
          format: ["PascalCase"],
        },
        {
          selector: "classMethod",
          format: ["camelCase"],
        },
        {
          selector: "classProperty",
          format: ["camelCase", "UPPER_CASE"],
          leadingUnderscore: "allow",
        },
        {
          selector: "typeLike",
          format: ["PascalCase"],
        },
        {
          selector: "interface",
          format: ["PascalCase"],
          custom: {
            regex: "^I[A-Z]",
            match: false,
          },
        },
        {
          selector: "enum",
          format: ["PascalCase", "UPPER_CASE"],
        },
        {
          selector: "typeParameter",
          format: ["PascalCase"],
        },
        {
          selector: "import",
          format: ["camelCase", "PascalCase", "UPPER_CASE"],
        },
        {
          selector: "property",
          modifiers: ["requiresQuotes"],
          format: null,
        },
        {
          selector: "property",
          format: ["camelCase", "UPPER_CASE", "snake_case"],
          leadingUnderscore: "allow",
        },
      ],
      // File and directory naming conventions
      "check-file/filename-naming-convention": [
        "error",
        {
          "**/src/**/*.{ts,tsx,js,jsx}": "KEBAB_CASE",
        },
        {
          ignoreMiddleExtensions: true,
        },
      ],
      "check-file/folder-naming-convention": [
        "error",
        {
          "**/src/**/": "KEBAB_CASE",
        },
      ],
      // style-only import ordering (tsc + bundlers don't care).
      "simple-import-sort/imports": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "always"],
      // Direct code evaluation is an injection vector; there is always a
      // safer alternative (dynamic `import()`, lookup tables). The TS-aware
      // `no-implied-eval` (setTimeout("…")) already comes from the preset.
      "no-eval": "error",
      "no-new-func": "error",
      // Anti-slop structural budget: catches the 300-line god-functions from
      // the 90-day reckoning without breaking current main (verified:
      // hottest paths today are CC 20 in all-exceptions.filter.ts and
      // 94-line service methods, so 20/100 keeps main green while blocking
      // new monsters). Tighten toward 10/50 only after refactoring the
      // filter + organizations.service.ts + auth.service.ts.
      complexity: ["error", 20],
      "max-lines-per-function": [
        "error",
        { max: 100, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
      // NestJS constructors legitimately inject 5+ providers; 7 allows DI
      // while still catching god-function parameter lists.
      "max-params": ["error", 7],
      "max-depth": ["error", 4],
    },
  },
  // Spec `describe` blocks bundle dozens of cases per file by design —
  // length there is coverage, not slop. Duplication in specs is still
  // caught by jscpd; complexity still applies.
  {
    files: ["**/*.spec.ts"],
    rules: {
      "max-lines-per-function": "off",
    },
  },
  // packages/cli is the known slop hotspot (verified 2026-10-10: rewriteJsx
  // CC 27 / 329 lines, scanner `enter` CC 54, nesting depth 6). The budget
  // stays enforced on server+validation+database; cli gets budget-exempt
  // until the rewriter/scanner refactor lands, then delete this block.
  {
    files: ["packages/cli/**/*.ts"],
    rules: {
      complexity: "off",
      "max-lines-per-function": "off",
      "max-depth": "off",
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
