# AGENTS.md — project_alpha

Monorepo architecture and operational guide for agents and contributors.

---

## 1. Overview & Stack

- **Monorepo Manager**: pnpm workspaces (`packageManager: pnpm@11.22.0`) + Turborepo 2.
- **Runtime & Language**: Node.js `>=24.0.0` (ESM native, NodeNext resolution, native type stripping), TypeScript `catalog:`.
- **Active Workspaces**:
  - `apps/server`: NestJS 12 backend API (NodeNext ESM, Drizzle ORM, Zod, Pino).
  - `packages/cli`: Giltflow continuous-localization CLI (`bin: giltflow`).
  - `packages/database`: PostgreSQL 16 schema, Drizzle ORM client, UUIDv7 utilities, and migrations.
  - `packages/validation`: Isomorphic Zod validation schemas shared across backend and future frontends.
  - `packages/eslint-config`: Shared flat ESLint 9 preset configurations (`base`, `node`, `react`).
  - `packages/typescript-config`: Shared TypeScript configurations (`base.json`, `node.json`, `react.json`).

---

## 2. Developer Commands (Run from Root)

```bash
# Setup & Full Verification
pnpm install                          # Install dependencies (respects supply-chain policies)
pnpm check                            # Run format:check, lint, typecheck, test:cov, build, lint:root, jscpd, knip

# Development & Testing
pnpm dev                              # Start dev processes across workspace (Turbo)
pnpm --filter server dev              # Start NestJS API in watch mode (:3001)
pnpm test                             # Run all tests across workspace
pnpm test:cov                         # Run all tests with coverage thresholds enforced
pnpm --filter server test             # Run server tests; single file: pnpm --filter server exec vitest run <path>

# Code Quality & Static Analysis
pnpm format / pnpm format:check       # Prettier autofix / check
pnpm lint / pnpm lint:fix             # Workspace ESLint / autofix
pnpm lint:root                        # Lint root tooling configs (eslint.config.js, commitlint.config.js)
pnpm jscpd                            # Duplication budget gate (<= 5% on active codebase)
pnpm knip                             # Dead-code and unused exports gate (blocking, zero findings)
pnpm audit                            # Audit dependencies for critical CVEs

# Database Operations (Docker Postgres on host port 5433)
pnpm db:up / pnpm db:down             # Start / stop local PostgreSQL 16 container
pnpm --filter database db:generate    # Generate Drizzle migration SQL files in packages/database/drizzle/
pnpm --filter database db:migrate     # Apply migrations to database (requires DATABASE_URL)
pnpm --filter database db:push        # Prototype schema directly without migrations (dev-only)

# CLI Tooling
pnpm giltflow --help                  # Run local Giltflow localization CLI
pnpm clean                            # Clean dist/ and coverage/ across all packages (rimraf)
```

> **Windows PowerShell 5.1 Rules**: No POSIX `&&` (use `;`), no `head` (use `Select-Object -First`), and no `rm -rf` (use `pnpm clean` or rimraf).

---

## 3. Core Architectural Invariants

### 3.1 Strict ESM & Source Imports

- **Apps (`apps/*`)**: Must use relative imports ending with `.js` (e.g. `import { foo } from "./foo.js"`). Compiled code runs on Node.js directly.
- **Packages (`packages/*`)**: Must import sibling workspace packages via their package specifier (e.g. `import * as schema from "@repo/database/schema"`), **never** relative paths like `./schema.js`. Packages resolve as raw TypeScript source files stripped at load time by Node 24.
- Decorator metadata additions in `apps/server/tsconfig.json` (`experimentalDecorators`, `emitDecoratorMetadata`, `strictPropertyInitialization: false`, `esModuleInterop: true`) are strictly required for NestJS DI.

### 3.2 ESLint & Project Service

- **Single Flat Config**: Exactly one root `eslint.config.js`. Never create per-package ESLint configurations.
- **Typed Linting**: Uses typescript-eslint Project Service (`projectService: true`). Every linted file must belong to a recognized `tsconfig.json`.
- Emitters compile via separate `tsconfig.build.json` files with clean `rootDir: "src"`. No TypeScript project references (Turbo coordinates builds).

### 3.3 Dependency Governance

