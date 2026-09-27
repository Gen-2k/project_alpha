# Industry Terminology: Canonical Domain Glossary

This document provides the definitive glossary of technical, linguistic, and operational terms in globalization, internationalization, localization, and translation management.

---

## 1. The GILT Paradigm

- **Globalization (`g11n`) [FACT]:** The comprehensive corporate strategy and engineering preparation required to expand a company, product, or service into international markets. Includes legal compliance, currency handling, tax regimes, and local support.
- **Internationalization (`i18n`) [FACT]:** The architectural and software engineering practice of designing a codebase so that it can be adapted to multiple languages and regions without requiring source code modifications.
- **Localization (`l10n`) [FACT]:** The process of adapting a product, user interface, or content specifically for a target locale, encompassing translation, cultural nuance, local date/number conventions, and visual layout adjustments.
- **Translation (`t9n`) [FACT]:** The linguistic conversion of text from a source language to a target language while preserving semantic meaning, register, and tone.
- **Locale [FACT]:** A standardized identifier (BCP 47 / RFC 5646) specifying a language and regional variation (e.g., `en-US`, `pt-BR`, `es-419`, `zh-Hans-CN`).

---

## 2. Translation Memory & Leverage Terminology

- **Segment [FACT]:** The atomic unit of translation. In prose, typically a single sentence defined by Unicode UAX #29 sentence boundary algorithms; in software UI, an individual UI key or formatted message.
- **Translation Unit (TU) [FACT]:** A structured record pairing a source segment with its target translation(s) and metadata (author, timestamp, status).
- **Translation Memory (TM) [FACT]:** A database of previously translated translation units used to prevent redundant human translation and maintain consistency across releases.
- **Exact Match (100%) [FACT]:** A segment identical in characters to an existing TM source segment, but without verified surrounding context.
- **In-Context Exact (ICE) / Context Match (101% / 102%) [FACT]:** A 100% exact match where the surrounding context (previous/next segment or exact unique key identifier) also matches historical records. Can safely bypass human review.
- **Fuzzy Match (75%–99%) [FACT]:** A segment bearing high lexical similarity (Levenshtein distance, n-gram overlap, or vector cosine similarity) to an existing TM entry.
- **Leverage Discount Grid [FACT]:** The industry pricing structure that discounts translator pay rates according to TM match percentage (e.g., paying 0% for ICE matches, 30% for 100% matches, and 100% for new words).

---

## 3. Linguistic & Quality Taxonomy

- **Termbase (TBX) & Glossary [FACT]:** A structured database of domain-specific terminology, brand names, and technical terms with approved translations, definitions, and "Do Not Translate" (DNT) flags. Standardized by ISO 30042.
- **Machine Translation (MT) [FACT]:** Automated translation of text by computer software. Includes Statistical MT (legacy), Neural MT (NMT, e.g., DeepL, Google Translate), and Generative LLMs (e.g., GPT-4o, Claude, Gemini).
- **MTPE (Machine Translation Post-Editing) [FACT]:** The practice of human linguists reviewing and editing machine translation output to achieve human quality (Light Post-Editing vs. Full Post-Editing per ISO 18587).
- **MQM (Multidimensional Quality Metrics) [FACT]:** The open industry standard framework (W3C / ASTM F2575) for categorizing and quantifying translation errors across Accuracy, Fluency, Terminology, Style, and Design, weighted by severity (Minor = 1, Major = 5, Critical = 25).
- **BLEU / chrF / COMET [FACT]:** Automated translation evaluation metrics:
  - _BLEU:_ N-gram precision against human reference (antiquated, insensitive to subtle grammar).
  - _chrF:_ Character n-gram F-score, effective for morphologically rich languages.
  - _COMET:_ Neural metric trained on human MQM annotations; modern gold standard for automated offline quality evaluation.
- **Quality Estimation (QE) [FACT]:** Predicting translation quality at inference time without requiring human reference translations. Modern QE utilizes "LLM-as-a-Judge" prompted with MQM taxonomies.

---

## 4. Engineering & File Format Standards

- **XLIFF (1.2 & 2.1) [FACT]:** _XML Localisation Interchange File Format_. The OASIS open XML standard for exchanging bilingual translation units and inline formatting tags between TMS tools and translation agencies.
- **TMX [FACT]:** _Translation Memory eXchange_. The XML standard for migrating translation memories between different CAT tools.
- **TBX [FACT]:** _TermBase eXchange_. The ISO 30042 XML standard for terminology data exchange.
- **ICU MessageFormat [FACT]:** The Unicode standard for handling complex strings containing dynamic plurals, select/gender cases, and argument formatting in software applications (e.g., `{count, plural, one {# item} other {# items}}`).
- **Unicode CLDR [FACT]:** _Common Locale Data Repository_. The definitive standard database maintained by the Unicode Consortium providing locale data, plural rules, date/number formats, and currency symbols.
- **Pseudo-Localization [FACT]:** A software testing practice that transforms source text with expanded accented characters (e.g., `Account` $\rightarrow$ `[!!! Àççôûñţ !!!]`) to verify that the UI can handle text expansion and bidirectional rendering without crashing.
