# Architecture & Product Decision Records (ADR Log)

This document serves as the formal decision log for **Project Alpha**, recording architectural, product, and commercial decisions, their rationale, and evaluated tradeoffs.

---

## ADR Index

| ADR ID                                                                                 | Title                                                              |    Status    |    Date    |
| :------------------------------------------------------------------------------------- | :----------------------------------------------------------------- | :----------: | :--------: |
| [**ADR-001**](#adr-001-developer-first-continuous-localization-vs-all-in-one-monolith) | Developer-First Continuous Localization vs. All-in-One Monolith    | **APPROVED** | 2026-09-27 |
| [**ADR-002**](#adr-002-leveraging-existing-monorepo-nestjs-12-esm--drizzle-orm)        | Leveraging Existing Monorepo, NestJS 12 ESM & Drizzle ORM          | **APPROVED** | 2026-09-27 |
| [**ADR-003**](#adr-003-dual-string-identity-hierarchical-key-path--sha-256-hash)       | Dual String Identity: Hierarchical Key Path + SHA-256 Content Hash | **APPROVED** | 2026-09-27 |
| [**ADR-004**](#adr-004-retrieval-augmented-localization-ral-vs-raw-nmt)                | Retrieval-Augmented Localization (RAL) vs. Raw NMT                 | **APPROVED** | 2026-09-27 |
| [**ADR-005**](#adr-005-automated-3-tier-quality-governance-with-mqm-vs-uniform-mtpe)   | Automated 3-Tier Quality Governance with MQM vs. Uniform MTPE      | **APPROVED** | 2026-09-27 |
| [**ADR-006**](#adr-006-virtual-copy-on-write-branch-isolation-mirroring-git-dag)       | Virtual Copy-on-Write Branch Isolation Mirroring Git DAG           | **APPROVED** | 2026-09-27 |
| [**ADR-007**](#adr-007-infrastructure-aligned-pricing-vs-hosted-key--seat-taxes)       | Infrastructure-Aligned Pricing vs. Hosted Key & Seat Taxes         | **APPROVED** | 2026-09-27 |
| [**ADR-008**](#adr-008-exclusion-of-vendor-erp-and-desktop-software-from-scope)        | Exclusion of Vendor ERP and Desktop Software from Scope            | **APPROVED** | 2026-09-27 |

---

### ADR-001: Developer-First Continuous Localization vs. All-in-One Monolith

- **Status:** **APPROVED [DECISION]**
- **Context:** The initial concept proposed an "All-in-One GILT Platform" unifying 18 distinct domain areas (CMS, ERP, CAT, MT, i18n, testing, etc.).
- **Decision:** We explicitly reject building a monolithic All-in-One platform from scratch. We adopt a **developer-first continuous localization orchestration model** as our beachhead, solving the Git-to-Workbench continuous delivery loop and integrating via APIs with external systems (GitHub, Figma, Slack).
- **Rationale:** Avoids the "Jack of all trades" failure mode and allows us to deliver a 10x superior developer and localization velocity experience.

### ADR-002: Leveraging Existing Monorepo, NestJS 12 ESM & Drizzle ORM

- **Status:** **APPROVED [DECISION]**
- **Context:** The repository already possesses a high-quality monorepo setup running NestJS 12 ESM (`apps/server`), PostgreSQL 16 on port 5433 with Drizzle ORM (`packages/database`), and shared Zod schemas (`packages/validation`).
- **Decision:** Build backend services and database migrations directly within the existing structure, preserving all conventions (ESM relative `.js` imports, monotonic UUIDv7 keys, zero ESLint warnings, colocated Vitest specs).
- **Rationale:** Maximizes codebase reuse, avoids tooling thrash, and enforces strict end-to-end type safety.

### ADR-003: Dual String Identity: Hierarchical Key Path + SHA-256 Hash

- **Status:** **APPROVED [DECISION]**
- **Context:** The system must differentiate between logical code locations and raw translatable text to enable instant TM leverage across projects.
- **Decision:** Implement a dual-identity architecture:
  1. _Logical Identity:_ `(project_id, branch, key_identifier)` representing the code location.
  2. _Content Identity:_ `source_hash` = SHA-256 of the normalized source text.
- **Rationale:** Enables $O(1)$ exact TM lookup across projects while maintaining precise key and branch references in code.

### ADR-004: Retrieval-Augmented Localization (RAL) vs. Raw NMT

- **Status:** **APPROVED [DECISION]**
- **Context:** Raw NMT translates strings in isolation without situational context, producing UI text that truncates or uses incorrect grammatical gender.
- **Decision:** Implement Retrieval-Augmented Localization (RAL), assembling active glossaries, top-3 TM matches, component AST metadata, and visual snapshots into dynamic prompts for frontier LLMs.
- **Rationale:** Increases first-pass translation accuracy by 35%+ and eliminates ambiguity.

### ADR-005: Automated 3-Tier Quality Governance with MQM vs. Uniform MTPE

- **Status:** **APPROVED [DECISION]**
- **Context:** Routing 100% of machine translations to manual human post-editing queues (MTPE) creates an unacceptable 7–14 day release bottleneck.
- **Decision:** Implement a 3-tier automated gate: Tier 1 (Deterministic Syntax/Token Linter), Tier 2 (LLM-as-a-Judge MQM Scorer), and Tier 3 (Human Review exclusively for strings scoring $< 90$ or flagged as high-risk).
- **Rationale:** Auto-approves 70%+ of routine UI strings in seconds, allowing human linguists to focus exclusively on brand-critical copy.

### ADR-006: Virtual Copy-on-Write Branch Isolation Mirroring Git DAG

- **Status:** **APPROVED [DECISION]**
- **Context:** Modifying strings on Git feature branches traditionally causes severe merge collisions and duplicate keys in flat cloud TMS databases.
- **Decision:** Introduce virtual branches with copy-on-write inheritance from `main`. Changes made on a branch remain isolated until a Git merge webhook triggers branch reconciliation in Project Alpha.
- **Rationale:** Eliminates merge conflicts and phantom keys during continuous deployment.

### ADR-007: Infrastructure-Aligned Pricing vs. Hosted Key & Seat Taxes

- **Status:** **APPROVED [DECISION]**
- **Context:** Incumbents extort customers using hosted key caps and seat licenses, forcing teams to ration access.
- **Decision:** Provide unlimited hosted keys and unlimited collaborative seats. Monetize based on active CI/CD sync pipelines, compute, and AI token throughput.
- **Rationale:** Removes artificial adoption barriers and aligns commercial incentives with platform usage.

### ADR-008: Exclusion of Vendor ERP and Desktop Software from Scope

- **Status:** **APPROVED [DECISION]**
- **Context:** Traditional LSPs demand back-office accounting, invoicing, and purchase order tracking in their TMS.
- **Decision:** Explicitly exclude vendor invoicing ERPs, tax compliance, and Windows desktop software from the product roadmap. Provide clean XLIFF and REST APIs for external agency handoffs.
- **Rationale:** Prevents severe scope creep and maintains relentless focus on developer-native automation.
