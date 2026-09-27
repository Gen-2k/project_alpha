# Feature Research: Core MVP Scope vs. Anti-Features

This document establishes the boundaries of what **Project Alpha** will build in its Core MVP, supporting features, post-MVP enhancements, and explicit anti-features to avoid.

---

## 1. Feature Prioritization (MoSCoW Framework)

```mermaid
flowchart TD
    subgraph MustHave ["MUST HAVE (Core MVP - Phase 1)"]
        direction TB
        M1["Multi-Tenant Org & Projects (PostgreSQL 16 / Drizzle)"]
        M2["AST Parsers: JSON, YAML, PO, iOS, Android"]
        M3["Exact TM & Termbase Engine (SHA-256 Hash Matching)"]
        M4["AI-RAL Prompt Orchestrator with Glossary Injection"]
        M5["Deterministic ICU & Placeholder Linter"]
        M6["High-Speed Web CAT Workbench with Segment Locking"]
        M7["GitHub Action & CLI (`alpha push / pull`)"]
    end

    subgraph ShouldHave ["SHOULD HAVE (Phase 2)"]
        direction TB
        S1["Virtual Branch Rebase & Auto-Merge Engine"]
        S2["Automated LLM-as-a-Judge MQM Quality Evaluator"]
        S3["Interactive Visual DOM Previewer"]
        S4["Figma Two-Way Copy Plugin"]
        S5["Automated PR Review Companion Bot"]
    end

    subgraph CouldHave ["COULD HAVE (Phase 3)"]
        direction TB
        C1["Over-the-Air (OTA) Mobile SDKs"]
        C2["LSP Vendor Exchange / Job Bidding"]
        C3["Fine-Tuned Domain Adapters for Private LLMs"]
    end

    subgraph WontHave ["WON'T HAVE (Explicit Anti-Features)"]
        direction TB
        W1["Desktop Windows CAT Software"]
        W2["Vendor Invoice & Purchase Order ERP"]
        W3["Proxy-Based Web Scraper (GDN)"]
        W4["Proprietary NMT Training from Scratch"]
        W5["Artificial Hosted Key Pricing Caps"]
    end

    MustHave --> ShouldHave
    ShouldHave --> CouldHave
```

---

## 2. Granular Feature Specifications

### 1. Core MVP Features (Must Have)

1. **Multi-Tenant Workspaces & RBAC:**
   - Organizations, Projects, and granular permissions (`Admin`, `PM`, `Developer`, `Linguist`).
   - Built on existing `apps/server` (NestJS 12 ESM) and `@repo/database` (PostgreSQL 16, UUIDv7).
2. **AST Parsing Pipeline:**
   - Format-agnostic parsers for standard software files (JSON, nested JSON, YAML, PO, iOS strings, Android XML).
   - Tokenizes interpolation parameters and validates syntax before database persistence.
3. **Translation Memory & Glossary Storage:**
   - $O(1)$ exact source-hash lookup (SHA-256) + Levenshtein fuzzy match indexing.
   - Full TMX and TBX import/export support.
4. **Retrieval-Augmented Localization (RAL) Engine:**
   - Dynamic prompt assembly injecting glossaries, top-3 TM matches, character limits, and AST metadata into frontier LLMs.
5. **Deterministic Syntax Linter:**
   - Sub-millisecond in-memory validation checking bracket parity, parameter names, and CLDR plural completeness.
6. **Collaborative Web CAT Workbench:**
   - Clean, keyboard-accessible editor with segment locking (Redis-backed), concordance search, and diff views.
7. **Developer CLI & GitHub Action:**
   - `alpha push` / `alpha pull` commands and a GitHub Action enabling automated CI/CD synchronization.

---

### 3. Explicit Anti-Features (What We Will Deliberately Avoid)

| Anti-Feature                            | Why Incumbents Built It                                                             | Why Project Alpha Explicitly Rejects It                                                                                                |
| :-------------------------------------- | :---------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------- |
| **Traditional Desktop CAT Application** | Built in the 1990s when cloud computing didn't exist.                               | High maintenance overhead; completely incompatible with real-time continuous deployment.                                               |
| **Vendor ERP & Invoicing Engine**       | Legacy agencies used TMS as their back-office accounting software.                  | High legal, tax, and accounting liability. Diverts engineering resources away from developer automation.                               |
| **Proxy-Based Web Scraping (GDN)**      | Allowed marketing teams to translate websites without engineering help in 2012.     | Fragile against modern client-hydrated single-page applications (React, Next.js). Code-level extraction is 10x more reliable.          |
| **Arbitrary Hosted Key Pricing Caps**   | Created by SaaS founders to maximize expansion revenue through artificial scarcity. | Alienates developers, causes customer resentment, and forces teams to write unnatural code workarounds.                                |
| **Proprietary NMT Model Training**      | Necessary before 2023 when general models were weak at translation.                 | Multi-million dollar compute expense with rapid obsolescence. RAL with frontier LLMs outperforms static NMT at a fraction of the cost. |