- **Local Packages**: Always use `workspace:*`.
- **Shared Versions**: Always declare in the root `catalog:` within `pnpm-workspace.yaml`. Never inline conflicting ranges across packages.
- **CI Scanners**: `jscpd` and `knip` are pinned in root `devDependencies` for dependabot management.
- **Supply Chain Guardrails (`.npmrc`)**: Enforces `shamefully-hoist=false`, `strict-peer-dependencies=true`, and `minimumReleaseAge=20160` (14-day delay on new npm releases to block supply-chain zero-days).

### 3.4 Anti-Slop Structural Budgets & Quarantine

- Base rules enforce: `complexity: 20`, `max-lines-per-function: 100`, `max-params: 7`, `max-depth: 4`.
- Spec/test files (`**/*.spec.ts`, `**/*.test.ts`) are exempt from function length.
- **Quarantined Debt**: `packages/cli` is temporarily exempt from structural complexity/length budgets and `jscpd` scanning until the scanner/rewriter refactor is complete.

### 3.5 Security & Data Identity

- **Deny-by-Default Auth**: Global `JwtAuthGuard` applied to all routes unless decorated with `@Public()`. Refresh tokens are explicitly blocked from bearer endpoints (OWASP ASVS V3.5.3).
- **Token Rotation & Device Isolation**: 15m JWT access tokens + 7d rotating refresh tokens. Refresh tokens store only SHA-256 hashes in PostgreSQL; replaying a consumed token instantly revokes the device's `familyId` (RFC 6819).
- **Hybrid Transport**: Browsers receive credentials in `HttpOnly; SameSite=Strict; Secure` cookies; non-browser clients (CLI/scripts) receive tokens in JSON payloads.
- **RFC 9562 Monotonic UUIDv7**: All database primary keys use monotonic `uuidv7()` for sequential B-Tree indexing and IDOR prevention.
- **Strict Zod Boundaries**: Request payloads and environment configurations are strictly parsed with Zod schemas via `ZodValidationPipe` and `validateEnv`. Outbound user projections never include `passwordHash`.

### 3.6 Real Engineering vs. AI-Slop Mandates

- **ACID Atomicity**: Multi-table mutations must execute inside an explicit database transaction (`db.transaction(...)`). External network calls (email, APIs) must **never** run inside a database transaction.
- **Concurrency & Races**: Use atomic SQL updates (`UPDATE ... WHERE balance >= x`), row locks (`FOR UPDATE`), or database constraints. Never rely on naive application "read-then-write" loops.
- **Stateless Backend**: Zero in-memory Maps or process-local variables for state (sessions, counters, rate limits). Externalize shared state to PostgreSQL or Redis.
- **No "Abstractitis"**: Enforce direct 3-tier architecture: Transport (`Controller`) $\to$ Domain (`Service`) $\to$ Data (`Repository`/Drizzle). Do not invent speculative factories, adapters, or interfaces without multiple real implementations.
- **Explicit Failure**: Fail fast and loudly. Never silently swallow errors in catch blocks (`console.log(e); return null;`). Bubble up to centralized error filters.
- **Zero Mock Theater**: Unit tests must assert observable contract behavior and edge cases. Never mock the system under test or write assertions that verify only the mock itself.
- **UI & Token Hygiene**: Use semantic design tokens (`bg-primary`, `border-border`) and shared primitives (`@/components/ui/*`). Never invent inline styles, palette-hopping colors, gratuitous gradients, or ungrounded floating chatbot gimmicks.

---

## 4. CI & Quality Pipeline (`.github/workflows/ci.yml`)

The CI workflow runs **6 decoupled parallel jobs** with Turborepo caching:

1. **`quality`**: Prettier formatting, workspace ESLint, root configs linting, JSCPD duplication check (budget $\le 5\%$), and Knip dead-code analysis.
2. **`typecheck`**: TypeScript typechecking across all workspace packages (`turbo run typecheck`).
3. **`test`**: Peer dependency verification (`pnpm peers check`) and parallel test suite execution enforcing 80% coverage floors across `server` and `validation` (`pnpm test:cov`).
4. **`build`**: Production compilation of all packages and apps (`turbo run build`).
5. **`security`**: Critical vulnerability audit (`pnpm audit --audit-level=critical`) and secret detection via Gitleaks (`gitleaks-action@v3`).
6. **`docker`**: Multi-stage Docker build proof for `apps/server/Dockerfile` using BuildKit stage copying.
7. **`ci-gate`**: Unified pipeline status gate required for GitHub Branch Protection.

