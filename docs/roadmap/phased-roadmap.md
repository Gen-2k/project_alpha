# Product Roadmap: Phased Strategic Evolution

> [!NOTE]
> **Plain-English Summary (In 30 Seconds):**
>
> - **Phase 1 (MVP — The Core Loop):** Connect GitHub to AI so when a developer pushes code, hardcoded strings are automatically extracted, translated, linted, and merged via Pull Request.
> - **Phase 2 (Automated Intelligence):** Add interactive visual previews, Figma sync, and automated quality scoring so teams can approve translations in seconds without waiting for human reviewers.
> - **Phase 3 (Enterprise Scale):** Add translation agency marketplaces, enterprise security (SSO / SOC 2), and over-the-air mobile app updates.

---

## 1. Roadmap Architecture & Phases

```mermaid
flowchart LR
    subgraph Phase1 ["Phase 1: Foundation & Core MVP (Q4 2026)"]
        direction TB
        P1_1["1. Organizations & Projects Service"]
        P1_2["2. AST Parsers & Key Extraction"]
        P1_3["3. Exact TM & Glossary Engine"]
        P1_4["4. AI-RAL Prompt Orchestrator"]
        P1_5["5. Deterministic Syntax Linter"]
        P1_6["6. Collaborative Web CAT Workbench"]
        P1_7["7. GitHub Action & CLI Sync"]
        P1_1 --> P1_2 --> P1_3 --> P1_4 --> P1_5 --> P1_6 --> P1_7
    end

    subgraph Phase2 ["Phase 2: Autonomous Intelligence (Q1 2027)"]
        direction TB
        P2_1["8. Virtual Git Branching & Auto-Rebase"]
        P2_2["9. LLM-as-a-Judge MQM Evaluator"]
        P2_3["10. Interactive Visual DOM Preview"]
        P2_4["11. Figma Two-Way Sync Plugin"]
        P2_5["12. Automated PR Companion Bot"]
        P2_1 --> P2_2 --> P2_3 --> P2_4 --> P2_5
    end

    subgraph Phase3 ["Phase 3: Enterprise & Scale (Q2 2027)"]
        direction TB
        P3_1["13. LSP Vendor Exchange & Bidding"]
        P3_2["14. Runtime Mobile/Web OTA SDKs"]
        P3_3["15. SOC 2 Audit Suite & SAML SSO"]
        P3_1 --> P3_2 --> P3_3
    end

    Phase1 -->|"MVP Complete"| Phase2
    Phase2 -->|"Continuous Scale"| Phase3
```

---

## 2. Granular Milestone Deliverables

### Phase 1: Foundation & Core MVP (The Continuous Loop)

- **Objective:** Enable software engineering teams to automatically extract, pre-translate, validate, and synchronize strings between Git and native linguists.
- **Key Deliverables:**
  - Multi-tenant Organizations & Projects service with RBAC (`Admin`, `PM`, `Developer`, `Linguist`).
  - AST parsers for JSON, nested JSON, YAML, PO, iOS strings, and Android XML.
  - Exact and fuzzy Translation Memory engine with TMX/TBX import/export.
  - AI-RAL pre-translation prompt engine with glossary injection.
  - Deterministic ICU plural and placeholder validation linters.
  - Responsive, keyboard-accessible Web CAT Workbench with segment locking.
  - Project Alpha CLI (`alpha push / pull`) and GitHub Action integration.

### Phase 2: Autonomous Intelligence & Continuous Workflow

- **Objective:** Eliminate the human review bottleneck and enable zero-conflict Git branch isolation.
- **Key Deliverables:**
  - Virtual copy-on-write Git branch modeling with automatic reconciliation on PR merge.
  - Automated Tier-2 MQM Quality Estimation using LLM-as-a-Judge.
  - Interactive visual DOM preview integrated with Playwright/Cypress end-to-end tests.
  - Figma two-way copy synchronization plugin for product designers.
  - Autonomous PR review companion bot with interactive diff previews.

### Phase 3: Enterprise Ecosystem & Scale

- **Objective:** Expand into enterprise compliance, vendor exchanges, and over-the-air runtime distribution.
- **Key Deliverables:**
  - Vendor marketplace and external LSP handoff portal.
  - Over-the-air (OTA) client SDKs for dynamic iOS, Android, and React runtime updates.
  - Single Sign-On (SAML 2.0 / Okta) and comprehensive SOC 2 Type II audit logging.
  - Fine-tuned domain adapters for high-security on-premise deployments.
