# Documented Assumptions

This document lists all explicit technical, commercial, and operational assumptions underlying **Project Alpha**, ensuring they are tracked and tested rather than assumed as established facts.

---

## 1. Technical Assumptions

- **[ASSUMPTION-TECH-01]:** Developers prefer code-first string extraction via standard formats (JSON, YAML, PO) over proprietary proxy-based website scrapers.
- **[ASSUMPTION-TECH-02]:** PostgreSQL 16 with the `pgvector` extension and HNSW indexing will provide adequate performance for up to 5 million translation memory vector embeddings before requiring a dedicated vector database (e.g., Qdrant or Milvus).
- **[ASSUMPTION-TECH-03]:** In-memory AST token parsers can validate ICU MessageFormat syntax in under 5 milliseconds per string during CI/CD execution.
- **[ASSUMPTION-TECH-04]:** Commercial frontier LLMs (OpenAI GPT-4o, Anthropic Claude 3.5 Sonnet, Google Gemini 1.5/2.0) provided with rich RAL prompt context will achieve MQM quality scores $\ge 90$ on at least 70% of standard software UI strings without human editing.

---

## 2. Customer & Market Assumptions

- **[ASSUMPTION-MKT-01]:** Mid-market software companies (50–1,000 employees) are willing to pay \$5,000–\$25,000/year for a platform that eliminates Git branch localization merge conflicts and drops localization turnaround from 10 days to 10 minutes.
- **[ASSUMPTION-MKT-02]:** Engineering leads and Heads of Product have enough purchasing authority to buy developer-first localization tools without undergoing 9-month enterprise procurement cycles.
- **[ASSUMPTION-MKT-03]:** Customers will welcome a usage-based / infrastructure-aligned pricing model (unlimited keys and seats) and prefer it over incumbent "hosted key" caps and seat taxation.

---

## 3. Operational & Organizational Assumptions

- **[ASSUMPTION-OPS-01]:** In-country marketing reviewers will approve translations faster when presented with an interactive visual DOM preview rather than a spreadsheet table.
- **[ASSUMPTION-OPS-02]:** Organizations do not require their TMS to handle complex vendor procurement, VAT invoicing, or currency factoring if the platform provides clean XLIFF export/import or direct agency API connectors.
