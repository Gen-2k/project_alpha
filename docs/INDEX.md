# Project Alpha — Localization & Globalization Research Repository

Welcome to the definitive domain research, market validation, product strategy, and engineering specification repository for **Project Alpha**. This knowledge base serves as the long-term architectural and product reference for building a modern, continuous localization platform.

---

## 1. Directory Structure & Document Navigation

```text
docs/
├── domain/                  # Real-world industry operations & maturity models
├── market-research/         # TAM, growth drivers, AI value reallocation, customer demand
├── competitor-research/     # Incumbent profiles, category taxonomy, pricing traps
├── customer-research/       # 10 customer segments, ICP definition, beachhead strategy
├── user-personas/           # 9 stakeholder profiles, JTBD, cross-functional matrix
├── workflows/               # End-to-end reality maps, failure points, business rules
├── pain-points/             # 9-question evaluation of 15+ acute customer problems
├── industry-terminology/    # Canonical domain glossary (GILT, TM, MQM, ICU, CLDR)
├── product-discovery/       # Critical evaluation of the "All-in-One" hypothesis & 10 questions
├── opportunities/           # 4-tier opportunity matrix (Strong evidence to unviable)
├── feature-research/        # MoSCoW MVP scope, supporting features, anti-features
├── ai-opportunities/        # Realistic AI (RAL, MQM) vs. hype, security & token economics
├── architecture/            # NestJS 12 ESM + PostgreSQL 16 Drizzle schema, SLAs, AST engine
├── assumptions/             # Documented technical, market, and operational assumptions
├── hypotheses/              # Testable product hypotheses with validation experiments
├── decisions/               # Formal Architecture & Product Decision Records (ADRs 001–008)
├── open-questions/          # Active research backlog and technical unknowns
├── roadmap/                 # Phased strategic roadmap (Phase 1 MVP to Phase 3 Enterprise)
└── sources/                 # Comprehensive bibliography of standards and literature
```

### Complete Document Index

