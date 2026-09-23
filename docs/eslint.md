# ESLint architecture

One root flat config (`eslint.config.js` — `.js`, not `.mjs`, because the
root `package.json` is `"type": "module"`, so `.js` already is ESM).
Presets live in `packages/eslint-config/` (`base` / `react` / `node`) and
are scoped to file globs in the root config. There are no per-package
ESLint configs, ever.

## Commands

```bash
pnpm lint        # graph run over all workspace packages (cached)
pnpm lint:fix    # same, with --fix
pnpm lint:root   # root tooling configs (eslint.config.js, commitlint.config.js)
pnpm check       # format:check + lint/typecheck/test/build + lint:root
```

`--max-warnings 0` is on every lint script: warnings fail CI. A `warn`
means "justify or remove", never "ignore".

## Where rules belong

| Layer                                                         | Files                                           | Preset    |
| ------------------------------------------------------------- | ----------------------------------------------- | --------- |
| Everything (TS/JS)                                            | `**/*`                                          | `base`    |
| React UI                                                      | `apps/web,admin/**`, `packages/ui/**`           | `+ react` |
| Node servers/libs                                             | `apps/api,worker/**`, `packages/database/**`    | `+ node`  |
| Isomorphic libs (`validation`, `api-client`) and pure `types` | base only — runtime-agnostic on purpose         |
| Tooling JS (`*.config.*`, root configs)                       | parsed, not type-checked (`disableTypeChecked`) |

New runtime? Add its path to the matching list in `eslint.config.js`.
New preset-worthy concern? Add a file in `packages/eslint-config/`,
export it, scope it at root. Don't build a 10-file framework.

## What each layer enforces

- **base**: `strictTypeChecked` + `stylisticTypeChecked` (unsafe `any`
  flow, floating/misused promises, unnecessary conditions, unused
  vars/imports), sorted imports, `eqeqeq`, `no-eval`/`no-new-func`.
  Deliberately absent: return-type requirements (tsc inference is
  already checked), naming conventions, Unicorn/Sonar style packs.
- **react**: classic React correctness, official hooks v7 recommended
  (Rules of Hooks = error; exhaustive-deps = warn because of known
  false positives — still fails CI via max-warnings), merged React
  Compiler diagnostics (work without the compiler installed), a11y
  recommended. `no-misused-promises` is relaxed for JSX attributes
  only (`onClick={save}`); `forEach(async…)` stays an error.
- **node**: Node globals, `eslint-plugin-n` subset
  (`no-unsupported-features/node-builtins` reads each package's
  `engines`, `no-deprecated-api`, `prefer-node-protocol`).
  Skipped on purpose: `no-missing-import` (tsc owns resolution),
  `no-sync`/`no-process-exit` (legit in CLIs/workers — scope locally
  if a hot path needs them).

## Async convention

`no-floating-promises` is an error: every promise is awaited, returned,
or explicitly voided. Intentional fire-and-forget is written `void
sendWebhook()` — greppable and honest.

## Boundaries

ESLint does **not** enforce package boundaries here. Two better tools:

- `turbo boundaries` (experimental, purpose-built): catches
  out-of-package imports and undeclared workspace deps. Adopt with
  `tags` in `turbo.json` once cross-package imports exist.
- `eslint-plugin-boundaries` (active, flat-compatible): per-file
  layer rules with editor feedback. Revisit if `turbo boundaries`
  stays experimental.

Neither is installed with zero imports to check — that's restraint,
not a gap (see `docs/adding-package.md`).

## Testing layer (future)

When Vitest lands, add one block — no rewrite needed:

```js
// eslint.config.js
{
  files: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
  // plugins: { vitest: vitestPlugin },
  // rules: { ...vitestPlugin.configs.recommended.rules },
}
```

Use `eslint-plugin-vitest` (flat-compatible) for test hygiene
(`no-disabled-tests`, `expect-expect`) and keep type-aware base rules
on — floating promises in tests are still bugs. Playwright e2e specs
get the same treatment with `eslint-plugin-playwright`.

## Security boundary

ESLint covers what it can see in one file: `eval`/`new Function`,
implied eval, unsafe DOM/JSX patterns. It does **not** replace:
dependency scanning (`pnpm audit`, Dependabot), secret scanning
(gitleaks hook or GitHub secret scanning), SAST, or runtime security.

## Performance

Type-aware linting costs a project-service startup (~2-4s) plus type
info per file. Kept practical by: lint-staged (staged files only,
pre-commit), Turbo task cache (unchanged packages replay), and no
`allowDefaultProject` magic — every linted file belongs to a real
tsconfig, so type info matches the editor exactly.

## Troubleshooting

**"Unsafe … of an error typed value" everywhere.** This message means
imports failed to resolve — the values aren't mistyped, they're
missing. Causes, in order: (1) incomplete install — run `pnpm install`
(CI uses `--frozen-lockfile`, which fails loudly instead); (2) running
ESLint outside pnpm's context so workspace links don't resolve; (3) a
stale VS Code ESLint server after dependency changes — run
`ESLint: Restart ESLint Server` from the command palette. Compare CLI
(`npx eslint <file>`) against the Problems panel: if CLI is clean and
the editor isn't, it's (3).
