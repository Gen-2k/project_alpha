# Adding an app

Apps live in `apps/` and are the only deployable units. Each app is
independent: its own `package.json`, `tsconfig.json`, dev server and build.

## 1. Scaffold

```bash
mkdir -p apps/web
cd apps/web
pnpm init
```

## 2. `package.json` template

```json
{
  "name": "web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --port 5173",
    "build": "tsc --noEmit && vite build",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --max-warnings 0",
    "test": "vitest run",
    "clean": "rimraf dist coverage"
  },
  "dependencies": {
    "@repo/types": "workspace:*"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "typescript": "catalog:"
  }
}
```

Rules:

- `private: true` — apps are never published.
- Cross-package deps use `workspace:*` (fails loudly if the target
  package is missing; rewritten automatically on publish).
- Shared version ranges use `catalog:` (add the entry to the root
  `pnpm-workspace.yaml` catalog first).
- Script names must match `turbo.json` tasks (`dev`, `build`, `lint`,
  `typecheck`, `test`) so orchestration, ordering and caching apply.
- `lint` uses `--max-warnings 0`: warnings fail CI, so nothing rots silently.
- `test` / `vitest.config.ts` need Vitest: add a `vitest` entry to the
  root catalog, then `"vitest": "catalog:"` in `devDependencies`.
- `clean` uses the root `rimraf` binary (on PATH for all workspace
  scripts — no per-package install needed; `rm -rf` breaks on Windows).

## 3. TypeScript

Frontend (`apps/web`, `apps/admin`):

```json
{
  "extends": "@repo/typescript-config/react.json",
  "include": ["src", "vite.config.ts", "vitest.config.ts"],
  "exclude": ["node_modules", "dist"]
}
```

Backend (`apps/api`, `apps/worker`):

```json
{
  "extends": "@repo/typescript-config/node.json",
  "include": ["src", "vitest.config.ts"],
  "exclude": ["node_modules", "dist"]
}
```

Backend packages also need, in `devDependencies`:

- `"@types/node"` (`node.json` sets `types: ["node"]` — without it `tsc`
  fails with TS2688 and Node globals stay unresolved).

And in `package.json`:

- `"engines": { "node": ">=24.0.0" }` (match the major you actually run):
  the Node lint rules read it to flag APIs your runtime doesn't support.

If the package emits files (`tsc` build), add a `tsconfig.build.json`
extending the above with `outDir`/`rootDir` and build with
`tsc -p tsconfig.build.json` — this keeps lint/type configs (which must
include tooling configs) separate from emit configs (which require a
clean `rootDir`). No Project References needed; Turbo orders builds.

## 4. Register lint scope

If the app introduces a new runtime (it doesn't — `web`/`admin` are
covered by the React block, `api`/`worker` by the Node block in
`eslint.config.js`), add its path to the matching `files` list there.

## 5. Env

Each app owns its env: `apps/<name>/.env.example` (committed, placeholders
only) + local `.env` (gitignored, never committed). Validate at boot
(e.g. Zod) and fail fast on missing values.

## 6. Verify

```bash
pnpm install
pnpm --filter web typecheck
pnpm --filter web lint
pnpm --filter web test
pnpm build   # builds dependencies first, cached afterwards
```
