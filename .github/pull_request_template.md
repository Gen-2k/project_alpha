<!--- One task = one PR, <500 LOC for AI-assisted PRs (split if larger). -->
<!--- Intent lives here in the PR body — no permanent spec/ docs required. -->

## Intent (3-5 lines, no code)

What is it:

Non-goals (what it explicitly does NOT do):

Done looks like:

## Blast radius

Files touched:

Downstream consumers / migrations (`db:generate` needed?):

Risk tier: `fast` (config/docs) / `standard` (feature) / `hardened` (auth, RBAC, audit_logs, payments, crypto)

## Real Engineering & Anti-Slop Audit

- [ ] **Transactions**: Multi-table mutations wrapped in explicit ACID `db.transaction(...)`; external APIs/emails run outside DB transactions.
- [ ] **Concurrency**: Atomic SQL operations or row locks used; no naive "read-then-write" in-memory loops.
- [ ] **Statelessness**: Zero process-local `Map` or in-memory variables used for persistence or rate limits.
- [ ] **Boundaries & Errors**: Inputs strictly parsed with Zod (no unsafe `as Type`); errors propagated explicitly without silent catch swallowing.
- [ ] **Architecture**: Direct 3-tier structure; zero speculative abstractions or unnecessary interfaces.
- [ ] **Test Realism**: Assertions verify observable behavior and edge cases, zero mock theater.

## AI Disclosure & Discipline

- [ ] Human wrote or verified test assertions; AI scaffolded implementation (or no AI used).
- [ ] Searched and reused existing helpers before adding new code (zero duplicates).
- [ ] Line-by-line comprehension: Author can walk through every line without consulting AI.

## Proof & Verification

- [ ] `pnpm check` green (format check + lint + typecheck + test:cov + build + lint:root + jscpd + knip).
- [ ] New/updated colocated `*.spec.ts` (happy path + edge case + error case), red -> green observed.
- [ ] Live boot + curl smoke (`:3001`, `/docs`) if server touched, then killed.
- [ ] Outbound user projections never include `passwordHash`.
- [ ] ESM `.js` suffixes in `apps/*`; package specifiers in `packages/*`.
- [ ] Conventional Commits used (`feat(server): ...`).
