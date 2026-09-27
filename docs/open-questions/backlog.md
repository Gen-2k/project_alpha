# Open Questions & Research Backlog

This document maintains the active backlog of unresolved technical, product, and commercial questions for **Project Alpha**, along with their planned resolution methods.

---

## 1. Active Open Questions

| Question ID | Category              | Question Statement                                                                                                                                                  | Planned Resolution Method                                                                    | Owner           |
| :---------- | :-------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------- | :-------------- |
| **Q-01**    | Database Architecture | At what vector scale does PostgreSQL `pgvector` with HNSW indexing degrade in query latency compared to dedicated vector stores (Qdrant / Milvus)?                  | Run benchmark stress tests at 1M, 5M, and 10M embeddings under 100 concurrent read requests. | Lead Architect  |
| **Q-02**    | Product Integration   | For early-stage mid-market engineering teams, do string keys originate primarily in Figma designs or directly in frontend code?                                     | Conduct 15 user interviews with design and engineering leads.                                | Product Lead    |
| **Q-03**    | AI Governance         | What prompt pattern produces the highest human correlation for LLM-as-a-Judge MQM evaluation across Semitic (Arabic, Hebrew) and CJK (Japanese, Chinese) languages? | Run benchmark evaluation using W3C MQM reference datasets across frontier models.            | AI Engineer     |
| **Q-04**    | Commercial Strategy   | Should AI token consumption be billed at cost with platform markup, or bundled into predictable monthly tier allowances?                                            | Financial modeling comparing margin stability across usage tiers.                            | Strategist      |
| **Q-05**    | Legal & Compliance    | What specific data residency requirements do EU enterprise customers require for Translation Memory storage under GDPR?                                             | Legal compliance consultation regarding EU-hosted Postgres instances.                        | Compliance Lead |
