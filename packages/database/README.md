# @repo/database — Data Layer & Schema Guide

Production PostgreSQL 16 database layer for Project Alpha, powered by **Drizzle ORM**, **RFC 9562 Monotonic UUIDv7**, and Docker.

---

## 1. Stack & Architecture

- **Database Engine**: PostgreSQL 16 Alpine (`postgres:16-alpine`).
- **ORM / Query Builder**: Drizzle ORM (`drizzle-orm` + `postgres` driver).
- **Migration Tooling**: Drizzle Kit (`drizzle-kit`).
- **Primary Keys**: RFC 9562 Monotonic UUIDv7 (`uuidv7()` utility) to prevent B-Tree fragmentation while ensuring unguessable IDs (IDOR protection).
- **Time Tracking**: `TIMESTAMPTZ` (`timestamp({ withTimezone: true })`) across all timestamp columns.
- **Port Mapping**: Container runs internally on `5432`, exposed to the host machine on **`5433`** (to prevent collisions with native PostgreSQL installations running on default port `5432`).

---

## 2. Table Catalog (9 Core Tables)

```mermaid
erDiagram
    users ||--o{ refresh_tokens : owns
    users ||--o{ password_reset_tokens : requests
    users ||--o{ email_verification_tokens : requests
    organizations ||--o{ organization_members : contains
    users ||--o{ organization_members : joins
    organizations ||--o{ organization_invitations : issues
    organizations ||--o{ products : groups
    organizations ||--o{ projects : owns
    products ||--o{ projects : categorizes
```

| Table Name                  | Description                              | Key Security & Constraint Rules                                              |
| :-------------------------- | :--------------------------------------- | :--------------------------------------------------------------------------- |
| `users`                     | Registered platform user accounts        | Passwords stored strictly as Bcrypt hashes; email unique lowercase.          |
| `refresh_tokens`            | Active and rotated JWT refresh sessions  | Stores SHA-256 token hash; RFC 6819 `family_id` rotation & theft revocation. |
| `password_reset_tokens`     | Single-use password reset links          | Stores SHA-256 token hash; single-use via `used_at`.                         |
| `email_verification_tokens` | Email confirmation links                 | Stores SHA-256 token hash; single-use via `used_at`.                         |
| `organizations`             | Workspaces / Multi-tenant accounts       | Unique human-friendly `slug` (`uniqueIndex`).                                |
| `organization_members`      | Team membership & roles                  | 3NF junction table; composite unique index on `(organization_id, user_id)`.  |
| `organization_invitations`  | Pending team invites                     | Token hash unique; indexed by `email` and `organization_id`.                 |
| `products`                  | Product suites within an organization    | Unique composite index on `(organization_id, slug)`; lower-name index.       |
| `projects`                  | Localization projects & target languages | Scoped to organization; `productId` is `onDelete: 'set null'`.               |

---

## 3. Environment Configuration

The migration runner (`drizzle-kit`) and runtime client require `DATABASE_URL`.

Create a `.env` file inside `packages/database/` (this file is gitignored):

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/project_alpha
```

> [!NOTE]
> `apps/server` also has its own `.env` file with the identical `DATABASE_URL`.

---

## 4. Daily Development Workflow

Always execute these commands from the **monorepo root**:

### 4.1 Start and Stop Database Container

```bash
# Start local PostgreSQL 16 container (Docker)
pnpm db:up

# Stop container
pnpm db:down
```

### 4.2 Making Schema Changes (The Migration Cycle)

Whenever you add or modify a column in [`src/schema.ts`](./src/schema.ts), follow this 2-step process:

```bash
# Step 1: Generate a new SQL migration file in packages/database/drizzle/
pnpm --filter database db:generate

# Step 2: Apply the migration to your local PostgreSQL container
pnpm --filter database db:migrate
```

### 4.3 Interactive Visual Dashboard (Drizzle Studio)

To inspect rows, run ad-hoc queries, or add seed data in a visual spreadsheet-like browser UI:

```bash
pnpm --filter database db:studio
```

Opens in your browser at `https://local.drizzle.studio`.

---

## 5. Command Reference Cheat Sheet

| Command (Run from Root)              | Purpose                                                                                 |
| :----------------------------------- | :-------------------------------------------------------------------------------------- |
| `pnpm db:up`                         | Starts PostgreSQL container via Docker (`port 5433`).                                   |
| `pnpm db:down`                       | Stops PostgreSQL container.                                                             |
| `pnpm --filter database db:generate` | Compares `src/schema.ts` against `./drizzle/` and generates new `.sql` migrations.      |
| `pnpm --filter database db:migrate`  | Executes pending migrations against PostgreSQL.                                         |
| `pnpm --filter database db:push`     | **Dev-only**: Pushes schema directly without creating migration files (use cautiously). |
| `pnpm --filter database db:studio`   | Launches visual web database browser.                                                   |
| `pnpm --filter database test`        | Runs unit tests (e.g. UUIDv7 monotonicity verification).                                |

---

## 6. Troubleshooting & FAQs

### Q1: `Error: connect ECONNREFUSED 127.0.0.1:5433`

- **Cause**: The PostgreSQL container is not running, or Docker Desktop is turned off.
- **Fix**:
  1. Ensure Docker Desktop is active.
  2. Run `pnpm db:up`.
  3. Verify container health with `docker ps` (look for `project-alpha-postgres`).

### Q2: `drizzle-kit: No database URL provided`

- **Cause**: Missing `.env` file in `packages/database/`.
- **Fix**: Create `packages/database/.env` with:
  ```env
  DATABASE_URL=postgresql://postgres:postgres@localhost:5433/project_alpha
  ```

### Q3: How do I completely wipe and reset my local development database?

If your local development data gets corrupted and you want a clean slate:

```bash
# 1. Stop container and remove the persistent volume
docker compose down -v

# 2. Start a fresh container
pnpm db:up

# 3. Re-apply all migrations from scratch
pnpm --filter database db:migrate
```

### Q4: Why are primary keys UUIDv7 instead of normal numbers (`1, 2, 3`)?

1. **Security**: Sequential numbers leak business metrics and allow trivial IDOR URL-guessing attacks (`/invoices/1`, `/invoices/2`).
2. **Speed**: Random UUIDv4 causes B-Tree index fragmentation and cache thrashing. Monotonic UUIDv7 embeds a millisecond timestamp at the beginning, ensuring sequential B-Tree appends at the speed of auto-increment integers.
3. **Collision-free**: Client apps and servers can generate IDs independently without locking database sequences.
