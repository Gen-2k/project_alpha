# Real Engineering Mandate — Project Alpha

All AI assistants (Copilot, Cursor, Antigravity, Claude, etc.) must write **production-grade engineering**, not superficial "vibe code" or AI-slop. Follow [AGENTS.md](../AGENTS.md) as the single source of truth.

---

## 1. Zero AI-Slop Rules

- **ACID Transactions**: Every multi-table mutation must be wrapped in an explicit DB transaction (`db.transaction(...)`). Never invoke external APIs or emails _inside_ a database transaction.
- **Concurrency & Races**: Use atomic SQL updates or row locks with affected-row checks. Never use naive in-memory "read-then-write" application logic.
- **Stateless Backend**: Zero process-local `Map` or in-memory variables for sessions, caches, or counters. Externalize shared state to PostgreSQL or Redis.
- **Strict Boundary Validation**: Parse all external inputs at the transport edge with Zod. Never cast with `as Type`.
- **Fail Fast & Explicit**: Catch errors only if meaningfully recovering. Never silently swallow exceptions (`console.log; return null;`). Bubble up with proper HTTP status codes.
- **No "Abstractitis"**: Max 3 tiers (Handler/Controller → Service → DB/Repo). Never create speculative factories, generic adapters, or interfaces with only one implementation.
- **No Mock Theater**: Tests must assert real observable behavior and boundary conditions. Never mock the unit under test or write trivial tests that only verify mock configuration.
- **UI & Token Hygiene**: Use semantic theme tokens (`bg-primary`, `border-border`) and shared primitives (`@/components/ui/*`). Never hardcode raw hex colors, gratuitous gradients, glowing borders, or ungrounded floating chatbot gimmicks.

---

## 2. Operational Discipline

1. **Search Before Inventing**: Search existing helpers before creating new ones (`formatDate`, `validateEmail`). Zero duplication.
2. **Surgical Diffs**: Touch only what is strictly necessary. Never perform unrelated refactors or delete existing comments.
3. **Verify Before Completion**: Run and verify `pnpm check` (format check, lint, typecheck, coverage floors, build, jscpd $\le 5\%$, knip = 0). Never claim success without running the command.
4. **Graduate Decisions**: Log architectural choices to [docs/decisions/adr-log.md](../docs/decisions/adr-log.md) (ADRs). Never leave decisions in ephemeral chat.
5. **Trunk Discipline**: Never push directly or force-push (`--force`) to `main`. Use topic branches and complete [.github/pull_request_template.md](./pull_request_template.md).
