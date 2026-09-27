# Product Discovery: The 10 Core Strategic Questions

This document provides direct, definitive answers to the 10 core product discovery questions, establishing the foundation for Project Alpha's product requirements, architecture, and roadmap.

---

## 1. What problem should this product actually solve?

- **Answer:** **Continuous software delivery is paralyzed by localization lag.** Modern engineering teams deploy to production multiple times a day via CI/CD, but localizing software takes 7 to 14 days because strings are treated as asynchronous spreadsheets, translators suffer from context starvation, Git branch synchronization causes merge collisions, and legacy TMS platforms extort teams with "hosted key" caps and per-seat taxes.

---

## 2. Who specifically has this problem?

- **Answer:** **Mid-market, developer-led software companies (50–1,000 employees)** building web, mobile, and cloud applications, localizing into 5 to 25 languages. The primary decision maker is the **Head of Engineering / VP Product**, in partnership with the **Localization Lead / Product Operations Manager**.

---

## 3. How serious and frequent is the problem?

- **Answer:**
  - **Frequency:** **Daily to hourly.** Every active pull request introducing new copy faces this bottleneck.
  - **Severity:** **Critical.** International markets generate 30%–60% of revenue for mature digital companies. Release delays directly postpone revenue, while mistranslated or overflowing UI copy erodes regional user trust.

---

## 4. How are companies solving it today?

- **Answer:**
  - _Manual Spreadsheet Transfers:_ Developers export JSON files and email them to translation agencies or bilingual colleagues.
  - _Raw Machine Translation Scripts:_ Developers pipe strings directly through Google Translate or DeepL API in terminal scripts, causing broken plural forms and corrupted `{variable}` placeholders.
  - _Rationing Seats:_ Buying 1 or 2 seats on Lokalise or Phrase to avoid steep tier upgrades, forcing the entire organization through a single human bottleneck.

---

## 5. What existing tools are used?

- **Answer:**
  - Cloud TMS: Lokalise, Phrase, Crowdin, Smartling.
  - Legacy Desktop/Server: Trados Studio, memoQ.
  - Developer Scripts: Custom GitHub Actions, raw DeepL/OpenAI API scripts.

---

## 6. What are the major limitations of current solutions?

- **Answer:**
  1. _Context Starvation:_ Strings are viewed in isolated table rows without visual screens, component hierarchies, or character width limits.
  2. _Fragile Branch Management:_ TMS tools treat projects as flat string repositories, creating duplicate keys and merge conflicts when Git branches rebase.
  3. _Uniform Post-Editing Bottleneck:_ Forcing 100% of machine translations into manual human review queues regardless of confidence.
  4. _Predatory Pricing Levers:_ Artificially capping "hosted keys" and user seats to extort enterprise contract upgrades.

---

## 7. Where are the strongest opportunities for improvement?

- **Answer:**
  1. _Retrieval-Augmented Localization (RAL):_ Feeding real-time glossaries, TM matches, component AST metadata, and visual screenshots to frontier LLMs at inference time.
  2. _Automated 3-Tier Quality Governance:_ Using deterministic linters + LLM-as-a-Judge MQM evaluation to auto-verify 70%+ of routine UI strings.
  3. _Git-Native Virtual Branching:_ Mirroring Git DAG branching so feature branches have complete string isolation with zero merge collisions.
  4. _Transparent Infrastructure Pricing:_ Eliminating hosted key caps and seat taxes, charging strictly for active sync pipelines, compute, and AI tokens.

---

## 8. Which problems are worth solving first? (Strategic Beachhead)

- **Answer:** **Continuous Localization for Web & Mobile Engineering Teams.**
  - Master the developer loop: Git webhook $\rightarrow$ AST key extraction $\rightarrow$ RAL-powered AI pre-translation $\rightarrow$ Deterministic QA $\rightarrow$ Automated PR creation.
  - Win the developer and technical localization manager first before attempting to expand into marketing documents or enterprise vendor ERPs.

---

## 9. What should be part of the core product? (MVP Scope)

- **Answer:**
  1. Multi-tenant Organizations & Projects with RBAC (Admin, PM, Developer, Linguist).
  2. AST Parsers for JSON, nested JSON, YAML, PO, iOS strings, and Android XML.
  3. Exact and fuzzy Translation Memory (TM) engine with TMX/TBX import/export.
  4. AI-RAL Pre-translation Pipeline injecting glossaries and context into frontier LLMs.
  5. Deterministic Token & ICU Plural Validation Linters.
  6. High-speed, keyboard-accessible Collaborative Web CAT Workbench with segment locking.
  7. GitHub Action & CLI (`alpha push / pull`) for automated PR synchronization.

---

## 10. What should explicitly NOT be built initially? (Anti-Features)

- **Answer:**
  1. _Traditional Windows Desktop CAT Application_ (Legacy Era 1 relic).
  2. _Complex Vendor Invoicing & Purchase Order ERP_ (High legal/accounting overhead).
  3. _Over-the-Air (OTA) Mobile SDK Runtime Interception_ (High maintenance risk; defer to Phase 3).
  4. _Proxy-Based Website Scraping (Smartling GDN style)_ (Fragile against modern client-hydrated SPAs).
  5. _Proprietary NMT Model Training from Scratch_ (Unnecessary capital expenditure; use RAL with frontier LLMs instead).
  6. _Arbitrary Hosted Key Pricing Caps_ (Customer-hostile anti-feature).
