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

## AI disclosure

- [ ] Human wrote test assertions, AI scaffolded implementation (or: no AI used)
- [ ] Searched for existing utils before adding new ones (`formatDate`, `validateEmail`, …)
- [ ] I can walk through every line without consulting the AI

## Proof

- [ ] `pnpm check` green (format + lint + typecheck + test + build + lint:root)
- [ ] New/updated colocated `*.spec.ts` (happy path + edge case + error case), red -> green observed
- [ ] Live boot + curl smoke (`:3001`, `/docs`) if server touched, then killed
- [ ] No `passwordHash` in outbounds (explicit projections)

## Checklist

- [ ] <500 LOC or split with reason
- [ ] No duplication introduced (checked `validate*`, `format*`, query patterns)
- [ ] ESM `.js` suffixes in `apps/*`; package specifiers in `packages/*`
- [ ] Shared versions via `catalog:`, local code via `workspace:*`
- [ ] Conventional Commits (`feat(server): …`)
