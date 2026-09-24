# Project Alpha — monorepo foundation

A minimal, production-ready TypeScript monorepo foundation: package manager,
task orchestration, shared configs, lint/format, git hooks and CI — plus
the first app, `apps/server` (NestJS). Backend patterns established there
carry over to `apps/worker` and future services.

## Why a monorepo

One repo, one toolchain, one CI pipeline for all future apps (`web`,
`admin`, `api`, `worker`) and shared packages. Cross-package changes land
in a single PR; Turbo rebuilds only what the dependency graph requires.

## Structure

```text
apps/
  server/              # NestJS API (see apps/server, docs/adding-app.md)
packages/
  typescript-config/   # shared tsconfigs: base / react / node
  eslint-config/       # shared ESLint presets: base / react / node
  validation/          # shared Zod schemas (server + future frontend forms)
docs/
  adding-app.md        # how to add apps/web, apps/api, …
  adding-package.md    # how to add packages/ui, packages/database, …
.github/workflows/    # CI: install → format → lint → typecheck → test → build
```

Deliberately absent: `tooling/` (a second name for `packages/` — Turborepo
convention is flat `packages/*`), nested `packages/config/*` (complicates
globs/filters), runtime packages (created on demand, not upfront).

## Prerequisites

- Node.js 24 (`cat .nvmrc`; `engines` enforces `>=24.0.0`)
- pnpm 11.22.0 (pinned via `packageManager`; no Corepack needed)

## Install & verify

```bash
pnpm install
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test    # no-op until the first package defines it
pnpm build   # no-op until the first app/package defines it
pnpm check   # format:check + lint/typecheck/test/build + lint:root
```

Second runs are fully cached by Turbo (expect `FULL TURBO` in ~100ms).

## Commands

| Command               | What it does                                                        |
| --------------------- | ------------------------------------------------------------------- |
| `pnpm dev`            | Run all `dev` scripts (persistent, uncached)                        |
| `pnpm build`          | Dependency-aware builds (`^build` first), cached outputs            |
| `pnpm lint`           | Graph-aware ESLint (per-package, cached); autofix: `lint:fix`       |
| `pnpm lint:root`      | Lint root tooling configs (`eslint.config.js`, …)                   |
| `pnpm typecheck`      | Per-package `tsc --noEmit` (source-level, needs no build)           |
| `pnpm test`           | Per-package `vitest run`, cached                                    |
| `pnpm test:e2e`       | Full-stack e2e suites, cached; also part of `check`                 |
| `pnpm check`          | `format:check` + `lint/typecheck/test/test:e2e/build` + `lint:root` |
| `pnpm format(:check)` | Prettier — the single owner of formatting                           |

Filters: `pnpm --filter web dev`, `turbo run build --filter=@repo/ui`.

## Conventions

- Internal packages are `@repo/*`, `private: true`, version `0.0.0`.
- Cross-package deps: `"@repo/x": "workspace:*"`. Shared ranges: `"typescript": "catalog:"`.
- Apps depend on packages; nothing depends on `apps/*`; no cycles
  (enforced by review — automated boundary checks arrive with the first
  cross-package imports, see `docs/eslint.md`).
- Commits follow Conventional Commits (`feat(web): …`); hooks validate.
- Secrets: per-app `.env` (gitignored) + committed `.env.example`; validated at boot.

## Known trade-offs

- **TypeScript pinned at 6.x (verified 6.0.3).** Trialed 5.9.3 (stable but
  accrues 6.0 deprecation debt — editors already flag it), 6.0.3 (full
  pipeline green, peers clean — chosen), and 7.0.2 (also green today,
  but the native port is ~6 weeks old; re-evaluate at 7.1+ once the
  ecosystem has mileage on it).

- **ESLint 9 (EOL Aug 2026) instead of v10**: the React/a11y plugins still
  peer-cap at `eslint@^9` (verified 2026-09-23: v10 trial failed with 3
  unmet peers). Upgrade when `eslint-plugin-react` / `jsx-a11y` ship v10
  support — the flat-config shape carries over unchanged.

## Workflow

```bash
git checkout -b feat/web-shell
# …add apps/web per docs/adding-app.md…
pnpm install && pnpm check
git commit -m "feat(web): add shell"   # pre-commit lints staged files
```