> [!TIP]
> **New to the project? Start here:** [**`docs/00_EXECUTIVE_PRODUCT_BRIEF.md`**](file:///d:/project_alpha/docs/00_EXECUTIVE_PRODUCT_BRIEF.md) — A 5-minute plain-English executive summary covering what we are building, why it wins, and how it works.

| Category                          | Document Link                                                                                                                                         | Core Focus                                                                                                          |
| :-------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------ |
| **★ START HERE: Executive Brief** | [**`docs/00_EXECUTIVE_PRODUCT_BRIEF.md`**](file:///d:/project_alpha/docs/00_EXECUTIVE_PRODUCT_BRIEF.md)                                               | **The 5-minute plain-English guide to what we are building, why it wins, and how it works.**                        |
| **Domain Operations**             | [**`docs/domain/overview.md`**](file:///d:/project_alpha/docs/domain/overview.md)                                                                     | How large, mid-market, and startups actually handle localization today; shadow workflows in Slack/Sheets.           |
| **BiDi, RTL & CJK Typography**    | [**`docs/domain/bidi-rtl-and-typography.md`**](file:///d:/project_alpha/docs/domain/bidi-rtl-and-typography.md)                                       | Right-to-Left mirroring rules, CSS logical properties, BiDi punctuation bugs, and CJK line breaks.                  |
| **Maturity Model**                | [**`docs/domain/maturity-model.md`**](file:///d:/project_alpha/docs/domain/maturity-model.md)                                                         | 5 stages of localization maturity and why modern tech companies get stuck between Level 3 and 4.                    |
| **International SEO & Fallbacks** | [**`docs/domain/seo-and-locale-cascades.md`**](file:///d:/project_alpha/docs/domain/seo-and-locale-cascades.md)                                       | 4-tier dialect fallback cascade (`es-AR` -> `es-419` -> `es` -> `en`) and Google `hreflang` SEO tag rules.          |
| **Market Size & Trends**          | [**`docs/market-research/market-size-and-trends.md`**](file:///d:/project_alpha/docs/market-research/market-size-and-trends.md)                       | \$67.2B TAM; the AI inflection point; value shift from translation generation to context and QA.                    |
| **Demand & Dynamics**             | [**`docs/market-research/demand-and-dynamics.md`**](file:///d:/project_alpha/docs/market-research/demand-and-dynamics.md)                             | Customer demand drivers, enterprise inertia, scale-up urgency, and unaddressed market gaps.                         |
| **Competitor Landscape**          | [**`docs/competitor-research/landscape-overview.md`**](file:///d:/project_alpha/docs/competitor-research/landscape-overview.md)                       | Category taxonomy across legacy TMS, cloud TMS, dev-first tools, ERP/VMS, and AI engines.                           |
| **Competitor Profiles**           | [**`docs/competitor-research/competitor-profiles.md`**](file:///d:/project_alpha/docs/competitor-research/competitor-profiles.md)                     | Deep analysis of Lokalise, Phrase, Smartling, Crowdin, and Lingo.dev (strengths, limits, complaints).               |
| **Monetization Traps**            | [**`docs/competitor-research/pricing-models-and-traps.md`**](file:///d:/project_alpha/docs/competitor-research/pricing-models-and-traps.md)           | The hosted key cap trap, seat license taxes, enterprise paywalls, and Project Alpha's disruption.                   |
| **Customer Segments**             | [**`docs/customer-research/segments-analysis.md`**](file:///d:/project_alpha/docs/customer-research/segments-analysis.md)                             | Comparative matrix across 10 customer segments (Startups, SaaS, Mobile, Enterprise, LSPs, etc.).                    |
| **Target ICP**                    | [**`docs/customer-research/target-icp-selection.md`**](file:///d:/project_alpha/docs/customer-research/target-icp-selection.md)                       | Objective justification for our beachhead: Mid-market developer-led SaaS (50–1,000 employees).                      |
| **User Personas**                 | [**`docs/user-personas/personas-matrix.md`**](file:///d:/project_alpha/docs/user-personas/personas-matrix.md)                                         | 9 granular personas (Loc Manager, Dev, PM, Linguist, Reviewer, Designer, Admin) with JTBD.                          |
| **Operational Reality**           | [**`docs/workflows/end-to-end-reality.md`**](file:///d:/project_alpha/docs/workflows/end-to-end-reality.md)                                           | End-to-end workflow map detailing inputs, outputs, systems, failure points, and manual bottlenecks.                 |
| **Frontend Framework Realities**  | [**`docs/workflows/frontend-framework-realities.md`**](file:///d:/project_alpha/docs/workflows/frontend-framework-realities.md)                       | Next.js Server Components vs Client Components, Monorepo shared `@repo/ui` packages, and dynamic key bugs.          |
| **Business Rules**                | [**`docs/workflows/business-rules.md`**](file:///d:/project_alpha/docs/workflows/business-rules.md)                                                   | Formal domain logic: TM leverage discount grid, string invalidation state machine, segment locks.                   |
| **LQA & Vendor Economics**        | [**`docs/workflows/lqa-and-vendor-mechanics.md`**](file:///d:/project_alpha/docs/workflows/lqa-and-vendor-mechanics.md)                               | Linguistic Quality Assurance (LQA) sampling thresholds, vendor fuzzy grids, and minimum fee avoidance.              |
| **Customer Pain Points**          | [**`docs/pain-points/core-pain-points.md`**](file:///d:/project_alpha/docs/pain-points/core-pain-points.md)                                           | 9-question evaluation of 15+ acute pain points (branch merge hell, context starvation, review delays).              |
| **Domain Terminology**            | [**`docs/industry-terminology/glossary.md`**](file:///d:/project_alpha/docs/industry-terminology/glossary.md)                                         | Canonical definitions of GILT, TM leverage tiers (ICE, fuzzy), MQM, ICU, XLIFF, CLDR, pseudo-loc.                   |
| **The All-in-One Critique**       | [**`docs/product-discovery/the-all-in-one-critique.md`**](file:///d:/project_alpha/docs/product-discovery/the-all-in-one-critique.md)                 | **Critical evaluation challenging the All-in-One hypothesis; why monoliths fail; what to unify vs. integrate.**     |
| **GILTflow Synthesis & Critique** | [**`docs/product-discovery/giltflow-synthesis-and-critique.md`**](file:///d:/project_alpha/docs/product-discovery/giltflow-synthesis-and-critique.md) | **Deep analysis of the GILTflow validation report & PRD; fatal AST flaws, en-only trap, and unified path forward.** |
| **The 10 Core Questions**         | [**`docs/product-discovery/ten-core-questions.md`**](file:///d:/project_alpha/docs/product-discovery/ten-core-questions.md)                           | Direct strategic answers to the 10 foundational discovery questions.                                                |
| **Opportunity Matrix**            | [**`docs/opportunities/opportunity-matrix.md`**](file:///d:/project_alpha/docs/opportunities/opportunity-matrix.md)                                   | 4-tier opportunity prioritization (Strong evidence, Promising hypotheses, Uncertain, Avoid).                        |
| **MVP Scope & Anti-Features**     | [**`docs/feature-research/core-vs-avoid.md`**](file:///d:/project_alpha/docs/feature-research/core-vs-avoid.md)                                       | MoSCoW prioritization defining Core MVP, supporting features, and explicit anti-features.                           |
| **AI Reality vs. Hype**           | [**`docs/ai-opportunities/ai-reality-vs-hype.md`**](file:///d:/project_alpha/docs/ai-opportunities/ai-reality-vs-hype.md)                             | Realistic AI applications (RAL, MQM evaluation, PR agent) vs. marketing hype and unviable myths.                    |
| **AI Security & Costs**           | [**`docs/ai-opportunities/security-and-cost.md`**](file:///d:/project_alpha/docs/ai-opportunities/security-and-cost.md)                               | Zero Data Retention (ZDR), in-flight PII redaction, prompt injection defense, and token economics.                  |
| **System Architecture**           | [**`docs/architecture/system-blueprint.md`**](file:///d:/project_alpha/docs/architecture/system-blueprint.md)                                         | NestJS 12 ESM + PostgreSQL 16 Drizzle schema (`keys`, `segments`, `revisions`), SLAs, and AST engine.               |
| **Assumptions**                   | [**`docs/assumptions/documented-assumptions.md`**](file:///d:/project_alpha/docs/assumptions/documented-assumptions.md)                               | Explicit tracking of technical, commercial, and operational assumptions.                                            |
| **Hypotheses**                    | [**`docs/hypotheses/validation-hypotheses.md`**](file:///d:/project_alpha/docs/hypotheses/validation-hypotheses.md)                                   | Testable hypotheses and validation experiment definitions with clear success metrics.                               |
| **Decision Records (ADRs)**       | [**`docs/decisions/adr-log.md`**](file:///d:/project_alpha/docs/decisions/adr-log.md)                                                                 | Formal ADRs 001 through 008 recording architectural, product, and commercial decisions.                             |
| **Open Questions**                | [**`docs/open-questions/backlog.md`**](file:///d:/project_alpha/docs/open-questions/backlog.md)                                                       | Active backlog of unresolved technical and market questions.                                                        |
| **Product Roadmap**               | [**`docs/roadmap/phased-roadmap.md`**](file:///d:/project_alpha/docs/roadmap/phased-roadmap.md)                                                       | 3-phase strategic roadmap (MVP Foundation $\rightarrow$ Autonomous Intelligence $\rightarrow$ Enterprise Scale).    |
| **Sources & Standards**           | [**`docs/sources/bibliography.md`**](file:///d:/project_alpha/docs/sources/bibliography.md)                                                           | Full citations of Unicode CLDR, W3C MQM, ISO standards, and academic papers.                                        |

---

## 2. Research Epistemology & Classification Standard

To ensure maximum engineering and strategic rigor, all findings in this repository adhere to the following taxonomy:

- **[FACT]:** Verified industry standard, published specification (e.g., Unicode CLDR, W3C MQM, ISO 17100, RFC 9562), or verified platform metric.
- **[OBSERVATION]:** Empirically observed industry practice, vendor positioning, or widespread market behavior reported by analysts (Slator, Nimdzi).
- **[PAIN POINT]:** Real-world friction documented in customer interviews, developer forums, G2/Capterra reviews, or community discussions.
- **[COMPETITOR CLAIM]:** Marketing or capability claims made by a competitor, subject to known limitations.
- **[HYPOTHESIS]:** An unproven strategic assumption about user behavior or technical viability that requires prototype testing or customer validation.
- **[DECISION]:** A conscious, documented engineering or product choice adopted for Project Alpha, accompanied by rationale and tradeoffs.

---

## 3. Executive Strategic Summary

> **The Core Finding:** The user's initial proposal of an "All-in-One GILT Platform" that attempts to build a monolithic CMS, ERP, CAT tool, MT engine, and code repository from scratch is an anti-pattern that faces insurmountable switching barriers and product dilution.
>
> However, building a **Continuous Developer-Native Localization Infrastructure**—which unifies the developer-to-linguist pipeline via **Retrieval-Augmented Localization (RAL)** and **Automated 3-Tier MQM Quality Triage** while integrating cleanly with Git, Figma, and Slack—represents a massive, highly underserved market opportunity with eager buyers and compelling unit economics.
