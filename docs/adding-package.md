# Adding a package

Packages live in `packages/` and are imported by apps (never deployed
alone). A package earns its existence when **two or more apps** need the
same code — or when it encapsulates a coherent boundary (e.g. `database`).

## Naming

Flat, descriptive, no nesting: `packages/<name>` published internally as
`@repo/<name>` (e.g. `@repo/types`, `@repo/ui`). Never nest
(`packages/config/*`): nested workspaces complicate globs, filters and
editor setup for zero benefit.

## Dependency direction

```
apps → packages → config packages
```

- Apps may depend on packages. Packages may depend on other packages.
- Nothing may depend on `apps/*`. Config packages depend on nothing local.
- No circular dependencies (enforced by review; add
  `eslint-plugin-import-x` `no-cycle` once cross-package imports exist —
  its resolver setup isn't worth carrying with zero imports).

## Avoiding the `utils` dumping ground

Do not create one generic `utils` package. Prefer small packages named
after what they wrap or whom they serve:

- `types` — shared domain types only, dependency-free, no runtime code.
- `validation` — schemas (Zod) shared by frontend forms and API input.
- `ui` — React components (peerDeps on `react`, never direct deps).
- `database` — schema + migrations + typed client (owns its env contract).
- `api-client` — typed fetch wrappers used by frontend apps.

If a helper is used by one app only, it belongs in that app (`apps/web/src/lib`),
not in `packages/`. Promote it when the second consumer appears.

## `package.json` template

```json
{
  "name": "@repo/validation",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --max-warnings 0",
    "test": "vitest run",
    "clean": "rimraf dist coverage"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

Rules:

- `exports` is explicit per entry point. No barrel file re-exporting
  everything (`export *` defeats tree-shaking and hides the public API).
- UI packages declare frameworks as `peerDependencies` (one React
  instance) — never `dependencies`.
- `lint` uses `--max-warnings 0` and `clean` uses the root `rimraf`
  binary (see `docs/adding-app.md` — same conventions as apps).
- Test runner: Vitest for unit/integration (shares Vite behavior,
  source-level, no build step). E2E (Playwright) comes later as
  `apps/e2e`, not as a package.

## TypeScript

```json
{
  "extends": "@repo/typescript-config/base.json",
  "include": ["src", "vitest.config.ts"],
  "exclude": ["node_modules", "dist"]
}
```

`base` is runtime-agnostic on purpose (no DOM/Node globals): pure logic
typechecks anywhere. Emitting packages add `tsconfig.build.json`
(see `docs/adding-app.md` §3).

## Verify

```bash
pnpm install
pnpm --filter @repo/validation typecheck
pnpm --filter @repo/validation lint
pnpm --filter @repo/validation test
```