> **Concurrency**: Intermediate pull request runs are canceled (`cancel-in-progress: true`), but pushes to `main` always run to completion.

---

## 5. Git & PR Workflow

- **Branch Protection & Trunk Discipline**:
  - `main` is protected via GitHub Repository Rulesets: Force-pushing (`git push --force`) and branch deletions are strictly blocked.
  - All work must be conducted on feature/topic branches (`feat/*`, `fix/*`, `chore/*`).
  - Merging into `main` requires an approved Pull Request and a green `ci-gate` status check.
- **Commits**: Conventional Commits enforced via `.husky/commit-msg` and `@commitlint/cli`.
  - Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.
  - Allowed scopes: `server`, `cli`, `database`, `validation`, `config`, `repo`, `ci`, `deps`, `deps-dev`.
- **Pre-Commit**: Husky runs `lint-staged` on staged files only.
- **Pull Requests**:
  - Target `<500 LOC` for AI-assisted PRs.
  - Colocated tests in `*.spec.ts` (human-authored assertions, red $\to$ green).
  - Every PR must complete the checklist in `.github/pull_request_template.md`.

---

## 6. Scope & Roadmap Decisions

- **In Scope (Planned for Future Platform Implementation)**:
  - **Roles & Permissions (RBAC)**: Role hierarchy expansion and fine-grained permission guards (`@Roles(...)`).
  - **User Profile Extensions**: App-dependent metadata fields on `users` table based on product UI needs.
  - **Audit Logging**: Dedicated `audit_logs` database table tracking security-sensitive operations (auth events, password changes, account deletions).
- **Out of Scope (Deferred / Not Needed for Current Phase)**:
  - Bot Protection (CAPTCHA / Cloudflare Turnstile).
  - Multi-Factor Authentication (2FA / TOTP).
  - Social OAuth2 Logins (Google / GitHub SSO).
- **Architectural Exploration (Deferred to Multi-Instance / Scaling Phase)**:
  - **Distributed Rate Limiting**: Redis-backed storage for `@nestjs/throttler` across multi-container load-balanced deployments.
  - **Asynchronous Email Queuing**: BullMQ + Redis background workers to decouple SMTP network latency from HTTP requests.
  - **Automated Real-DB E2E Tests**: Testcontainers/PostgreSQL service integration in CI for true end-to-end HTTP boundary verification.

---

## 7. AI Session & Decision Lifecycle Protocol

Every AI-assisted coding session must strictly follow this 4-step lifecycle:

### 7.1 Grounding & Exploration (Before Coding)

- **Consult `AGENTS.md` First**: Treat this document as the active source of architectural truth.
- **Search Before Inventing**: Search existing utilities, helpers, and schemas before adding new abstractions.
- **State Intent & Non-Goals**: Clearly articulate what is being implemented and what is explicitly excluded.

### 7.2 Surgical Implementation & Continuous Verification

- **Minimal Blast Radius**: Touch only the files directly required for the task.
- **Colocated Spec Tests**: Author or update `*.spec.ts` files covering happy paths, edge cases, and failure modes.
- **Non-Negotiable Quality Gate**: Every task must run and verify `pnpm check` (format check, lint, typecheck, coverage floors, build, root lint, jscpd duplication $\le 5\%$, knip dead code = 0).

### 7.3 Decision Graduation (Never Leave in Ephemeral Chat)

- **Architectural & Tech Decisions**: If a structural or technical choice was made, record a formal ADR in `docs/decisions/adr-log.md`.
- **Roadmap & Scope Changes**: If milestone deliverables or phase definitions shift, update `docs/roadmap/phased-roadmap.md` and Section 6 of `AGENTS.md`.
- **Operating Invariants**: If a project convention or guardrail evolves, update this `AGENTS.md` file.

### 7.4 PR Completion & AI Disclosure

- Open a PR from the feature branch targeting `main`.
- Complete all sections of `.github/pull_request_template.md`, including the AI disclosure checklist (human assertion verification, utility deduplication, line-by-line comprehension).
